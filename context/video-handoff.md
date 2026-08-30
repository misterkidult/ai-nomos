# 影片任務交接包（2026-08-30 起草，08-31 更新）

> 給接手這件事的新對話。目標：產出一支可交 Devpost 的 demo 影片。
> 前置狀態、規則依據、卡點與分工都在這裡，不必回頭翻對話。

## ⚠ 新 session 第一件事

**先確認 `computer-use` 的工具在不在你手上**（搜工具，不是看 `/mcp` 面板）。

08-31 實測：`/mcp` 顯示 `computer-use · connected · 24 tools`，但那個 session 搜四次都拿不到任何一個工具 ——
**工具集在 session 啟動時固定，面板後來的啟用進不來**。這份交接包會存在，就是因為那個 session 必須重開。

- 搜得到 → 25–70 秒可以自動跑（見下方「卡點」）
- 搜不到 → 那格改人工錄，約兩分鐘。**這是工具邊界，不是這件事做不到**

`~/.claude.json` 登記的五台 MCP server（chrome-devtools／integrated-browser-mcp／palmier-pro／
google-workspace／adobe）工具都拿得到，所以工具載入本身是正常的，不必往那個方向查。

## 任務現況

參賽四件事，剩一件：

| # | 項目 | 狀態 |
|---|---|---|
| ① | 功能 | ✅ 全完成，三套測試綠（verify 85／test-findings／e2e） |
| ② | 線上最新版 | ✅ https://ai-nomos.vercel.app 端點全綠 |
| ③ | **影片** | 🟡 **配音完成、文章定案；畫面未錄** |
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

## 08-31 定案（這一輪新增）

| 項目 | 決定 | 檔案 |
|---|---|---|
| **旁白語言** | **改英文**（原本中文）。評審是英文讀者，規則要求 audio 說明 how you used WebMCP | `context/video-narration-en.md` |
| **字幕** | 英文。畫面上 UI 維持中文（zh 版）—— 那本身就是中文語料的證據 | 同上 |
| **配音** | Azure TTS `en-US-GuyNeural`，region `eastasia` | `scripts/video/` |
| **文章** | Simon Willison〈the lethal trifecta〉 | 見下 |
| **140–165 秒** | **寫真資料進線上，錄完不清**。那批 sightings 就是錄製當下真的餵進去的一篇文章，合乎字典規則 | — |

### 配音

六段已產出並經 Kidult 聽過定版（08-31）。重跑：

```
cd scripts/video && uv run azure_vo.py        # 預設語速
cd scripts/video && uv run azure_vo.py +6%    # 調快
```

金鑰讀 `~/Documents/ClaudeOS/Meta/1-system/.env.secrets` 的 `AZURE_SPEECH_KEY` ＋
`AZURE_SPEECH_REGION`。**不要複製金鑰到專案裡**（08-31 踩過，改成腳本直接讀原處）。

| 段 | 長度 | 分鏡格 | 餘裕 |
|---|---|---|---|
| az1 | 14.74s | 25s | +10.26 |
| az2 | 23.09s | 45s | +21.91 |
| az3 | 15.36s | 40s | +24.64 |
| az4 | 19.42s | 30s | +10.58 |
| az5 | 24.34s | 25s | **+0.66** |
| az6 | 4.46s | 15s | +10.54 |

總長 **101.4s**，上限 180s。⚠ **az5 幾乎沒有餘裕**而該格有三個動作（按鈕、數字跳動、切日文語料）
—— 建議拉長到 30s（總長仍只有 106s）。**等 25–70 秒錄完、知道 agent 真實耗時再定。**

三個駝峰字是 WebMCP Leverage 的證據，必須聽得清楚：`feedDocument`、`reportDocument`、
`submitFindings`。念糊了改 `scripts/video/en*.txt` 的拼法騙 TTS，**不要換服務**。

### 文章

**https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/**（08-31 實測 HTTP 200）

- 打中字典 16 個詞／1,622 字＝**9.9 詞每千字**，是量過的六篇裡最高
- 命中的詞正好演得出旁白層次：`Prompt Injection`／`Guardrail`／`Explainable AI` 是「作者假設你懂」那類；
  `MCP` 是 110–140 秒要做並列定義的那個詞
- 個人部落格純文字版面，**無 logo、無廣告、無 cookie 牆** —— 避開 trademarks 禁令

**排除**：Anthropic〈Building Effective Agents〉（6.1 詞/千字但品牌頁面撞商標）、
Google Blog（Gemini 商標滿版）、遠見（果核客戶＋媒體 logo）。

備選：同作者 https://simonwillison.net/2025/Sep/18/agents/（同密度 9.9、更短 1,315 字）。

密度量測腳本會隨 scratchpad 清掉，要重量就重寫：抓 `<article>`／`<main>` 內文、
比對 `public/lexicon.json` 的 `term`＋`aka`＋`zh`，英文詞用邊界比對。
**看「詞每千字」不看總數** —— Wikipedia 那種長文總數高但密度低，畫面上看不出術語很多。

⚠ `api/sightings.js` 有 `MAX = 200` 硬上限，無參數只回最新 200 筆。要全量須帶 `?days=3650`。

## 分鏡與分工

| 秒 | 畫面 | 旁白 | 誰錄 |
|---|---|---|---|
| 0–25 | 滿是術語的 AI 文章（Willison lethal trifecta） | az1 14.7s | 可代錄 |
| **25–70** | **首頁對 agent 說一句話 → 圓點轉 → 標題浮出** | az2 23.1s | **見「卡點」** |
| 70–110 | 報告：假設你懂的 5 個詞＋字典白話 | az3 15.4s | 可代錄 |
| 110–140 | 同一個詞的並列定義（`MCP`） | az4 19.4s | 可代錄 |
| 140–165 | 按下「收進字典」、數字跳動、日文語料 | az5 24.3s ⚠ | 可代錄 |
| 165–180 | 首頁 | az6 4.5s | 可代錄 |

「可代錄」＝不需要 agent 參與，用瀏覽器工具驅動線上站即可。
各格秒數是分鏡原稿的排法，**旁白實際只佔 101.4s／180s**，等 25–70 秒錄完再依實錄長度重定。

## 卡點：25–70 秒

這格拍的是 **agent 呼叫 `feedDocument` → `reportDocument` → 標題浮出**。內容不是「畫面在轉」，是「一個 agent 讀了工具描述、自己決定呼叫」。

**不可接受的做法**（已評估並否決）：
- 用 Playwright 直接呼叫 `document.modelContext` 上的函式 —— 畫面一模一樣但零 agent 參與，是偽造
- 旁邊擺一個模擬的 agent 對話框 —— 假的那半正好是評審唯一要確認的部分；且模擬 ChatGPT／Claude 介面會觸及 third party trademarks 禁令

**已否證的路**：
- CDP 接管已登入的 Chrome。9222 port 有監聽（Chrome 152.0.7977.65），但 `/json/version` 回 404 —— Chrome 152 擋掉本機程式接管已登入瀏覽器，`Host: localhost` 等繞法皆無效

**可行的路**：
1. **人工錄**：開 Chrome 152 或 ChatGPT 桌面版 → 對 agent 說一句話 → 不碰鍵鼠讓它跑完。約兩分鐘
2. **computer use 自動化**：見下段。⚠ 先搜工具確認拿得到，別看 `/mcp` 面板就當有

⚠ **旁白是英文，但對 agent 說的那句話用什麼語言不拘** —— 畫面上的 UI 是中文（zh 版），
那是刻意的：它本身就是「中文圈語料」的證據，與 az5 那句 "the same word does not mean
the same thing in Chinese as it does in English" 對得上。

## computer use（08-31 實測結果）

原本這段記的是 subagent 查文件的說法。**08-31 實測後改寫如下。**

**面板看得到 ≠ 工具拿得到。** 那個 session 的 `/mcp` 顯示 `computer-use · connected · 24 tools`
（Kidult 出示截圖），但同一個 session 搜四次工具都是空的。原因是**工具集在 session 啟動時固定**，
session 開始之後才在面板啟用的 server，工具進不來。

⇒ **新 session 一開始就搜工具確認**，不要看面板就當有。

已知為真（來自那次實測，非文件）：
- `~/.claude.json` 登記的五台 server（chrome-devtools／integrated-browser-mcp／palmier-pro／
  google-workspace／adobe）工具都拿得到 ⇒ 工具載入機制本身正常，不必往那查
- `computer-use` 不在任何設定檔的 `mcpServers` 裡，專案層 `enabledMcpjsonServers` 也是空的
  ⇒ 它是 Claude Code 內建功能，不走設定檔那條路

未驗證（仍出自文件，照抄自舊版）：Pro／Max 與 macOS 限定；需 Accessibility ＋ Screen Recording
權限，首次彈系統對話框只有本人點得掉。

**拿得到工具的話 25–70 秒可全自動**：開 ChatGPT 桌面版 → 打字 → 送出 → 等跑完。
整格仍然真實，因為呼叫 `feedDocument` 的是 ChatGPT 自己，不是被遙控的鍵盤。省不掉的是「帳號要在場」。

**拿不到就人工錄，約兩分鐘。** 這是工具邊界不是這件事做不到 —— 別為此重寫偵測腳本或換第三種方法。

## 錄影前置

1. ~~一篇術語多的 AI 文章~~ **已定**：見上方「文章」段
2. **清桌面**：勿擾模式、收掉其他視窗、選單列清乾淨（錄的是整個螢幕）
3. **agent 通道**：Chrome 152 或 ChatGPT 桌面版（Work 模式 ＋ GPT-5.6 Terra），登入狀態
4. **空跑一次**：確認 agent 真的照 `feedDocument` → `reportDocument` → `submitFindings` 順序呼叫。
   若跳過 `reportDocument`，標題不會浮出、該格沒東西拍。可用 `?demo=1` 排練
5. **140–165 秒寫真資料，錄完不清**（08-31 Kidult 決定，改掉舊版的 fixtures 建議）

## 旁白

**已定版，全文在 `context/video-narration-en.md`**（英文，含時間軸與各段長度）。
中文 v2 保留在 `context/video-narration.md` —— 兩份畫面與時間軸相同，只有語言不同。

原稿六格一句都沒提到 WebMCP，但規則明文要求 audio 要 cover "how you used WebMCP"。
v2 在不動畫面與時間軸的前提下補了四處，英文版沿用同樣的四個補點：

1. **25–70**：WebMCP 註冊五個工具；`feedDocument` 交出萃取規則；頁面從不上傳內容；
   `reportDocument` 回報標題＝它真的到過那一頁
2. **70–110**：agent 會加上使用者漏掉的詞、也會判定使用者要的詞不是 AI 術語 —— 那是它的判斷
3. **110–140**：每句定義必須是原文逐字引用，湊不出來的伺服器直接退掉
4. **140–165**：`submitFindings` 只回 `pending_review`，它寫不進任何東西 —— 按下去之前字典什麼都沒動

配音已完成，見上方「配音」段。

## 給接手對話的建議順序

1. **搜工具確認 `computer-use` 在不在手上**（不是看 `/mcp` 面板）—— 決定 25–70 秒自動還是人工
2. 錄可代錄的五格（不需要 agent，瀏覽器工具驅動線上站即可）
3. 錄或補 25–70 秒
4. **依實錄長度定各格秒數** —— 旁白只佔 101.4s／180s，餘裕充足；
   az5 那格要不要從 25s 拉到 30s 等這時候一起定
5. 剪接、上英文字幕（從 `scripts/video/en*.txt` 切 SRT）
6. 上傳 YouTube 設 public，連結填回 Devpost 表單

## 相關檔案

**本輪產出（08-31）**

- 英文旁白定版＋時間軸：`context/video-narration-en.md`
- 中文 v2（同畫面同時間軸）：`context/video-narration.md`
- 配音腳本與六段稿子：`scripts/video/`（`azure_vo.py`、`en1-6.txt`、`README.md`）
- 產出的 mp3 不進版控（`.gitignore`），重跑 `uv run azure_vo.py` 即可

**既有**

- 分鏡原稿與 submission 文案：`context/devpost-submission.md`
- 資料契約：`context/contract.md`
- 專案規則：`CLAUDE.md`
