#!/usr/bin/env node
/* 錄「分屏」的三格 —— 有工具呼叫的那三格（25–70 / 70–110 / 140–172）。
 *
 * 左 480px：agent 端（/agent-view）—— 使用者輸入的那句話 ＋ 工具呼叫的實際往返
 * 右 1120px：ai-nomos 這一頁（面板隱藏，因為左邊已經在顯示了）
 * 兩支各自錄，最後用 ffmpeg hstack 併成 1600×900。
 *
 * ⚠ 兩邊靠 BroadcastChannel 同步，所以必須是同一個 browser context 的兩個分頁。
 * ⚠ agent 端不編造 agent 的話：顯示的只有使用者實際輸入的那句、以及
 *   execute() 實際收到／實際回傳的值。agent 不對頁面說話，它只呼叫工具。
 *
 * 用法：node scripts/video/record-split.mjs [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = process.argv[2] || 'video-out';
mkdirSync(OUT, { recursive: true });

const SITE = 'https://ai-nomos.vercel.app/?lang=en&rec=1';
const AGENT = 'https://ai-nomos.vercel.app/agent-view';
const LW = 480, RW = 1120, H = 900;

const ARTICLE = 'https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/';
const ASK = `Read ${ARTICLE} and use ai-nomos's feedDocument to find the AI jargon in it.`;
const DOC = { title: 'The lethal trifecta for AI agents', byline: 'Simon Willison',
              published: '2025-06-16', words: 1622,
              gist: 'Three capabilities that are dangerous when combined.' };
const S = { url: ARTICLE, title: DOC.title, published: DOC.published };

/* definition_quote 必須逐字出現在 context 裡，否則被 QUOTE_NOT_IN_CONTEXT 擋下。
   那條鎖是真的，這裡不繞過它。 */
const FINDINGS = [
  { term_raw: 'prompt injection', term_normalized: 'Prompt Injection',
    sentence: 'Prompt injection is when untrusted content reaches the model and changes what it does.',
    context: 'The risk is structural. Prompt injection is when untrusted content reaches the model and changes what it does. No amount of prompting fixes it.',
    explained: 'has_definition', intent: 'technical', domain: 'core', requested: true,
    definition_quote: 'Prompt injection is when untrusted content reaches the model and changes what it does.', source: S },
  { term_raw: 'MCP', term_normalized: 'MCP',
    sentence: 'MCP lets an agent reach tools it was never built to know about.',
    context: 'Everyone is shipping servers now. MCP lets an agent reach tools it was never built to know about. That is the whole point, and the whole risk.',
    explained: 'has_definition', intent: 'technical', domain: 'core', requested: true,
    definition_quote: 'MCP lets an agent reach tools it was never built to know about.', source: S },
  /* agent 自己補的詞（requested:false）—— 旁白 70–110 秒講的就是這件事 */
  { term_raw: 'exfiltration', term_normalized: '',
    sentence: 'Exfiltration is the step where your private data leaves the building.',
    context: 'Reading is not the danger. Exfiltration is the step where your private data leaves the building. That is what external communication buys the attacker.',
    explained: 'has_definition', intent: 'risk_or_limit', domain: 'core', requested: false,
    definition_quote: 'Exfiltration is the step where your private data leaves the building.', source: S },
];
const NOT_FOUND = ['Explainable AI'];

const browser = await chromium.launch({ headless: false });

async function split(name, fn) {
  /* ⚠ 不用 deviceScaleFactor —— recordVideo.size 是固定的，兩個分頁 viewport 不同寬時
     Playwright 會把畫面等比縮進那個框裡、旁邊補灰邊。改成一個 context 一個寬度，
     錄影尺寸＝viewport 尺寸，兩支各自原尺寸錄好再 hstack。 */
  const ctxA = await browser.newContext({ viewport: { width: LW, height: H },
    recordVideo: { dir: OUT, size: { width: LW, height: H } }, locale: 'en-US' });
  const ctxS = await browser.newContext({ viewport: { width: RW, height: H },
    recordVideo: { dir: OUT, size: { width: RW, height: H } }, locale: 'en-US' });
  const agent = await ctxA.newPage();
  const site  = await ctxS.newPage();

  /* domcontentloaded：不等 Google Fonts 之類的外部資源，那會讓 load 卡住 */
  await agent.goto(AGENT, { waitUntil: 'domcontentloaded' });
  await site.goto(SITE, { waitUntil: 'domcontentloaded' });
  await site.waitForFunction(() => { try { return typeof TOOLS !== 'undefined' && typeof traceTool === 'function'; } catch(e){ return false; } }, { timeout: 20000 });
  await site.waitForTimeout(1300);
  /* 面板隱藏 —— agent 端已在左邊顯示，兩處重複 */
  await site.evaluate(() => { CALLS_HIDDEN = true; renderCalls(); });
  await site.evaluate(() => {
    window.__reg = [];
    TOOLS.forEach(traceTool); TOOLS.forEach(t => window.__reg.push(t));
    /* 呼叫時把事件收進 __ev，腳本輪詢後推給 agent 頁（兩個 context，
       BroadcastChannel 不通）。__ev 收的是 traceTool 已經算好的真實值。 */
    window.__ev = [];
    const ch = new BroadcastChannel('ai-nomos-agent');
    const orig = ch.postMessage.bind(ch);
    BroadcastChannel.prototype.postMessage = function(m){ window.__ev.push(m); return orig(m); };
    window.__call = (n, a) => window.__reg.find(t => t.name === n).execute(a || {});
  });

  /* 每 120ms 把主頁攢下的事件搬到 agent 頁 */
  const pump = setInterval(async () => {
    try {
      const evs = await site.evaluate(() => { const e = window.__ev; window.__ev = []; return e; });
      for (const m of evs) await agent.evaluate(x => window.__push(x), m);
    } catch(e) {}
  }, 120);

  const t0 = Date.now();
  try { await fn({ agent, site }); }
  finally {
    await new Promise(r => setTimeout(r, 400));   /* 讓最後一批事件送完 */
    clearInterval(pump);
    const va = agent.video(), vs = site.video();
    await ctxA.close(); await ctxS.close();
    renameSync(await va.path(), join(OUT, `${name}-L.webm`));
    renameSync(await vs.path(), join(OUT, `${name}-R.webm`));
    console.log(`  ✓ ${name}  ${((Date.now()-t0)/1000).toFixed(1)}s`);
  }
}

console.log(`錄分屏到 ${OUT}/ · 左 ${LW} + 右 ${RW} = 1600×${H}\n`);

/* ── 25–70s：使用者說一句話 → agent 呼叫工具 → 標題浮出 ── */
await split('f2-PLACEHOLDER-agent', async ({ agent, site }) => {
  await site.waitForTimeout(1800);
  await agent.evaluate(t => window.__push({ type:'ask', text:t }), ASK);
  await agent.waitForTimeout(5200);                 /* 逐字打完 */
  await site.evaluate(async u => { await window.__call('feedDocument', { url:u, requested_terms:['MCP','prompt injection','Explainable AI'] }); }, ARTICLE);
  await agent.waitForTimeout(13000);                /* agent 讀文章的等待 */
  await site.evaluate(async d => { await window.__call('reportDocument', d); }, DOC);
  await agent.waitForTimeout(8000);
});

/* ── 70–110s：報告 —— 它點名的詞、它自己補的詞、它判定不在文章裡的詞 ── */
await split('f3-report', async ({ agent, site }) => {
  await agent.evaluate(t => window.__push({ type:'ask', text:t }), ASK);
  await agent.waitForTimeout(2200);
  await site.evaluate(async u => { await window.__call('feedDocument', { url:u, requested_terms:['MCP','prompt injection','Explainable AI'] }); }, ARTICLE);
  await agent.waitForTimeout(2200);
  await site.evaluate(async d => { await window.__call('reportDocument', d); }, DOC);
  await agent.waitForTimeout(2000);
  await site.evaluate(async ([f, nf]) => { await window.__call('submitFindings', { findings:f, not_found:nf }); }, [FINDINGS, NOT_FOUND]);
  await agent.waitForTimeout(1800);
  await site.evaluate(() => document.getElementById('found')?.scrollIntoView({ block:'center', behavior:'smooth' }));
  await agent.waitForTimeout(8000);
});

/* ── 140–172s：按下「收進字典」、數字跳動 ── */
await split('f5-confirm', async ({ agent, site }) => {
  await site.evaluate(async u => { await window.__call('feedDocument', { url:u, requested_terms:['MCP','prompt injection'] }); }, ARTICLE);
  await agent.waitForTimeout(1500);
  await site.evaluate(async d => { await window.__call('reportDocument', d); }, DOC);
  await agent.waitForTimeout(1500);
  await site.evaluate(async ([f, nf]) => { await window.__call('submitFindings', { findings:f, not_found:nf }); }, [FINDINGS, NOT_FOUND]);
  await agent.waitForTimeout(2200);
  await site.evaluate(() => document.getElementById('confirm')?.scrollIntoView({ block:'center', behavior:'smooth' }));
  await agent.waitForTimeout(2400);
  await site.click('#do-confirm');
  await agent.waitForTimeout(3800);
  await site.evaluate(() => document.querySelector('.nums')?.scrollIntoView({ block:'center', behavior:'smooth' }));
  await agent.waitForTimeout(3200);
  /* 頁面的統計是載入時抓的，不重載拍不到「數字跳動」 */
  await site.reload();
  await site.waitForTimeout(2400);
  await site.evaluate(() => document.querySelector('.nums')?.scrollIntoView({ block:'center', behavior:'smooth' }));
  await agent.waitForTimeout(5000);
});

await browser.close();

/* 併成分屏。左右各自的長度可能差幾毫秒，用 shortest 對齊。 */
console.log('\n併分屏：');
for (const n of ['f2-PLACEHOLDER-agent', 'f3-report', 'f5-confirm']) {
  const L = join(OUT, `${n}-L.webm`), R = join(OUT, `${n}-R.webm`), O = join(OUT, `${n}.webm`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', L, '-i', R,
    '-filter_complex', `[0:v][1:v]hstack=inputs=2:shortest=1`,
    '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', O]);
  console.log(`  ✓ ${n}.webm`);
}
console.log('\n完成。⚠ f2 仍是 PLACEHOLDER —— 呼叫者是腳本不是 agent。');
