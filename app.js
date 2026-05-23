// ─── Pure functions (exported for testing) ────────────────────────────────

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function drawNextTrack(state) {
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
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STATE_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ─── UI ───────────────────────────────────────────────────────────────────

function render(state) {
  const total = state.shuffled.length;
  const played = state.currentIndex;

  document.getElementById('counter').textContent = `${played} / ${total}`;

  const revealArea = document.getElementById('reveal-area');
  const idleIcon = document.getElementById('idle-icon');
  const btnPlay = document.getElementById('btn-play');
  const btnReveal = document.getElementById('btn-reveal');

  if (state.revealed && state.currentTrack) {
    revealArea.classList.remove('hidden');
    idleIcon.classList.add('hidden');
    document.getElementById('year-badge').textContent = state.currentTrack.year;
    document.getElementById('song-title').textContent = state.currentTrack.title;
    document.getElementById('song-artist').textContent = state.currentTrack.artist;
    btnPlay.textContent = '▶ Next Song';
    btnReveal.disabled = true;
  } else if (state.currentTrack) {
    revealArea.classList.add('hidden');
    idleIcon.classList.remove('hidden');
    btnPlay.textContent = '▶ Next Song';
    btnReveal.disabled = false;
  } else {
    revealArea.classList.add('hidden');
    idleIcon.classList.remove('hidden');
    btnPlay.textContent = '▶ Play Song';
    btnReveal.disabled = true;
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function playTrack(track) {
  window.location.href = track.uri;
}

function init() {
  let state = loadState() || buildInitialState(TRACKS);
  saveState(state);
  render(state);

  document.getElementById('btn-play').addEventListener('click', () => {
    const { track, newState } = drawNextTrack(state);
    if (!track) {
      showScreen('screen-complete');
      return;
    }
    state = newState;
    saveState(state);
    playTrack(track);
    render(state);
  });

  document.getElementById('btn-reveal').addEventListener('click', () => {
    if (!state.currentTrack || state.revealed) return;
    state = { ...state, revealed: true };
    saveState(state);
    render(state);
  });

  document.getElementById('btn-new-session').addEventListener('click', () => {
    localStorage.removeItem(STATE_KEY);
    state = buildInitialState(TRACKS);
    saveState(state);
    showScreen('screen-game');
    render(state);
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    localStorage.removeItem(STATE_KEY);
    state = buildInitialState(TRACKS);
    saveState(state);
    render(state);
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

if (typeof module !== 'undefined') {
  module.exports = { shuffleArray, drawNextTrack, buildInitialState, saveState, loadState };
}
