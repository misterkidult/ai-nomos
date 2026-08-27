# ai-nomos

WebMCP 參賽作品。計畫與審查在 `context/`，產品原則見 README。

## 部署

- **只走 prebuilt**：`vercel build --prod` → `vercel deploy --prebuilt --prod`。Vercel 端零 build step
- GitHub 連結已於 2026-08-27 斷開（`vercel git disconnect`），`git push` 不會部署；**不要重新連接**
- 靜態檔在 `public/`，`vercel.json` 只放 rewrites（`/probe`、`/read`）
- 線上：https://ai-nomos.vercel.app

## 規則

- 繁體中文、全形標點
- 目擊紀錄不回寫 `ai-dictionary` 的 `terms/`
- `public/lexicon.json` 是 vendor 進來的產出，勿手改：字典 repo 是 private 且無線上站，瀏覽器抓不到，部署前跑 `scripts/sync-lexicon.sh`（＝字典 `build.py --index` ＋複製）
- `public/fixtures/` 是給 `/read` 退化模式「載入範例目擊」用的；來源是根目錄 `fixtures/`
