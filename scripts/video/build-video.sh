#!/usr/bin/env bash
# 把六格畫面與六段配音剪成一支 mp4，燒上英文字幕。
#
# ⚠ f2 若是 PLACEHOLDER 版本，這支片子不可送出 —— 那格必須是真 agent 呼叫工具的
#   實錄，見 context/video-handoff.md。腳本會在檔名含 PLACEHOLDER 時警告。
#
# 用法：bash scripts/video/build-video.sh <素材目錄> [輸出檔]
set -euo pipefail

SRC="${1:?用法: build-video.sh <素材目錄> [輸出檔]}"
OUT="${2:-$SRC/ai-nomos-demo.mp4}"
VO="$(cd "$(dirname "$0")" && pwd)"
W=1600; H=900; FPS=30

FRAMES=(f1-article f2-PLACEHOLDER-agent f3-report f4-term-mcp f5-confirm f6-home)
[ -f "$SRC/f2-agent.webm" ] && FRAMES[1]=f2-agent   # 真錄版優先

warn=0
for i in "${!FRAMES[@]}"; do
  f="$SRC/${FRAMES[$i]}.webm"
  [ -f "$f" ] || { echo "缺素材：$f" >&2; exit 1; }
  case "${FRAMES[$i]}" in *PLACEHOLDER*) warn=1;; esac
done
if [ $warn = 1 ]; then echo "⚠⚠ 用到 PLACEHOLDER 那格 —— 這支片子不可送 Devpost ⚠⚠"; fi

work="$SRC/.build"; rm -rf "$work"; mkdir -p "$work"

# 每格：畫面裁到配音長度 +1.2s 尾巴，配上該段旁白
for i in "${!FRAMES[@]}"; do
  n=$((i+1)); name="${FRAMES[$i]}"
  a="$VO/az$n.mp3"
  [ -f "$a" ] || { echo "缺配音：$a" >&2; exit 1; }
  adur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$a")
  seg=$(python3 -c "import sys; print(f'{float(sys.argv[1])+1.2:.3f}')" "$adur")
  echo "  [$n] ${name}  旁白 ${adur}s → 片段 ${seg}s"
  ffmpeg -y -v error -i "$SRC/$name.webm" -i "$a" \
    -t "$seg" -r $FPS -s ${W}x${H} \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 -ac 2 \
    -af "apad=pad_dur=1.2" \
    "$work/seg$n.mp4"
done

# 串起來
: > "$work/list.txt"
for i in "${!FRAMES[@]}"; do echo "file 'seg$((i+1)).mp4'" >> "$work/list.txt"; done
ffmpeg -y -v error -f concat -safe 0 -i "$work/list.txt" -c copy "$work/joined.mp4"

# 字幕：從 en*.txt 逐段對齊
python3 "$VO/make-subs.py" "$work" "$VO"

# 字幕走外掛 .srt，不燒進畫面。
# ⚠ 本機 ffmpeg 9.0 沒編 libass（configuration 無 --enable-libass），subtitles 濾鏡
#   不存在，燒不了。外掛 srt 是 YouTube 的標準做法：上傳影片時一起傳字幕檔，
#   評審一樣看得到，而且可以關掉。同時嵌一份 mov_text 進 mp4 當備份。
ffmpeg -y -v error -i "$work/joined.mp4" -i "$work/subs.srt" \
  -map 0:v -map 0:a -map 1 -c:v copy -c:a copy -c:s mov_text \
  -metadata:s:s:0 language=eng "$OUT"
cp "$work/subs.srt" "${OUT%.mp4}.srt"

d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo ""
echo "✅ $OUT"
echo "   長度 ${d}s（Devpost 上限 180s）"
if [ $warn = 1 ]; then echo "   ⚠ 含 PLACEHOLDER 那格，不可送出"; fi
