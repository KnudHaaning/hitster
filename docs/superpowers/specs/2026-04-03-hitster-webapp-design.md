# Hitster Webapp — Design Spec
_Date: 2026-04-03_

## Overview

A mobile-first webapp that replicates the Hitster card game experience. Two teams pass a phone around, pressing "Play Song" to hear a random song from the official Hitster Spotify playlist, and "Reveal Song" to see the year, artist, and title.

---

## Stack

- **Frontend only** — no backend, no server
- **HTML + CSS + vanilla JS** — three files (`index.html`, `style.css`, `app.js`)
- **Hosting** — GitHub Pages, Netlify, or any static host (can also run locally)

---

## Data

The Hitster official Spotify playlist tracks are **pre-fetched once during development** and bundled as a static JSON array in the app (`tracks.js`). Each entry contains:

```json
{
  "uri": "spotify:track:XXXX",
  "title": "Never Gonna Give You Up",
  "artist": "Rick Astley",
  "year": "1987"
}
```

No Spotify login required at runtime. The playlist is stable enough that a static snapshot is appropriate.

---

## Screens

### 1. Game Screen — Waiting (before play)

- Header: "HITSTER" logo + song counter ("Song 0 / 50" before first play, "Song 4 / 50" during play)
- Center: music note icon
- Bottom buttons (stacked vertically):
  - **"▶ Play Song"** — green, active
  - **"👁 Reveal Song"** — greyed out, disabled

### 2. Game Screen — Playing (after Play Song tapped)

- Same layout
- Counter updates
- "Reveal Song" becomes active (green outline)

### 3. Game Screen — Revealed (after Reveal Song tapped)

- Big green year badge (e.g. **1987**)
- Song title below (white, bold)
- Artist below that (grey)
- Bottom buttons:
  - **"▶ Next Song"** — green, active
  - **"👁 Reveal Song"** — greyed out again

### 4. Session Complete Screen

- Message: "All songs played!"
- "Start New Session" button — reshuffles and resets

---

## App Flow

```
App loads
  → Shuffle track list → store in sessionStorage
  → Show Game Screen (waiting state)

"Play Song" tapped
  → Pick next track from shuffled list
  → Open Spotify deep link: window.open('spotify:track:URI')
  → Store current track in state
  → Enable "Reveal Song" button
  → Update counter

"Reveal Song" tapped
  → Show year badge, title, artist
  → Disable "Reveal Song"
  → Change "Play Song" → "Next Song"

"Next Song" tapped
  → Same as "Play Song"
  → If no tracks left → Show Session Complete screen

"Start New Session"
  → Clear sessionStorage
  → Reshuffle
  → Reset to waiting state
```

---

## State Management

All state lives in `sessionStorage` (survives page refresh, resets when browser is closed):

| Key | Value |
|-----|-------|
| `shuffled` | JSON array of shuffled track objects |
| `currentIndex` | Integer — index of next track to play |
| `currentTrack` | Current track object (for reveal) |
| `revealed` | Boolean — whether current song is revealed |

---

## Visual Design

- **Theme**: Dark (Spotify-inspired) — deep navy/black background
- **Accent**: Spotify green `#1DB954`
- **Year badge**: Large, bold, green background, black text
- **Mobile-first**: Full-height layout, large tap targets, no horizontal scroll
- **Font**: System font stack (fast, no network request)

---

## Verification

1. Open app in mobile browser (or desktop DevTools mobile view)
2. Tap "Play Song" — Spotify app should open and begin playing a song
3. Tap "Reveal Song" — year badge, title, artist appear; button greyed out
4. Tap "Next Song" — new song plays in Spotify, reveal resets
5. Confirm counter increments correctly
6. Play through all tracks — session complete screen appears
7. Tap "Start New Session" — app resets with reshuffled tracks, same songs available again
8. Refresh page mid-session — state should be preserved (sessionStorage)
