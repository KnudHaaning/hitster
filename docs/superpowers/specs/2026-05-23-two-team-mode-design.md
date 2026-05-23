# Two-Team Mode — Design Spec
_Date: 2026-05-23_

## Overview

Extend the existing single-player Hitster web app into a two-team competitive mode. Each team builds its own timeline of correctly placed song cards. On each turn the active team listens to a mystery song and taps a slot between their existing cards to place it. After a correct placement, the team chooses to **lock** their gains or **press their luck** by playing another song — but a wrong placement loses every at-risk card from that turn.

This replaces the current "play/reveal/next" loop entirely. There is no longer a single-player mode; the app is always a two-team game.

---

## Stack

Unchanged from the existing app:

- Frontend only, no backend
- HTML + CSS + vanilla JS (`index.html`, `style.css`, `app.js`)
- Tracks bundled statically in `tracks.js`
- No build step

---

## Game rules

### Setup

- Fixed **2 teams**. Default names `Team 1` and `Team 2` (rename via inline edit on team labels is out of scope for v1).
- **Target score**: 10 banked cards (constant for v1).
- Each team starts with one **seed card** automatically drawn from the deck and placed (banked) on their timeline. This gives every first turn at least one reference point.
- Team 1 goes first.

### Per-turn loop (active team)

1. Active team taps **▶ Play Song** → Spotify deep link opens, song plays.
2. User returns to the app. The timeline (horizontal-scroll strip) shows every banked + at-risk card on the active team's timeline with a "+" slot between each card and at both ends.
3. User taps a "+" slot to mark a placement. Tapping a different slot moves the marker.
4. User taps **Reveal & Score**.
   - **Correct** (the chosen slot is between two cards whose years bracket the mystery song's year — see "Tie handling" below):
     - The card is inserted at the chosen slot as an **at-risk card** (distinct visual style — see "Visual Design").
     - The bottom buttons swap to **🔒 Lock Turn (banks N cards)** and **▶ Play Next Song**.
   - **Wrong**:
     - Every at-risk card on the active team's timeline is discarded (removed from the timeline and from play).
     - A brief "Lost N cards" message appears.
     - The single bottom button becomes **Pass to Team X**.
5. If the team taps **Lock Turn**: all at-risk cards become banked. If the new banked count reaches the target, show the **Winner screen**. Otherwise turn passes.
6. If the team taps **Play Next Song**: a new song is drawn, the placement phase restarts within the same turn (at-risk cards stay visible on the timeline as reference points).
7. If the team taps **Pass to Team X** (after a wrong reveal): turn passes immediately.

### Tie handling

If a card on the timeline has the same year as the mystery song, slots **adjacent to that card** (on either side) are considered correct. This applies to the seed card too — on the first placement of a turn, if the mystery year ties the seed year, both slots are correct.

### Discard pile

Wrong-placement cards are removed from play permanently. No reshuffling. With 307 tracks this is comfortable.

### Deck exhaustion

If the deck empties mid-game, show a "Deck empty" screen with the higher-banked team as winner (ties → "Draw").

### Win condition

First team to reach **10 banked cards** wins, evaluated at the moment a lock-turn raises their banked count to 10 or above.

---

## Screens

### 1. Game Screen — Idle (start of an active team's turn)

```
┌─────────────────────────────────────┐
│ HITSTER       Turn: Team 1     [End]│
├─────────────────────────────────────┤
│  Team 2                     2 / 10  │  ← inactive team chip
├─────────────────────────────────────┤
│  Team 1                     3 / 10  │
│  ┌─────────────────────────────────┐│
│  │ [+]'87[+]'94[+]'08[+]       →   ││  ← horizontal-scroll timeline
│  └─────────────────────────────────┘│
│                                     │
│         🎵                          │  ← idle icon
│                                     │
├─────────────────────────────────────┤
│        [ ▶ Play Song ]              │
└─────────────────────────────────────┘
```

### 2. Game Screen — Placing (after Play Song, song has been played)

- Same as Idle but the mystery card is rendered in place of the idle icon: a big green card labeled "MYSTERY SONG — tap a + slot to place".
- Bottom button: **[ Reveal & Score ]**, disabled until a slot is selected.
- When a slot is tapped it turns green (the "target" style). Tapping another slot moves the target.

### 3. Game Screen — Revealed (correct)

- The mystery card is replaced by the revealed card (year badge + title + artist), inserted at the chosen slot on the timeline with at-risk styling.
- Bottom buttons:
  - **[ 🔒 Lock Turn (banks N cards) ]** — primary
  - **[ ▶ Play Next Song ]** — secondary

### 4. Game Screen — Revealed (wrong)

- The mystery card area shows the revealed song (year/title/artist) briefly with a red accent.
- All at-risk cards on the timeline animate out / are removed.
- A subtitle line shows "Lost N cards".
- Bottom button: **[ Pass to Team 2 ]** — single full-width button.

### 5. Winner Screen

- "🎉 Team X wins!" headline
- Final scores
- **[ ▶ Start New Game ]** button — re-shuffles, resets all team timelines, both teams get a new seed card

### 6. Deck Empty Screen (edge case)

- "Deck empty"
- Final scores
- Winner (or "Draw")
- **[ ▶ Start New Game ]** button

---

## App Flow

```
App loads
  → Read localStorage. If valid game state exists → render that.
  → Otherwise → buildInitialState():
    - shuffle deck
    - draw 1 card per team as seed (banked)
    - activeTeam = 0
    - phase = 'idle'
  → Render based on phase

"Play Song" tapped (phase = 'idle')
  → Draw next track from shuffled deck → currentTrack
  → phase = 'placing'
  → Open Spotify deep link
  → Render: mystery card visible, Reveal button disabled

"+" slot tapped (phase = 'placing')
  → selectedSlot = index
  → Render: highlight that slot, enable Reveal button

"Reveal & Score" tapped (phase = 'placing', selectedSlot != null)
  → Check if currentTrack.year is consistent with selectedSlot on mergeTimeline(activeTeam)
  → If correct:
    - Push currentTrack into activeTeam.atRisk (order doesn't matter — render uses mergeTimeline which re-sorts by year)
    - phase = 'revealed-correct'
  → If wrong:
    - Clear activeTeam.atRisk (those cards are discarded, lost from play)
    - currentTrack is NOT added to atRisk — it's discarded directly
    - phase = 'revealed-wrong'
  → currentTrack stays in state until Pass Turn (so we can show year/title/artist on the Revealed-wrong screen)

"Lock Turn" tapped (phase = 'revealed-correct')
  → Move all atRisk → banked on the active team
  → If banked.length >= targetScore → phase = 'gameover', winner = activeTeam
  → Else → activeTeam = 1 - activeTeam, phase = 'idle', selectedSlot = null

"Play Next Song" tapped (phase = 'revealed-correct')
  → (atRisk stays on the timeline as-is)
  → Draw next track → currentTrack
  → phase = 'placing', selectedSlot = null

"Pass to Team X" tapped (phase = 'revealed-wrong')
  → activeTeam = 1 - activeTeam, phase = 'idle', selectedSlot = null, currentTrack = null

"Start New Game" (from Winner or any time via header New Game button)
  → Clear localStorage
  → buildInitialState()
```

---

## State Management

All state lives in `localStorage` (key: `hitster_state`). **Change from existing app**: was `sessionStorage`, now `localStorage` so accidental tab closes don't wipe a long game.

```js
{
  shuffled: [Track, ...],           // unchanged — full shuffled deck
  currentIndex: 0,                  // next card to draw (seed cards consume indices 0 and 1 at game start)
  currentTrack: null | Track,       // track currently in play (placing or just revealed)
  selectedSlot: null | number,      // index of the "+" slot the active team tapped; null when not placing
  teams: [
    {
      name: 'Team 1',
      banked: [Track, ...],         // sorted by year ascending
      atRisk: [Track, ...]          // sorted by year ascending, merged with banked for slot-correctness checks
    },
    { name: 'Team 2', banked: [...], atRisk: [...] }
  ],
  activeTeam: 0 | 1,
  targetScore: 10,
  phase: 'idle' | 'placing' | 'revealed-correct' | 'revealed-wrong' | 'gameover',
  winner: null | 0 | 1              // set when phase = 'gameover'
}
```

The full timeline shown to the user for the active team is `[...banked, ...atRisk]` re-sorted by year. The slot-correctness check uses this merged, sorted view.

---

## Code structure

All changes land in the three existing files. **No new files.** `tracks.js` is untouched.

### `index.html`

- Replace the existing `<header>` content with: logo, "Turn: <team name>" indicator, **New Game** button (kept from current header).
- Add a team-chip element for the inactive team.
- Add a `<div class="team-row active">` containing the active team label, score, and a horizontal-scroll `<div class="timeline-strip">`.
- Replace the existing `reveal-area` and `idle-icon` with a phase-driven `<div class="play-area">` that renders idle icon, mystery card, or revealed card based on `phase`.
- Replace the existing two bottom buttons with a single `<div class="button-stack">` whose contents are rendered by `app.js` based on `phase`.
- Add the **Winner screen** as a separate `.screen.hidden`.

### `style.css`

New classes (additive — existing classes mostly stay):

- `.team-chip` — compact row showing the inactive team (name + score)
- `.team-row` / `.team-row.active` — block for a team's timeline
- `.timeline-strip` — horizontal-scrolling flex container, `overflow-x: auto`
- `.card-chip` — base card style (year + truncated title)
- `.card-chip.banked` — solid green border, banked card
- `.card-chip.at-risk` — dashed green border + subtle pulse, at-risk card
- `.card-chip.seed` — same as `.banked` (no special distinction after game start)
- `.slot` / `.slot.target` — empty "+" slot, target = chosen
- `.mystery-card` — big green card shown during placing phase
- `.revealed-card.correct` / `.revealed-card.wrong` — styling for the revealed state
- `.toast-loss` — "Lost N cards" message

### `app.js`

**Pure functions** (exported for tests):

- `shuffleArray(arr)` — unchanged
- `drawNextTrack(state)` — replaces `getNextTrack`. Returns `{ track, newState }` with `currentIndex` incremented.
- `buildInitialState(tracks, targetScore = 10)` — shuffles, draws 2 seed cards, builds full team objects, phase = 'idle'.
- `mergeTimeline(team)` — returns `[...team.banked, ...team.atRisk]` sorted by year ascending.
- `isCorrectPlacement(timeline, slotIndex, year)` — returns boolean. Slot N is between `timeline[N-1]` and `timeline[N]` (or before first / after last). Correct if `year >= leftYear && year <= rightYear`. Tie cases handled because of inclusive bounds.
- `applyReveal(state)` — given state with currentTrack + selectedSlot, returns new state with phase `'revealed-correct'` or `'revealed-wrong'` and updated atRisk.
- `applyLock(state)` — moves atRisk → banked on active team, checks win, advances turn.
- `applyPlayNext(state)` — draws next track for the same active team.
- `applyPassTurn(state)` — switches active team, resets selectedSlot and phase.

**UI layer**:

- `render(state)` — phase-driven. Renders header, both team UIs, timeline strip with cards + slots, play area, and bottom buttons all from state.
- `init()` — load state from localStorage or buildInitialState. Wire up event handlers via event delegation on a parent element (so dynamically rendered slot taps work).

**Storage**:

- `saveState(state)` and `loadState()` — same shape as today, but `localStorage` instead of `sessionStorage`. Key stays `hitster_state`.

---

## Visual Design

- Theme: existing dark Spotify-inspired (no changes to root tokens).
- Accent: Spotify green `#1DB954` for banked cards and target slot.
- At-risk cards: green dashed border + soft pulse animation (CSS keyframe), background slightly lighter than banked.
- Active team's row: subtle green tint background (`#1DB95415`) + green border.
- Inactive team chip: muted grey, compact (one line: name + score).
- Mystery card: big green block with "▶ MYSTERY SONG" + helper text.
- Revealed card on correct: standard year badge + title + artist as in current app.
- Revealed card on wrong: same content, but with a red outline / accent and the "Lost N cards" subtitle.
- Mobile-first, single column, large tap targets.
- Timeline strip is horizontally scrollable; never wraps. Cards have a min-width so they remain tappable.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Deck empties mid-turn | Switch to Deck Empty screen with current banked counts as final scores |
| Mystery year equals an existing card's year | Both adjacent slots count as correct (inclusive bounds in `isCorrectPlacement`) |
| First placement of a turn is wrong | At-risk list is empty, "Lost 0 cards" is suppressed, turn passes silently |
| Mid-placement refresh | localStorage restores `phase = 'placing'` and `selectedSlot`, so the user resumes where they left off (though Spotify won't re-launch the song automatically) |
| Tab closed and reopened later | localStorage rehydrates the full game; team has to re-trigger Play Song to relaunch Spotify if mid-placement |
| Both teams hit target on the same lock | Not possible — only the active team can score on a lock |

---

## Testing

Existing `tests/app.test.js` covers `shuffleArray`, `getNextTrack`, `buildInitialState`, `saveState`, `loadState`. New tests cover:

- `drawNextTrack` (renamed from getNextTrack) — same behavior
- `buildInitialState` — produces two seed-card-bearing teams with `currentIndex = 2`
- `mergeTimeline` — returns banked + atRisk sorted ascending
- `isCorrectPlacement` — exhaustive cases: empty timeline (single slot, always correct), slot at start, slot at end, slot in middle, year equal to bordering card (tie), year off by one
- `applyReveal` — correct path moves currentTrack into atRisk at the right index; wrong path clears atRisk
- `applyLock` — atRisk → banked, advances turn, sets winner when banked ≥ target
- `applyPlayNext` — preserves atRisk, draws next track, resets selectedSlot
- `applyPassTurn` — switches activeTeam, resets phase and selectedSlot

---

## Verification (manual)

1. Open app in mobile browser. See Team 1 active, both teams with one seed card.
2. Tap Play Song → Spotify launches.
3. Return to app. Tap a "+" slot. Slot turns green. Reveal button enables.
4. Tap Reveal & Score. If correct, see card slide in with at-risk styling; Lock + Play Next buttons appear. If wrong, see at-risk cleared, Pass button appears.
5. Tap Play Next → new song plays. Place it correctly. See **2** at-risk cards on the timeline. Tap Lock Turn → both flip to banked, score = 3 (with seed), turn passes to Team 2.
6. Repeat for Team 2. Test press-your-luck: get one right, play another, get wrong → confirm only the at-risk cards are lost, not the seed/banked.
7. Play until a team reaches 10 banked → Winner screen.
8. Refresh mid-placement → state restored.
9. Close tab and reopen → state restored (localStorage).
10. Tap New Game in header → confirm reset and re-shuffle.

---

## Out of scope (v1)

- Renaming teams in UI
- Configurable target score
- More than 2 teams
- Tokens / steal mechanic from real Hitster
- Reshuffling discarded cards back into the deck
- Persistent player/team statistics across games
- Replay-song button (Spotify owns playback; user replays from Spotify directly if needed)
