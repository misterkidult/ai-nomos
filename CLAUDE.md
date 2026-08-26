# ai-nomos

WebMCP 參賽作品。計畫與審查在 `context/`，產品原則見 README。

## 部署

- **只走 prebuilt**：`vercel build --prod` → `vercel deploy --prebuilt --prod`。Vercel 端零 build step
- GitHub 連結已於 2026-08-27 斷開（`vercel git disconnect`），`git push` 不會部署；**不要重新連接**
- 靜態檔在 `public/`，`vercel.json` 只放 rewrites（`/probe`、`/read`）
- 線上：https://ai-nomos.vercel.app

## 規則

- 繁體中文、全形標點
- 目擊紀錄不回寫 `ai-dictionary` 的 `terms/`；lexicon 由字典站 `lexicon.json` 讀
