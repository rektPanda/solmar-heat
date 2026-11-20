// Screenshot staging (?shot=1..4). Each setup places Rico, cars and police
// deterministically so the four renders show four different systems at once.
// Dialogue is always cleared for shots. Nothing here is used during normal play.
import { CFG } from './config.js';
import { makeCar } from './entities.js';

export function applyShot(G, n) {
  const { city, player, missions } = G;
  const lm = city.landmarks;
  missions.dialogue = null;
  G.wanted = 0;
  G.police.length = 0;
  G.mode = 'play';
  if (n === 1) {
    G.mode = 'menu';
    return;
  }
  if (n === 2) {
    // Drive: Rico in a sport car on the road by the Garage, traffic around.
    missions.idx = 0;
    missions.step = 1;
    const car = makeCar('sport', lm.garageDoor.x + 300, city.streets[6], 0);
    car.speed = 120;
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    G.traffic.cars[0].x = lm.garageDoor.x + 320;
    G.traffic.cars[0].y = city.streets[5];
    G.traffic.cars[0].angle = 0;
    G.traffic.cars[1].x = lm.garageDoor.x - 420;
    G.traffic.cars[1].y = city.streets[5] + 13;
    G.traffic.cars[1].angle = Math.PI;
    G.traffic.cars[2].x = city.streets[2];
    G.traffic.cars[2].y = lm.garageDoor.y + 420;
    G.traffic.cars[2].angle = Math.PI / 2;
    return;
  }
  if (n === 3) {
    // Chase: wanted 3, three police cars closing in on Rico's sedan.
    missions.idx = 2;
    missions.step = 1;
    missions.hasGoods = true;
    G.wanted = 3;
    G.lastCrimeT = G.time;
    const car = makeCar('sedan', lm.garageDoor.x + 260, city.streets[5], 0);
    car.speed = 260;
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = 0;
    const spots = [
      { x: car.x - 180, y: car.y - 40, a: 0 },
      { x: car.x - 260, y: car.y + 60, a: 0.3 },
      { x: car.x - 120, y: car.y + 130, a: -0.4 },
    ];
    for (const s of spots) {
      const cop = makeCar('police', s.x, s.y, s.a);
      cop.speed = 380;
      G.police.push(cop);
    }
    return;
  }
  // 4: Bank — Rico on foot at the cash bag, marker exactly on the cash.
  missions.idx = 3;
  missions.step = 0;
  player.inCar = null;
  player.x = lm.bankCash.x + 90;
  player.y = lm.bankCash.y + 60;
  player.angle = Math.atan2(lm.bankCash.y - player.y, lm.bankCash.x - player.x);
  player.hp = 100;
  G.wanted = 0;
  G.traffic.cars[0].x = city.streets[6];
  G.traffic.cars[0].y = lm.bankCash.y + 260;
  G.traffic.cars[0].angle = Math.PI / 2;
}
