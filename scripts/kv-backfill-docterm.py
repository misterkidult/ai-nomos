#!/usr/bin/env python3
"""Backfill the `docterm` map for sightings loaded before POST /api/findings existed.

api/findings.js keys one sighting per (document, term) so that re-feeding an article through
/read overwrites rather than piles up. It finds the existing id in the Redis hash `docterm`
(field "<source_hash>|<term_key>"). The 2026-08-29 batch went in through scripts/kv-load.py,
which predates that hash and used ids of the form "<job_id>-<index>" — without this backfill,
re-feeding one of those 341 articles would create a second sighting for the same (article, term).

Run once, after kv-load.py. Idempotent.

Usage: python3 scripts/kv-backfill-docterm.py [--dry-run]
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import kv  # noqa: E402

BATCH = 200
dry = "--dry-run" in sys.argv

ids = kv.cmd("ZRANGE", "recent", 0, -1)["result"] or []
print(f"{len(ids)} sightings in recent")

fields, missing = {}, 0
for i in range(0, len(ids), BATCH):
    chunk = ids[i:i + BATCH]
    blobs = kv.pipeline([["GET", f"sighting:{sid}"] for sid in chunk])
    for sid, b in zip(chunk, blobs):
        raw = b.get("result") if isinstance(b, dict) else b
        if not raw:
            missing += 1
            continue
        r = json.loads(raw) if isinstance(raw, str) else raw
        h, key = r.get("source_hash") or "", r.get("term_key") or ""
        if h and key:
            fields[f"{h}|{key}"] = sid
    print(f"  read {min(i + BATCH, len(ids))}/{len(ids)}", end="\r")

print(f"\n{len(fields)} (document, term) pairs · {missing} unreadable")
if dry:
    for k in list(fields)[:3]:
        print(" ", k, "->", fields[k])
    sys.exit(0)

pairs = [x for kv_ in fields.items() for x in kv_]
sent = 0
for i in range(0, len(pairs), BATCH * 2):
    chunk = pairs[i:i + BATCH * 2]
    kv.pipeline([["HSET", "docterm"] + chunk])
    sent += len(chunk) // 2
    print(f"  wrote {sent}/{len(fields)}", end="\r")

print(f"\ndocterm size: {kv.cmd('HLEN', 'docterm')}")
