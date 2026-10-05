# Ayush Tyagi — Personal Workstation Portfolio

A faithful, fully interactive 3D retro workstation portfolio website modeled after [felixrieseberg.com](https://felixrieseberg.com/). Set in a late-90s production environment on a desk by a rainy window at night.

## Features

- **Late-90s CRT Production Monitor**:
  - **CH 00 (Home)**: Ambient stipple display with animated glowing orbits and vintage raster glow.
  - **CH 01 (Work)**: Cassette tape playback with OSD timecode, project titles, and floating legal notepad with project details and links.
  - **CH 02 (Posts)**: Authentic "NIGHTFAX 100" Teletext / Ceefax screen with cycling subpages, article listings, and Fastext keys.
  - **Physical Monitor Buttons**: 1–6 (Home, Work, Posts, Underscan mode, H/V delay sync-pulse check, and Blue-only calibration mode).
- **VCR Player & Cassette Stack**:
  - 11 physical cassette tapes on the shelf (Internships/Education and Projects stack).
  - Authentic cassette insertion animations: tape flies off the shelf, opens the motorized VCR door, inserts into the deck, and turns the TV to that channel.
  - Yellow legal notepad lifts up off the desk with project notes in handwriting font.
- **Classic IBM PC (Green Phosphor CRT & GW-BASIC)**:
  - Boots into authentic PC-BASIC 1.10 with CP437 character set and CRT power hum.
  - `ABOUT`: Displays Ayush Tyagi's profile, education, and career background.
  - `ONLINE`: Dials out with 28.8k baud modem DTMF audio tones, handshakes, and connects to the VELQORE BBS.
  - Games: `SNAKE`, `BLOCKS`, `ZOMBIE`, and screensaver `DEMO`.
  - Mechanical 3D keyboard: Keys physically press down in real-time as you type on your physical keyboard.
- **Portable CD Player**:
  - Press `M` or click the player to focus in close.
  - LCD screen, play/pause, stop, track skip, volume dial, and 4 audio tracks (*Deep Field*, *Late Shift*, *Soft Focus*, *Retche Gospod*).
- **Interactive Desk Elements**:
  - **Desk Calculator**: Click to lift off the desk; working vacuum-fluorescent display (VFD) calculator.
  - **Coffee Mug**: Click to take a sip with sound effects and surface ripples.
  - **Wall Clock**: Working ticking second hand; click to remove the battery and stop time.
  - **Desk & Floor Lamps**: Click to toggle physical lighting throughout the room.
  - **Rainy Window**: Parallax depth city skyline with raindrops running down the glass and headlights moving through the streets.
  - **Credits Rolodex**: Rotary index card file behind the desk lamp lifts open on click.
- **Accessible Fallback Navigation**:
  - Complete semantic fallback navigation and reader mode for search engines and devices without WebGL.

## Keyboard Shortcuts

- `C`: Pan camera to the IBM PC
- `M`: Pan camera to the CD Player
- `Z`: Zoom TV monitor
- `1`–`6`: Studio monitor input & test buttons
- `N`: Show / hide project notepad card
- `Esc`: Return camera to the desk view

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Verification & Tests

```bash
npm test            # Run Vitest test suite
npm run build       # Build production bundle to dist/
npm run check:build # Validate asset budgets and Vercel output
```
