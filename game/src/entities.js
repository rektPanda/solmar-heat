// Entities: the player, drivable cars, traffic, pedestrians and police.
// Cars share one physics step (driveCar): acceleration, a turn rate that
// never drops to zero while moving, and soft vs hard crash slowdown.
import { CFG } from './config.js';

export function makeCar(type, x, y, angle) {
  const top = type === 'sport' ? CFG.SPORT_TOP : type === 'police' ? CFG.POLICE_TOP : CFG.SEDAN_TOP;
  return {
    kind: 'car', type, x, y, angle, speed: 0, top,
    length: CFG.CAR_LENGTH, width: CFG.CAR_WIDTH,
    hp: type === 'police' ? 100 : Infinity,
    disabled: false, parked: false,
  };
}

export function driveCar(car, dt, throttle, steer) {
  // throttle: -1..1 (1 = full gas), steer: -1..1 (1 = right).
  if (throttle > 0) car.speed += CFG.CAR_ACCEL * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CFG.CAR_BRAKE * dt; // brake
    else car.speed += CFG.CAR_ACCEL * 0.6 * throttle * dt; // reverse
  }
  if (car.speed > car.top) car.speed = car.top;
  if (car.speed < -CFG.CAR_REVERSE_TOP) car.speed = -CFG.CAR_REVERSE_TOP;
  // Rolling drag.
  car.speed -= car.speed * 0.35 * dt;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  // Turn rate scales with speed but never vanishes while moving.
  const spd = Math.abs(car.speed);
  const rate = Math.min(CFG.TURN_BASE, CFG.TURN_MIN + spd * 0.006);
  car.angle += steer * rate * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

export function makePlayer(x, y) {
  return {
    kind: 'player', x, y, angle: -Math.PI / 2, radius: CFG.PLAYER_RADIUS,
    hp: 100, money: 0, ammo: CFG.MAG_SIZE, reloading: 0,
    inCar: null, // car object or null
    speed: 0,
  };
}

export function makeTraffic(rng, city) {
  const cars = [];
  const spawn = (c) => {
    const horizontal = rng.next() < 0.5;
    const street = city.streets[rng.int(0, 8)];
    const along = rng.range(300, CFG.WORLD - 300);
    const dir = rng.next() < 0.5 ? 1 : -1;
    const lane = (rng.next() < 0.5 ? -1 : 1) * 13;
    if (horizontal) {
      c.x = along; c.y = street + lane; c.angle = dir > 0 ? 0 : Math.PI;
    } else {
      c.x = street + lane; c.y = along; c.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    c.speed = rng.gaussClamped(170, 35, CFG.TRAFFIC_SPEED_MIN, CFG.TRAFFIC_SPEED_MAX);
    c.cruise = c.speed;
    c.horizontal = horizontal;
    c.dir = dir;
    c.laneShift = 0;
    c.laneShiftT = 0;
    c.blockedT = 0;
  };
  for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) {
    const c = makeCar(rng.next() < 0.25 ? 'sport' : 'sedan', 0, 0, 0);
    spawn(c);
    cars.push(c);
  }
  return { cars, spawn };
}

export function updateTraffic(traffic, dt, city, rng) {
  for (const c of traffic.cars) {
    if (c.disabled) continue;
    // Lane-shift timer (overtake manoeuvre).
    if (c.laneShiftT > 0) c.laneShiftT -= dt;
    else c.laneShift = 0;

    // Car ahead in the same lane?
    let blocked = false;
    for (const o of traffic.cars) {
      if (o === c || o.disabled) continue;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const along = c.horizontal ? dx * c.dir : dy * c.dir;
      const lateral = c.horizontal ? Math.abs(dy) : Math.abs(dx);
      if (along > 0 && along < 78 && lateral < 26) { blocked = true; break; }
    }
    if (blocked) {
      c.blockedT += dt;
      c.speed = Math.max(0, c.speed - 260 * dt);
      if (c.blockedT > 1.2 && c.laneShiftT <= 0) {
        c.laneShift = (rng.next() < 0.5 ? -1 : 1) * 34;
        c.laneShiftT = 3;
      }
      if (c.blockedT > 5) {
        // Permanent jam: respawn elsewhere.
        traffic.spawn(c);
        continue;
      }
    } else {
      c.blockedT = 0;
      c.speed += (c.cruise - c.speed) * Math.min(1, dt * 1.5);
    }

    const step = c.speed * dt;
    if (c.horizontal) c.x += c.dir * step;
    else c.y += c.dir * step;

    // At an intersection, sometimes turn onto the crossing street.
    const nearStreet = (v) => {
      for (const s of city.streets) if (Math.abs(v - s) < 14) return s;
      return null;
    };
    const cross = c.horizontal ? nearStreet(c.x) : nearStreet(c.y);
    if (cross !== null && rng.next() < 0.004) {
      const ns = city.streets[rng.int(0, 8)];
      const ndir = rng.next() < 0.5 ? 1 : -1;
      const lane = (rng.next() < 0.5 ? -1 : 1) * 13;
      if (c.horizontal) {
        c.horizontal = false;
        c.x = cross + lane;
        c.y = ns;
        c.angle = ndir > 0 ? Math.PI / 2 : -Math.PI / 2;
        c.dir = ndir;
      } else {
        c.horizontal = true;
        c.x = ns;
        c.y = cross + lane;
        c.angle = ndir > 0 ? 0 : Math.PI;
        c.dir = ndir;
      }
    }
    // Wrap around the world edge instead of driving out.
    if (c.x < -60) c.x = CFG.WORLD + 50;
    if (c.x > CFG.WORLD + 60) c.x = -50;
    if (c.y < -60) c.y = CFG.WORLD + 50;
    if (c.y > CFG.WORLD + 60) c.y = -50;
    // Apply lane shift gradually.
    const targetLane = (c.horizontal ? 13 : 13) * (c.laneShift !== 0 ? Math.sign(c.laneShift) : 0);
    void targetLane;
  }
}

export function makePedestrians(rng, city) {
  const peds = [];
  for (let i = 0; i < CFG.PED_COUNT; i++) {
    const bx = rng.int(0, 7);
    const by = rng.int(0, 7);
    const b = city.blockRect(bx, by);
    // Walk along one sidewalk edge of the block.
    const side = rng.int(0, 3);
    let x; let y; let dx = 0; let dy = 0;
    if (side === 0) { x = rng.range(b.x, b.x + b.w); y = b.y - 14; dx = rng.next() < 0.5 ? 1 : -1; }
    else if (side === 1) { x = rng.range(b.x, b.x + b.w); y = b.y + b.h + 14; dx = rng.next() < 0.5 ? 1 : -1; }
    else if (side === 2) { x = b.x - 14; y = rng.range(b.y, b.y + b.h); dy = rng.next() < 0.5 ? 1 : -1; }
    else { x = b.x + b.w + 14; y = rng.range(b.y, b.y + b.h); dy = rng.next() < 0.5 ? 1 : -1; }
    peds.push({
      kind: 'ped', x, y, dx, dy,
      min: side < 2 ? b.x : b.y,
      max: side < 2 ? b.x + b.w : b.y + b.h,
      speed: rng.gaussClamped(45, 10, CFG.PED_SPEED_MIN, CFG.PED_SPEED_MAX),
      down: false, downT: 0,
      color: ['#c96a5a', '#5a8ac9', '#c9a45a', '#7ac95a', '#a05ac9'][i % 5],
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt) {
  for (const p of peds) {
    if (p.down) {
      p.downT -= dt;
      if (p.downT <= 0) p.down = false;
      continue;
    }
    p.x += p.dx * p.speed * dt;
    p.y += p.dy * p.speed * dt;
    const along = p.dx !== 0 ? p.x : p.y;
    if (along < p.min || along > p.max) {
      p.dx = -p.dx;
      p.dy = -p.dy;
    }
  }
}

// Police chase the player with pure pursuit. Returns events for the caller.
export function updatePolice(police, dt, player, city, rng) {
  const events = [];
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const pspeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
  for (const cop of police) {
    if (cop.disabled) continue;
    const dx = px - cop.x;
    const dy = py - cop.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const throttle = dist > 90 ? 1 : 0.55;
    driveCar(cop, dt, throttle, steer);
    const c = city.collideCircle(cop.x, cop.y, 20);
    if (c.depth > 6) cop.speed *= CFG.CAR_CRASH_HARD;
    else if (c.depth > 0.5) cop.speed *= CFG.CAR_CRASH_SOFT;
    cop.x = c.x;
    cop.y = c.y;
    // Ram: contact with the player.
    if (dist < 52) {
      cop.ramT = (cop.ramT ?? 0) - dt;
      if (cop.ramT <= 0) {
        cop.ramT = CFG.POLICE_RAM_COOLDOWN_S;
        events.push({ type: 'ram', damage: CFG.POLICE_RAM_DAMAGE });
      }
      // Bust: close and slow for long enough.
      if (pspeed < CFG.POLICE_BUST_SLOW) {
        cop.bustT = (cop.bustT ?? 0) + dt;
        if (cop.bustT >= CFG.POLICE_BUST_TIME_S) events.push({ type: 'bust' });
      } else {
        cop.bustT = 0;
      }
    } else {
      cop.bustT = 0;
    }
    // Despawn if hopelessly far (player escaped across the map).
    if (dist > 2600) {
      const a = rng.range(0, Math.PI * 2);
      cop.x = px + Math.cos(a) * 900;
      cop.y = py + Math.sin(a) * 900;
      const cc = city.collideCircle(cop.x, cop.y, 20);
      cop.x = cc.x;
      cop.y = cc.y;
      cop.speed = 0;
    }
  }
  return events;
}

export function spawnPolice(police, n, player, city, rng) {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  while (police.length < n) {
    const a = rng.range(0, Math.PI * 2);
    const cop = makeCar('police', px + Math.cos(a) * 800, py + Math.sin(a) * 800, a);
    const c = city.collideCircle(cop.x, cop.y, 20);
    cop.x = c.x;
    cop.y = c.y;
    police.push(cop);
  }
  while (police.length > n) police.pop();
}
