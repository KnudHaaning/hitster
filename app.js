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

  const lossCount = correct ? 0 : team.atRisk.length;

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
    lossCount,
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
  if (state.currentIndex >= state.shuffled.length) {
    return state;
  }
  const { newState } = drawNextTrack(state);
  return {
    ...newState,
    selectedSlot: null,
    phase: 'placing',
  };
}

function applyPassTurn(state) {
  return {
    ...state,
    activeTeam: 1 - state.activeTeam,
    phase: 'idle',
    selectedSlot: null,
    currentTrack: null,
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

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function playTrack(track) {
  window.location.href = track.uri;
}

const esc = s => String(s ?? '').replace(/[<>&]/g, '');

function renderTimeline(timelineCards, selectedSlot, phase) {
  const strip = document.getElementById('timeline-strip');
  strip.innerHTML = '';
  strip.className = 'timeline-strip' + (phase === 'placing' ? ' placing' : '');

  const interactable = phase === 'placing';

  for (let i = 0; i <= timelineCards.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (selectedSlot === i ? ' target' : '');
    slot.dataset.slotIndex = String(i);
    slot.textContent = '+';
    if (!interactable) slot.style.cursor = 'default';
    strip.appendChild(slot);

    if (i < timelineCards.length) {
      const card = timelineCards[i];
      const classes = ['card-chip'];
      if (card._atRisk) classes.push('at-risk');
      if (card._justAdded) classes.push('just-added');
      const chip = document.createElement('div');
      chip.className = classes.join(' ');
      chip.innerHTML =
        `<div class="yr-badge">${esc(card.year)}</div>` +
        `<div class="ti">${esc(card.title)}</div>` +
        `<div class="ar">${esc(card.artist)}</div>`;
      strip.appendChild(chip);
    }
  }
}

function renderPlayArea(state) {
  const area = document.getElementById('play-area');
  area.innerHTML = '';

  if (state.phase === 'idle') {
    const icon = document.createElement('div');
    icon.className = 'idle-icon';
    icon.textContent = '🎵';
    area.appendChild(icon);
    return;
  }

  if (state.phase === 'placing') {
    const card = document.createElement('div');
    card.className = 'mystery-card';
    card.innerHTML = '▶ MYSTERY SONG<span class="sub">TAP A + SLOT TO PLACE</span>';
    area.appendChild(card);
    return;
  }

  if (state.phase === 'revealed-correct' || state.phase === 'revealed-wrong') {
    const t = state.currentTrack;
    const card = document.createElement('div');
    card.className = 'revealed-card' + (state.phase === 'revealed-wrong' ? ' wrong' : '');
    card.innerHTML =
      `<div class="yr-badge">${esc(t.year)}</div>` +
      `<div class="title">${esc(t.title)}</div>` +
      `<div class="artist">${esc(t.artist)}</div>`;
    if (state.phase === 'revealed-wrong' && state.lossCount > 0) {
      const msg = document.createElement('div');
      msg.className = 'loss-msg';
      msg.textContent = `Lost ${state.lossCount} card${state.lossCount === 1 ? '' : 's'}`;
      card.appendChild(msg);
    }
    area.appendChild(card);
  }
}

function renderButtons(state) {
  const stack = document.getElementById('button-stack');
  stack.innerHTML = '';

  const make = (id, label, kind = 'primary', disabled = false) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'btn btn-' + kind;
    btn.textContent = label;
    if (disabled) btn.disabled = true;
    return btn;
  };

  if (state.phase === 'idle') {
    stack.appendChild(make('btn-play', '▶ Play Song'));
  } else if (state.phase === 'placing') {
    stack.appendChild(make('btn-reveal', 'Reveal & Score', 'primary', state.selectedSlot === null));
  } else if (state.phase === 'revealed-correct') {
    const atRiskCount = state.teams[state.activeTeam].atRisk.length;
    stack.appendChild(make('btn-lock', `🔒 Lock Turn (banks ${atRiskCount})`));
    stack.appendChild(make('btn-play-next', '▶ Play Next Song', 'secondary'));
  } else if (state.phase === 'revealed-wrong') {
    const otherName = state.teams[1 - state.activeTeam].name;
    stack.appendChild(make('btn-pass', `Pass to ${otherName}`));
  }
}

function render(state) {
  if (state.phase === 'gameover') {
    showScreen('screen-winner');
    document.getElementById('winner-headline').textContent =
      `🎉 ${state.teams[state.winner].name} wins!`;
    document.getElementById('winner-scores').textContent =
      `${state.teams[0].name}: ${state.teams[0].banked.length} · ${state.teams[1].name}: ${state.teams[1].banked.length}`;
    return;
  }

  if (state.currentIndex >= state.shuffled.length && state.phase === 'idle') {
    showScreen('screen-deck-empty');
    const a = state.teams[0].banked.length;
    const b = state.teams[1].banked.length;
    const msg = a === b ? 'Draw' : `${state.teams[a > b ? 0 : 1].name} wins`;
    document.getElementById('deck-empty-result').textContent =
      `${state.teams[0].name}: ${a} · ${state.teams[1].name}: ${b} — ${msg}`;
    return;
  }

  showScreen('screen-game');

  const active = state.teams[state.activeTeam];
  const inactive = state.teams[1 - state.activeTeam];
  const inactiveIdx = 1 - state.activeTeam;

  // Make team color cascade through the whole game screen.
  const gameScreen = document.getElementById('screen-game');
  gameScreen.classList.remove('team-0', 'team-1');
  gameScreen.classList.add('team-' + state.activeTeam);

  document.getElementById('turn-indicator').innerHTML =
    `Turn: <strong class="team-${state.activeTeam}-name">${esc(active.name)}</strong>`;

  const chip = document.getElementById('inactive-team-chip');
  chip.className = 'team-chip team-' + inactiveIdx;
  chip.innerHTML =
    `<span>${esc(inactive.name)}</span>` +
    `<span class="score">${inactive.banked.length} / ${state.targetScore}</span>`;

  document.getElementById('active-team-name').textContent = active.name;
  const atRiskN = active.atRisk.length;
  document.getElementById('active-team-score').innerHTML =
    `${active.banked.length} / ${state.targetScore}` +
    (atRiskN > 0 ? `<span class="at-risk-count">${atRiskN} AT RISK</span>` : '');

  const merged = mergeTimeline(active);
  const justAddedUri = state.phase === 'revealed-correct' && state.currentTrack
    ? state.currentTrack.uri : null;
  const taggedMerged = merged.map(card => ({
    ...card,
    _atRisk: active.atRisk.some(r => r.uri === card.uri),
    _justAdded: card.uri === justAddedUri,
  }));
  renderTimeline(taggedMerged, state.selectedSlot, state.phase);
  renderPlayArea(state);
  renderButtons(state);
}

function flashScreen(color) {
  const overlay = document.getElementById('flash-overlay');
  if (!overlay) return;
  overlay.className = 'flash-overlay';
  // Force a reflow so the next class re-triggers the animation
  void overlay.offsetWidth;
  overlay.classList.add('flash-' + color);
}

function init() {
  const loaded = loadState();
  let state = (loaded && Array.isArray(loaded.teams)) ? loaded : buildInitialState(TRACKS);
  saveState(state);
  render(state);

  function startNewGame() {
    localStorage.removeItem(STATE_KEY);
    state = buildInitialState(TRACKS);
    saveState(state);
    render(state);
  }
  document.getElementById('btn-new-game').addEventListener('click', startNewGame);
  document.getElementById('btn-new-game-winner').addEventListener('click', startNewGame);
  document.getElementById('btn-new-game-deck').addEventListener('click', startNewGame);

  document.getElementById('screen-game').addEventListener('click', e => {
    const target = e.target.closest('[data-slot-index], .btn');
    if (!target) return;

    // Slot taps
    if (target.dataset.slotIndex !== undefined && state.phase === 'placing') {
      state = { ...state, selectedSlot: Number(target.dataset.slotIndex) };
      saveState(state);
      render(state);
      return;
    }

    // Button taps
    switch (target.id) {
      case 'btn-play': {
        const { track, newState } = drawNextTrack(state);
        if (!track) {
          state = { ...newState, phase: 'idle' };
          saveState(state);
          render(state);
          return;
        }
        state = { ...newState, phase: 'placing', selectedSlot: null };
        saveState(state);
        playTrack(track);
        render(state);
        break;
      }
      case 'btn-reveal': {
        if (state.selectedSlot === null) return;
        state = applyReveal(state);
        saveState(state);
        render(state);
        flashScreen(state.phase === 'revealed-correct' ? 'green' : 'red');
        break;
      }
      case 'btn-lock': {
        state = applyLock(state);
        saveState(state);
        render(state);
        break;
      }
      case 'btn-play-next': {
        if (state.currentIndex >= state.shuffled.length) {
          // Deck ran out mid press-your-luck. Auto-lock the at-risk cards
          // since the team didn't fail — they just hit deck exhaustion.
          state = applyLock(state);
          saveState(state);
          render(state);
          return;
        }
        const trackToPlay = state.shuffled[state.currentIndex];
        state = applyPlayNext(state);
        saveState(state);
        playTrack(trackToPlay);
        render(state);
        break;
      }
      case 'btn-pass': {
        state = applyPassTurn(state);
        saveState(state);
        render(state);
        break;
      }
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

if (typeof module !== 'undefined') {
  module.exports = {
    shuffleArray,
    drawNextTrack,
    buildInitialState,
    mergeTimeline,
    isCorrectPlacement,
    applyReveal,
    applyLock,
    applyPlayNext,
    applyPassTurn,
    saveState,
    loadState,
  };
}
