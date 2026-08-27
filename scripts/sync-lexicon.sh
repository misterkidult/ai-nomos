#!/bin/sh
# 把字典 repo 的薄索引複製進 public/。
# 字典 repo 是 private、沒有線上站，瀏覽器抓不到，所以部署前 vendor 一份。
set -e
DICT="${DICT:-$HOME/GitHub/ai-dictionary}"
HERE="$(cd "$(dirname "$0")" && pwd)"
(cd "$DICT" && uv run build.py --index >/dev/null)
cp "$DICT/site/lexicon.json" "$HERE/../public/lexicon.json"
python3 -c "import json;d=json.load(open('$HERE/../public/lexicon.json'));print('public/lexicon.json',d['count'],'則，built',d['built'])"
