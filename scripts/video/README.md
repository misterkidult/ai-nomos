# 影片旁白配音

英文旁白六段，Azure TTS `en-US-GuyNeural`（2026-08-31 定版）。

## 重跑

```
cd scripts/video && uv run azure_vo.py          # 預設語速
cd scripts/video && uv run azure_vo.py +6%      # 調快
```

輸出 `az1.mp3`–`az6.mp3` 在同目錄（gitignore，不進版控）。

金鑰讀 `~/Documents/ClaudeOS/Meta/1-system/.env.secrets` 的 `AZURE_SPEECH_KEY` ＋
`AZURE_SPEECH_REGION`（`eastasia`），或同名環境變數。**不要複製金鑰到專案裡。**

## 稿子

`en1.txt`–`en6.txt` 對應分鏡六格。改字直接改這裡再重跑。
全文與時間軸見 `context/video-narration-en.md`，中文版 `context/video-narration.md`。

## 定版長度（rate +0%）

| 段 | 長度 | 分鏡格 | 餘裕 |
|---|---|---|---|
| az1 | 14.74s | 25s | +10.26 |
| az2 | 23.09s | 45s | +21.91 |
| az3 | 15.36s | 40s | +24.64 |
| az4 | 19.42s | 30s | +10.58 |
| az5 | 28.20s | 32s | +3.80 |
| az6 | 4.46s | 15s | +10.54 |

總長 105.26s，Devpost 上限 180s。

az5 於 2026-08-31 改寫：原句「the same word does not mean the same thing in Chinese as
it does in English」在全英文錄影下沒有畫面佐證（錄影只餵英文語料），改成講語言分佈
數字 —— 那是首頁看得到的、也仍然是真的（線上實測 zh 1,217・en 98・ja 7）。
該格隨之從 25s 拉到 32s。

⚠ **25–70 秒錄完後再定各格秒數** —— 旁白只佔 105s／180s，餘裕充足。

## 念得對不對

三個駝峰字是 WebMCP Leverage 的證據，必須聽得清楚：
`feedDocument`、`reportDocument`、`submitFindings`。
念糊了改 `en*.txt` 的拼法騙 TTS（例如寫成 `feed Document`），不要換服務。
