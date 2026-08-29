# 迴圈規格：把程式寫完（2026-08-29）

資料層的迴圈在 `handoff-collect-2026-08-29.md`，這份只管程式本身的品質與功能。

迴圈的品質上限＝ verify 那一步的品質上限。上一輪 1526 筆 findings「三條鎖全過、逐字忠實度只有 3/14 批驗過」，壞的不是 execute 是 verify。所以這輪先蓋 verify，才有資格談自動跑。

## verify 是什麼

`npm run verify` —— 一個指令、一個 exit code、零依賴。`scripts/verify.mjs`，四個 suite：

| suite | 釘住的東西 |
|---|---|
| `contract` | 頁面必須逐字說契約說的話：`RULES` 與 §2 逐字相同、`STOPLIST` 三處一致（`contract.md`／`read.html`／`check-findings.py`）、`FINDING_SCHEMA` 的 required 與三個 enum 對得上 §1、`contract_version` 對得上 §7、§3 的八個 client 碼兩邊都實作 |
| `locks` | 頁面的 `check()` 與 `check-findings.py` 對 `fixtures/*.json` **逐筆一致**（CLAUDE.md 的硬規則），且兩者都符合 `fixtures/locks-regression.json` 的期望值 |
| `api:sightings` | stub 掉 Upstash 直接跑 handler：§4 的私有欄位不得出現、★ 欄位不得消失、§5 的三種查詢各自打對 Redis 指令、上游失敗回 500 |
| `static` | `vercel.json` 的 rewrite 目標都存在、`lexicon.json` 形狀與 slug 唯一、`public/fixtures/` 與根目錄 `fixtures/` 一致 |

**關鍵設計**：頁面那份 `check()` 是從 `public/read.html` **抽出來執行**的，不是複製一份。複製會無聲飄移，而飄移正是要抓的東西。

## 這輪抓到並修掉的

1. `SENTENCE_TOO_LONG` 兩邊判定不一致 —— JS 數 UTF-16 units（`s.length`）、Python 數 code points（`len()`）。含星號平面字元的句子會一邊過一邊擋。已修 `read.html`。
2. `GET /api/sightings` 洩漏 `sentence`／`context`／`submitter`／`source_hash` —— 原本用 denylist 只剝 `source_hash`，等於未來寫入端新增的任何欄位都會直接上站，而 §4 說 `sentence`／`context` **never public**。改成 §4 ★ 的 allowlist。已修 `api/sightings.js`。
3. `check-findings.py` 的 usage 指向不存在的 `fixtures/seed-133.json`，而 §6 明說沒有 seed。已修。
4. `fixtures/*.json` 全是 2026-08-26 的舊格式（`term` 而非 `term_raw`，沒有 `context`／`requested`），跑下去 30 筆全 `MISSING_FIELD` —— 八個鎖有七個從沒被任何測試碰過，「兩邊一致」是在全拒絕的輸入上成立的空話。補 `fixtures/locks-regression.json`（18 case，每個碼至少一個，含多碼併發與邊界）。

## 迴圈怎麼跑

discover → plan → execute → verify → 重複直到退出條件成立。

一輪只做一個 W。execute 完**必跑** `npm run verify`，紅的不准往下一項。退出條件寫成 verify 裡的斷言，不是寫成描述。

## 待辦

**W1 · 寫入路徑不存在**
`submitFindings` 永遠回 `status:'mock'`，`api/submit` 不存在。README 原則 1 說「唯一的編輯動作是提交一筆目擊」——那個動作現在什麼都沒寫進去。這是功能面最大的洞。
退出條件：verify 新增 `api:submit` suite —— 判定與 `check-findings.py` 對 `locks-regression` 逐筆一致；accepted 寫入 Upstash 並建 `recent`／`by_term:` 索引；rejected 回 §5 的 `{index, term_raw, reasons}` 形狀；回傳 `status` 為 `stored` 或 `pending_review`。
⚠ 擋住：契約寫明 `api/*` ＋ storage 的 owner 是 Matt。要 Kidult 裁示才動。

**W2 · `PII_DETECTED` 沒有實作**
§3 標 server-only，而 server 不存在，所以這個碼目前不存在於任何程式裡。
退出條件：`locks-regression` 補 PII case（email／電話／統編／金額），有 `source.url` 者豁免；api 端判定與期望值一致。
相依 W1。

**W3 · `lookupTerm`／`trending` 只看本頁**
`read.html` 的 `SEED=[]` 從沒被填過。另一個 agent 呼叫 `lookupTerm`，拿到的只有這一次貼文的結果，不是字典累積的目擊 —— 而 §5 說這是「the read side of the loop」。
退出條件：verify 新增 `page:lookup` suite —— 餵一份假的 `/api/sightings` 回應，`lookupTerm` 的 `sightings`／`sources`／`first_seen`／`conflicting` 必須把它算進去；`doc_count < 3` 時信號區整塊不顯示（plan v2 §2）。
owner 是頁面。**不擋，可以現在做。**

**W4 · replay 入庫**
交接文件第 3 步，必須排在忠實度修復之後。不可逆，**不做成自主迴圈**。

## 開放問題（契約 owner 裁，agent 不要自己決定）

- §4 沒給 `id` 星號，但 `nomos.js` 用 `s.id` 當 source 去重的 fallback。要嘛 §4 補星號，要嘛頁面改掉。目前 `api/sightings.js` 的 allowlist 暫時放行 `id`，並在該處註明。
- §6 說寫入路徑只有 agent 經 `/read` 的 `submitFindings`，但收資料兩輪都是 subagent 直接產出。偏離已發生兩輪，未裁示。

## 護欄

- 不改 `context/contract.md`，除非 commit 訊息以 `contract:` 開頭
- **不准放寬 `fixtures/locks-regression.json` 的期望值來讓 verify 變綠** —— 期望值是意圖，程式錯就改程式
- 不重新連接 Vercel 的 GitHub、不手改 `public/lexicon.json`、不回寫 `ai-dictionary` 的 `terms/`、沒有 seed
