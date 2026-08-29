# 餵食清單：英文語料（2026-08-29）

補雙語詞條的英文側。**沒有 seed** —— 這些連結一樣要由 Kidult 貼進 `/read`，讓 agent 自己讀、自己判、自己送回。腳本灌進去的不算（契約 §6，2026-08-29 裁示）。

## 為什麼需要這一輪

`lang` 上線後（契約 §4，依來源文章判定）現況是 **中文側 1216 筆 / 英文側 98 筆**。133 則詞條裡 **122 則的英文側不到 3 筆**，跨語言對照要兩側各 ≥3 筆才算得出來，所以目前只有 9 個詞看得到那一塊。

## 餵之前先確認一件事

第一次送出時看 `/read` 的 log：要出現 **stored**（不是 `mock`）。`mock` 代表沒進伺服器，那一輪白餵。

## 選文章的原則

- **一詞一篇、優先官方文件與百科型長文** —— 它們的第一段通常就是可引用的定義句
- 連結**全部實測過 HTTP 200**（2026-08-29，帶 UA），IBM Think 與 Claude Docs 兩批另外抽驗過頁面上真的有定義句
- ⚠ 這些是**候選不是保證**：agent 讀不到定義句時會回 `mentioned`，那不是壞掉，是那篇真的沒定義

## 待餵（30 篇，依中文側筆數排序 —— 越上面缺口越明顯）

| | 詞 | 中文側 | 英文側 | 文章 |
|---|---|---|---|---|
| ☐ | **LLM** | 42 | 1 | https://docs.claude.com/en/docs/about-claude/models/overview |
| ☐ | **Token** | 39 | 1 | https://docs.claude.com/en/docs/build-with-claude/token-counting |
| ☐ | **Hallucination** | 31 | 1 | https://www.ibm.com/think/topics/ai-hallucinations |
| ☐ | **Generative AI** | 30 | 0 | https://www.ibm.com/think/topics/generative-ai |
| ☐ | **Machine Learning** | 28 | 1 | https://www.ibm.com/think/topics/machine-learning |
| ☐ | **RAG** | 24 | 2 | https://www.ibm.com/think/topics/retrieval-augmented-generation |
| ☐ | **Context Window** | 21 | 3 | https://docs.claude.com/en/docs/build-with-claude/context-windows |
| ☐ | **Fine-tuning** | 20 | 2 | https://www.ibm.com/think/topics/fine-tuning |
| ☐ | **Multimodal** | 20 | 0 | https://www.ibm.com/think/topics/multimodal-ai |
| ☐ | **Deep Learning** | 18 | 0 | https://www.ibm.com/think/topics/deep-learning |
| ☐ | **Model** | 17 | 0 | https://www.ibm.com/think/topics/ai-model |
| ☐ | **MCP** | 16 | 1 | https://modelcontextprotocol.io/introduction |
| ☐ | **Claude Code** | 15 | 2 | https://docs.claude.com/en/docs/claude-code/overview |
| ☐ | **Training** | 15 | 2 | https://www.ibm.com/think/topics/ai-model-training |
| ☐ | **Prompt Engineering** | 14 | 3 | https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview |
| ☐ | **No-code / Low-code** | 13 | 0 | https://www.ibm.com/think/topics/no-code |
| ☐ | **Open Source Model** | 12 | 0 | https://www.ibm.com/think/topics/open-source-ai |
| ☐ | **Chain of Thought** | 11 | 1 | https://www.ibm.com/think/topics/chain-of-thoughts |
| ☐ | **Supervised Learning** | 11 | 0 | https://www.ibm.com/think/topics/supervised-learning |
| ☐ | **Reinforcement Learning** | 11 | 0 | https://www.ibm.com/think/topics/reinforcement-learning |
| ☐ | **Human in the Loop** | 10 | 1 | https://www.ibm.com/think/topics/human-in-the-loop |
| ☐ | **Vibe coding** | 10 | 1 | https://simonwillison.net/2025/Mar/19/vibe-coding/ |
| ☐ | **Skill** | 10 | 2 | https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview |
| ☐ | **Unsupervised Learning** | 9 | 0 | https://www.ibm.com/think/topics/unsupervised-learning |
| ☐ | **RLHF** | 9 | 0 | https://www.ibm.com/think/topics/rlhf |
| ☐ | **Memory** | 9 | 1 | https://docs.claude.com/en/docs/build-with-claude/context-editing |
| ☐ | **POC** | 9 | 0 | https://www.ibm.com/think/topics/proof-of-concept |
| ☐ | **Guardrail** | 8 | 3 | https://www.ibm.com/think/topics/ai-guardrails |
| ☐ | **Transformer** | 7 | 0 | https://www.ibm.com/think/topics/transformer-model |
| ☐ | **SubAgent** | 6 | 2 | https://docs.claude.com/en/docs/claude-code/sub-agents |

## 餵完之後

跑一次確認英文側有沒有到 3 筆：

```bash
curl -s "https://ai-nomos.vercel.app/api/sightings?days=365" | python3 -c "
import json,sys
from collections import defaultdict
d=json.load(sys.stdin)['sightings']
g=defaultdict(lambda:{'zh':0,'en':0})
for s in d: g[s['term_key']][s.get('lang','zh')]+=1
both=[k for k,v in g.items() if v['zh']>=3 and v['en']>=3]
print(f'兩側都 ≥3 筆的詞：{len(both)}')"
```

跑之前是 9 個。
