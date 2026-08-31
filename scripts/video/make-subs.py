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
LANG = sys.argv[3] if len(sys.argv) > 3 else 'en'
SRC = {'en': 'en', 'zh': 'zh', 'ja': 'ja'}[LANG]

# 一張字幕的字元上限。CJK 一個字約佔兩個拉丁字寬，所以上限要低一半。
# 上限的依據是「讀得完」不是「放得下」——中文 33 字實測只佔 52% 畫面寬，
# 版面沒問題；但一張停 3–4 秒，超過 30 字就跟不上聲音。
MAX_CHARS = 62 if LANG == 'en' else 30
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
    """切成句子。

    英文：句號後要接空白才算句尾，避免切壞 'ai-nomos.' 這種。
    中日文：全形句號／問號／驚嘆號後面沒有空白，直接切。
    """
    parts = re.split(r'(?<=[。！？])|(?<=[.!?])\s+', text.strip())
    return [p.strip() for p in parts if p and p.strip()]


def split_long(sent):
    """單句超過上限就在逗號處切，切完把碎片併回接近上限的長度。

    ⚠ 只切「超過上限」的句子。而且切完要併 —— 25 字的句子只超標 1 個字，
       若直接照逗號切會變成 6 + 19 兩張，第一張「讀 AI 的文章，」只有 1.7 秒
       且是半句話，讀的人還沒看完就跳掉了（實測看得出來）。
       併回去之後是 12 + 13，兩張都是完整的意群。
    """
    if len(sent) <= MAX_CHARS:
        return [sent]
    parts = [c for c in re.split(r'(?<=[，、])|(?<=,)\s+', sent) if c and c.strip()]
    # 逗號切不開（單一長句無標點）→ 照字硬切
    if len(parts) <= 1:
        out, rest = [], sent
        while len(rest) > MAX_CHARS:
            cut = rest.rfind(' ', 0, MAX_CHARS) if LANG == 'en' else MAX_CHARS
            if cut <= 0:
                cut = MAX_CHARS
            out.append(rest[:cut].strip())
            rest = rest[cut:].strip()
        if rest:
            out.append(rest)
        return out
    # ⚠ 逗號切完的片段可能自己就超長（實測「It shows you the eleven articles…」
    #   一個逗號片段就 76 字元），要先各自照空白／逐字切到上限內，
    #   否則後面合併時第一個片段會直接放行。
    parts = [p for c in parts for p in _hard_split(c)]
    # 目標張數＝剛好裝得下的最少張數，讓每張長度平均，不會一長一短
    n = -(-len(sent) // MAX_CHARS)
    target = -(-len(sent) // n)
    out, buf = [], ''
    sep = '' if LANG != 'en' else ' '
    for chunk in parts:
        cand = (buf + sep + chunk).strip() if buf else chunk
        if not buf or (len(cand) <= max(target, MIN_CHUNK) and len(cand) <= MAX_CHARS):
            buf = cand
        else:
            out.append(buf)
            buf = chunk
    if buf:
        out.append(buf)
    # 收尾：太短的碎片往前併（「So,」「contributed.」這種孤字）
    return _glue(out)


def _hard_split(text):
    """單一片段超過上限時，英文照空白切、中日文逐字切。"""
    if len(text) <= MAX_CHARS:
        return [text]
    out, rest = [], text
    while len(rest) > MAX_CHARS:
        cut = rest.rfind(' ', 0, MAX_CHARS) if LANG == 'en' else MAX_CHARS
        if cut <= 0:
            cut = MAX_CHARS
        out.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    if rest:
        out.append(rest)
    return out


MIN_CHUNK = 14        # 低於這個長度的片段不該單獨成一張


def _glue(cards):
    """把過短的碎片併進鄰居。一張字幕只有兩三個字時，讀的人還沒對焦就跳掉了。

    ⚠ 併的時候允許超過 MAX_CHARS 一點（GLUE_SLACK）。實測「So,」只有 3 字元、
       停 1.4 秒，但併進下一句會變 64 字元、剛好超標 2 個字 —— 兩害相權，
       稍長的一張比孤零零的三個字好讀。
    """
    sep = '' if LANG != 'en' else ' '
    limit = MAX_CHARS + GLUE_SLACK
    out = []
    for c in cards:
        if out and (len(c) < MIN_CHUNK or len(out[-1]) < MIN_CHUNK) \
                and len(out[-1]) + len(c) + len(sep) <= limit:
            out[-1] = (out[-1] + sep + c).strip()
        else:
            out.append(c)
    return out


GLUE_SLACK = 12 if LANG == 'en' else 6


def to_cards(text):
    """句子 → 字幕卡。

    ⚠ 一張卡最多一個完整句子。原本會把兩個短句併成一張（只要總長沒超過上限），
       結果是「全部都攤給你看。每一句都標著出處，你可以自己去確認。」擠在一起 ——
       唸完第一句時第二句已經在畫面上，讀的人跟不上聲音。
    """
    cards = []
    for sent in split_sentences(text):
        cards.extend(split_long(sent))
    return _glue(cards) or [text]


t, rows = 0.0, []
for n in range(1, 7):
    seg = dur(work / f'seg{n}.mp4')
    text = (vo / f'{SRC}{n}.txt').read_text(encoding='utf-8').strip()
    # ⚠ 稿子裡的 SSML 標籤（<break time="..."/>）是給 TTS 的停頓指令，
    #   不是字幕內容。留著會被當成一個「詞」而把句子切在奇怪的地方。
    text = re.sub(r'<[^>]+>', '', text).strip()
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
