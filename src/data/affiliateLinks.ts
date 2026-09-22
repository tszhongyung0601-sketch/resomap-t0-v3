/**
 * Where a search on 更多優惠 sends somebody, and whose it is when they get there.
 *
 * V3 does not keep a catalogue of product pages. A hand-copied product URL is
 * a promise that the product still exists and still costs what the card said,
 * and nobody here is checking. The platform's own search results page is the
 * one address that is always current, so that is the whole destination: the
 * keyword, the category, and the affiliate id.
 *
 * Every parameter below was checked against the live sites on 2026-09-22 —
 * see T0_V3_DEMO_PROMPT.md for what each one returned. Both platforms change
 * their front ends; if a category stops filtering, the link still lands on a
 * search for the right word, which is a softer failure than a dead product.
 */

export type SearchCat = "ticket" | "tour" | "hotel" | "car" | "transport" | "flight";
export type SearchPlatform = "klook" | "kkday";

/** Change these two and every outbound link in the app follows. */
export const AFFILIATE_IDS = {
  klook: { aid: "136084" },
  kkday: { cid: "27002" },
} as const;

export const SEARCH_CATS: {
  id: SearchCat;
  label: string;
  /** What the field asks for once this category is picked. */
  placeholder: string;
  icon: string;
}[] = [
  { id: "ticket", label: "景點門票", placeholder: "景點或城市，如：日月潭", icon: "🎟️" },
  { id: "tour", label: "行程體驗", placeholder: "一日遊或體驗，如：九份", icon: "🎈" },
  { id: "hotel", label: "飯店住宿", placeholder: "城市或飯店，如：花蓮", icon: "🏨" },
  { id: "car", label: "租車", placeholder: "取車地點，如：台南", icon: "🚗" },
  /* V3 round 2 — what a trip's 旅遊指南 opens. Klook only for flights: KKday
     does not sell them. */
  { id: "transport", label: "交通", placeholder: "城市或路線，如：台南", icon: "🚆" },
  { id: "flight", label: "機票", placeholder: "目的地，如：東京", icon: "✈️" },
];

/** The four tiles on 更多優惠 itself. The results screen offers all six. */
export const HUB_CATS = SEARCH_CATS.filter((c) =>
  (["ticket", "tour", "hotel", "car"] as SearchCat[]).includes(c.id),
);

export const catLabel = (c: SearchCat) => SEARCH_CATS.find((x) => x.id === c)!.label;

export const PLATFORMS: {
  id: SearchPlatform;
  name: string;
  site: string;
  /** The wordmark colour. Text only — not their logo artwork. */
  ink: string;
  wash: string;
}[] = [
  { id: "klook", name: "Klook", site: "klook.com", ink: "#FF5B00", wash: "#FFF1E8" },
  { id: "kkday", name: "KKday", site: "kkday.com", ink: "#26BEC9", wash: "#E6F8F9" },
];

/* Klook's result tabs. 租車 has no tab of its own in search; it lives under
   交通, and "{place} 租車" puts the hire listings at the top of it. */
const KLOOK_TAB: Record<SearchCat, string> = {
  ticket: "2",
  tour: "1",
  hotel: "54",
  car: "30",
  transport: "30",
  /* Flights never go through search — see flightUrl — but the table is total. */
  flight: "30",
};

/* KKday's result tabs. 門票 and 體驗 are one tab there, and sending only one of
   the two ids makes KKday drop the filter altogether — so both go together. */
const KKDAY_TAB: Record<SearchCat, string> = {
  ticket: "CATEGORY_001,CATEGORY_018",
  tour: "CATEGORY_001,CATEGORY_018",
  hotel: "CATEGORY_078",
  car: "CATEGORY_055",
  transport: "CATEGORY_055",
  flight: "CATEGORY_055",
};

/** The word actually sent. Only 租車 needs help: "台南" alone returns temples. */
function keyword(q: string, cat: SearchCat): string {
  const t = q.trim();
  return cat === "car" && !t.includes("租車") ? `${t} 租車` : t;
}

/**
 * `cat: null` searches every tab. That is for a named product — 「台北101 觀景台」
 * is specific enough on its own, and a 景點門票 filter would hide it the day a
 * platform files it under 行程＆體驗 instead.
 */
export function searchUrl(platform: SearchPlatform, cat: SearchCat | null, q: string): string {
  const k = cat ? keyword(q, cat) : q.trim();
  if (platform === "klook") {
    const u = new URL("https://www.klook.com/zh-TW/search/result/");
    u.searchParams.set("query", k);
    if (cat) u.searchParams.set("tab_key", KLOOK_TAB[cat]);
    u.searchParams.set("aid", AFFILIATE_IDS.klook.aid);
    return u.toString();
  }
  const u = new URL("https://www.kkday.com/zh-tw/product/productlist");
  u.searchParams.set("keyword", k);
  if (cat) u.searchParams.set("tab_key", KKDAY_TAB[cat]);
  u.searchParams.set("cid", AFFILIATE_IDS.kkday.cid);
  return u.toString();
}

/** The two platforms V3 has an affiliate id for. Everything else stays simulated. */
export const isLivePlatform = (id: string | undefined): id is SearchPlatform =>
  id === "klook" || id === "kkday";

/** The one sentence under every outbound search card. */
export const SEARCH_DISCLOSURE =
  "透過這裡的連結預訂，ResoMap 可能獲得佣金，你付的價格不會因此改變。價格、庫存與評價以平台頁面為準。";

/* ----------------------------------------------- V3 round 2: dates, flights */

/**
 * Klook's own city ids for its hotel search, the one Klook page that takes
 * dates in its address. Read off Klook's hotel keyword-suggest endpoint on
 * 2026-09-22. Places that are not a city on Klook borrow the one they sit in.
 */
const KLOOK_HOTEL_CITY: Record<string, number> = {
  台北: 19,
  新北: 6488,
  台中: 25,
  台南: 164,
  高雄: 22,
  宜蘭: 42,
  花蓮: 20,
  台東: 47,
  南投: 25303,
  嘉義: 436,
  屏東: 7992,
  東京: 28,
  大阪: 29,
  京都: 30,
  首爾: 13,
  日月潭: 25303,
  九份: 6488,
  淡水: 6488,
  北海岸: 6488,
  阿里山: 5243,
  墾丁: 7992,
  東海岸: 47,
};

/** Klook's flight-search place ids, from its own popular-route links. */
const KLOOK_FLIGHT: Record<string, { id: number; name: string }> = {
  台北: { id: 17343, name: "臺北市" },
  東京: { id: 9807, name: "東京" },
  大阪: { id: 14472, name: "大阪市" },
  京都: { id: 14472, name: "大阪市" },
  首爾: { id: 9835, name: "首爾" },
};

const ORIGIN = "台北";

export interface Door {
  platform: SearchPlatform;
  url: string;
  /** 「在 Klook 查看」, 「去程・台北 → 東京」 */
  title: string;
  sub: string;
  /** What the platform will not do with what the traveller entered. */
  note?: string;
}

const md = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
};

const nights = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));

function withAid(u: URL) {
  u.searchParams.set("aid", AFFILIATE_IDS.klook.aid);
  return u.toString();
}

function hotelUrl(cityId: number, title: string, from: string, to: string): string {
  const u = new URL("https://www.klook.com/zh-TW/hotels/searchresult/");
  u.searchParams.set("check_in", from);
  u.searchParams.set("check_out", to);
  u.searchParams.set("room_num", "1");
  u.searchParams.set("adult_num", "2");
  u.searchParams.set("child_num", "0");
  u.searchParams.set("stype", "city");
  u.searchParams.set("svalue", String(cityId));
  u.searchParams.set("city_id", String(cityId));
  u.searchParams.set("title", title);
  return withAid(u);
}

/**
 * One way, always. A return date in the address makes Klook answer 查無路線
 * (tried 2026-09-22), so a round trip is offered as two one-way searches —
 * which is also how most people compare fares anyway.
 */
function flightUrl(o: { id: number; name: string }, d: { id: number; name: string }, date: string): string {
  const u = new URL("https://www.klook.com/zh-TW/flights/search/");
  u.searchParams.set("origin_position", String(o.id));
  u.searchParams.set("origin_position_name", o.name);
  u.searchParams.set("destination_position", String(d.id));
  u.searchParams.set("destination_position_name", d.name);
  u.searchParams.set("display_dp_name", d.name);
  u.searchParams.set("display_op_name", o.name);
  u.searchParams.set("departure_date", date);
  u.searchParams.set("passengers", JSON.stringify([{ passenger_type: "adult", count: 1 }]));
  u.searchParams.set("seat_class", "Economy");
  return withAid(u);
}

/**
 * The doors for one search: which platform pages to offer, and what each
 * will and will not carry over. Dates reach a platform only where its address
 * accepts them — Klook's hotel and flight searches — and every other door
 * says so rather than quietly dropping what the traveller picked.
 */
export function doorsFor(
  cat: SearchCat,
  q: string,
  dates: { from?: string; to?: string } = {},
): Door[] {
  const word = q.trim();
  const { from, to } = dates;
  const dated = Boolean(from || to);
  const later = (p: string) => (dated ? `日期請在 ${p} 頁面選擇` : undefined);

  if (cat === "flight") {
    const o = KLOOK_FLIGHT[ORIGIN];
    const d = KLOOK_FLIGHT[word];
    if (!d || word === ORIGIN) {
      return [
        {
          platform: "klook",
          url: withAid(new URL("https://www.klook.com/zh-TW/flights/")),
          title: "在 Klook 查機票",
          sub: `到 Klook 選出發地和目的地${word ? `（${word}）` : ""}`,
          note: dated ? "Klook 沒有這個目的地的直連，日期請在頁面選擇" : undefined,
        },
      ];
    }
    const out: Door[] = [];
    if (from) {
      out.push({
        platform: "klook",
        url: flightUrl(o, d, from),
        title: `去程・${ORIGIN} → ${word}`,
        sub: `${md(from)} 出發・單程・經濟艙`,
      });
    }
    if (to) {
      out.push({
        platform: "klook",
        url: flightUrl(d, o, to),
        title: `回程・${word} → ${ORIGIN}`,
        sub: `${md(to)} 出發・單程・經濟艙`,
      });
    }
    if (!out.length) {
      out.push({
        platform: "klook",
        url: withAid(new URL("https://www.klook.com/zh-TW/flights/")),
        title: `在 Klook 查${ORIGIN} → ${word}`,
        sub: "選好日期就能直接帶到航班列表",
      });
    }
    return out;
  }

  if (cat === "hotel") {
    const city = KLOOK_HOTEL_CITY[word];
    const klook: Door =
      city && from && to && to > from
        ? {
            platform: "klook",
            url: hotelUrl(city, word, from, to),
            title: "在 Klook 查看",
            sub: `「${word}」飯店住宿・${md(from)} 入住・${nights(from, to)} 晚`,
          }
        : {
            platform: "klook",
            url: searchUrl("klook", cat, word),
            title: "在 Klook 查看",
            sub: `「${word}」飯店住宿`,
            note: later("Klook"),
          };
    return [
      klook,
      {
        platform: "kkday",
        url: searchUrl("kkday", cat, word),
        title: "在 KKday 查看",
        sub: `「${word}」飯店住宿`,
        note: later("KKday"),
      },
    ];
  }

  return PLATFORMS.map((p) => ({
    platform: p.id,
    url: searchUrl(p.id, cat, word),
    title: `在 ${p.name} 查看`,
    sub: `「${word}」${catLabel(cat)}`,
    note: later(p.name),
  }));
}
