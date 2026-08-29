#!/usr/bin/env python3
"""Fetch every source page in collect/docs/*.json into collect/pages/<job_id>.html.

Cache only; re-runnable. Skips files already present unless --force.
Usage: python3 scripts/collect-fetch.py [--force] [--workers N]
"""
import concurrent.futures as cf
import json
import pathlib
import sys
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
OUT = pathlib.Path("collect/pages")
OUT.mkdir(parents=True, exist_ok=True)
force = "--force" in sys.argv
workers = 8
if "--workers" in sys.argv:
    workers = int(sys.argv[sys.argv.index("--workers") + 1])


def one(p):
    d = json.load(open(p))
    job, url = d["job_id"], d["url"]
    dest = OUT / f"{job}.html"
    if dest.exists() and dest.stat().st_size > 0 and not force:
        return job, "cached", len(dest.read_bytes())
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    })
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            raw = r.read()
        dest.write_bytes(raw)
        return job, "ok", len(raw)
    except Exception as e:
        return job, f"ERR {type(e).__name__}: {str(e)[:80]}", 0


docs = sorted(pathlib.Path("collect/docs").glob("*.json"))
with cf.ThreadPoolExecutor(workers) as ex:
    res = list(ex.map(one, docs))

ok = sum(1 for _, s, _ in res if s in ("ok", "cached"))
print(f"pages {ok}/{len(res)} available")
for job, s, _ in res:
    if s not in ("ok", "cached"):
        print(f"FAIL {job}: {s}")
