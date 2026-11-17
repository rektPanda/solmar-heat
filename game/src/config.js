// Solmar Heat — shared constants for the open-world crime game.
// A sun-soaked fictional city: 8x8 blocks on a 450px road grid.
export const WORLD = 3600;
export const PITCH = 450;
export const ROAD_W = 90;
export const BLOCK = PITCH - ROAD_W; // 360
export const N_BLOCKS = 8;
export const ROAD_CENTERS = [0, 450, 900, 1350, 1800, 2250, 2700, 3150, 3600];
export const VIEW_W = 1280;
export const VIEW_H = 720;

export function blockRect(bx, by) {
  return { x: bx * PITCH + ROAD_W / 2, y: by * PITCH + ROAD_W / 2, w: BLOCK, h: BLOCK };
}
export function blockCenter(bx, by) {
  const r = blockRect(bx, by);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
export function nearestRoadCenter(v) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}
export function isOnRoad(x, y) {
  const dx = Math.abs(x - nearestRoadCenter(x));
  const dy = Math.abs(y - nearestRoadCenter(y));
  return dx <= ROAD_W / 2 || dy <= ROAD_W / 2;
}

export const LANDMARKS = {
  garage: { bx: 2, by: 2, label: "Dante's Garage", color: '#e8a33d' },
  docks: { bx: 3, by: 7, label: 'Solmar Docks', color: '#7fb3d5' },
  bank: { bx: 5, by: 3, label: 'Solmar Central Bank', color: '#d8c56a' },
  safehouse: { bx: 6, by: 6, label: 'Safehouse', color: '#8fce7a' },
  hospital: { bx: 1, by: 5, label: 'St. Marina Hospital', color: '#e8e8e8' },
  policeHQ: { bx: 6, by: 1, label: 'Police HQ', color: '#7a9ec7' },
  park: { bx: 4, by: 4, label: 'Palm Court Park', color: '#7fae5a' },
};

export const PALETTE = {
  ground: '#b8a06a',
  grass: '#7fae5a',
  parkGrass: '#6da34e',
  sand: '#e0c88f',
  water: '#3f8fbf',
  asphalt: '#3a3f47',
  asphaltDark: '#33373f',
  sidewalk: '#9a938a',
  lane: '#e8e3c8',
  buildingRoof: ['#b5654a', '#7a9e7e', '#d9a441', '#6b7fa3', '#a06b8a', '#c97e4a', '#5f8a6b', '#8a6fb0'],
  buildingEdge: '#2e2a26',
  hud: 'rgba(12, 14, 20, 0.72)',
  hudText: '#f2ead8',
  accent: '#ffc233',
  danger: '#ff5252',
  police: '#4da3ff',
};

export const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33d', '#7ac74f', '#e8e8e8', '#8a5fd0', '#e07a2e', '#3db8a6'];
export const PED_COLORS = ['#e8b88a', '#d9a0a0', '#a0c4d9', '#c9d9a0', '#d9c9a0', '#b0a0d9', '#8ac4b0'];
export const MISSION_REWARDS = [150, 300, 250, 800];
export const MAX_WANTED = 5;

// Centralised tuning: one place for the numbers the rules share.
export const BUST_FINE = 150; // cash lost when busted or wasted
export const DIALOGUE_AUTO_ADVANCE_S = 6; // seconds before a briefing line advances itself
export const WANTED_DECAY_AFTER_S = 20; // quiet seconds before the heat starts cooling
export const WANTED_DECAY_STEP_S = 8; // seconds per wanted star lost while hiding
export const HORN_COOLDOWN_S = 0.4; // seconds between horn honks
