#!/usr/bin/env python3
"""Backfill `docterm`, skipping (document, term_key) pairs that hold more than one sighting.

Why this exists next to kv-backfill-docterm.py: that script maps every pair to a single id,
which is correct only when a pair really holds one sighting. In the live data (checked
2026-09-04) 44 pairs hold 92 sightings between them — not duplicates, but DIFFERENT terms that
normalise to the same term_key: 「Cron」「定時任務」「Cron 表達式」 all become `scheduled-run`,
each with its own quote. Pointing such a pair at one id would make re-feeding that article
overwrite the winner and strand the others: still in the dictionary, never updatable again.

So this writes only the unambiguous pairs and prints the conflicts for a human to decide.
Skipping is the safe side: a pair that is absent from `docterm` takes the "new record" path,
which cannot overwrite anything.

Contract §2 rule 6 ("report a term once per document") reads on term_key, and whether two terms
that share a key are one term or two is a product decision, not one this script should make.

Usage: python3 scripts/kv-backfill-docterm-safe.py [--dry-run]
"""
import json
import pathlib
import sys
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import kv  # noqa: E402

BATCH = 200
dry = "--dry-run" in sys.argv

ids = kv.cmd("ZRANGE", "recent", 0, -1)["result"] or []
print(f"{len(ids)} sightings in recent")

pairs, missing = defaultdict(list), 0
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
            pairs[f"{h}|{key}"].append((sid, r.get("term_raw") or ""))
    print(f"  read {min(i + BATCH, len(ids))}/{len(ids)}", end="\r")

clean = {k: v[0][0] for k, v in pairs.items() if len(v) == 1}
conflict = {k: v for k, v in pairs.items() if len(v) > 1}
print(f"\n{len(pairs)} pairs · {len(clean)} unambiguous · {len(conflict)} conflicting "
      f"({sum(len(v) for v in conflict.values())} sightings) · {missing} unreadable")

if conflict:
    print("\nSkipped — one term_key, several term_raw. Decide before these can be deduped:")
    for k, v in sorted(conflict.items()):
        print(f"  {k}")
        for sid, tr in v:
            print(f"     {sid:26} {tr}")

if dry:
    print("\n--dry-run: nothing written")
    sys.exit(0)

flat = [x for kv_ in clean.items() for x in kv_]
sent = 0
for i in range(0, len(flat), BATCH * 2):
    chunk = flat[i:i + BATCH * 2]
    kv.pipeline([["HSET", "docterm"] + chunk])
    sent += len(chunk) // 2
    print(f"  wrote {sent}/{len(clean)}", end="\r")

print(f"\ndocterm size: {kv.cmd('HLEN', 'docterm')['result']}")
