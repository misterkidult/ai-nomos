# 餵食清單：日文語料 · 分散來源（2026-08-30）

`feed-list-ja.md` 那 29 篇全部來自 IBM Think 日文版 —— **同一個站擋起來就是 29 篇一起失敗**。這一份是備援與補強：AWS 與 Google Cloud 的日文詞彙頁，各自獨立。

同樣**沒有 seed**，要由 Kidult 貼給 agent（契約 §6）。

## 篩選方式（比上一批嚴）

上一批我用「假名數 >1500 且標題不是 Think Topics」篩，這批又抓到兩種新的假通過：

- **AWS 的 404 是日文的** —— `fine-tuning` 與 `hallucination` 兩篇，curl 跟隨轉址後回 200、頁面滿是假名（「エラー - 404 - 見つかりません」），只有改用會拋 HTTPError 的抓法才看得出是 404
- **Google Cloud 有兩篇是 JS 渲染的** —— 原始 HTML 只有 41 個假名，內容要跑 JS 才出來；agent 讀得到，但我無法事前確認定義句，所以不放進清單

⇒ 這 15 篇是**假名 4,579–15,153 個、標題正常、HTTP 真 200** 三項都過的。

## 待餵（15 篇，同一個詞可能有兩個來源 —— 兩篇都餵才看得出「同一語言圈內不同廠商怎麼講」）

| | 詞 | 來源 | 中 | 英 | 日 | 文章 |
|---|---|---|---|---|---|---|
| ☐ | **RAG** | AWS | 24 | 2 | 0 | https://aws.amazon.com/jp/what-is/retrieval-augmented-generation/ |
| ☐ | **LLM** | AWS | 42 | 1 | 0 | https://aws.amazon.com/jp/what-is/large-language-model/ |
| ☐ | **Generative AI** | AWS | 31 | 0 | 0 | https://aws.amazon.com/jp/what-is/generative-ai/ |
| ☐ | **Embedding** | AWS | 8 | 0 | 0 | https://aws.amazon.com/jp/what-is/embeddings-in-machine-learning/ |
| ☐ | **Vector Database** | AWS | 4 | 2 | 0 | https://aws.amazon.com/jp/what-is/vector-databases/ |
| ☐ | **Prompt Engineering** | AWS | 14 | 3 | 0 | https://aws.amazon.com/jp/what-is/prompt-engineering/ |
| ☐ | **Transformer** | AWS | 7 | 0 | 0 | https://aws.amazon.com/jp/what-is/transformers-in-artificial-intelligence/ |
| ☐ | **Agent** | AWS | 58 | 3 | 0 | https://aws.amazon.com/jp/what-is/ai-agents/ |
| ☐ | **Deep Learning** | AWS | 18 | 0 | 0 | https://aws.amazon.com/jp/what-is/deep-learning/ |
| ☐ | **Machine Learning** | AWS | 28 | 1 | 0 | https://aws.amazon.com/jp/what-is/machine-learning/ |
| ☐ | **RAG** | Google Cloud | 24 | 2 | 0 | https://cloud.google.com/use-cases/retrieval-augmented-generation?hl=ja |
| ☐ | **Agent** | Google Cloud | 58 | 3 | 0 | https://cloud.google.com/discover/what-are-ai-agents?hl=ja |
| ☐ | **Multimodal** | Google Cloud | 20 | 0 | 0 | https://cloud.google.com/use-cases/multimodal-ai?hl=ja |
| ☐ | **Prompt Engineering** | Google Cloud | 14 | 3 | 0 | https://cloud.google.com/discover/what-is-prompt-engineering?hl=ja |
| ☐ | **Machine Learning** | Google Cloud | 28 | 1 | 0 | https://cloud.google.com/learn/what-is-machine-learning?hl=ja |

## 三份日文來源怎麼分工

| 來源 | 篇數 | 特色 |
|---|---|---|
| IBM Think（`feed-list-ja.md`） | 29 | 覆蓋最廣，一詞一篇 |
| AWS | 10 | 雲端廠商視角，偏實作 |
| Google Cloud | 5 | 篇幅最長（假名 1 萬以上），偏概念 |

⚠ **先各餵一篇試水溫再繼續** —— 三個站的反爬行為不同，agent 用瀏覽器 session 讀，跟我用 curl 的結果未必一樣。
