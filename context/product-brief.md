# AI 字典 × WebMCP：計畫簡報（供審查）

## 背景
- 本 repo：133 則白話 AI 詞條（`terms/*.md`，一詞一檔）、`build.py`（lint＋產生 `site/terms.json`）、`site/` 靜態查詢站（目前只在本機跑）。讀者是不碰技術但要跟人談 AI 的人。
- 目標：讓字典**自己成長** —— 有人丟文件，從中抓出 AI 名詞，累積成詞條；並報名 OpenAI WebMCP Challenge（https://openai.com/webmcp-challenge/ ，9/3 13:00 PT 截止，交線上 app＋repo＋影片）。
- WebMCP：網頁用 `navigator.modelContext.registerTool({name, description, inputSchema, execute})` 把 JS 函式註冊成工具，瀏覽器內 agent（ChatGPT 桌面版內建瀏覽器、Edge 147、Chrome 149 origin trial）直接呼叫。W3C 社群草案。參考 https://github.com/webmachinelearning/webmcp

## 產品一句話
把文件丟進來，字典自己長大。

## 第一原則
想改字典，拿證據不講意見：唯一的編輯動作是提交一筆「目擊紀錄」（某篇文章怎麼用這個詞）。爭議不裁判 —— 兩筆定義相衝就並列、標「用法矛盾」。人保留的唯一動作是駁回（紀錄造假才用）。

## 只走 WebMCP
不開公開 API、不開 MCP server。`execute` 打回站的端點存目擊，端點不公開、綁頁面 session token。代價：貢獻者限 ChatGPT 桌面版／Edge／Chrome 旗標；不能批次餵（視為防灌水）。

## 頁面
- `/read`：人把文件貼進瀏覽器（**文件不上傳**，全文留在瀏覽器）。本地比對 `terms.json` 得已知詞命中。
- `/review`：依「熱但沒人確認」排序的清單，只有駁回一個動作。

## 工具（兩個，註冊在 `/read`）
- `feedDocument()` 唯讀：回已知詞命中（含 ★🔥、四段內容）、收錄判準、提煉規則、範例。
- `submitFindings(findings[])` 寫入，走 `requestUserInteraction`：agent 在瀏覽器端找出未知 AI 詞，送回目擊紀錄。

## 目擊紀錄（資料契約）
| 欄位 | 內容 |
|---|---|
| term | 原樣寫法 |
| sentence | 出現那一句，去識別化（[公司][人名][金額]） |
| explained | 有定義句／順帶提到／假設你懂 |
| intent | 賣點／技術描述／風險或限制 |
| domain | 是／邊緣／不是 |
| definition_quote | 僅 explained＝有定義句時，原文引句（須為 sentence 子字串或緊鄰句） |
| source.kind | 提案／報價／新聞／白皮書／內部文件 |
| source.hash | 文件內容 hash（去重，不存文） |
| source.date | 文件日期 |
| agent | agent／模型版本 |
| submitter | 匿名瀏覽器 id |

伺服器端三條鎖：definition_quote ⊂ sentence（或緊鄰句）；三個單選 enum；sentence 必含 term。另一道 Haiku 閘複核 domain 與不收類別（模型架構名、演算法、統計、一般商業用語、動詞化一般詞如導入／自架／本地）。規則：domain=邊緣 且 順帶提到 → 直接丟。

## 兩個信號＋定型
- ★ 可信度：讀者在詞條頁按 +1（一瀏覽器一票，可附查過的來源）。
- 🔥 熱度：最近 30 天含該詞的不同文件數，會退。
- 定型三態（套 Bauer 1983 nonce formation → institutionalization → lexicalization）：新詞（首次抓出、0★、機器起草）→ 傳開中（≥2 份文件）→ **firm＝定義最後修改後 30 天無新 definition_quote**；新文件引出矛盾 → 自動退回傳開中。全部算出來，無人核准。
- 詞條顯示生命史：首次出現日／出現於 N 份文件／定義修改 N 次／firm since／★；底下列來源句。

## 詞條＝f(目擊)
定義只從 definition_quote 歸納（agent 不得憑印象補定義）；「你為什麼會聽到它」從 intent 分布來；矛盾＝兩筆 definition_quote 講不同東西。

## 提煉規則（feedDocument 回傳給 agent 的指示，草稿）
1. 只抄不解釋。term 照原文；sentence 抄整句；definition_quote 只在文章自己有解釋時填、須原文引句，否則留空。
2. 三個單選 explained／intent／domain。
3. 不收：模型架構名、訓練參數、演算法名、統計名詞、一般商業用語、動詞化一般詞。
4. 已知詞清單（含別名）附上；命中照樣回報。
5. 去識別化。
6. 一詞一筆，選有定義句那次。

## 已做的實驗（2026-08-27，用 Claude subagent 扮使用者 agent，非 ChatGPT）
三篇文章（廠商文／中小企業指南／英文新聞）共 48 筆：違反鎖 2 筆；aka 正規化 agent 自己做得好；噪音主要是收太多一般詞（約四成為邊緣＋順帶提到）；「裝飾」選項零次被選已移除；一篇廠商文把 MCP 錯解成「Multi-Agent、Context、Process」，agent 照抄 → 與字典相衝 → 正是矛盾偵測要抓的。未測：跨 agent 一致性。

## 8 天日程草案（8/27–9/3）
8/27 報名＋環境（ChatGPT 桌面版、Chrome 旗標）＋`site/` 上 Vercel → 8/28 資料層（目擊存放、去重、三條鎖）＋`feedDocument` → 8/29 `submitFindings`＋Haiku 閘 → 8/30 `/read` 頁＋registerTool → 8/31 ChatGPT 桌面版實測 → 9/1 修＋🔥／★／firm 計算＋生命史顯示 → 9/2 影片＋文案 → 9/3 送出。

## 未定／沒把握
- 目擊存放在哪（JSON 檔於 Zeabur 容器？Vercel KV？GitHub？）未定
- ChatGPT 內建瀏覽器對 `requestUserInteraction` 支援程度未實測
- 「定義變了沒」v1 不做語意比對，firm 用「30 天無新 definition_quote」代理
- 讀者願不願意把文件貼進網頁（即使不上傳）
