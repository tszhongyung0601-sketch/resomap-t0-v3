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

export type SearchCat = "ticket" | "tour" | "hotel" | "car";
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
];

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
};

/* KKday's result tabs. 門票 and 體驗 are one tab there, and sending only one of
   the two ids makes KKday drop the filter altogether — so both go together. */
const KKDAY_TAB: Record<SearchCat, string> = {
  ticket: "CATEGORY_001,CATEGORY_018",
  tour: "CATEGORY_001,CATEGORY_018",
  hotel: "CATEGORY_078",
  car: "CATEGORY_055",
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
