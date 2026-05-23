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
