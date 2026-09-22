/**
 * The strings that get translated, and only these.
 *
 * Hand-curated rather than swept out of the JSX, because a sweep returns
 * fragments. The screens build sentences like `停留 ${n} 分` and `今天是第 ${n}
 * 天`, and the extractor happily offers 停留 and 今天是第 as translatable units —
 * they are not. Translating a fragment produces grammatical nonsense in every
 * language whose word order differs from Chinese, which is all eight of them.
 *
 * So this list holds complete units only: navigation, section headings, buttons,
 * empty states, settings. Sentences with numbers in them stay Chinese and fall
 * back cleanly, and the machine-translation notice at the top of every non-
 * Chinese screen is what makes that honest rather than sloppy.
 *
 * Rewriting the fragment-built sentences into placeholder form is the right
 * long-term fix. It also touches the layout and arithmetic of a dozen screens,
 * which is a different job from adding a language picker.
 */
export const SOURCE = [
  /* navigation */
  "探索", "導覽庫", "行程", "一起規劃", "我的", "返回", "選單",

  /* home */
  "有故事的地方", "附近有故事的地方", "語音導覽免費，可以先試聽 30 秒。", "試聽 30 秒", "看全部導覽",
  "推薦行程", "開始今天行程", "查看完整行程",
  "旅程服務", "門票、住宿、交通，需要的時候從這裡出發。",
  "看全台", "有語音故事", "還沒有", "搜尋城市、景點或想做的事",

  /* the nine service tiles */
  "門票・體驗", "住宿", "交通", "租車・接送", "機票", "eSIM", "旅平險",
  "在地優惠", "更多優惠",

  /* library */
  "全部城市", "全部主題", "免費收聽", "加入行程",
  "景點", "自然", "美食", "購物", "活動", "住宿地點", "交通站點",

  /* trips */
  "建立新旅程", "規劃中", "每日行程", "這趟需要的", "看全部優惠", "旅費",
  "加入景點", "在地圖上挑一個地方", "從地圖選擇", "搜尋地點或區域",
  "附近推薦", "其他地方", "搜尋結果",

  /* a place */
  "附近", "門票", "收藏", "取消收藏", "怎麼走", "聽故事",

  /* saved */
  "語音導覽", "還沒有收藏的地方", "還沒有收藏的導覽",
  "還沒有收藏的地方或導覽。看到喜歡的按一下愛心就會出現在這裡。",

  /* the story player */
  "快速聽", "完整故事", "已收藏", "分享", "在地導覽",

  /* profile and settings */
  "這趟旅行", "設定", "其他", "語言", "記帳 / 分帳", "旅伴", "通知", "優惠券",
  "離線行程", "下載 PDF", "旅行文件", "行李清單", "帳號", "一般設定", "商家洽詢",
  "即將推出", "Demo 帳號",

  /* added with the coupon page, the co-edit demo and the day editor */
  "優惠碼", "立即領取", "要加到哪一天？", "編輯", "完成", "雲端同步", "共同編輯",

  /* shared marks and actions */
  "Demo 資料", "贊助", "查看", "前往", "加入", "取消", "儲存", "清除篩選",
  "都結清了", "結算",

  /* the honesty lines — these matter most of all in another language */
  "價格與優惠為 Demo 示意資料，非即時報價。",
  "ResoMap 參加 Klook、KKday 聯盟行銷計畫，與其他平台無合作關係。",
  "Demo 版本・所有資料皆為示意",
  "本篇導覽目前只有中文",
] as const;
