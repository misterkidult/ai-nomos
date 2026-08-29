---
name: nomos-loop
description: 跑 ai-nomos 程式面迴圈的一輪：從 context/loop-spec.md 挑下一項沒被擋住的 W，先寫退出條件、再寫程式，用 npm run verify 判定，綠了才 commit。MANDATORY TRIGGERS：跑一輪迴圈, 迴圈, loop, 繼續寫程式, 下一項, W1, W2, W3, 把程式寫完。搭配 /loop 使用可連續跑；單獨呼叫則只跑一輪。
---

# ai-nomos 程式迴圈（一輪）

規格在 `context/loop-spec.md`，那份是這個迴圈的唯一待辦來源。這份 skill 是**一輪**：discover → plan → execute → verify → 記錄。跑完就停，把結果講清楚。

`/loop /nomos-loop` 會重複叫這一輪；你不需要自己迴圈，也不要在一輪裡做兩項 W。

## 0 · 前置

```bash
git branch --show-current      # 必須在 claude/ 開頭的開發分支，不是 main
npm run verify                 # 建立綠色基線
```

基線就是紅的 → **不要開始新的 W**。先修到綠，那本身就是這一輪的工作。

## 1 · discover

讀 `context/loop-spec.md` 的「待辦」。每一項有三種狀態：

- **可做** —— 沒有 ⚠、沒有未解的相依
- **擋住** —— 標了 ⚠（owner 不是我們／等 Kidult 裁示）或相依項還沒完成
- **完成** —— 已從待辦移到「已完成」

順帶看 `git log --oneline -5`，確認上一輪留下的狀態跟 spec 說的一致。不一致就先對齊 spec，別在錯的基礎上疊。

## 2 · plan

挑**第一個可做的 W**。不要跳號、不要挑好做的。

全部都擋住 → **停**。報告哪幾項被什麼擋住、需要誰裁示什麼，然後結束這一輪。不要自己發明工作填滿時間，也不要自己解除別人的 ⚠。

挑好之後，把那一項的「退出條件」抄出來，逐句確認它是不是機器可判的。如果它其實不可判（含「看起來合理」「大致正確」這種字眼），這一輪的工作就是**先把它改寫成可判的**，改完就停，讓下一輪執行。

## 3 · execute

順序不可顛倒：

1. **先寫 verify 裡的斷言**（`scripts/verify.mjs`），跑一次，確認它**紅**。紅不起來的斷言等於沒有斷言。
2. 再寫讓它變綠的程式。
3. 只做這一項退出條件要求的事。順手看到的別的問題 → 寫進 `loop-spec.md` 的待辦，不要順手改。

契約有異動需求時 → **停**，寫進「開放問題」，報告給人。不要自己改 `context/contract.md`。

## 4 · verify

```bash
npm run verify
```

- **綠** → 進第 5 步。
- **紅，而且原因是程式** → 修程式，重跑。
- **紅，而且你想改 fixture 或斷言讓它變綠** → **停**。期望值是意圖，程式錯就改程式。真心認為期望值本身寫錯了，把理由寫進報告交給人判，不要自己改。
- **同一個原因連紅兩輪** → 停，報告卡在哪，不要第三次嘗試。

## 5 · 記錄

```bash
git add -A && git commit    # 訊息說「改了什麼、為什麼」，不是「完成 W3」
git push -u origin <目前分支>
```

然後更新 `context/loop-spec.md`：把完成的 W 移到「這輪抓到並修掉的」、補上新發現的待辦或開放問題。**spec 沒更新等於這一輪沒發生** —— 下一輪讀的是 spec，不是你的記憶。

## 6 · 報告

三行以內：這輪做了哪一項、verify 從幾綠幾紅變成幾綠幾紅、下一項是什麼或卡在誰身上。

## 護欄

這些是「never」，`/loop` 連續跑時尤其：

- 不放寬 `fixtures/locks-regression.json` 的期望值來讓 verify 變綠
- 不改 `context/contract.md`，除非人明確要求且 commit 訊息以 `contract:` 開頭
- 不動 W4（replay 入庫）—— 不可逆，只能人來按
- 不解除別人的 ⚠：`api/*` ＋ storage 的 owner 是 Matt
- 不重新連接 Vercel 的 GitHub、不手改 `public/lexicon.json`、不回寫 `ai-dictionary` 的 `terms/`、沒有 seed
- 不部署。`vercel deploy` 是人的動作
