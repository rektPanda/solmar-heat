// Solmar Heat — headless autopilot test (Node, no DOM, no deps).
// Loads the game logic, drives every mission with the autopilot, and
// checks movement, collision, vehicles, wanted/police and mission flow.
// Usage: node test.js   (exit 0 = all pass)
require('./config.js');
require('./city.js');
require('./entities.js');
require('./missions.js');
var S = require('./main.js');

var DT = 1 / 30;
var results = [];
function check(name, ok, detail) {
  results.push({ name: name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  (' + detail + ')' : ''));
}
function step(state, input, n) {
  for (var i = 0; i < n; i++) S.Game.updateGame(state, input, DT);
}

// --- 1. City ---
var g0 = S.Game.createGame();
check('city builds: buildings + landmarks', g0.city.buildings.length > 40 && !!g0.city.landmarks.bank,
  g0.city.buildings.length + ' buildings');
check('player spawns on open ground', !S.City.circleHits(g0.city, g0.player.x, g0.player.y, 20));
var p0 = S.City.findPath(g0.city, 600, 600, 3000, 200);
check('pathfinding safehouse -> lighthouse', !!p0 && p0.length >= 2 && p0[p0.length - 1].x === 3000 && p0[p0.length - 1].y === 200, p0 ? p0.length + ' waypoints' : 'no path');

// --- 2. Movement ---
var g1 = S.Game.createGame();
var x0 = g1.player.x, y0 = g1.player.y;
step(g1, { up: true, down: false, left: false, right: false, run: false, actionPressed: false, missionPressed: false, autopilotPressed: false }, 30);
check('walking moves the player', S.Entities.dist(g1.player, { x: x0, y: y0 }) > 100,
  Math.round(S.Entities.dist(g1.player, { x: x0, y: y0 })) + 'px in 1s');

// --- 3. Collision: a building stops the player ---
var g2 = S.Game.createGame();
var b = g2.city.buildings[0];
g2.player.x = b.x - 30; g2.player.y = b.y + b.h / 2;
var bx0 = g2.player.x;
step(g2, { up: false, down: false, left: false, right: true, run: false, actionPressed: false, missionPressed: false, autopilotPressed: false }, 60);
check('building blocks the player', g2.player.x < b.x + 5 && g2.player.x - bx0 < 40,
  'x ' + Math.round(bx0) + ' -> ' + Math.round(g2.player.x) + ' (wall at ' + Math.round(b.x) + ')');

// --- 4. Vehicle enter / exit ---
var g3 = S.Game.createGame();
var car = g3.cars[0];
g3.player.x = car.x + 20; g3.player.y = car.y;
step(g3, { up: false, down: false, left: false, right: false, run: false, actionPressed: true, missionPressed: false, autopilotPressed: false }, 1);
check('enter car with SPACE', !g3.player.onFoot && g3.player.car === car);
// Face along the road (x=600 runs north-south) before driving.
car.angle = Math.PI / 2;
step(g3, { up: true, down: false, left: false, right: false, run: false, actionPressed: false, missionPressed: false, autopilotPressed: false }, 60);
check('driving moves the car', Math.abs(car.speed) > 50, 'speed ' + Math.round(car.speed));
step(g3, { up: false, down: false, left: false, right: false, run: false, actionPressed: true, missionPressed: false, autopilotPressed: false }, 1);
check('exit car with SPACE', g3.player.onFoot && !g3.player.car);

// --- 5. Wanted + police ---
var g4 = S.Game.createGame();
g4.wanted = 2;
step(g4, S.Game.zeroInput(), 60);
var cops = g4.cars.filter(function (c) { return c.kind === 'police'; }).length;
check('wanted 2 spawns police', cops >= 1, cops + ' cops');
// Hide: move police far away, wanted must decay.
for (var ci = 0; ci < g4.cars.length; ci++) {
  if (g4.cars[ci].kind === 'police') { g4.cars[ci].x = 100; g4.cars[ci].y = 100; }
}
g4.player.x = 3000; g4.player.y = 2200;
step(g4, S.Game.zeroInput(), 60 * 40);
check('wanted decays when unseen', g4.wanted === 0, 'wanted ' + g4.wanted);

// --- 6. All 8 missions via autopilot ---
var g5 = S.Game.createGame();
var missionSteps = [];
var allOk = true;
for (var mi = 0; mi < S.Missions.MISSIONS.length; mi++) {
  var def = S.Missions.MISSIONS[mi];
  var moneyBefore = g5.money;
  S.Missions.startMission(g5, mi);
  var done = false;
  var steps = 0;
  var cap = 40000;
  while (steps < cap) {
    var inp = S.Game.autopilotInput(g5);
    S.Game.updateGame(g5, inp, DT);
    steps++;
    if (g5.mission.completed.indexOf(def.id) >= 0) { done = true; break; }
    if (!g5.mission.active && g5.mission.completed.indexOf(def.id) < 0) break; // failed (busted/wasted)
  }
  var gained = g5.money - moneyBefore;
  missionSteps.push({ id: def.id, title: def.title, done: done, steps: steps, gained: gained, health: Math.round(g5.health) });
  check('mission ' + def.id + ' "' + def.title + '" completes', done && gained === def.reward,
    steps + ' steps, +$' + gained + ', hp ' + Math.round(g5.health));
  if (!done) allOk = false;
  // Heal between missions so one bad chase cannot cascade.
  g5.health = 100;
}
check('game won after mission 8', g5.won === true && g5.mission.completed.length === 8,
  g5.mission.completed.length + '/8, $' + g5.money);

// --- Summary ---
var failed = results.filter(function (r) { return !r.ok; }).length;
console.log('\n' + results.length + ' checks, ' + failed + ' failed.');
if (failed) {
  console.log('FAILED: ' + results.filter(function (r) { return !r.ok; }).map(function (r) { return r.name; }).join(' | '));
  process.exit(1);
}
console.log('ALL GREEN — Solmar Heat is playable end to end.');
