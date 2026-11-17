// Entities: the player, traffic cars, pedestrians and police.
// All updates take the shared game state S so the rules stay in one place.
import { WORLD, ROAD_CENTERS, CAR_COLORS, PED_COLORS, MAX_WANTED, nearestRoadCenter } from './config.js';
import { collideCircle, hitsBuilding, nearestRoadPoint } from './city.js';

let nextCarId = 1000;

export function makeCar(x, y, angle, kind, color, driver) {
  const specs = {
    sedan: { len: 46, wid: 22, max: 340, accel: 260 },
    taxi: { len: 46, wid: 22, max: 330, accel: 250 },
    sport: { len: 44, wid: 21, max: 430, accel: 330 },
    truck: { len: 58, wid: 26, max: 270, accel: 190 },
    police: { len: 47, wid: 22, max: 400, accel: 320 },
  };
  const s = specs[kind] || specs.sedan;
  return {
    id: nextCarId++, x, y, angle, speed: 0, kind, color,
    len: s.len, wid: s.wid, maxSpeed: s.max, accel: s.accel,
    hp: kind === 'police' ? 60 : 100, driver, parked: false,
    ai: null, dead: false, flash: 0, brakeLight: false,
  };
}

export function spawnTrafficCar(S, rng, anywhere) {
  const horizontal = rng.chance(0.5);
  const road = rng.pick(ROAD_CENTERS.slice(1, -1));
  const lane = rng.pick([-1, 1]) * 22;
  const along = anywhere ? rng.range(100, WORLD - 100) : rng.pick([80, WORLD - 80]);
  const dir = rng.pick([-1, 1]);
  const car = makeCar(
    horizontal ? along : road + lane,
    horizontal ? road + lane : along,
    horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    rng.pick(['sedan', 'sedan', 'taxi', 'sport', 'truck']),
    rng.pick(CAR_COLORS), 'traffic',
  );
  car.speed = Math.max(110, Math.min(170, rng.gauss(140, 16)));
  car.ai = { axis: horizontal ? 'h' : 'v', dir, lane, road, turnCd: rng.range(1, 4) };
  return car;
}

export function spawnPed(S, rng) {
  const horizontal = rng.chance(0.5);
  const road = rng.pick(ROAD_CENTERS.slice(1, -1));
  const side = rng.pick([-1, 1]) * 68;
  const along = rng.range(100, WORLD - 100);
  return {
    x: horizontal ? along : road + side,
    y: horizontal ? road + side : along,
    angle: rng.range(0, Math.PI * 2),
    speed: Math.max(26, Math.min(48, rng.gauss(37, 6))),
    state: 'walk', color: rng.pick(PED_COLORS),
    tx: null, ty: null, fleeT: 0, downT: 0, stepT: 0,
  };
}

export function spawnPoliceCar(S, rng) {
  // Appear on a road at the world edge nearest the player, then hunt.
  const p = S.player;
  const edge = rng.pick(['n', 's', 'e', 'w']);
  let x, y;
  if (edge === 'n') { x = p.x + rng.range(-500, 500); y = 60; }
  if (edge === 's') { x = p.x + rng.range(-500, 500); y = WORLD - 60; }
  if (edge === 'w') { x = 60; y = p.y + rng.range(-500, 500); }
  if (edge === 'e') { x = WORLD - 60; y = p.y + rng.range(-500, 500); }
  x = Math.max(60, Math.min(WORLD - 60, x));
  y = Math.max(60, Math.min(WORLD - 60, y));
  const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), 'police', '#2a2f38', 'police');
  car.speed = 200;
  car.ai = { axis: 'h', dir: 1, lane: 0, road: 0, turnCd: 0 };
  return { car, bustT: 0 };
}

// --- traffic AI: follow roads, turn at intersections, queue behind cars ---
export function updateTrafficCar(S, car, dt) {
  const ai = car.ai;
  if (!ai) return;
  ai.turnCd -= dt;
  const speed = car.speed;
  const nx = car.x + Math.cos(car.angle) * speed * dt;
  const ny = car.y + Math.sin(car.angle) * speed * dt;
  // Slow down for the car ahead on the same lane.
  let ahead = null;
  for (const o of S.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const lateral = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < 95 && lateral < 26) { ahead = o; break; }
  }
  const target = ahead ? 0 : 150;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
  car.speed = Math.max(0, car.speed);
  const pos = collideCircle(S.city, nx, ny, 16);
  // If blocked by a building, turn around.
  if ((pos.x !== nx || pos.y !== ny) && ai.turnCd <= 0) {
    car.angle += Math.PI;
    ai.dir *= -1;
    ai.turnCd = 2;
  }
  car.x = pos.x; car.y = pos.y;
  // Intersection: maybe turn onto the crossing road.
  const cx = Math.abs(car.x - nearestRoadCenter(car.x)) < 26;
  const cy = Math.abs(car.y - nearestRoadCenter(car.y)) < 26;
  if (cx && cy && ai.turnCd <= 0 && S.rng.chance(0.02)) {
    const horiz = ai.axis === 'h';
    ai.axis = horiz ? 'v' : 'h';
    ai.dir = S.rng.pick([-1, 1]);
    const lane = S.rng.pick([-1, 1]) * 22;
    ai.lane = lane;
    if (ai.axis === 'h') { car.angle = ai.dir > 0 ? 0 : Math.PI; car.y = nearestRoadCenter(car.y) + lane; }
    else { car.angle = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2; car.x = nearestRoadCenter(car.x) + lane; }
    ai.turnCd = 3;
  }
  // Wrap around the world edge.
  if (car.x < -60) car.x = WORLD + 50;
  if (car.x > WORLD + 60) car.x = -50;
  if (car.y < -60) car.y = WORLD + 50;
  if (car.y > WORLD + 60) car.y = -50;
}

// --- pedestrian AI: stroll the sidewalks, flee from danger ---
export function updatePed(S, ped, dt) {
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) { ped.state = 'flee'; ped.fleeT = 2.5; }
    return;
  }
  if (ped.fleeT > 0) {
    ped.fleeT -= dt;
    const p = S.player;
    const px = ped.x, py = ped.y;
    const dx = px - p.x, dy = py - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 130;
    const pos = collideCircle(S.city, px + (dx / d) * sp * dt, py + (dy / d) * sp * dt, 10);
    ped.x = pos.x; ped.y = pos.y;
    ped.angle = Math.atan2(dy, dx);
    if (ped.fleeT <= 0) ped.state = 'walk';
    return;
  }
  if (ped.tx === null || Math.hypot(ped.tx - ped.x, ped.ty - ped.y) < 24) {
    // Pick a new stroll target on a nearby sidewalk.
    const rp = nearestRoadPoint(ped.x, ped.y);
    const along = S.rng.range(-300, 300);
    const side = S.rng.pick([-1, 1]) * 68;
    if (Math.abs(rp.x - ped.x) < Math.abs(rp.y - ped.y)) {
      ped.tx = rp.x + side; ped.ty = ped.y + along;
    } else {
      ped.tx = ped.x + along; ped.ty = rp.y + side;
    }
  }
  const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy) || 1;
  const pos = collideCircle(S.city, ped.x + (dx / d) * ped.speed * dt, ped.y + (dy / d) * ped.speed * dt, 10);
  ped.x = pos.x; ped.y = pos.y;
  ped.angle = Math.atan2(dy, dx);
}

// --- police AI: hunt the player, ram, and try to bust them on foot ---
export function updatePolice(S, unit, dt) {
  const car = unit.car;
  const p = S.player;
  const dx = p.x - car.x, dy = p.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let da = wantAngle - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, da));
  const targetSpeed = dist > 320 ? car.maxSpeed : Math.min(car.maxSpeed, 240 + dist * 0.4);
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.6);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const pos = collideCircle(S.city, nx, ny, 16);
  car.x = pos.x; car.y = pos.y;
  car.flash = (car.flash + dt) % 0.9;
  // Ram damage + bust timer when touching the player.
  const touch = dist < 52;
  if (touch) {
    if (p.inCar) {
      if (S.crashCd <= 0) {
        p.inCar.hp -= 9;
        S.audio.crash();
        S.addParticles(car.x, car.y, 10, '#ffb03d');
        S.crashCd = 0.6;
        if (p.inCar.hp <= 0) S.carWrecked(p.inCar);
      }
    } else {
      unit.bustT += dt;
      if (unit.bustT > 1.4) S.bustPlayer();
    }
  } else {
    unit.bustT = Math.max(0, unit.bustT - dt * 2);
  }
  // Police cars avoid piling onto each other.
  for (const o of S.cars) {
    if (o === car || o.driver !== 'police' || o.dead) continue;
    const ox = car.x - o.x, oy = car.y - o.y;
    const od = Math.hypot(ox, oy);
    if (od > 0.01 && od < 60) {
      car.x += (ox / od) * (60 - od) * 0.5;
      car.y += (oy / od) * (60 - od) * 0.5;
    }
  }
}

// Player driving physics: arcade accel / steer / brake with building collision.
export function updatePlayerCar(S, car, input, dt) {
  const ax = input.axis();
  const throttle = ax.y < 0 ? 1 : 0; // W / Up = accelerate
  const braking = ax.y > 0;
  const steer = ax.x;
  if (throttle) car.speed += car.accel * dt;
  else car.speed -= (car.speed > 0 ? 90 : -60) * dt * 0.4;
  if (braking) car.speed -= (car.speed > 0 ? 420 : 120) * dt;
  car.speed = Math.max(-120, Math.min(car.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 8) {
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * 2.1 * dt * dir * Math.min(1, Math.abs(car.speed) / 120);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = car.speed;
  const pos = collideCircle(S.city, nx, ny, 16);
  // Only a real impact slows the car down. collideCircle also clamps the
  // car to the world edge (WORLD - r = 3584 on the edge roads), and that
  // sub-pixel nudge used to trigger the slowdown EVERY step — a car
  // driving along an edge road could never get past ~5 px/s.
  const disp = Math.hypot(pos.x - nx, pos.y - ny);
  if (disp > 0.5) {
    if (Math.abs(before) > 140 && S.crashCd <= 0) {
      S.audio.crash();
      S.addParticles(car.x, car.y, 8, '#cfd6dd');
      S.crashCd = 0.5;
      car.hp -= 4;
      if (car.hp <= 0) S.carWrecked(car);
    }
    car.speed *= 0.45;
  }
  car.x = pos.x; car.y = pos.y;
  car.brakeLight = braking;
  S.player.x = car.x; S.player.y = car.y;
  S.player.angle = car.angle;
}

// Player on foot: WASD + sprint, building collision.
export function updatePlayerFoot(S, input, dt) {
  const p = S.player;
  const ax = input.axis();
  const len = Math.hypot(ax.x, ax.y) || 1;
  const sprint = input.down('ShiftLeft', 'ShiftRight');
  const sp = (sprint ? 300 : 195) * (ax.x || ax.y ? 1 : 0);
  const nx = p.x + (ax.x / len) * sp * dt;
  const ny = p.y + (ax.y / len) * sp * dt;
  const pos = collideCircle(S.city, nx, ny, 12);
  const moved = Math.hypot(pos.x - p.x, pos.y - p.y);
  if (moved > 0.5) {
    p.angle = Math.atan2(pos.y - p.y, pos.x - p.x);
    p.stepT -= dt;
    if (p.stepT <= 0) { S.audio.step(); p.stepT = 0.34; }
  }
  p.x = pos.x; p.y = pos.y;
}
