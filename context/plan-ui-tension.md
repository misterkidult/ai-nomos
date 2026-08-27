# 計畫：把資料的張力做出來（2026-08-27 晚，供新對話接手）

> Kidult 原話：「想辦法把這個介面做得好玩有趣。不是設計風格用色的那種，而是要把資料的張力凸顯出來。像我覺得現在那個連結的比重太強了，應該主角是詞跟它的解釋才對。」
>
> 這份是**計畫**不是規格。新對話第一件事：讀完這份、看一眼線上頁、出假畫面，不要直接改正式頁。

## 一、現況（新對話不必重查）

- 線上 https://ai-nomos.vercel.app ｜repo main `f0d5870`｜prebuilt 部署（`vercel build --prod` → `vercel deploy --prebuilt --prod`）
- 頁面：`/`（首頁：數字列／本週在夯／賣與擔心／剛冒出來／動態牆／搜尋）、`/terms`（133 則清單）、`/term/{slug}`（定義置頂＋「解釋它的文章」「提到它的文章」）、`/read`（拿文章來，WebMCP 工具）。共用 `public/nomos.js`（資料層＋i18n 兩套字串）、`public/nomos.css`
- 資料：`public/sightings.json` 過渡儲存，**924 筆目擊、374 篇文章、177 個字典沒有的新詞**，全部 `submitted_at` 今天。欄位見 `context/contract.md` §4；`sentence`／`context` 不公開，頁面只有 `definition_quote`、`explained`、`intent`、`domain`、`source{url,title,published}`
- 資料層：Kidult 拍板改 **Supabase**、由 Claude 建（stage）。CLI 已登入（`supabase projects list` 看得到 3 個既有專案：forma-mvp-tokyo／cbsb-mvp／twdc-dataset），**尚未建 ai-nomos 專案、契約 §5 的儲存段還寫 Upstash 待改**。這件與本計畫無關，UI 先用 json 做
- 工作流：**前端動線改動先出 scratchpad 假畫面（真 CSS、真資料）給 Kidult 點，拍了才進正式頁**；既有假畫面在 `scratchpad/mock/`（home-mock2、term-mock、read-mock），新對話的 scratchpad 路徑不同，重做即可

## 二、他判斷不對的地方（今天看到的）

1. **連結搶戲**。首頁動態牆每一條是「有人在《文章標題》看到 X」—— 文章標題比詞長、比詞粗。詞條頁每個來源是一行標題連結，引句反而縮在底下。主從顛倒
2. **「用法矛盾」變成噪音**。判準是「兩句 definition_quote 字面不同」，13 篇講 RAG 就 13 種講法 → 本週在夯 12 個詞 11 個帶矛盾標籤。標籤失去意義（Addy 8/30 本來要審的，可提前處理）
3. 生命史全是「第一次被看見 08-27、安靜 0 天」—— 資料今天一次灌入，正確但沒張力；等餵幾天才有形狀，UI 別靠它撐場面

## 三、資料裡有哪些張力可以做（候選，全列不截）

真資料算得出來、契約不用改的：

| # | 張力 | 資料從哪來 | 一句話畫面 |
|---|---|---|---|
| A | **同一個詞，好幾種說法** | 一詞多個 `definition_quote` | 詞條頁把定義句當主角並排，像字典的義項 ①②③；來源縮成註腳 |
| B | **賣的人 vs 擔心的人** | `intent` = selling_point vs risk_or_limit | 同一詞兩欄：這邊說它多好、那邊說它多危險（Agent 16 賣／7 擔；Hallucination 16 擔） |
| C | **假設你懂 vs 有人解釋** | `explained` 三值比例 | 「術語濃度」：Token 被提 16 次、幾次有人解釋？→ 讀者最容易被丟著不管的詞 |
| D | **新詞冒出來** | `term_normalized == ""` 的 177 個 | 不是清單，是「剛從文章裡掉出來、還沒名分」的感覺；帶那句引句 |
| E | **多數說法 vs 少數說法** | 定義句分群（先用字面相似度或最短字串比對，不上 LLM） | 取代現在的「用法矛盾」：只在少數派明顯不同時標 |
| F | **一篇文章丟出幾個詞** | 同 `source.url` 分組 | 「這篇文章教你 7 個詞」—— 文章是容器不是主角 |
| G | **中英混用** | `term_raw` 不同寫法對到同一 `term_key` | 同一個詞被寫成 MCP／模型上下文協定／Model Context Protocol，哪種寫法最多人用 |

「張力」的共通判準：**兩個數字或兩句話擺在一起才有意思**，單一數字（N 次目擊）沒有。

## 四、建議順序（新對話的第一輪）

1. 先只做**詞條頁**（`/term/{slug}`）的假畫面 —— 主角是詞＋定義句並排（A），來源退成註腳；B、C 各一小塊。拿 RAG、Agent、Hallucination 三個真資料多的詞當樣本
2. 拍了再回頭改首頁：動態牆改成「詞＋那句話」而不是「文章標題」；本週在夯的「用法矛盾」標籤先拿掉，等 E 做好再放回
3. 首頁的「剛冒出來」照 D 重做
4. 不動：`/read`、契約、`nomos.js` 的資料函式（`stats`／`groupByTerm` 可加不可改語意）

## 五、不要做的

- 不做配色／字型／版面風格的討論，他講明了不是這個
- 不加新資料欄位、不改契約 —— 這一輪全部是既有欄位的重新組合
- 不等 Supabase；json 夠用。Supabase 另開一輪
- 假畫面沒拍前不碰 `public/`

## 六、已知的坑

- `first_seen`／`quiet_days` 現在全是今天，別拿它當視覺主軸
- 34 篇來源自動抓取被反爬擋（iThome 429、INSIDE／天下／Medium 403），內容正常、連結能開，不是壞連結
- `lookup()` 用最長別名比對，「MCP（Multi-Agent…）」曾被對到 Context，已修成「詞開頭優先」（`nomos.js` 沒有這段，`read.html` 有；詞條頁靠 `term_key` 不靠它）
- 新詞的 `term_key` 是 `term_raw` 小寫，同一新詞不同大小寫會合併、不同寫法（中／英）不會 —— G 那題會撞到這個
