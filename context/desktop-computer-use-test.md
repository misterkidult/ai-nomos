# Desktop app computer use 測試單（2026-08-31）

> 給 Kidult 在 **Claude Desktop app** 執行。目的：確認 computer use 能不能拿來錄影片 25–70 秒那格。
> 這不是「試試看能不能動」，是**回答四個具體問題**，每題都有明確的通過條件。
> 全部跑完約 15 分鐘。**這一輪不錄影**，只判斷可行性。

## 為什麼要測

25–70 秒那格拍的是「一個真的 agent 讀了 WebMCP 工具描述、自己決定呼叫 `feedDocument` → `reportDocument`」。
VSCode 擴充的 Claude 是**非互動 session**，官方明文不提供 computer use（見文末來源），所以只能換環境。

Desktop app 支援 computer use，但**有三件事沒人實測過**，全都會決定畫面能不能用：

1. Claude 控制螢幕時，自己的 UI 或系統通知會不會入鏡
2. ChatGPT 桌面版被列在哪個權限層級（full control 才能打字）
3. 未核可的 app 被隱藏時，畫面會不會閃動或留下痕跡

**測不出來也是結果** —— 任何一題失敗就走人工錄（約兩分鐘），不要為此換第三種方法。

---

## 前置

| 項目 | 動作 |
|---|---|
| 開啟 computer use | Desktop app → **Settings → General → Desktop app** 底下的開關 |
| macOS 權限 | 第一次會跳 **Accessibility** ＋ **Screen Recording** 兩個對話框，兩個都給。給完 Screen Recording 可能要重開 Desktop app |
| ⚠ 關掉其他 Claude session | computer use 是**整台機器一把鎖**，且鎖到 session 結束才放。**終端機的 `claude`、其他 Desktop 視窗全部關掉**，只留這一個 |
| ChatGPT 桌面版 | 先手動開好、登入、切到 **Work 模式 ＋ GPT-5.6 Terra**。⚠ 先在 Settings › Browser › Permissions 開「Enable site tools」 |

---

## 測試 1：computer use 到底能不能啟動

**做什麼**：對 Desktop app 說

```
幫我截一張現在螢幕的圖，然後告訴我畫面上有哪些 app 開著。
```

**看什麼**

- [ ] 跳出「Claude 想控制哪些 app」的核可對話框 → 選 **Allow for this session**
- [ ] 真的回傳一張截圖
- [ ] macOS 右上角出現「Claude is using your computer · press Esc to stop」通知

**通過條件**：三項都發生。

**沒過怎麼辦**：若根本沒跳核可框、也沒截圖 → computer use 沒啟用成功，回頭檢查 Settings 開關與兩個 macOS 權限。
**這題沒過就整個停下來**，後面三題都不用測，直接走人工錄。

---

## 測試 2：畫面乾不乾淨（這題最關鍵）

這題決定「能不能拿來錄影片」。上一題那張截圖就是證據，**仔細看它**。

**看什麼**

- [ ] 「Claude is using your computer」那則**系統通知有沒有入鏡**
- [ ] Claude Desktop app 自己的視窗有沒有入鏡
- [ ] 選單列（menu bar）有沒有多出什麼圖示
- [ ] 其他 app 被隱藏後，桌布或桌面圖示有沒有露出來

**通過條件**：截圖裡**只有 ChatGPT 桌面版與 ai-nomos 頁面**，沒有 Claude 的任何 UI、沒有那則通知。

⚠ **注意這裡有一個陷阱**：文件寫「終端機視窗被排除在截圖外」，講的是 **Claude 自己看到的截圖**。
我們要錄的是 **ffmpeg 錄整個螢幕**，那是另一回事 —— Claude 看不到的東西，ffmpeg 照樣錄得到。
所以這題**不能只看 Claude 回傳的截圖**，要**另外用 ffmpeg 錄一段**才算數：

```bash
# 在終端機跑（⚠ 但終端機不能開 claude，只跑這行）
ffmpeg -f avfoundation -framerate 30 -i "Capture screen 0" -t 20 \
  /private/tmp/claude-503/-Users-kidult-GitHub-ai-nomos/7b3859cf-7132-4645-a3e4-f08387610f73/scratchpad/cu-test.mp4
```

錄的 20 秒內讓 Desktop app 做點事（例如再截一次圖），錄完打開 `cu-test.mp4` 看畫面。

**沒過怎麼辦**：若通知會入鏡 → 先試 macOS 勿擾模式能不能擋掉那則通知；擋不掉就走人工錄。

---

## 測試 3：ChatGPT 桌面版能不能被打字

官方把 app 分權限層級，**終端機與 IDE 只能點擊不能打字**（click-only），瀏覽器與交易平台是唯讀。
ChatGPT 桌面版不在文件列出的警告表上，**推測是 full control，但沒實測過**。

**做什麼**：對 Desktop app 說

```
把 ChatGPT 桌面版帶到前景，在對話框裡打「測試 123」，先不要送出。
```

**看什麼**

- [ ] ChatGPT 桌面版真的被帶到前景
- [ ] 對話框裡**真的出現「測試 123」這幾個字**
- [ ] 核可對話框裡 ChatGPT 有沒有被標警告（「Equivalent to shell access」那類）

**通過條件**：字真的打進去了。

**沒過怎麼辦**：若 Claude 說「這個 app 只能點擊不能輸入」→ ChatGPT 被歸在 click-only 層。
那自動化就沒意義（打不了字就送不出那句話），走人工錄。

---

## 測試 4：全流程能不能跑完

前三題都過才做這題。這是**完整的排練**，跟正式錄影只差沒開錄影。

**做什麼**：對 Desktop app 說

```
在 ChatGPT 桌面版裡，開一個新對話，貼上這段話並送出：

讀 https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ 這篇，
用 https://ai-nomos.vercel.app/read 的 feedDocument 找出裡面的 AI 術語。

送出後不要再操作，讓它自己跑完。
```

⚠ **`/read` 頁面要先開好**（在 ChatGPT 桌面版的瀏覽器分頁裡），工具才註冊得上。
不確定有沒有註冊成功，先開 https://ai-nomos.vercel.app/probe 對 agent 說「呼叫 ping 工具」，
回 `pong` 就代表這個瀏覽器的 agent 叫得到頁面工具。

**看什麼**

- [ ] 那句話真的被送出
- [ ] agent 呼叫了 `feedDocument`（`/read` 頁面的圓點開始轉）
- [ ] agent 呼叫了 `reportDocument`（**文章標題浮出來** —— 這是那格唯一要拍的東西）
- [ ] agent 呼叫了 `submitFindings`（轉圈停止、詞條列出來）
- [ ] **從送出到標題浮出，花了幾秒**：______ 秒（記下來，這個數字決定那格要留多長）

**通過條件**：三個工具照順序被呼叫，標題有浮出來。

**沒過怎麼辦**：若跳過 `reportDocument`（標題不浮出）→ 那格沒東西可拍。
先確認 ChatGPT 用的是 GPT-5.6 Terra 而非 Luna（Luna 不支援 site tools），再重試一次。
兩次都跳過就走人工錄，錄的時候人為多等一下讓畫面有東西。

---

## 回報格式

跑完貼這張表回來就好，不用寫過程：

| 測試 | 結果 | 備註 |
|---|---|---|
| 1 啟動 | 過／沒過 | |
| 2 畫面乾淨 | 過／沒過 | 有沒有東西入鏡： |
| 3 能打字 | 過／沒過 | ChatGPT 權限層級： |
| 4 全流程 | 過／沒過 | 送出到標題浮出： __ 秒 |

**四題全過** → 25–70 秒用 Desktop app 自動錄
**任一題沒過** → 人工錄那格（約兩分鐘），其餘五格我這邊代錄

---

## 這份測試看不到什麼

誠實講三個這張單子驗不到的東西：

1. **錄影品質**：測的是「畫面乾不乾淨」，不是「錄出來好不好看」。滑鼠移動軌跡會不會很機械、
   打字速度是不是不自然 —— 這些只有真的錄一段看才知道
2. **穩定性**：跑一次成功不代表跑五次都成功。agent 呼叫工具的順序本來就有隨機性
3. **鎖的實際行為**：文件說鎖到 session 結束才放，但「Desktop app 的 session 什麼時候算結束」
   沒寫清楚（關視窗？完全退出？）。若測完想換回終端機用，可能得先完全退出 Desktop app

## 來源

- computer use 官方文件（含 Desktop 與 CLI 差異表、權限層級、鎖行為）：
  https://code.claude.com/docs/en/computer-use
- 相關 issue（Closed，症狀是互動 session 看不到 server，與本案不同）：
  https://github.com/anthropics/claude-code/issues/46659
