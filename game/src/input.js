// Keyboard + mouse input with edge detection (pressed this frame).
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const codeOf = (e) => e.code;

  const onKeyDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  };
  const onMouseDown = (e) => { onMouseMove(e); mouse.down = true; mouse.clicked = true; };
  const onMouseUp = () => { mouse.down = false; };
  const onBlur = () => { keys.clear(); mouse.down = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys, mouse,
    down(...codes) { return codes.some((c) => keys.has(c)); },
    pressed(...codes) { return codes.some((c) => pressed.has(c)); },
    // True when the last click landed inside the given screen rectangle.
    wasClicked(x, y, w, h) {
      return mouse.clicked && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
    },
    axis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    // Call once per frame after the game has read input.
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
