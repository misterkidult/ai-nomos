# ai-nomos data contract · v1 (2026-08-27)

Single source of truth for everything that crosses a boundary: page ↔ agent (WebMCP tools), page ↔ server (`api/*`). **Change it here, not in chat.** The contract is English only; the agent never translates. UI copy is a separate concern (`public/read.html` carries zh-Hant and en string tables).

Owners: page (`public/`) = Claude · `api/*` + storage = Matt · noise review = Addy · verdicts = Kidult.

---

## 1. Finding (agent → `submitFindings`)

One finding = one term as it was used in one document.

| field | type | required | rule |
|---|---|---|---|
| `term_raw` | string | ✔ | exactly as written in the document (case, spacing, parentheses kept) |
| `term_normalized` | string | ✔ (may be `""`) | the lexicon `term` this maps to; `""` when not a known term |
| `sentence` | string ≤ 120 chars | ✔ | the one sentence where `term_raw` appears, de-identified (§2 rule 5) |
| `context` | string | ✔ | `sentence` plus one sentence before and after, de-identified |
| `explained` | enum | ✔ | `has_definition` · `mentioned` · `assumed` |
| `intent` | enum | ✔ | `selling_point` · `technical` · `risk_or_limit` |
| `domain` | enum | ✔ | `core` · `edge` · `not` |
| `definition_quote` | string | ✔ (may be `""`) | verbatim from the document, only when the document itself defines the term; must be a substring of `context` |
| `requested` | boolean | ✔ | `true` when the user listed this term in `requested_terms`; `false` when the agent added it on its own |

Enum meanings:

- `explained` — `has_definition`: the document states what the term means · `mentioned`: named in passing, no explanation · `assumed`: used as if the reader already knows it
- `intent` — `selling_point`: used to sell or promote · `technical`: describes how something works · `risk_or_limit`: names a limitation, risk or caveat
- `domain` — `core`: an AI-field term · `edge`: borderline (tooling, adjacent infra) · `not`: not an AI term

JSON Schema (also returned by `feedDocument` as `finding_schema`):

```json
{"type":"object","additionalProperties":false,
 "required":["term_raw","term_normalized","sentence","context","explained","intent","domain","definition_quote","requested"],
 "properties":{
  "term_raw":{"type":"string"},
  "term_normalized":{"type":"string"},
  "sentence":{"type":"string","maxLength":120},
  "context":{"type":"string"},
  "explained":{"type":"string","enum":["has_definition","mentioned","assumed"]},
  "intent":{"type":"string","enum":["selling_point","technical","risk_or_limit"]},
  "domain":{"type":"string","enum":["core","edge","not"]},
  "definition_quote":{"type":"string"},
  "requested":{"type":"boolean"}}}
```

`source` in a Finding (see §4). Required when the article came from a URL; absent only for a pasted document.

```json
{"source":{"url":"https://…","title":"","published":""}}
```

## 2. Extraction rules (returned by `feedDocument` as `rules`, English, verbatim)

```
You are helping the user read one article. feedDocument gives you its url (fetch and read it yourself; the page never uploads it) and the terms the user wants pulled out (requested_terms). Do not take the user's list at face value: find each requested term in the article and judge it; add AI terms you notice that the user did not list; report everything with submitFindings, following these rules.
1. Copy, don't explain. term_raw = exactly as written. sentence = the one sentence it appears in (max 120 chars). context = that sentence plus one sentence before and after.
   definition_quote only when the document itself explains the term, and it must be a verbatim substring of context. If the document does not explain it, leave it "" — never fill from your own knowledge.
2. For each term answer three single-choice fields: explained (has_definition / mentioned / assumed), intent (selling_point / technical / risk_or_limit), domain (core / edge / not).
3. Do not report: model architecture names, training hyperparameters, algorithm names, statistics terms, or anything in the stoplist below.
4. The known-term list is in lexicon. Report known terms too (so the dictionary sees them again) and set term_normalized to the lexicon term; otherwise term_normalized = "".
5. De-identify sentence and context: replace company names, person names, amounts, phone numbers and emails with [company], [person], [amount], [phone], [email].
6. If a term appears several times, report it once — the occurrence that has a definition.
7. requested = true for terms from requested_terms, false for terms you added. A requested term that is not an AI term still gets a finding, with domain = not — that is your verdict, the page shows it to the user. A requested term you cannot find in the article goes to not_found, not to findings.
8. source: fill url from feedDocument, plus title and published (YYYY-MM-DD) if the article shows them.
Stoplist: <STOPLIST joined by ", ">
```

Stoplist (zh-Hant generic words; extend here, nowhere else):
`導入, 自架, 本地, 整合, 平台, 系統, 流程, 資料, 知識庫, 工具, 應用, 服務, 方案, 自動化, 數位轉型, 雲端, 上線, 部署, 優化`

## 3. Locks (server-side truth; the page mirrors them in a mock)

Applied per finding. Any hit → the finding is rejected with the code(s). Codes are stable identifiers; UI localizes them. Reference implementation: `scripts/check-findings.py` (Python, no deps) — `api/*` must produce identical verdicts on `fixtures/*.json`.

| code | check |
|---|---|
| `MISSING_FIELD` | a required field is absent |
| `ENUM_INVALID` | `explained` / `intent` / `domain` not in its enum |
| `SENTENCE_LACKS_TERM` | `sentence` does not contain `term_raw` (case-insensitive) |
| `SENTENCE_TOO_LONG` | `sentence` > 120 chars |
| `QUOTE_NOT_IN_CONTEXT` | `definition_quote` non-empty and not a substring of `context` (fallback: `sentence`) |
| `EDGE_WITHOUT_QUOTE` | `domain = edge` and `definition_quote = ""` — dropped as noise (plan v2 §2) |
| `STOPLISTED` | `term_raw` (trimmed) is in the stoplist |
| `NOT_AI_TERM` | `domain = not` and `requested = false` |
| `PII_DETECTED` | **server only**: regex hit for email / phone / 統編 / amount / URL in `sentence`, `context` or `definition_quote` |

`domain = not` **is stored** when `requested = true` (it is the agent's verdict on the user's term, and the user should see it); rejected with `NOT_AI_TERM` when `requested = false` (the agent has no reason to volunteer a non-AI term). Decided 2026-08-27.

## 4. Sighting record (server storage, Matt)

What the server keeps after a finding passes the locks. Public read surfaces only the fields marked ★.

| field | note |
|---|---|
| `id` | server-generated |
| ★ `term_key` | lexicon `slug` when `term_normalized` is known; otherwise lowercased, trimmed `term_raw` |
| ★ `term_raw`, ★ `term_normalized`, ★ `explained`, ★ `intent`, ★ `domain`, ★ `definition_quote` | from the finding |
| `sentence`, `context` | **never public** (plan v2 §2) |
| ★ `origin` | `agent` (via `submitFindings` — the only write path, including the existing 133 entries, which Kidult feeds through `/read` himself) · `editorial` (the 133 hand-written definitions; not in the signal system) |
| `source.hash` | salted hash of the document text, computed client-side; dedup key and the "N documents" counter |
| ★ `source.url`, ★ `source.title`, ★ `source.published` | **always public when present.** A sighting without a source is just a quote; the link is what lets a reader check it. The agent reads the article at `url` and copies it into `source.url`; only a pasted document (fallback mode) has no URL. |
| ★ `submitted_at` | server time, ISO 8601 |
| `submitter` | anonymous browser id (client-held; a limit, not a security feature) |
| `contract_version` | integer, see §7 |

Public via `lookupTerm`／`trending` (§5), never stored: `first_seen` = min `submitted_at` (when the dictionary first received it — never the article's `published`, which can be years older); `doc_count` = distinct `source.hash`; `quiet_days` = today − last `submitted_at` whose `definition_quote` is non-empty. Signal block hidden when `doc_count < 3`.

## 5. Tools

### `feedDocument` (read-only, no input)

The page gives the agent an article by **URL** and the user's list of terms to pull out. The agent fetches the article itself; the page never uploads it. `document` is filled only in fallback mode (user pasted text instead of a URL).

```json
{"contract_version":1,
 "url":"https://…",
 "requested_terms":["MCP","Multi-Agent"],
 "document":"",
 "known_hits":[{"term":"","zh":"","slug":"","matched":""}],
 "lexicon":[{"term":"","aka":[""],"zh":""}],
 "rules":"<§2>",
 "finding_schema":{"…§1"}}
```

### `submitFindings` (input `{findings: Finding[], not_found: string[]}`)

`not_found`: requested terms the agent could not locate in the article (verbatim as the user wrote them). Empty array when all were found.

```json
{"contract_version":1,
 "accepted":3,
 "not_found":["Multi-Agent"],
 "rejected":[{"index":1,"term_raw":"","reasons":["EDGE_WITHOUT_QUOTE"]}],
 "status":"mock"}
```

`status`: `mock` (page only, nothing written) · `stored` · `pending_review` (server batch check not yet run).

### `lookupTerm` (read-only; input `{term: string}`)

The read side of the loop: another agent asks the dictionary what a term currently looks like on the web. **Evidence only — the dictionary never rules which definition is right.** The page renders the same object as a term card for humans.

```json
{"contract_version":1,
 "term":"MCP","zh":"外接工具","known":true,
 "editorial_line":"<the hand-written one-liner; origin editorial, not a signal>",
 "sightings":2,"sources":2,"first_seen":"2026-05-26","last_seen":"2026-08-20","quiet_days":7,
 "definitions":[{"quote":"…","source":{"url":"","title":"","published":""},"explained":"has_definition","intent":"technical"}],
 "conflicting":true,
 "verdicts":{"domain":["core","core"],"intent":["technical","technical"]},
 "note":"Evidence only. The dictionary does not rule which definition is right; cite the quote with its source."}
```

`conflicting` = more than one distinct `definition_quote`. Unknown term → `known:false`, empty arrays, nulls. Server (Matt) computes from stored sightings; the page mock computes from what this page collected.

### `trending` (read-only, no input)

```json
{"contract_version":1,"window_days":30,"contributors":1,
 "terms":[{"term":"RAG","sightings_30d":7,"new_term":false}]}
```

Top 10 by sightings in the last 30 days. `contributors` = distinct `submitter` in the window and is always exposed: with one feeder the ranking is that person's feeding order, and the reader must be able to see that.

### `GET /api/sightings` (server → pages, Matt)

Public sighting records (★ fields of §4 only), newest first. Query: `?term_key=<slug>` for one term; `?days=30` for the trending window; no query = latest 200. Response `{"contract_version":1,"contributors":N,"sightings":[…]}`. The home page (`/`), the term page (`/term/{slug}`) and `lookupTerm`／`trending` all read from this one endpoint; until it exists the pages show empty states (and `?demo=1` loads `fixtures/sightings-sample.json` for rehearsal).

## 6. No seeding

There is no seed origin. The existing 133 entries enter the signal system the same way as anything else: Kidult pastes an article into `/read` and the agent submits findings. `fixtures/feed-list-133.md` is his queue of articles, not data. Fixtures under `fixtures/` are lock regression inputs only and are never loaded into storage.

## 7. Versioning

`contract_version` is `1`. Bump on any change to §1–§3. Changes: edit this file in a commit whose message starts with `contract:`.
