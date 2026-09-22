import { createContext, useContext } from "react";
import type { Deal, PlanAudience, ServiceId, StoryLength, Trip } from "./types";
import type { NearbyCat } from "./data/nearbyCategories";
import type { StopRef } from "./types";
import type { SearchCat } from "./data/affiliateLinks";

/**
 * A route stack on top of the tabs. No router library: every flow in this app
 * is short and linear, and a dependency that exists to express `push`/`pop`
 * would be paying rent on a problem we do not have.
 */
export type Route =
  | { k: "search"; q: string }
  | { k: "dest"; id: string }
  | { k: "poi"; id: string }
  | { k: "create"; destId?: string }
  | { k: "trip"; id: string }
  | { k: "day"; tripId: string; n: number }
  | { k: "tripmap"; tripId: string; n: number }
  | { k: "travellers"; tripId: string }
  | { k: "consensus"; tripId: string }
  | { k: "alternatives"; tripId: string }
  | { k: "stay"; destId?: string }
  | { k: "tickets"; destId?: string }
  | { k: "product"; id: string }
  | { k: "transport"; destId?: string }
  | { k: "carrental"; destId?: string }
  | { k: "service"; id: ServiceId }
  | { k: "expenses"; tripId: string; add?: boolean }
  | { k: "settle"; tripId: string }
  | { k: "today"; tripId: string }
  /* `tab` lets a caller land on a specific category. 在地優惠 on the home grid
     needs it: the local-merchant deals live under 更多, and dropping the reader
     on 為你推薦 and letting them hunt is the difference between an entry point
     and a link. */
  | { k: "deals"; tab?: DealsTab }
  | { k: "saved" }
  | { k: "language" }
  | { k: "coupons" }
  | { k: "coedit"; tripId: string }
  | { k: "business" }
  | { k: "demo" }
  /* Map and profile stopped being tabs: one is a way of finding a place, not a
     destination; the other was thirteen rows of 即將推出. */
  | { k: "map" }
  | { k: "profile" }
  /* 一起規劃. The room itself is the tab root, so it needs no route. */
  | { k: "prefs" }
  | { k: "pool" }
  | { k: "consensus2" }
  /* V2 — 語音清單、周邊推薦、商家與專業會員、訂閱。
     Appended rather than woven in: every route above is a T0 screen that still
     works exactly as it did, and a reader diffing this file should be able to
     see in one glance which half arrived with the merchant brief. */
  | { k: "audios"; poiId: string }
  | { k: "addAudio"; poiId?: string }
  | { k: "nearby"; poiId: string }
  /* The radius travels with the route. Somebody who widened the search to
     10 km and then opened 包車司機 meant to keep it wide; resetting to 5 km
     inside the list threw away the one decision they had made. */
  | { k: "nearbyList"; poiId: string; cat: NearbyCat; range?: number }
  | { k: "merchant"; id: string }
  | { k: "provider"; id: string }
  /* Somebody else's listing. Shops and people had a page; a hotel or a tour on
     Klook had only a link, so the one thing a traveller could do with it was
     leave the app. */
  | { k: "offer"; id: string }
  /* A hire car counter. Real company, no agreement — see data/carRentals.ts. */
  | { k: "rental"; id: string }
  /* A festival or a market, and an invented one — see data/events.ts. */
  | { k: "event"; id: string }
  /* All of them, by city. The rail on the home screen only ever shows what
     is genuinely near, which leaves most of them unreachable without this. */
  | { k: "events" }
  /* The conversation. With a tripId it edits that trip; without one it plans a
     new one. Same screen and same engine — what changes is what it can act on. */
  | { k: "chat"; tripId?: string }
  /* Boarding passes and booking codes, on this device only. */
  | { k: "docs" }
  | { k: "reviews"; kind: "merchant" | "provider"; id: string }
  | { k: "subscribe"; audience?: PlanAudience }
  | { k: "pro" }
  /* V3 — 更多優惠的搜尋結果：一個關鍵字、一個分類，交給 Klook 和 KKday。 */
  | { k: "dealSearch"; q: string; cat: SearchCat; from?: string; to?: string }
  /* V3 round 2 — 行李清單 for one trip. */
  | { k: "packing"; tripId: string };

/* 導覽庫 replaced 優惠 in the bar. Deals did not go away — it moved behind the
   trip that gives it a reason to exist, which is what MODEL B claims anyway:
   a shop window nobody asked for earns less than an offer at the moment of
   need. The `deals` route still renders the same six-tab screen. */
export type Tab = "explore" | "library" | "trips" | "deals";

/** The 優惠 screen's own tabs. Mirrored in Deals.tsx's TABS. */
export type DealsTab = "reco" | "ticket" | "stay" | "transport" | "car" | "more";

/**
 * Everything a screen is allowed to do to the rest of the app.
 *
 * Screens receive this and nothing else — no store, no dispatch, no direct
 * setState. It keeps each screen independently readable, and it is the reason
 * a screen can be rewritten without reading App.tsx.
 */
export interface Nav {
  go: (r: Route) => void;
  /**
   * Swap the screen on top for another, without growing the stack. The trip's
   * 總覽 / 第 N 天 tabs are one screen to the traveller, so moving between
   * them must not make 返回 walk back through every tab they looked at.
   */
  replace: (r: Route) => void;
  back: () => void;
  /** Switch tab and clear the stack. */
  tab: (t: Tab) => void;

  /**
   * The traveller's LIVE trips.
   *
   * Screens must read this, never the static exports in data/trips.ts. Those
   * are the starting fixtures; the moment somebody adds a stop or applies an
   * adjustment they are stale, and a screen reading them will cheerfully report
   * success against a trip that no longer exists.
   */
  trips: Trip[];

  /* ---- things that open over the current screen rather than replacing it -- */
  /** Open the outbound sheet for a commercial link. */
  openDeal: (d: Deal) => void;
  /** Open the "you have arrived" prompt for a POI with a story. */
  arrive: (poiId: string) => void;
  /**
   * Open the audio story directly (from a POI page or the arrival sheet).
   * `length` picks the edit: the 30 秒 one people play in a queue, or the full
   * one. Defaults to the full edit when the caller has no opinion.
   */
  play: (poiId: string, length?: StoryLength) => void;
  /**
   * Open one specific guide — a merchant's recording or a traveller's upload.
   *
   * Separate from `play` because they identify different things: `play` names a
   * place and lets the player pick the edit, which is right for ResoMap's own
   * fifteen guides and their 30 秒 / 完整 pair. A community upload has one edit
   * and is not the only guide at its place, so it has to be named directly.
   * Both land in the same player.
   */
  playAudio: (audioId: string) => void;
  /** Open the quick-add sheet for an itinerary day. */
  addTo: (tripId: string, day: number) => void;
  /** Open the 更多服務 sheet. */
  moreServices: () => void;

  /* ---------------------------------------------------------- trip state -- */
  /**
   * Put something into a trip day.
   *
   * The app's only add path, and it takes a reference rather than a POI id
   * because a day can now hold a hire car counter, a restaurant, a guide or a
   * day tour. It owns the appended stop, the analytics event and the toast, so
   * a caller never fires its own confirmation.
   */
  addStop: (tripId: string, day: number, ref: StopRef) => void;
  /** V3 — ＋ on the trip's tabs: an empty day after the last one. */
  addDay: (tripId: string) => void;
  /** V3 — － on the trip's tabs: drop the last day. The caller asks first. */
  removeDay: (tripId: string) => void;
  /** Create the demo trip for a destination and open it. */
  createTrip: (destId: string) => void;
  /**
   * Put a fully-formed trip into live state and open it.
   *
   * Used by the AI planner, which builds the whole itinerary before anybody
   * agrees to keep it. Always adds rather than replaces: generating a second
   * plan for the same city is a second plan, not a correction of the first.
   */
  saveTrip: (trip: Trip) => void;
  /**
   * Pull a scripted demo itinerary into live state and open it.
   *
   * Accepting the group's consensus has to produce a trip they can actually
   * open. Navigating to a trip id that only exists in the fixtures lands on a
   * blank screen — the one place in the flow where the payoff is supposed to be.
   */
  adoptTrip: (tripId: string) => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const n = useContext(NavContext);
  if (!n) throw new Error("useNav outside NavContext");
  return n;
}
