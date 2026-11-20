// Keyboard + mouse state. One "clicked" edge per frame: whoever reads it
// first consumes it (dialogue and menus read before shooting does, so a
// click that advances dialogue never also fires the pistol).
export function makeInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, released: true };
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };
  const up = (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousemove', pos);
  canvas.addEventListener('mousedown', (e) => {
    pos(e);
    if (!mouse.down) mouse.clicked = true;
    mouse.down = true;
    mouse.released = false;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
    mouse.released = true;
  });
  return {
    keys,
    mouse,
    isDown(k) {
      return keys.has(k);
    },
    // Axis helpers for on-foot movement: returns {x, y} in screen space.
    moveAxis() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    // True once for a fresh click inside the rect (canvas coords); consumes it.
    wasClicked(x, y, w, h) {
      if (!mouse.clicked) return false;
      if (mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h) {
        mouse.clicked = false;
        return true;
      }
      return false;
    },
    // True once for any fresh click anywhere; consumes it.
    takeClick() {
      if (!mouse.clicked) return false;
      mouse.clicked = false;
      return true;
    },
    endFrame() {
      mouse.clicked = false;
    },
  };
}
