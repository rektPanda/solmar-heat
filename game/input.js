// Solmar Heat — keyboard input (browser only).
(function () {
  var S = (globalThis.Solmar = globalThis.Solmar || {});
  var keys = {};
  var actionQueued = false;
  var missionQueued = false;
  var autopilotQueued = false;

  function isDown(code) {
    return !!keys[code];
  }

  function read() {
    return {
      up: isDown('KeyW') || isDown('ArrowUp'),
      down: isDown('KeyS') || isDown('ArrowDown'),
      left: isDown('KeyA') || isDown('ArrowLeft'),
      right: isDown('KeyD') || isDown('ArrowRight'),
      run: isDown('ShiftLeft') || isDown('ShiftRight'),
      actionPressed: actionQueued,
      missionPressed: missionQueued,
      autopilotPressed: autopilotQueued
    };
  }

  function clearQueued() {
    actionQueued = false;
    missionQueued = false;
    autopilotQueued = false;
  }

  function attach() {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
      if (e.code === 'Space' && !e.repeat) actionQueued = true;
      if (e.code === 'Enter' && !e.repeat) missionQueued = true;
      if (e.code === 'KeyP' && !e.repeat) autopilotQueued = true;
      keys[e.code] = true;
    });
    document.addEventListener('keyup', function (e) {
      keys[e.code] = false;
    });
    window.addEventListener('blur', function () {
      keys = {};
    });
  }

  S.Input = { read: read, clearQueued: clearQueued, attach: attach };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
