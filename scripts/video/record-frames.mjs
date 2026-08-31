#!/usr/bin/env node
/* 錄「可代錄」的五格 —— 不需要 agent 參與的畫面，用 Playwright 驅動線上站。
 *
 * ⚠ 25–70 秒那格不在這裡。那格要拍「一個真 agent 讀了工具描述、自己決定呼叫
 *   feedDocument」，只能由人開 Chrome／ChatGPT 錄。用腳本呼叫工具畫面一模一樣，
 *   但呼叫者是腳本不是 agent —— 那正是評審唯一要確認的事，不能假。
 *
 * 錄的是瀏覽器視窗不是整個螢幕：畫面乾淨、可重現、不含桌面雜物。
 * 1600×900 = 頁面 --maxw 剛好填滿，且仍是 16:9。
 *
 * 用法：node scripts/video/record-frames.mjs [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || 'video-out';
const SITE = 'https://ai-nomos.vercel.app/?lang=en';
const VIEW = { width: 1600, height: 900 };
mkdirSync(OUT, { recursive: true });

const ARTICLE = 'https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/';
const DOC = { title: 'The lethal trifecta for AI agents', byline: 'Simon Willison',
              published: '2025-06-16', words: 1622,
              gist: 'Three capabilities that are dangerous when combined.' };

/* 英文語料（2026-08-31 決定全英文錄影）。definition_quote 必須逐字出現在 context 裡，
   否則被 QUOTE_NOT_IN_CONTEXT 鎖擋下 —— 那條鎖是真的，這裡不繞過它。 */
const FINDINGS = [
  { term_raw: 'prompt injection', term_normalized: 'Prompt Injection',
    sentence: 'Prompt injection is when untrusted content reaches the model and changes what it does.',
    context: 'The risk is structural. Prompt injection is when untrusted content reaches the model and changes what it does. No amount of prompting fixes it.',
    explained: 'has_definition', intent: 'technical', domain: 'core', requested: true,
    definition_quote: 'Prompt injection is when untrusted content reaches the model and changes what it does.',
    source: { url: ARTICLE, title: DOC.title, published: DOC.published } },
  { term_raw: 'MCP', term_normalized: 'MCP',
    sentence: 'MCP lets an agent reach tools it was never built to know about.',
    context: 'Everyone is shipping servers now. MCP lets an agent reach tools it was never built to know about. That is the whole point, and the whole risk.',
    explained: 'has_definition', intent: 'technical', domain: 'core', requested: true,
    definition_quote: 'MCP lets an agent reach tools it was never built to know about.',
    source: { url: ARTICLE, title: DOC.title, published: DOC.published } },
  /* agent 自己補的詞（requested:false）—— 旁白 70–110 秒講的就是這件事 */
  { term_raw: 'exfiltration', term_normalized: '',
    sentence: 'Exfiltration is the step where your private data leaves the building.',
    context: 'Reading is not the danger. Exfiltration is the step where your private data leaves the building. That is what external communication buys the attacker.',
    explained: 'has_definition', intent: 'risk_or_limit', domain: 'core', requested: false,
    definition_quote: 'Exfiltration is the step where your private data leaves the building.',
    source: { url: ARTICLE, title: DOC.title, published: DOC.published } },
];
const NOT_FOUND = ['Explainable AI'];

const browser = await chromium.launch({ headless: false });

async function frame(name, fn) {
  const ctx = await browser.newContext({
    viewport: VIEW, recordVideo: { dir: OUT, size: VIEW },
    deviceScaleFactor: 2, locale: 'en-US',
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(SITE);
  /* TOOLS 是 classic script 的頂層 const —— 不掛 window，但 evaluate 讀得到 */
  await page.waitForFunction(() => { try { return typeof TOOLS !== 'undefined' && typeof traceTool === 'function'; } catch(e) { return false; } }, { timeout: 20000 });
  await page.waitForTimeout(1200);            /* 讓資料與捲動進場落定 */
  /* 接上工具：頁面自己的 execute()，面板記到的每個值都是真的 */
  await page.evaluate(() => {
    window.__reg = [];
    TOOLS.forEach(traceTool);
    TOOLS.forEach(t => window.__reg.push(t));
    window.__call = (n, a) => window.__reg.find(t => t.name === n).execute(a || {});
  });
  try { await fn(page); }
  finally {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const v = page.video();
    await ctx.close();
    const p = await v.path();
    renameSync(p, join(OUT, `${name}.webm`));
    console.log(`  ✓ ${name}.webm   ${secs}s`);
  }
}

console.log(`錄到 ${OUT}/ · ${VIEW.width}×${VIEW.height}\n`);

/* ── 0–25s：滿是術語的文章。旁白講「每篇 AI 文章都丟一堆沒人定義的詞」 ──
   拍的不是我們的站，是那篇文章本身 —— 這格獨立錄。 */
{
  const ctx = await browser.newContext({
    viewport: VIEW, recordVideo: { dir: OUT, size: VIEW },
    deviceScaleFactor: 2, locale: 'en-US',
  });
  const page = await ctx.newPage();
  await page.goto(ARTICLE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  /* 慢捲，讓術語一個個經過 */
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 220);
    await page.waitForTimeout(900);
  }
  const v = page.video(); await ctx.close();
  renameSync(await v.path(), join(OUT, 'f1-article.webm'));
  console.log('  ✓ f1-article.webm  (0–25s 術語文章)');
}

/* ── 70–110s：報告。假設你懂的詞 ＋ 字典白話 ── */
await frame('f3-report', async page => {
  await page.evaluate(async ([url, terms]) => {
    await window.__call('feedDocument', { url, requested_terms: terms });
  }, [ARTICLE, ['MCP', 'prompt injection', 'Explainable AI']]);
  await page.waitForTimeout(2500);
  await page.evaluate(async d => { await window.__call('reportDocument', d); }, DOC);
  await page.waitForTimeout(3000);
  await page.evaluate(async ([f, nf]) => {
    await window.__call('submitFindings', { findings: f, not_found: nf });
  }, [FINDINGS, NOT_FOUND]);
  await page.waitForTimeout(2000);
  /* 捲到 agent 抽出來的詞 */
  await page.evaluate(() => document.getElementById('found')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(6000);
});

/* ── 110–140s：同一個詞的並列定義。走 /term/:slug ── */
{
  const ctx = await browser.newContext({
    viewport: VIEW, recordVideo: { dir: OUT, size: VIEW },
    deviceScaleFactor: 2, locale: 'en-US',
  });
  const page = await ctx.newPage();
  await page.goto('https://ai-nomos.vercel.app/term/mcp?lang=en');
  await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(1100); }
  const v = page.video(); await ctx.close();
  renameSync(await v.path(), join(OUT, 'f4-term-mcp.webm'));
  console.log('  ✓ f4-term-mcp.webm  (110–140s 並列定義)');
}

/* ── 140–172s：按下「收進字典」、數字跳動、語言分佈 ──
   ⚠ 這格會真的寫一筆進線上字典（Kidult 2026-08-31 決定：寫真資料，錄完不清）。 */
await frame('f5-confirm', async page => {
  await page.evaluate(async ([url, terms]) => {
    await window.__call('feedDocument', { url, requested_terms: terms });
  }, [ARTICLE, ['MCP', 'prompt injection']]);
  await page.waitForTimeout(1500);
  await page.evaluate(async d => { await window.__call('reportDocument', d); }, DOC);
  await page.waitForTimeout(1500);
  await page.evaluate(async ([f, nf]) => {
    await window.__call('submitFindings', { findings: f, not_found: nf });
  }, [FINDINGS, NOT_FOUND]);
  await page.waitForTimeout(2500);
  /* 確認鈕：這是整個產品唯一「不按就不會發生」的地方 */
  await page.evaluate(() => document.getElementById('confirm')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(2500);
  await page.click('#do-confirm');
  await page.waitForTimeout(4000);
  /* 數字跳動：先捲到統計區看寫入前的數字，再重載讓它長大。
     ⚠ 頁面的統計是載入時抓的，寫入後不會自己更新 —— 不重載就拍不到「跳動」。 */
  await page.evaluate(() => document.querySelector('.nums')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(3500);
  await page.reload();
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.nums')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(5000);
});

/* ── 172–187s：首頁收場 ── */
await frame('f6-home', async page => {
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(5000);
});

await browser.close();

console.log(`\n完成。${OUT}/ 內容：`);
readdirSync(OUT).filter(f => f.endsWith('.webm')).sort().forEach(f => console.log('  ' + f));
console.log('\n⚠ 缺 25–70 秒那格（agent 自己呼叫工具）—— 只能人工錄，見 context/video-handoff.md');
