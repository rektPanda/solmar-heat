// Solmar City: 3600x3600, 9 streets each way (pitch 400), 8x8 blocks.
// Every mission target sits OUTSIDE its building, on open ground, so it is
// always reachable on foot or by car.
import { CFG } from './config.js';

const LABELS = [
  'Solmar Hotel', 'Marina Market', 'Palm Apartments', 'Harbor Offices',
  'Cine Solmar', 'Clinic Santa Ana', 'Riverside School', 'Plaza Mall',
  'Laundromat 24h', 'Taco Libre', 'Gym Titan', 'Bar El Faro',
  'Pharmacy Vida', 'Auto Parts Ruiz', 'Cafe Brisa', 'Motel Coral',
  'Library Central', 'Theater Aurora', 'Bakery Dulce', 'Surf Shop',
  'Diner 66', 'Bookstore Faro', 'Galeria Sol', 'Pizzeria Napoli',
];

export function buildCity(rng) {
  const streets = [];
  for (let i = 0; i < 9; i++) streets.push(CFG.STREET_FIRST + i * CFG.STREET_PITCH);

  const blockRect = (bx, by) => ({
    x: streets[bx] + CFG.ROAD_HALF,
    y: streets[by] + CFG.ROAD_HALF,
    w: CFG.STREET_PITCH - 2 * CFG.ROAD_HALF,
    h: CFG.STREET_PITCH - 2 * CFG.ROAD_HALF,
  });

  const buildings = [];
  const crates = [];
  const parks = [];

  const addBuilding = (bx, by, label, color, kind = 'generic', inset = 24) => {
    const b = blockRect(bx, by);
    const r = { x: b.x + inset, y: b.y + inset, w: b.w - 2 * inset, h: b.h - 2 * inset, label, color, kind, bx, by };
    buildings.push(r);
    return r;
  };

  // Landmarks (fixed blocks so missions are stable every run).
  const safehouse = addBuilding(4, 4, 'Safehouse', '#7a6a4f', 'safehouse');
  const garage = addBuilding(1, 5, 'Garage Rico', '#5b6b7a', 'garage');
  const bank = addBuilding(6, 2, 'Solmar Central Bank', '#8a7f56', 'bank');
  // Docks: warehouse on the north half, open yard with crates on the south.
  const docksBlock = blockRect(0, 0);
  const warehouse = {
    x: docksBlock.x + 16, y: docksBlock.y + 16,
    w: docksBlock.w - 32, h: 168,
    label: 'Docks Warehouse', color: '#6b5a4a', kind: 'docks', bx: 0, by: 0,
  };
  buildings.push(warehouse);
  const yardY = docksBlock.y + 200;
  const yardH = docksBlock.h - 200;
  // Crates hug the yard edges, leaving the middle open.
  for (let i = 0; i < 3; i++) {
    crates.push({ x: docksBlock.x + 18 + i * 52, y: yardY + 8, w: 40, h: 40 });
    crates.push({ x: docksBlock.x + docksBlock.w - 58 - i * 52, y: yardY + yardH - 48, w: 40, h: 40 });
  }
  crates.push({ x: docksBlock.x + 18, y: yardY + yardH - 48, w: 40, h: 40 });

  // The rest: buildings with varied labels, a few parks for breathing room.
  let li = 0;
  const parkBlocks = new Set(['2,1', '5,6', '7,5', '3,0']);
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      const key = `${bx},${by}`;
      if (['4,4', '1,5', '6,2', '0,0'].includes(key)) continue;
      if (parkBlocks.has(key)) {
        const b = blockRect(bx, by);
        parks.push({ x: b.x, y: b.y, w: b.w, h: b.h, trees: [] });
        const park = parks[parks.length - 1];
        for (let t = 0; t < 6; t++) {
          park.trees.push({
            x: b.x + 40 + rng.range(0, b.w - 80),
            y: b.y + 40 + rng.range(0, b.h - 80),
            r: rng.range(14, 22),
          });
        }
        continue;
      }
      const colors = ['#5d6b52', '#6b5d52', '#525f6b', '#6b5252', '#5a5a68', '#71604a'];
      addBuilding(bx, by, LABELS[li % LABELS.length], colors[li % colors.length]);
      li++;
    }
  }

  const cx = (r) => r.x + r.w / 2;
  const landmarks = {
    safehouseDoor: { x: cx(safehouse), y: safehouse.y + safehouse.h + 46, label: 'Safehouse' },
    garageDoor: { x: cx(garage), y: garage.y + garage.h + 46, label: 'Garage' },
    bankCash: { x: cx(bank), y: bank.y + bank.h + 46, label: 'Cash' },
    docksPackage: { x: docksBlock.x + docksBlock.w / 2, y: yardY + yardH / 2 + 20, label: 'Package' },
    spawnPoint: { x: cx(safehouse), y: streets[5] + 10 },
  };

  // Parked cars along road edges (free to take, no wanted). The first one
  // sits by the Safehouse so mission 1 always has a car in reach.
  const parkedSpots = [
    { x: 2150, y: 2250, angle: 0, type: 'sedan' },
    { x: streets[3] + 44, y: streets[4] - 150, angle: Math.PI / 2, type: 'sport' },
    { x: streets[5] - 44, y: streets[3] + 200, angle: -Math.PI / 2, type: 'sedan' },
    { x: streets[2] + 44, y: streets[6] + 120, angle: Math.PI / 2, type: 'sedan' },
    { x: streets[6] - 44, y: streets[1] - 180, angle: -Math.PI / 2, type: 'sport' },
    { x: streets[1] + 44, y: streets[2] + 260, angle: Math.PI / 2, type: 'sedan' },
    { x: streets[7] - 44, y: streets[5] - 220, angle: -Math.PI / 2, type: 'sedan' },
  ];

  const obstacles = [...buildings, ...crates];

  // Push a circle out of every obstacle and the world edge.
  // Returns the corrected position and the deepest penetration found.
  function collideCircle(x, y, r) {
    let depth = 0;
    if (x < r) { depth = Math.max(depth, r - x); x = r; }
    if (x > CFG.WORLD - r) { depth = Math.max(depth, x - (CFG.WORLD - r)); x = CFG.WORLD - r; }
    if (y < r) { depth = Math.max(depth, r - y); y = r; }
    if (y > CFG.WORLD - r) { depth = Math.max(depth, y - (CFG.WORLD - r)); y = CFG.WORLD - r; }
    for (const o of obstacles) {
      const nx = Math.max(o.x, Math.min(x, o.x + o.w));
      const ny = Math.max(o.y, Math.min(y, o.y + o.h));
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = r - d;
        depth = Math.max(depth, push);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest exit.
        const left = x - o.x + r;
        const right = o.x + o.w - x + r;
        const top = y - o.y + r;
        const bottom = o.y + o.h - y + r;
        const m = Math.min(left, right, top, bottom);
        depth = Math.max(depth, m);
        if (m === left) x = o.x - r;
        else if (m === right) x = o.x + o.w + r;
        else if (m === top) y = o.y - r;
        else y = o.y + o.h + r;
      }
    }
    return { x, y, depth };
  }

  function isRoad(x, y) {
    const near = (v) => streets.some((s) => Math.abs(v - s) <= CFG.ROAD_HALF);
    return near(x) || near(y);
  }

  function nearestStreet(v) {
    let best = streets[0];
    for (const s of streets) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
    return best;
  }

  return {
    streets, buildings, crates, parks, landmarks, parkedSpots,
    blockRect, collideCircle, isRoad, nearestStreet,
  };
}
