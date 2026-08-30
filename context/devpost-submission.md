# Devpost 提交素材（2026-08-28 起草）

> 填 https://webmcp.devpost.com/ 的 submission 表單用。截止前隨時可改（規則：Once the Submission Period has ended, you may not make any changes）。
> **URL 與 repo 是連結不是快照** —— 報名後繼續改網站與程式碼，評審看到的就是最新版。真正要在 9/2 前更新的只有影片與這份文案。

## 表單欄位

| 欄位 | 內容 |
|---|---|
| Project name | ai-nomos |
| Elevator pitch (200 chars) | A dictionary of AI jargon that grows from evidence, not opinion. Bring an article; the agent reads it and reports how each term was actually used. |
| Live URL | https://ai-nomos.vercel.app |
| Repository | https://github.com/misterkidult/ai-nomos |
| License | MIT (LICENSE in repo root) |
| Video | YouTube, public, <3 min, with audio |
| Built with | webmcp, vanilla-js, vercel, upstash |

---

## About the project

### The problem

Read any article about AI and you hit ten words nobody defined. Some of them the author explains. Some they assume you already know. Some are there to sell you something. You cannot tell which is which, and looking each one up gives you a textbook definition that has nothing to do with how the word was just used at you.

Existing AI glossaries are written top-down: an editor decides what a word means and the entry sits there. But these words are not settled. "MCP" means one thing in Anthropic's spec and something else in a vendor's brochure. A dictionary that picks a winner is lying about the state of the language.

### What ai-nomos does

**nomos** (νόμος) is Plato's word for meaning that is agreed, not given. This dictionary sits on that side: AI words mean what people use them to mean, so the dictionary is built out of sightings — one record per term per document, each with the sentence it came from and a link back.

You give the page an article link and the terms you want pulled out. The agent fetches and reads the article itself — the page never uploads it — judges each term against a fixed rule set, adds terms you did not ask for, and reports back. The dictionary shows you what it found next to what every other article said about the same words.

There is one write path and no editorial back door. Every sighting — including the 1,300 the dictionary opened with — is one term as it appeared in one document, carrying the quote and the link that let you check it. The agent proposes, a person confirms, and only then is anything stored. No entry can be edited into existence by hand.

### Why WebMCP is the right fit

Three reasons this is a WebMCP problem and not a chatbot problem or a scraper problem:

1. **The reading has to happen where the reader is.** The page cannot fetch the article — paywalls, cookies, bot-blocking, and the plain fact that a server fetching your reading list is a privacy problem. The agent already has the page open in the user's own browser session. `feedDocument` hands it a URL and a rule set; the agent reads with the user's own access and returns structured findings. No content ever crosses our server.

2. **The judgment has to be an agent's, and it has to be checkable.** Deciding whether a term was *explained*, *mentioned in passing*, or *assumed* is a reading-comprehension task. But an ungrounded model will happily invent a definition. So the contract forbids it: `definition_quote` must be a verbatim substring of the surrounding context, and the server rejects the finding if it is not. The agent judges; the quote proves it.

3. **The agent is not a courier.** `submitFindings` explicitly instructs the agent to disagree with the user: find each requested term and rule on it (a requested term that is not an AI term still gets a finding, with `domain: not` — that is the agent's verdict and the user sees it), and add terms the user missed. In our test runs the agent added roughly as many terms as the user asked for.

### What a person and an agent can do here that neither can do alone

The person brings judgment about *which article matters* and *which words bothered them*. They cannot read 341 articles to see how a word is drifting.

The agent reads the article closely and applies the same rules every time. It has no idea which article is worth reading, and left alone it will confidently define a term from memory instead of from the page.

The dictionary holds the accumulation neither of them can: 1,322 sightings across 341 documents, so that when you bring article #342 the page can put its definition of "RAG" next to the other ways other authors used it — and split them by the language the source was written in (1,217 Chinese, 98 English, 7 Japanese), because a word is not used the same way in two language communities.

Two read-only tools (`lookupTerm`, `trending`) close the loop the other way: a second agent, on any other site, can ask this dictionary what a term currently looks like in the wild. It gets quotes and sources, never a ruling. The dictionary never says which definition is right.

### Fallback: it still works without an agent

WebMCP is not everywhere yet. With no `modelContext` present, the page degrades to local matching: paste text, see which of the 133 known terms are in it. The loop is smaller but visible, and the site is not a dead page for the 99% of visitors without a flagged browser.

### Implementation

- **Five tools**, dual-registered on `document.modelContext` (ChatGPT desktop, Chrome 152+) and `navigator.modelContext` (older spec drafts). The page has no form: the agent brings the article.
  - `feedDocument({url, requested_terms?})` (read-only) → takes the link the user gave their agent, returns the extraction rules verbatim, a thin lexicon index, and the JSON Schema for a finding
  - `reportDocument` (read-only) → called after the agent opens the article and before it extracts anything: title, byline, date, length, one-sentence gist. **Nothing is stored.** It exists because one tool call that takes a minute leaves the screen blank for a minute — splitting the task into stages is what makes progress real rather than a fake spinner. The title doubles as proof the agent actually reached the page
  - `submitFindings` (`readOnlyHint: false`) → hands the findings to the page and answers `pending_review`; it does not write
  - `lookupTerm`, `trending` (read-only) → the public read side
- **One data contract** (`context/contract.md`, English, versioned) is the single source of truth for page ↔ agent and page ↔ server. Changes go through a `contract:` commit, never through conversation.
- **Three server-side locks** every finding must pass — the sentence must contain the term, the definition quote must be a verbatim substring of the context, and a borderline term with no quote is dropped as noise. `scripts/check-findings.py` is the reference implementation; `api/*` must produce identical verdicts on the same fixtures.
- **The spec has no page-side confirmation, so the page stops being the thing that writes.** Our probe found no working confirmation API: `requestUserInteraction` was removed from the WebMCP spec in PR #205 (June 2026, "not fully specified, no implementations"), and ChatGPT's shim returns "requestUserInteraction is not supported by the Codex WebMCP shim". Rather than pretend to gate, we moved the write out of the tool call entirely: `submitFindings` returns `pending_review` and holds the findings on the page; the person confirms and *the page* posts to `/api/findings`. The agent proposes, the person decides, and no tool call can write on its own. The server still applies the locks, stoplist, rate limits and PII regex — a confirmed batch is checked again, because a page is not a trustworthy caller either.
- **Anti-spam is described as a limit, not a security feature**: an anonymous browser-held id and a salted document hash deduplicate honest use. Neither stops a determined actor, and we do not claim they do.
- Static pages, no build step, deployed prebuilt to Vercel.

### What we verified, and what we did not

Verified on 2026-08-27: `registerTool` works, tools execute, and the agent channel is live in ChatGPT desktop (Work mode, GPT-5.6 Terra, built-in browser). Chrome 152 exposes `document.modelContext` natively with no flag.

Not available anywhere we tested: page-side write confirmation (`requestUserInteraction`). We report it as a spec gap and designed around its absence rather than around a feature that does not exist — the confirmation lives in the page's own UI, where the spec cannot take it away.

---

## 影片腳本（<3 分鐘，9/2 錄）

| 秒 | 畫面 | 旁白重點 |
|---|---|---|
| 0–25 | 一篇滿是術語的 AI 文章 | 「這篇文章有 12 個 AI 術語。哪幾個作者有解釋？哪幾個他假設你懂？哪幾個只是拿來賣東西？」 |
| 25–70 | 首頁：對 agent 說一句話 → 說明整組讓位、圓點開始轉 → 「你的 AI 打開了這篇」＋標題浮出 | 「頁面沒有上傳這篇文章。是 agent 用你自己的瀏覽器去讀的 —— 標題出現就是它真的到過那一頁。」 |
| 70–110 | 報告出來：假設你懂的 5 個詞 + 字典白話解釋 | 「它假設你懂的，我幫你查好了。」 |
| 110–140 | 同一個詞的並列定義，標出說法不同的那筆 | 「這篇說 MCP 是這個。另外 12 篇說的是別的。字典不判誰對，只把證據擺出來。」 |
| 140–165 | 按下「收進字典」，數字從 1,322 跳動；切到日文語料側 | 「agent 提議，人決定 —— 按下去之前什麼都沒寫。同一個詞，中文圈跟英文圈講的不是同一件事。」 |
| 165–180 | 首頁 | 「想改字典，拿一篇文章來。」 |
