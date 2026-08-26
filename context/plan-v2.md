# AI 字典 × WebMCP：參賽計畫 v2（2026-08-27）

> 來源：context/product-brief.md（形態）＋ context/matt-review-2026-08-27.md（工程）＋ context/addy-review-2026-08-27.md（產品實務）。三方視為共同參賽者，本檔是收斂後的定版；形態文件保留原始思考不改。
> 截止：9/3 13:00 PT（台北 9/4 04:00）。實際工作日 7 天（8/27–9/2），9/3 只送件。

---

## 一、範圍（砍到能 demo）

| 留 | 砍（賽後再做） |
|---|---|
| `/read` 一頁：貼文件 → 本地比對已知詞 → agent 找未知詞 → 顯示目擊與矛盾 | `/review` 整頁（駁回需權限，demo 沒人按） |
| 兩個工具 `feedDocument`／`submitFindings`（後者走 `requestUserInteraction`） | ★ 讀者投票（第二條寫入路徑，評審看不出價值） |
| 🔥 降成單一數字「出現於 N 份文件」 | 三態自動退回、firm 判定 |
| 矛盾並列（兩筆 `definition_quote` 相衝 → 標「用法矛盾」）—— **這是賣點** | Haiku 閘同步呼叫（改為提交後 batch，前端標「待複核」） |
| 生命史三欄：首次出現／N 份文件／安靜 N 天 | 「firm」一詞（改顯示「安靜 N 天」，成本 0 且不騙人） |
| **無 agent 退化模式**：偵測不到 `navigator.modelContext` 時只做本地比對＋顯示命中（Addy：貢獻者∩讀者≈空集，沒旗標的人也要看到迴路在動） | 公開 API、MCP server |

## 二、資料契約修訂

| 改動 | 原因 |
|---|---|
| `term` 拆 `term_raw`（原文）＋`term_normalized`（對到字典主標） | 鎖「sentence 必含 term」與 aka 正規化互斥（Matt 2-2） |
| 新增 `context`（原句 ±1 句） | 「緊鄰句」無欄位可驗；定義常跨段，鎖改查 `quote ⊂ context`（Matt 2-1、Addy 3） |
| `sentence` 上限 120 字 | 隱私與畫面 |
| **公開只顯示 `definition_quote`，不顯示整句 `sentence`** | 去識別化只靠 agent 無 recall 下限，第三方公司名會上站（Matt 4、Addy 1） |
| 伺服器端 regex 攔 email／電話／統編／金額／URL | 同上，最低成本補法 |
| `source.hash` 加 salt | 原文直接 hash 是可比對指紋 |
| 既有 133 則標 `origin: editorial`，不進信號體系 | 冷啟動時手寫詞條顯示 0／0／0 比現在更弱（Addy 2） |
| 目擊 <3 筆的詞，信號區整塊不顯示 | 同上 |
| `explained` 保留三值但**丟棄規則只看 `domain=邊緣`＋無 `definition_quote`** | 「順帶提到 vs 假設你懂」跨 agent 必不一致，不能當丟棄輸入（Addy 3） |
| 規則 3 的「一般商業用語／動詞化一般詞」改成**明列停用清單**（導入、自架、本地、整合、平台、系統、流程、資料、知識庫…） | 判斷題偽裝成清單題是四成噪音的來源（Addy 3） |

防灌水維持客戶端三道（session token／匿名 id／hash），**對外寫成「限制」不寫成「安全設計」**（Addy 1、Matt 4）。

## 三、架構

- **儲存：Vercel Function ＋ Upstash Redis**（免費層夠、原子寫入、無容器重啟失資）。否決 GitHub 當儲存（public repo 讓來源句繞過既有外洩關卡）、否決 Zeabur JSON（併發互蓋）（Matt 1-1）
- `site/index.html` 不動；加兄弟頁 `site/read.html` 與 `api/*`。`CLAUDE.md` 部署段「Vercel 端無 build step」要改（Matt 1-2）
- `build.py --index` 產薄的 `site/lexicon.json`（term／aka／zh／slug），`feedDocument` 回這個，不回 3,144 行 `terms.json`（Matt 1-3）
- `verify_sightings.py` 單一規則來源，端點呼叫同一份，JS 不另寫（Matt 1-3）
- 8 天內**目擊不回寫 `terms/*.md`**；新詞以 0 目擊起草顯示在 `/read`，不進字典本體（Matt 1-3）
- **seed fixture**：實驗那 48 筆固定成 `fixtures/sightings-seed.json`，同時是三條鎖的回歸測試（那 2 筆違規要真的被擋）（Matt 5）

## 四、日程（Matt／Addy 建議順序，含 buffer）

| 日 | 交付 | 驗收 |
|---|---|---|
| **8/27 三** | **探針**：空白頁 `registerTool` 一個回固定字串的工具＋一個走 `requestUserInteraction` 的工具，在 ChatGPT 桌面版與 Chrome 旗標各跑一次；報名 Devpost；讀評分細則 | 兩個瀏覽器都叫得到、確認框會跳。**任一不過 → 當天改設計**（退化模式升主路徑） |
| 8/28 四 | `/read` 頁＋兩工具回 **mock**；`build.py --index`；`site/` 上 Vercel | 頁面在線上，agent 拿得到 lexicon |
| 8/29 五 | 真資料層（Upstash）＋`verify_sightings.py` 三條鎖＋regex 攔截；seed fixture 灌入 | fixture 46 筆入、2 筆被擋（自動測） |
| 8/30 六 | 矛盾並列＋生命史三欄＋無 agent 退化模式；**手算三篇文生出幾則新詞** | 用 MCP 錯解那篇跑通「用法矛盾」畫面 |
| 8/31 日 | ChatGPT 桌面版跑同一篇，比對與 Claude 實驗的差異；修 | 跨 agent 一致性有數字 |
| 9/1 一 | **buffer**；套果核 token；launch-gate Stage 1；錄離線 fallback 畫面 | 破版 0 |
| 9/2 二 | 影片 2–3 分鐘＋Devpost 文案 | 開場 30 秒＝餵 MCP 錯解文 → 字典並列兩個定義 |
| 9/3 三 | 送出 | Devpost submitted |

人力假設：Claude 主做、Kidult 每天 30 分鐘驗收＋9/2 錄影。Matt／Addy 8/29、8/30 可外發實作（資料層與鎖、退化模式），交接面＝各自 worktree `context/`。

## 五、Demo 腳本（Addy 5）

1. 貼那篇廠商文 → 已知詞亮起 → agent 抓出 MCP 的定義句「Multi-Agent、Context、Process」
2. 字典並列兩個定義、標「用法矛盾」—— 「市場上有人把 MCP 講成別的東西」
3. 切到 WebMCP 那篇 → 新詞「WebMCP」帶定義句進來、「Codex」標假設你懂
4. 關掉 agent → 同一頁退化成純比對，展示人單獨用也成立
5. 一句收尾：想改字典，拿一篇文章來

## 六、三方共同盲區（8/27 探針要補的）

沒人跑過 WebMCP；沒讀評分細則；48 筆原始資料只有 Claude 看過；投入時數未定。探針與讀規則同一天做完，其餘在 8/30 手算時回答。
