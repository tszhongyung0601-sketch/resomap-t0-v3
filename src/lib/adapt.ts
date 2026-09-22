import { poi } from "../data";
import { distance } from "./geo";
import { viewOf } from "./stop";
import type { Adapt, LegMode, Stop, Trip } from "../types";

/** Door-to-door metres per minute, not vehicle top speed. */
const SPEED: Record<LegMode, number> = {
  walk: 75,
  train: 420,
  bus: 330,
  taxi: 620,
  drive: 700,
  /* V3. Door-to-door, like the rest: a scooter parks at the door, a bus
     makes you wait for it. lib/reorder.ts's estimateLeg is the one that
     accounts for distance; these are only for the old re-measure paths. */
  scooter: 450,
  transit: 330,
  self: 75,
};

const toMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (v: number) =>
  `${String(Math.floor(v / 60) % 24).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;

/**
 * Times shift; they are not recomputed from scratch.
 *
 * A planned day has slack in it — a booking at 18:30 is at 18:30 because
 * somebody booked it, not because it is the sum of the walking times. Rebuilding
 * the clock from the first stop silently squeezes that slack out and moves
 * dinner two hours earlier, which is exactly the kind of "helpful" edit that
 * makes people stop trusting an assistant.
 *
 * So: every stop keeps its original time, pushed back by however late the group
 * is, pulled forward by whatever a dropped stop frees up, and never earlier
 * than it was originally planned.
 */
function shift(stops: Stop[], dropIds: string[], delay: number): Stop[] {
  let freed = 0;
  const out: Stop[] = [];
  for (const s of stops) {
    if (dropIds.includes(s.id)) {
      freed += s.stayMin + (s.from?.min ?? 0);
      continue;
    }
    const original = toMin(s.at);
    out.push({ ...s, at: toHHMM(Math.max(original, original + delay - freed)) });
  }
  return out;
}

/**
 * Distance genuinely saved by removing a stop: the two legs it sat between,
 * minus the direct hop that replaces them.
 *
 * Taking only the inbound leg would overstate it — you still have to travel
 * from wherever you are to wherever you are going next. This is the difference
 * between a number a traveller can check on the map and a number that just
 * sounds good on a card.
 */
function metresSaved(stops: Stop[], dropId: string): number {
  const i = stops.findIndex((s) => s.id === dropId);
  if (i < 0) return 0;
  const inbound = stops[i].from?.metres ?? 0;
  const outbound = stops[i + 1]?.from?.metres ?? 0;
  const prev = stops[i - 1];
  const next = stops[i + 1];
  if (!prev || !next) return inbound + outbound;
  const a = viewOf(prev);
  const b = viewOf(next);
  if (!a || !b) return inbound + outbound;
  const direct = distance(a, b);
  return Math.max(0, inbound + outbound - direct);
}

export interface AdaptPreview {
  trip: Trip;
  /** Arrival at the last stop of the day once the plan is applied. */
  endAt: string;
  /** What that same stop would slip to if nothing were changed. */
  doNothingEndAt: string;
  droppedNames: string[];
  swappedFrom: string | null;
  swappedTo: string | null;
  /** Minutes handed back by dropping stops. The metric that matters when late. */
  savedMin: number;
  /** Metres genuinely not walked. Only worth showing when it is substantial. */
  savedMetres: number;
}

/**
 * One computation, shared by the proposal card and the apply step, so the card
 * can never promise a time the timeline then contradicts.
 */
export function previewAdapt(trip: Trip, adapt: Adapt): AdaptPreview {
  const delay = adapt.delayMin ?? 0;
  const droppedNames: string[] = [];
  let swappedFrom: string | null = null;
  let swappedTo: string | null = null;
  let savedMin = 0;
  let savedMetres = 0;
  let endAt = "";
  let doNothingEndAt = "";

  const days = trip.days.map((d) => {
    if (d.n !== adapt.day) return d;

    const tracks = d.tracks.map((t) => {
      const untouched = shift(t.stops, [], delay);
      const lastUntouched = untouched[untouched.length - 1];
      if (lastUntouched) doNothingEndAt = lastUntouched.at;

      for (const s of t.stops) {
        if (!adapt.plan.drop.includes(s.id)) continue;
        droppedNames.push(viewOf(s)?.title ?? "");
        savedMin += s.stayMin + (s.from?.min ?? 0);
        savedMetres += metresSaved(t.stops, s.id);
      }

      let stops = shift(t.stops, adapt.plan.drop, delay);

      if (adapt.plan.swap) {
        const swap = adapt.plan.swap;
        stops = stops.map((s) => {
          if (!swap[s.id]) return s;
          swappedFrom = viewOf(s)?.title ?? "";
          swappedTo = poi(swap[s.id]).name;
          /* The swap table names a POI, so the replacement is a POI stop even
             when what it replaced was a restaurant. Writing `ref` alongside
             `poiId` keeps the two from disagreeing about what this row is. */
          return {
            ...s,
            poiId: swap[s.id],
            ref: { kind: "poi" as const, poiId: swap[s.id] },
            changed: adapt.swapNote ?? "已調整",
          };
        });
        /* The legs either side of a swapped stop were measured to the OLD venue.
           Leaving them is how you end up telling somebody to drive 42 minutes to
           a place that is nine minutes away — the timeline would contradict the
           map on the one screen that is supposed to be trustworthy. */
        stops = stops.map((s, i) => {
          const prev = stops[i - 1];
          const touched = swap[s.id] || (prev && swap[prev.id]);
          if (!prev || !s.from || !touched) return s;
          const a = viewOf(prev);
          const b = viewOf(s);
          if (!a || !b) return s;
          const metres = Math.round(distance(a, b) * 1.25);
          /* Nobody drives 900 metres. When a swap makes a motorised leg short
             enough to walk, say so — reporting "開車 1 分鐘" is technically
             derived from the distance and still obviously wrong to a human. */
          const mode =
            s.from.mode !== "walk" && metres < 1200 ? ("walk" as const) : s.from.mode;
          return {
            ...s,
            from: { mode, metres, min: Math.max(1, Math.round(metres / SPEED[mode])) },
          };
        });
      }

      if (delay > 0 && stops[0]) {
        stops = stops.map((s, i) => (i === 0 ? { ...s, changed: "因延後調整" } : s));
      }

      const last = stops[stops.length - 1];
      if (last) endAt = last.at;
      return { ...t, stops };
    });

    return { ...d, tracks };
  });

  return {
    trip: { ...trip, days },
    endAt,
    doNothingEndAt,
    droppedNames,
    swappedFrom,
    swappedTo,
    savedMin,
    savedMetres,
  };
}

export const applyAdapt = (trip: Trip, adapt: Adapt): Trip =>
  previewAdapt(trip, adapt).trip;

/** "80" -> "1 小時 20 分". Used so a duration is never written down twice. */
export function dur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} 分`;
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`;
}
