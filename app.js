// ─── Pure functions (exported for testing) ────────────────────────────────

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getNextTrack(state) {
  const { shuffled, currentIndex } = state;
  if (currentIndex >= shuffled.length) {
    return { track: null, newState: state };
  }
  const track = shuffled[currentIndex];
  const newState = { ...state, currentIndex: currentIndex + 1, currentTrack: track, revealed: false };
  return { track, newState };
}

// ─── State management ─────────────────────────────────────────────────────

const STATE_KEY = 'hitster_state';

function buildInitialState(tracks) {
  return {
    shuffled: shuffleArray(tracks),
    currentIndex: 0,
    currentTrack: null,
    revealed: false,
  };
}

function saveState(state) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = sessionStorage.getItem(STATE_KEY);
  return raw ? JSON.parse(raw) : null;
}

if (typeof module !== 'undefined') {
  module.exports = { shuffleArray, getNextTrack, buildInitialState, saveState, loadState };
}
