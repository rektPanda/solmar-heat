// Solmar Heat — game core (pure logic) + browser bootstrap + autopilot.
// Pure functions work in Node (headless test) and in the browser.
(function () {
  var S = (globalThis.Solmar = globalThis.Solmar || {});
  var C = S.Config;

  function zeroInput() {
    return { up: false, down: false, left: false, right: false, run: false, actionPressed: false, missionPressed: false, autopilotPressed: false };
  }

  function createGame() {
    var city = S.City.buildCity(1337);
    var st = {
      time: 0,
      clock: C.START_CLOCK,
      money: 0,
      health: C.PLAYER_HEALTH,
      wanted: 0,
      wantedTimer: 0,
      bustTimer: 0,
      lastDamage: 99,
      busted: 0,
      wasted: 0,
      won: false,
      message: '',
      messageTimer: 0,
      dialogue: [],
      dialogueTimer: 99,
      city: city,
      player: { x: city.landmarks.safehouse.x, y: city.landmarks.safehouse.y, angle: 0, speed: 0, onFoot: true, car: null, moving: false },
      cars: [],
      peds: [],
      mission: { active: false, index: 0, step: 0, waitTimer: 0, completed: [] },
      autopilot: false,
      autoPath: null,
      autoPathTarget: null,
      autoPathAt: -99,
      autoStuckAt: 0,
      autoLastPos: null,
      autoReverseUntil: 0
    };
    // Parked cars around town (drivable).
    var spots = [
      { x: 600, y: 700 }, { x: 1000, y: 1100 }, { x: 1400, y: 600 },
      { x: 1800, y: 1400 }, { x: 2200, y: 1000 }, { x: 2600, y: 1400 },
      { x: 1000, y: 1800 }, { x: 2600, y: 2200 }, { x: 1400, y: 2200 },
      { x: 3000, y: 1000 }
    ];
    for (var i = 0; i < spots.length; i++) {
      st.cars.push(S.Entities.makeCar(i, spots[i].x, spots[i].y, (i % 4) * Math.PI / 2, { kind: 'parked' }));
    }
    // The mission sports car (mission 3).
    var sc = S.City.LANDMARKS.sportscar;
    st.cars.push(S.Entities.makeCar(900, sc.x, sc.y, 0, { kind: 'mission', color: '#c23b2e', model: 'Sport' }));
    // Traffic.
    for (var t = 0; t < C.TRAFFIC_CARS; t++) {
      var rp = S.City.nearestRoadPoint(400 + Math.random() * 2400, 400 + Math.random() * 1600);
      st.cars.push(S.Entities.makeCar(100 + t, rp.x, rp.y, 0, { kind: 'civil' }));
    }
    // Pedestrians on sidewalks (off-road, inside blocks).
    for (var q = 0; q < C.PEDS; q++) {
      var px = 300 + Math.random() * 2700, py = 300 + Math.random() * 1800;
      st.peds.push(S.Entities.makePed(px, py));
    }
    return st;
  }

  function updateGame(state, input, dt) {
    dt = Math.min(0.05, Math.max(0.001, dt));
    state.time += dt;
    state.clock = (C.START_CLOCK + state.time * C.CLOCK_RATE) % 24;
    state.lastDamage += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.dialogueTimer < 99) state.dialogueTimer += dt;

    // Mission start key.
    if (input.missionPressed && !state.mission.active) {
      var next = S.Missions.nextMissionIndex(state);
      if (next >= 0) S.Missions.startMission(state, next);
    }

    S.Entities.updatePlayer(state, input, dt);
    S.Entities.updateTraffic(state, dt);
    S.Entities.updatePolice(state, dt);
    S.Missions.updateMission(state, dt);
    S.Entities.checkWasted(state);

    // Health regen after 3s without damage.
    if (state.lastDamage > 3 && state.health < C.PLAYER_HEALTH && state.health > 0) {
      state.health = Math.min(C.PLAYER_HEALTH, state.health + C.HEALTH_REGEN * dt);
    }
  }

  // ---- Autopilot: drives/walks to the current mission objective. ----
  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function autopilotInput(state) {
    var input = zeroInput();
    var p = state.player;
    var step = S.Missions.currentStep(state);
    if (!state.mission.active || !step) return input;

    var target = null;
    var needCar = false;
    if (step.type === 'steal') {
      if (!p.onFoot && p.car && p.car.kind === 'mission') {
        // Steal done; the step will advance. Head to the next step's target.
        var def = S.Missions.MISSIONS[state.mission.index];
        var ns = def.steps[state.mission.step + 1];
        if (ns) target = S.Missions.missionTarget(state, ns);
      } else if (!p.onFoot) {
        // Driving the wrong car: get close to the sports car, then get out.
        var sc0 = S.City.LANDMARKS.sportscar;
        target = { x: sc0.x, y: sc0.y };
        if (S.Entities.dist(p, sc0) < 130) input.actionPressed = true;
      } else {
        var sc = S.City.LANDMARKS.sportscar;
        target = { x: sc.x, y: sc.y };
        needCar = true;
      }
    } else {
      target = S.Missions.missionTarget(state, step);
    }
    if (!target) return input;

    var dTarget = S.Entities.dist(p, target);
    // On foot and far away: go get a car first.
    if (p.onFoot && dTarget > 320 && !needCar) {
      var car = S.Entities.nearestCar(state.cars, p.x, p.y, 1e9, function (c) {
        return c.kind !== 'police' && !c.driver;
      });
      if (car) {
        target = { x: car.x, y: car.y };
        if (S.Entities.dist(p, car) < 50) input.actionPressed = true;
      }
    }
    if (needCar && p.onFoot) {
      var mc = null;
      for (var i = 0; i < state.cars.length; i++) {
        if (state.cars[i].kind === 'mission') mc = state.cars[i];
      }
      if (mc) {
        target = { x: mc.x, y: mc.y };
        if (S.Entities.dist(p, mc) < 50) input.actionPressed = true;
      }
    }

    // (Re)compute path when the target moved or every second.
    var tKey = Math.round(target.x) + ':' + Math.round(target.y);
    if (!state.autoPath || state.autoPathTarget !== tKey || state.time - state.autoPathAt > 1.0) {
      state.autoPath = S.City.findPath(state.city, p.x, p.y, target.x, target.y);
      state.autoPathTarget = tKey;
      state.autoPathAt = state.time;
    }
    var path = state.autoPath;
    var wp = null;
    if (path && path.length) {
      // Skip waypoints already reached.
      while (path.length > 1 && S.Entities.dist(p, path[0]) < 46) path.shift();
      wp = path[0];
      if (path.length === 1 && S.Entities.dist(p, wp) < 30) {
        // Arrived at final target: stop (wait steps hold position).
        return input;
      }
    } else {
      wp = target;
    }

    // Stuck detection: if barely moving while trying, reverse briefly and
    // force a fresh path (the old one may route through a wall).
    if (!state.autoLastPos) state.autoLastPos = { x: p.x, y: p.y, t: state.time };
    var moved = S.Entities.dist(p, state.autoLastPos);
    if (state.time - state.autoLastPos.t > 1.5) {
      if (moved < 12 && state.time > state.autoReverseUntil) {
        state.autoReverseUntil = state.time + 1.0;
        state.autoPath = null;
      }
      state.autoLastPos = { x: p.x, y: p.y, t: state.time };
    }
    if (state.time < state.autoReverseUntil) {
      input.down = true;
      input.left = true;
      return input;
    }

    var want = Math.atan2(wp.y - p.y, wp.x - p.x);
    if (p.onFoot) {
      var d = angleDiff(p.angle, want);
      // Walk toward the waypoint: use the closest cardinal-ish direction.
      var dx = wp.x - p.x, dy = wp.y - p.y;
      input.up = dy < -8; input.down = dy > 8;
      input.left = dx < -8; input.right = dx > 8;
      input.run = true;
      return input;
    }
    // Driving: steer to the waypoint, and brake hard before sharp turns
    // (turning radius grows with speed; slow turns stay on the road).
    var diff = angleDiff(p.car.angle, want);
    var steer = Math.max(-1, Math.min(1, diff * 2.4));
    input.left = steer < -0.08;
    input.right = steer > 0.08;
    var ad = Math.abs(diff);
    var spd = Math.abs(p.car.speed);
    // Speed cap for the current turn sharpness.
    var cap = ad > 1.0 ? 120 : ad > 0.5 ? 220 : ad > 0.25 ? 320 : 470;
    if (spd > cap) {
      input.up = false; input.down = true;
    } else if (ad > 0.9) {
      input.up = spd < 140;
      if (spd > 160) input.down = true;
    } else {
      input.up = true;
    }
    // Slow for the final approach.
    if (path && path.length === 1 && dTarget < 130 && spd > 130) {
      input.up = false; input.down = true;
    }
    return input;
  }

  // ---- Browser bootstrap ----
  function startBrowser() {
    if (typeof document === 'undefined') return;
    var canvas = document.getElementById('game');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var state = createGame();
    S.Input.attach();
    var last = performance.now();
    var statusEl = document.getElementById('status');
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      var input = S.Input.read();
      if (input.autopilotPressed) {
        state.autopilot = !state.autopilot;
        state.message = state.autopilot ? 'Autopilot ON (P to toggle)' : 'Autopilot OFF';
        state.messageTimer = 2;
      }
      if (state.autopilot) input = autopilotInput(state);
      updateGame(state, input, dt);
      S.Input.clearQueued();
      S.Render.draw(state, ctx, canvas.width, canvas.height);
      if (statusEl) {
        statusEl.textContent = 'Missions ' + state.mission.completed.length + '/8  •  $' + state.money +
          '  •  Wanted ' + state.wanted + '★  •  ' + (state.won ? 'KING OF SOLMAR!' : (state.mission.active ? S.Missions.MISSIONS[state.mission.index].title : 'Free roam'));
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  S.Game = {
    createGame: createGame,
    updateGame: updateGame,
    autopilotInput: autopilotInput,
    zeroInput: zeroInput,
    startBrowser: startBrowser
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startBrowser);
    } else {
      startBrowser();
    }
  }
})();
