import type { DealCategory, EventName, PartnerId, TrackedEvent } from "../types";

/**
 * Mock affiliate tracking.
 *
 * There is no affiliate API here and no commission engine. This records the
 * same five events a real integration would emit — impression, click, outbound,
 * booking, commission — into localStorage, so the business demo can show the
 * shape of the funnel without anybody mistaking it for revenue.
 *
 * Every surface that reads this data is required to label it Demo Data.
 */

const KEY = "resomap_v3_events";
const CAP = 2000;

/** Indicative commission rates. Public affiliate ranges, not negotiated terms. */
const RATE: Record<DealCategory, number> = {
  ticket: 0.05,
  stay: 0.04,
  transport: 0.04,
  esim: 0.08,
  insurance: 0.1,
  local: 0.06,
};

function read(): TrackedEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrackedEvent[]) : [];
  } catch {
    return [];
  }
}

function write(list: TrackedEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-CAP)));
  } catch {
    /* private mode, quota — tracking is never worth breaking a screen over */
  }
}

export function track(
  name: EventName,
  meta: Omit<TrackedEvent, "name" | "at"> = {},
) {
  const list = read();
  list.push({ name, at: Date.now(), ...meta });
  write(list);
  finished = null;
}

/**
 * Which places the traveller has actually listened to all the way through.
 *
 * The itinerary asks this to decide whether to offer 探索附近 on a stop, which
 * makes it a render-path read — so it is cached and invalidated on write rather
 * than re-parsing two thousand events once per row. `story_finish` is already
 * recorded by the player; deriving from it means the itinerary and the funnel
 * can never disagree about what was heard.
 */
let finished: Set<string> | null = null;

export function finishedPois(): Set<string> {
  if (!finished) {
    finished = new Set(
      read()
        .filter((e) => e.name === "story_finish" && e.poiId)
        .map((e) => e.poiId as string),
    );
  }
  return finished;
}

export const events = read;

export function clearEvents() {
  write([]);
  finished = null;
}

/**
 * One impression per card mount.
 *
 * The obvious implementation — a module-level Set of ids already counted —
 * breaks the funnel: it counts a card once for the whole page session while
 * clicks keep accumulating, so revisiting the deals tab and tapping again
 * produces more clicks than impressions and a click-through rate above 100%.
 * Scoping it to the mount is both cheaper and actually correct: seeing the card
 * again IS another impression.
 */
export function impression(dealId: string, partner: PartnerId, category: DealCategory) {
  track("affiliate_impression", { dealId, partner, category });
}

export interface Funnel {
  impressions: number;
  clicks: number;
  outbound: number;
  bookings: number;
  /** Simulated gross booking value, TWD. */
  gmvTwd: number;
  /** Simulated commission at the indicative rates above, TWD. */
  commissionTwd: number;
  /**
   * The whole funnel per platform, not just clicks. The business screen has to
   * be able to answer "which platform actually converts", and a list of click
   * counts cannot — Booking can out-click Klook and still book nothing.
   */
  byPartner: {
    partner: PartnerId;
    clicks: number;
    outbound: number;
    bookings: number;
    commissionTwd: number;
  }[];
  byCategory: { category: DealCategory; clicks: number; commissionTwd: number }[];
  byDest: { destId: string; clicks: number }[];
}

/**
 * Click-through from impression to click, as a fraction. Clamped, because a
 * business screen that can print "點擊率 133%" discredits every other number
 * next to it — and the reader has no way to tell which ones.
 */
export const ctr = (f: Funnel) =>
  f.impressions ? Math.min(1, f.clicks / f.impressions) : 0;

interface PartnerTally {
  clicks: number;
  outbound: number;
  bookings: number;
  commissionTwd: number;
}

export function funnel(): Funnel {
  const list = read();
  const partners = new Map<PartnerId, PartnerTally>();
  const cats = new Map<DealCategory, { clicks: number; commissionTwd: number }>();
  const dests = new Map<string, number>();

  /* Get-or-create, so a partner enters the table on whichever event reaches it
     first. A platform seen only as an outbound must still get a row. */
  const tally = (id: PartnerId): PartnerTally => {
    const p = partners.get(id) ?? { clicks: 0, outbound: 0, bookings: 0, commissionTwd: 0 };
    partners.set(id, p);
    return p;
  };

  const f: Funnel = {
    impressions: 0,
    clicks: 0,
    outbound: 0,
    bookings: 0,
    gmvTwd: 0,
    commissionTwd: 0,
    byPartner: [],
    byCategory: [],
    byDest: [],
  };

  for (const e of list) {
    if (e.name === "affiliate_impression") f.impressions++;

    if (e.name === "affiliate_outbound") {
      f.outbound++;
      if (e.partner) tally(e.partner).outbound++;
    }

    if (e.name === "affiliate_click") {
      f.clicks++;
      if (e.partner) tally(e.partner).clicks++;
      if (e.category) {
        const c = cats.get(e.category) ?? { clicks: 0, commissionTwd: 0 };
        c.clicks++;
        cats.set(e.category, c);
      }
      if (e.destId) dests.set(e.destId, (dests.get(e.destId) ?? 0) + 1);
    }

    if (e.name === "mock_booking") {
      f.bookings++;
      const value = e.valueTwd ?? 0;
      const commission = Math.round(value * (e.category ? RATE[e.category] : 0.05));
      f.gmvTwd += value;
      f.commissionTwd += commission;
      if (e.partner) {
        const p = tally(e.partner);
        p.bookings++;
        p.commissionTwd += commission;
      }
      if (e.category) {
        const c = cats.get(e.category) ?? { clicks: 0, commissionTwd: 0 };
        c.commissionTwd += commission;
        cats.set(e.category, c);
      }
    }
  }

  f.byPartner = [...partners].map(([partner, v]) => ({ partner, ...v }));
  f.byCategory = [...cats].map(([category, v]) => ({ category, ...v }));
  f.byDest = [...dests]
    .map(([destId, clicks]) => ({ destId, clicks }))
    .sort((a, b) => b.clicks - a.clicks);

  f.byPartner.sort((a, b) => b.clicks - a.clicks || b.commissionTwd - a.commissionTwd);
  f.byCategory.sort((a, b) => b.clicks - a.clicks);
  return f;
}
