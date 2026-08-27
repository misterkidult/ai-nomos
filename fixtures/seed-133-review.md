# seed-133 待 Kidult 勾選（2026-08-27）

來源：7 個 subagent 各跑 19 則，每則 web search 一篇有定義句的公開文章。鎖＝`scripts/check-findings.py`（契約 §3，不含伺服器端 PII）。

- 通過鎖：**127** 筆 → `fixtures/seed-133.json`
- 被鎖擋：**0** 筆（下列，未寫入）
- 找不到定義句：**6** 則
- 字典 133 則中未被覆蓋：**6** 則

## 找不到定義句（勾 ☐ 表示放掉，這些詞暫無 seed 目擊）

- ☐ **Division of Labor**：搜到的文章只講「人機協作」或把「人機分工」當時代標籤用，沒有一句直接定義它；bnext 與 techorange 頁面亦抓不到（試過：人機分工 定義 是指 AI 人類 分工；"人機分工" 是指 人類負責 AI 負責 判斷）
- ☐ **Domain Skill**：文章定義的是 Agent Skills／Skill 本身，沒有任何一頁用「domain skill」這個詞下定義（試過："domain skill" Claude skills domain knowledge definition；"domain skills are" AI agent skills domain expertise packaged；"domain skill" OR "domain skills" Claude skills article；"領域技能" AI Agent Skill 專業知識 是指）
- ☐ **Independent Review**：找得到的定義句（Wikipedia Independent reviewer、yegor256）都超過 120 字元；nhimg 術語表 403 抓不到；其餘文章只談目的不下定義（試過：independent review definition software verification "independent review is"；"independent review" software OR code "is a" review by someone not involved definition）
- ☐ **Liability**：rework、regulations.ai、aisecurityandsafety 都有定義句但長度 151–216 字元超過 120；中文文章只問「誰負責」不下定義（試過：AI 責任歸屬 liability 是指 AI 出錯 誰負責；"AI liability" glossary "AI liability is" definition；AI 責任歸屬 是指 定義 術語 AI 出錯 法律責任）
- ☐ **Source of Truth**：繁中文章（tecky.io）含該詞的句子本身不是定義句；中英維基定義句均超過 120 字；TechTarget／IBM／Dropbox 頁面擋爬蟲取不到內文（試過：Single Source of Truth 唯一真實來源 是什麼；"Single Source of Truth" 是指 單一真實來源 資料 概念 台灣）
- ☐ **多版本挑選**：編輯自創用語，公開文章只寫「請 AI 一次給你 3 種版本」之類的作法描述，沒有任何一篇用這個詞並下定義（試過：AI 一次生成三個版本 用挑的 不要用改的 多版本 prompt 技巧；"多版本挑選" OR "用挑的不用改的" OR "一次生三版" AI 生成）

## 未覆蓋的字典詞（對照用）

Division of Labor、Domain Skill、Independent Review、Liability、Source of Truth、多版本挑選

## 機械掃描

- term_normalized 對不到字典：0
- 疑似簡體字元：0（引文照抄原文；若來源本身是簡體，由 Kidult 決定是否換文章）