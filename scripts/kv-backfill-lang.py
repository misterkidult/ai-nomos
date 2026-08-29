#!/usr/bin/env python3
"""Backfill `lang` on sightings stored before contract §4 gained the field.

Contract §4: lang is the language of the SOURCE DOCUMENT, not of the term. It is derived per
document — every sighting sharing a source URL gets the same value — because a term name is no
evidence of the language it was used in: `Sora 2`, `Midjourney` and `Canva AI` appear in Chinese
articles constantly, and judging by term name misfiled 90 of 924 sightings in testing.

Rule (same as api/findings.js): over one document's definition quotes plus its title,
CJK×3 > Latin  ⇒  zh, otherwise en. The ×3 weight is because Chinese says in one character
roughly what English says in three, so an unweighted count calls a mostly-Chinese article English
as soon as it quotes a few product names.

Run once, after the contract change. Idempotent — re-running writes the same values.

Usage: python3 scripts/kv-backfill-lang.py [--dry-run]
"""
import json
import pathlib
import re
import sys
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import kv  # noqa: E402

BATCH = 200
dry = "--dry-run" in sys.argv

CJK = re.compile(r"[一-鿿]")
LATIN = re.compile(r"[A-Za-z]")


def doc_lang(rows: list[dict]) -> str:
    """One document's language. Same rule as the server."""
    text = " ".join((r.get("definition_quote") or "") for r in rows)
    text += " " + ((rows[0].get("source") or {}).get("title") or "")
    cjk, latin = len(CJK.findall(text)), len(LATIN.findall(text))
    if cjk + latin == 0:
        return "zh"          # no evidence either way; the corpus is overwhelmingly zh
    return "zh" if cjk * 3 > latin else "en"


ids = kv.cmd("ZRANGE", "recent", 0, -1)["result"] or []
print(f"{len(ids)} sightings in recent")

records: dict[str, dict] = {}
for i in range(0, len(ids), BATCH):
    chunk = ids[i : i + BATCH]
    blobs = kv.pipeline([["GET", f"sighting:{sid}"] for sid in chunk])
    for sid, b in zip(chunk, blobs):
        raw = b.get("result")
        if raw:
            records[sid] = json.loads(raw) if isinstance(raw, str) else raw

print(f"{len(records)} readable")

# group by source url; sightings with no url are their own document
by_doc: dict[str, list[str]] = defaultdict(list)
for sid, rec in records.items():
    url = (rec.get("source") or {}).get("url") or f"__nourl__{sid}"
    by_doc[url].append(sid)

langs = {}
for url, sids in by_doc.items():
    lang = doc_lang([records[s] for s in sids])
    for s in sids:
        langs[s] = lang

zh = sum(1 for v in langs.values() if v == "zh")
print(f"{len(by_doc)} documents → zh {zh} / en {len(langs) - zh} sightings")

changed = [s for s, l in langs.items() if records[s].get("lang") != l]
print(f"{len(changed)} need writing" + (" (dry run, nothing written)" if dry else ""))
if dry or not changed:
    for s in changed[:5]:
        r = records[s]
        print(f"  {s} → {langs[s]}  {(r.get('term_raw') or '')[:20]}  {((r.get('source') or {}).get('url') or '')[:50]}")
    sys.exit(0)

for i in range(0, len(changed), BATCH):
    chunk = changed[i : i + BATCH]
    cmds = []
    for sid in chunk:
        rec = dict(records[sid], lang=langs[sid])
        cmds.append(["SET", f"sighting:{sid}", json.dumps(rec, ensure_ascii=False)])
    kv.pipeline(cmds)
    print(f"  wrote {min(i + BATCH, len(changed))}/{len(changed)}")

print("done")
