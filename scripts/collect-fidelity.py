#!/usr/bin/env python3
"""Fidelity layer: does each finding's text actually appear on the source page?

The contract's QUOTE_NOT_IN_CONTEXT lock is self-referential (context is agent-authored),
so it cannot see whether the quoted text exists in the article. This checks that against
the cached page in collect/pages/<job_id>.html.

Normalization: strip <script>/<style>/<noscript>, unescape entities, drop tags, remove ALL
whitespace, fold full/half-width punctuation and curly/straight quotes. Then substring test.

Two passes, because "not found" has two very different causes:
  strict  -- the normalized text is a substring of the normalized page
  lenient -- same, but sentence-boundary punctuation is ignored. Pulling one sentence out of
             a paragraph legitimately turns a trailing comma into a full stop and drops an
             opening quote mark; that is not a change of content.

Verdicts per finding:
  OK           found verbatim (strict)
  OK_PUNCT     found only under lenient -- content faithful, boundary punctuation normalized
  DRIFT_*      not found either way -> the agent altered, truncated or fabricated the text
  UNVERIFIABLE the page could not be fetched or is a paywall/JS shell (not the agent's fault)

Every DRIFT is then graded by how much of it survives on the page, splitting the two very
different failures the single verdict hides: a sentence stitched together out of real page
fragments (recoverable) versus one whose words are nowhere on the page (fabricated).
  reassembled  every fragment is on the page, only order/joins changed
  paraphrased  some fragments on the page
  rewritten    under half
  summarised   no fragment at all -- the agent wrote its own sentence about the article
               instead of copying one from it (contract SS2 rule 1, "copy, don't explain").
               Spot-checked: the facts are usually right, the sentence is not the page's.

Usage: python3 scripts/collect-fidelity.py [--verbose] [--json out.json]
"""
import html
import json
import pathlib
import re
import sys
import unicodedata

PAGES = pathlib.Path("collect/pages")
DOCS = pathlib.Path("collect/docs")
# pages smaller than this are almost certainly a block/JS shell, not an article
SHELL_BYTES = 20000

FOLD = str.maketrans({
    "“": '"', "”": '"', "‘": "'", "’": "'",
    "「": '"', "」": '"', "『": '"', "』": '"',
    "（": "(", "）": ")", "，": ",", "、": ",",
    "。": ".", "：": ":", "；": ";", "？": "?",
    "！": "!", "—": "-", "–": "-", "－": "-",
    " ": "", "​": "", "﻿": "",
})


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = s.translate(FOLD)
    s = re.sub(r"\s+", "", s)
    return s.lower()


# punctuation that legitimately shifts when one sentence is lifted out of a paragraph
BOUNDARY = re.compile(r'^[",.:;?!\'()\-]+|[",.:;?!\'()\-]+$')


def loose(s: str) -> str:
    """Drop leading/trailing punctuation only -- inner punctuation still has to match."""
    return BOUNDARY.sub("", s)


def found(needle: str, page: str) -> str | None:
    """Return "strict", "punct" or None."""
    n = norm(needle)
    if not n:
        return "strict"
    if n in page:
        return "strict"
    if loose(n) and loose(n) in page:
        return "punct"
    return None


PUNCT_SPLIT = re.compile(r"[,.;:!?()\"'\u3001\u3002\uff0c\uff1a\uff1b\uff01\uff1f\uff08\uff09\u300c\u300d]")
SPACE_SPLIT = re.compile(r"[,.;:!?()\"']|\s")


def _ratio(sentence: str, page: str, splitter) -> float | None:
    frags = [x for x in splitter.split(sentence) if len(x.strip()) >= 6]
    if not frags:
        return None
    return sum(1 for x in frags if norm(x) in page) / len(frags)


def grade(sentence: str, page: str) -> tuple[str, float]:
    """How much of a drifted sentence is actually on the page.

    Split on punctuation for CJK (no spaces to split on) and on whitespace too for Latin
    text; take the more generous of the two so neither script is penalised by the other's
    tokenisation. Falls back to the whole sentence when it is too short to split.
    """
    cands = [r for r in (_ratio(sentence, page, PUNCT_SPLIT),
                         _ratio(sentence, page, SPACE_SPLIT)) if r is not None]
    ratio = max(cands) if cands else float(norm(sentence) in page)
    if ratio == 0:
        return "summarised", ratio
    if ratio < 0.5:
        return "rewritten", ratio
    if ratio < 1:
        return "paraphrased", ratio
    return "reassembled", ratio


def page_text(job: str):
    p = PAGES / f"{job}.html"
    if not p.exists() or p.stat().st_size == 0:
        return None, "no_page"
    raw = p.read_bytes()
    if len(raw) < SHELL_BYTES:
        reason = "shell_or_block"
    else:
        reason = None
    t = raw.decode("utf-8", errors="replace")
    t = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", t)
    t = re.sub(r"(?s)<!--.*?-->", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    return norm(t), reason


def main():
    verbose = "--verbose" in sys.argv
    out_path = None
    if "--json" in sys.argv:
        out_path = sys.argv[sys.argv.index("--json") + 1]

    rows = []
    grades = {"reassembled": 0, "paraphrased": 0, "rewritten": 0, "summarised": 0}
    stats = {"OK": 0, "OK_PUNCT": 0, "DRIFT_SENTENCE": 0, "DRIFT_QUOTE": 0,
             "DRIFT_BOTH": 0, "UNVERIFIABLE": 0}
    doc_stats = {}

    for dp in sorted(DOCS.glob("*.json")):
        d = json.load(open(dp))
        job = d["job_id"]
        page, bad = page_text(job)
        dstat = {"url": d["url"], "findings": len(d["findings"]), "ok": 0, "drift": 0, "unverifiable": 0, "page": bad or "ok"}
        for i, f in enumerate(d["findings"]):
            rec = {"job_id": job, "url": d["url"], "index": i,
                   "term_raw": f.get("term_raw", ""), "verdict": None}
            if page is None or bad:
                rec["verdict"] = "UNVERIFIABLE"
                rec["why"] = bad or "no_page"
                stats["UNVERIFIABLE"] += 1
                dstat["unverifiable"] += 1
                rows.append(rec)
                continue
            s_hit = found(f.get("sentence") or "", page)
            q = f.get("definition_quote") or ""
            q_hit = found(q, page)
            s_ok, q_ok = s_hit is not None, q_hit is not None
            if s_ok and q_ok:
                v = "OK" if (s_hit == "strict" and q_hit == "strict") else "OK_PUNCT"
                rec["verdict"] = v
                stats[v] += 1
                dstat["ok"] += 1
            else:
                v = "DRIFT_BOTH" if (not s_ok and not q_ok) else ("DRIFT_SENTENCE" if not s_ok else "DRIFT_QUOTE")
                rec["verdict"] = v
                rec["sentence"] = f.get("sentence", "")
                rec["definition_quote"] = q
                g, ratio = grade(f.get("sentence") or "", page)
                rec["grade"], rec["on_page_ratio"] = g, round(ratio, 2)
                grades[g] += 1
                stats[v] += 1
                dstat["drift"] += 1
                if verbose:
                    print(f"{v} {job} #{i} {rec['term_raw']!r}")
                    if not s_ok:
                        print(f"   sentence: {rec['sentence'][:110]}")
                    if not q_ok:
                        print(f"   quote:    {q[:110]}")
            rows.append(rec)
        doc_stats[job] = dstat

    total = sum(stats.values())
    verifiable = total - stats["UNVERIFIABLE"]
    faithful = stats["OK"] + stats["OK_PUNCT"]
    drift = stats["DRIFT_SENTENCE"] + stats["DRIFT_QUOTE"] + stats["DRIFT_BOTH"]
    print(f"findings {total} | faithful {faithful} (verbatim {stats['OK']} + punct {stats['OK_PUNCT']})"
          f" | DRIFT {drift} | UNVERIFIABLE {stats['UNVERIFIABLE']}")
    if verifiable:
        print(f"fidelity on verifiable: {faithful}/{verifiable} = {faithful/verifiable:.1%}")
    print("breakdown:", {k: v for k, v in stats.items() if v})
    if drift:
        print("drift grades:", {k: v for k, v in grades.items() if v})

    if out_path:
        json.dump({"stats": stats, "grades": grades, "docs": doc_stats, "findings": rows},
                  open(out_path, "w"), ensure_ascii=False, indent=1)
        print("wrote", out_path)


if __name__ == "__main__":
    main()
