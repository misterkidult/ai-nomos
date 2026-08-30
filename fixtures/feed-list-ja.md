# 餵食清單：日文語料（2026-08-30）

補雙語詞條的日文側。**沒有 seed** —— 這些一樣要由 Kidult 貼給 agent，讓它自己讀、自己判、自己送回（契約 §6）。

## 為什麼需要這一輪

`lang` 加了 `ja` 之後（契約 §4）現況是 **中文 1,217 / 英文 98 / 日文 7**，而那 7 筆分屬 7 個獨立詞、**沒有任何一個字典詞條有日文側**。三側切換與跨語言對照都因此看不到。

## 選文原則與實測

- 全部取 IBM Think 日文版（`/jp-ja/think/topics/`）—— 一詞一篇、第一段就是「〜とは」的定義句，形狀與英文那批一致
- ⚠ **不能只看 HTTP 200**：`tokens` 與 `ai-training` 回 200 但內容是空的「Think Topics」導覽頁（假名數 0）。這 29 篇是**用假名數 >1500 且標題不是 Think Topics 篩過的**，兩篇不合格的已換掉（token→tokenization、training→model-training）
- 抽驗過我的 `lang` 判定：這些頁面假名 2,817–9,357 個，一律判 `ja`，不會誤歸中文側

## 餵之前

第一次送出時看畫面：要出現「你的 AI 打開了這篇」＋日文標題，最後 log 要是 **stored** 不是 `mock`。

## 待餵（29 篇，依中英兩側筆數排序）

| | 詞 | 中 | 英 | 日 | 文章 |
|---|---|---|---|---|---|
| ☐ | **Agent** | 58 | 3 | 0 | https://www.ibm.com/jp-ja/think/topics/ai-agents |
| ☐ | **LLM** | 42 | 1 | 0 | https://www.ibm.com/jp-ja/think/topics/large-language-models |
| ☐ | **Token** | 39 | 1 | 0 | https://www.ibm.com/jp-ja/think/topics/tokenization |
| ☐ | **Hallucination** | 31 | 1 | 0 | https://www.ibm.com/jp-ja/think/topics/ai-hallucinations |
| ☐ | **Generative AI** | 31 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/generative-ai |
| ☐ | **Machine Learning** | 28 | 1 | 0 | https://www.ibm.com/jp-ja/think/topics/machine-learning |
| ☐ | **RAG** | 24 | 2 | 0 | https://www.ibm.com/jp-ja/think/topics/retrieval-augmented-generation |
| ☐ | **Context Window** | 21 | 3 | 0 | https://www.ibm.com/jp-ja/think/topics/context-window |
| ☐ | **Fine-tuning** | 20 | 2 | 0 | https://www.ibm.com/jp-ja/think/topics/fine-tuning |
| ☐ | **Multimodal** | 20 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/multimodal-ai |
| ☐ | **Deep Learning** | 18 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/deep-learning |
| ☐ | **Prompt Engineering** | 14 | 3 | 0 | https://www.ibm.com/jp-ja/think/topics/prompt-engineering |
| ☐ | **Model** | 17 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/ai-model |
| ☐ | **Training** | 15 | 2 | 0 | https://www.ibm.com/jp-ja/think/topics/model-training |
| ☐ | **MCP** | 16 | 1 | 0 | https://www.ibm.com/jp-ja/think/topics/model-context-protocol |
| ☐ | **Chain of Thought** | 11 | 1 | 0 | https://www.ibm.com/jp-ja/think/topics/chain-of-thoughts |
| ☐ | **Open Source Model** | 12 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/open-source-ai |
| ☐ | **Supervised Learning** | 11 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/supervised-learning |
| ☐ | **Reinforcement Learning** | 11 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/reinforcement-learning |
| ☐ | **Guardrail** | 8 | 3 | 0 | https://www.ibm.com/jp-ja/think/topics/ai-guardrails |
| ☐ | **Human in the Loop** | 10 | 1 | 0 | https://www.ibm.com/jp-ja/think/topics/human-in-the-loop |
| ☐ | **Unsupervised Learning** | 9 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/unsupervised-learning |
| ☐ | **RLHF** | 9 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/rlhf |
| ☐ | **Embedding** | 8 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/embedding |
| ☐ | **Transformer** | 7 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/transformer-model |
| ☐ | **AI Governance** | 7 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/ai-governance |
| ☐ | **Vector Database** | 4 | 2 | 0 | https://www.ibm.com/jp-ja/think/topics/vector-database |
| ☐ | **Explainable AI** | 6 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/explainable-ai |
| ☐ | **bias** | 0 | 0 | 0 | https://www.ibm.com/jp-ja/think/topics/ai-bias |

## 餵完之後

```bash
curl -s "https://ai-nomos.vercel.app/api/sightings?days=365" | python3 -c "
import json,sys
from collections import defaultdict
d=json.load(sys.stdin)['sightings']
g=defaultdict(lambda:{'zh':0,'en':0,'ja':0})
for s in d: g[s['term_key']][s.get('lang','zh')]+=1
three=[k for k,v in g.items() if sum(1 for x in v.values() if x)>=2]
print(f'兩種以上語料的詞：{len(three)}')"
```

跑之前是 9 個（都只有中英）。餵完這批，日文側才會出現在詞條頁的切換上。
