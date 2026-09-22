/**
 * The explanations, in one file, written for a traveller.
 *
 * Everything here used to be a paragraph sitting in the middle of a product
 * screen: the exact ranking weights, which file the prices live in, that there
 * is no backend, that the affiliate URL field is empty. All of it was true and
 * none of it was for the person holding the phone.
 *
 * So it moved behind small ⓘ entries and one footer row. The rules did not
 * change — `lib/nearby.ts` still ranks on the same weights and
 * `data/subscriptionPlans.ts` still holds `null` prices — only who has to read
 * about them did. The engineering version lives in README.md and
 * INTEGRATION_PLAN.md, which is where an engineer looks anyway.
 *
 * Rule for anything added here: it has to be answerable to a traveller in two
 * sentences. If it needs four, it belongs in the docs.
 */

export interface InfoTopic {
  id: string;
  title: string;
  body: string[];
}

export const INFO: Record<string, InfoTopic> = {
  /** Behind the ⓘ next to a 推薦夥伴 mark. */
  partner: {
    id: "partner",
    title: "ResoMap 推薦夥伴",
    body: [
      "完成會員驗證並通過 ResoMap 資料審核的合作夥伴。",
      "只有付費訂閱不會拿到這個標章，資料審核沒過也不會。",
    ],
  },

  /** Behind 推薦排序 on a nearby list. No percentages. */
  ranking: {
    id: "ranking",
    title: "推薦排序",
    body: [
      "依距離、評價與相關度綜合排序。",
      "部分合作內容可能享有較高曝光，並會清楚標示。",
    ],
  },

  /** Behind the 店家精選 heading on an audio list. */
  featured: {
    id: "featured",
    title: "店家精選",
    body: [
      "由店家自己錄製、關於自己店的內容，每個景點最多兩則，固定在清單最上面。",
      "這是商業內容，所以一律標示。其餘語音由 ResoMap 與旅人提供。",
    ],
  },

  /** Behind 聯盟合作 on an affiliate list. */
  affiliate: {
    id: "affiliate",
    title: "聯盟合作",
    body: [
      "由 Booking、Agoda、Klook、KKday 等平台提供的內容，預訂與付款都在對方平台完成。",
      "ResoMap 參加 Klook、KKday 聯盟行銷計畫，透過連結預訂 ResoMap 可能獲得佣金，你付的價格不變；與其他平台皆無合作關係。價格與供應狀況以對方平台為準。",
    ],
  },

  /** The one place the prototype talks about itself. Reached from 我的. */
  demo: {
    id: "demo",
    title: "關於這個 Demo",
    body: [
      "這是 ResoMap 的可點擊原型：所有景點座標為真，商家、服務者、價格與評價都是示意資料。",
      "語音由瀏覽器即時朗讀文字稿，沒有真實錄音；訂閱、身份與上傳只留在這台裝置上，不會送出，也不會產生任何費用。",
      "ResoMap 參加 Klook、KKday 聯盟行銷計畫；與 Booking.com、Agoda、Trip.com 及畫面上的任何商家皆無合作關係。",
    ],
  },
};

/** The single line a commercial list still carries at its foot. */
export const SHORT_DISCLOSURE = {
  /** ResoMap's own supply. */
  resomap: "商家與服務者資料由提供者自行填寫，皆為示意資料。人物照片為圖庫示意圖，非實際服務者本人。",
  /** Somebody else's inventory. */
  partner: "價格與供應狀況以合作平台為準，皆為示意資料。",
} as const;
