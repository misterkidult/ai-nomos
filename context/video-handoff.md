# 影片任務交接包（2026-08-30 起草）

> 給接手這件事的新對話。目標：產出一支可交 Devpost 的 demo 影片。
> 前置狀態、規則依據、卡點與分工都在這裡，不必回頭翻對話。

## 任務現況

參賽四件事，剩一件：

| # | 項目 | 狀態 |
|---|---|---|
| ① | 功能 | ✅ 全完成，三套測試綠（verify 85／test-findings／e2e） |
| ② | 線上最新版 | ✅ https://ai-nomos.vercel.app 端點全綠 |
| ③ | **影片** | ⬜ **本交接包的任務** |
| ④ | repo public | ✅ 2026-08-30 轉 public，MIT LICENSE 在 root |

## Devpost 硬性要求

來源 https://webmcp.devpost.com/rules （2026-08-30 查證）

- 長度 **< 3 分鐘**，評審不被要求看超過三分鐘
- **YouTube、public**，連結填在表單
- 必須有 **audio**，且內容要 cover "what you built and **how you used WebMCP**"
- 必須是 **"a clear demo of your project functioning"**
- **禁止 third party trademarks**、有版權音樂或素材
- 截止 **2026-09-03 13:00 PDT**（台北時間 9/4 04:00）

評分四項，第一項是 **WebMCP Leverage**（實作的徹底與巧妙程度），其後為 Execution、Potential Impact、Creativity & Ambition。

## 本輪已完成的前置

| 項目 | 結果 |
|---|---|
| 線上端點驗證 | `/`、`/read`、`/probe`、`/api/sightings`、`/fixtures/*`、`/lexicon.json` 全 200 |
| **數字驗證** | 線上實測 **1,322 sightings／341 documents／zh 1,217・en 98・ja 7**，與腳本完全一致，**旁白數字不用改** |
| 螢幕錄影能力 | ffmpeg 9.0 + `Capture screen 0` 實測通過，3840×2160 @30fps |
| 旁白 v2 | 已補上 WebMCP 內容，見下方「旁白」段 |

⚠ `api/sightings.js` 有 `MAX = 200` 硬上限，無參數只回最新 200 筆。要全量須帶 `?days=3650`。

## 分鏡與分工

| 秒 | 畫面 | 誰錄 |
|---|---|---|
| 0–25 | 滿是術語的 AI 文章 | 可代錄 |
| **25–70** | **首頁對 agent 說一句話 → 圓點轉 → 標題浮出** | **見「卡點」** |
| 70–110 | 報告：假設你懂的 5 個詞＋字典白話 | 可代錄 |
| 110–140 | 同一個詞的並列定義 | 可代錄 |
| 140–165 | 按下「收進字典」、數字跳動、日文語料 | 可代錄 |
| 165–180 | 首頁 | 可代錄 |

## 卡點：25–70 秒

這格拍的是 **agent 呼叫 `feedDocument` → `reportDocument` → 標題浮出**。內容不是「畫面在轉」，是「一個 agent 讀了工具描述、自己決定呼叫」。

**不可接受的做法**（已評估並否決）：
- 用 Playwright 直接呼叫 `document.modelContext` 上的函式 —— 畫面一模一樣但零 agent 參與，是偽造
- 旁邊擺一個模擬的 agent 對話框 —— 假的那半正好是評審唯一要確認的部分；且模擬 ChatGPT／Claude 介面會觸及 third party trademarks 禁令

**已否證的路**：
- CDP 接管已登入的 Chrome。9222 port 有監聽（Chrome 152.0.7977.65），但 `/json/version` 回 404 —— Chrome 152 擋掉本機程式接管已登入瀏覽器，`Host: localhost` 等繞法皆無效

**可行的路**：
1. **人工錄**：開 Chrome 152 或 ChatGPT 桌面版 → 對 agent 說一句話 → 不碰鍵鼠讓它跑完。約兩分鐘
2. **computer use 自動化**：見下段

## computer use（未驗證，subagent 查證）

⚠ 以下出自 subagent 查 https://code.claude.com/docs/en/computer-use.md ，**本人未親自開文件驗過**。若 `/mcp` 裡找不到 `computer-use`，代表資訊有落差，別硬找。

- Claude Code **內建** MCP server `computer-use`（研究預覽），Pro／Max、macOS 限定，**不需裝第三方**
- 啟用：互動式 session 執行 `/mcp` → 找到 `computer-use` → Enable
- 權限：**Accessibility**（點擊打字）＋ **Screen Recording**（看螢幕），首次會彈系統對話框，只有本人點得掉；給完可能要重啟
- Claude 桌面版亦有：Settings → General → Desktop app → Enable
- ⚠ 與 API 層的 computer use **不是同一件事**：API 那個是虛擬機內的桌面模擬，這個是真控本機

**啟用後 25–70 秒可全自動**：開 ChatGPT 桌面版 → 打字 → 送出 → 等跑完。整格真實，因為呼叫 `feedDocument` 的仍是 ChatGPT 自己。省不掉的是「帳號要在場」。

## 錄影前置

1. **一篇術語多的 AI 文章**。挑來源避開 logo 明顯的站（trademarks 禁令）
2. **清桌面**：勿擾模式、收掉其他視窗、選單列清乾淨（錄的是整個螢幕）
3. **agent 通道**：Chrome 152 或 ChatGPT 桌面版（Work 模式 ＋ GPT-5.6 Terra），登入狀態
4. **空跑一次**：確認 agent 真的照 `feedDocument` → `reportDocument` → `submitFindings` 順序呼叫。若跳過 `reportDocument`，標題不會浮出、該格沒東西拍。可用 `?demo=1` 排練
5. **140–165 秒**建議用 fixtures 呈現，不寫真資料進線上，免得事後要清

## 旁白

完整 v2 在 scratchpad（可能已隨 session 清掉，內容如下要點）：

原稿六格**一句都沒提到 WebMCP**，但規則明文要求 audio 要 cover "how you used WebMCP"。v2 在不動畫面與時間軸的前提下補了四處：

1. **25–70**：WebMCP 註冊五個工具；`feedDocument` 交出萃取規則；頁面從不上傳內容；`reportDocument` 回報標題＝它真的到過那一頁
2. **70–110**：agent 會加上使用者漏掉的詞、也會判定使用者要的詞不是 AI 術語 —— 那是它的判斷
3. **110–140**：每句定義必須是原文逐字引用，湊不出來的伺服器直接退掉
4. **140–165**：`submitFindings` 只回 `pending_review`，它寫不進任何東西 —— 按下去之前字典什麼都沒動

配音兩選：`say -v Meijia`（zh_TW，系統 TTS，技術上滿足 audio 要求但聽感廉價）或本人用 RØDE 錄（裝置已在系統中）。**建議先用 TTS 做一版完整的**，時間軸與剪接到位後若要換人聲，換軌即可不必重剪。

## 給接手對話的建議順序

1. 確認 computer use 能否啟用（決定 25–70 秒是自動還是人工）
2. 錄可代錄的五格
3. 錄或補 25–70 秒
4. 配音、剪接、上字幕、壓到 3 分鐘內
5. 上傳 YouTube 設 public，連結填回 Devpost 表單

## 相關檔案

- 分鏡原稿與 submission 文案：`context/devpost-submission.md`
- 資料契約：`context/contract.md`
- 專案規則：`CLAUDE.md`
