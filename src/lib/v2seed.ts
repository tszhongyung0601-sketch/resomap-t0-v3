/**
 * V3 keeps its own storage, and starts from whatever V2 left behind.
 *
 * V2 and V3 are served from the same origin (tszhongyung0601-sketch.github.io),
 * so they share one localStorage. Had V3 kept V2's keys, every trip edited here
 * would have silently rewritten the same trip over there — and V2 is the build
 * that is supposed to stay exactly as it was. So every V3 key carries a
 * `resomap_v3_` prefix, and V2's keys are only ever read.
 *
 * Read once, on the first visit: a trip somebody built in V2 is there when
 * they open V3, which is the comparison they came to make. After that the two
 * drift apart, which is the point.
 *
 * Imported first in main.tsx, before any module that reads storage.
 */

const NAMES = [
  "trips",
  "day_edits",
  "saved",
  "docs",
  "reactions",
  "account",
  "locale",
  "events",
];

const SEEDED = "resomap_v3_seeded";

try {
  if (localStorage.getItem(SEEDED) === null) {
    for (const n of NAMES) {
      const from = localStorage.getItem(`resomap_${n}`);
      if (from !== null && localStorage.getItem(`resomap_v3_${n}`) === null) {
        localStorage.setItem(`resomap_v3_${n}`, from);
      }
    }
    localStorage.setItem(SEEDED, "1");
  }
} catch {
  /* Storage blocked or full — V3 simply starts from its own fixtures. */
}

export {};
