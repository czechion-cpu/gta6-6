// SOLMAR BAY — keyboard + mouse input. Held keys are read every frame;
// one-shot presses (enter car, shoot, pause, mission, reload, mute) are
// queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;
export const ACTION_RELOAD = 32;
export const ACTION_HORN = 128;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) { held[name] = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'KeyH') actions |= ACTION_HORN;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_SHOOT;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    held,
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const t = actions; actions = 0; return t; },
    // Test / staging helper: pretend a key is held.
    setHeld(name, value) { if (name in held) held[name] = value; },
    press(action) { actions |= action; },
  };
}
