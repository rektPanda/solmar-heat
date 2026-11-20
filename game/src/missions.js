// The story: 4 missions in an arc, then free roam. Each mission is steps;
// reaching a step's target (on foot or in a car) advances it. Getting
// busted or wasted while carrying goods loses them and resets the mission
// to its pickup step (onBusted), never soft-locking the story.
import { CFG } from './config.js';

const MISSIONS = [
  {
    name: 'Wheels',
    reward: 150,
    briefing: [
      'Rico. Dante here. I got a buyer for a clean ride — any car will do.',
      'Steal a car and bring it to my Garage. Don\'t scratch it too much.',
    ],
    steps: [
      { kind: 'steal', text: 'Steal a car' },
      { kind: 'deliver', target: 'garageDoor', needCar: true, text: 'Deliver the car to the Garage' },
    ],
  },
  {
    name: 'The Pickup',
    reward: 300,
    briefing: [
      'Nice work. A package is waiting at the Docks — crates, middle of the yard.',
      'Grab it and bring it to the Safehouse. No cops, no noise.',
    ],
    steps: [
      { kind: 'pickup', target: 'docksPackage', text: 'Pick up the package at the Docks' },
      { kind: 'deliver', target: 'safehouseDoor', text: 'Deliver the package to the Safehouse' },
    ],
  },
  {
    name: 'Heat',
    reward: 250,
    briefing: [
      'The buyer tipped off the cops, Rico. This one is hot.',
      'Same drill — Docks parcel, Garage drop — but expect blue lights.',
    ],
    steps: [
      { kind: 'pickup', target: 'docksPackage', heatOnPickup: true, text: 'Grab the parcel at the Docks' },
      { kind: 'deliver', target: 'garageDoor', text: 'Deliver it to the Garage under heat' },
    ],
  },
  {
    name: 'The Big Score',
    reward: 800,
    briefing: [
      'Last one, and it pays for everything. Solmar Central Bank.',
      'The cash bag is by the south wall. Take it to the Safehouse and we are done.',
    ],
    steps: [
      { kind: 'pickup', target: 'bankCash', text: 'Grab the cash at the Bank' },
      { kind: 'deliver', target: 'safehouseDoor', text: 'Deliver the cash to the Safehouse' },
    ],
  },
];

export function makeMissions() {
  return {
    idx: 0,
    step: 0,
    hasGoods: false,
    done: false,
    dialogue: null, // {lines, i, t}
    toast: null,
    toastT: 0,
  };
}

export function currentMission(m) {
  return m.done ? null : MISSIONS[m.idx];
}

export function objectiveText(m) {
  if (m.done) return 'Free roam — Solmar City is yours, Rico.';
  const mis = MISSIONS[m.idx];
  return `${mis.name}: ${mis.steps[m.step].text}`;
}

export function startBriefing(m) {
  const mis = MISSIONS[m.idx];
  m.dialogue = { lines: mis.briefing, i: 0, t: 0 };
}

export function advanceDialogue(m) {
  if (!m.dialogue) return;
  m.dialogue.i += 1;
  m.dialogue.t = 0;
  if (m.dialogue.i >= m.dialogue.lines.length) m.dialogue = null;
}

export function updateDialogue(m, dt) {
  if (!m.dialogue) return;
  m.dialogue.t += dt;
  if (m.dialogue.t >= CFG.DIALOGUE_AUTO_ADVANCE_S) advanceDialogue(m);
}

export function setToast(m, text) {
  m.toast = text;
  m.toastT = 3.2;
}

export function updateToast(m, dt) {
  if (m.toastT > 0) {
    m.toastT -= dt;
    if (m.toastT <= 0) m.toast = null;
  }
}

// Check proximity to the current step's target. Returns an event object
// ('picked' | 'delivered' | 'stolen' | null). The caller applies rewards,
// sounds and wanted changes.
export function checkStep(m, px, py, inCar, city) {
  if (m.done) return null;
  const mis = MISSIONS[m.idx];
  const step = mis.steps[m.step];
  const lm = city.landmarks;
  if (step.kind === 'steal') {
    if (inCar) return { type: 'stolen' };
    return null;
  }
  const target = lm[step.target];
  const dist = Math.hypot(px - target.x, py - target.y);
  const need = step.kind === 'pickup' ? CFG.PICKUP_DIST : CFG.DELIVER_DIST;
  if (dist > need) return null;
  if (step.kind === 'pickup') return { type: 'picked', heat: !!step.heatOnPickup };
  if (step.needCar && !inCar) return null;
  return { type: 'delivered' };
}

export function applyStepEvent(m, ev) {
  if (ev.type === 'stolen' || ev.type === 'picked') {
    if (ev.type === 'picked') m.hasGoods = true;
    m.step += 1;
    return { advanced: true, heat: !!ev.heat, finished: false };
  }
  // delivered
  const mis = MISSIONS[m.idx];
  const reward = mis.reward;
  m.hasGoods = false;
  m.step = 0;
  m.idx += 1;
  if (m.idx >= MISSIONS.length) {
    m.done = true;
    return { advanced: true, finished: true, reward };
  }
  return { advanced: true, finished: false, reward, next: MISSIONS[m.idx].name };
}

// Busted / wasted while carrying goods: goods are lost, the mission resets
// to its pickup step (or step 0 for Wheels).
export function onBusted(m) {
  if (m.done) return;
  m.hasGoods = false;
  const mis = MISSIONS[m.idx];
  const pickupStep = mis.steps.findIndex((s) => s.kind === 'pickup');
  m.step = pickupStep >= 0 ? pickupStep : 0;
  m.dialogue = null;
}

export function missionTarget(m, city) {
  if (m.done) return null;
  const step = MISSIONS[m.idx].steps[m.step];
  if (step.kind === 'steal') return null;
  const t = city.landmarks[step.target];
  return { x: t.x, y: t.y, label: t.label, needCar: !!step.needCar, kind: step.kind };
}
