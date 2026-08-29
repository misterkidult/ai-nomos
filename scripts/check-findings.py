#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Reference implementation of context/contract.md §3 locks (PII_DETECTED is server-only, not here).

Usage: uv run scripts/check-findings.py fixtures/locks-regression.json
Prints one REJECT line per failing finding, then a summary. Exit 0 always.
"""
import json
import sys

ENUMS = {
    "explained": ["has_definition", "mentioned", "assumed"],
    "intent": ["selling_point", "technical", "risk_or_limit"],
    "domain": ["core", "edge", "not"],
}
REQUIRED = ["term_raw", "term_normalized", "sentence", "context", "explained", "intent", "domain", "definition_quote", "requested"]
STOPLIST = "導入 自架 本地 整合 平台 系統 流程 資料 知識庫 工具 應用 服務 方案 自動化 數位轉型 雲端 上線 部署 優化".split()


def check(f: dict) -> list[str]:
    why = []
    if any(k not in f for k in REQUIRED):
        why.append("MISSING_FIELD")
    for k, vs in ENUMS.items():
        if f.get(k) not in vs:
            why.append("ENUM_INVALID")
    s, t = str(f.get("sentence") or ""), str(f.get("term_raw") or "")
    if t and s and t.lower() not in s.lower():
        why.append("SENTENCE_LACKS_TERM")
    if len(s) > 120:
        why.append("SENTENCE_TOO_LONG")
    q = f.get("definition_quote") or ""
    if q and q not in (f.get("context") or s):
        why.append("QUOTE_NOT_IN_CONTEXT")
    if f.get("domain") == "edge" and not q:
        why.append("EDGE_WITHOUT_QUOTE")
    if t.strip() in STOPLIST:
        why.append("STOPLISTED")
    if f.get("domain") == "not" and f.get("requested") is not True:
        why.append("NOT_AI_TERM")
    return sorted(set(why))


if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    acc, rej = [], []
    for i, f in enumerate(data):
        w = check(f)
        (rej if w else acc).append((i, f, w))
    for i, f, w in rej:
        print(f"REJECT #{i} {f.get('term_raw')}: {', '.join(w)}")
    print(f"accepted {len(acc)} / rejected {len(rej)} / total {len(data)}")
