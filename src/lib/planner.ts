import { poisForDest } from "../data";
import { rentalsForDest } from "../data/carRentals";
import { BY_DEST } from "../data/destinations";
import { distance } from "./geo";
import type { InterestId, LegMode, Poi, PoiKind, Stop, Track, Trip } from "../types";

/**
 * Building an itinerary out of the places that actually exist.
 *
 * The honest version of "AI 幫我排行程". Nothing here calls a model and nothing
 * here is random: it reads the eighty-seven places in `data/`, scores them
 * against what the traveller said they liked, groups them so a day does not
 * cross half a county, and lays them out on a fixed clock. The same answers in
 * give the same plan out, which is the only kind of generated plan somebody can
 * be shown twice without noticing it changed its mind.
 *
 * What it deliberately does not do is compute travel time. The times are a
 * rhythm — nine, eleven, one, three, five — and the screen says so. Solving
 * arrival times properly means routing, and a plan that says 11:07 because it
 * added up bus timetables it does not have would be a more confident lie than
 * 11:00 openly offered as a suggestion.
 *
 * The distances on the legs, by contrast, are real: they are straight-line
 * metres between two coordinates, which is why the clustering exists at all.
 * A day whose stops are far apart would show its own problem in those legs.
 */

/* ------------------------------------------------------------------ input */

export type TransportId = "transit" | "drive" | "charter" | "walk" | "unsure";

export const TRANSPORT_LABELS: Record<TransportId, string> = {
  transit: "大眾運輸",
  drive: "租車自駕",
  charter: "包車",
  walk: "走路為主",
  unsure: "還不知道",
};

export interface PlanRequest {
  destId: string;
  days: number;
  interests: InterestId[];
  transport: TransportId;
}

/* -------------------------------------------------------------- selection */

/**
 * What each interest is looking for, and how strongly.
 *
 * Weights rather than a filter: somebody who ticks 美食 wants a day with food in
 * it, not a day of nothing but restaurants. A place matching two interests
 * outranks a place matching one, which is the whole mechanism.
 */
const INTEREST_KINDS: Record<InterestId, Partial<Record<PoiKind, number>>> = {
  food: { food: 1 },
  culture: { attraction: 1 },
  nature: { nature: 1 },
  shopping: { shopping: 1 },
  /* Photographs come from landscapes and landmarks in roughly that order. */
  photo: { nature: 0.8, attraction: 0.6 },
  family: { activity: 1, nature: 0.5 },
  /* Night markets are filed as food, and the streets around them as shopping. */
  nightlife: { food: 0.8, shopping: 0.5 },
  themepark: { activity: 1 },
};

/** A place nobody asked for still beats an empty day, but only just. */
const BASE_SCORE = 0.15;

function scoreOf(p: Poi, interests: InterestId[]): number {
  /* Somewhere to sleep and somewhere to change trains are real records and
     nobody's idea of a day out. They are in the data for other screens. */
  if (p.kind === "stay" || p.kind === "transit") return -1;
  if (interests.length === 0) return BASE_SCORE + (p.storyId ? 0.5 : 0);
  let s = BASE_SCORE;
  for (const id of interests) s += INTEREST_KINDS[id]?.[p.kind] ?? 0;
  /* A recorded guide is the thing this app is for. It breaks ties towards the
     places the traveller will get more out of standing in front of. */
  if (p.storyId) return s + 0.35;
  return s;
}

/* ------------------------------------------------------------------ clock */

/** Nine, eleven, one, three, five. Stated as a suggestion, never as a schedule. */
const SLOTS = ["09:00", "11:00", "13:00", "15:00", "17:00"];

/** Which slot lunch sits in, so a restaurant lands at one o'clock. */
const LUNCH_SLOT = 2;

const SPEED: Record<LegMode, number> = {
  walk: 75,
  train: 420,
  bus: 330,
  taxi: 620,
  drive: 700,
};

/** The same rule `lib/reorder.ts` uses, so a generated leg and a hand-moved one
    describe the same distance the same way. */
function legFor(metres: number, transport: TransportId) {
  const mode: LegMode =
    metres < 1200 ? "walk" : transport === "drive" || transport === "charter" ? "drive" : "taxi";
  const floor = mode === "walk" ? 5 : 1;
  return { mode, metres, min: Math.max(floor, Math.round(metres / SPEED[mode])) };
}

/* ------------------------------------------------------------------ dates */

/* Fixed, like every other date in this demo, so the generated trip sits in the
   same August the scripted ones do rather than drifting with the clock. */
const START = new Date(2026, 7, 20);
const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function dateFor(n: number) {
  const d = new Date(START.getFullYear(), START.getMonth(), START.getDate() + n - 1);
  return {
    date: `${d.getMonth() + 1} 月 ${d.getDate()} 日`,
    weekday: WEEKDAYS[d.getDay()],
  };
}

const shortDate = (n: number) => {
  const d = new Date(START.getFullYear(), START.getMonth(), START.getDate() + n - 1);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/* ----------------------------------------------------------------- output */

export interface Plan {
  trip: Trip;
  /** What the generator did, in the traveller's words. Shown above the days. */
  reasons: string[];
  /** True when the city had fewer places than the requested days could hold. */
  thin: boolean;
}

export function generatePlan(req: PlanRequest, existingIds: string[] = []): Plan {
  const dest = BY_DEST[req.destId];
  const pool = poisForDest(req.destId)
    .map((p) => ({ p, score: scoreOf(p, req.interests) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  /* Four places plus lunch fills the five slots, but a city with eight places
     and three days does not get 4/4/0 — it gets 3/3/2. Filling each day to the
     brim before starting the next left the last day of every thin city holding
     one stop, which reads as the generator running out of ideas rather than as
     the city being small. */
  const MAX_PER_DAY = 4;
  const thin = pool.length < req.days * MAX_PER_DAY;

  /* Clustered by geography, not filled greedily.
   *
   * The greedy version — take the best remaining place, then repeatedly add
   * whatever is nearest — looked right on a compact city and fell apart on a
   * long one. In 花蓮 it produced a day running 光復 → 花蓮市 → 光復 → 秀林,
   * which is a hundred kilometres of driving to see four things, because each
   * step only ever asked "what is nearest to what I have" and never "does this
   * day hold together".
   *
   * So the days are decided first and filled second. The seeds are chosen by
   * farthest-point sampling: the best-scoring place, then the place furthest
   * from everything already chosen, which lands one seed in each part of the
   * region a traveller would think of separately — the town, the gorge, the
   * valley. Everything else joins its nearest seed.
   *
   * A dense area therefore gets a fuller day than a sparse one, which is what
   * a real itinerary looks like and not something to even out.
   */
  const chosen = pool.slice(0, req.days * MAX_PER_DAY).map((x) => x.p);
  const seedCount = Math.min(req.days, chosen.length);
  const seeds: Poi[] = chosen.length ? [chosen[0]] : [];

  while (seeds.length < seedCount) {
    let best: Poi | null = null;
    let bestD = -1;
    for (const p of chosen) {
      if (seeds.includes(p)) continue;
      const d = Math.min(...seeds.map((q) => distance(q, p)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) break;
    seeds.push(best);
  }

  const groups: Poi[][] = seeds.map((p) => [p]);
  const dropped: Poi[] = [];

  /* An even share, when an even share is smaller than a full day. Pure
     nearest-seed assignment gave 日月潭 over two days a 3/1 split: four places
     around one lake, and the second day held 伊達邵 on its own. The cap keeps
     the geography — everything still joins the nearest seed that has room — and
     stops one cluster from taking the whole trip. */
  const cap = Math.min(MAX_PER_DAY, Math.ceil(chosen.length / groups.length));

  for (const p of chosen) {
    if (seeds.includes(p)) continue;
    /* Nearest seed with room. The fallback to the next-nearest is what stops a
       popular cluster from swallowing a whole trip and leaving a day empty. */
    const order = groups
      .map((_, i) => ({ i, d: distance(seeds[i], p) }))
      .sort((a, b) => a.d - b.d);
    const slot = order.find((o) => groups[o.i].length < cap);
    if (slot) groups[slot.i].push(p);
    else dropped.push(p);
  }

  /* Walked west to east within a day, so it reads as a route. Arbitrary but
     consistent, and consistent beats a day that doubles back because the
     highest-scoring place happened to be in the middle. */
  for (const g of groups) g.sort((a, b) => a.lng - b.lng || a.lat - b.lat);

  /* A city with three places and a four-day request gets three days, not one
     good day and three empty ones. */
  const dayCount = Math.max(1, groups.length);

  const usedLunch = new Set<string>();

  const days = groups.map((places, i) => {
    const n = i + 1;
    const stops: Stop[] = [];
    const centre = places[0];

    /* Somewhere to eat at one o'clock — a place of kind `food` from the POI
       data, a real stall or restaurant ResoMap writes about rather than a shop
       it has signed. V2 took lunch from the merchant records; V3 has no
       merchants, and a demo shop inside somebody's itinerary is exactly the
       claim this version stopped making. Skipped when there is nothing within
       five kilometres, because a lunch row an hour away is worse than none.

       Never the same place twice in one trip, and never a place the plan
       already visits on some day. Both days of a small city centre sit on the
       same neighbourhood, so nearest-to-centre handed back the same restaurant
       every day and the plan read as a loop. */
    const lunch = poisForDest(req.destId)
      .filter(
        (p) =>
          p.kind === "food" &&
          !usedLunch.has(p.id) &&
          !groups.some((g) => g.some((x) => x.id === p.id)) &&
          distance(centre, p) <= 5000,
      )
      .sort((a, b) => distance(centre, a) - distance(centre, b))[0];
    if (lunch) usedLunch.add(lunch.id);

    /* Day one starts at the hire counter when the traveller said they would
       drive. Nothing else in the plan changes: where the car comes from is a
       first errand, not a different itinerary. */
    const car = req.transport === "drive" && n === 1 ? rentalsForDest(req.destId)[0] : undefined;

    /* Laid out as positions first and stops second. Every leg is measured
       between two coordinates, and a Stop has none — it has a reference to
       something that does. Keeping the two apart is what stops a leg being
       computed against a record that has no latitude. */
    type Slot = { id: string; ref: Stop["ref"]; poiId: string; stayMin: number; lat: number; lng: number; meal?: Stop["meal"] };
    const laid: Slot[] = [];

    for (const p of places) {
      if (laid.length === LUNCH_SLOT && lunch) {
        laid.push({
          id: `ai-${n}-lunch`,
          ref: { kind: "poi", poiId: lunch.id },
          poiId: lunch.id,
          stayMin: 60,
          lat: lunch.lat,
          lng: lunch.lng,
          meal: "lunch",
        });
      }
      if (laid.length >= SLOTS.length) break;
      laid.push({
        id: `ai-${n}-${p.id}`,
        ref: { kind: "poi", poiId: p.id },
        poiId: p.id,
        stayMin: p.stayMin,
        lat: p.lat,
        lng: p.lng,
      });
    }

    if (car) {
      stops.push({
        id: `ai-${n}-car`,
        poiId: "",
        ref: { kind: "rental", rentalId: car.id },
        at: "08:30",
        stayMin: 20,
      });
    }

    laid.forEach((x, i) => {
      const prev = i > 0 ? laid[i - 1] : car ? { lat: car.lat, lng: car.lng } : null;
      const metres = prev ? Math.round(distance(prev, x)) : 0;
      stops.push({
        id: x.id,
        poiId: x.poiId,
        ref: x.ref,
        at: SLOTS[i],
        stayMin: x.stayMin,
        meal: x.meal,
        from: metres ? legFor(metres, req.transport) : undefined,
      });
    });

    const track: Track = { id: `ai-d${n}`, who: [], stops };
    return { n, ...dateFor(n), tracks: [track] };
  });

  /* `trip-ai-…` and a sequence, so generating a second plan for the same city
     never overwrites the first. The traveller asked for a plan, not for their
     previous plan to be replaced. */
  let seq = 1;
  while (existingIds.includes(`trip-ai-${req.destId}-${seq}`)) seq++;

  const trip: Trip = {
    id: `trip-ai-${req.destId}-${seq}`,
    destId: req.destId,
    title: `${dest?.name ?? "新的旅程"} ${dayCount} 天${dayCount > 1 ? ` ${dayCount - 1} 夜` : ""}`,
    dates: `${shortDate(1)} - ${shortDate(dayCount)}`,
    nights: Math.max(0, dayCount - 1),
    phase: "upcoming",
    daysUntil: 7,
    today: 1,
    travellers: [],
    needsStay: true,
    days,
  };

  return { trip, reasons: reasonsFor(req, groups, thin, dropped.length), thin };
}

/**
 * Why this plan looks like this.
 *
 * Three short lines, each one checkable against the days printed below them. A
 * generated itinerary that arrives with no account of itself asks to be trusted
 * on the strength of the word AI, which is exactly the wrong reason.
 */
function reasonsFor(
  req: PlanRequest,
  groups: Poi[][],
  thin: boolean,
  droppedCount: number,
): string[] {
  const out: string[] = [];
  const total = groups.reduce((n, g) => n + g.length, 0);
  const withStory = groups.flat().filter((p) => p.storyId).length;

  out.push(`從 ${BY_DEST[req.destId]?.name ?? "這個城市"} 的景點裡挑了 ${total} 個地點。`);
  if (req.interests.length > 0) {
    out.push(`依你選的偏好排序，同一天的地點盡量靠近，不用一直折返。`);
  } else {
    out.push("同一天的地點盡量靠近，不用一直折返。");
  }
  if (withStory > 0) out.push(`其中 ${withStory} 個有 ResoMap 的語音導覽。`);
  if (req.transport === "drive") out.push("第一天早上先安排取車。");
  if (thin) out.push("這個城市目前的資料量有限，天數已經照實際能排的地點調整。");
  /* Said rather than hidden. A day holds four places at most, so a long list in
     a small number of days genuinely leaves some out — and the traveller should
     hear that from the plan rather than discover it. */
  if (droppedCount > 0) {
    out.push(`還有 ${droppedCount} 個地點排不進來，可以之後自己加。`);
  }
  /* Never presented as a schedule. The times are a rhythm and the traveller is
     told so on the same screen the times appear on. */
  out.push("時間是建議的節奏，沒有計算交通時間，可以自己調整。");
  return out;
}

/** Cities this can actually plan for — the ones with places in the data. */
export function plannableDests(): { id: string; name: string; count: number }[] {
  return Object.values(BY_DEST)
    .map((d) => ({ id: d.id, name: d.name, count: poisForDest(d.id).length }))
    .filter((d) => d.count >= 3)
    .sort((a, b) => b.count - a.count);
}
