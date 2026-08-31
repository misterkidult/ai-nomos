# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///
"""ai-nomos 影片旁白 — Azure TTS（en-US-GuyNeural）。
六段英文旁白各生一個 mp3，附長度統計。
金鑰：環境變數，或 ClaudeOS 的 .env.secrets（不複製、不落地第二份）。
用法：uv run azure_vo.py [rate]     例：uv run azure_vo.py +6%
"""
import os, subprocess, sys
from pathlib import Path
import requests

HERE = Path(__file__).parent
SECRETS = Path.home() / "Documents/ClaudeOS/Meta/1-system/.env.secrets"

def load_val(name):
    """先環境變數，再退回 .env.secrets（支援 export KEY=value）。"""
    v = os.environ.get(name)
    if v:
        return v
    if SECRETS.exists():
        for line in SECRETS.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:]
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, val = line.split("=", 1)
            if k.strip() == name:
                return val.strip().strip('"').strip("'")
    return None

KEY = load_val("AZURE_SPEECH_KEY")
REGION = load_val("AZURE_SPEECH_REGION")
if not KEY or not REGION:
    sys.exit(f"✗ 缺 AZURE_SPEECH_KEY 或 AZURE_SPEECH_REGION\n  找過：環境變數、{SECRETS}")

VOICE = "en-US-GuyNeural"
RATE = sys.argv[1] if len(sys.argv) > 1 else "+0%"

ENDPOINT = f"https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1"

def synth(idx, text):
    ssml = (f'<speak version="1.0" xml:lang="en-US">'
            f'<voice name="{VOICE}">'
            f'<prosody rate="{RATE}">{text}</prosody>'
            f'</voice></speak>')
    r = requests.post(ENDPOINT,
        headers={"Ocp-Apim-Subscription-Key": KEY,
                 "Content-Type": "application/ssml+xml",
                 "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
                 "User-Agent": "ai-nomos-vo"},
        data=ssml.encode("utf-8"), timeout=60)
    if r.status_code != 200:
        print(f"  ✗ en{idx}: {r.status_code} {r.text[:200]}")
        return None
    p = HERE / f"az{idx}.mp3"
    p.write_bytes(r.content)
    return p

def duration(p):
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                          "-of","default=nw=1:nk=1", str(p)],
                         capture_output=True, text=True)
    try: return float(out.stdout.strip())
    except ValueError: return 0.0

FRAMES = [25, 45, 40, 30, 32, 15]   # 分鏡各格秒數（az5 於 2026-08-31 從 25 拉到 32：
                                    # 該格改講語言分佈數字後長 28.2s，且畫面本來就有三個動作）

print(f"Azure TTS · {VOICE} · rate={RATE} · region={REGION}\n")
total = 0.0
for i in range(1, 7):
    text = (HERE / f"en{i}.txt").read_text(encoding="utf-8").strip()
    p = synth(i, text)
    if p:
        d = duration(p); total += d
        slack = FRAMES[i-1] - d
        print(f"  ✓ az{i}.mp3  {d:6.2f}s / 分鏡 {FRAMES[i-1]:2d}s   餘裕 {slack:+6.2f}s")
print(f"\n總長 {total:.2f}s / 分鏡 180s（Devpost 上限 180s）")
