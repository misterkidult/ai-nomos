#!/usr/bin/env python3
"""從 en1-6.txt 與各段實際長度產出 SRT。

一段旁白拆成幾張字幕（約每 4 秒一張），避免一次塞太多字讀不完。
時間軸用剪好的 seg*.mp4 實際長度，不用估的 —— 估的會愈走愈偏。
"""
import subprocess
import sys
from pathlib import Path

work, vo = Path(sys.argv[1]), Path(sys.argv[2])


def dur(p):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', str(p)],
        capture_output=True, text=True).stdout.strip()
    return float(out)


def ts(s):
    h, r = divmod(s, 3600)
    m, r = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(r):02d},{int(round((r % 1) * 1000)):03d}"


t, rows = 0.0, []
for n in range(1, 7):
    seg = dur(work / f'seg{n}.mp4')
    text = (vo / f'en{n}.txt').read_text(encoding='utf-8').strip()
    words = text.split()
    n_cards = max(1, round(seg / 4))
    per = max(1, -(-len(words) // n_cards))       # ceil
    chunks = [' '.join(words[i:i + per]) for i in range(0, len(words), per)] or [text]
    each = seg / len(chunks)
    for j, c in enumerate(chunks):
        rows.append((t + j * each, t + (j + 1) * each, c))
    t += seg

with open(work / 'subs.srt', 'w', encoding='utf-8') as f:
    for i, (a, b, c) in enumerate(rows, 1):
        f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{c}\n\n")

print(f"  字幕 {len(rows)} 張，總長 {t:.1f}s")
