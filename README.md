# ai-nomos

> nomos（νόμος）：約定成俗。柏拉圖《克拉底魯篇》問名字是天生的還是約定的；這裡站在約定那邊 —— **AI 的詞，由大家怎麼用決定。**

丟一篇文章的連結進來、寫下想撈的詞，字典自己長大。人與 agent 在同一頁共讀：人給連結與詞，agent 自己去讀那篇 —— 找人指定的詞、判斷它是不是 AI 詞、補上人沒列的 —— 字典累積「目擊紀錄」（每則附來源），定義從用法歸納，爭議不裁判、並列呈現。

- 詞條本體：[ai-dictionary](https://github.com/kidult/ai-dictionary)（133 則白話詞條，靜態）
- 本 repo：字典本體（`/`＋`/term/{slug}`）＋`/read` 頁＋WebMCP 工具＋目擊資料層。**首頁是字典，WebMCP 是它長大的方式。**OpenAI WebMCP Challenge 參賽作品（2026-08-27 起）
- 計畫與審查：`context/`

## 結構

```
public/      靜態頁：index.html（字典首頁）、term.html（/term/{slug} 詞條頁）、read.html（/read 拿文章來）、probe.html（探針）、nomos.js／nomos.css（共用）、vendor 的 lexicon.json
scripts/     sync-lexicon.sh：從字典 repo 產薄索引複製進 public/；check-findings.py：三條鎖參考實作
api/         Vercel Functions（目擊寫入、lexicon 代理）
fixtures/    抓詞實驗的 48 筆與規則草稿，兼回歸測試
context/     contract.md（資料契約 v1，英文）、計畫 v2、產品簡報、Matt／Addy 審查
```

## 原則

1. 想改字典，拿證據不講意見 —— 唯一的寫入路徑是提交一筆目擊、而且要人按過確認才寫；沒有編輯後門，詞條不能用手打出來。字典開張時那 1,314 筆用同一套規則抽、過同一組鎖，但走的是匯入腳本不是工具路徑（契約 §6）
2. 只走 WebMCP，文章不經過伺服器 —— agent 自己讀連結
3. agent 不照單全收 —— 人指定的詞它會判斷，它看到的詞它會補
4. 沒有 agent 時頁面退化成貼文字本地比對，人單獨用也成立
5. 每則目擊都有來源連結，沒來源的只是引文
