// City generation: blocks, buildings, parks, trees, parked cars, landmarks.
// The city is fully determined by the seed — same seed, same Solmar City.
import { WORLD, PITCH, ROAD_W, BLOCK, N_BLOCKS, LANDMARKS, PALETTE, CAR_COLORS, blockRect, blockCenter, nearestRoadCenter } from './config.js';
import { makeRng } from './random.js';

const LANDMARK_BLOCKS = new Set(Object.values(LANDMARKS).map((l) => l.bx + ',' + l.by));

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parkedCars = [];
  let carId = 1;

  for (let bx = 0; bx < N_BLOCKS; bx++) {
    for (let by = 0; by < N_BLOCKS; by++) {
      const key = bx + ',' + by;
      const r = blockRect(bx, by);
      const lm = Object.entries(LANDMARKS).find(([, v]) => v.bx === bx && v.by === by);
      if (lm) {
        const [name, def] = lm;
        const c = blockCenter(bx, by);
        if (name === 'park') {
          for (let i = 0; i < 26; i++) {
            trees.push({ x: r.x + rng.range(20, r.w - 20), y: r.y + rng.range(20, r.h - 20), r: rng.range(10, 18) });
          }
          buildings.push({ x: c.x - 40, y: c.y - 30, w: 80, h: 60, color: '#d9c9a0', hgt: 10, label: 'Kiosk' });
        } else if (name === 'docks') {
          // Shipping containers + a warehouse by the water.
          buildings.push({ x: c.x - 130, y: c.y - 90, w: 260, h: 110, color: '#8a7a5a', hgt: 16, label: 'Warehouse' });
          // Crates in two rows along the south edge — but leave a driveway
          // open in front of the warehouse (the two middle columns), or
          // no car can ever drive in from the south road: the rows form a
          // wall with only 12 px gaps, too narrow for a car (r 16).
          for (let i = 0; i < 8; i++) {
            if (i % 4 === 1 || i % 4 === 2) continue;
            buildings.push({ x: r.x + 20 + (i % 4) * 80, y: r.y + r.h - 70 + Math.floor(i / 4) * 34, w: 68, h: 26, color: rng.pick(['#b5654a', '#3d7ad9', '#7ac74f', '#d9a441']), hgt: 8, label: 'Crate' });
          }
        } else {
          // Landmark building: one big block with a coloured roof.
          buildings.push({ x: c.x - 110, y: c.y - 80, w: 220, h: 160, color: def.color, hgt: 26, label: def.label });
          // A couple of small annexes.
          buildings.push({ x: r.x + 20, y: r.y + 20, w: 70, h: 60, color: '#9a938a', hgt: 8, label: '' });
          buildings.push({ x: r.x + r.w - 90, y: r.y + r.h - 80, w: 70, h: 60, color: '#9a938a', hgt: 8, label: '' });
        }
        continue;
      }
      // Ordinary block: 1-3 buildings with gaps (alleys) between them.
      const n = rng.int(1, 3);
      if (n === 1) {
        buildings.push({ x: r.x + 30, y: r.y + 30, w: r.w - 60, h: r.h - 60, color: rng.pick(PALETTE.buildingRoof), hgt: rng.int(10, 30), label: '' });
      } else {
        const vertical = rng.chance(0.5);
        for (let i = 0; i < n; i++) {
          if (vertical) {
            const w = (r.w - 40 - (n - 1) * 24) / n;
            buildings.push({ x: r.x + 20 + i * (w + 24), y: r.y + 24, w, h: r.h - 48, color: rng.pick(PALETTE.buildingRoof), hgt: rng.int(10, 30), label: '' });
          } else {
            const h = (r.h - 40 - (n - 1) * 24) / n;
            buildings.push({ x: r.x + 24, y: r.y + 20 + i * (h + 24), w: r.w - 48, h, color: rng.pick(PALETTE.buildingRoof), hgt: rng.int(10, 30), label: '' });
          }
        }
      }
      // A few street trees on ordinary blocks.
      for (let i = 0; i < rng.int(0, 3); i++) {
        trees.push({ x: r.x + rng.range(15, r.w - 15), y: r.y + rng.range(15, r.h - 15), r: rng.range(8, 13) });
      }
    }
  }

  // Parked cars along road edges (some occupied by a driver, most empty).
  for (let i = 0; i < 26; i++) {
    const horizontal = rng.chance(0.5);
    const road = rng.pick([450, 900, 1350, 1800, 2250, 2700, 3150]);
    const along = rng.range(120, WORLD - 120);
    const side = rng.pick([-1, 1]);
    const x = horizontal ? along : road + side * (ROAD_W / 2 - 14);
    const y = horizontal ? road + side * (ROAD_W / 2 - 14) : along;
    const angle = horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    parkedCars.push({ id: carId++, x, y, angle, color: rng.pick(CAR_COLORS), occupied: rng.chance(0.35) });
  }

  const landmarks = {};
  for (const [name, def] of Object.entries(LANDMARKS)) {
    const c = blockCenter(def.bx, def.by);
    landmarks[name] = { x: c.x, y: c.y, label: def.label, color: def.color };
  }
  // Where Rico starts: on foot just south of Dante's Garage.
  const garage = blockCenter(LANDMARKS.garage.bx, LANDMARKS.garage.by);
  return { seed, buildings, trees, parkedCars, landmarks, spawnPoint: { x: garage.x, y: garage.y + 130 } };
}

// Push a circle out of buildings and the world bounds. Returns corrected {x, y}.
export function collideCircle(city, x, y, r) {
  x = Math.max(r, Math.min(WORLD - r, x));
  y = Math.max(r, Math.min(WORLD - r, y));
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Centre inside the building: push out along the smallest penetration.
        const pl = x - (b.x - r), pr = (b.x + b.w + r) - x;
        const pt = y - (b.y - r), pb = (b.y + b.h + r) - y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  return { x, y };
}

// True when a circle of radius r at (x,y) overlaps any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Nearest point on the road network to (x, y) — used by the autopilot.
export function nearestRoadPoint(x, y) {
  const rx = nearestRoadCenter(x);
  const ry = nearestRoadCenter(y);
  // Pick the nearer axis road.
  return Math.abs(x - rx) < Math.abs(y - ry) ? { x: rx, y } : { x, y: ry };
}
