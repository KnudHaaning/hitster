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
  const newState = { ...state, currentIndex: currentIndex + 1, currentTrack: track };
  return { track, newState };
}

function mergeTimeline(team) {
  return [...team.banked, ...team.atRisk].sort((a, b) => Number(a.year) - Number(b.year));
}

function isCorrectPlacement(timeline, slotIndex, year) {
  const y = Number(year);
  const left = slotIndex === 0 ? -Infinity : Number(timeline[slotIndex - 1].year);
  const right = slotIndex >= timeline.length ? Infinity : Number(timeline[slotIndex].year);
  return y >= left && y <= right;
}

function applyReveal(state) {
  const team = state.teams[state.activeTeam];
  const timeline = mergeTimeline(team);
  const correct = isCorrectPlacement(timeline, state.selectedSlot, state.currentTrack.year);

  const newTeams = state.teams.map((t, i) => {
    if (i !== state.activeTeam) return t;
    return correct
      ? { ...t, atRisk: [...t.atRisk, state.currentTrack] }
      : { ...t, atRisk: [] };
  });

  return {
    ...state,
    teams: newTeams,
    phase: correct ? 'revealed-correct' : 'revealed-wrong',
  };
}

function applyLock(state) {
  const newTeams = state.teams.map((t, i) => {
    if (i !== state.activeTeam) return t;
    return { ...t, banked: [...t.banked, ...t.atRisk], atRisk: [] };
  });
  const wonTeam = newTeams[state.activeTeam];
  const isWin = wonTeam.banked.length >= state.targetScore;

  return {
    ...state,
    teams: newTeams,
    activeTeam: isWin ? state.activeTeam : 1 - state.activeTeam,
    phase: isWin ? 'gameover' : 'idle',
    winner: isWin ? state.activeTeam : null,
    selectedSlot: null,
    currentTrack: null,
  };
}

function applyPlayNext(state) {
  const { track, newState } = drawNextTrack(state);
  return {
    ...newState,
    selectedSlot: null,
    phase: 'placing',
  };
}

// ─── State management ─────────────────────────────────────────────────────

const STATE_KEY = 'hitster_state';

function buildInitialState(tracks, targetScore = 10) {
  const shuffled = shuffleArray(tracks);
  return {
    shuffled,
    currentIndex: 2,
    currentTrack: null,
    selectedSlot: null,
    teams: [
      { name: 'Team 1', banked: shuffled[0] ? [shuffled[0]] : [], atRisk: [] },
      { name: 'Team 2', banked: shuffled[1] ? [shuffled[1]] : [], atRisk: [] },
    ],
    activeTeam: 0,
    targetScore,
    phase: 'idle',
    winner: null,
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
  module.exports = { shuffleArray, drawNextTrack, mergeTimeline, isCorrectPlacement, applyReveal, applyLock, applyPlayNext, buildInitialState, saveState, loadState };
}
