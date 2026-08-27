# ai-nomos

WebMCP 參賽作品。計畫與審查在 `context/`，產品原則見 README。**資料契約 `context/contract.md`（英文，v1）是頁面、`api/*`、餵食三方的唯一依據；改契約走 commit 訊息 `contract:` 開頭，不在聊天裡改。**

## 部署

- **只走 prebuilt**：`vercel build --prod` → `vercel deploy --prebuilt --prod`。Vercel 端零 build step
- GitHub 連結已於 2026-08-27 斷開（`vercel git disconnect`），`git push` 不會部署；**不要重新連接**
- 靜態檔在 `public/`，`vercel.json` 只放 rewrites（`/probe`、`/read`、`/term/:slug`）
- 頁面資料來源：詞條＝`lexicon.json`；目擊＝`GET /api/sightings`（Matt，契約 §5），沒上線前讀過渡檔 `public/sightings.json`（Kidult 餵的 127 篇，8/29 Matt 匯進 Upstash 後刪），`?demo=1` 載 `fixtures/sightings-sample.json` 排練
- 線上：https://ai-nomos.vercel.app

## 規則

- 繁體中文、全形標點；**agent 契約（規則、enum、拒絕碼）只用英文**，UI 字串 zh／en 兩套在 `read.html` 的 `I18N`
- 三條鎖的參考實作是 `scripts/check-findings.py`，`api/*` 的判定必須與它對 `fixtures/*.json` 完全一致
- 目擊紀錄不回寫 `ai-dictionary` 的 `terms/`
- `public/lexicon.json` 是 vendor 進來的產出，勿手改：字典 repo 是 private 且無線上站，瀏覽器抓不到，部署前跑 `scripts/sync-lexicon.sh`（＝字典 `build.py --index` ＋複製）
- `public/fixtures/` 只放 `/read` 退化模式「載入範例目擊」用的檔；來源是根目錄 `fixtures/`。**沒有 seed**：既有 133 則由 Kidult 照 `fixtures/feed-list-133.md` 親自餵
