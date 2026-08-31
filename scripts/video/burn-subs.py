#!/usr/bin/env python3
"""把 SRT 燒進畫面。

⚠ 為什麼不用 ffmpeg 的 subtitles 濾鏡：本機 ffmpeg 9.0 沒編 libass
   （configuration 無 --enable-libass），那個濾鏡根本不存在。改走
   Pillow 把每張字幕畫成 PNG，再用 overlay 濾鏡按時間疊上去 ——
   overlay 是內建的，不吃額外編譯選項。

用法：burn-subs.py <輸入 mp4> <subs.srt> <輸出 mp4>
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SRC, SRT, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])

W, H = 1600, 900
FONT_SIZE = 27
LINE_GAP = 9
PAD_X, PAD_Y = 20, 12
BOTTOM = 52          # 字幕底部離畫面下緣
MAX_W = int(W * 0.82)  # 一行最寬

# macOS 內建字型；Helvetica 在 .ttc 裡，取第 0 個 face
FONT_CANDIDATES = [
    ('/System/Library/Fonts/Helvetica.ttc', 0),
    ('/System/Library/Fonts/Supplemental/Arial.ttf', 0),
    ('/Library/Fonts/Arial.ttf', 0),
]


def load_font():
    for path, idx in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, FONT_SIZE, index=idx)
            except Exception:
                continue
    return ImageFont.load_default()


FONT = load_font()


def parse_srt(p):
    """回傳 [(start_sec, end_sec, text)]。"""
    blocks = re.split(r'\n\s*\n', p.read_text(encoding='utf-8').strip())
    out = []
    for b in blocks:
        lines = [l for l in b.strip().split('\n') if l.strip()]
        if len(lines) < 3:
            continue
        m = re.match(r'(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)', lines[1])
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        a = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        z = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        out.append((a, z, ' '.join(lines[2:])))
    return out


def wrap(text, draw):
    """照實際像素寬折行，不照字數。"""
    words, lines, cur = text.split(), [], ''
    for w in words:
        cand = (cur + ' ' + w).strip()
        if draw.textlength(cand, font=FONT) <= MAX_W:
            cur = cand
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def render(text, path):
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    lines = wrap(text, probe)
    widths = [probe.textlength(l, font=FONT) for l in lines]
    lh = FONT_SIZE + LINE_GAP
    box_w = int(max(widths)) + PAD_X * 2
    box_h = lh * len(lines) - LINE_GAP + PAD_Y * 2

    img = Image.new('RGBA', (box_w, box_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 半透明黑底：字在任何底色上都讀得到
    d.rounded_rectangle([0, 0, box_w - 1, box_h - 1], radius=4, fill=(0, 0, 0, 189))
    y = PAD_Y
    for l, lw in zip(lines, widths):
        d.text(((box_w - lw) / 2, y), l, font=FONT, fill=(255, 255, 255, 255))
        y += lh
    img.save(path)
    return box_w, box_h


cues = parse_srt(SRT)
print(f"  {len(cues)} 張字幕 → 燒進畫面")

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    inputs, filters, last = ['-i', str(SRC)], [], '0:v'
    for i, (a, z, text) in enumerate(cues):
        png = tmp / f'{i:03d}.png'
        bw, bh = render(text, png)
        inputs += ['-i', str(png)]
        x = (W - bw) // 2
        y = H - BOTTOM - bh
        tag = f'v{i}'
        filters.append(
            f"[{last}][{i+1}:v]overlay={x}:{y}:enable='between(t,{a:.3f},{z:.3f})'[{tag}]")
        last = tag

    cmd = ['ffmpeg', '-y', '-v', 'error'] + inputs + [
        '-filter_complex', ';'.join(filters),
        '-map', f'[{last}]', '-map', '0:a',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'copy', str(OUT)]
    subprocess.run(cmd, check=True)

print(f"  ✓ {OUT}")
