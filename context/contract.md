# ai-nomos data contract · v1 (2026-08-27)

Single source of truth for everything that crosses a boundary: page ↔ agent (WebMCP tools), page ↔ server (`api/*`), seed batch → server. **Change it here, not in chat.** The contract is English only; the agent never translates. UI copy is a separate concern (`public/read.html` carries zh-Hant and en string tables).

Owners: page (`public/`) = Claude · `api/*` + storage = Matt · seed noise review = Addy · verdicts = Kidult.

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

Enum meanings:

- `explained` — `has_definition`: the document states what the term means · `mentioned`: named in passing, no explanation · `assumed`: used as if the reader already knows it
- `intent` — `selling_point`: used to sell or promote · `technical`: describes how something works · `risk_or_limit`: names a limitation, risk or caveat
- `domain` — `core`: an AI-field term · `edge`: borderline (tooling, adjacent infra) · `not`: not an AI term

JSON Schema (also returned by `feedDocument` as `finding_schema`):

```json
{"type":"object","additionalProperties":false,
 "required":["term_raw","term_normalized","sentence","context","explained","intent","domain","definition_quote"],
 "properties":{
  "term_raw":{"type":"string"},
  "term_normalized":{"type":"string"},
  "sentence":{"type":"string","maxLength":120},
  "context":{"type":"string"},
  "explained":{"type":"string","enum":["has_definition","mentioned","assumed"]},
  "intent":{"type":"string","enum":["selling_point","technical","risk_or_limit"]},
  "domain":{"type":"string","enum":["core","edge","not"]},
  "definition_quote":{"type":"string"}}}
```

## 2. Extraction rules (returned by `feedDocument` as `rules`, English, verbatim)

```
You are helping the user read this document. Find the AI terms in it and report them with submitFindings, following these rules.
1. Copy, don't explain. term_raw = exactly as written. sentence = the one sentence it appears in (max 120 chars). context = that sentence plus one sentence before and after.
   definition_quote only when the document itself explains the term, and it must be a verbatim substring of context. If the document does not explain it, leave it "" — never fill from your own knowledge.
2. For each term answer three single-choice fields: explained (has_definition / mentioned / assumed), intent (selling_point / technical / risk_or_limit), domain (core / edge / not).
3. Do not report: model architecture names, training hyperparameters, algorithm names, statistics terms, or anything in the stoplist below.
4. The known-term list is in lexicon. Report known terms too (so the dictionary sees them again) and set term_normalized to the lexicon term; otherwise term_normalized = "".
5. De-identify sentence and context: replace company names, person names, amounts, phone numbers and emails with [company], [person], [amount], [phone], [email].
6. If a term appears several times, report it once — the occurrence that has a definition.
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
| `PII_DETECTED` | **server only**: regex hit for email / phone / 統編 / amount / URL in `sentence`, `context` or `definition_quote` |

Open (Matt decides 8/29, write the answer here): should `domain = not` be stored or rejected? The page mock currently stores it.

## 4. Sighting record (server storage, Matt)

What the server keeps after a finding passes the locks. Public read surfaces only the fields marked ★.

| field | note |
|---|---|
| `id` | server-generated |
| ★ `term_key` | lexicon `slug` when `term_normalized` is known; otherwise lowercased, trimmed `term_raw` |
| ★ `term_raw`, ★ `term_normalized`, ★ `explained`, ★ `intent`, ★ `domain`, ★ `definition_quote` | from the finding |
| `sentence`, `context` | **never public** (plan v2 §2) |
| ★ `origin` | `agent` (via `submitFindings`) · `seed` (`fixtures/seed-133.json`) · `editorial` (the 133 hand-written entries; not in the signal system) |
| `source.hash` | salted hash of the document text, computed client-side; dedup key and the "N documents" counter |
| ★ `source.url`, ★ `source.title`, `source.published` | present for `seed` only (public article) |
| ★ `submitted_at` | server time, ISO 8601 |
| `submitter` | anonymous browser id (client-held; a limit, not a security feature) |
| `contract_version` | integer, see §7 |

Derived, never stored: `first_seen` = min `submitted_at`; `doc_count` = distinct `source.hash`; `quiet_days` = today − last `submitted_at` whose `definition_quote` is non-empty. Signal block hidden when `doc_count < 3`.

## 5. Tools

### `feedDocument` (read-only, no input)

```json
{"contract_version":1,
 "document":"<full text as pasted>",
 "known_hits":[{"term":"","zh":"","slug":"","matched":""}],
 "lexicon":[{"term":"","aka":[""],"zh":""}],
 "rules":"<§2>",
 "finding_schema":{"…§1"}}
```

### `submitFindings` (input `{findings: Finding[]}`)

```json
{"contract_version":1,
 "accepted":3,
 "rejected":[{"index":1,"term_raw":"","reasons":["EDGE_WITHOUT_QUOTE"]}],
 "status":"mock"}
```

`status`: `mock` (page only, nothing written) · `stored` · `pending_review` (server batch check not yet run).

## 6. Seed batch (`fixtures/seed-133.json`)

For each of the 133 lexicon terms: one public article containing a sentence that defines the term. Same Finding shape, plus `origin: "seed"` and `source: {url, title, published}`. Constraints: publicly reachable article; prefer zh-Hant, en acceptable; `definition_quote` verbatim from the article; `term_normalized` = the lexicon term; `term_raw` = how that article writes it. Findings that fail the locks, and terms with no findable definition sentence, go to `fixtures/seed-133-review.md` for Kidult to tick. No finding may be hand-edited to pass a lock.

## 7. Versioning

`contract_version` is `1`. Bump on any change to §1–§3. Changes: edit this file in a commit whose message starts with `contract:`.
