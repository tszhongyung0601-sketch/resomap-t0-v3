import type { LatLng } from "./geo";
import type { PlaceRef } from "../types";

/**
 * OpenStreetMap's own POI index, as an enhancement and never as a dependency.
 *
 * The seven places the map home shows are curated: they live in
 * `data/nearbyAttractions.ts`, they have coordinates, photographs and recorded
 * guides, and they are what the product is actually about. Overpass can add
 * *more* places around wherever the traveller happens to be — which is the
 * capability this file exists to prove — but it is a public, rate-limited,
 * frequently-slow community service, and a map home that goes blank when
 * somebody else's server is busy is not a map home.
 *
 * So: short timeout, one attempt, and every failure resolves to an empty array.
 * There is no error path for a caller to handle because there is no error — the
 * curated list is the answer, and this only ever adds to it.
 */

export interface OsmPlace {
  /** `node/12345` — stable enough to dedupe on within one session. */
  id: string;
  name: string;
  at: LatLng;
  /** The OSM tag that matched, for grouping. Not shown to a traveller. */
  kind: string;
}

const ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Longer than this and the traveller has already scrolled past the map. */
const TIMEOUT_MS = 6000;

/**
 * Things a traveller would call a place worth going to.
 *
 * Deliberately narrow. `tourism=*` alone pulls in every hotel and guest house
 * within the radius, which is a different question — this map answers "where
 * could I go", and where to sleep is 周邊推薦's job two screens later.
 */
const FILTERS = [
  'nwr["tourism"="attraction"]',
  'nwr["tourism"="museum"]',
  'nwr["tourism"="viewpoint"]',
  'nwr["historic"~"memorial|monument|building|castle"]',
  'nwr["leisure"="park"]',
];

function query(at: LatLng, radiusM: number): string {
  const around = `(around:${radiusM},${at.lat},${at.lng})`;
  return `[out:json][timeout:${Math.round(TIMEOUT_MS / 1000)}];(${FILTERS.map(
    (f) => `${f}["name"]${around};`,
  ).join("")});out center 60;`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Places OSM knows about near a point. Empty on any failure, always.
 *
 * `AbortController` rather than trusting the `[timeout:]` in the query: that one
 * bounds how long Overpass spends computing, not how long the browser waits for
 * a response that may never start arriving.
 */
export async function nearbyOsmPlaces(
  at: LatLng,
  radiusM = 1500,
): Promise<OsmPlace[]> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: query(at, radiusM),
      signal: abort.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { elements?: OverpassElement[] };
    const out: OsmPlace[] = [];
    for (const e of data.elements ?? []) {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const name = e.tags?.name;
      if (lat === undefined || lng === undefined || !name) continue;
      out.push({
        id: `${e.type}/${e.id}`,
        name,
        at: { lat, lng },
        kind:
          e.tags?.tourism ?? e.tags?.historic ?? e.tags?.leisure ?? "place",
      });
    }
    return out;
  } catch {
    /* Aborted, offline, rate-limited, CORS, malformed JSON — all the same
       answer. The curated list is already on the map. */
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------ V3 round 2: 餐廳 and 住宿 */

const FOOD_SUB: Record<string, string> = { restaurant: "餐廳", cafe: "咖啡廳", fast_food: "速食" };
const STAY_SUB: Record<string, string> = {
  hotel: "飯店",
  hostel: "青年旅館",
  guest_house: "民宿",
  motel: "汽車旅館",
};

/**
 * Real restaurants and places to stay near a point, off OpenStreetMap.
 *
 * `null` — not an empty list — when the request failed, so the caller can tell
 * "Overpass is busy" apart from "there is genuinely nothing here" and reach for
 * the snapshot only in the first case. Two endpoints, tried in turn, each with
 * the same short timeout: the main one rate-limits, the mirror often does not.
 */
export async function nearbyFoodStay(
  at: LatLng,
): Promise<{ food: PlaceRef[]; stay: PlaceRef[] } | null> {
  const q = `[out:json][timeout:${Math.round(TIMEOUT_MS / 1000)}];(` +
    `nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](around:1200,${at.lat},${at.lng});` +
    `nwr["tourism"~"^(hotel|hostel|guest_house|motel)$"]["name"](around:3000,${at.lat},${at.lng});` +
    `);out center 250;`;

  for (const endpoint of [ENDPOINT, "https://overpass.kumi.systems/api/interpreter"]) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, { method: "POST", body: q, signal: abort.signal });
      if (!res.ok) continue;
      const data = (await res.json()) as { elements?: OverpassElement[] };
      const food: PlaceRef[] = [];
      const stay: PlaceRef[] = [];
      for (const e of data.elements ?? []) {
        const lat = e.lat ?? e.center?.lat;
        const lng = e.lon ?? e.center?.lon;
        const name = e.tags?.name;
        if (lat === undefined || lng === undefined || !name) continue;
        const id = `osm:${e.type}/${e.id}`;
        const amenity = e.tags?.amenity;
        const tourism = e.tags?.tourism;
        if (amenity && FOOD_SUB[amenity]) food.push({ id, name, lat, lng, cat: "food", sub: FOOD_SUB[amenity] });
        else if (tourism && STAY_SUB[tourism]) stay.push({ id, name, lat, lng, cat: "stay", sub: STAY_SUB[tourism] });
      }
      return { food, stay };
    } catch {
      /* Try the mirror; if that fails too, say so with null. */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
