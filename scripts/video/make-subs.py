#!/usr/bin/env python3
"""從 en1-6.txt 與各段實際長度產出 SRT。

⚠ 斷行照句子邊界切，不照固定字數。原本用「總字數 ÷ 卡片數」硬切，
   結果每張卡尾巴都留一兩個字掉到下一張（實測畫面上很明顯）。
   現在的規則：先按句號切成句子，再把短句合併到接近 MAX_CHARS，
   一句都不從中間斷開。長到單句超過上限的才在逗號處切。

時間軸用剪好的 seg*.mp4 實際長度，不用估的 —— 估的會愈走愈偏。
"""
import re
import subprocess
import sys
from pathlib import Path

work, vo = Path(sys.argv[1]), Path(sys.argv[2])

MAX_CHARS = 62        # 一張字幕的字元上限（1600px 寬、19pt，兩行內讀得完）
MIN_SECS = 1.6        # 一張字幕最短停留，太短會閃


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


def split_sentences(text):
    """切成句子。句號後接空白才算句尾，避免切壞 'ai-nomos.' 這種。"""
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p.strip() for p in parts if p.strip()]


def split_long(sent):
    """單句超過上限：在逗號處切；還是太長就在空白處切，但絕不切在字中間。"""
    if len(sent) <= MAX_CHARS:
        return [sent]
    out, buf = [], ''
    for chunk in re.split(r'(?<=,)\s+', sent):
        cand = (buf + ' ' + chunk).strip() if buf else chunk
        if len(cand) <= MAX_CHARS:
            buf = cand
        else:
            if buf:
                out.append(buf)
            # chunk 自己還是太長 → 照字切
            while len(chunk) > MAX_CHARS:
                cut = chunk.rfind(' ', 0, MAX_CHARS)
                if cut <= 0:
                    cut = MAX_CHARS
                out.append(chunk[:cut].strip())
                chunk = chunk[cut:].strip()
            buf = chunk
    if buf:
        out.append(buf)
    return out


def to_cards(text):
    """句子 → 字幕卡。短句往前合併，長句拆開，一句不從中間斷。"""
    cards, buf = [], ''
    for sent in split_sentences(text):
        for piece in split_long(sent):
            cand = (buf + ' ' + piece).strip() if buf else piece
            if len(cand) <= MAX_CHARS:
                buf = cand
            else:
                if buf:
                    cards.append(buf)
                buf = piece
    if buf:
        cards.append(buf)
    return cards or [text]


t, rows = 0.0, []
for n in range(1, 7):
    seg = dur(work / f'seg{n}.mp4')
    text = (vo / f'en{n}.txt').read_text(encoding='utf-8').strip()
    cards = to_cards(text)
    # 依字數比例分配時間（長句停久一點），並保住最短停留
    total = sum(len(c) for c in cards)
    spans, acc = [], 0.0
    for c in cards:
        span = max(MIN_SECS, seg * len(c) / total)
        spans.append(span)
        acc += span
    # 總和超過該段長度就等比壓回去
    if acc > seg:
        spans = [s * seg / acc for s in spans]
    cur = t
    for c, span in zip(cards, spans):
        rows.append((cur, cur + span, c))
        cur += span
    t += seg

with open(work / 'subs.srt', 'w', encoding='utf-8') as f:
    for i, (a, b, c) in enumerate(rows, 1):
        f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{c}\n\n")

longest = max(len(c) for _, _, c in rows)
print(f"  字幕 {len(rows)} 張（最長 {longest} 字元），總長 {t:.1f}s")
