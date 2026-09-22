# DEPLOYMENT

線上位址：**https://tszhongyung0601-sketch.github.io/resomap-t0-v3/**

Repo：`tszhongyung0601-sketch/resomap-t0-v3`，branch `main`。

---

## 方式：GitHub Actions → GitHub Pages

`.github/workflows/deploy.yml` 在每次 push 到 `main` 時：

```
actions/checkout            取原始碼
actions/setup-node          Node 22 + npm cache
npm ci                      鎖定版本安裝
npm run build               tsc -b && vite build → dist/
actions/configure-pages     取得 Pages 設定
actions/upload-pages-artifact  上傳 dist/
actions/deploy-pages        部署
```

用官方 `deploy-pages`，**不是** `gh-pages` branch，也不是 `peaceiris/actions-gh-pages`。
原版 T0 用的是舊的 `gh-pages` branch 方式；V2 改成 Actions，兩邊互不影響。

Pages 的 source 必須設成 GitHub Actions：

```bash
gh api -X POST repos/tszhongyung0601-sketch/resomap-t0-v3/pages \
  -f build_type=workflow
```

（已建立過的話用 `-X PUT`。）

---

## Base path — 這是最容易壞掉的一件事

Pages 服務在 `/resomap-t0-v3/`，不是 `/`。三個地方必須一致：

| 位置 | 值 |
|---|---|
| `vite.config.ts` | `base: '/resomap-t0-v3/'` |
| repo 名稱 | `resomap-t0-v3` |
| Pages URL | `https://tszhongyung0601-sketch.github.io/resomap-t0-v3/` |

**改 repo 名稱就一定要改 `base`**，否則 JS / CSS 會 404，畫面全白。

執行期的資產一律用 `import.meta.env.BASE_URL` 串前綴：

```ts
// components/Cover.tsx
<img src={`${import.meta.env.BASE_URL}${src}`} />
```

**絕對不要寫 `/photos/xxx.webp`。** 那在 dev（`/`）看起來沒事，上 Pages 就全部 404。
`public/` 底下的檔案由 Vite 自動加前綴，只有寫在 JS 字串裡的路徑要自己處理。

---

## Bundle

`vite.config.ts` 用 `manualChunks` 把 React 與 Leaflet 切出去，`App.tsx` 用 `lazy()`
把非首屏的畫面切成按需 chunk。**Rolldown 的 `manualChunks` 只吃函式，不吃物件**——
寫成物件會在 `tsc -b` 就被擋下來，那是刻意的。

`scripts/build-demo-photos.mjs` 產生 `public/demo/*.webp`，**輸出有進版控**，
所以正式 build 不需要 sharp，CI 也不用裝原生相依。只有新增來源圖時才要重跑。

## SPA 路由

這個 App **沒有 URL router**：route stack 活在 `App.tsx` 的 `useState` 裡，
網址永遠是 base path，所以 GitHub Pages 上不存在「重新整理內頁 404」的問題。

還是放了兩個保險：

- `public/404.html` — Pages 找不到路徑時導回 base，不會停在 GitHub 的 404 頁。
- `public/.nojekyll` — 讓 Pages 不要跑 Jekyll，底線開頭的檔名不會被吃掉。

**如果之後改用 `react-router`**，`404.html` 必須改成保留 pathname 的轉址版本，
或改用 hash routing（`#/nearby/longshan`）。目前不需要。

---

## 本機驗證（跟線上一模一樣的路徑）

```bash
npm run build
npx vite preview --port 4173
# → http://localhost:4173/resomap-t0-v3/
```

`vite preview` 會套用 `base`，所以這個網址跟正式站的結構完全相同。
用 `npm run dev` 也會是 `/resomap-t0-v3/`。

---

## 部署後檢查

```bash
# 1. workflow 有沒有綠燈
gh run list --repo tszhongyung0601-sketch/resomap-t0-v3 --limit 3

# 2. Pages 狀態
gh api repos/tszhongyung0601-sketch/resomap-t0-v3/pages

# 3. HTTP 200
curl -sSI https://tszhongyung0601-sketch.github.io/resomap-t0-v3/ | head -1

# 4. 資產也要 200（不能只測首頁）
curl -sSI https://tszhongyung0601-sketch.github.io/resomap-t0-v3/photos/longshan-card.webp | head -1
```

第一次啟用 Pages 之後，DNS 與 CDN 大約需要 1–3 分鐘才會生效，
在那之前 `curl` 拿到 404 是正常的。

---

## 手動觸發重新部署

```bash
gh workflow run deploy.yml --repo tszhongyung0601-sketch/resomap-t0-v3
```

`workflow_dispatch` 已經開好。

---

## 不會動到原版

`resomap-t0-demo` 是獨立的 repo、獨立的 branch（`gh-pages`）、獨立的 Pages 設定。
V2 的任何部署都不會改到它，兩個網址可以並存對照。
