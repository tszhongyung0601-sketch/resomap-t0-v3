/**
 * ResoMap — a journey layer.
 *
 * Before the trip: explore, plan, book. During it: navigate, adapt, listen,
 * discover. The domain model below is written around that arc, not around the
 * feature list — which is why there is no "dashboard", "funnel" or "score" type
 * anywhere in it. Those are things the business needs to know; they are not
 * things a traveller has.
 *
 * Everything here is demo data. Nothing in this file implies a commercial
 * relationship with any of the platforms named in `AffiliatePartner`.
 */

/* --------------------------------------------------------------- partners */

export type PartnerId = "klook" | "kkday" | "booking" | "agoda" | "tripcom";

export interface AffiliatePartner {
  id: PartnerId;
  name: string;
  /** What this platform is used for in the demo. */
  kinds: DealCategory[];
  /** Where an outbound tap would go. Never opened — the demo simulates it. */
  site: string;
  tint: string;
}

/* ----------------------------------------------------------- destinations */

export type CountryId = "tw" | "jp" | "kr";

export const COUNTRY_LABELS: Record<CountryId, string> = {
  tw: "台灣",
  jp: "日本",
  kr: "韓國",
};

/**
 * Which single ResoMap capability a demo city is built to show. Four cities
 * each doing one thing well beats four cities each doing everything badly.
 */
export type DemoAngle = "city" | "story" | "weather" | "group";

export interface Destination {
  id: string;
  name: string;
  country: CountryId;
  /** One line under the name on the destination page. */
  tagline: string;
  emoji: string;
  tint: string;
  lat: number;
  lng: number;
  zoom: number;
  /** Set only on the four cities with a scripted scenario. */
  angle?: DemoAngle;
}

/** A place people travel to that is not a city — a coast, a mountain, a town. */
export interface TravelRegion {
  id: string;
  name: string;
  /** The city or county it hangs off, for the subtitle. */
  near: string;
  tagline: string;
  emoji: string;
  tint: string;
  lat: number;
  lng: number;
  zoom: number;
}

/* ------------------------------------------------------------------- poi */

export type PoiKind =
  | "attraction"
  | "food"
  | "nature"
  | "shopping"
  | "activity"
  | "stay"
  | "transit";

export const POI_KIND_LABELS: Record<PoiKind, string> = {
  attraction: "景點",
  food: "美食",
  nature: "自然",
  shopping: "購物",
  activity: "活動",
  stay: "住宿",
  transit: "交通",
};

export interface Poi {
  id: string;
  name: string;
  destId: string;
  /** Neighbourhood, shown as the second line. */
  area: string;
  kind: PoiKind;
  lat: number;
  lng: number;
  /** Stands in for a photo — a flat tint and one emoji, so nothing loads. */
  emoji: string;
  tint: string;
  about?: string;
  /** Suggested visit length, used when adding to an itinerary. */
  stayMin: number;
  indoor?: boolean;
  /** Set when this place has a recorded ResoMap story. */
  storyId?: string;
  /**
   * Only true where a real venue genuinely sells an admission ticket. Ordinary
   * temples, streets and parks must never show a ticket CTA — pretending a free
   * park needs a ticket is how a travel app stops being believable.
   */
  ticketed?: boolean;
  tags?: string[];
}

/* --------------------------------------------------------------- stories */

export type StoryLength = "short" | "full";

export interface Story {
  id: string;
  poiId: string;
  title: string;
  /** One line on a card, before anybody commits three minutes. */
  hook: string;
  /** Who recorded it. ResoMap's guides are made by people, and it says so. */
  narrator: string;
  plays: number;
  likes: number;
  /**
   * Two edits of the same story. 30 秒 is the one people actually play while
   * standing in a queue; 3 分鐘 is for when the place turns out to be worth it.
   * Both are sentences joined by "|" — one utterance per sentence, because
   * Chrome truncates long speech and `onboundary` is unreliable for Chinese.
   */
  short: string;
  body: string;
  /** Minutes shown against the full edit. The short one is always ~30 秒. */
  minutes: number;
  /** What the guide has been recorded in. Demo: only 中文 actually speaks. */
  languages: string[];
}

/* ----------------------------------------------------------------- deals */

export type DealCategory =
  | "ticket"
  | "stay"
  | "transport"
  | "esim"
  | "insurance"
  | "local";

export const DEAL_CATEGORY_LABELS: Record<DealCategory, string> = {
  ticket: "門票",
  stay: "住宿",
  transport: "交通",
  esim: "eSIM",
  insurance: "旅平險",
  local: "在地優惠",
};

export interface Deal {
  id: string;
  category: DealCategory;
  title: string;
  /**
   * The platform an outbound tap would go to. Absent for a direct merchant
   * offer — a 牛肉湯 shop does not come through an OTA, and naming one on that
   * card would be inventing a supply chain as well as a partnership.
   */
  partner?: PartnerId;
  /** Indicative price only. The demo never claims a live rate. */
  priceTwd: number;
  unit?: string;
  destId?: string;
  poiId?: string;
  emoji: string;
  tint: string;
  /** Paid placement. Always rendered with a visible label. */
  sponsored?: boolean;
  /** Local merchant supply that does not exist yet. Shown, never bookable. */
  comingLater?: boolean;
  /**
   * Why this is being shown, in the traveller's terms — "你已加入迪士尼",
   * "與 Day 2 行程相關". A recommendation that cannot say why it is here is
   * indistinguishable from an advert, and gets treated like one.
   */
  reason?: string;
}

/* ------------------------------------------------- tickets & experiences */

export type ProductCategory = "attraction" | "themepark" | "exhibition" | "experience" | "daytour";

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  attraction: "景點門票",
  themepark: "樂園",
  exhibition: "展覽",
  experience: "體驗",
  daytour: "一日遊",
};

/** One bookable thing, with what each platform indicatively charges for it. */
export interface AffiliateProduct {
  id: string;
  name: string;
  blurb: string;
  category: ProductCategory;
  destId: string;
  poiId?: string;
  emoji: string;
  tint: string;
  /** Indicative figures for comparison only. Never presented as a live quote. */
  offers: { partner: PartnerId; priceTwd: number }[];
  popular?: boolean;
}

/* -------------------------------------------------------------- services */

export type ServiceId =
  | "plan"
  | "tickets"
  | "stay"
  | "transport"
  | "carrental"
  | "more"
  | "flight"
  | "esim"
  | "insurance"
  | "coupon"
  | "tools";

export interface Service {
  id: ServiceId;
  label: string;
  icon: string;
  /** Copy for the sheet row; the five home shortcuts show label only. */
  note?: string;
}

/* ------------------------------------------------------------- travellers */

export type TravellerId = "mickey" | "amy" | "john" | "susan";

export type InterestId =
  | "food"
  | "culture"
  | "nature"
  | "shopping"
  | "photo"
  | "family"
  | "nightlife"
  | "themepark";

export const INTEREST_LABELS: Record<InterestId, string> = {
  food: "美食",
  culture: "文化",
  nature: "自然",
  shopping: "購物",
  photo: "拍照",
  family: "親子",
  nightlife: "夜生活",
  themepark: "樂園",
};

export interface Traveller {
  id: TravellerId;
  name: string;
  initial: string;
  color: string;
  likes: InterestId[];
  /** One plain-language constraint, shown only where it matters. */
  note?: string;
}

/* ------------------------------------------------------------- itinerary */

export type LegMode =
  | "walk"
  | "train"
  | "bus"
  | "taxi"
  | "drive"
  /* V3 — the day-wide choices a traveller makes on 設定交通方式. `transit` is
     大眾運輸 as a whole, because a planner that says 捷運 between two points
     is claiming a line runs there; `self` is 自行安排, a leg with no clock. */
  | "scooter"
  | "transit"
  | "self";

export const LEG_LABEL: Record<LegMode, string> = {
  walk: "步行",
  train: "捷運",
  bus: "公車",
  taxi: "計程車",
  drive: "開車",
  scooter: "機車",
  transit: "大眾運輸",
  self: "自行安排",
};

/** The five a traveller can pick for a whole day, in the order the sheet lists them. */
export type DayMode = "self" | "drive" | "transit" | "walk" | "scooter";
export const DAY_MODES: DayMode[] = ["self", "drive", "transit", "walk", "scooter"];

export interface Leg {
  mode: LegMode;
  min: number;
  metres: number;
}

/**
 * What a stop points at.
 *
 * A trip used to be a list of places, so a stop was a POI id and nothing else.
 * V3 lets a traveller put a hire car, a restaurant, a guide or a day tour into
 * the same day, and those are not POIs — they live in `merchants.ts`,
 * `providers.ts`, `affiliateOffers.ts` and `carRentals.ts`.
 *
 * A discriminated union rather than four optional id fields, so a stop cannot
 * be half a restaurant and half a hire car, and so `lib/stop.ts` can resolve one
 * with a `switch` the compiler checks rather than a chain of `if (x?.id)`.
 */
export type StopRef =
  | { kind: "poi"; poiId: string }
  | { kind: "merchant"; merchantId: string }
  | { kind: "provider"; providerId: string }
  | { kind: "offer"; offerId: string }
  | { kind: "rental"; rentalId: string }
  /* A festival or a market. The sixth kind, and the first one that is a
     time as much as a place — which is why it is the only one an itinerary
     can refuse: see `daysMatching`. */
  | { kind: "event"; eventId: string }
  /* V3 — a real place ResoMap has no record of: a restaurant or a hotel off
     OpenStreetMap, picked on the home map. There is no table to look it up
     in, so the stop carries its own name and coordinates. */
  | { kind: "place"; place: PlaceRef };

/** A real place from OpenStreetMap — never a ResoMap partner. */
export interface PlaceRef {
  /** `osm:node/123` */
  id: string;
  name: string;
  lat: number;
  lng: number;
  cat: "food" | "stay" | "sight";
  /** 餐廳 / 咖啡廳 / 飯店 / 民宿 … */
  sub?: string;
}

export interface Stop {
  id: string;
  /**
   * Kept, and kept first, because forty-four authored stops carry it and every
   * one of them is still a place. For a POI stop it equals `ref.poiId`; for the
   * rest it is empty, which is the signal to go through `viewOf()` instead of
   * calling `poi()`.
   */
  poiId: string;
  /** Absent on the authored fixtures, which are all POIs — see `refOf()`. */
  ref?: StopRef;
  at: string; // "HH:MM"
  stayMin: number;
  meal?: "lunch" | "dinner";
  /** Travel in from the previous stop. */
  from?: Leg;
  /** Set when an in-trip adjustment touched this stop. */
  changed?: string;
  /** Only used on a split day. */
  who?: TravellerId[];
}

export interface Track {
  id: string;
  label?: string;
  who: TravellerId[];
  stops: Stop[];
}

export interface Day {
  n: number;
  date: string; // "8 月 20 日"
  weekday: string;
  tracks: Track[];
  meetUp?: { poiId: string; at: string };
  /** V3 — how this day gets around, set on 設定交通方式. Absent means nobody chose. */
  mode?: DayMode;
}

export type TripPhase = "upcoming" | "soon" | "ongoing";

export interface Trip {
  id: string;
  destId: string;
  title: string;
  dates: string;
  nights: number;
  phase: TripPhase;
  /** Days until departure, for the "還有 2 天出發" line. */
  daysUntil?: number;
  /** Which day the traveller is on once the trip is ongoing. */
  today: number;
  /** Empty for a solo trip; group coordination is optional, not a gate. */
  travellers: TravellerId[];
  days: Day[];
  /** Set when the trip has no accommodation yet, so the app can offer to help. */
  needsStay?: boolean;
}

/* --------------------------------------------------------------- consensus */

export interface Agreement {
  label: string;
  who: TravellerId[];
}

export interface Conflict {
  topic: string;
  wants: TravellerId[];
  against: TravellerId[];
  againstReason: string;
  suggestion: {
    day: number;
    groups: { who: TravellerId[]; where: string }[];
    meet: { at: string; where: string };
  };
  alternatives: { id: string; label: string; why: string }[];
}

/* ------------------------------------------------------------------ adapt */

export type AdaptTrigger = "late" | "rain" | "closed" | "full";

export interface AdaptPlan {
  /** Stop ids removed by this plan. */
  drop: string[];
  /** Stop id -> replacement POI id. */
  swap?: Record<string, string>;
  /** What survives, in the traveller's words. */
  keeps: string[];
}

export interface Adapt {
  id: string;
  tripId: string;
  day: number;
  trigger: AdaptTrigger;
  icon: string;
  /** The observation, in one short sentence. */
  headline: string;
  /** What happens if nothing changes. */
  consequence: string;
  /** Directions offered before the AI proposes anything concrete. */
  choices: string[];
  /** Minutes behind schedule; drives both the warning and the new times. */
  delayMin?: number;
  /** Label stamped on a swapped stop. */
  swapNote?: string;
  plan: AdaptPlan;
  cta: string;
}

/* ------------------------------------------------- collaborative planning */

export type Pace = "easy" | "normal" | "packed";

export const PACE_LABELS: Record<Pace, string> = {
  easy: "輕鬆",
  normal: "適中",
  packed: "特種兵",
};

/**
 * What one traveller wants out of the trip.
 *
 * Short on purpose. A form your friends will not finish is worth less than no
 * form at all, and the whole feature depends on four people completing it in a
 * LINE group at eleven at night.
 */
export interface Preference {
  interests: InterestId[];
  pace: Pace;
  /** 1–3, rendered as $ / $$ / $$$. */
  budget: 1 | 2 | 3;
  /** Free text: the thing somebody insists on is often not in the POI set. */
  mustGo: string;
  avoid: string;
}

export interface RoomMember {
  id: TravellerId;
  /** Absent until they have actually filled it in. */
  preference?: Preference;
}

export type VoteValue = "yes" | "maybe" | "no";

export const VOTE_LABELS: Record<VoteValue, string> = {
  yes: "想去",
  maybe: "都可以",
  no: "不想去",
};

export interface Vote {
  poiId: string;
  who: TravellerId;
  value: VoteValue;
}

export interface Room {
  id: string;
  destId: string;
  title: string;
  dates: string;
  members: RoomMember[];
  /** The shortlist everybody is voting on. */
  poiIds: string[];
  votes: Vote[];
}

/* ---------------------------------------------------------------- expenses */

export type ExpenseCategory = "food" | "stay" | "transport" | "ticket" | "shop" | "other";

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  food: "餐飲",
  stay: "住宿",
  transport: "交通",
  ticket: "門票",
  shop: "購物",
  other: "其他",
};

export const EXPENSE_ICONS: Record<ExpenseCategory, string> = {
  food: "🍜",
  stay: "🏨",
  transport: "🚆",
  ticket: "🎟️",
  shop: "🛍️",
  other: "☕",
};

/**
 * How one bill is divided.
 *
 * "even" is the case that actually happens; the other two exist because the one
 * time a group needs them — somebody skipped the meal, two people shared a room
 * — is the time an app that only does even splits gets abandoned for a
 * spreadsheet.
 */
export type SplitMode = "even" | "amount" | "share";

export interface Expense {
  id: string;
  tripId: string;
  /** TWD. Integer — nobody splits a bill to the cent on holiday. */
  amountTwd: number;
  category: ExpenseCategory;
  note: string;
  /** Who actually paid the whole bill. */
  paidBy: TravellerId;
  /** Who it was for. Paying for somebody not on this list is the point. */
  forWhom: TravellerId[];
  mode: SplitMode;
  /**
   * Only for "amount" (TWD per person) and "share" (relative weights).
   * Absent for an even split, where the numbers are derivable.
   */
  custom?: Partial<Record<TravellerId, number>>;
  /** The itinerary day it belongs to, so the list can group by date. */
  day: number;
  date: string;
}

/** One person's net position: positive means the group owes them. */
export interface Balance {
  who: TravellerId;
  net: number;
}

/** One suggested payment that clears part of the debt. */
export interface Transfer {
  from: TravellerId;
  to: TravellerId;
  amount: number;
}

/* ----------------------------------------------------------------- events */

export type EventName =
  | "trip_created"
  | "trip_view"
  | "day_view"
  | "poi_view"
  | "poi_add"
  | "search"
  | "destination_view"
  | "consensus_view"
  | "consensus_accept"
  | "adapt_shown"
  | "adapt_applied"
  | "adapt_dismissed"
  | "story_play"
  | "story_finish"
  | "affiliate_impression"
  | "affiliate_click"
  | "affiliate_outbound"
  | "mock_booking"
  | "story_open"
  | "directions_open"
  | "room_view"
  | "pref_saved"
  | "vote_cast"
  /* The generated itinerary was kept. The one number that says whether the
     wizard produced something anybody wanted. */
  | "ai_plan_saved";

export interface TrackedEvent {
  name: EventName;
  at: number;
  partner?: PartnerId;
  category?: DealCategory;
  destId?: string;
  dealId?: string;
  poiId?: string;
  /** Which product the event was about, when it was about one. */
  productId?: string;
  tripId?: string;
  /** Indicative value of a simulated booking, in TWD. */
  valueTwd?: number;
}

/* ==========================================================================
   V2 — 語音、商家、專業服務者、聯盟商品、訂閱
   ==========================================================================

   Everything below arrived with the "周邊推薦 × 商家訂閱 × 專業會員" brief.
   It follows the same rule as the rest of this file: the model is written
   around what a traveller (or a merchant) actually has, not around the slide
   that asked for it. There is no "exposure score" field and no "tier" enum —
   ranking is derived in lib/nearby.ts from figures that mean something on
   their own, so a weight can change without a data migration.                */

/* ---------------------------------------------------------------- contact */

/**
 * How to reach a merchant or a service provider.
 *
 * Every field is optional and every field is a real URL when it is present.
 * The rule the UI enforces (lib/contact.ts): a URL that exists is genuinely
 * opened; a URL that does not exist produces a sheet that says what would have
 * happened. Hard-coding "this opens LINE" into a button would make the demo
 * unable to ever become real, and hard-coding a fake LINE id would make it
 * open somebody else's account.
 */
export interface Contact {
  lineUrl?: string;
  whatsappUrl?: string;
  /** E.164 or local. Rendered as `tel:`. */
  phone?: string;
  bookingUrl?: string;
}

/* ---------------------------------------------------------------- reviews */

export interface Review {
  id: string;
  /** 1–5, one decimal at most. */
  rating: number;
  comment: string;
  /** Display name. No account system, so this is all there is. */
  user: string;
  /** "2026-07-14" — sorted on, so it stays ISO. */
  date: string;
}

/** Anything that can be rated. Both Merchant and Provider satisfy it. */
export interface Rated {
  rating: number;
  reviewCount: number;
}

/* ------------------------------------------------------------------ audio */

/**
 * Who recorded a guide, which is also what decides where it sits in the list.
 *
 *  · `resomap`   — ResoMap's own commissioned guides. These are the fifteen in
 *                  data/stories.ts; the AudioGuide record is derived from the
 *                  Story so there is exactly one copy of that text.
 *  · `merchant`  — a paying merchant's own content. At most two per place, and
 *                  always pinned above the rest with a visible label.
 *  · `community` — uploaded by a traveller or a local. The multilingual layer.
 */
export type AudioKind = "resomap" | "merchant" | "community";

/** What a merchant recorded. Drives the small label under the title. */
export type AudioTopic = "intro" | "product" | "founder" | "promo";

export const AUDIO_TOPIC_LABELS: Record<AudioTopic, string> = {
  intro: "店家介紹",
  product: "必買商品",
  founder: "創辦故事",
  promo: "優惠活動",
};

export interface AudioGuide {
  id: string;
  poiId: string;
  kind: AudioKind;
  title: string;
  /** One line under the title, on a card. */
  hook: string;
  narrator: string;
  /** Demo: only 中文 is actually spoken. Everything else runs as subtitles. */
  language: string;
  minutes: number;
  /** Display length, "03:42". Derived when absent. */
  clock?: string;
  plays: number;
  likes: number;
  /**
   * Sentences joined by "|", one utterance each — the same contract
   * data/stories.ts keeps, because both go through lib/speech.ts.
   */
  body: string;
  /** Only on `merchant` guides. */
  merchantId?: string;
  /** 1 or 2. The whole pinned block is capped at two by lib/audio.ts. */
  featuredOrder?: 1 | 2;
  topic?: AudioTopic;
}

/* -------------------------------------------------------------- merchants */

export type MerchantCategory = "restaurant" | "hotel" | "souvenir";

export const MERCHANT_CATEGORY_LABELS: Record<MerchantCategory, string> = {
  restaurant: "餐廳",
  hotel: "旅館",
  souvenir: "土產店",
};

/**
 * Whether ResoMap has actually checked this record.
 *
 * Paying is not the same as being approved, and the badge depends on both —
 * see `isVerifiedPartner` in lib/nearby.ts. Keeping the two as separate fields
 * is what makes that rule expressible; a single `verified: boolean` would let
 * a paid-but-unchecked listing wear the mark.
 */
export type ReviewStatus = "approved" | "pending" | "rejected";

export interface Merchant extends Rated {
  id: string;
  name: string;
  category: MerchantCategory;
  destId: string;
  area: string;
  lat: number;
  lng: number;
  /** The fallback when there is no photograph — the same poster the app draws
      for a POI with no shot in the manifest. */
  emoji: string;
  tint: string;
  /** An illustrative photo under public/demo/, without the size suffix. */
  photo?: string;
  /** A POI whose real, credited photograph this record borrows — a location
      shot of the street it is on. Takes precedence over `photo`. */
  photoFromPoi?: string;
  /** One sentence. The card shows this; the detail page shows everything. */
  desc: string;
  promo?: string;
  hours: string;
  address: string;
  languages: string[];
  isPaid: boolean;
  reviewStatus: ReviewStatus;
  /** At most two, and the cap is enforced where they are read. */
  featuredAudioIds?: string[];
  contact: Contact;
}

/* -------------------------------------------------------------- providers */

/**
 * A professional member. One person is a driver or a guide, never both.
 *
 * The exclusivity is not a validation rule bolted on afterwards — a record
 * carries exactly one `kind`, and the account store (lib/account.ts) holds one
 * plan, so there is no state in which somebody is both.
 */
export type ProviderKind = "driver" | "guide";

export const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  driver: "包車司機",
  guide: "私人導遊",
};

export interface Provider extends Rated {
  id: string;
  kind: ProviderKind;
  name: string;
  /** The studio or company they work under, when there is one. */
  org?: string;
  /** Drawn when there is no photograph — and it is also the small avatar the
      detail page keeps beside the name. */
  initial: string;
  color: string;
  /** An illustrative portrait under public/demo/, without the size suffix. */
  photo?: string;
  /** Where they are based — used for the distance from a place. */
  destId: string;
  area: string;
  lat: number;
  lng: number;
  areas: string[];
  languages: string[];
  servedCount: number;
  /** "趟" for a driver, "位旅客" for a guide. */
  servedUnit: string;
  priceFromTwd: number;
  priceToTwd: number;
  /** "半日" / "場". */
  priceUnit: string;
  hours: string;
  intro: string;
  /** Signature routes for a driver, themes for a guide. */
  themes: string[];
  /** Driver only. */
  vehicle?: string;
  seats?: number;
  /** Guide only. */
  serviceType?: string;
  isPaid: boolean;
  reviewStatus: ReviewStatus;
  contact: Contact;
}

/* ------------------------------------------------------- affiliate supply */

/**
 * A bookable thing on somebody else's platform, with the affiliate plumbing
 * modelled properly rather than faked at the button.
 *
 * `affiliateUrl` is empty in the demo, and that is the point: the component
 * reads the field, opens it when it is there, and shows what would happen when
 * it is not. Signing a real programme is then a data change, not a code change.
 *
 * Separate from `AffiliateProduct` (the ticket comparison model) on purpose:
 * that one holds several platforms' prices for one attraction, this one is a
 * single platform's single listing near a place.
 */
export interface AffiliateOffer {
  id: string;
  kind: "hotel" | "tour";
  partner: PartnerId;
  name: string;
  /** The platform's own id for this listing. */
  productId: string;
  /** Empty until a programme exists. Never invented. */
  affiliateUrl: string;
  trackingId: string;
  commissionType: "percentage" | "fixed";
  /** 0.04 = 4%. Indicative public range, not a negotiated rate. */
  commissionRate?: number;
  destId: string;
  lat: number;
  lng: number;
  priceTwd: number;
  priceUnit: string;
  rating: number;
  /** Booking and Agoda score out of 10; Klook and KKday out of 5. */
  ratingScale: 5 | 10;
  blurb: string;
  emoji: string;
  tint: string;
  photo?: string;
  photoFromPoi?: string;
}

/**
 * A car hire counter near a place.
 *
 * Separate from `AffiliateOffer` because hiring a car is not booking a room: it
 * has a pickup counter with an address you have to physically reach, an opening
 * time you have to reach it by, and a vehicle class rather than a room type. It
 * is separate from `Merchant` because ResoMap has reviewed none of these and
 * takes no money from them, so it must not be able to earn 推薦夥伴 — there is
 * deliberately no `isPaid` or `reviewStatus` field to set.
 *
 * Every one of these is a real company that has no agreement with ResoMap,
 * which is why `RENTAL_DISCLOSURE` is printed on each card rather than once at
 * the foot of a screen. `url` is empty for the same reason `affiliateUrl` is:
 * the component reads the field and explains what would happen, and signing a
 * programme later is a data change rather than a code change.
 */
export interface CarRental {
  id: string;
  brand: string;
  /** A hire company's own counter, or a platform that resells several. */
  kind: "brand" | "ota";
  destId: string;
  /** The counter, in words a traveller can hand to a taxi driver. */
  pickup: string;
  area: string;
  lat: number;
  lng: number;
  /** An example vehicle at this price, not the only one available. */
  model: string;
  seats: number;
  priceTwd: number;
  /** "日" for a daily rate, "小時" for the by-the-hour operators. */
  priceUnit: string;
  rating: number;
  reviewCount: number;
  hours: string;
  /** One sentence — what makes this counter different from the one next door. */
  note: string;
  /** Empty in the demo. See the note above. */
  url: string;
}

/* ----------------------------------------------------------- subscription */

export type PlanAudience = "member" | "merchant" | "guide" | "driver";

export const PLAN_AUDIENCE_LABELS: Record<PlanAudience, string> = {
  member: "一般會員",
  merchant: "商家會員",
  guide: "導遊會員",
  driver: "包車會員",
};

export interface SubscriptionPlan {
  id: string;
  audience: PlanAudience;
  name: string;
  tagline: string;
  /**
   * `null` means the price has not been decided.
   *
   * There is no subscription pricing anywhere in this codebase or in the
   * source demo, so there is none here either. A plausible-looking NT$ 990
   * would be the one number on the screen somebody quotes in a meeting.
   */
  priceTwd: number | null;
  period?: "month" | "year";
  features: string[];
  note?: string;
}
