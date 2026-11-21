// Solmar Heat — 8 story missions (Rico & Dante), original writing.
// Step types: goto | pickup | deliver | wait | steal | escape.
// A step completes on arrival unless noted. Rewards are paid on completion.
(function () {
  var S = (globalThis.Solmar = globalThis.Solmar || {});

  var MISSIONS = [
    {
      id: 1, title: 'First Errand', giver: 'Rico', reward: 200, wantedAtStart: 0,
      brief: [
        'Rico: Morning, kid. Got a package that needs to reach the Marina.',
        'Rico: No cops, no drama. Just drive it over. Easy money.'
      ],
      steps: [
        { type: 'goto', target: 'marina', radius: 90, text: 'Deliver the package to the Marina' }
      ]
    },
    {
      id: 2, title: 'Getaway Driver', giver: 'Dante', reward: 400, wantedAtStart: 0,
      brief: [
        'Dante: I need wheels and I need them now. Pick me up at Club Sol.',
        'Dante: And when the cops show up — they will — don\'t stop for anything.'
      ],
      steps: [
        { type: 'pickup', target: 'club', radius: 90, text: 'Pick up Dante at Club Sol', wantedAfter: 2 },
        { type: 'escape', target: 'safehouse', radius: 100, text: 'Lose the cops — reach the Safehouse' }
      ]
    },
    {
      id: 3, title: 'Hot Wheels', giver: 'Dante', reward: 600, wantedAtStart: 0,
      brief: [
        'Dante: There is a cherry-red sports car parked on the beach road.',
        'Dante: Take it. The owner will not miss it. The cops might, though.'
      ],
      steps: [
        { type: 'steal', target: 'sportscar', radius: 70, text: 'Steal the sports car (SPACE to get in)' },
        { type: 'deliver', target: 'garage', radius: 100, text: 'Deliver the car to the Garage' }
      ]
    },
    {
      id: 4, title: 'The Pickup', giver: 'Rico', reward: 500, wantedAtStart: 0,
      brief: [
        'Rico: A crate came in at the Docks. Bring it to Club Sol.',
        'Rico: Keep it quiet. The harbour cops are bored and looking for fun.'
      ],
      steps: [
        { type: 'pickup', target: 'docks', radius: 90, text: 'Pick up the crate at the Docks', wantedAfter: 1 },
        { type: 'deliver', target: 'club', radius: 90, text: 'Deliver the crate to Club Sol' }
      ]
    },
    {
      id: 5, title: 'Roadblock Run', giver: 'Dante', reward: 800, wantedAtStart: 3,
      brief: [
        'Dante: Three checkpoints, whole city, cops everywhere. This is the fun one.',
        'Dante: Do not stop. Do not think. Just drive.'
      ],
      steps: [
        { type: 'goto', target: 'checkpoint1', radius: 90, text: 'Hit Checkpoint 1' },
        { type: 'goto', target: 'checkpoint2', radius: 90, text: 'Hit Checkpoint 2' },
        { type: 'goto', target: 'checkpoint3', radius: 90, text: 'Hit Checkpoint 3 — then you are clear' }
      ]
    },
    {
      id: 6, title: 'Midnight Courier', giver: 'Rico', reward: 700, wantedAtStart: 0,
      brief: [
        'Rico: Night run. Two drops, no questions. Bank first, then the Hospital.',
        'Rico: The city looks different after dark. Keep your eyes open.'
      ],
      steps: [
        { type: 'deliver', target: 'bank', radius: 90, text: 'Drop 1: Solmar Bank' },
        { type: 'deliver', target: 'hospital', radius: 90, text: 'Drop 2: Solmar Hospital' }
      ]
    },
    {
      id: 7, title: 'The Heist', giver: 'Dante', reward: 1500, wantedAtStart: 0,
      brief: [
        'Dante: The Bank. Eight seconds inside and we walk out rich.',
        'Dante: Eight seconds. Then every cop in Solmar will want a word.'
      ],
      steps: [
        { type: 'goto', target: 'bank', radius: 90, text: 'Get to Solmar Bank' },
        { type: 'wait', target: 'bank', radius: 110, seconds: 8, text: 'Crack the safe — stay close (8s)', wantedAfter: 4 },
        { type: 'escape', target: 'safehouse', radius: 100, text: 'Escape to the Safehouse!' }
      ]
    },
    {
      id: 8, title: 'King of Solmar', giver: 'Rico', reward: 2500, wantedAtStart: 5,
      brief: [
        'Rico: Five stars. The whole force. One lighthouse.',
        'Rico: Reach it and the city is yours, kid. King of Solmar.'
      ],
      steps: [
        { type: 'escape', target: 'lighthouse', radius: 100, text: 'Outrun them all — reach the Lighthouse' }
      ]
    }
  ];

  function missionTarget(state, step) {
    if (!step) return null;
    var lm = state.city.landmarks[step.target];
    if (lm) return { x: lm.x, y: lm.y, label: lm.label };
    return null;
  }

  function currentStep(state) {
    var m = state.mission;
    if (!m.active) return null;
    var def = MISSIONS[m.index];
    if (!def) return null;
    return def.steps[m.step] || null;
  }

  function startMission(state, index) {
    var def = MISSIONS[index];
    if (!def) return false;
    state.mission.active = true;
    state.mission.index = index;
    state.mission.step = 0;
    state.mission.waitTimer = 0;
    state.wanted = def.wantedAtStart || 0;
    state.wantedTimer = 0;
    state.message = def.title + ' — ' + def.giver;
    state.messageTimer = 4;
    state.dialogue = def.brief.slice();
    state.dialogueTimer = 0;
    return true;
  }

  function nextMissionIndex(state) {
    for (var i = 0; i < MISSIONS.length; i++) {
      if (state.mission.completed.indexOf(MISSIONS[i].id) < 0) return i;
    }
    return -1;
  }

  function updateMission(state, dt) {
    var m = state.mission;
    if (!m.active) return;
    var def = MISSIONS[m.index];
    if (!def) { m.active = false; return; }
    var step = def.steps[m.step];
    if (!step) { m.active = false; return; }
    var p = state.player;

    if (step.type === 'steal') {
      // Complete once the player is driving the mission sports car.
      if (!p.onFoot && p.car && p.car.kind === 'mission') {
        advance(state, step);
      }
      return;
    }

    var t = missionTarget(state, step);
    if (!t) { advance(state, step); return; }
    var d = S.Entities.dist(p, t);

    if (step.type === 'wait') {
      if (d <= step.radius) {
        m.waitTimer += dt;
        if (m.waitTimer >= (step.seconds || 5)) {
          if (step.wantedAfter !== undefined) {
            state.wanted = step.wantedAfter;
            state.wantedTimer = 0;
          }
          advance(state, step);
        }
      } else {
        m.waitTimer = 0;
      }
      return;
    }

    // goto | pickup | deliver | escape
    if (d <= step.radius) {
      if (step.wantedAfter !== undefined) {
        state.wanted = step.wantedAfter;
        state.wantedTimer = 0;
      }
      if (step.type === 'pickup') {
        state.message = step.text + ' — got it!';
        state.messageTimer = 2;
      }
      advance(state, step);
    }
  }

  function advance(state, step) {
    var m = state.mission;
    var def = MISSIONS[m.index];
    m.step++;
    m.waitTimer = 0;
    if (m.step >= def.steps.length) {
      // Mission complete.
      state.money += def.reward;
      m.completed.push(def.id);
      m.active = false;
      m.step = 0;
      state.message = 'Mission complete: ' + def.title + '  +$' + def.reward;
      state.messageTimer = 4;
      state.dialogue = ['Rico: Nice work. $' + def.reward + ' is yours.'];
      if (m.completed.length >= MISSIONS.length) {
        state.won = true;
        state.message = 'KING OF SOLMAR! You finished all 8 missions. $' + state.money + ' earned.';
        state.messageTimer = 8;
      }
    }
  }

  S.Missions = {
    MISSIONS: MISSIONS,
    missionTarget: missionTarget,
    currentStep: currentStep,
    startMission: startMission,
    nextMissionIndex: nextMissionIndex,
    updateMission: updateMission
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
