// The window keeps Berlin's night. The photo is always night, so from 07:00 to 21:00 Berlin time it shows a busy
// evening; after that the city winds down on the real clock: windows go dark, fewer windows flicker with a
// television, the road empties, S-Bahn trains come less often, and nothing lands between midnight and five (the
// airport's night curfew). From half past four it wakes up again. Friday and Saturday nights stay busier, and the
// S-Bahn runs all night then, as it does.
//
// Everything here changes over hours, so the page reads it once a second: nightLife() is a few table lookups.

// Berlin hour -> [share of windows dark, share of windows with a television on, share of road cells holding a car,
// gap between trains as a multiple of the evening gap]. Piecewise linear, wrapping at 24.
const KEYS = [
  [0, .28, .06, .22, 1.3],
  [1, .38, .045, .16, 1.6],
  [2, .45, .035, .12, 1.9],
  [3, .5, .03, .1, 2.1],
  [4.5, .48, .025, .1, 2.1],
  [5.5, .34, .025, .16, 1.5],
  [6.5, .2, .03, .28, 1.1],
  [7, .13, .05, .36, 1],
  [21, .13, .05, .36, 1],
  [22, .15, .075, .33, 1],
  [23, .2, .075, .28, 1.1],
  [24, .28, .06, .22, 1.3],
];
export const EVENING = Object.freeze({ winOff: .13, tv: .05, traffic: .36, trainGap: 1, sec: 21 * 3600, curfew: false, hour: 21 });

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// How much of a weekend night this is: Friday and Saturday evenings ease into it from 21:00 to midnight, and Saturday
// and Sunday mornings ease out of it from 06:00 to 07:00, so nothing switches at once.
function weekendWeight(h, dow) {
  if (h >= 21) return dow === 5 || dow === 6 ? smooth(21, 24, h) : 0;
  if (h < 7) return dow === 6 || dow === 0 ? 1 - smooth(6, 7, h) : 0;
  return 0;
}

// sec: seconds since midnight, Berlin wall time, read at page time T (seconds); dow: Berlin day of the week (0 Sunday).
// evening: ignore the clock.
export function nightLife(sec, dow, evening = false, T = 0) {
  if (evening) return EVENING;
  const h = (((sec / 3600) % 24) + 24) % 24;
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  const v = k => a[k] + (b[k] - a[k]) * t;
  let winOff = v(1), tv = v(2), traffic = v(3), trainGap = v(4);
  // weekend nights: more people up, more cars, and the S-Bahn runs all night; on weeknights most lines pause between
  // about half past one and four
  const w = weekendWeight(h, dow);
  if (h > 1.5 && h < 4) trainGap *= 1 + .25 * (1 - w);
  winOff *= 1 - .15 * w; traffic = Math.min(.36, traffic * (1 + .5 * w)); trainGap += (Math.min(trainGap, 1.3) - trainGap) * w;
  return { winOff, tv, traffic, trainGap, sec, T, curfew: true, hour: h };
}

// Is the hour (0..24) inside the airport's night curfew?
export const inCurfew = h => h >= 0 && h < 5;
