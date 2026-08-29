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

Nothing is seeded. All 133 existing entries entered through the same door.

### Why WebMCP is the right fit

Three reasons this is a WebMCP problem and not a chatbot problem or a scraper problem:

1. **The reading has to happen where the reader is.** The page cannot fetch the article — paywalls, cookies, bot-blocking, and the plain fact that a server fetching your reading list is a privacy problem. The agent already has the page open in the user's own browser session. `feedDocument` hands it a URL and a rule set; the agent reads with the user's own access and returns structured findings. No content ever crosses our server.

2. **The judgment has to be an agent's, and it has to be checkable.** Deciding whether a term was *explained*, *mentioned in passing*, or *assumed* is a reading-comprehension task. But an ungrounded model will happily invent a definition. So the contract forbids it: `definition_quote` must be a verbatim substring of the surrounding context, and the server rejects the finding if it is not. The agent judges; the quote proves it.

3. **The agent is not a courier.** `submitFindings` explicitly instructs the agent to disagree with the user: find each requested term and rule on it (a requested term that is not an AI term still gets a finding, with `domain: not` — that is the agent's verdict and the user sees it), and add terms the user missed. In our test runs the agent added roughly as many terms as the user asked for.

### What a person and an agent can do here that neither can do alone

The person brings judgment about *which article matters* and *which words bothered them*. They cannot read 374 articles to see how a word is drifting.

The agent reads the article closely and applies the same rules every time. It has no idea which article is worth reading, and left alone it will confidently define a term from memory instead of from the page.

The dictionary holds the accumulation neither of them can: 924 sightings across 374 documents, so that when you bring article #375 the page can put its definition of "RAG" next to the twelve other ways twelve other authors used it — and mark the ones that contradict.

Two read-only tools (`lookupTerm`, `trending`) close the loop the other way: a second agent, on any other site, can ask this dictionary what a term currently looks like in the wild. It gets quotes and sources, never a ruling. The dictionary never says which definition is right.

### Fallback: it still works without an agent

WebMCP is not everywhere yet. With no `modelContext` present, the page degrades to local matching: paste text, see which of the 133 known terms are in it. The loop is smaller but visible, and the site is not a dead page for the 99% of visitors without a flagged browser.

### Implementation

- **Four tools**, dual-registered on `document.modelContext` (ChatGPT desktop, Chrome 152+) and `navigator.modelContext` (older spec drafts):
  - `feedDocument` (read-only) → returns the URL, the user's requested terms, a thin lexicon index, the extraction rules verbatim, and the JSON Schema for a finding
  - `submitFindings` (`readOnlyHint: false`) → the write path
  - `lookupTerm`, `trending` (read-only) → the public read side
- **One data contract** (`context/contract.md`, English, versioned) is the single source of truth for page ↔ agent and page ↔ server. Changes go through a `contract:` commit, never through conversation.
- **Three server-side locks** every finding must pass — the sentence must contain the term, the definition quote must be a verbatim substring of the context, and a borderline term with no quote is dropped as noise. `scripts/check-findings.py` is the reference implementation; `api/*` must produce identical verdicts on the same fixtures.
- **Writes are gated on the server, not the page.** Our probe found no working page-side confirmation API: `requestUserInteraction` was removed from the WebMCP spec in PR #205 (June 2026, "not fully specified, no implementations"), and ChatGPT's shim returns "requestUserInteraction is not supported by the Codex WebMCP shim". So the page does not pretend to gate; it marks `submitFindings` as a write and lets the client's own confirmation policy apply, while the real gate — locks, stoplist, rate limiting, PII regex — lives server-side.
- **Anti-spam is described as a limit, not a security feature**: an anonymous browser-held id and a salted document hash deduplicate honest use. Neither stops a determined actor, and we do not claim they do.
- Static pages, no build step, deployed prebuilt to Vercel.

### What we verified, and what we did not

Verified on 2026-08-27: `registerTool` works, tools execute, and the agent channel is live in ChatGPT desktop (Work mode, GPT-5.6 Terra, built-in browser). Chrome 152 exposes `document.modelContext` natively with no flag.

Not available anywhere we tested: page-side write confirmation. We report this as a spec gap rather than designing around a feature that does not exist.

---

## 影片腳本（<3 分鐘，9/2 錄）

| 秒 | 畫面 | 旁白重點 |
|---|---|---|
| 0–25 | 一篇滿是術語的 AI 文章 | 「這篇文章有 12 個 AI 術語。哪幾個作者有解釋？哪幾個他假設你懂？哪幾個只是拿來賣東西？」 |
| 25–70 | `/read` 貼連結 → agent 呼叫 feedDocument → 讀完 submitFindings | 「頁面沒有上傳這篇文章。是 agent 用你自己的瀏覽器去讀的。」 |
| 70–110 | 報告出來：假設你懂的 5 個詞 + 字典白話解釋 | 「它假設你懂的，我幫你查好了。」 |
| 110–140 | 同一個詞的並列定義，標出說法不同的那筆 | 「這篇說 MCP 是這個。另外 12 篇說的是別的。字典不判誰對，只把證據擺出來。」 |
| 140–165 | 關掉 agent，退化模式 | 「沒有 agent 也能用，只是迴路小一點。」 |
| 165–180 | 首頁 | 「想改字典，拿一篇文章來。」 |
