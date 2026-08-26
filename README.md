# ai-nomos

> nomos（νόμος）：約定成俗。柏拉圖《克拉底魯篇》問名字是天生的還是約定的；這裡站在約定那邊 —— **AI 的詞，由大家怎麼用決定。**

把文件丟進來，字典自己長大。人與 agent 在同一頁共讀：人貼文件，agent 找出裡面的 AI 名詞與它們被怎麼用，字典累積「目擊紀錄」，定義從用法歸納，爭議不裁判、並列呈現。

- 詞條本體：[ai-dictionary](https://github.com/kidult/ai-dictionary)（133 則白話詞條，靜態）
- 本 repo：`/read` 頁＋WebMCP 工具＋目擊資料層。OpenAI WebMCP Challenge 參賽作品（2026-08-27 起）
- 計畫與審查：`context/`

## 結構

```
public/      靜態頁（read.html、探針 probe.html）
api/         Vercel Functions（目擊寫入、lexicon 代理）
fixtures/    抓詞實驗的 48 筆與規則草稿，兼回歸測試
context/     計畫 v2、產品簡報、Matt／Addy 審查
```

## 原則

1. 想改字典，拿證據不講意見 —— 唯一的編輯動作是提交一筆目擊
2. 只走 WebMCP，文件不上傳
3. 沒有 agent 時頁面退化成本地比對，人單獨用也成立
