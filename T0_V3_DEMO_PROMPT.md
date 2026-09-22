# ResoMap T0 V3 Demo — 實作 Prompt

> 由 V2（`resomap-t0-v2`，commit `c0d65a0`）複製而來。V2 的 repo、資料夾、網址都不動。

## 角色

你是 ResoMap 的產品專案經理兼設計總監。所有決定都以「旅客站在路邊、單手拿手機」為準：少打字、
少判斷、每一次點擊都通往真的東西，不留死路。

## 部署

| 項目 | V2（不動） | V3（新） |
|---|---|---|
| 本機資料夾 | `resomap-work/resomap-t0-v2` | `resomap-work/resomap-t0-v3` |
| GitHub repo | `resomap-t0-v2` | `resomap-t0-v3` |
| `vite.config.ts` base | `/resomap-t0-v2/` | `/resomap-t0-v3/` |
| 網址 | `…github.io/resomap-t0-v2/` | `…github.io/resomap-t0-v3/` |

- `public/competitive-analysis.html`、`public/radar-manual.html` 是內部文件，不屬於 App，V3 不帶。
- V2 裡未 commit 的 radar 工作不帶過來。

---

## 改動一：「更多優惠」變成可以搜尋的頁面

### 已定案的決策

| 問題 | 決定 |
|---|---|
| 平台怎麼呈現 | 一個搜尋框，搜完兩個平台各給一個入口 |
| 跳到哪裡 | **平台的搜尋結果頁**（帶關鍵字＋分類），不是寫死的商品頁 |
| 結果頁內容 | 不列商品清單，只有 Klook、KKday 兩張大卡片 |
| 結果頁位置 | 獨立的結果頁（有返回鍵） |
| 分類 | 景點門票、行程體驗、飯店住宿、租車 |
| 原本內容 | 搜尋放在最上面，原本的合作商家、平台、折扣碼、訂閱方案往下移，一樣都不刪 |
| 聯盟 ID | Klook `aid=136084`、KKday `cid=27002` |

### 網址規則（2026-09-22 實測）

**Klook**：`https://www.klook.com/zh-TW/search/result/?query={q}&tab_key={k}&aid=136084`

| 分類 | tab_key | query |
|---|---|---|
| 景點門票 | `2` | `{q}` |
| 行程體驗 | `1` | `{q}` |
| 飯店住宿 | `54` | `{q}` |
| 租車 | `30`（交通） | `{q} 租車` |

帶 `aid` 打開後，Klook 會寫入 `aid=136084`、`affiliate_type=non-network` 的 cookie，追蹤有效。

**KKday**：`https://www.kkday.com/zh-tw/product/productlist?keyword={q}&tab_key={k}&cid=27002`

| 分類 | tab_key | keyword |
|---|---|---|
| 景點門票 | `CATEGORY_001,CATEGORY_018` | `{q}` |
| 行程體驗 | `CATEGORY_001,CATEGORY_018` | `{q}` |
| 飯店住宿 | `CATEGORY_078` | `{q}` |
| 租車 | `CATEGORY_055`（交通） | `{q} 租車` |

KKday 的「門票＆體驗」是同一個分頁。如果只帶其中一個 CATEGORY，KKday 會把 tab_key 整個清掉，
所以兩個分類都送合併的那組值。KKday 沒有租車專頁（`/car-rental` 會 404），「{地點} 租車」
加交通分頁實測有 126 筆結果。

聯盟 ID 集中寫在 `src/data/affiliateLinks.ts`，換 ID 只需要改那一個檔案。

### 畫面：更多優惠（tab 根頁）

1. **品牌橘橫幅**：沿用 `BrandBar`，下面接一塊有真實照片（台灣景點）的 hero，上面疊深色漸層，
   保證白字的對比度。
   - 標題：「想去哪裡玩？」
   - 副標：「搜一次，Klook 和 KKday 都幫你找好」
   - **真的輸入框**，不是假按鈕。按 Enter 或「搜尋」鍵就送出，空白的時候按鈕停用。
2. **分類圖示列**（4 格，排法像 Klook）：景點門票／行程體驗／飯店住宿／租車。
   - 點一下代表「選這個分類」，被選中的那格會亮起來，輸入框的 placeholder 跟著換，例如「搜尋飯店或城市」。
   - 已經有關鍵字的話，點分類就直接送出。
3. **快速關鍵字**：
   - 如果有進行中或即將出發的行程，第一顆是那個城市，例如「你的行程・台南」。
   - 接著是熱門地點：日月潭、九份、墾丁、花蓮、台南、台北101。
4. **最近搜尋**：存在 localStorage，最多 5 筆，可以清除。讀寫都包 try/catch，讀不到就當作沒有。
5. 下面接 V2 原本的區塊，順序和文字都不變：ResoMap 合作商家 → 更多比價 → 租車據點 → 其他。

### 畫面：搜尋結果（新 route `dealSearch`）

- TopBar：返回鍵＋可以直接改的搜尋框（預先填好剛才的關鍵字），改完再送出會換成新的結果，
  不會疊一層新頁面。
- 分類 chips（4 個）：切換後兩張卡片的文字和網址會立刻跟著變，不用重打關鍵字。
- 標題：「『日月潭』的景點門票」。
- **兩張大卡片**，一個平台一張，整張都可以點：
  - 平台字標（用文字加品牌色，不用對方的 logo 圖檔）
  - 「查看『日月潭』景點門票」
  - 小字：「在 klook.com 開啟」＋ ↗
  - 用真的 `<a target="_blank" rel="noopener noreferrer sponsored">` 開新分頁（不會被擋、可以長按），同時記一筆 `affiliate_outbound` 事件
- 卡片底下的說明：「價格、庫存、評價都以平台頁面為準。」
- 揭露文字：「透過這裡的連結預訂，ResoMap 可能獲得佣金，你付的價格不會因此改變。」

### 揭露文字的改動

V2 寫的是「與各平台無合作關係」。V3 帶了 Klook 和 KKday 的聯盟 ID，這句話已經不成立，所以要改：

- Klook、KKday：寫「ResoMap 參加其聯盟行銷計畫」。
- Booking、Agoda、Trip.com、各租車公司：維持「無合作關係」。
- 不可以寫成「官方合作」「策略夥伴」。聯盟行銷就只是聯盟行銷。

---

## 改動二：景點縮圖改用真實照片

- 新增 `PoiThumb`：有照片就顯示照片，沒有照片或載入失敗時，退回原本的 emoji 圖示
  （44px 的海報圖會糊成一團，emoji 還看得清楚），不會出現破圖。
- 全 App 所有用 emoji `Thumb` 表示**景點**的地方都換掉：行程列表、搜尋、收藏、地圖卡、目的地、
  故事、新增景點、新增語音、Today、加入行程。
- 服務類（司機、租車櫃台、優惠券）沒有真實照片，繼續用 emoji tile。不能拿一張泛用照片去冒充某一家店。
- 91 個景點裡只有 `shuijiao`（阿明豬心冬粉）沒有照片：找一張有授權的照片補上，
  寫進 `PHOTO_ATTRIBUTION.md`；找不到就維持海報圖。

---

## 實作中追加的決定

- **存檔隔離**：V2 和 V3 在同一個網域（`tszhongyung0601-sketch.github.io`），localStorage 共用。
  V3 所有存檔鍵改成 `resomap_v3_*`；第一次開啟時把 V2 的資料複製一份過來（`src/lib/v2seed.ts`），
  之後只讀、不回寫 V2。
- **既有的 Klook／KKday「前往」按鈕也接成真的**：`OutboundSheet` 遇到 Klook／KKday 時，
  用商品名稱開該平台的搜尋頁（帶 aid／cid、不加分類篩選）。Booking、Agoda、Trip.com 維持模擬。
- **門票商品頁**：有對應景點的商品，大圖和列表縮圖都用那個景點的真實照片，並附上授權標示。
- **阿明豬心冬粉**：Wikimedia Commons 上找不到有授權的照片，維持 emoji 圖示。

## 驗收

- [x] `npm run build` 通過，沒有型別錯誤
- [x] 四個分類 × 兩個平台，一共 8 條網址，每條實際打開都有結果，而且帶著 aid／cid（以「花蓮」實測：Klook 門票 6、體驗 76、飯店 426、租車 10；KKday 門票＆體驗 56、住宿 351、租車 126）
- [x] 手機寬度 375px：沒有橫向捲動，觸控目標至少 44px
- [x] 行程列表的縮圖全部是真實照片
- [x] V2 網址內容沒有變（V2 最後一次部署仍是 9/16 的 c0d65a0）
- [x] V3 網址 200，資產也是 200
