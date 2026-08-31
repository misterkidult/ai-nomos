# ai-nomos video narration — English (v1, 2026-08-31)

Rule basis: audio must cover "what you built and how you used WebMCP" (webmcp.devpost.com/rules).
Frame timings follow the original storyboard. Voice: Azure `en-US-GuyNeural`, region `eastasia`.

Subtitles: English. On-screen UI stays Chinese (zh build) — that is itself evidence of the Chinese-language corpus.

| Sec | Frame | Narration |
|---|---|---|
| 0–25 | Article full of jargon | Every article about AI hits you with words nobody defined. Some the author explains. Some they assume you already know. Some are just there to sell you something. You cannot tell which is which. |
| 25–70 | One sentence to the agent → dots spin → title surfaces | ai-nomos registers five tools through WebMCP. I hand the link to my agent. It calls feedDocument, takes the extraction rules, and reads the article using my own browser. The page never uploads anything. Then reportDocument sends back the title it read. The title appearing is proof the agent actually reached that page. |
| 70–110 | Report: 5 assumed terms + plain-language gloss | The terms it assumed you knew are now looked up for you. And the agent does not just find the words I asked for. It adds the ones I missed, and it rules that some words I asked for are not AI terms at all. That is its judgment, not mine. |
| 110–140 | Side-by-side definitions of one term | This article says MCP means one thing. Twelve other articles say something else. The dictionary never picks a winner. It lays out the evidence. Every definition must be a verbatim quote from the source. If the agent cannot produce one, the server rejects it. |
| 140–172 | Press "add to dictionary", counter ticks, the language split | The agent proposes. A person decides. submitFindings only answers pending review. It cannot write anything. Until I press this button, the dictionary has not changed. One thousand three hundred twenty two sightings, across three hundred forty two documents. Twelve hundred of them Chinese, ninety eight English, seven Japanese. The same word, three languages, not the same thing. |
| 165–180 | Home | Want to change the dictionary? Bring an article. |

## Timing

System-TTS measurement (Samantha, 2026-08-30): 80.4s total against a 180s storyboard — roughly 100s of headroom. Azure Guy will differ; re-measure after generating.

Per-frame (system TTS): 10.9 / 19.4 / 13.2 / 14.9 / 19.5 / 2.6

The headroom is not a problem to fix. The 25–70 frame needs real waiting time — the agent actually reading the page is the one thing in this video that cannot be faked. Decide the final cut only after that frame is recorded and its true duration is known.

## Watch for

Three camel-case tool names carry the WebMCP Leverage evidence and must be intelligible: `feedDocument`, `reportDocument`, `submitFindings`. If the voice slurs them, respell for the TTS (`feed Document`) rather than switching provider.

## Source

Chinese v2 with the same frame timings: `context/video-narration.md`
