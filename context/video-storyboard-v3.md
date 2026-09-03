# 影片分鏡 v3（2026-09-01）

**改寫理由**：v2 的旁白在唸規格（「註冊了五個工具」「submitFindings 回 pending_review」），
那是講給評審聽的技術清單。這一版改成講「你可以叫你的 AI 去玩這本字典」——
描述這件事本身就在描述 WebMCP 的功能，不需要另外唸工具名來證明。

技術證據由**畫面**承擔：分屏左邊的工具呼叫是真的，評審看得見。

---

## 一句話定位

> 這是一本字典，但你不能自己編輯它 —— 你得叫你的 AI 去。

---

## 六格

| # | 秒 | 畫面 | 旁白（中文） | 旁白（英文） |
|---|---|---|---|---|
| 1 | 0–16 | Willison 那篇滿是術語的文章慢捲 | 讀 AI 的文章，最煩的是那些沒人解釋的詞。你去問 AI，它跟你講了，然後就沒了 —— 下一個人看到同一篇，還是要再問一次。 | Reading about AI, the worst part is the words nobody explains. You ask your AI, it tells you, and then it's gone. The next person reads the same article and asks the same question. |
| 2 | 16–46 | **分屏**：左 agent、右網頁。使用者打一句話 → 圓點轉 → 標題浮出 | 這個網站沒有輸入框。你不打字，你叫你的 AI 去。丟一個連結給它，它自己去讀那篇文章 —— 用你的瀏覽器，不是我們的伺服器。 | This site has no input box. You don't type — you send your AI. Hand it a link and it goes and reads the article itself, in your browser, not on our server. |
| 3 | 46–68 | **分屏**：報告出來，badge 一個個亮 | 它讀完了。你點名的詞它找了，你沒想到的詞它也撈回來 —— 還會回你一句：這個不算 AI 術語。 | It's done. It found the words you named, brought back ones you didn't, and told you one of yours isn't an AI term at all. |
| 4 | 68–92 | 詞條頁：十一種說法並排 | 那 MCP 到底是什麼意思？十一篇文章，十一種講法。這本字典不挑哪個對 —— 它把十一種都攤給你看。 | So what does MCP actually mean? Eleven articles, eleven answers. This dictionary doesn't pick one. It shows you all eleven. |
| 5 | 92–120 | **分屏**：按下收進字典、數字跳動 | 要不要收進字典，你按。AI 提議，人決定 —— 它自己寫不進去。按下去，一千三百多筆目擊多了一筆，下一個查這個詞的人就看得到。 | Whether it goes in is your call. The AI proposes, a person decides — it cannot write anything itself. Press it, and one more sighting joins thirteen hundred others. The next person who looks this word up will see it. |
| 6 | 120–132 | 首頁收場 | 想改字典？帶一篇文章來。 | Want to change the dictionary? Bring an article. |

**總長約 132 秒**（上限 180）。

---

## 這一版動了什麼

| 格 | v2 講的 | v3 改成 |
|---|---|---|
| 1 | 「12 個術語，哪些有解釋」——分類學 | 「你問過的答案就消失了」——**共鳴點** |
| 2 | 「註冊五個工具、feedDocument 交規則」 | 「**這裡沒有輸入框，你叫你的 AI 去**」 |
| 3 | 「agent 會加詞、會判定不是 AI 術語」 | 同一件事，但講成**它回嘴**了 |
| 4 | 「每句定義必須逐字引用，湊不出來就退掉」 | 「**十一篇十一種講法，全攤給你看**」 |
| 5 | 「submitFindings 只回 pending_review」 | 「**它自己寫不進去，按下去下一個人就看得到**」 |
| 6 | 同 | 不動 |

**技術詞從旁白裡拿掉的有**：WebMCP、feedDocument、reportDocument、submitFindings、
pending_review、逐字引用鎖。**它們全部還在畫面上** —— 分屏左邊那三次工具呼叫是真的，
工具名清清楚楚。

---

## 為什麼這樣仍然滿足 Devpost

規則要求 audio cover "what you built and **how you used WebMCP**"。

- **what you built**：格 1 說問題、格 4 說這本字典的反常識（不給答案給證據）
- **how you used WebMCP**：格 2 那句「這個網站沒有輸入框，你叫你的 AI 去，
  它用你的瀏覽器讀文章」——**這就是 WebMCP 的功能描述**，只是用人話講。
  格 5 補上「AI 寫不進去，人按了才算」，那是這個實作最特別的設計決定

評分第一項 WebMCP Leverage 看的是**實作的徹底程度**，不是旁白唸了幾個 API 名字。
畫面上三次真實的工具往返，比唸五個工具名更能證明。

---

## 要重做的東西

- [ ] 中英旁白稿各六段（`scripts/video/zh*.txt`／`en*.txt` 覆寫）
- [ ] 重配音（`uv run azure_vo.py` / `azure_vo.py zh`）
- [ ] 分鏡秒數改成 `FRAMES = [16, 30, 22, 24, 28, 12]`
- [ ] 畫面**不用重錄**——六格素材沿用，只是各格裁切長度會變

---

## ⚠ 待你確認

1. **格 1 的鉤子**：「你問過的答案就消失了」——這是我推的痛點，不是你講過的。
   如果你覺得真正的痛點是別的（例如「每篇文章對同一個詞的講法都不一樣」），格 1 要重寫
2. **格 5 的數字**：唸「一千三百多筆」不唸精確值，比較口語但少了具體感。要精確的話改回「一千三百二十五筆」
3. **英文版要不要跟著改**——現在英文版是技術向的 v2。兩支統一走 v3 比較一致，
   但英文版是送件用的，改動風險由你判斷
