// SOLMAR BAY — save / load through localStorage. Keeps money, the mission
// chain progress, and the best score. Never throws: private windows and
// disabled storage just mean the save lasts this visit only.
const SAVE_KEY = 'solmar-bay-save-v1';
const BEST_KEY = 'solmar-bay-best-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      money: typeof data.money === 'number' ? data.money : 250,
      missionsDone: typeof data.missionsDone === 'number' ? data.missionsDone : 0,
      best: typeof data.best === 'number' ? data.best : 0,
    };
  } catch { return null; }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: Math.round(state.money),
      missionsDone: state.missionsDone,
      best: state.best,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}

export function loadBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
export function writeBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* noop */ }
}
