// Story missions: a four-job arc in Solmar City.
// The player is Rico, a driver new in town; Dante is the fixer who calls the shots.
import { LANDMARKS, MISSION_REWARDS, blockCenter } from './config.js';

export const MISSIONS = [
  {
    id: 'wheels', title: 'Wheels', reward: MISSION_REWARDS[0],
    brief: [
      "DANTE: Rico. You made it to Solmar City. First rule: wheels. Nobody walks in this town.",
      "DANTE: Take any car on the street — walk up to it and press E. Then bring it to my garage.",
    ],
  },
  {
    id: 'pickup', title: 'The Pickup', reward: MISSION_REWARDS[1],
    brief: [
      'DANTE: Good. Now a real job. A package is waiting at the Docks.',
      "DANTE: Drive down there, grab it on foot, and bring it back. Don't scratch the paint.",
    ],
  },
  {
    id: 'heat', title: 'Heat', reward: MISSION_REWARDS[2],
    brief: [
      'DANTE: Heads up — that pickup was hot. The cops are all over you.',
      'DANTE: Lose them, Rico. Get your wanted level down to zero, then call me.',
    ],
  },
  {
    id: 'score', title: 'The Big Score', reward: MISSION_REWARDS[3],
    brief: [
      'DANTE: One last job, the big one. Solmar Central Bank.',
      "DANTE: Walk in, grab the cash, and run. Cops will be on you the second you touch it. Get to the Safehouse and we're rich.",
    ],
  },
];

function lm(name) {
  const d = LANDMARKS[name];
  return blockCenter(d.bx, d.by);
}

export function startMission(S, idx) {
  const def = MISSIONS[idx];
  S.mission = { idx, step: 0, pkg: false };
  S.dialogue = { lines: def.brief.slice(), idx: 0, t: 0 };
  S.objective = '';
  S.marker = null;
  if (idx === 0) {
    S.objective = 'Steal a car — walk to a car and press E';
  } else if (idx === 1) {
    const d = lm('docks');
    S.marker = { x: d.x, y: d.y, label: 'Solmar Docks' };
    S.objective = 'Drive to the Solmar Docks';
  } else if (idx === 2) {
    S.wanted = 2;
    S.lastCrimeT = S.time;
    S.spawnPolice(2);
    S.objective = 'Lose the cops — get your wanted level to 0';
    S.toast('WANTED LEVEL 2 — THE COPS ARE ONTO YOU', 4);
  } else if (idx === 3) {
    const b = lm('bank');
    S.marker = { x: b.x, y: b.y, label: 'Solmar Central Bank' };
    S.objective = 'Drive to Solmar Central Bank';
  }
}

function completeMission(S) {
  const def = MISSIONS[S.mission.idx];
  S.player.money += def.reward;
  S.stats.missionsDone++;
  S.audio.complete();
  S.toast(`MISSION COMPLETE — ${def.title}  +$${def.reward}`, 4);
  S.addParticles(S.player.x, S.player.y, 24, '#ffc233');
  if (S.mission.idx >= MISSIONS.length - 1) {
    S.mode = 'complete';
    S.stats.endTime = S.time;
    S.saveGame();
  } else {
    startMission(S, S.mission.idx + 1);
  }
}

export function updateMission(S, dt) {
  const m = S.mission;
  if (!m || S.mode !== 'playing') return;
  const p = S.player;
  const docks = lm('docks');
  const garage = lm('garage');
  const bank = lm('bank');
  const safehouse = lm('safehouse');

  if (m.idx === 0) {
    if (m.step === 0) {
      if (p.inCar) {
        m.step = 1;
        S.marker = { x: garage.x, y: garage.y, label: "Dante's Garage" };
        S.objective = "Drive to Dante's Garage";
      }
    } else if (Math.hypot(p.x - garage.x, p.y - garage.y) < 110 && p.inCar) {
      completeMission(S);
    }
  } else if (m.idx === 1) {
    if (m.step === 0) {
      if (Math.hypot(p.x - docks.x, p.y - docks.y) < 110) {
        m.step = 1;
        S.marker = { x: docks.x + 60, y: docks.y + 40, label: 'Package' };
        S.objective = 'Get out and grab the package (press E)';
      }
    } else if (m.step === 1) {
      // Wait for the player to press E at the package (handled in main).
    } else if (m.step === 2) {
      if (Math.hypot(p.x - garage.x, p.y - garage.y) < 110) completeMission(S);
    }
  } else if (m.idx === 2) {
    if (S.wanted <= 0) completeMission(S);
  } else if (m.idx === 3) {
    if (m.step === 0) {
      if (Math.hypot(p.x - bank.x, p.y - bank.y) < 110) {
        m.step = 1;
        // Cash sits just south of the bank building (like the package at the
        // docks): the bank centre itself is inside the building, where the
        // player can never reach it.
        S.marker = { x: bank.x, y: bank.y + 100, label: 'Cash' };
        S.objective = 'Walk in and grab the cash (press E)';
      }
    } else if (m.step === 1) {
      // Wait for E at the cash.
    } else if (m.step === 2) {
      if (Math.hypot(p.x - safehouse.x, p.y - safehouse.y) < 110) completeMission(S);
    }
  }
}

// The thing the player can press E on right now (package / cash), or null.
export function interactableAt(S) {
  const m = S.mission;
  if (!m || S.mode !== 'playing' || S.player.inCar) return null;
  const p = S.player;
  if (m.idx === 1 && m.step === 1 && S.marker) {
    if (Math.hypot(p.x - S.marker.x, p.y - S.marker.y) < 70) return { kind: 'package', x: S.marker.x, y: S.marker.y };
  }
  if (m.idx === 3 && m.step === 1 && S.marker) {
    if (Math.hypot(p.x - S.marker.x, p.y - S.marker.y) < 70) return { kind: 'cash', x: S.marker.x, y: S.marker.y };
  }
  return null;
}

// Called when the player presses E on an interactable.
export function doInteract(S, it) {
  const m = S.mission;
  const garage = lm('garage');
  const safehouse = lm('safehouse');
  if (it.kind === 'package') {
    m.step = 2;
    m.pkg = true;
    S.marker = { x: garage.x, y: garage.y, label: "Dante's Garage" };
    S.objective = 'Take the package back to the Garage';
    S.audio.pickup();
    S.toast('PACKAGE SECURED', 2.5);
    S.addParticles(it.x, it.y, 14, '#8fce7a');
  } else if (it.kind === 'cash') {
    m.step = 2;
    S.marker = { x: safehouse.x, y: safehouse.y, label: 'Safehouse' };
    S.objective = 'Escape to the Safehouse — the alarm is up!';
    S.wanted = 3;
    S.lastCrimeT = S.time;
    S.spawnPolice(3);
    S.audio.pickup();
    S.toast('ALARM! WANTED LEVEL 3 — RUN!', 4);
    S.addParticles(it.x, it.y, 20, '#d8c56a');
  }
}

// Called on a bust/wasted: the job's goods are lost — the package (or the
// bank cash) goes back where it came from, and the step resets. Getting
// caught mid-job costs the run, not just the fine.
export function onBusted(S) {
  const m = S.mission;
  if (!m) return;
  const docks = lm('docks');
  const bank = lm('bank');
  if (m.idx === 1 && m.step === 2) {
    m.step = 1;
    m.pkg = false;
    S.marker = { x: docks.x + 60, y: docks.y + 40, label: 'Package' };
    S.objective = 'Get out and grab the package (press E)';
    S.toast('PACKAGE LOST — IT IS BACK AT THE DOCKS', 3);
  } else if (m.idx === 3 && m.step === 2) {
    m.step = 1;
    S.marker = { x: bank.x, y: bank.y + 100, label: 'Cash' };
    S.objective = 'Walk in and grab the cash (press E)';
    S.toast('CASH LOST — THE BANK JOB RESETS', 3);
  }
}
