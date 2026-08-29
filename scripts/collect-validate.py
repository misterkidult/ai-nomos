#!/usr/bin/env python3
"""Validate staged collect/docs/*.json against contract §3 locks.

Each staged file is a replayable submitFindings payload:
  {"url","title","published","requested_terms","findings":[...],"not_found":[...]}
Usage: python3 scripts/collect-validate.py [--verbose]
"""
import collections
import importlib.util
import json
import pathlib
import sys

spec = importlib.util.spec_from_file_location(
    "cf", pathlib.Path(__file__).parent / "check-findings.py"
)
cf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cf)

REQ_TOP = ["url", "requested_terms", "findings", "not_found"]
verbose = "--verbose" in sys.argv
docs = sorted(pathlib.Path("collect/docs").glob("*.json"))
acc = rej = 0
reasons = collections.Counter()
bad_docs = []

for p in docs:
    try:
        d = json.load(open(p))
    except Exception as e:
        bad_docs.append((p.name, f"UNPARSEABLE: {e}"))
        continue
    missing = [k for k in REQ_TOP if k not in d]
    if missing:
        bad_docs.append((p.name, "MISSING_TOP_FIELD: " + ",".join(missing)))
        continue
    if not d["findings"] and not d["not_found"]:
        bad_docs.append((p.name, "EMPTY"))
        continue
    for f in d["findings"]:
        w = cf.check(f)
        if not (f.get("source") or {}).get("url"):
            w = sorted(set(w) | {"MISSING_SOURCE_URL"})
        if w:
            rej += 1
            reasons.update(w)
            if verbose:
                print(f"REJECT {p.name} {f.get('term_raw')!r}: {', '.join(w)}")
        else:
            acc += 1

print(f"docs {len(docs)} | findings accepted {acc} / rejected {rej}")
if reasons:
    print("reasons:", dict(reasons.most_common()))
for n, why in bad_docs:
    print(f"BAD DOC {n}: {why}")
sys.exit(1 if (rej or bad_docs) else 0)
