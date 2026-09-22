/**
 * 周邊推薦, as five questions a traveller actually has.
 *
 * The source demo organised this as seven rows in two groups labelled
 * 「ResoMap 付費服務」 and 「聯盟合作服務」 — which is the business model printed
 * on the traveller's screen. Nobody standing outside 龍山寺 at six in the evening
 * is thinking "I would like to browse ResoMap's paid inventory"; they are
 * thinking 吃什麼.
 *
 * So the headings are the questions, the pictures do the choosing, and where the
 * supply comes from is one quiet line at the bottom of a card — visible, because
 * a traveller has a right to know whose recommendation they are reading, but
 * never the loudest thing on it. The full disclosure sits once at the foot of
 * the screen, which is where a disclosure belongs.
 */

export type NearbyCat =
  | "restaurant"
  | "hotel"
  | "souvenir"
  | "driver"
  | "guide"
  | "aff-hotel"
  | "aff-tour"
  | "rental";

/** Who the supply belongs to. Drives one small grey label, and nothing else. */
export type NearbySource = "resomap" | "partner";

export interface NearbyCard {
  cat: NearbyCat;
  /** Which two sentences the ⓘ on this card opens. */
  info: "partner" | "affiliate";
  /** The card's own line — what you get, not what it is called internally. */
  title: string;
  sub: string;
  source: NearbySource;
  /** The quiet label. Named platforms only where a platform is involved. */
  label: string;
  emoji: string;
  /** Illustrative photo under public/demo/. */
  photo?: string;
  /** A real, credited T0 photograph that reads as this category. */
  photoFromPoi?: string;
  /** A provider whose portrait illustrates this category. For 私人導遊 and
      包車司機, where the thing being offered is a person and a photograph of a
      street would answer a different question. */
  portraitOf?: string;
  /** Half-width. Two of these sit side by side in one section. */
  half?: boolean;
}

export interface NearbySection {
  id: string;
  question: string;
  cards: NearbyCard[];
}

/* V3: ResoMap has not signed a single merchant, driver or guide yet, so the
   four questions that were answered with ResoMap's own supply — 吃什麼、帶什麼
   回家、需要人帶你玩、and ResoMap's half of 今晚住哪 — are gone. What is left is
   answered by somebody else's real inventory: Klook and KKday tours, Booking
   and Agoda rooms, and hire counters that exist. The categories stay in
   `NearbyCat`, and the merchant screens stay in the codebase, for the day
   there is supply to put behind them. */
export const NEARBY_SECTIONS: NearbySection[] = [
  {
    id: "experience",
    question: "更多旅遊體驗",
    cards: [
      {
        cat: "aff-tour",
        title: "Local tour",
        sub: "一日遊、體驗行程，由合作平台出團",
        source: "partner",
        label: "聯盟合作 · Klook / KKday",
        info: "affiliate",
        emoji: "🎫",
        photoFromPoi: "jiufen",
      },
    ],
  },
  {
    id: "stay",
    question: "今晚住哪？",
    cards: [
      {
        cat: "aff-hotel",
        title: "附近住宿",
        sub: "更多房型與即時房況",
        source: "partner",
        label: "Booking / Agoda",
        info: "affiliate",
        emoji: "🏨",
        photoFromPoi: "beitou",
      },
    ],
  },
  {
    id: "get-around",
    question: "要自己開嗎？",
    cards: [
      {
        cat: "rental",
        title: "附近租車",
        sub: "車站與市區的取車點",
        /* Neither ResoMap's own supply nor an affiliate programme: real
           companies with no relationship to either. The label says so, and
           every card in the list repeats it. */
        source: "partner",
        label: "Demo・未正式合作",
        info: "affiliate",
        emoji: "🚗",
      },
    ],
  },
];

/** Flat lookup — NearbyList takes a `cat` off the route and needs its labels. */
export const ALL_NEARBY_CARDS: NearbyCard[] = NEARBY_SECTIONS.flatMap((s) => s.cards);

const BY_CAT: Record<NearbyCat, NearbyCard> = Object.fromEntries(
  ALL_NEARBY_CARDS.map((c) => [c.cat, c]),
) as Record<NearbyCat, NearbyCard>;

export const nearbyCategory = (id: NearbyCat) => BY_CAT[id];

/** The two search radii the demo offers. Metres, so lib/geo can use them raw. */
export const RANGES = [5000, 10000] as const;
export type Range = (typeof RANGES)[number];

/**
 * The line at the foot of 周邊推薦.
 *
 * One sentence. It used to be four, spelling out review, paid weighting and
 * every platform ResoMap has no agreement with — all true, none of it what
 * somebody deciding where to eat came for. The detail moved behind the ⓘ on
 * each card and into 我的 → 關於這個 Demo.
 */
export const NEARBY_DISCLOSURE_SHORT =
  "行程、住宿與租車資料皆為示意，價格與供應以各平台為準。ResoMap 目前沒有合作商家。";
