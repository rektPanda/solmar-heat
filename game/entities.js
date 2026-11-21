// Solmar Heat — entities: player, cars, pedestrians, police, traffic.
// Pure logic, no DOM. All original.
(function () {
  var S = (globalThis.Solmar = globalThis.Solmar || {});
  var C = S.Config;

  var CAR_COLORS = ['#c23b2e', '#2e6bc2', '#e0a32e', '#3aa655', '#7a4a9e', '#c2c2c2', '#222222', '#e06a2e'];
  var CAR_MODELS = ['Sedan', 'Coupe', 'Van', 'Sport', 'Taxi', 'Truck'];

  function makeCar(id, x, y, angle, opts) {
    opts = opts || {};
    return {
      id: id, x: x, y: y, angle: angle || 0, speed: 0,
      color: opts.color || CAR_COLORS[id % CAR_COLORS.length],
      model: opts.model || CAR_MODELS[id % CAR_MODELS.length],
      kind: opts.kind || 'civil', // civil | police | parked | mission
      driver: opts.driver || null, // 'player' | 'ai' | null
      ramCooldown: 0,
      ai: opts.ai || null
    };
  }

  function makePed(x, y) {
    return {
      x: x, y: y,
      angle: Math.random() * Math.PI * 2,
      speed: 40 + Math.random() * 40,
      turnIn: 1 + Math.random() * 3,
      color: ['#d8b25a', '#5a8ad8', '#d85a7a', '#7ad85a'][Math.floor(Math.random() * 4)]
    };
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function nearestCar(cars, x, y, maxD, filter) {
    var best = null, bd = maxD || Infinity;
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (filter && !filter(c)) continue;
      var d = dist(c, { x: x, y: y });
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Car physics: throttle / brake / steer. Returns nothing, mutates car.
  function driveCar(car, input, dt, maxSpeed) {
    var max = maxSpeed || C.CAR_MAX;
    if (input.up) car.speed += C.CAR_ACCEL * dt;
    if (input.down) {
      if (car.speed > 10) car.speed -= C.CAR_BRAKE * dt;
      else car.speed -= C.CAR_ACCEL * 0.6 * dt;
    }
    // Drag + rolling friction.
    car.speed -= car.speed * 0.55 * dt;
    if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;
    car.speed = Math.max(-C.CAR_REVERSE_MAX, Math.min(max, car.speed));
    var steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    var dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * C.CAR_TURN * dt * Math.min(1, Math.abs(car.speed) / 120) * dir;
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx; car.y = ny;
  }

  // Player on foot.
  function walkPlayer(p, input, dt, city) {
    var sp = input.run ? C.PLAYER_RUN : C.PLAYER_WALK;
    var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      var len = Math.sqrt(mx * mx + my * my);
      p.x += (mx / len) * sp * dt;
      p.y += (my / len) * sp * dt;
      p.angle = Math.atan2(my, mx);
      p.moving = true;
    } else {
      p.moving = false;
    }
    S.City.resolveCircle(city, p, C.PLAYER_RADIUS);
  }

  function updatePlayer(state, input, dt) {
    var p = state.player;
    var city = state.city;
    if (p.onFoot) {
      walkPlayer(p, input, dt, city);
      // Pedestrian bump: walking into a ped is a soft push, no wanted.
      for (var i = 0; i < state.peds.length; i++) {
        var pd = state.peds[i];
        var d = dist(p, pd);
        if (d < C.PLAYER_RADIUS + 10 && d > 0.01) {
          var push = (C.PLAYER_RADIUS + 10 - d);
          pd.x += ((pd.x - p.x) / d) * push;
          pd.y += ((pd.y - p.y) / d) * push;
        }
      }
    } else if (p.car) {
      driveCar(p.car, input, dt, C.CAR_MAX);
      // Slide along walls instead of getting wedged: push out, keep momentum.
      if (S.City.circleHits(city, p.car.x, p.car.y, C.CAR_RADIUS)) {
        S.City.resolveCircle(city, p.car, C.CAR_RADIUS);
        p.car.speed *= 0.55;
      }
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
      p.speed = p.car.speed;
      // Running over a pedestrian while driving raises wanted (once per ped).
      for (var j = 0; j < state.peds.length; j++) {
        var pd2 = state.peds[j];
        if (!pd2.down && dist(p, pd2) < C.CAR_RADIUS + 8 && Math.abs(p.speed) > 60) {
          pd2.down = true;
          pd2.downTimer = 6;
          state.wanted = Math.min(C.WANTED_MAX, state.wanted + 1);
          state.wantedTimer = 0;
          state.message = 'You ran over a pedestrian! Wanted +1';
          state.messageTimer = 2.5;
        }
      }
    }
    // Action (edge triggered by caller via input.actionPressed).
    if (input.actionPressed) {
      if (p.onFoot) {
        var car = nearestCar(state.cars, p.x, p.y, 60, function (c) {
          return c.kind !== 'police' && !c.driver;
        });
        if (car) {
          p.onFoot = false; p.car = car; car.driver = 'player';
          if (car.kind === 'mission') {
            state.wanted = Math.min(C.WANTED_MAX, state.wanted + 1);
            state.wantedTimer = 0;
            state.message = 'You stole the sports car! Wanted +1';
            state.messageTimer = 2.5;
          }
        }
      } else if (p.car) {
        var c2 = p.car;
        c2.driver = null; c2.speed = 0;
        p.onFoot = true; p.car = null;
        p.x = c2.x + Math.cos(c2.angle + Math.PI / 2) * 34;
        p.y = c2.y + Math.sin(c2.angle + Math.PI / 2) * 34;
        S.City.resolveCircle(city, p, C.PLAYER_RADIUS);
      }
    }
  }

  // Ambient traffic: drive along roads, turn at intersections, wrap around.
  function updateTraffic(state, dt) {
    var city = state.city;
    for (var i = 0; i < state.cars.length; i++) {
      var c = state.cars[i];
      if (c.kind !== 'civil' || c.driver) continue;
      if (!c.ai) {
        c.ai = { axis: Math.random() < 0.5 ? 'x' : 'y', dir: Math.random() < 0.5 ? 1 : -1, speed: 120 + Math.random() * 90 };
      }
      var sp = c.ai.speed;
      if (c.ai.axis === 'x') c.x += c.ai.dir * sp * dt;
      else c.y += c.ai.dir * sp * dt;
      c.angle = c.ai.axis === 'x' ? (c.ai.dir > 0 ? 0 : Math.PI) : (c.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      // Wrap at world edge; random turn at intersections.
      if (c.x < C.SEA_W + 30 || c.x > C.WORLD_W - 30 || c.y < 30 || c.y > C.WORLD_H - 30) {
        var rp = S.City.nearestRoadPoint(C.WORLD_W / 2, C.WORLD_H / 2);
        c.x = rp.x; c.y = rp.y;
      }
      if (Math.random() < dt * 0.12) {
        c.ai.axis = c.ai.axis === 'x' ? 'y' : 'x';
        c.ai.dir = Math.random() < 0.5 ? 1 : -1;
      }
      S.City.resolveCircle(city, c, C.CAR_RADIUS);
    }
    for (var j = 0; j < state.peds.length; j++) {
      var pd = state.peds[j];
      if (pd.down) {
        pd.downTimer -= dt;
        if (pd.downTimer <= 0) { pd.down = false; }
        continue;
      }
      pd.turnIn -= dt;
      if (pd.turnIn <= 0) {
        pd.angle += (Math.random() - 0.5) * 2.2;
        pd.turnIn = 1 + Math.random() * 3;
      }
      var npx = pd.x + Math.cos(pd.angle) * pd.speed * dt;
      var npy = pd.y + Math.sin(pd.angle) * pd.speed * dt;
      // Pedestrians stay on sidewalks (off the roads) so cars don't hit them.
      if (!S.City.isOnRoad(npx, npy)) { pd.x = npx; pd.y = npy; }
      else { pd.angle += Math.PI / 2; }
      if (S.City.circleHits(city, pd.x, pd.y, 8)) {
        pd.angle += Math.PI;
        pd.x += Math.cos(pd.angle) * 20;
        pd.y += Math.sin(pd.angle) * 20;
      }
      S.City.resolveCircle(city, pd, 8);
    }
  }

  function policeTargetCount(wanted) {
    return [0, 1, 2, 3, 4, 6][Math.max(0, Math.min(C.WANTED_MAX, wanted))];
  }

  function spawnPolice(state) {
    var want = policeTargetCount(state.wanted);
    var have = 0;
    for (var i = 0; i < state.cars.length; i++) if (state.cars[i].kind === 'police') have++;
    var p = state.player;
    while (have < want) {
      // Spawn on a road 500-800px away from the player.
      var a = Math.random() * Math.PI * 2;
      var d = 550 + Math.random() * 250;
      var x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      var rp = S.City.nearestRoadPoint(x, y);
      var car = makeCar(1000 + have, rp.x, rp.y, 0, { kind: 'police', color: '#1c1c22' });
      state.cars.push(car);
      have++;
    }
    // Remove excess police when wanted drops.
    if (have > want) {
      var removed = 0;
      for (var j = state.cars.length - 1; j >= 0 && removed < have - want; j--) {
        if (state.cars[j].kind === 'police') { state.cars.splice(j, 1); removed++; }
      }
    }
  }

  function updatePolice(state, dt) {
    spawnPolice(state);
    var p = state.player;
    var near = false;
    for (var i = 0; i < state.cars.length; i++) {
      var c = state.cars[i];
      if (c.kind !== 'police') continue;
      var d = dist(c, p);
      if (d < 520) near = true;
      c.ramCooldown -= dt;
      if (state.wanted <= 0) continue;
      // Chase: steer toward the player, cap speed below the player's top speed.
      var want = Math.atan2(p.y - c.y, p.x - c.x);
      var diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var steer = Math.max(-1, Math.min(1, diff * 2.2));
      var input = { up: true, down: false, left: steer < -0.08, right: steer > 0.08 };
      driveCar(c, input, dt, C.POLICE_MAX);
      if (S.City.circleHits(state.city, c.x, c.y, C.CAR_RADIUS)) {
        S.City.resolveCircle(state.city, c, C.CAR_RADIUS);
        c.speed *= 0.5;
      }
      // Ram.
      if (d < C.CAR_RADIUS + 22 && c.ramCooldown <= 0) {
        c.ramCooldown = C.RAM_COOLDOWN;
        if (p.onFoot) {
          state.bustTimer += 0.6;
          state.health = Math.max(0, state.health - C.RAM_DAMAGE);
        } else {
          state.health = Math.max(0, state.health - C.RAM_DAMAGE);
          if (p.car) p.car.speed *= 0.55;
        }
        state.lastDamage = 0;
        state.message = state.wanted >= 3 ? 'Police are ramming you!' : 'Police on your tail!';
        state.messageTimer = 1.5;
      }
    }
    // Busted: a cop holds you on foot.
    if (p.onFoot && state.wanted > 0) {
      var touching = false;
      for (var k = 0; k < state.cars.length; k++) {
        var c2 = state.cars[k];
        if (c2.kind === 'police' && dist(c2, p) < C.CAR_RADIUS + 20) touching = true;
      }
      if (touching) {
        state.bustTimer += dt;
        if (state.bustTimer >= C.BUST_TIME) {
          state.busted++;
          state.money = Math.max(0, state.money - C.BUST_FINE);
          state.wanted = 0; state.wantedTimer = 0; state.bustTimer = 0;
          state.health = C.PLAYER_HEALTH;
          state.message = 'BUSTED! You paid a $' + C.BUST_FINE + ' fine. Mission failed.';
          state.messageTimer = 4;
          respawnAt(state, 'safehouse');
          failMission(state);
        }
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
      }
    }
    // Wanted decay when no cop is near.
    if (state.wanted > 0) {
      if (near) state.wantedTimer = 0;
      else {
        state.wantedTimer += dt;
        if (state.wantedTimer >= C.WANTED_DECAY_AFTER + C.WANTED_DECAY_EVERY) {
          state.wanted = Math.max(0, state.wanted - 1);
          state.wantedTimer = C.WANTED_DECAY_AFTER;
        }
      }
    }
  }

  function respawnAt(state, landmark) {
    var lm = state.city.landmarks[landmark] || state.city.landmarks.safehouse;
    var p = state.player;
    if (p.car) { p.car.driver = null; p.car.speed = 0; p.car = null; }
    p.onFoot = true;
    p.x = lm.x; p.y = lm.y; p.angle = 0; p.speed = 0;
  }

  function failMission(state) {
    if (state.mission.active) {
      state.mission.active = false;
      state.mission.step = 0;
      state.mission.waitTimer = 0;
    }
  }

  function checkWasted(state) {
    if (state.health <= 0) {
      state.wasted++;
      state.money = Math.max(0, state.money - C.WASTED_FINE);
      state.health = C.PLAYER_HEALTH;
      state.wanted = 0; state.wantedTimer = 0;
      state.message = 'WASTED! You woke up at the hospital, $' + C.WASTED_FINE + ' lighter. Mission failed.';
      state.messageTimer = 4;
      respawnAt(state, 'hospital');
      failMission(state);
    }
  }

  S.Entities = {
    makeCar: makeCar,
    makePed: makePed,
    dist: dist,
    nearestCar: nearestCar,
    driveCar: driveCar,
    updatePlayer: updatePlayer,
    updateTraffic: updateTraffic,
    updatePolice: updatePolice,
    policeTargetCount: policeTargetCount,
    respawnAt: respawnAt,
    failMission: failMission,
    checkWasted: checkWasted,
    CAR_COLORS: CAR_COLORS,
    CAR_MODELS: CAR_MODELS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
