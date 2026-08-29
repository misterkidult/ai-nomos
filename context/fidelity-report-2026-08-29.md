# 原文比對層結果（2026-08-29）

交接文件的第 1 步。`collect/docs/*.json` 的 1526 筆 findings，逐筆比對「這段文字是否真的出現在來源頁面上」。

## 為什麼需要這一層

契約 §3 的 `QUOTE_NOT_IN_CONTEXT` 是**自我循環**的：`definition_quote ⊆ context`，但 `context` 也是 agent 自己填的。
把 context 寫成配合 quote 的樣子就能過關 —— 驗證器看不到「這段文字是否真的在文章裡」。

## 做法

1. `scripts/collect-fetch.py` 把 374 篇來源頁抓進 `collect/pages/<job_id>.html`（快取，可重跑）
2. `scripts/collect-fidelity.py` 剝標籤、去空白、統一全半形與彎直引號後，做子字串比對

兩段判定，因為「找不到」有兩種完全不同的成因：

- **strict** — 正規化後直接是頁面的子字串
- **lenient** — 同上，但忽略**句首尾**標點。從段落裡抽一句話，原文的逗號會變成句號、開頭的引號會掉，這不是內容改動

句中標點仍須吻合 —— 只放寬邊界。

## 結果

| | 筆數 | 佔可驗證 |
|---|---:|---:|
| **忠實** | **1314** | **87.3%** |
| ├ 逐字吻合 | 1091 | 72.5% |
| └ 僅邊界標點不同 | 223 | 14.8% |
| **不忠實（DRIFT）** | **191** | **12.7%** |
| 無法核對 | 21 | — |
| 合計 | 1526 | |

**374 篇中 286 篇（76%）完全乾淨**，191 筆 drift 集中在 88 篇。這個集中度與交接文件說的「批 1、2、6 自查修過、其餘 11 批沒有」吻合 —— 反過來支持比對層本身可信。

## 191 筆 drift 的性質

把每個句子切成片段，量「多少比例的片段真的在頁上」。中文用標點切、英文另用空白切，取較寬鬆者，免得任一語言被對方的切法懲罰。

| 分級 | 筆數 | 意思 | 可救嗎 |
|---|---:|---|---|
| `paraphrased` | 76 | 部分片段在頁上 | 多半可救，要逐筆看 |
| `reassembled` | 62 | 片段全在頁上，只有順序／連接被改 | **可救** —— 重抓原句即可 |
| `summarised` | 27 | 沒有任何片段在頁上 | **不可救**，要重讀該篇 |
| `rewritten` | 26 | 不到一半片段在頁上 | 多半不可救 |

### `summarised` 這 27 筆是什麼

抽驗過：**不是憑空捏造事實，是 agent 在摘要文章**。句型高度一致 ——「文章建議…」「他認為…」「文章警示…」「防偽升級：…」。

實例（ETtoday Google I/O 2026）：

```
頁面原文： Google宣布將SynthID數位浮水印技術與C2PA標準整合進Google搜尋與Chrome瀏覽器中
agent 寫的： 防偽升級：整合SynthID數位浮水印與C2PA標準，協助辨識AI生成圖片。
```

內容正確，句子是自己寫的。直接違反契約 §2 規則 1「Copy, don't explain」。

這正是原本那三條鎖抓不到的東西 —— agent 把 `context` 也寫成自己的摘要，兩者當然互相吻合。

### drift 最集中的站台

| drift／該站總數 | 站台 |
|---:|---|
| 13/25 | `hackmd.io` |
| 13/89 | `www.bnext.com.tw` |
| 9/10 | `abmedia.io` |
| 8/9 | `ai.ettoday.net` |
| 7/162 | `www.ithome.com.tw` |
| 7/29 | `www.gvm.com.tw` |
| 6/42 | `aiterms.tw` |
| 5/5 | `jasonchuang.substack.com` |
| 5/5 | `www.alphalab.site` |
| 5/47 | `ithelp.ithome.com.tw` |
| 5/9 | `hanbz.dev` |
| 5/5 | `growthhackers.tw` |

### 整篇全 drift 的文件（16 篇）

這些頁面都抓到了真實內容（4000–16000 字，不是空殼），所以是真的整篇都沒照抄：

- 5 筆 · https://jasonchuang.substack.com/p/harness-engineering-ai
- 5 筆 · https://hackmd.io/@BASHCAT/SkQEW0F2bg
- 5 筆 · https://www.alphalab.site/claude-code-output-style-eval
- 5 筆 · https://abmedia.io/harness-engineering-ai-agent-framework-explained
- 5 筆 · https://ai.ettoday.net/news/3168743
- 5 筆 · https://growthhackers.tw/blog/ai-automation-boundary-human-in-loop/
- 4 筆 · https://www.managertoday.com.tw/articles/view/72531
- 4 筆 · https://www.gvm.com.tw/article/113853
- 4 筆 · https://www.evanlin.com/search-grounding/
- 4 筆 · https://hanbz.dev/articles/llm-cost-optimization-enterprise-2026/
- 4 筆 · https://www.ithome.com.tw/article/163107
- 4 筆 · https://www.eigent.ai/blog/graph-engineering-ai-agents
- 3 筆 · https://www.bnext.com.tw/article/89778/enterprise-gai-transformation-strategy-process
- 3 筆 · https://blog.creatorhome.tw/what-is-prompt-engineering-complete-guide/
- 3 筆 · https://www.anywhere.today/low-code-no-code-platform/
- 3 筆 · https://www.langchain.com/blog/3-years-of-graph-engineering-with-langgraph

## 無法核對（21 筆 / 5 篇）

頁面抓不到或只拿到擋頁（Medium 付費牆、ubestream 回 103 bytes）。**這不是 agent 的錯，但也代表這批無法證明忠實**：

- 5 筆 · `shell_or_block` · https://docs.oracle.com/zh-tw/solutions/learn-anomaly-detection/index.html
- 3 筆 · `shell_or_block` · https://puripr.pu.edu.tw/p/16-1132-60703.php?Lang=zh-tw
- 3 筆 · `shell_or_block` · https://www.bnc-technology.com/article-11.html
- 5 筆 · `shell_or_block` · https://ubestream.com/aiaas-%E6%99%BA%E6%85%A7%E8%AA%9E%E6%84%8F%E9%9B%B2%E7%AB%AF%E6%9C%8D%E5%8B%99%E5%85%A8%E6%94%BB%E7%95%A5%EF%BC%9A2026-%E4%BC%81%E6%A5%AD%E5%B0%8E%E5%85%A5%E8%AA%9E%E9%9F%B3-ai-%E7%9A%84%E8%BD%89/
- 5 筆 · `shell_or_block` · https://ubestream.com/aiaas-4/

## 對下一步的意思

交接文件說「進了 Upstash 才發現引文不忠實，線上就是一批指向真實網址、但引句對不上頁面的資料」。現在量出來了：**191 筆會是那種資料，佔 12.7%**。

入庫前的三個選項：

1. **只入庫 1314 筆忠實的** —— 最安全，損失 12.7%
2. **救回 `reassembled` 62 筆**（片段全在頁上，重抓原句即可），其餘剔除 → 1376 筆
3. **重跑 88 篇有問題的文件** —— 最完整，但要重新走一次收集

21 筆無法核對的另外決定：不能證明忠實，但也沒有證據說它不忠實。

## 這種驗法看不到什麼

- **比的是我抓的 HTML，不是讀者看到的渲染頁面。** 靠 JS 載入正文的站，我抓到的是空殼；我用 20000 bytes 當門檻擋掉明顯的空殼，但門檻以上的部分渲染頁仍可能誤判成 drift
- **頁面會變。** 今天比對通過，不代表讀者明天點進去還看得到那句話
- **只驗「這句話在頁上」，不驗「這句話講的是不是這個詞」。** `sentence` 與 `term_raw` 的對應關係仍由 `SENTENCE_LACKS_TERM` 那條鎖管，那條沒問題
- **`context` 完全沒驗。** 契約說它 never public，所以入庫後沒有讀者看得到；但如果之後拿它做任何計算，這批的可信度是未知的
- **enum 三欄（explained／intent／domain）沒驗。** 那是判斷不是引用，機器比對不了
