# 交接：資料重收完成，待建資料庫（2026-08-29）

給下一個對話。這輪只做「重收資料」，DB 還沒建。

## 為什麼要重收

`public/sightings.json` 的 924 筆**沒有 `sentence` 也沒有 `context`**（0 筆有）。契約 §4 說這兩欄 never public，所以當初就丟了 —— 但三條鎖靠它們判定（`SENTENCE_LACKS_TERM`、`QUOTE_NOT_IN_CONTEXT`）。要走真實路徑重塞，那 924 筆會被全擋。

Kidult 08-29 拍板：**重收**（不直匯）。

## 已完成

14 個 subagent 平行跑完 374 篇文章，模擬 `/read` 流程：

| | 舊 `sightings.json` | 新 `collect/docs/` |
|---|---|---|
| 文件 | 374 | 374（job_id 全對得上 queue）|
| 記錄 | 924 sightings | **1526 findings** |
| sentence／context | 0 筆 | 1526 筆全有 |
| 三條鎖 | 無法驗 | **1526 accepted / 0 rejected** |

- 抓取：362 ok、10 × 403（Medium、INSIDE、天下、iThome、TechOrange）、1 × 302 迴圈、1 × JS 渲染空白 → `not_found` 19 詞次
- 133 詞的 doc_count<3 從 12 個降到 5 個：`Independent Review`(0)、`多版本挑選`(0)、`Division of Labor`(2)、`Domain Skill`(2)、`Iteration`(2)
- 新詞 177 個（不在 133 lexicon 內）

## 檔案

- `collect/queue.json` — 374 筆工單，從舊 sightings 反推 requested_terms（**gitignore**）
- `collect/docs/<job_id>.json` — 每篇一檔，**可重播的 `submitFindings` payload**（**gitignore**）
  ```
  {job_id, url, title, published, requested_terms, findings[], not_found[], fetch_status}
  ```
  `findings[]` 每筆是契約 §1 的完整 Finding（含 sentence／context／source）
- `scripts/collect-validate.py` — 對 staging 全量跑三條鎖，判定沿用 `check-findings.py`（**已進版控**）

## ⚠ 開工前必須先處理：驗證器有漏洞

批 1、2、6 三個 agent **各自獨立**抓到同一件事，自查出 **9／8／14 筆**通過驗證器但不忠於原文的 findings（悄悄縮短句子、彎引號換直引號、跨段落拼接）。

**根因**：`definition_quote ⊆ context` 這條鎖是自我循環的 —— `context` 也是 agent 自己填的，把 context 寫成配合 quote 的樣子就過。驗證器**看不到**「這段文字是否真的出現在文章裡」。

**現況**：那三批自己補了原文比對層並修掉，**其餘 11 批沒有**。所以 1526 筆的實際狀態是「機器檢查全過，但逐字忠實度只有 3/14 批被真正驗證過」。

批 11 補的自我盲區：即使加了原文比對，比的也是**它自己抽的 HTML**，不是讀者看到的渲染頁面。

## 下一步順序（不要顛倒）

1. **補驗證器的原文比對層**，對 1526 筆重跑 → 才知道未自查的 11 批髒了多少
2. Matt 的 Upstash + `GET /api/sightings` 建起來
3. 寫 replay：讀 `collect/docs/*.json` 逐篇送 `submitFindings`，走真實路徑入庫
4. 入庫成功後刪 `public/sightings.json`（CLAUDE.md 已註明 8/29 Matt 匯進後刪）

**為什麼 1 必須在 3 之前**：進了 Upstash 之後才發現引文不忠實，線上就是一批指向真實網址、但引句對不上頁面的資料 —— 而「可回頁面核對」正是這個作品的賣點。這一步不可逆。

## 沒做的事

- 5 個 doc_count<3 的缺口沒補（要新文章，不在這 374 篇裡）
- 12 篇抓取失敗的沒換文章重試
- 契約 §6 說寫入路徑只有 agent 經 `/read` 的 `submitFindings`，但這輪（跟上一輪一樣）是 subagent 直接產出、沒真的走過頁面。**這個偏離已經發生兩輪**，Kidult 還沒裁示算不算數
