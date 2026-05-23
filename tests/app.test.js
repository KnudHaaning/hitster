const { shuffleArray, drawNextTrack } = require('../app.js');

describe('shuffleArray', () => {
  test('returns all original elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffleArray([...arr]);
    expect(result).toHaveLength(arr.length);
    expect([...result].sort((a, b) => a - b)).toEqual(arr);
  });

  test('does not mutate the input array', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(copy);
  });
});

describe('drawNextTrack', () => {
  const tracks = [
    { uri: 'spotify:track:A', title: 'Song A', artist: 'Artist A', year: '1990' },
    { uri: 'spotify:track:B', title: 'Song B', artist: 'Artist B', year: '2000' },
  ];

  test('returns track at currentIndex', () => {
    const state = { shuffled: tracks, currentIndex: 0, currentTrack: null };
    const { track, newState } = drawNextTrack(state);
    expect(track).toEqual(tracks[0]);
    expect(newState.currentIndex).toBe(1);
    expect(newState.currentTrack).toEqual(tracks[0]);
  });

  test('returns null when all tracks are played', () => {
    const state = { shuffled: tracks, currentIndex: 2, currentTrack: null };
    const { track, newState } = drawNextTrack(state);
    expect(track).toBeNull();
    expect(newState.currentIndex).toBe(2);
  });
});

const { buildInitialState, saveState, loadState } = require('../app.js');

describe('buildInitialState', () => {
  const tracks = [
    { uri: 'a', title: 'A', artist: 'X', year: '1990' },
    { uri: 'b', title: 'B', artist: 'Y', year: '2000' },
    { uri: 'c', title: 'C', artist: 'Z', year: '2010' },
    { uri: 'd', title: 'D', artist: 'W', year: '2020' },
  ];

  test('shuffles the deck and consumes two seed cards', () => {
    const state = buildInitialState(tracks);
    expect(state.shuffled).toHaveLength(4);
    expect(state.currentIndex).toBe(2);
  });

  test('gives each team one banked seed card and no at-risk cards', () => {
    const state = buildInitialState(tracks);
    expect(state.teams).toHaveLength(2);
    expect(state.teams[0].name).toBe('Team 1');
    expect(state.teams[1].name).toBe('Team 2');
    expect(state.teams[0].banked).toHaveLength(1);
    expect(state.teams[1].banked).toHaveLength(1);
    expect(state.teams[0].atRisk).toEqual([]);
    expect(state.teams[1].atRisk).toEqual([]);
  });

  test('sets default phase, target, and active team', () => {
    const state = buildInitialState(tracks);
    expect(state.phase).toBe('idle');
    expect(state.activeTeam).toBe(0);
    expect(state.targetScore).toBe(10);
    expect(state.currentTrack).toBeNull();
    expect(state.selectedSlot).toBeNull();
    expect(state.winner).toBeNull();
  });

  test('accepts a custom targetScore', () => {
    const state = buildInitialState(tracks, 5);
    expect(state.targetScore).toBe(5);
  });
});

describe('saveState / loadState', () => {
  beforeEach(() => {
    global.localStorage = (() => {
      let store = {};
      return {
        getItem: k => store[k] ?? null,
        setItem: (k, v) => { store[k] = v; },
        removeItem: k => { delete store[k]; },
        clear: () => { store = {}; },
      };
    })();
  });

  test('round-trips state through localStorage', () => {
    const state = { shuffled: [{ uri: 'a' }], currentIndex: 1 };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  test('loadState returns null when nothing saved', () => {
    localStorage.clear();
    expect(loadState()).toBeNull();
  });
});

const { mergeTimeline } = require('../app.js');

describe('mergeTimeline', () => {
  test('returns banked + atRisk sorted by year ascending', () => {
    const team = {
      banked: [{ year: '1995' }, { year: '1980' }],
      atRisk: [{ year: '2005' }, { year: '1988' }],
    };
    const result = mergeTimeline(team);
    expect(result.map(t => t.year)).toEqual(['1980', '1988', '1995', '2005']);
  });

  test('handles empty banked', () => {
    const team = { banked: [], atRisk: [{ year: '2000' }] };
    expect(mergeTimeline(team)).toEqual([{ year: '2000' }]);
  });

  test('handles empty atRisk', () => {
    const team = { banked: [{ year: '1970' }], atRisk: [] };
    expect(mergeTimeline(team)).toEqual([{ year: '1970' }]);
  });

  test('handles fully empty team', () => {
    expect(mergeTimeline({ banked: [], atRisk: [] })).toEqual([]);
  });

  test('does not mutate input arrays', () => {
    const banked = [{ year: '2000' }];
    const atRisk = [{ year: '1990' }];
    mergeTimeline({ banked, atRisk });
    expect(banked).toEqual([{ year: '2000' }]);
    expect(atRisk).toEqual([{ year: '1990' }]);
  });
});

const { isCorrectPlacement } = require('../app.js');

describe('isCorrectPlacement', () => {
  const tl = [{ year: '1980' }, { year: '1995' }, { year: '2010' }];

  test('empty timeline: slot 0 is always correct', () => {
    expect(isCorrectPlacement([], 0, '1990')).toBe(true);
  });

  test('slot before first card: correct when year <= first', () => {
    expect(isCorrectPlacement(tl, 0, '1970')).toBe(true);
    expect(isCorrectPlacement(tl, 0, '1980')).toBe(true);
    expect(isCorrectPlacement(tl, 0, '1985')).toBe(false);
  });

  test('slot after last card: correct when year >= last', () => {
    expect(isCorrectPlacement(tl, 3, '2020')).toBe(true);
    expect(isCorrectPlacement(tl, 3, '2010')).toBe(true);
    expect(isCorrectPlacement(tl, 3, '2005')).toBe(false);
  });

  test('middle slot: correct when between bordering years', () => {
    expect(isCorrectPlacement(tl, 1, '1985')).toBe(true);
    expect(isCorrectPlacement(tl, 1, '1980')).toBe(true);
    expect(isCorrectPlacement(tl, 1, '1995')).toBe(true);
    expect(isCorrectPlacement(tl, 1, '1979')).toBe(false);
    expect(isCorrectPlacement(tl, 1, '1996')).toBe(false);
  });

  test('handles string years like real track data', () => {
    expect(isCorrectPlacement(tl, 2, '2000')).toBe(true);
  });
});

const { applyReveal } = require('../app.js');

describe('applyReveal', () => {
  const baseState = () => ({
    shuffled: [],
    currentIndex: 5,
    currentTrack: { uri: 'x', title: 'X', artist: 'Y', year: '1990' },
    selectedSlot: 1,
    teams: [
      { name: 'Team 1', banked: [{ year: '1980' }, { year: '2000' }], atRisk: [] },
      { name: 'Team 2', banked: [{ year: '1985' }], atRisk: [] },
    ],
    activeTeam: 0,
    targetScore: 10,
    phase: 'placing',
    winner: null,
  });

  test('correct placement: pushes track to atRisk and sets phase to revealed-correct', () => {
    const state = baseState();
    const result = applyReveal(state);
    expect(result.phase).toBe('revealed-correct');
    expect(result.teams[0].atRisk).toEqual([state.currentTrack]);
    expect(result.teams[0].banked).toEqual(state.teams[0].banked);
    expect(result.currentTrack).toEqual(state.currentTrack);
    expect(result.lossCount).toBe(0);
  });

  test('wrong placement: clears atRisk and sets phase to revealed-wrong', () => {
    const state = baseState();
    state.teams[0].atRisk = [{ year: '1992' }, { year: '1996' }];
    state.currentTrack.year = '2050';
    const result = applyReveal(state);
    expect(result.phase).toBe('revealed-wrong');
    expect(result.teams[0].atRisk).toEqual([]);
    expect(result.teams[0].banked).toEqual(state.teams[0].banked);
    expect(result.lossCount).toBe(2);
  });

  test('lossCount is 0 when wrong placement happens with no prior at-risk cards', () => {
    const state = baseState();
    state.currentTrack.year = '2050';   // out of bounds
    // state.teams[0].atRisk is already [] from baseState
    const result = applyReveal(state);
    expect(result.phase).toBe('revealed-wrong');
    expect(result.lossCount).toBe(0);
  });

  test('uses merged timeline (banked + atRisk) for correctness check', () => {
    const state = baseState();
    state.teams[0].atRisk = [{ year: '1995' }];
    state.currentTrack.year = '1990';
    state.selectedSlot = 1;
    const result = applyReveal(state);
    expect(result.phase).toBe('revealed-correct');
    expect(result.teams[0].atRisk).toHaveLength(2);
  });

  test('does not mutate the input state', () => {
    const state = baseState();
    const beforeAtRisk = [...state.teams[0].atRisk];
    applyReveal(state);
    expect(state.teams[0].atRisk).toEqual(beforeAtRisk);
    expect(state.phase).toBe('placing');
  });
});

const { applyLock } = require('../app.js');

describe('applyLock', () => {
  const baseState = () => ({
    shuffled: [],
    currentIndex: 5,
    currentTrack: { year: '1990' },
    selectedSlot: 1,
    teams: [
      { name: 'Team 1', banked: [{ year: '1980' }], atRisk: [{ year: '1990' }, { year: '1995' }] },
      { name: 'Team 2', banked: [{ year: '1985' }], atRisk: [] },
    ],
    activeTeam: 0,
    targetScore: 10,
    phase: 'revealed-correct',
    winner: null,
  });

  test('moves atRisk into banked and clears atRisk', () => {
    const result = applyLock(baseState());
    expect(result.teams[0].banked).toHaveLength(3);
    expect(result.teams[0].atRisk).toEqual([]);
  });

  test('advances turn and resets phase + selectedSlot + currentTrack', () => {
    const result = applyLock(baseState());
    expect(result.activeTeam).toBe(1);
    expect(result.phase).toBe('idle');
    expect(result.selectedSlot).toBeNull();
    expect(result.currentTrack).toBeNull();
  });

  test('triggers win when banked count reaches targetScore', () => {
    const state = baseState();
    state.targetScore = 3;
    const result = applyLock(state);
    expect(result.phase).toBe('gameover');
    expect(result.winner).toBe(0);
    expect(result.activeTeam).toBe(0);
  });

  test('does not mutate the input state', () => {
    const state = baseState();
    const beforeBanked = [...state.teams[0].banked];
    applyLock(state);
    expect(state.teams[0].banked).toEqual(beforeBanked);
    expect(state.phase).toBe('revealed-correct');
  });
});

const { applyPlayNext } = require('../app.js');

describe('applyPlayNext', () => {
  const baseState = () => ({
    shuffled: [
      { uri: 'a', year: '1980' },
      { uri: 'b', year: '1990' },
      { uri: 'c', year: '2000' },
      { uri: 'd', year: '2010' },
    ],
    currentIndex: 2,
    currentTrack: { uri: 'b', year: '1990' },
    selectedSlot: 0,
    teams: [
      { name: 'Team 1', banked: [{ year: '1980' }], atRisk: [{ year: '1990' }] },
      { name: 'Team 2', banked: [], atRisk: [] },
    ],
    activeTeam: 0,
    targetScore: 10,
    phase: 'revealed-correct',
    winner: null,
  });

  test('draws the next track and increments currentIndex', () => {
    const result = applyPlayNext(baseState());
    expect(result.currentTrack).toEqual({ uri: 'c', year: '2000' });
    expect(result.currentIndex).toBe(3);
  });

  test('resets selectedSlot and sets phase to placing', () => {
    const result = applyPlayNext(baseState());
    expect(result.selectedSlot).toBeNull();
    expect(result.phase).toBe('placing');
  });

  test('keeps at-risk cards on the active team', () => {
    const result = applyPlayNext(baseState());
    expect(result.teams[0].atRisk).toEqual([{ year: '1990' }]);
  });

  test('keeps activeTeam unchanged', () => {
    const result = applyPlayNext(baseState());
    expect(result.activeTeam).toBe(0);
  });

  test('returns state unchanged when deck is empty', () => {
    const state = baseState();
    state.currentIndex = state.shuffled.length;
    const result = applyPlayNext(state);
    expect(result).toEqual(state);
  });
});

const { applyPassTurn } = require('../app.js');

describe('applyPassTurn', () => {
  const baseState = () => ({
    shuffled: [],
    currentIndex: 5,
    currentTrack: { uri: 'x', year: '2050' },
    selectedSlot: 1,
    teams: [
      { name: 'Team 1', banked: [{ year: '1980' }], atRisk: [] },
      { name: 'Team 2', banked: [{ year: '1985' }], atRisk: [] },
    ],
    activeTeam: 0,
    targetScore: 10,
    phase: 'revealed-wrong',
    winner: null,
  });

  test('switches the active team', () => {
    const result = applyPassTurn(baseState());
    expect(result.activeTeam).toBe(1);
  });

  test('resets phase to idle, clears selectedSlot and currentTrack', () => {
    const result = applyPassTurn(baseState());
    expect(result.phase).toBe('idle');
    expect(result.selectedSlot).toBeNull();
    expect(result.currentTrack).toBeNull();
  });

  test('leaves team banked + atRisk untouched (already cleared on wrong reveal)', () => {
    const state = baseState();
    const result = applyPassTurn(state);
    expect(result.teams[0].banked).toEqual(state.teams[0].banked);
    expect(result.teams[1].banked).toEqual(state.teams[1].banked);
  });
});
