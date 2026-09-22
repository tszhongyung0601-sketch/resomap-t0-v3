import { BY_POI } from "../data";
import { BY_MERCHANT } from "../data/merchants";
import { BY_PROVIDER } from "../data/providers";
import { BY_OFFER } from "../data/affiliateOffers";
import { BY_RENTAL, RENTAL_DISCLOSURE } from "../data/carRentals";
import { BY_EVENT, EVENT_KINDS } from "../data/events";
import type { PlaceRef, Poi, Stop, StopRef } from "../types";

/**
 * What a stop is, whatever kind of thing it points at.
 *
 * A day used to be a list of places, so every screen could write `poi(s.poiId)`
 * and get a name, a photo and a pair of coordinates. V3 lets a traveller put a
 * hire car, a restaurant, a guide or a day tour into the same day, and none of
 * those are POIs — so twenty call sites would each have needed their own chain
 * of `if (merchant) … else if (provider) …`, and the first one anybody forgot
 * would be a white screen rather than a blank card, because `poi()` throws in
 * development on an id it does not know.
 *
 * One resolver instead. `viewOf` answers the four questions a timeline row, a
 * map pin, a route leg and a rain re-plan all ask — what is it called, where is
 * it, what does it look like, how long does it take — and answers `null` for a
 * reference whose record has gone, which every caller must handle by skipping
 * the row. That is the deliberate trade: a deleted merchant loses one line of an
 * itinerary instead of taking down the itinerary.
 *
 * Nothing here formats. Screens still decide whether they have room for the
 * subtitle, and the disclosure label is returned as data rather than baked into
 * a string, so a card can put it where a card puts it.
 */

export interface StopView {
  id: string;
  kind: StopRef["kind"];
  /** The line a traveller reads first. */
  title: string;
  /** Neighbourhood, or the brand behind a counter. Never empty for a place. */
  subtitle: string;
  lat: number;
  lng: number;
  /** The flat-poster fallback, for when there is no photograph. */
  emoji: string;
  tint: string;
  /** Minutes to allow. Falls back to a sensible default per kind. */
  stayMin: number;
  /**
   * Set only for a POI stop. Anything reaching for a POI-only field — the story
   * id, the indoor flag, the ticket — must go through this and handle its
   * absence, which is the point of it being optional.
   */
  poi?: Poi;
  /** 「Demo・未正式合作」 on a hire car, and nothing at all on a place. */
  disclosure?: string;
}

/**
 * The reference a stop carries, derived when it has none.
 *
 * The forty-four authored stops predate `ref` and are all places, so rather than
 * rewrite every fixture — and every trip already sitting in a traveller's
 * localStorage — an absent `ref` means what it always meant.
 */
export function refOf(stop: Stop): StopRef {
  return stop.ref ?? { kind: "poi", poiId: stop.poiId };
}

/** Provider kinds do not carry an emoji of their own; the job is the picture. */
const PROVIDER_EMOJI: Record<string, string> = { driver: "🚐", guide: "🧭" };

/** How long each kind takes when the record has no opinion. */
const DEFAULT_STAY: Record<StopRef["kind"], number> = {
  poi: 60,
  merchant: 60,
  provider: 180,
  offer: 240,
  rental: 20,
  event: 90,
  place: 60,
};

/** What an OpenStreetMap place looks like on a row, by what it is. */
export const PLACE_LOOK: Record<PlaceRef["cat"], { emoji: string; tint: string; label: string }> = {
  food: { emoji: "🍴", tint: "#FDE7EA", label: "餐廳" },
  stay: { emoji: "🛏️", tint: "#E6EBFF", label: "住宿" },
  sight: { emoji: "📍", tint: "#E6EAF3", label: "景點" },
};

export function viewOf(stop: Stop): StopView | null {
  const ref = refOf(stop);
  const stay = stop.stayMin || DEFAULT_STAY[ref.kind];

  switch (ref.kind) {
    case "poi": {
      /* BY_POI rather than poi(): a missing record here is a row to skip, not
         an exception to throw. The throwing version stays for the data layer,
         where an unknown id really is a typo somebody should hear about. */
      const p = BY_POI[ref.poiId];
      if (!p) return null;
      return {
        id: stop.id,
        kind: "poi",
        title: p.name,
        subtitle: p.area,
        lat: p.lat,
        lng: p.lng,
        emoji: p.emoji,
        tint: p.tint,
        stayMin: stop.stayMin || p.stayMin,
        poi: p,
      };
    }
    case "merchant": {
      const m = BY_MERCHANT[ref.merchantId];
      if (!m) return null;
      return {
        id: stop.id,
        kind: "merchant",
        title: m.name,
        subtitle: m.area,
        lat: m.lat,
        lng: m.lng,
        emoji: m.emoji,
        tint: m.tint,
        stayMin: stay,
      };
    }
    case "provider": {
      const p = BY_PROVIDER[ref.providerId];
      if (!p) return null;
      return {
        id: stop.id,
        kind: "provider",
        /* The org, not the area: you are not going to where the driver lives,
           you are being collected by them. */
        title: p.name,
        subtitle: p.org ?? (p.kind === "driver" ? "包車司機" : "私人導遊"),
        lat: p.lat,
        lng: p.lng,
        emoji: PROVIDER_EMOJI[p.kind] ?? "🧭",
        tint: p.color,
        stayMin: stay,
      };
    }
    case "offer": {
      const o = BY_OFFER[ref.offerId];
      if (!o) return null;
      return {
        id: stop.id,
        kind: "offer",
        title: o.name,
        subtitle: o.kind === "hotel" ? "住宿" : "一日遊",
        lat: o.lat,
        lng: o.lng,
        emoji: o.emoji,
        tint: o.tint,
        stayMin: stay,
      };
    }
    case "rental": {
      const r = BY_RENTAL[ref.rentalId];
      if (!r) return null;
      return {
        id: stop.id,
        kind: "rental",
        /* The counter is the thing you navigate to; the brand is who you are
           collecting it from. A row reading 「iRent」 would not tell anybody
           standing outside the station which door to walk through. */
        title: r.pickup,
        subtitle: r.brand,
        lat: r.lat,
        lng: r.lng,
        emoji: "🚗",
        tint: "#eef2f6",
        stayMin: stay,
        disclosure: RENTAL_DISCLOSURE,
      };
    }
    case "event": {
      const e = BY_EVENT[ref.eventId];
      if (!e) return null;
      return {
        id: stop.id,
        kind: "event",
        title: e.name,
        /* The district, not the category. A row on an itinerary is telling
           somebody where to go, and 「市集」 is not a place. */
        subtitle: e.area,
        lat: e.lat,
        lng: e.lng,
        emoji: EVENT_KINDS[e.kind].emoji,
        tint: e.tint,
        stayMin: stop.stayMin || e.stayMin,
        /* Stronger than the hire cars' 「未正式合作」, because this is a
           different claim: that one says ResoMap has no agreement with a
           real company, this one says the thing on the itinerary does not
           exist. It rides on the stop itself so it cannot be left behind
           when a card is copied to a screen nobody remembered to update. */
        disclosure: "Demo・虛構活動",
      };
    }
    case "place": {
      const p = ref.place;
      const look = PLACE_LOOK[p.cat] ?? PLACE_LOOK.sight;
      return {
        id: stop.id,
        kind: "place",
        title: p.name,
        /* Where it came from, on the row itself. It is a real shop, and it is
           not one ResoMap has any arrangement with. */
        subtitle: `${p.sub || look.label}・OpenStreetMap`,
        lat: p.lat,
        lng: p.lng,
        emoji: look.emoji,
        tint: look.tint,
        /* Checking in is half an hour; a meal is an hour. */
        stayMin: stop.stayMin || (p.cat === "stay" ? 30 : 60),
      };
    }
  }
}

/** The POI behind a stop, when there is one. For code that genuinely needs it. */
export const poiOf = (stop: Stop): Poi | undefined => viewOf(stop)?.poi;

/** Resolve a whole list, dropping what no longer exists. */
export const viewsOf = (stops: Stop[]): StopView[] =>
  stops.map(viewOf).filter((v): v is StopView => v !== null);

/** Two stops are the same place when they point at the same record. */
export function sameTarget(a: Stop, b: Stop): boolean {
  return refKey(refOf(a)) === refKey(refOf(b));
}

/** A stable string for a reference — for dedupe, and for `signature()`. */
export function refKey(ref: StopRef): string {
  switch (ref.kind) {
    case "poi":
      return `poi:${ref.poiId}`;
    case "merchant":
      return `merchant:${ref.merchantId}`;
    case "provider":
      return `provider:${ref.providerId}`;
    case "offer":
      return `offer:${ref.offerId}`;
    case "rental":
      return `rental:${ref.rentalId}`;
    case "event":
      return `event:${ref.eventId}`;
    case "place":
      return `place:${ref.place.id}`;
  }
}

export const stopKey = (stop: Stop): string => refKey(refOf(stop));

/**
 * A stop as a map pin.
 *
 * `title`/`subtitle` on one side and `name`/`area` on the other is not an
 * oversight: a hire car counter has no area, it has a brand, and calling that
 * field `area` in the timeline would be a lie that reads fine in code and wrong
 * on screen. The map only needs a second line, so the rename happens here, once.
 *
 * The returned `id` is the stop's, not the record's, so a day holding the same
 * restaurant twice gets two pins that can be told apart.
 */
export const placeOf = (v: StopView) => ({
  id: v.id,
  name: v.title,
  area: v.subtitle,
  lat: v.lat,
  lng: v.lng,
  emoji: v.emoji,
  tint: v.tint,
});

/**
 * A brand new stop pointing at something.
 *
 * The clock and the inbound leg are the caller's business — they depend on
 * where in the day it lands — so this fills in only what the reference itself
 * decides: the id, the suggested stay, and the `poiId` mirror that keeps the
 * forty-four authored fixtures and every stored trip readable.
 *
 * Returns null for an id no record answers to, so a stale link appends nothing
 * rather than a row that renders as a blank.
 */
export function newStop(ref: StopRef): Stop | null {
  const probe: Stop = { id: "probe", poiId: ref.kind === "poi" ? ref.poiId : "", ref, at: "", stayMin: 0 };
  const v = viewOf(probe);
  if (!v) return null;
  return {
    id: `add-${refKey(ref).replace(":", "-")}-${Date.now()}`,
    poiId: probe.poiId,
    ref,
    at: "",
    stayMin: v.stayMin,
  };
}
