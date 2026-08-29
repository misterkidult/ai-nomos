#!/usr/bin/env python3
"""Load faithful findings from collect/docs/*.json into Upstash.

Only findings the fidelity layer cleared (OK / OK_PUNCT) are loaded: a sighting whose
quote cannot be found on its own source page defeats the point of publishing the link.
Run scripts/collect-fidelity.py first to produce collect/fidelity.json.

Key layout (contract SS4/SS5):
  sighting:<id>            hash-free JSON blob, public (star) fields only
  by_term:<term_key>       sorted set, score = submitted_at epoch -> sighting id
  recent                   sorted set of every id, score = submitted_at epoch
  docs                     set of source.hash, for the "N documents" counter
  doc:<hash>               source url/title/published, one per article
  contributors             set of submitter ids
  meta:contract_version    integer

Usage: python3 scripts/kv-load.py [--dry-run] [--flush]
"""
import glob
import hashlib
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import kv  # noqa: E402

PUBLIC = ["term_raw", "term_normalized", "explained", "intent", "domain", "definition_quote"]
SUBMITTER = "kidult-collect-2026-08-29"
BATCH = 200

dry = "--dry-run" in sys.argv
flush = "--flush" in sys.argv

fid = json.load(open("collect/fidelity.json"))
faithful = {(r["job_id"], r["index"]) for r in fid["findings"]
            if r["verdict"] in ("OK", "OK_PUNCT")}
lex = {t["term"]: t["slug"] for t in json.load(open("public/lexicon.json"))["terms"]}

# every sighting from this batch shares one timestamp; they were collected together.
# stored as ISO 8601 per contract SS4; the epoch form is only the sorted-set score.
now = int(time.time())
now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))

rows, docs, term_keys = [], {}, set()
for p in sorted(glob.glob("collect/docs/*.json")):
    d = json.load(open(p))
    src = {"url": d["url"], "title": d.get("title", ""), "published": d.get("published", "")}
    doc_hash = hashlib.sha256(d["url"].encode()).hexdigest()[:16]
    used = False
    for i, f in enumerate(d["findings"]):
        if (d["job_id"], i) not in faithful:
            continue
        used = True
        tn = f.get("term_normalized") or ""
        term_key = lex.get(tn) or f["term_raw"].strip().lower()
        term_keys.add(term_key)
        sid = f"{d['job_id']}-{i}"
        rows.append({
            "id": sid,
            "term_key": term_key,
            **{k: f.get(k, "") for k in PUBLIC},
            "source": src,
            "source_hash": doc_hash,
            "submitted_at": now_iso,
            "origin": "agent",
            "contract_version": 1,
        })
    if used:
        docs[doc_hash] = src

print(f"{len(rows)} sightings · {len(term_keys)} term_keys · {len(docs)} documents")
if dry:
    print(json.dumps(rows[0], ensure_ascii=False, indent=1))
    sys.exit(0)

if flush:
    print("flushing…", kv.cmd("FLUSHDB"))

cmds = []
for r in rows:
    cmds.append(["SET", f"sighting:{r['id']}", json.dumps(r, ensure_ascii=False)])
    cmds.append(["ZADD", f"by_term:{r['term_key']}", now, r["id"]])
    cmds.append(["ZADD", "recent", now, r["id"]])
for h, src in docs.items():
    cmds.append(["SET", f"doc:{h}", json.dumps(src, ensure_ascii=False)])
    cmds.append(["SADD", "docs", h])
cmds.append(["SADD", "contributors", SUBMITTER])
cmds.append(["SET", "meta:contract_version", "1"])

sent = 0
for i in range(0, len(cmds), BATCH):
    chunk = cmds[i:i + BATCH]
    res = kv.pipeline(chunk)
    bad = [x for x in res if isinstance(x, dict) and "error" in x]
    if bad:
        raise SystemExit(f"batch at {i} failed: {bad[:3]}")
    sent += len(chunk)
    print(f"  {sent}/{len(cmds)} commands", end="\r")

print(f"\nsent {sent} commands")
print("dbsize:", kv.cmd("DBSIZE"))
print("recent:", kv.cmd("ZCARD", "recent"))
print("docs:", kv.cmd("SCARD", "docs"))
