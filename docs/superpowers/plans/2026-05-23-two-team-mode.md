# Two-Team Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-player loop with a two-team competitive game: each team builds its own timeline, places a mystery song between existing cards, and chooses to lock the turn or press their luck after a correct placement. Wrong placements discard all at-risk cards from that turn.

**Architecture:** Phase-driven UI in vanilla JS (`idle` → `placing` → `revealed-correct` | `revealed-wrong` → next). All game logic lives in pure functions exported from `app.js` and unit-tested with Jest. Persistence moves from `sessionStorage` → `localStorage` so accidental tab closes don't kill a session.

**Tech Stack:** HTML + CSS + vanilla JS, Jest (Node `testEnvironment`).

**Spec:** [docs/superpowers/specs/2026-05-23-two-team-mode-design.md](../specs/2026-05-23-two-team-mode-design.md)

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `app.js` | Modify (heavy) | All game state + pure functions + render + event wiring |
| `index.html` | Modify (heavy) | Phase-agnostic skeleton; dynamic content rendered by `render(state)` |
| `style.css` | Modify (additive mostly) | Team chips, timeline strip, card chip variants, slot styles, mystery card |
| `tracks.js` | **Untouched** | Static playlist data |
| `tests/app.test.js` | Modify (extend) | Cover all new pure functions; update existing tests to new storage / draw API |

No new files are created.

---

### Task 1: Switch storage from `sessionStorage` to `localStorage`

**Why first:** All other tests and code touch storage. Make this trivial change foundational so later tasks build on the right primitive.

**Files:**
- Modify: `app.js:35-42`
- Modify: `tests/app.test.js:58-82`

- [ ] **Step 1: Update the storage test to expect `localStorage`**

Replace the `saveState / loadState` block in `tests/app.test.js` (lines 58–82) with:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "saveState"`
Expected: FAIL (production code still uses `sessionStorage`).

- [ ] **Step 3: Update `saveState` and `loadState` in `app.js`**

Replace lines 35–42 of `app.js` with:

```js
function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STATE_KEY);
  return raw ? JSON.parse(raw) : null;
}
```

Leave `STATE_KEY = 'hitster_state'` unchanged.

- [ ] **Step 4: Run tests and verify**

Run: `npm test -- -t "saveState"`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "refactor: switch state storage from sessionStorage to localStorage"
```

---

### Task 2: Rename `getNextTrack` → `drawNextTrack`

**Why:** Spec uses `drawNextTrack`. The old name "next" suggested a UI action; "draw" describes the deck operation. Behaviour is unchanged.

**Files:**
- Modify: `app.js:12-20` (function), `app.js:131-133` (export)
- Modify: `tests/app.test.js:1`, `tests/app.test.js:19-40`

- [ ] **Step 1: Rename in tests**

In `tests/app.test.js`:
- Line 1: change `getNextTrack` → `drawNextTrack` in the destructured require.
- Line 19: change `describe('getNextTrack', ...)` → `describe('drawNextTrack', ...)`.
- Lines 27 and 36: change `getNextTrack(state)` → `drawNextTrack(state)`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "drawNextTrack"`
Expected: FAIL with `drawNextTrack is not a function`.

- [ ] **Step 3: Rename in production code**

In `app.js`:
- Line 12: change `function getNextTrack(state) {` → `function drawNextTrack(state) {`.
- Line 131 (module.exports block): change `getNextTrack` → `drawNextTrack`.

- [ ] **Step 4: Update the only caller**

In `app.js` line 93, change `const { track, newState } = getNextTrack(state);` → `const { track, newState } = drawNextTrack(state);`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS for all `drawNextTrack` tests; existing `shuffleArray`, `buildInitialState`, and storage tests still pass.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "refactor: rename getNextTrack to drawNextTrack"
```

---

### Task 3: Rewrite `buildInitialState` for the new team-based shape

**Why:** Initial state now includes both teams, two seed cards, and a phase. This is the new shape every other pure function operates on.

**Files:**
- Modify: `app.js:26-33` (function), `app.js:131-133` (export — already includes it)
- Modify: `tests/app.test.js:44-56`

- [ ] **Step 1: Replace the `buildInitialState` test block**

In `tests/app.test.js`, replace the existing `describe('buildInitialState', ...)` block (lines 44–56) with:

```js
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- -t "buildInitialState"`
Expected: FAIL — current implementation returns the old shape.

- [ ] **Step 3: Replace `buildInitialState` in `app.js`**

Replace the existing `buildInitialState` function (lines 26–33) with:

```js
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
```

- [ ] **Step 4: Run all tests and verify**

Run: `npm test`
Expected: PASS for all `buildInitialState` tests; other tests still pass.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "feat: extend buildInitialState with teams, seeds, phase"
```

---

### Task 4: Add `mergeTimeline(team)`

**Why:** Active team's view = banked + atRisk, re-sorted by year. Used by `isCorrectPlacement` and `render`.

**Files:**
- Modify: `app.js` (add function before `buildInitialState`)
- Modify: `app.js` module.exports
- Modify: `tests/app.test.js` (add describe block)

- [ ] **Step 1: Add test block**

Append to `tests/app.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "mergeTimeline"`
Expected: FAIL — `mergeTimeline is not a function`.

- [ ] **Step 3: Add `mergeTimeline` to `app.js`**

In `app.js`, add this function above `buildInitialState` (e.g. after `drawNextTrack`):

```js
function mergeTimeline(team) {
  return [...team.banked, ...team.atRisk].sort((a, b) => Number(a.year) - Number(b.year));
}
```

- [ ] **Step 4: Export it**

In `app.js` `module.exports`, add `mergeTimeline` to the exported list.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "feat: add mergeTimeline pure function"
```

---

### Task 5: Add `isCorrectPlacement(timeline, slotIndex, year)`

**Why:** Core scoring rule. Slot N sits between `timeline[N-1]` and `timeline[N]`. Placement is correct if `leftYear <= year <= rightYear` (inclusive on both ends → ties always pass).

**Files:**
- Modify: `app.js` (add function)
- Modify: `app.js` module.exports
- Modify: `tests/app.test.js`

- [ ] **Step 1: Add test block**

Append to `tests/app.test.js`:

```js
const { isCorrectPlacement } = require('../app.js');

describe('isCorrectPlacement', () => {
  const tl = [{ year: '1980' }, { year: '1995' }, { year: '2010' }];

  test('empty timeline: slot 0 is always correct', () => {
    expect(isCorrectPlacement([], 0, '1990')).toBe(true);
  });

  test('slot before first card: correct when year <= first', () => {
    expect(isCorrectPlacement(tl, 0, '1970')).toBe(true);
    expect(isCorrectPlacement(tl, 0, '1980')).toBe(true);  // tie OK
    expect(isCorrectPlacement(tl, 0, '1985')).toBe(false);
  });

  test('slot after last card: correct when year >= last', () => {
    expect(isCorrectPlacement(tl, 3, '2020')).toBe(true);
    expect(isCorrectPlacement(tl, 3, '2010')).toBe(true);  // tie OK
    expect(isCorrectPlacement(tl, 3, '2005')).toBe(false);
  });

  test('middle slot: correct when between bordering years', () => {
    expect(isCorrectPlacement(tl, 1, '1985')).toBe(true);   // between 1980 and 1995
    expect(isCorrectPlacement(tl, 1, '1980')).toBe(true);   // tie left
    expect(isCorrectPlacement(tl, 1, '1995')).toBe(true);   // tie right
    expect(isCorrectPlacement(tl, 1, '1979')).toBe(false);
    expect(isCorrectPlacement(tl, 1, '1996')).toBe(false);
  });

  test('handles string years like real track data', () => {
    expect(isCorrectPlacement(tl, 2, '2000')).toBe(true);   // between '1995' and '2010'
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "isCorrectPlacement"`
Expected: FAIL.

- [ ] **Step 3: Add the function to `app.js`**

Add below `mergeTimeline`:

```js
function isCorrectPlacement(timeline, slotIndex, year) {
  const y = Number(year);
  const left = slotIndex === 0 ? -Infinity : Number(timeline[slotIndex - 1].year);
  const right = slotIndex >= timeline.length ? Infinity : Number(timeline[slotIndex].year);
  return y >= left && y <= right;
}
```

- [ ] **Step 4: Export it**

Add `isCorrectPlacement` to `module.exports`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "feat: add isCorrectPlacement pure function"
```

---

### Task 6: Add `applyReveal(state)`

**Why:** Wires `isCorrectPlacement` into state transition. Correct → push to atRisk, phase = `revealed-correct`. Wrong → clear atRisk, phase = `revealed-wrong`. The current track is preserved on state for display until the next transition.

**Files:**
- Modify: `app.js`, exports, tests.

- [ ] **Step 1: Add test block**

Append to `tests/app.test.js`:

```js
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
  });

  test('wrong placement: clears atRisk and sets phase to revealed-wrong', () => {
    const state = baseState();
    state.teams[0].atRisk = [{ year: '1992' }, { year: '1996' }];
    state.currentTrack.year = '2050';   // out of bounds for slot 1
    const result = applyReveal(state);
    expect(result.phase).toBe('revealed-wrong');
    expect(result.teams[0].atRisk).toEqual([]);
    expect(result.teams[0].banked).toEqual(state.teams[0].banked);
  });

  test('uses merged timeline (banked + atRisk) for correctness check', () => {
    const state = baseState();
    state.teams[0].atRisk = [{ year: '1995' }];   // merged: 1980, 1995, 2000
    state.currentTrack.year = '1990';             // between 1980 and 1995
    state.selectedSlot = 1;                       // slot between 1980 and 1995 on merged
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "applyReveal"`
Expected: FAIL.

- [ ] **Step 3: Add the function to `app.js`**

```js
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
```

- [ ] **Step 4: Export it**

Add `applyReveal` to `module.exports`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "feat: add applyReveal pure function"
```

---

### Task 7: Add `applyLock(state)`

**Why:** Banks at-risk cards, checks the win condition, advances the turn.

**Files:**
- Modify: `app.js`, exports, tests.

- [ ] **Step 1: Add test block**

Append to `tests/app.test.js`:

```js
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
    expect(result.activeTeam).toBe(0);   // no turn advance on win
  });

  test('does not mutate the input state', () => {
    const state = baseState();
    const beforeBanked = [...state.teams[0].banked];
    applyLock(state);
    expect(state.teams[0].banked).toEqual(beforeBanked);
    expect(state.phase).toBe('revealed-correct');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "applyLock"`
Expected: FAIL.

- [ ] **Step 3: Add the function to `app.js`**

```js
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
```

- [ ] **Step 4: Export it**

Add `applyLock` to `module.exports`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "feat: add applyLock pure function"
```

---

### Task 8: Add `applyPlayNext(state)`

**Why:** Press-your-luck path: draws the next track for the SAME team, keeps at-risk cards on the timeline, returns to `placing` phase.

**Files:**
- Modify: `app.js`, exports, tests.

- [ ] **Step 1: Add test block**

Append to `tests/app.test.js`:

```js
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "applyPlayNext"`
Expected: FAIL.

- [ ] **Step 3: Add the function to `app.js`**

```js
function applyPlayNext(state) {
  const { track, newState } = drawNextTrack(state);
  return {
    ...newState,
    selectedSlot: null,
    phase: 'placing',
  };
}
```

(`drawNextTrack` already sets `currentTrack` on its returned state.)

- [ ] **Step 4: Export it**

Add `applyPlayNext` to `module.exports`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "feat: add applyPlayNext pure function"
```

---

### Task 9: Add `applyPassTurn(state)`

**Why:** Wrong-reveal exit path. Switches the active team, resets the placement state and current track.

**Files:**
- Modify: `app.js`, exports, tests.

- [ ] **Step 1: Add test block**

Append to `tests/app.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- -t "applyPassTurn"`
Expected: FAIL.

- [ ] **Step 3: Add the function to `app.js`**

```js
function applyPassTurn(state) {
  return {
    ...state,
    activeTeam: 1 - state.activeTeam,
    phase: 'idle',
    selectedSlot: null,
    currentTrack: null,
  };
}
```

- [ ] **Step 4: Export it**

Add `applyPassTurn` to `module.exports`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS — all pure functions are now covered.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/app.test.js
git commit -m "feat: add applyPassTurn pure function"
```

---

### Task 10: Rewrite `index.html` skeleton

**Why:** All pure functions are in place. Now the DOM needs containers for the team chips, timeline strip, play area, and a single phase-driven button stack.

**Files:**
- Modify: `index.html` (full rewrite of the `<body>` children except the script tags)

- [ ] **Step 1: Replace the body content**

Replace the contents of `index.html` between `<body>` and `<script src="tracks.js"></script>` with:

```html
  <!-- Game Screen -->
  <div id="screen-game" class="screen">
    <header>
      <span class="logo">HITSTER</span>
      <span id="turn-indicator" class="turn-indicator"></span>
      <button id="btn-new-game" class="btn-new-game">New Game</button>
    </header>

    <div id="inactive-team-chip" class="team-chip"></div>

    <div id="active-team-row" class="team-row active">
      <div class="team-row-header">
        <span id="active-team-name" class="team-name"></span>
        <span id="active-team-score" class="team-score"></span>
      </div>
      <div id="timeline-strip" class="timeline-strip"></div>
    </div>

    <main id="play-area" class="play-area"></main>

    <footer id="button-stack" class="button-stack"></footer>
  </div>

  <!-- Winner Screen -->
  <div id="screen-winner" class="screen hidden">
    <main class="complete-content">
      <div class="complete-icon">🎉</div>
      <h1 id="winner-headline"></h1>
      <p id="winner-scores"></p>
      <button id="btn-new-game-winner" class="btn btn-primary">▶ Start New Game</button>
    </main>
  </div>

  <!-- Deck Empty Screen -->
  <div id="screen-deck-empty" class="screen hidden">
    <main class="complete-content">
      <div class="complete-icon">🎵</div>
      <h1>Deck empty</h1>
      <p id="deck-empty-result"></p>
      <button id="btn-new-game-deck" class="btn btn-primary">▶ Start New Game</button>
    </main>
  </div>

```

(Keep the existing `<script src="tracks.js"></script>` and `<script src="app.js"></script>` immediately after, just before `</body>`.)

- [ ] **Step 2: Sanity-check the HTML**

Open `index.html` in a browser. Expect the page to load with no JS errors and a mostly empty body (because `render()` hasn't been wired up yet — that's the next task). Console may log undefined references in app.js — that's fine for this checkpoint.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor: rewrite index.html skeleton for two-team mode"
```

---

### Task 11: Update `style.css`

**Why:** Add classes for team chips, timeline strip, card chip variants (banked / at-risk), slot styles, mystery card, and a few utility tweaks.

**Files:**
- Modify: `style.css` (append + minor edits)

- [ ] **Step 1: Remove obsolete styles**

Delete the existing rules for `.reveal-area`, `.idle-icon`, `.year-badge`, `.song-title`, `.song-artist` (lines 78–121 in the current file). They'll be replaced by per-phase styles below.

Keep everything else (root tokens, header, footer, btn-primary/secondary, complete-content).

- [ ] **Step 2: Append the new styles**

Add to the bottom of `style.css`:

```css
/* ── Turn indicator ── */
.turn-indicator {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.turn-indicator strong { color: var(--text); }

/* ── Inactive team chip ── */
.team-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--surface);
  border-radius: 8px;
  padding: 8px 14px;
  margin: 0 16px 8px;
  font-size: 13px;
  color: var(--muted);
}
.team-chip .score { color: var(--green); font-weight: 700; }

/* ── Active team row ── */
.team-row {
  background: rgba(29, 185, 84, 0.08);
  border: 1px solid var(--green);
  border-radius: 12px;
  margin: 0 16px 12px;
  padding: 10px 12px;
}
.team-row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.team-name { font-weight: 700; font-size: 13px; }
.team-score { color: var(--green); font-weight: 700; font-size: 13px; }

/* ── Timeline strip ── */
.timeline-strip {
  display: flex;
  align-items: stretch;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}
.timeline-strip::-webkit-scrollbar { height: 4px; }
.timeline-strip::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* ── Card chips ── */
.card-chip {
  flex-shrink: 0;
  min-width: 56px;
  border-radius: 8px;
  padding: 8px 10px;
  text-align: center;
  background: var(--surface);
  border: 2px solid var(--green);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.card-chip .yr { font-size: 16px; font-weight: 800; color: var(--text); }
.card-chip .ti {
  font-size: 9px;
  color: var(--muted);
  line-height: 1.1;
  margin-top: 2px;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-chip.at-risk {
  border-style: dashed;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* ── Slots ── */
.slot {
  flex-shrink: 0;
  width: 22px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--border);
  font-size: 16px;
  cursor: pointer;
  background: transparent;
}
.slot.target {
  border-color: var(--green);
  color: var(--green);
  background: rgba(29, 185, 84, 0.12);
}

/* ── Play area (mystery card + revealed card) ── */
.play-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  gap: 12px;
}
.idle-icon { font-size: 64px; opacity: 0.3; }

.mystery-card {
  background: var(--green);
  color: #000;
  border-radius: 14px;
  padding: 28px 36px;
  text-align: center;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.5px;
}
.mystery-card .sub {
  display: block;
  font-size: 11px;
  margin-top: 6px;
  opacity: 0.7;
  letter-spacing: 1px;
}

.revealed-card { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.revealed-card .yr-badge {
  background: var(--green);
  color: #000;
  font-size: 48px;
  font-weight: 900;
  padding: 10px 26px;
  border-radius: 14px;
}
.revealed-card.wrong .yr-badge { background: #ef4444; color: #fff; }
.revealed-card .title { font-size: 18px; font-weight: 700; max-width: 280px; line-height: 1.3; }
.revealed-card .artist { font-size: 14px; color: var(--muted); }
.revealed-card .loss-msg {
  font-size: 13px;
  color: #ef4444;
  font-weight: 700;
  margin-top: 4px;
}

/* ── Button stack ── */
.button-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 24px 24px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Visual check**

Open `index.html` in a browser. Confirm no obvious style breakage; the page will still be mostly empty because render() isn't done yet.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add styles for team chips, timeline strip, slots, mystery card"
```

---

### Task 12: Rewrite `render(state)` and `init()` in `app.js`

**Why:** Phase-driven render reads state and rebuilds the team chip, timeline strip, play area, and button stack. Event handlers are wired via delegation for slot taps (since slots are rendered dynamically).

**Files:**
- Modify: `app.js` (replace existing `render`, `showScreen`, `playTrack`, `init` blocks at lines 46–129)

- [ ] **Step 1: Replace the rendering and init code in `app.js`**

Delete the existing UI block (everything from `// ─── UI ───` through the `init()` function and the `DOMContentLoaded` listener, lines 44–129).

Insert the following in its place:

```js
// ─── UI ───────────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function playTrack(track) {
  window.location.href = track.uri;
}

function renderTimeline(timelineCards, selectedSlot, phase) {
  const strip = document.getElementById('timeline-strip');
  strip.innerHTML = '';

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
      const isAtRisk = card._atRisk;
      const chip = document.createElement('div');
      chip.className = 'card-chip' + (isAtRisk ? ' at-risk' : '');
      chip.innerHTML =
        `<div class="yr">${card.year}</div>` +
        `<div class="ti">${(card.title || '').replace(/[<>&]/g, '')}</div>`;
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
      `<div class="yr-badge">${t.year}</div>` +
      `<div class="title">${(t.title || '').replace(/[<>&]/g, '')}</div>` +
      `<div class="artist">${(t.artist || '').replace(/[<>&]/g, '')}</div>`;
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
    const banked = state.teams[state.activeTeam].atRisk.length;
    stack.appendChild(make('btn-lock', `🔒 Lock Turn (banks ${banked})`));
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

  document.getElementById('turn-indicator').innerHTML = `Turn: <strong>${active.name}</strong>`;

  const chip = document.getElementById('inactive-team-chip');
  chip.innerHTML = `<span>${inactive.name}</span><span class="score">${inactive.banked.length} / ${state.targetScore}</span>`;

  document.getElementById('active-team-name').textContent = active.name;
  document.getElementById('active-team-score').textContent =
    `${active.banked.length} / ${state.targetScore}`;

  // Build the merged timeline view, tagging at-risk cards for styling.
  const merged = mergeTimeline(active);
  const taggedMerged = merged.map(card => ({
    ...card,
    _atRisk: active.atRisk.some(r => r.uri === card.uri),
  }));
  renderTimeline(taggedMerged, state.selectedSlot, state.phase);
  renderPlayArea(state);
  renderButtons(state);
}

function init() {
  let state = loadState() || buildInitialState(TRACKS);
  saveState(state);
  render(state);

  // Header New Game (also bound below for the winner / deck-empty screens)
  function startNewGame() {
    localStorage.removeItem(STATE_KEY);
    state = buildInitialState(TRACKS);
    saveState(state);
    render(state);
  }
  document.getElementById('btn-new-game').addEventListener('click', startNewGame);
  document.getElementById('btn-new-game-winner').addEventListener('click', startNewGame);
  document.getElementById('btn-new-game-deck').addEventListener('click', startNewGame);

  // Delegate clicks inside the game screen (buttons are rendered dynamically).
  document.getElementById('screen-game').addEventListener('click', e => {
    const target = e.target.closest('[id], [data-slot-index]');
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
        break;
      }
      case 'btn-lock': {
        state = applyLock(state);
        saveState(state);
        render(state);
        break;
      }
      case 'btn-play-next': {
        const { track, newState } = drawNextTrack(state);
        if (!track) {
          state = { ...newState, phase: 'idle' };
          saveState(state);
          render(state);
          return;
        }
        state = applyPlayNext(state);
        saveState(state);
        playTrack(track);
        // applyPlayNext already called drawNextTrack internally, so re-render the new state.
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
```

> **Note on `btn-play-next`:** Both `applyPlayNext` and the inline `drawNextTrack` above advance the deck. Fix in step 2.

- [ ] **Step 2: Fix the double-draw bug in `btn-play-next`**

Replace the `btn-play-next` case with:

```js
      case 'btn-play-next': {
        if (state.currentIndex >= state.shuffled.length) {
          state = { ...state, phase: 'idle', currentTrack: null };
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
```

- [ ] **Step 3: Update `module.exports`**

Confirm the final `module.exports` at the bottom of `app.js` includes everything tested:

```js
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
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS — Jest unit tests are unaffected by the UI rewrite.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: phase-driven render and event handlers for two-team mode"
```

---

### Task 13: Manual verification

**Files:** None modified. This is a runtime check against the spec's Verification section.

- [ ] **Step 1: Serve and open the app**

Serve the directory (any static server works, e.g. `npx http-server .` or just open `index.html` directly). On mobile or in DevTools mobile viewport:

1. Confirm Team 1 is active, has 1 seed banked, score `1 / 10`.
2. Confirm Team 2 chip shows `1 / 10`.

- [ ] **Step 2: Play a turn (correct → lock)**

1. Tap `▶ Play Song` → Spotify deep link opens.
2. Return to the browser. Tap a "+" slot → it turns green. Tap a different one → marker moves.
3. Tap `Reveal & Score`.
4. If correct: the revealed card shows the year badge + title + artist; the card appears in the timeline with a dashed pulsing border (at-risk). Bottom buttons swap to `🔒 Lock Turn (banks 1)` and `▶ Play Next Song`.
5. Tap `🔒 Lock Turn` → the at-risk card flips to solid (banked), score becomes `2 / 10`, turn passes to Team 2.

- [ ] **Step 3: Press-your-luck (correct → play next → wrong)**

1. On Team 2's turn, place a card correctly, get one at-risk.
2. Tap `▶ Play Next Song`. Note Team 2's at-risk card stays visible on the timeline.
3. Deliberately place the second song wrong (pick a slot that won't bracket it). Tap `Reveal & Score`.
4. Confirm: red year badge, both at-risk cards vanish from the timeline, single `Pass to Team 1` button appears.
5. Tap `Pass to Team 1` → back to Team 1's idle screen, Team 2 score unchanged.

- [ ] **Step 4: Refresh mid-placement**

1. On any turn, tap Play Song, then tap a slot, then refresh the browser.
2. Confirm: the same team is still active, the same slot is highlighted, the mystery card is still showing, `Reveal & Score` is enabled.

- [ ] **Step 5: Close tab and reopen**

1. Mid-game, close the tab entirely. Reopen via the same URL.
2. Confirm: localStorage rehydrates the full game — scores, timelines, phase all preserved.

- [ ] **Step 6: Reach the win condition**

1. Either lower `targetScore` in DevTools (`JSON.parse(localStorage.hitster_state)` → edit → write back) or just play until 10.
2. Confirm Winner screen appears with the right team name and final scores.
3. Tap `Start New Game` → full reset, both teams have one fresh seed.

- [ ] **Step 7: Commit any final cleanup if needed**

If any small bugs surfaced and got fixed:

```bash
git add -A
git commit -m "fix: manual-test follow-ups"
```

If everything worked cleanly, skip this commit.

---

## Out of scope reminders

These are explicitly NOT in this plan (deferred per the spec):

- Renaming teams in the UI
- Configurable target score in the UI (it's a code constant for v1)
- More than 2 teams
- Tokens / steal mechanic
- Reshuffling discarded cards
- Persistent stats across games
- Replay-song button (replay from Spotify directly)
