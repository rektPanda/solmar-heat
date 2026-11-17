// Solmar Heat — game loop, state machine, rules glue.
// Modes: menu → playing → busted / wasted / complete / paused.
import { WORLD, VIEW_W, VIEW_H, ROAD_CENTERS, BUST_FINE, DIALOGUE_AUTO_ADVANCE_S, WANTED_DECAY_AFTER_S, WANTED_DECAY_STEP_S, HORN_COOLDOWN_S } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { makeCar, spawnTrafficCar, spawnPed, spawnPoliceCar, updateTrafficCar, updatePed, updatePolice, updatePlayerCar, updatePlayerFoot } from './entities.js';
import { startMission, updateMission, interactableAt, doInteract, onBusted } from './missions.js';
import { drawWorld, drawHUD, drawMenu, drawOverlay, menuButtons } from './render.js';
import { setupShot, createAutoInput } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const AUTO = params.get('auto') === '1';
const SEED = Number(params.get('seed') || 1);
const SAVE_KEY = 'solmar-heat-save-v1';

const input = createInput(canvas);
const audio = createAudio();

function newGame(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const S = {
    mode: 'menu', time: 0, seed, rng, city,
    cam: { x: 1800, y: 1800 },
    player: { x: 0, y: 0, angle: 0, hp: 100, money: 0, ammo: 12, inCar: null, stepT: 0 },
    cars: [], peds: [], police: [], particles: [], pickups: [], toasts: [],
    wanted: 0, lastCrimeT: -100, decayT: 0, spawnCd: 0, crashCd: 0, shootCd: 0, reloadT: 0, hornCd: 0,
    mission: null, objective: '', marker: null,
    // No briefing until a mission starts: null means "no dialogue box".
    // (A finished briefing clears itself to null instead of lingering at idx == len.)
    dialogue: null,
    stats: { missionsDone: 0, carsStolen: 0, pedsHit: 0, shotsFired: 0, startTime: 0, endTime: 0 },
    hasSave: false, showHow: false, pausedFrom: null,
    audio, input, autopilot: AUTO, auto: null,
    addParticles(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2), sp = rng.range(40, 220);
        S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rng.range(0.3, 0.9), max: 0.9, color, size: rng.range(2, 5) });
      }
    },
    toast(text, secs) { S.toasts.push({ text, t: secs, max: secs }); },
    spawnPolice(n) {
      for (let i = 0; i < n; i++) {
        const unit = spawnPoliceCar(S, rng);
        S.police.push(unit);
        S.cars.push(unit.car);
      }
    },
    addCrime(n) {
      S.wanted = Math.min(5, S.wanted + n);
      S.lastCrimeT = S.time;
      S.decayT = 0;
    },
    carWrecked(car) {
      S.addParticles(car.x, car.y, 26, '#ff7a2e');
      S.addParticles(car.x, car.y, 14, '#3a3f47');
      audio.crash();
      car.dead = true;
      S.cars = S.cars.filter((c) => c !== car);
      S.police = S.police.filter((u) => u.car !== car);
      if (S.player.inCar === car) {
        S.player.inCar = null;
        S.player.hp -= 20;
        S.player.x = car.x + 30; S.player.y = car.y;
        S.toast('YOUR CAR IS WRECKED!', 3);
        if (S.player.hp <= 0) S.wasted();
      }
    },
    bustPlayer() {
      if (S.mode !== 'playing') return;
      S.mode = 'busted';
      audio.busted();
      S.player.money = Math.max(0, S.player.money - BUST_FINE);
      S.wanted = 0;
      S.police = [];
      S.cars = S.cars.filter((c) => c.driver !== 'police');
      // A bust ends the conversation too: the briefing box and toasts from
      // the interrupted job must not survive into the respawn.
      S.dialogue = null;
      S.toasts = [];
      onBusted(S);
      S.saveGame();
    },
    wasted() {
      if (S.mode !== 'playing') return;
      S.mode = 'wasted';
      audio.busted();
      S.player.money = Math.max(0, S.player.money - BUST_FINE);
      S.wanted = 0;
      S.police = [];
      S.cars = S.cars.filter((c) => c.driver !== 'police');
      S.dialogue = null;
      S.toasts = [];
      onBusted(S);
      S.saveGame();
    },
    saveGame() {
      if (SHOT) return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ missionIdx: S.mission ? S.mission.idx : 0, money: S.player.money, done: S.mode === 'complete' }));
      } catch (e) {}
    },
  };
  // Spawn: on foot outside the garage (the city defines the spawn point).
  S.player.x = city.spawnPoint.x; S.player.y = city.spawnPoint.y;
  // Parked cars from the city + traffic + pedestrians.
  for (const pc of city.parkedCars) {
    const car = makeCar(pc.x, pc.y, pc.angle, 'sedan', pc.color, pc.occupied ? 'traffic' : 'none');
    car.parked = true;
    if (pc.occupied) car.ai = { axis: 'h', dir: 1, lane: 0, road: 0, turnCd: 5 };
    S.cars.push(car);
  }
  for (let i = 0; i < 10; i++) S.cars.push(spawnTrafficCar(S, rng, true));
  for (let i = 0; i < 18; i++) S.peds.push(spawnPed(S, rng));
  for (let i = 0; i < 8; i++) S.pickups.push(randomPickup(S, rng));
  S.hasSave = !SHOT && !!localStorage.getItem(SAVE_KEY);
  return S;
}

function randomPickup(S, rng) {
  const road = rng.pick(ROAD_CENTERS.slice(1, -1));
  const along = rng.range(150, WORLD - 150);
  const side = rng.pick([-1, 1]) * 68;
  return { x: rng.chance(0.5) ? along : road + side, y: rng.chance(0.5) ? road + side : along, kind: 'cash', amount: 50, respawnT: 0 };
}

let S = newGame(SEED);
if (AUTO) {
  S.mode = 'playing';
  S.auto = createAutoInput(S);
  startMission(S, 0);
  S.stats.startTime = 0;
} else if (SHOT) {
  setupShot(S, SHOT);
} else {
  S.mode = 'menu';
}
window.__solmar = S;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function startNewGame() {
  S = newGame(SEED);
  S.mode = 'playing';
  startMission(S, 0);
  S.stats.startTime = S.time;
  window.__solmar = S;
  audio.unlock();
  audio.click();
}

function continueGame() {
  const save = loadSave();
  S = newGame(SEED);
  S.mode = 'playing';
  if (save) {
    S.player.money = save.money || 0;
    startMission(S, Math.min(save.missionIdx || 0, 3));
  } else startMission(S, 0);
  window.__solmar = S;
  audio.unlock();
  audio.click();
}

function respawn() {
  const h = S.city.landmarks.hospital;
  S.player.x = h.x; S.player.y = h.y + 120;
  S.player.hp = 100;
  S.player.inCar = null;
  S.player.ammo = 12;
  S.wanted = 0;
  // A fresh start after the hospital: no stale timers, no heat left over.
  S.crashCd = 0; S.shootCd = 0; S.reloadT = 0; S.hornCd = 0;
  S.lastCrimeT = -100; S.decayT = 0;
  S.mode = 'playing';
  audio.click();
}

function shoot(S) {
  const p = S.player;
  if (p.ammo <= 0 || S.reloadT > 0) return;
  p.ammo--;
  S.stats.shotsFired++;
  S.shootCd = 0.25;
  audio.shot();
  const aim = Math.atan2(input.mouse.y - VIEW_H / 2, input.mouse.x - VIEW_W / 2);
  let best = null, bd = 430;
  const consider = (x, y, obj) => {
    const dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 430 || d < 1) return;
    let da = Math.atan2(dy, dx) - aim;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 0.16 && d < bd) { bd = d; best = obj; }
  };
  for (const c of S.cars) if (c !== p.inCar && !c.dead) consider(c.x, c.y, { type: 'car', car: c });
  for (const ped of S.peds) if (ped.state !== 'down') consider(ped.x, ped.y, { type: 'ped', ped });
  const tx = p.x + Math.cos(aim) * Math.min(bd, 430);
  const ty = p.y + Math.sin(aim) * Math.min(bd, 430);
  S.addParticles(tx, ty, 4, '#ffe08a');
  if (!best) return;
  if (best.type === 'car') {
    best.car.hp -= 25;
    S.addParticles(best.car.x, best.car.y, 8, '#ffb03d');
    if (best.car.hp <= 0) {
      if (best.car.driver === 'police') { S.addCrime(1); S.toast('COP CAR DESTROYED — WANTED UP', 2.5); }
      S.carWrecked(best.car);
    }
  } else {
    best.ped.state = 'down';
    best.ped.downT = 4;
    S.stats.pedsHit++;
    S.addCrime(1);
    S.toast('YOU HIT A PEDESTRIAN — WANTED UP', 2.5);
  }
}

function tryEnterExit(S) {
  const p = S.player;
  const it = interactableAt(S);
  if (it) { doInteract(S, it); return; }
  if (p.inCar) {
    const car = p.inCar;
    car.speed *= 0.3;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.angle = car.angle;
    audio.door();
    return;
  }
  let best = null, bd = 75;
  for (const c of S.cars) {
    if (c.dead || c.driver === 'police' || c.driver === 'player') continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    best.driver = 'player';
    S.stats.carsStolen++;
    S.addCrime(1);
    S.toast('CAR STOLEN — WANTED UP', 2.5);
    S.addParticles(best.x, best.y, 8, '#fff');
  } else {
    best.driver = 'player';
  }
  best.parked = false;
  best.ai = null;
  p.inCar = best;
  p.x = best.x; p.y = best.y; p.angle = best.angle;
  audio.door();
  audio.click();
}

function updatePlaying(S, dt, inp) {
  const p = S.player;
  S.time += dt;
  S.crashCd = Math.max(0, S.crashCd - dt);
  S.shootCd = Math.max(0, S.shootCd - dt);
  if (S.reloadT > 0) {
    S.reloadT -= dt;
    if (S.reloadT <= 0) p.ammo = 12;
  }
  // Dialogue: E / click advances, or auto-advance after a few seconds.
  // A finished briefing clears itself to null: a stale dialogue object
  // sitting at idx == len used to linger forever (it blocked nothing, but
  // it was dead state the HUD kept checking every frame).
  if (S.dialogue && S.dialogue.idx < S.dialogue.lines.length) {
    S.dialogue.t += dt;
    if (inp.pressed('KeyE') || inp.mouse.clicked || S.dialogue.t > DIALOGUE_AUTO_ADVANCE_S) {
      S.dialogue.idx++;
      S.dialogue.t = 0;
      if (S.dialogue.idx >= S.dialogue.lines.length) S.dialogue = null;
    }
  }
  // Interact / enter-exit.
  if (inp.pressed('KeyE') && !(S.dialogue && S.dialogue.idx < S.dialogue.lines.length)) {
    tryEnterExit(S);
  }
  // Shooting + reload. A click that advances a briefing must NOT also fire
  // the pistol: before this guard, clicking through Dante's dialogue spent
  // a bullet (and could hit a pedestrian standing in the aim cone).
  const briefingOpen = S.dialogue && S.dialogue.idx < S.dialogue.lines.length;
  if (inp.mouse.clicked && S.mode === 'playing' && !briefingOpen) shoot(S);
  if (inp.pressed('KeyR') && p.ammo < 12 && S.reloadT <= 0) { S.reloadT = 0.8; audio.click(); }
  if (inp.pressed('KeyM')) audio.setMuted(!audio.isMuted());
  // Horn (H): a two-tone honk with a short cooldown, driving or on foot.
  S.hornCd = Math.max(0, S.hornCd - dt);
  if (inp.pressed('KeyH') && S.hornCd <= 0) { audio.horn(); S.hornCd = HORN_COOLDOWN_S; }
  // Player movement.
  if (p.inCar) updatePlayerCar(S, p.inCar, inp, dt);
  else updatePlayerFoot(S, inp, dt);
  // Player health regen when calm.
  if (S.wanted === 0 && S.time - S.lastCrimeT > 8 && p.hp < 100) p.hp = Math.min(100, p.hp + 2 * dt);
  // Traffic + peds.
  for (const c of S.cars) {
    if (c.driver === 'traffic' && !c.dead) updateTrafficCar(S, c, dt);
  }
  for (const ped of S.peds) updatePed(S, ped, dt);
  for (const u of S.police) updatePolice(S, u, dt);
  // Car vs car shunts.
  for (let i = 0; i < S.cars.length; i++) {
    const a = S.cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < S.cars.length; j++) {
      const b = S.cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 38) {
        const push = (38 - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        a.speed *= 0.72; b.speed *= 0.72;
        if (rel > 160 && S.crashCd <= 0 && (a.driver === 'player' || b.driver === 'player')) {
          audio.crash();
          S.addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 8, '#cfd6dd');
          S.crashCd = 0.5;
        }
      }
    }
  }
  // Player car vs pedestrians (a crime).
  if (p.inCar && Math.abs(p.inCar.speed) > 50) {
    for (const ped of S.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 30) {
        ped.state = 'down'; ped.downT = 4;
        S.stats.pedsHit++;
        S.addCrime(1);
        S.toast('YOU HIT A PEDESTRIAN — WANTED UP', 2.5);
        audio.crash();
      }
    }
  }
  // Pickups.
  for (const pk of S.pickups) {
    if (pk.respawnT > 0) { pk.respawnT -= dt; continue; }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      p.money += pk.amount;
      audio.pickup();
      S.toast(`+$${pk.amount}`, 1.5);
      const np = randomPickup(S, S.rng);
      pk.x = np.x; pk.y = np.y; pk.respawnT = 20;
    }
  }
  // Wanted decay + police management.
  const desired = S.wanted === 0 ? 0 : Math.min(S.wanted + 1, 4);
  S.spawnCd -= dt;
  if (S.police.length < desired && S.spawnCd <= 0) {
    S.spawnPolice(1);
    S.spawnCd = 2;
  }
  if (S.wanted > 0 && S.time - S.lastCrimeT > WANTED_DECAY_AFTER_S) {
    let nearest = 1e9;
    for (const u of S.police) nearest = Math.min(nearest, Math.hypot(u.car.x - p.x, u.car.y - p.y));
    if (S.police.length === 0 || nearest > 650) {
      S.decayT += dt;
      if (S.decayT > WANTED_DECAY_STEP_S) {
        S.wanted--;
        S.decayT = 0;
        if (S.wanted > 0) S.toast('Wanted level dropping…', 2);
      }
    }
  }
  // Police lose the player when far away for a while.
  for (const u of [...S.police]) {
    const d = Math.hypot(u.car.x - p.x, u.car.y - p.y);
    u.loseT = d > 950 ? (u.loseT || 0) + dt : 0;
    if (u.loseT > 8 || (S.wanted === 0 && d > 700)) {
      S.police = S.police.filter((x) => x !== u);
      S.cars = S.cars.filter((c) => c !== u.car);
    }
  }
  // Keep the streets alive.
  let traffic = S.cars.filter((c) => c.driver === 'traffic').length;
  if (traffic < 10) S.cars.push(spawnTrafficCar(S, S.rng, true));
  if (S.peds.length < 18) S.peds.push(spawnPed(S, S.rng));
  // Particles + toasts.
  for (const pt of S.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  for (const t of S.toasts) t.t -= dt;
  S.toasts = S.toasts.filter((t) => t.t > 0);
  // Missions.
  updateMission(S, dt);
  // Camera follows the player.
  const tx = Math.max(VIEW_W / 2, Math.min(WORLD - VIEW_W / 2, p.x));
  const ty = Math.max(VIEW_H / 2, Math.min(WORLD - VIEW_H / 2, p.y));
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 5);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 5);
  // Audio: engine + siren.
  audio.engine(!!p.inCar, p.inCar ? Math.abs(p.inCar.speed) / p.inCar.maxSpeed : 0);
  audio.siren(S.police.length > 0, dt);
  // Autosave every 10s.
  if (Math.floor(S.time) % 10 === 0 && !S._savedAtSecond) { S.saveGame(); S._savedAtSecond = Math.floor(S.time); }
  if (Math.floor(S.time) % 10 !== 0) S._savedAtSecond = 0;
}

function update(S, dt) {
  const inp = S.autopilot && S.auto ? S.auto : input;
  if (S.autopilot && S.auto) S.auto.update(dt);
  if (S.mode === 'menu') {
    S.time += dt;
    S.cam.x = 1800 + Math.cos(S.time * 0.05) * 500;
    S.cam.y = 1800 + Math.sin(S.time * 0.04) * 400;
    audio.siren(false, dt);
    if (S.showHow) {
      if (input.mouse.clicked || input.pressed('Escape', 'Enter')) S.showHow = false;
    } else if (input.mouse.clicked) {
      for (const b of menuButtons(S)) {
        if (input.wasClicked(b.x, b.y, b.w, b.h)) {
          if (b.id === 'new') startNewGame();
          else if (b.id === 'continue') continueGame();
          else if (b.id === 'how') S.showHow = true;
        }
      }
    } else if (input.pressed('Enter')) startNewGame();
    inp.endFrame();
    return;
  }
  if (S.mode === 'playing') {
    if (inp.pressed('KeyP', 'Escape')) { S.mode = 'paused'; audio.engine(false, 0); audio.siren(false, dt); inp.endFrame(); return; }
    updatePlaying(S, dt, inp);
  } else if (S.mode === 'paused') {
    if (inp.pressed('KeyP', 'Escape', 'Enter')) S.mode = 'playing';
  } else if (S.mode === 'busted' || S.mode === 'wasted') {
    if (inp.pressed('Enter')) respawn();
  } else if (S.mode === 'complete') {
    if (inp.pressed('Enter')) {
      S.mode = 'playing';
      S.mission = null;
      S.marker = null;
      S.objective = 'Free roam — enjoy Solmar City';
    }
  }
  inp.endFrame();
}

let last = performance.now();
let frameErrCount = 0;
function frame(now) {
  const rawDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    const steps = S.autopilot ? 5 : 1;
    for (let i = 0; i < steps; i++) update(S, 1 / 60);
    // The headless autopilot run skips rendering entirely (3x sim speed);
    // real play always renders.
    if (!S.autopilot) {
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      drawWorld(ctx, S);
      if (S.mode === 'menu') drawMenu(ctx, S);
      else {
        drawHUD(ctx, S);
        if (S.mode !== 'playing') drawOverlay(ctx, S);
      }
    }
  } catch (e) {
    // Cap the logging: a per-frame error would otherwise flood the console
    // and throttle the loop (each console.error is a slow CDP round-trip).
    frameErrCount++;
    if (frameErrCount <= 5) console.error('Solmar Heat frame error (loop kept alive):', e);
    else if (frameErrCount % 600 === 0) console.error('Solmar Heat frame errors so far:', frameErrCount);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
