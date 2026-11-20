// Solmar Heat — game loop. Wires config/city/entities/missions/render/shots.
// Exposes window.SOLMAR.state() for the test driver (read-only snapshot).
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { buildCity } from './city.js';
import { makeCar, driveCar, makePlayer, makeTraffic, updateTraffic, makePedestrians, updatePedestrians, updatePolice, spawnPolice } from './entities.js';
import { makeMissions, currentMission, objectiveText, startBriefing, advanceDialogue, updateDialogue, setToast, updateToast, checkStep, applyStepEvent, onBusted, missionTarget } from './missions.js';
import { render, MENU_BUTTONS } from './render.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261121', 10);
const shotNum = parseInt(params.get('shot') || '0', 10);
const rng = makeRng(seed);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = makeInput(canvas);
const audio = makeAudio();
const city = buildCity(rng);

let errCount = 0;
window.addEventListener('error', () => { errCount += 1; });
window.addEventListener('unhandledrejection', () => { errCount += 1; });

const G = {
  city, time: 0, mode: 'menu', hasSave: false,
  player: makePlayer(city.landmarks.spawnPoint.x, city.landmarks.spawnPoint.y),
  traffic: makeTraffic(rng, city),
  peds: makePedestrians(rng, city),
  police: [],
  parked: [],
  missions: makeMissions(),
  tracers: [],
  wanted: 0,
  lastCrimeT: -999,
  decayT: 0,
  bustedFlash: 0,
  wastedFlash: 0,
  hornT: 0,
  shootCrimeT: -999,
  hitCrimeT: -999,
  marker: null,
  view: { howto: false },
};

for (const s of city.parkedSpots) {
  const c = makeCar(s.type, s.x, s.y, s.angle);
  c.parked = true;
  G.parked.push(c);
}

function saveGame() {
  try {
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({
      money: G.player.money,
      idx: G.missions.idx,
      step: G.missions.step,
      hasGoods: G.missions.hasGoods,
      done: G.missions.done,
      hp: G.player.hp,
    }));
    G.hasSave = true;
  } catch { /* storage may be unavailable; the game still runs */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    G.player.money = s.money || 0;
    G.player.hp = s.hp || 100;
    G.missions.idx = s.idx || 0;
    G.missions.step = s.step || 0;
    G.missions.hasGoods = !!s.hasGoods;
    G.missions.done = !!s.done;
    return true;
  } catch {
    return false;
  }
}
G.hasSave = (() => { try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch { return false; } })();

function addWanted(n) {
  G.wanted = Math.min(5, G.wanted + n);
  G.lastCrimeT = G.time;
  G.decayT = 0;
}

function respawn(afterBust) {
  const sp = city.landmarks.spawnPoint;
  G.player.x = sp.x;
  G.player.y = sp.y;
  G.player.angle = -Math.PI / 2;
  G.player.inCar = null;
  G.player.speed = 0;
  G.police.length = 0;
  G.wanted = 0;
  G.missions.dialogue = null;
  G.missions.toast = null;
  G.tracers.length = 0;
  onBusted(G.missions);
  if (afterBust) {
    G.player.money = Math.max(0, G.player.money - CFG.BUST_FINE);
    G.bustedFlash = 2.5;
    audio.busted();
    setToast(G.missions, 'BUSTED — goods lost, back to the Safehouse');
  } else {
    G.player.money = Math.max(0, G.player.money - CFG.BUST_FINE);
    G.player.hp = 100;
    G.wastedFlash = 2.5;
    audio.busted();
    setToast(G.missions, 'WASTED — you got taken down');
  }
}

function nearestCar(maxDist) {
  const p = G.player;
  let best = null;
  let bestD = maxDist;
  const consider = (c) => {
    if (c.disabled) return;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = c; }
  };
  for (const c of G.parked) consider(c);
  for (const c of G.traffic.cars) consider(c);
  for (const c of G.police) consider(c);
  return best;
}

function enterCar(car) {
  G.player.inCar = car;
  G.player.x = car.x;
  G.player.y = car.y;
  audio.door();
  if (!car.parked) {
    addWanted(1);
    setToast(G.missions, 'Car stolen! The cops noticed.');
  }
  car.parked = false;
}

function exitCar() {
  const car = G.player.inCar;
  if (!car) return;
  const a = car.angle + Math.PI / 2;
  G.player.x = car.x + Math.cos(a) * 34;
  G.player.y = car.y + Math.sin(a) * 34;
  const c = city.collideCircle(G.player.x, G.player.y, CFG.PLAYER_RADIUS);
  G.player.x = c.x;
  G.player.y = c.y;
  G.player.inCar = null;
  G.player.angle = car.angle;
  audio.door();
}

function fireShot() {
  const p = G.player;
  if (p.ammo <= 0 || p.reloading > 0) return;
  p.ammo -= 1;
  audio.shot();
  const wx = input.mouse.x + (Math.max(640, Math.min(CFG.WORLD - 640, p.x)) - 640);
  const wy = input.mouse.y + (Math.max(360, Math.min(CFG.WORLD - 360, p.y)) - 360);
  const ang = Math.atan2(wy - p.y, wx - p.x) + (rng.next() - 0.5) * CFG.SHOT_SPREAD * 2;
  const ox = p.inCar ? p.inCar.x : p.x;
  const oy = p.inCar ? p.inCar.y : p.y;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let hitD = CFG.SHOT_RANGE;
  let hitKind = null;
  let hitObj = null;
  const test = (x, y, r, kind, obj) => {
    const rx = x - ox;
    const ry = y - oy;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > hitD) return;
    const perp = Math.abs(rx * dy - ry * dx);
    if (perp < r + 6) { hitD = along; hitKind = kind; hitObj = obj; }
  };
  for (const ped of G.peds) if (!ped.down) test(ped.x, ped.y, 9, 'ped', ped);
  for (const cop of G.police) if (!cop.disabled) test(cop.x, cop.y, 24, 'police', cop);
  for (const c of G.traffic.cars) if (!c.disabled) test(c.x, c.y, 24, 'traffic', c);
  G.tracers.push({ x1: ox, y1: oy, x2: ox + dx * hitD, y2: oy + dy * hitD, ttl: 1 });
  if (G.time - G.shootCrimeT > CFG.WANTED_SHOOT_COOLDOWN_S) {
    G.shootCrimeT = G.time;
    addWanted(1);
  }
  if (hitKind === 'ped') {
    const ped = hitObj;
    ped.down = true;
    ped.downT = 8;
    ped.x = Math.max(60, Math.min(CFG.WORLD - 60, ped.x + rng.range(-500, 500)));
    ped.y = Math.max(60, Math.min(CFG.WORLD - 60, ped.y + rng.range(-500, 500)));
    if (G.time - G.hitCrimeT > CFG.WANTED_HIT_COOLDOWN_S) {
      G.hitCrimeT = G.time;
      addWanted(1);
    }
  } else if (hitKind === 'police') {
    const cop = hitObj;
    cop.hp -= CFG.PISTOL_DAMAGE;
    if (cop.hp <= 0) {
      cop.disabled = true;
      G.police = G.police.filter((c) => c !== cop);
      setToast(G.missions, 'Cop car disabled!');
    }
  } else if (hitKind === 'traffic') {
    const c = hitObj;
    c.speed = 0;
    c.cruise = 0;
  }
}

function update(dt) {
  G.time += dt;
  const p = G.player;
  const m = G.missions;

  if (G.bustedFlash > 0) G.bustedFlash = Math.max(0, G.bustedFlash - dt);
  if (G.wastedFlash > 0) G.wastedFlash = Math.max(0, G.wastedFlash - dt);
  if (G.hornT > 0) G.hornT -= dt;
  for (const t of G.tracers) t.ttl -= dt * 3;
  G.tracers = G.tracers.filter((t) => t.ttl > 0);

  updateDialogue(m, dt);
  updateToast(m, dt);

  // Dialogue click (consumes the click; the gun never sees it).
  if (m.dialogue && input.mouse.clicked) {
    advanceDialogue(m);
    input.mouse.clicked = false;
  }

  // --- player movement ---
  if (p.inCar) {
    const car = p.inCar;
    const throttle = (input.isDown('w') || input.isDown('ArrowUp') ? 1 : 0) + (input.isDown('s') || input.isDown('ArrowDown') ? -1 : 0);
    const steer = (input.isDown('d') || input.isDown('ArrowRight') ? 1 : 0) + (input.isDown('a') || input.isDown('ArrowLeft') ? -1 : 0);
    driveCar(car, dt, throttle, steer);
    const c = city.collideCircle(car.x, car.y, 20);
    if (c.depth > 6) car.speed *= CFG.CAR_CRASH_HARD;
    else if (c.depth > 0.5) car.speed *= CFG.CAR_CRASH_SOFT;
    car.x = c.x;
    car.y = c.y;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    // Running over a pedestrian while driving.
    for (const ped of G.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 60) {
        ped.down = true;
        ped.downT = 8;
        car.speed *= 0.85;
        if (G.time - G.hitCrimeT > CFG.WANTED_HIT_COOLDOWN_S) {
          G.hitCrimeT = G.time;
          addWanted(1);
        }
      }
    }
    audio.setEngine(Math.min(1, Math.abs(car.speed) / CFG.SPORT_TOP));
  } else {
    const ax = input.moveAxis();
    const len = Math.hypot(ax.x, ax.y);
    if (len > 0) {
      const nx = ax.x / len;
      const ny = ax.y / len;
      p.angle = Math.atan2(ny, nx);
      const nx2 = p.x + nx * CFG.WALK_SPEED * dt;
      const ny2 = p.y + ny * CFG.WALK_SPEED * dt;
      const c = city.collideCircle(nx2, ny2, CFG.PLAYER_RADIUS);
      p.x = c.x;
      p.y = c.y;
      p.speed = CFG.WALK_SPEED;
    } else {
      p.speed = 0;
    }
    audio.setEngine(0);
  }

  // E: enter / exit car (edge-triggered).
  if (input.isDown('e') && !update._prevE) {
    if (p.inCar) exitCar();
    else {
      const car = nearestCar(62);
      if (car) enterCar(car);
    }
  }
  update._prevE = input.isDown('e');

  // H: horn (0.4 s cooldown).
  if (input.isDown('h') && !update._prevH && G.hornT <= 0 && p.inCar) {
    G.hornT = CFG.HORN_COOLDOWN_S;
    audio.horn();
  }
  update._prevH = input.isDown('h');

  // R: reload (edge-triggered).
  if (input.isDown('r') && !update._prevR && p.ammo < CFG.MAG_SIZE && p.reloading <= 0) {
    p.reloading = CFG.RELOAD_S;
    audio.reload();
  }
  update._prevR = input.isDown('r');
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) { p.reloading = 0; p.ammo = CFG.MAG_SIZE; }
  }

  // Click to shoot (only a fresh click, never one that hit dialogue).
  if (input.mouse.clicked && G.mode === 'play' && !m.dialogue) {
    input.mouse.clicked = false;
    fireShot();
  }

  // --- world ---
  updateTraffic(G.traffic, dt, city, rng);
  updatePedestrians(G.peds, dt);
  // Traffic cars also collide with buildings (cheap: circle at car centre).
  for (const c of G.traffic.cars) {
    if (c.disabled) continue;
    const cc = city.collideCircle(c.x, c.y, 20);
    if (cc.depth > 4) {
      c.x = cc.x;
      c.y = cc.y;
      c.speed *= 0.6;
      c.angle += 0.6;
    }
  }

  // Wanted decay.
  if (G.wanted > 0 && G.time - G.lastCrimeT > CFG.WANTED_DECAY_AFTER_S) {
    G.decayT += dt;
    if (G.decayT >= CFG.WANTED_DECAY_STEP_S) {
      G.decayT = 0;
      G.wanted -= 1;
    }
  }

  // Police.
  const wantCops = G.wanted > 0 ? Math.min(G.wanted, CFG.MAX_POLICE) : 0;
  spawnPolice(G.police, wantCops, p, city, rng);
  const events = updatePolice(G.police, dt, p, city, rng);
  for (const ev of events) {
    if (ev.type === 'ram') {
      p.hp -= ev.damage;
      if (p.hp <= 0) { p.hp = 0; respawn(false); }
    } else if (ev.type === 'bust') {
      respawn(true);
    }
  }
  audio.siren(dt, G.wanted > 0);

  // --- missions ---
  const ev = checkStep(m, p.x, p.y, !!p.inCar, city);
  if (ev) {
    const res = applyStepEvent(m, ev);
    if (ev.type === 'picked') {
      audio.pickup();
      setToast(m, ev.heat ? 'Parcel grabbed — the cops are coming!' : 'Package secured. Deliver it.');
      if (ev.heat) {
        G.wanted = Math.max(G.wanted, 2);
        G.lastCrimeT = G.time;
      }
    } else if (ev.type === 'stolen') {
      setToast(m, 'Car secured — take it to the Garage.');
    } else if (res.finished) {
      audio.cash();
      p.money += res.reward;
      setToast(m, `THE BIG SCORE — $${res.reward}! Story complete. Free roam!`);
      saveGame();
    } else {
      audio.cash();
      p.money += res.reward;
      setToast(m, `Job done — +$${res.reward}. Next: ${res.next}`);
      saveGame();
      startBriefing(m);
    }
  }
  G.marker = missionTarget(m, city);
}

function updateMenu() {
  G.time += 0.016;
  if (G.view.howto) {
    if (input.wasClicked(MENU_BUTTONS.closeHowto.x, MENU_BUTTONS.closeHowto.y, MENU_BUTTONS.closeHowto.w, MENU_BUTTONS.closeHowto.h)) {
      G.view.howto = false;
    }
    input.endFrame();
    return;
  }
  if (input.wasClicked(MENU_BUTTONS.newGame.x, MENU_BUTTONS.newGame.y, MENU_BUTTONS.newGame.w, MENU_BUTTONS.newGame.h)) {
    audio.unlock();
    G.missions = makeMissions();
    G.player = makePlayer(city.landmarks.spawnPoint.x, city.landmarks.spawnPoint.y);
    G.wanted = 0;
    G.police.length = 0;
    G.mode = 'play';
    startBriefing(G.missions);
  } else if (input.wasClicked(MENU_BUTTONS.cont.x, MENU_BUTTONS.cont.y, MENU_BUTTONS.cont.w, MENU_BUTTONS.cont.h)) {
    audio.unlock();
    if (G.hasSave) loadSave();
    else { G.missions = makeMissions(); }
    G.player.x = city.landmarks.spawnPoint.x;
    G.player.y = city.landmarks.spawnPoint.y;
    G.player.inCar = null;
    G.mode = 'play';
    if (!G.missions.dialogue) startBriefing(G.missions);
  } else if (input.wasClicked(MENU_BUTTONS.howto.x, MENU_BUTTONS.howto.y, MENU_BUTTONS.howto.w, MENU_BUTTONS.howto.h)) {
    G.view.howto = true;
  }
  input.endFrame();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode === 'menu') updateMenu();
  else update(dt);
  G.missions.objective = objectiveText(G.missions);
  render(ctx, G, G.view);
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shotNum >= 1 && shotNum <= 4) {
  applyShot(G, shotNum);
} else {
  G.marker = missionTarget(G.missions, city);
}

// Read-only snapshot for the test driver.
window.SOLMAR = {
  version: 'solmar-heat-4',
  errors() { return errCount; },
  menuButtons: MENU_BUTTONS,
  state() {
    const p = G.player;
    const cars = [];
    const add = (c, parked) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < 1200) cars.push({ x: Math.round(c.x), y: Math.round(c.y), type: c.type, parked: !!parked, dist: Math.round(d) });
    };
    for (const c of G.parked) add(c, true);
    for (const c of G.traffic.cars) add(c, false);
    cars.sort((a, b) => a.dist - b.dist);
    const mis = currentMission(G.missions);
    return {
      mode: G.mode,
      time: Math.round(G.time * 10) / 10,
      money: G.player.money,
      hp: Math.round(G.player.hp),
      ammo: G.player.ammo,
      wanted: G.wanted,
      missionIdx: G.missions.done ? 5 : G.missions.idx + 1,
      missionName: mis ? mis.name : 'Free roam',
      step: G.missions.step,
      stepKind: mis ? mis.steps[G.missions.step].kind : null,
      objective: G.missions.objective,
      px: Math.round(p.x),
      py: Math.round(p.y),
      angle: Math.round(p.angle * 100) / 100,
      inCar: !!p.inCar,
      carType: p.inCar ? p.inCar.type : null,
      speed: Math.round(p.inCar ? Math.abs(p.inCar.speed) : p.speed),
      dialogue: !!G.missions.dialogue,
      busted: G.bustedFlash > 0,
      wasted: G.wastedFlash > 0,
      storyComplete: G.missions.done,
      hasGoods: G.missions.hasGoods,
      target: G.marker,
      cars: cars.slice(0, 8),
      policeCount: G.police.length,
      errors: errCount,
    };
  },
};

requestAnimationFrame(frame);
