import type { Deal } from "../types";

/**
 * Demo commercial inventory.
 *
 * Two rules hold everywhere this data is rendered:
 *
 *  1. A ticket deal may only exist for a POI that genuinely sells admission.
 *     Attaching a Klook link to a free temple is the fastest way to make a
 *     travel app feel like an ad network.
 *  2. `sponsored` is never hidden. Paid placement is labelled on the card, in
 *     the list, and on the map. Commercial results must not be able to pass
 *     themselves off as organic recommendations.
 *
 * Prices are indicative market figures, not live rates, and ResoMap has no
 * agreement with any platform named here.
 */
export const DEALS: Deal[] = [
  /* --------------------------------------------------------- 門票・體驗 */
  {
    id: "d-chihkan",
    category: "ticket",
    title: "赤崁樓 入園門票",
    partner: "kkday",
    priceTwd: 75,
    destId: "tainan",
    poiId: "chihkan",
    emoji: "🏯",
    tint: "#F5E6D3",
  },
  {
    id: "d-anping-fort",
    category: "ticket",
    title: "安平古堡 入園門票",
    partner: "kkday",
    priceTwd: 75,
    destId: "tainan",
    poiId: "anping-fort",
    emoji: "🏰",
    tint: "#F2E7D8",
  },
  {
    id: "d-chimei",
    category: "ticket",
    title: "奇美博物館 常設展門票",
    partner: "klook",
    priceTwd: 200,
    destId: "tainan",
    poiId: "chimei",
    emoji: "🏛️",
    tint: "#EAE3D8",
  },
  {
    id: "d-tainan-food-tour",
    category: "ticket",
    title: "台南舊城區 半日美食導覽",
    partner: "kkday",
    priceTwd: 1280,
    destId: "tainan",
    emoji: "🍜",
    tint: "#F3E7D5",
    sponsored: true,
  },
  {
    id: "d-taipei-101",
    category: "ticket",
    title: "台北 101 觀景台門票",
    partner: "klook",
    priceTwd: 560,
    destId: "taipei",
    poiId: "taipei-101",
    emoji: "🏙️",
    tint: "#E3E9F3",
  },
  {
    id: "d-npm",
    category: "ticket",
    title: "國立故宮博物院 門票",
    partner: "kkday",
    priceTwd: 335,
    destId: "taipei",
    poiId: "npm",
    emoji: "🏺",
    tint: "#EFE7DA",
  },
  {
    id: "d-maokong",
    category: "ticket",
    /* 來回票 no longer exists — the operator moved to 單次票 / 一日票. Selling a
       fare nobody can buy is the same defect as a ticket to a free park. */
    title: "貓空纜車 一日票",
    partner: "klook",
    priceTwd: 300,
    destId: "taipei",
    poiId: "maokong",
    emoji: "🚡",
    tint: "#E2EDE4",
  },
  {
    id: "d-yehliu",
    category: "ticket",
    title: "野柳地質公園 門票",
    partner: "klook",
    priceTwd: 120,
    destId: "newtaipei",
    poiId: "yehliu",
    emoji: "🪨",
    tint: "#E2EAEF",
  },
  {
    id: "d-traditional-arts",
    category: "ticket",
    title: "國立傳統藝術中心 門票",
    partner: "kkday",
    priceTwd: 140,
    destId: "yilan",
    poiId: "traditional-arts",
    emoji: "🎎",
    tint: "#F0E6D9",
  },
  {
    id: "d-pine-garden",
    category: "ticket",
    title: "松園別館 門票",
    partner: "kkday",
    priceTwd: 60,
    destId: "hualien",
    poiId: "pine-garden",
    emoji: "🌲",
    tint: "#E1EBDF",
  },
  {
    id: "d-hualien-raft",
    category: "ticket",
    title: "秀姑巒溪 泛舟體驗",
    partner: "klook",
    priceTwd: 980,
    destId: "hualien",
    emoji: "🛶",
    tint: "#DCEAEF",
  },
  {
    id: "d-disney",
    category: "ticket",
    title: "東京迪士尼樂園 一日護照",
    partner: "klook",
    priceTwd: 2150,
    destId: "tokyo",
    poiId: "disney",
    emoji: "🏰",
    tint: "#E7E1F6",
  },
  {
    id: "d-teamlab",
    category: "ticket",
    title: "teamLab Planets TOKYO 門票",
    partner: "klook",
    priceTwd: 820,
    destId: "tokyo",
    poiId: "teamlab",
    emoji: "✨",
    tint: "#E3E1F7",
  },
  {
    id: "d-skytree",
    category: "ticket",
    title: "東京晴空塔 展望台門票",
    partner: "kkday",
    priceTwd: 560,
    destId: "tokyo",
    poiId: "skytree",
    emoji: "🗼",
    tint: "#DFE7F5",
  },
  {
    id: "d-tnm",
    category: "ticket",
    title: "東京國立博物館 常設展",
    partner: "kkday",
    priceTwd: 220,
    destId: "tokyo",
    poiId: "tnm",
    emoji: "🏛️",
    tint: "#EAE3D8",
  },
  {
    id: "d-usj",
    category: "ticket",
    title: "日本環球影城 一日券",
    partner: "klook",
    priceTwd: 2380,
    destId: "osaka",
    poiId: "usj",
    emoji: "🎢",
    tint: "#E9E2F4",
  },

  /* --------------------------------------------------------------- 住宿 */
  {
    id: "d-stay-tainan",
    category: "stay",
    title: "台南中西區 老屋民宿",
    partner: "booking",
    priceTwd: 2400,
    unit: "晚",
    destId: "tainan",
    emoji: "🏠",
    tint: "#F2E9DC",
  },
  {
    id: "d-stay-tainan-hotel",
    category: "stay",
    title: "台南火車站前 商務飯店",
    partner: "agoda",
    priceTwd: 1850,
    unit: "晚",
    destId: "tainan",
    emoji: "🛏️",
    tint: "#E8E8EE",
  },
  {
    id: "d-stay-hualien",
    category: "stay",
    title: "花蓮市區 海景飯店",
    partner: "booking",
    priceTwd: 3200,
    unit: "晚",
    destId: "hualien",
    emoji: "🌊",
    tint: "#DCEAEF",
  },
  {
    id: "d-stay-hualien-inn",
    category: "stay",
    title: "花蓮 太魯閣旁民宿",
    partner: "agoda",
    priceTwd: 2100,
    unit: "晚",
    destId: "hualien",
    emoji: "⛰️",
    tint: "#E2EDE4",
  },
  {
    id: "d-stay-taipei",
    category: "stay",
    title: "台北中山區 設計旅店",
    partner: "tripcom",
    priceTwd: 3400,
    unit: "晚",
    destId: "taipei",
    emoji: "🏨",
    tint: "#E3E9F3",
  },
  {
    id: "d-stay-tokyo",
    category: "stay",
    title: "東京新宿 車站旁飯店",
    partner: "booking",
    priceTwd: 4200,
    unit: "晚",
    destId: "tokyo",
    emoji: "🏨",
    tint: "#E4E4EC",
  },

  /* --------------------------------------------------------------- 交通 */
  {
    id: "d-hsr",
    category: "transport",
    title: "台灣高鐵 台北－台南",
    partner: "kkday",
    priceTwd: 1120,
    destId: "tainan",
    emoji: "🚄",
    tint: "#E5EAF2",
  },
  {
    id: "d-car-hualien",
    category: "transport",
    title: "花蓮火車站 租車一日",
    partner: "klook",
    priceTwd: 1500,
    unit: "日",
    destId: "hualien",
    emoji: "🚗",
    tint: "#EAEAE4",
  },
  {
    id: "d-taoyuan-transfer",
    category: "transport",
    title: "桃園機場 接送（四人座）",
    partner: "kkday",
    priceTwd: 900,
    destId: "taipei",
    emoji: "🚐",
    tint: "#E6E9EE",
  },
  {
    id: "d-tokyo-nex",
    category: "transport",
    title: "成田特快 N'EX 來回票",
    partner: "klook",
    priceTwd: 1080,
    destId: "tokyo",
    emoji: "🚆",
    tint: "#E1E7F2",
  },
  {
    id: "d-jr-pass",
    category: "transport",
    title: "JR 東京廣域周遊券",
    partner: "tripcom",
    priceTwd: 2600,
    destId: "tokyo",
    emoji: "🎫",
    tint: "#DCEBFF",
  },

  /* --------------------------------------------------------------- eSIM */
  {
    id: "d-esim-tw",
    category: "esim",
    title: "台灣 eSIM 5 天吃到飽",
    partner: "klook",
    priceTwd: 199,
    emoji: "📶",
    tint: "#E4EDEB",
  },
  {
    id: "d-esim-jp",
    category: "esim",
    title: "日本 eSIM 5 天 5GB",
    partner: "kkday",
    priceTwd: 240,
    destId: "tokyo",
    emoji: "📶",
    tint: "#E0EEFB",
  },

  /* ------------------------------------------------------------- 旅平險 */
  {
    id: "d-ins-domestic",
    category: "insurance",
    title: "國內旅遊平安險 3 日",
    partner: "kkday",
    priceTwd: 120,
    emoji: "🛡️",
    tint: "#E6EEF6",
  },
  {
    id: "d-ins-overseas",
    category: "insurance",
    title: "海外旅平險 5 日（含不便險）",
    partner: "kkday",
    priceTwd: 480,
    destId: "tokyo",
    emoji: "🛡️",
    tint: "#E9E6F3",
  },

  /* 在地優惠 lived here: four merchant discounts marked 即將推出. V3 removed
     them — ResoMap has no merchants, and a coming-soon offer from a named
     shop still reads as a shop that has agreed to something. */
];

export const BY_DEAL: Record<string, Deal> = Object.fromEntries(
  DEALS.map((d) => [d.id, d]),
);

/** Deals attached to a specific place. Used for contextual, not ambient, sales. */
export const dealsForPoi = (poiId: string) => DEALS.filter((d) => d.poiId === poiId);

export const dealsForDest = (destId: string) =>
  DEALS.filter((d) => d.destId === destId);

/**
 * What to show a traveller who has a trip. Their destination first, then things
 * that are useful anywhere (eSIM, insurance) — never another city's tickets.
 */
export function relevantDeals(destId: string | null, limit = 8): Deal[] {
  const mine = destId ? DEALS.filter((d) => d.destId === destId) : [];
  const universal = DEALS.filter((d) => !d.destId);
  const rest = DEALS.filter((d) => d.destId && d.destId !== destId);
  return [...mine, ...universal, ...rest].slice(0, limit);
}
