const { shuffleArray, getNextTrack } = require('../app.js');

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

describe('getNextTrack', () => {
  const tracks = [
    { uri: 'spotify:track:A', title: 'Song A', artist: 'Artist A', year: '1990' },
    { uri: 'spotify:track:B', title: 'Song B', artist: 'Artist B', year: '2000' },
  ];

  test('returns track at currentIndex', () => {
    const state = { shuffled: tracks, currentIndex: 0, currentTrack: null, revealed: false };
    const { track, newState } = getNextTrack(state);
    expect(track).toEqual(tracks[0]);
    expect(newState.currentIndex).toBe(1);
    expect(newState.currentTrack).toEqual(tracks[0]);
    expect(newState.revealed).toBe(false);
  });

  test('returns null when all tracks are played', () => {
    const state = { shuffled: tracks, currentIndex: 2, currentTrack: null, revealed: false };
    const { track, newState } = getNextTrack(state);
    expect(track).toBeNull();
    expect(newState.currentIndex).toBe(2);
  });
});

const { buildInitialState, saveState, loadState } = require('../app.js');

describe('buildInitialState', () => {
  test('shuffles tracks and sets currentIndex to 0', () => {
    const tracks = [
      { uri: 'a', title: 'A', artist: 'X', year: '1990' },
      { uri: 'b', title: 'B', artist: 'Y', year: '2000' },
    ];
    const state = buildInitialState(tracks);
    expect(state.shuffled).toHaveLength(2);
    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack).toBeNull();
    expect(state.revealed).toBe(false);
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
