// Screenshot staging (?shot=) and the headless autopilot (?auto=1).
// Shots put the world in a fixed, readable state; the autopilot plays the
// game for real so a headless run can prove the missions are completable.
import { WORLD, VIEW_W, VIEW_H, LANDMARKS, blockCenter, nearestRoadCenter } from './config.js';
import { makeCar, spawnTrafficCar, spawnPoliceCar } from './entities.js';
import { interactableAt } from './missions.js';

function lm(name) {
  const d = LANDMARKS[name];
  return blockCenter(d.bx, d.by);
}

function placeTraffic(S, spots) {
  S.cars = S.cars.filter((c) => c.driver === 'player' || c.driver === 'police');
  for (const s of spots) {
    const car = makeCar(s.x, s.y, s.angle, s.kind || 'sedan', s.color || '#d94f3d', 'traffic');
    car.speed = s.speed ?? 140;
    car.ai = { axis: s.axis || 'h', dir: s.dir || 1, lane: s.lane ?? 22, road: 0, turnCd: 5 };
    S.cars.push(car);
  }
}

export function setupShot(S, name) {
  const p = S.player;
  S.dialogue = null;
  S.toasts = [];
  S.particles = [];
  if (name === 'start') {
    S.mode = 'menu';
    S.cam.x = 1800; S.cam.y = 1800;
    return;
  }
  S.mode = 'playing';
  if (name === 'drive') {
    const car = makeCar(1350, 1350, 0, 'sport', '#d94f3d', 'player');
    car.speed = 210;
    S.cars = [car];
    p.inCar = car; p.x = car.x; p.y = car.y; p.angle = 0;
    p.hp = 100; p.money = 320; p.ammo = 12;
    placeTraffic(S, [
      { x: 900, y: 1350, angle: 0, kind: 'taxi', color: '#e8c33d', speed: 150, lane: -22 },
      { x: 1800, y: 1350, angle: 0, kind: 'sedan', color: '#3d7ad9', speed: 130, lane: 22 },
      { x: 2250, y: 1350, angle: Math.PI, kind: 'truck', color: '#7ac74f', speed: 120, lane: -22 },
      { x: 1350, y: 900, angle: Math.PI / 2, kind: 'sedan', color: '#e8e8e8', speed: 140, axis: 'v', lane: 22 },
      { x: 1350, y: 1800, angle: -Math.PI / 2, kind: 'sport', color: '#8a5fd0', speed: 150, axis: 'v', lane: -22 },
      { x: 2700, y: 1350, angle: 0, kind: 'sedan', color: '#e07a2e', speed: 145, lane: 22 },
    ]);
    const g = lm('garage');
    S.marker = { x: g.x, y: g.y, label: "Dante's Garage" };
    S.objective = "Drive to Dante's Garage";
    S.mission = { idx: 0, step: 1, pkg: false };
    S.wanted = 0;
  } else if (name === 'chase') {
    const car = makeCar(1800, 2250, -Math.PI / 2, 'sport', '#d94f3d', 'player');
    car.speed = 320;
    S.cars = [car];
    p.inCar = car; p.x = car.x; p.y = car.y; p.angle = -Math.PI / 2;
    p.hp = 82; p.money = 470; p.ammo = 9;
    S.wanted = 3;
    S.objective = 'Lose the cops — get your wanted level to 0';
    S.mission = { idx: 2, step: 0, pkg: false };
    for (let i = 0; i < 3; i++) {
      const unit = spawnPoliceCar(S, S.rng);
      unit.car.x = 1800 + (i - 1) * 70;
      unit.car.y = 2250 + 190 + i * 55;
      unit.car.angle = -Math.PI / 2;
      unit.car.speed = 300;
      S.police.push(unit);
      S.cars.push(unit.car);
    }
    placeTraffic(S, [
      { x: 1350, y: 1800, angle: 0, kind: 'sedan', color: '#3d7ad9', speed: 140, lane: 22 },
      { x: 2250, y: 1800, angle: Math.PI, kind: 'taxi', color: '#e8c33d', speed: 130, lane: -22 },
    ]);
  } else if (name === 'bank') {
    const b = lm('bank');
    S.cars = [];
    p.inCar = null; p.x = b.x - 40; p.y = b.y + 60; p.angle = -Math.PI / 2;
    p.hp = 100; p.money = 620; p.ammo = 12;
    S.wanted = 3;
    // The cash sits 100 px south of the bank building (missions.js): point
    // the marker at the cash itself, not at the unreachable building centre.
    S.marker = { x: b.x, y: b.y + 100, label: 'Cash' };
    S.objective = 'Walk in and grab the cash (press E)';
    S.mission = { idx: 3, step: 1, pkg: false };
    for (let i = 0; i < 2; i++) {
      const unit = spawnPoliceCar(S, S.rng);
      unit.car.x = 2250 + i * 90;
      unit.car.y = 1350 + 320;
      unit.car.angle = Math.PI;
      unit.car.speed = 260;
      S.police.push(unit);
      S.cars.push(unit.car);
    }
    placeTraffic(S, [
      { x: 1800, y: 1350, angle: 0, kind: 'sedan', color: '#e8e8e8', speed: 130, lane: 22 },
    ]);
  }
  S.cam.x = p.x; S.cam.y = p.y;
}

// --- autopilot: plays the game through the same input the player uses ---
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createAutoInput(S) {
  let pressE = false;
  let pressEnter = false;
  let dialogT = 0;
  let respawnT = 0;
  let waypoints = [];
  let wpGoal = '';
  let stuckT = 0, lastX = 0, lastY = 0, checkT = 0;
  let recoverT = 0, recoverDir = 1, sideT = 0, sideDir = 1;
  let reversingNow = false; // set while the car is doing a reverse U-turn
  let ax = { x: 0, y: 0 };

  // Drive steps need a car; on foot the autopilot must steal one first
  // (also after a bust/wreck respawn).
  function needsCar() {
    const p = S.player, m = S.mission;
    if (!m || p.inCar) return false;
    if (m.idx === 0) return true;
    if (m.idx === 1) return m.step === 0 || m.step === 2;
    if (m.idx === 2) return true;
    if (m.idx === 3) return m.step === 0 || m.step === 2;
    return false;
  }

  function planWaypoints(goal) {
    const p = S.player;
    const key = goal.x + ',' + goal.y + ':' + goal.kind;
    if (key === wpGoal && waypoints.length) return;
    wpGoal = key;
    waypoints = [];
    // Stay on the road network: route along roads only, never diagonally
    // through a block (a diagonal leg wedges the car on building corners).
    const rx = nearestRoadCenter(p.x), ry = nearestRoadCenter(p.y);
    const onVertical = Math.abs(p.x - rx) < Math.abs(p.y - ry);
    const r = onVertical ? { x: rx, y: p.y } : { x: p.x, y: ry };
    waypoints.push(r);
    const cx = nearestRoadCenter(goal.x);
    // Landmark targets sit inside a block: run the road leg to the road
    // bordering the block to the south, then drive straight in — the flat
    // south face of the landmark building stops the car inside the radius.
    const isLandmark = goal.kind === 'marker' || goal.kind === 'interact';
    const targetY = isLandmark
      ? Math.min((Math.floor((goal.y - 45) / 450) + 1) * 450, WORLD)
      : nearestRoadCenter(goal.y);
    if (onVertical) {
      if (Math.abs(r.y - targetY) > 40) waypoints.push({ x: r.x, y: targetY });
    } else {
      if (Math.abs(r.x - cx) > 40) waypoints.push({ x: cx, y: r.y });
      if (Math.abs(r.y - targetY) > 40) waypoints.push({ x: cx, y: targetY });
    }
    if (isLandmark) {
      const curX = onVertical ? r.x : cx;
      if (Math.abs(goal.x - curX) > 40) waypoints.push({ x: goal.x, y: targetY });
    }
    waypoints.push({ x: goal.x, y: goal.y });
  }

  function currentGoal() {
    const p = S.player;
    if (S.dialogue && S.dialogue.idx < S.dialogue.lines.length) return { kind: 'dialog' };
    const it = interactableAt(S);
    if (it) return { kind: 'interact', x: it.x, y: it.y };
    if (needsCar()) {
      // Nearest PARKED car first (it waits), else the nearest moving one.
      let best = null, bd = 1e9;
      for (const c of S.cars) {
        if (c.dead || c.driver !== 'none') continue;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) {
        for (const c of S.cars) {
          if (c.dead || c.driver === 'player' || c.driver === 'police') continue;
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < bd) { bd = d; best = c; }
        }
      }
      if (best) return { kind: 'car', x: best.x, y: best.y, car: best };
    }
    if (S.marker) {
      // A pickup step needs the player on foot: report the marker as an
      // interact goal while driving, so the autopilot gets out of the car
      // when it arrives (interactableAt only fires on foot).
      const pickup = S.mission && ((S.mission.idx === 1 && S.mission.step === 1) || (S.mission.idx === 3 && S.mission.step === 1));
      return { kind: pickup ? 'interact' : 'marker', x: S.marker.x, y: S.marker.y };
    }
    if (S.mission && S.mission.idx === 2) {
      // Flee: aim for a point away from the nearest police car.
      let np = null, nd = 1e9;
      for (const u of S.police) {
        const d = Math.hypot(u.car.x - p.x, u.car.y - p.y);
        if (d < nd) { nd = d; np = u.car; }
      }
      if (np) {
        const dx = p.x - np.x, dy = p.y - np.y;
        const d = Math.hypot(dx, dy) || 1;
        return { kind: 'flee', x: Math.max(100, Math.min(WORLD - 100, p.x + (dx / d) * 700)), y: Math.max(100, Math.min(WORLD - 100, p.y + (dy / d) * 700)) };
      }
      return { kind: 'wait' };
    }
    return { kind: 'wait' };
  }

  return {
    mouse: { x: VIEW_W / 2, y: VIEW_H / 2 - 120, down: false, clicked: false },
    axis() { return ax; },
    down() { return false; },
    pressed(code) {
      if (code === 'KeyE') return pressE;
      if (code === 'Enter') return pressEnter;
      return false;
    },
    endFrame() { pressE = false; pressEnter = false; },
    // Debug handle for the headless playtest.
    debug() {
      const p = S.player;
      return {
        ax, reversingNow, recoverT: +recoverT.toFixed(2), stuckT: +stuckT.toFixed(2),
        carAngle: p.inCar ? +p.inCar.angle.toFixed(2) : null,
        carSpeed: p.inCar ? Math.round(p.inCar.speed) : null,
        waypoints: waypoints.map(w => [Math.round(w.x), Math.round(w.y)]),
      };
    },
    update(dt) {
      const p = S.player;
      dialogT -= dt;
      // Respawn after a bust/wreck so the run continues.
      if (S.mode === 'busted' || S.mode === 'wasted') {
        respawnT -= dt;
        ax = { x: 0, y: 0 };
        if (respawnT <= 0) { pressEnter = true; respawnT = 2; }
        return;
      }
      respawnT = 1.5;
      const goal = currentGoal();
      if (goal.kind === 'dialog') {
        ax = { x: 0, y: 0 };
        if (dialogT <= 0) { pressE = true; dialogT = 1.1; }
        return;
      }
      if (goal.kind === 'wait') { ax = { x: 0, y: 0 }; return; }
      const dx = goal.x - p.x, dy = goal.y - p.y;
      const dist = Math.hypot(dx, dy);
      if ((goal.kind === 'interact' || goal.kind === 'car') && dist < 55) {
        ax = { x: 0, y: 0 };
        pressE = true;
        return;
      }
      // A package/cash pickup needs the player on foot: get out of the car
      // once close, then walk the last metres.
      if (goal.kind === 'interact' && p.inCar && dist < 130) {
        ax = { x: 0, y: 0 };
        pressE = true;
        return;
      }
      // Stuck detection (a slow creeping turn counts as stuck too).
      // A deliberate reverse U-turn moves little — do not fight it, but
      // never let it suppress the check forever: a U-turn that lasts
      // longer than ~3 s is itself stuck.
      checkT += dt;
      if (checkT > 0.6) {
        const moved = Math.hypot(p.x - lastX, p.y - lastY);
        if (moved < 12 && (!reversingNow || stuckT > 2.4) && (goal.kind === 'marker' || goal.kind === 'flee' || goal.kind === 'car' || goal.kind === 'interact')) {
          stuckT += checkT;
          if (stuckT > 1.4) {
            if (p.inCar) { recoverT = 1.2; recoverDir *= -1; }
            else { sideT = 0.6; sideDir *= -1; }
            // Force a fresh route after the recover: the old plan is what
            // drove the car into the wall, and re-following it just
            // re-wedges it in the same place.
            wpGoal = ''; waypoints = [];
            stuckT = 0;
          }
        } else stuckT = 0;
        lastX = p.x; lastY = p.y; checkT = 0;
      }
      if (recoverT > 0) {
        recoverT -= dt;
        // Recover in the opposite direction of the current motion:
        // a car stuck while reversing gets driven forward, and vice versa.
        const rev = p.inCar ? p.inCar.speed < 0 : false;
        ax = p.inCar ? { x: -recoverDir, y: rev ? -1 : 1 } : { x: sideDir, y: 0 };
        return;
      }
      if (sideT > 0) {
        sideT -= dt;
        const ang = Math.atan2(dy, dx) + (Math.PI / 2) * sideDir;
        ax = { x: Math.cos(ang), y: Math.sin(ang) };
        return;
      }
      // On foot and close: walk straight at the goal. The road-based
      // waypoints are for cars — routing a pedestrian south to a road
      // first can send them straight into a building (the docks crates),
      // while the goal is a few steps away in open ground. This runs
      // AFTER the stuck detection above, so a wedged pedestrian still
      // gets a sidestep instead of being stuck forever.
      if (!p.inCar && dist < 250) {
        ax = { x: dx / dist, y: dy / dist };
        return;
      }
      planWaypoints(goal);
      // Arrival radius must exceed the car's minimum turning radius (~57 px:
      // steering scales with speed, so the radius never gets tighter).
      // A smaller radius makes the car orbit the waypoint forever instead
      // of ever reaching it; a much larger one cuts road corners into
      // buildings. 70 px is the working compromise.
      while (waypoints.length > 1 && Math.hypot(waypoints[0].x - p.x, waypoints[0].y - p.y) < 70) waypoints.shift();
      const wp = waypoints[0] || goal;
      const wx = wp.x - p.x, wy = wp.y - p.y;
      if (!p.inCar) {
        const d = Math.hypot(wx, wy) || 1;
        ax = { x: wx / d, y: wy / d };
        reversingNow = false;
      } else {
        const want = Math.atan2(wy, wx);
        const diff = wrapAngle(want - p.angle);
        const fwd = p.inCar.speed; // signed: + forward, − reversing
        if (Math.abs(diff) > 2.2) {
          // True U-turn only: brake while moving forward, else reverse-turn
          // the nose around. Reversing inverts steering, hence the flipped
          // sign. NOTE: use the SIGNED speed — braking a reversing car
          // only accelerates the reverse (caught by the autopilot test).
          // Ordinary 90° turns just steer hard while driving forward:
          // a reverse-turn there stalls the car in a steer/reverse loop.
          ax = fwd > 40 ? { x: 0, y: 1 } : { x: -Math.sign(diff), y: 1 };
          reversingNow = fwd <= 40;
        } else {
          const steer = Math.max(-1, Math.min(1, diff * 2.4));
          let throttle;
          if (dist < 130 && goal.kind === 'marker') throttle = fwd > 60 ? 0.2 : -1;
          // Slow down for a hard turn (tightens the turning radius so the
          // car stops zig-zagging across the road), but only while fast
          // enough to still turn — braking to a standstill would strand it.
          else if (Math.abs(diff) > 0.6 && fwd > 120) throttle = 0.4;
          else throttle = -1;
          // Do not steer while still moving backward: steering is inverted
          // in reverse, so straighten the car out first, then turn.
          ax = fwd < -20 ? { x: 0, y: -1 } : { x: steer, y: throttle };
          reversingNow = false;
        }
      }
    },
  };
}
