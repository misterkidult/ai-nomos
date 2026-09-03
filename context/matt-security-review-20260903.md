# ai-nomos 資安檢查 · 2026-09-03

檢查者：外包工程師（討論模式，只出報告，未改任何 code）
檢查對象：`matt/security-review` at `496f159`
方法：靜態讀 code。**沒有打過任何線上端點，沒有看過 Upstash 實際資料。**

---

## 三句話結論

1. **不建議就這樣上線。** 目前 `POST /api/findings` 允許任何匿名呼叫者用「公開回應裡就有的資料」覆寫掉字典裡任何一筆既有目擊，而且沒有任何欄位大小上限 —— 一次 curl 就能永久污染或撐爆首頁資料，且沒有還原路徑。
2. **最該先修的是 S1（既有紀錄可被任意覆寫）與 S2（儲存欄位無大小／型別上限）**，兩條都在 `api/findings.js`，都不需要改契約，加幾個 guard 就好；S3（讀取端點的放大效應）緊接在後，因為它是「十分鐘 curl 迴圈把站打掛＋把帳單打上去」最便宜的那條路。
3. **我沒查到的地方**：所有需要實際打端點才知道的行為（Vercel 對 `x-forwarded-for` 的處理、`/api/_locks` 是否可達、實際回應標頭、瀏覽器對 `javascript:` + `target=_blank` 的現行行為），以及 Upstash 裡真正躺了什麼資料、用的是哪個方案。這些我在報告最後獨立列出來。

---

## 攻擊面速覽

| 面向 | 狀態 |
|---|---|
| 寫入認證／授權 | 無（契約 §6 明講是刻意的） |
| 寫入限速 | 有，但兩把鑰匙都由呼叫端提供 → 形同無 |
| 寫入內容驗證 | 只有契約 §3 的九條語意鎖，**沒有型別與大小驗證** |
| 既有資料保護 | 無 —— 覆寫 key 完全由公開資料推導 |
| 讀取限速 | 完全沒有，且回應筆數無上限 |
| 注入（SQL/指令/SSRF） | 沒有 —— 這三面做得乾淨，見「已經做對的」 |
| XSS | 一條真的路徑（`source.url` → `href`），其餘文字節點都有 escape |
| 憑證 | 乾淨，無硬編碼、無外洩到 client |
| 安全標頭 | 完全沒有（`vercel.json` 只有 rewrites） |
| 相依套件 | 零相依，無漏洞面 |

---

## 嚴重（上線前必修）

### S1　任何人可覆寫字典裡任何一筆既有目擊

**位置**：`api/findings.js:135-140`（docHash）、`api/findings.js:142`（termKey）、`api/findings.js:150-152`（HMGET docterm）、`api/findings.js:162`（id）、`api/findings.js:182-185`（SET／ZADD 寫入）；配合 `scripts/kv-backfill-docterm.py:37-39`、`scripts/kv-load.py:50`

覆寫是**設計上要的**（契約 §5「re-feeding an article overwrites rather than piles up」），問題出在覆寫的鑰匙是什麼：

```
docterm 欄位名 = sha16(source.url) + "|" + term_key
```

`sha16` 無鹽（`api/findings.js:25`，註解也寫明「hashing it needs no salt」），`term_key` 直接取自 finding。而這兩個值 **`GET /api/sightings` 全部公開**：`source.url` 是 ★ 欄位（契約 §4）、`term_key` 也是 ★ 欄位（`api/sightings.js:12`）。

我實際算過一筆現有資料：

```
公開回應裡的 url      : https://ai-coding.wiselychen.com/ai-governance-not-it-problem/
公開回應裡的 term_key : ai-governance
→ docterm 欄位名      : 7dda8a175203c549|ai-governance
```

`kv-load.py:50` 用的是同一條 `sha256(url)[:16]`，`kv-backfill-docterm.py:39` 又把開張那 1,314 筆的 legacy id 掛進同一張 `docterm` —— 所以連開張批次也在射程內。

**可利用性判斷（高信心，未實際打過端點）**：
攻擊者 `GET /api/sightings?days=99999` 抓走全部（url, term_key）配對，然後對每一組送一筆 finding：`source.url` 照抄、`term_raw` 設成該 `term_key`、`sentence` 設成含該詞的任意句子、`definition_quote` 隨便編一句並讓它是 `context` 的子字串。九條鎖**全部都是攻擊者自己提供的欄位之間的一致性檢查**，沒有一條會擋 —— 鎖驗的是「這筆 finding 內部自洽嗎」，不是「這句話真的在那篇文章裡嗎」。

結果：`existing[i]` 命中舊 id → `SET sighting:<舊 id>` 用攻擊者的內容整筆蓋掉，`ZADD recent` 把分數更新成現在（`api/findings.js:184`）→ 被竄改的紀錄還會浮到動態牆最上面。原始內容沒有備份、沒有版本、沒有稽核欄位，**不可還原**。

一個人用 curl 迴圈十分鐘能做到的：以每篇文章十個詞估，374 篇約 3,700 筆，每次請求塞 50 筆 → 約 74 個請求。單一 IP 每小時 120 個請求的額度就夠把整本字典的引句換成任意內容，而且每一筆都還掛著原文章的真實連結。對一個「主張自己只給證據、每句都可回查」的產品，這是致命傷。

**建議方向**（不是這輪的工作，只標方向）：覆寫只在 `submitter` 與原紀錄相同時允許；或 id 加入 `submitter`；或把覆寫改成 append + 標記取代。三選一，都不用動契約 §1–§3。

---

### S2　儲存欄位沒有大小與型別上限，一次請求可永久打壞首頁

**位置**：`api/findings.js:167`（`definition_quote` 原樣存）、`api/findings.js:165`（`term_raw` 原樣存）、`api/_locks.js:14,25`（REQUIRED 只檢查 `k in f`，不檢查型別）、`api/_locks.js:33`

唯一有長度上限的是 `sentence`（120 code points，`api/_locks.js:30`）。但：

- `context` 完全沒有上限，而 `definition_quote` 只要是 `context` 的子字串就過（`api/_locks.js:33`）—— **兩者都由攻擊者提供**，所以 `definition_quote` 的實際上限就是 HTTP body 大小（Vercel serverless 約 4.5 MB）。
- `definition_quote` 是 ★ 公開欄位，會出現在**每一次** `GET /api/sightings` 的回應裡（`api/sightings.js:12`），也會被首頁 `N.tq()` 畫出來。
- 型別也沒驗。`REQUIRED.some(k => !(k in f))` 只看 key 在不在；`term_raw` 傳一個巢狀 JSON 物件時，`check()` 走 `String(f.term_raw||'')` 得到 `"[object Object]"`，只要 `sentence` 含這串就過鎖 —— 但 `api/findings.js:165` 存的是**原始物件**。也就是說 120 字的 `sentence` 上限完全綁不住 `term_raw` 的體積。

**可利用性判斷（高信心，未實際打過端點）**：
一個請求、一筆 finding、一段 4 MB 的 `definition_quote`，就讓預設的 `/api/sightings`（最新 200 筆，這筆一定在內）回應永遠變成 4 MB。首頁每一位訪客都要下載它。要清掉必須手動進 Upstash 刪 key —— 沒有任何端點做得到（契約 §6：「There is no editorial endpoint」，這句話這裡反過來咬人）。

送 50 筆填滿 4.5 MB，一小時 120 次 → 單一 IP 每小時可灌 540 MB 進 Upstash。這是儲存成本與頻寬成本，不是一次性的。

---

### S3　讀取端點無限速、無筆數上限、且可繞過 CDN 快取

**位置**：`api/sightings.js:44-52`（三條查詢路徑）、`api/sightings.js:56`（`ids.map(id => ['GET', ...])`）、`api/sightings.js:70`（快取標頭）

三條路徑裡有兩條沒有上限：

- `?term_key=<x>` → `ZREVRANGE by_term:<x> 0 -1`（`api/sightings.js:46`，註解自己寫「no cap」）
- `?days=<n>` → `ZREVRANGEBYSCORE recent +inf <since>`（`api/sightings.js:49`）。`days=99999` 讓 `since` 變負數，直接撈全部。

然後 `api/sightings.js:56` 把撈到的 **每一個 id 都變成一條 GET**，塞進同一個 pipeline。以現在約 1,300 筆估：

```
一個 HTTP GET  →  SCARD ×1 + ZREVRANGEBYSCORE ×1 + GET ×1,300  ≈ 1,300 個 Upstash 指令
```

快取擋不住：`api/sightings.js:70` 設了 `s-maxage=60`，但 CDN 是**按完整 URL** 做 key，而 handler 只讀 `term_key`／`days`／`lang` 三個參數，其餘一律忽略。所以 `?days=99999&z=$RANDOM` 每次都是新的快取 key、每次都回源、每次都跑那 1,300 個指令。

**可利用性判斷（高信心，未實際打過端點）**：
一個人一台機器、十分鐘：

```
while true; do curl -s "https://ai-nomos.vercel.app/api/sightings?days=99999&z=$RANDOM" >/dev/null; done
```

保守抓 5 req/s → 十分鐘 3,000 個請求 → 約 **400 萬個 Upstash 指令**、以及 3,000 次 Vercel function 呼叫與數 GB 出站流量。指令數的絕對計費金額我不敢寫死（不知道你用哪個方案），但倍率是硬的：**每一個 HTTP 請求放大成約 1,300 個 Redis 指令**，而免費方案的日指令額度是十萬量級 —— 以這個倍率，撐不過一分鐘。

跟 S2 相乘更難看：先用 S2 灌大量肥紀錄，再跑 S3 的迴圈，單次回應就是數十 MB。

---

### S4　`source.url` 沒有 scheme 驗證就進 `href`

**資料流**：`api/findings.js:168`（原樣存，沒有任何 URL 驗證）→ `api/sightings.js:19`（原樣公開）→ 前端三處：

- `public/index.html:83-85`（`src()`，首頁動態牆與新詞區）
- `public/term.html:29-31`（`src()`，詞條頁）
- `public/nomos.js:323`（`quoteHtml`，目前無人呼叫，但一樣是 sink）
- `public/index.html:270-271`（`renderFound()`，資料來自本機 agent，尚未落地）

`esc()`（`public/nomos.js:3`）只轉 `& < > "`。它擋得住「跳出屬性」，**擋不住 scheme** —— `javascript:...` 原樣進到 `href="..."` 裡。

**可利用性判斷（中信心，兩段要分開講）**：

- **「可以塞任意連結」是確定的，不需要任何瀏覽器條件。** 攻擊者送一筆 finding，`source.title` 寫成看起來正常的文章標題、`source.url` 指向惡意站，這條就掛在首頁動態牆上，外觀跟其他來源連結一模一樣。搭配 S1 甚至可以把**既有**紀錄的連結換掉 —— 讀者看到的是一則有引句、有出處、有日期的正常目擊。這是確定會發生的危害，等級不低於 XSS。
- **`javascript:` 是否真的執行成 stored XSS，我沒驗過。** 現代 Chrome 對 `<a href="javascript:" target="_blank">` 的處理我不敢憑記憶斷言（`data:text/html` 的頂層導覽早就被擋了，`javascript:` 則另有規則）。**這條標「推測，未驗證」** —— 但驗證成本是三十秒：本機開一頁放 `<a href="javascript:alert(1)" target="_blank" rel="noopener">x</a>` 點一下。無論結果如何，修法都一樣：在 `api/findings.js` 存之前擋掉非 `http(s):` 的 url。

> ⚠️ **2026-09-03 已由委託方實測，結論修正見文末「附錄二」。** 摘要：現行程式碼**不會**執行（`target="_blank"` 擋下），但拿掉該屬性就會執行；且 `esc()` 擋不住大小寫／空白／tab 四種變形，修法**不能用字串比對**。

---

## 中等（該修，但不擋上線）

### M1　限速的兩把鑰匙都由呼叫端自己提供

**位置**：`api/findings.js:97`（`submitter` 直接取自 body）、`api/findings.js:107`（`x-forwarded-for` 取**第一段**）、`api/findings.js:110-113`

- `submitter` 是 body 裡的字串。攻擊者每次換一個 → `PER_SUBMITTER_HOURLY = 60` 這條完全不存在。契約 §4 自己寫了「a limit, not a security feature」，這點是誠實的，但實際效果是零，不是「弱」。
- `PER_IP_HOURLY = 120` 是唯一還在的一道。它取 `x-forwarded-for` 的**第一段**（`.split(',')[0]`）—— 這是 XFF 的經典陷阱：第一段語意上是「最原始的 client」，若代理是 append 而非 overwrite，那一段就是攻擊者自己送的。

**推測，未驗證**：Vercel 的邊緣到底是覆寫還是附加 `x-forwarded-for`，我沒打過端點所以不知道。若是附加，`curl -H 'x-forwarded-for: 1.2.3.4'` 每次換值 → 兩層限速同時歸零，S1／S2 的攻擊速率就只剩頻寬限制。驗證成本：一個 curl，看 429 會不會出現。無論結果，較穩的寫法是改用 `x-real-ip` 或取**最後**一段。

### M2　`Access-Control-Allow-Origin: *` 讓限速可以分散到真實訪客身上

**位置**：`api/findings.js:76-78`

沒有 cookie／session，所以這不是傳統 CSRF。但配上 `Access-Control-Allow-Methods: POST` 與 `Allow-Headers: Content-Type`，**任何網站的 JS 都能用訪客的瀏覽器與訪客的真實 IP 打這個寫入端點**。攻擊者只要把一段腳本放進任何有流量的頁面，就能把 M1 剩下的那道 per-IP 限速拆散到成千上萬個乾淨 IP 上 —— 而且 IP 封鎖會誤傷真實使用者。

考量到端點本來就無認證，這條的增量危害是「規避限速與封鎖」，不是「取得原本沒有的能力」，所以列中等。

### M3　PII 鎖可以用任意 url 字串繞過

**位置**：`api/_locks.js:53-57`

```js
const isPublicArticle = !!(f.source && f.source.url);
if (!isPublicArticle) { /* 才跑 PII 正則 */ }
```

`url` 只要是 truthy 就算「公開文章」，內容不驗、不比對、不解析。想讓夾帶個資或金額的貼上文件通過 `PII_DETECTED`，只要加一個 `source: {url: "x"}`。

契約 §3 的豁免理由是「公開文章的引句必須逐字可回查」，理由成立；但「有 url」目前不等於「真的是公開文章」。至少該要求 `url` 通得過 `new URL()` 且 scheme 是 http(s)（順帶就把 S4 一起修掉）。

### M4　完全沒有安全標頭

**位置**：`vercel.json`（只有 `rewrites`，無 `headers`）

缺的：`Content-Security-Policy`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`X-Frame-Options`／`frame-ancestors`。

- CSP 是 S4 最有效的第二道防線（`script-src` 不含 `unsafe-inline` 會擋掉大部分注入結果）—— 但要注意頁面現在**大量使用 inline `<script>`**（`index.html:75`、`term.html:19` 等），要上 CSP 得先處理這件事，不是加一行標頭就好。
- `frame-ancestors` 對這個產品有具體意義：唯一的寫入動作是那顆「收進字典」按鈕（`public/index.html:293`），整個設計把「人按了確認」當成第四道閘。可被 iframe 疊層 = 那道閘可被騙過。

### M5　`contributors` 計數與 Redis key space 可被灌

**位置**：`api/findings.js:192`（`SADD contributors <submitter>`）、`api/findings.js:110-111`（`rate:sub:<submitter>` 每個新 submitter 一把新 key）

`submitter` 任意 → 每個請求可新增一名「貢獻者」。首頁的 `n-contrib`（`public/index.html:115`）直接顯示 `SCARD`，可被任意灌大；`contributors` 集合永久成長，沒有清理。`rate:sub:*` 每把 key 有 1 小時 TTL，成長有界 —— 但這個界是 per-IP 限速給的，所以 M1 若成立，這裡也一起失控。

危害是「展示數字失真＋儲存慢性成長」，不是資料損毀，列中等偏低。

### M6　錯誤訊息把上游回應回吐給呼叫端

**位置**：`api/findings.js:33`（`upstash ${r.status}: ${text.slice(0,200)}`）、`api/findings.js:206`（`String(e.message||e)`）、`api/sightings.js:29,77`

Upstash 的錯誤內文（最多 200 字）會原封不動出現在 500 回應裡。我沒看過實際內容，正常情況不含 token；但若 `KV_REST_API_URL` 設錯導致 `fetch` 在 URL 解析階段就丟例外，`e.message` 會帶出完整的 Upstash 端點 URL（含資料庫識別碼）。對外回一個泛用字串、細節寫進 log 就好。

---

## 低（可接受或之後再說）

| # | 位置 | 說明 |
|---|---|---|
| L1 | `public/fixtures/out_A.json` | 這個檔是**被靜態伺服出去的**，而它含 `sentence` 欄位（14 筆）。契約 §4 白紙黑字寫 `sentence` / `context`「never public」。內容本身來自公開文章、危害趨近於零，但這是契約與實作不一致的**證據**，被抓到會很難解釋。`api/*` 那一側做得完全正確（見下節） |
| L2 | `public/sightings.json`（924 筆） | CLAUDE.md 寫明 8/29 匯進 Upstash 後就該刪，今天 9/3 還在。無私有欄位，不算外洩；但它現在是「一份離線可抓的完整語料快照」，也讓 S1 的攻擊者連 API 都不用打就拿到全部（url, term_key）配對 |
| L3 | `public/probe.html:47,64` | `navigator.userAgent` 與 `e.message` 直接進 `innerHTML`。只有 self-XSS，攻擊者無法從外部控制這兩個值 |
| L4 | `public/nomos.js:323-324` | `quoteHtml` / `metaLine` 被 export 但沒有任何頁面呼叫（我 grep 過）。死碼，但它帶著跟 S4 一樣的 `href` sink，將來誰接來用就直接繼承漏洞 |
| L5 | `api/_locks.js` | Vercel 慣例是底線開頭的檔案不會變成路由，所以 `/api/_locks` 應該打不到；就算打得到，模組沒有 default export，結果是 500 而非資訊外洩。**推測，未驗證** |
| L6 | `context/` 全目錄 | 零配置下 Vercel 只出 `public/`，所以這些規劃文件**不會**被站上服務。但 `git remote` 指向 `github.com/misterkidult/ai-nomos` —— 若 repo 是公開的，`context/intent.md`、`plan-*.md`、`devpost-submission.md`、`matt-review-*.md` 全部公開可讀。**我沒能確認 repo 是公開還是私有**（`gh repo view` 被權限擋下），請自己確認一次 |

---

## 已經做對的（不用擔心）

這幾條我實際讀過並確認，不是照 checklist 打勾：

1. **輸出用 allowlist，不是 blocklist** —— `api/sightings.js:12-21` 的 `PUBLIC` 陣列＋逐欄複製。註解自己說明了為什麼不能反過來做（將來新增欄位會自動外洩）。這是整份 code 裡最漂亮的一個決定。
2. **`sentence` / `context` 真的不落地** —— `api/findings.js:163-176` 組 row 時根本沒有這兩個欄位，`scripts/test-findings.mjs:75-77` 有回歸測試盯著。
3. **`source.hash` 與 `submitter` 不外流** —— `api/sightings.js:19` 明確重組 `source` 物件、丟掉 `hash`；`scripts/test-findings.mjs:96-97`、`scripts/verify.mjs:219-221` 兩處都有測試。
4. **沒有 SSRF。** 這值得特別講：產品的核心動作就是「給我一個 URL」，但**伺服器從不 fetch 那個 URL** —— 文章是 agent 在使用者瀏覽器裡讀的（契約 §5「the page never uploads it」）。`api/*` 唯一的出站 fetch 是 `${URL_}/pipeline`，`URL_` 來自環境變數。這個架構把整個 SSRF 面消掉了。
5. **沒有指令注入。** `api/` 底下沒有任何 `child_process`／`exec`／`spawn`（我 grep 過）。`scripts/verify.mjs:83` 用的是 `execFileSync` 而非 shell，參數是固定陣列。
6. **沒有 Redis 指令注入。** `api/findings.js:31` 與 `api/sightings.js:27` 都走 `commands.map(c => c.map(String))` 的 JSON pipeline，不是拼接 RESP 字串。所有 key 都有固定前綴（`sighting:` / `by_term:` / `doc:` / `rate:`），使用者字串只能落在前綴後面 —— 打不到 `recent`、`docs`、`docterm`、`contributors` 這些管理 key，也做不出跨型別存取。
7. **憑證乾淨。** 全 repo 沒有硬編碼的 token 或 Upstash URL（`test-findings.mjs:11-12`、`verify.mjs:182-183` 用的是 `stub` 假值）。`api/sightings.js:5` 讀取路徑優先用 `KV_REST_API_READ_ONLY_TOKEN`，寫入路徑才用完整 token —— 這個分權是對的。`.env` 確實不在版控（`.gitignore:3`）。
8. **零相依。** `package-lock.json` 的 `packages` 是空物件，`package.json` 沒有 `dependencies` 也沒有 `devDependencies`。**供應鏈漏洞面等於零** —— 不需要跑 `npm audit`，沒有東西可以 audit。以參賽作品來說這是很強的姿態。
9. **`submitter_name` 有認真消毒** —— `api/findings.js:103-106` 去掉 `\p{Cc}\p{Cf}`（控制字元與零寬字元）、壓縮空白、按 code point 截 24。註解也講清楚「Nothing is ever derived from it」。這是全檔唯一一個**有做輸入清理**的欄位，其他欄位如果比照辦理，S2 就不存在了。
10. **前端所有文字節點都過 `esc()`。** 我逐一看過 `index.html`、`term.html`、`terms.html`、`agent-view.html`、`nomos.js` 的每一處 `innerHTML`：文字全部 escape、URL 路徑走 `encodeURIComponent`（`index.html:81`、`term.html:192`）、數值插值都是真的數值。`esc()` 沒有轉單引號，但我確認過**全站沒有任何單引號屬性**，所以不構成問題。唯一漏的就是 S4 的 scheme。
11. **測試涵蓋度比預期好。** `scripts/test-findings.mjs` 有假 Upstash、跑真 handler，測到限額（117、120-121 行）、鎖判定、私有欄位、冪等覆寫、legacy id 重用。缺的是**惡意輸入**（超大欄位、非字串型別、`javascript:` url、偽造 XFF）—— 但既有的東西是紮實的。

---

## 附錄：成本與速率試算

以「單一 IP、單一機器、十分鐘」為單位，全部基於 code 讀出來的倍率，**未實測**：

| 攻擊 | 每請求的 Upstash 指令 | 十分鐘可達 | 後果 |
|---|---|---|---|
| S3 讀取放大（`?days=99999&z=rand`） | ≈ 1,300 | ~3,000 請求 → **~400 萬指令** | 額度耗盡／帳單；站台形同下線 |
| S2 灌肥資料（50 筆 × 4 MB） | ≈ 305 | 受限速綁在 ~20 請求 | 首頁回應永久變成數 MB |
| S1 覆寫全語料 | ≈ 305 | ~74 請求即可覆蓋 374 篇 | 全部引句可被替換，不可還原 |
| 純打 429（超過限速後） | 2 | 不限速率 | 每個被拒的請求仍然花你 2 個指令 |

最後一列值得單獨看：**限速本身不省錢**。`api/findings.js:110-111` 的 `INCR` 發生在任何驗證之前，所以被擋下的請求一樣消耗 Upstash 指令與 Vercel 呼叫次數。要真的省，得在到 Redis 之前先擋（Vercel 邊緣層或 WAF）。

---

## 我這種檢查方式看不到什麼

這一節是報告的一部分，不是免責聲明。以下每一項都需要實際打線上端點或看 Upstash 才知道，**我一項都沒做**：

1. **Vercel 對 `x-forwarded-for` 是覆寫還是附加。** 直接決定 M1 是「限速只剩一半」還是「限速完全不存在」，也決定 S1／S2 的實際攻擊速率上限。一個 `curl -H 'x-forwarded-for: ...'` 就知道。
2. **`javascript:` URL 在現行 Chrome／Safari 的 `<a target="_blank" rel="noopener">` 裡到底執不執行。** 決定 S4 是 stored XSS 還是「只是惡意連結」。本機一頁靜態 HTML 就能驗，不用碰線上。
3. **實際的回應標頭。** 我只讀得到 `vercel.json` 和 handler 裡 `setHeader` 的部分。Vercel 平台自己會不會補上 `X-Content-Type-Options`、`Strict-Transport-Security`，我不知道。`curl -I` 一次就有答案。
4. **`/api/_locks`、`/api/findings.js`、`public/` 以外的路徑是否可達。** 底線開頭不成為路由是 Vercel 慣例，我沒有驗證過；`context/` 不被服務是我從「零配置＋有 public/ 目錄」推的，也沒驗過。三個 curl。
5. **Upstash 裡實際躺著什麼。** 有多少筆、`recent` 多大、`docterm` 有沒有真的 backfill 過、有沒有超大 value、有沒有已經被塞過的垃圾、`contributors` 現在幾個。S1／S2 的「已經被打了嗎」只有這裡看得出來。也包含：**用的是哪個 Upstash 方案** —— 我的成本試算全部只給倍率，沒給金額，就是因為這個。
6. **Vercel 專案設定。** 環境變數實際設了哪些、`KV_REST_API_READ_ONLY_TOKEN` 到底有沒有設（沒設的話 `api/sightings.js:5` 會退回用完整寫入 token，讀取端點就握著寫入權限 —— 這條我無法從 repo 判斷，但值得你確認）、有沒有開 Deployment Protection、Function 的 region 與逾時、有沒有掛任何 WAF 或 rate limit。
7. **GitHub repo 是公開還是私有。** `gh repo view` 被權限擋下（見 L6）。若是公開的，`context/` 裡十八份規劃與審查文件全部可讀。
8. **執行期行為。** 併發下 `INCR` + `EXPIRE` 兩段式的競態（`api/findings.js:38-42`：兩個請求同時把計數器推到 1 時，`EXPIRE` 可能被跳過而讓 key 永不過期）我只能從 code 推斷是可能的，沒有實測過；同理，超大 body 在 Vercel 是被平台擋在 handler 前、還是進到 `readBody`（`api/findings.js:44-49`）才炸，我也不知道。
9. **靜態分析天生看不到的**：實際的 TLS 設定、DNS、網域接管風險、Vercel 帳號本身的權限與 2FA、以及任何不在這個 worktree 裡的東西（`.env`、`collect/`、`context/mock/` 都被 `.gitignore` 擋著，這是刻意的，我尊重）。

---

## 未決事項（留給委託方）

1. S1 的修法有三個方向（限定同 submitter 才能覆寫／id 綁 submitter／改成 append），**會影響契約 §5「re-feeding overwrites」那句話的語意**，不是我能自己選的。要不要開一輪討論？
2. S4 的修法（限定 `http(s):`）順帶就把 M3 修掉，但會改變 `api/_locks.js` 的判定行為 —— 依 CLAUDE.md，改鎖要三處同步（契約 §3、`check-findings.py`、`_locks.js`）。這算不算「改契約」，請你定。
3. L1（`public/fixtures/out_A.json` 含 `sentence`）：刪掉、改造、還是在契約裡明講 fixture 例外？三種都行，我不替你決定。


---

# 附錄二：S4 實測結果（委託方補，2026-09-03）

**這一節不是 Matt 寫的**，是委託方在收到報告後照他給的驗證方式實際跑出來的，補在這裡讓報告自成一份完整紀錄。

**方法**：把 `public/nomos.js:3` 的 `esc()` 與 `public/index.html:83-85` 的 `src()` 逐字複製成一頁本機 HTML，用真瀏覽器（Chrome 152，Playwright 驅動）點擊。測完即刪，未改動任何專案程式碼。

## 結果：現行程式碼不會執行，但防線是意外得來的

| 測試 | 結果 |
|---|---|
| `javascript:` + `target="_blank"`（**現行程式碼原樣**） | ❌ 未執行，只開了一個空白分頁 |
| 同一 payload，**只拿掉 `target="_blank"`** | 🔴 **執行了** |

擋住它的是 `target="_blank"`，**不是 `esc()`**。

這件事的意義不在「目前安全」，而在**這道防線是為了 UX 加的、不是為了資安**。`src()` 帶 `target="_blank"` 的理由是「外部連結開新分頁」；哪天有人覺得詞條頁的來源連結不該跳出去而拿掉它，stored XSS 立刻成立，而動手的人不會知道自己拆掉了唯一的防線。**這正是 Matt 在 L4 對 `quoteHtml` 的擔憂的一般化版本。**

## 追加發現：四種規避寫法全部穿過 `esc()`

瀏覽器把以下四種全部正規化成 `protocol: "javascript:"`：

```
javascript:...          → javascript:
JaVaScRiPt:...          → javascript:     ← 大小寫混合
"  javascript:..."      → javascript:     ← 前置空白
"java\tscript:..."      → javascript:     ← 內嵌 tab
```

`data:text/html,...` 同樣原樣進入 `href`（Chrome 另行擋下頂層導覽）。

**對修法的直接影響**：不能用字串比對。`url.startsWith('javascript:')` 或 `/^javascript:/i` 這類寫法上面四種變形全漏。正確做法是 allowlist —— 用 `new URL(u).protocol` 解析後只准 `http:` 與 `https:`，解析失敗即拒。這與 Matt 在 M3 的建議（要求 `url` 通得過 `new URL()`）是同一個修法，一次修掉 S4 與 M3。

## 對分級的修正建議

**S4 由「嚴重」降為「中等」**，但附帶兩點：

1. **確定的危害不變**：任意惡意連結可掛上首頁動態牆，外觀與正常來源無異；搭配 S1 還能替換既有紀錄的連結。這條不需要任何瀏覽器條件成立，Matt 原本的判斷正確
2. **XSS 目前不成立，但防線隨時可能被無意拆除** —— 所以修法優先度不因降級而下降

`public/nomos.js:323` 的 `quoteHtml`（Matt 列 L4）經確認同樣無 scheme 驗證。它目前無人呼叫，但將來誰接來用時若未帶 `target="_blank"`，即為 stored XSS。

## 這次實測仍然看不到什麼

- **只測了 Chrome 152**。Safari／Firefox 未測，行為可能不同（尤其 Safari 對 `javascript:` 的處理歷來與 Chrome 有出入）
- **只測了 `src()` 這一條 sink**。`term.html:29-31` 與 `index.html:270-271` 是同構程式碼，未逐一實測
- **沒有測線上版本**，測的是本機複製品；若線上有任何 CSP 或平台層防護，本測試看不到
