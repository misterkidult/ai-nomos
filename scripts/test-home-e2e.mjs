#!/usr/bin/env node
/* End-to-end test of the write path, in a real browser. Serves public/, fakes
   document.modelContext so the WebMCP tools register, intercepts POST /api/findings, and
   calls submitFindings exactly the way an agent does.

   It guards the three things that are easy to get wrong and impossible to see from the code:
   the tool really POSTs, the server's verdict (not the page's mirror) is what comes back, and
   a page that cannot reach the server says so instead of claiming a sighting was stored.

   Playwright is not a project dependency — the repo deliberately has none. Install it just
   for the run:  npm i --no-save playwright && node scripts/test-read-e2e.mjs
   Set CHROMIUM if the browser lives somewhere else, e.g. on a machine that already has one:
     CHROMIUM=~/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium \
       node scripts/test-read-e2e.mjs */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const p = join('public', decodeURIComponent(req.url.split('?')[0]) === '/' ? '/index.html' : req.url.split('?')[0]);
  /* 先讀檔再送 header —— 反過來的話讀檔失敗時 header 已經送出，catch 再寫一次會炸 */
  let body; try { body = readFileSync(p); } catch { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'text/plain' }); res.end(body);
});
await new Promise(r => srv.listen(8799, r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();

let posted = null;
await page.route('**/api/findings', async route => {
  posted = JSON.parse(route.request().postData());
  // stand in for the server: reject index 1, accept the rest — including a server-only code
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    contract_version: 1, accepted: posted.findings.length - 1, not_found: posted.not_found,
    rejected: [{ index: 1, term_raw: posted.findings[1]?.term_raw || '', reasons: ['PII_DETECTED'] }],
    status: 'stored' }) });
});

await page.addInitScript(() => {
  const registered = [];
  document.modelContext = { registerTool: t => { registered.push(t); return true; }, getTools: () => registered };
  window.__tools = registered;
});

const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://127.0.0.1:8799/index.html');
/* 5 tools since 2026-08-30: feedDocument, reportDocument, submitFindings, lookupTerm, trending */
await page.waitForFunction(() => window.__tools && window.__tools.length === 5, { timeout: 8000 });

const clean = {
  term_raw: 'RAG', term_normalized: 'RAG',
  sentence: 'RAG 是一種結合資料檢索與生成的技術架構。',
  context: '前句。RAG 是一種結合資料檢索與生成的技術架構。後句。',
  explained: 'has_definition', intent: 'technical', domain: 'core',
  definition_quote: 'RAG 是一種結合資料檢索與生成的技術架構。', requested: true,
  source: { url: 'https://example.com/a', title: '甲文', published: '2026-08-01' },
};
const pii = { ...clean, term_raw: 'Copilot', term_normalized: '',
  sentence: 'Copilot 報價 NT$120,000，寫信到 s@v.com。', context: 'Copilot 報價 NT$120,000，寫信到 s@v.com。',
  definition_quote: '', source: undefined };

const out = await page.evaluate(async f => {
  const tool = window.__tools.find(t => t.name === 'submitFindings');
  return await tool.execute({ findings: f, not_found: ['Multi-Agent'] });
}, [clean, pii]);

const log = await page.textContent('#steps');
let fail = 0;
const ok = (l, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); if (!c) fail++; };

ok('5 WebMCP tools registered', (await page.evaluate(() => window.__tools.map(t => t.name))).join(',') === 'feedDocument,reportDocument,submitFindings,lookupTerm,trending');

/* Contract §5 as of 2026-08-30: submitFindings does NOT write. It answers pending_review and
   holds the batch on the page; the person confirms and the PAGE posts. These two assertions are
   the gate — if a tool call can reach /api/findings on its own, the fourth gate is gone. */
ok("submitFindings answers 'pending_review', not 'stored'", out.status === 'pending_review', `status=${out.status}`);
ok('nothing is POSTed until the person confirms', posted === null);
/* The page runs §3 minus PII_DETECTED, which is server-only — so both findings pass here and
   the server is what catches the PII one. That split is the point: the page gives instant
   feedback, the server has the final word. */
ok('the page ran the locks itself', out.accepted === 2 && out.rejected.length === 0, `accepted=${out.accepted}`);

/* now the person confirms */
await page.click('#do-confirm');
/* 2026-09-01: the box no longer disappears — it turns into the thank-you state in place.
   That moment is the only visible proof of the fourth gate, so wait for it and assert it. */
await page.waitForFunction(() => {
  const b = document.getElementById('confirm');
  return b && !b.hidden && b.classList.contains('is-done');
}, { timeout: 5000 });
const log2 = await page.textContent('#steps') + await page.textContent('body');

ok('confirming POSTs to /api/findings', !!posted);
/* The thank-you state is what the person actually sees at the fourth gate — if it silently
   stops rendering, the gate still works but nobody can tell it did. */
/* the count animates from 0 over ~900ms — wait for it to land on the real number,
   which also proves the animation finishes instead of stalling mid-count */
await page.waitForFunction(
  () => { const n = document.querySelector('#confirm .num'); return n && /^\d+$/.test(n.textContent.trim()); },
  { timeout: 3000 }).catch(()=>{});
await page.waitForTimeout(1200);   // let the ~900ms count animation land
const done = await page.evaluate(() => {
  const b = document.getElementById('confirm');
  return { n: b.querySelector('.num')?.textContent.trim(),
           terms: b.querySelectorAll('.dterms li').length,
           thanks: !!b.querySelector('.thx') };
});
/* This batch sends 2 findings; the server catches one with PII_DETECTED, so exactly 1 is
   stored. The count and the listed terms must both reflect what was *stored*, not what was
   submitted — showing 2 here would credit the person for a finding the server refused. */
ok('the thank-you state shows the count and the terms',
   done.thanks && done.n === '1' && done.terms === 1, JSON.stringify(done));
ok('POST carried findings + not_found + submitter', posted && posted.findings.length === 2 && posted.not_found[0] === 'Multi-Agent' && /^anon-/.test(posted.submitter));
/* 署名欄 2026-08-31 隨 /read 刪除，但 POST body 仍帶 submitter_name —— 它必須恆為空字串。
   若哪天有人把署名接回來卻沒接 UI，這條會先叫。 */
ok('submitter_name is empty (the signature field is gone)', posted && posted.submitter_name === '',
   JSON.stringify(posted && posted.submitter_name));

/* 工具呼叫面板：它顯示的必須是真實呼叫。這裡驗三件事 ——
   ① 呼叫過就有行 ② 顯示的工具名是真的被叫過的那些 ③ 計數是累計總數不是畫面上的三筆 */
const panel = await page.evaluate(() => ({
  total: typeof CALL_TOTAL === 'undefined' ? null : CALL_TOTAL,
  /* 面板 2026-08-31 改成對話樣式：工具名在 agent→page 那半的 <b> 裡 */
  shown: [...document.querySelectorAll('#calls .turn.out .bub b')].map(e => e.textContent),
  hidden: document.getElementById('calls').hidden,
}));
ok('call panel logged the real calls', !panel.hidden && panel.shown.includes('submitFindings'), JSON.stringify(panel.shown));
ok('call panel counts every call, not just the three on screen', panel.total >= panel.shown.length,
   `total=${panel.total} shown=${panel.shown.length}`);
/* 頁面會把拒絕碼在地化再顯示，所以斷言看的是那個字串不是 code 本身 */
ok('server verdict is the one that counts (PII_DETECTED is server-only)',
   /含個資或金額|carries PII/.test(await page.textContent('#steps')));
/* Copilot passed the page's locks so it is on screen, but the server rejected it — the page must
   not present it as stored. What matters is the log carries the server's reason. */
ok('the clean finding is shown', (await page.textContent('#found')).includes('RAG'));
ok('page says it was written', /已寫入字典|written to the dictionary/.test(log2));
ok('no page errors', errs.length === 0, errs.join(' | '));

/* the agent's verdict on whether a term is known is the verdict. lookup() fuzzy-matches, which
   is right for the free-text query box and wrong here: it used to mark 23% of new terms "known"
   (Claude Cowork → known · Claude) by substring-matching term_raw against the lexicon. */
await page.route('**/api/findings', async route => {
  const b = JSON.parse(route.request().postData());
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    contract_version: 1, accepted: b.findings.length, not_found: [], rejected: [], status: 'stored' }) });
});
const asNew = { ...clean, term_raw: 'Claude Cowork', term_normalized: '',
  sentence: 'Claude Cowork 是新出現的說法。', context: '前句。Claude Cowork 是新出現的說法。後句。',
  definition_quote: '', source: { ...clean.source, url: 'https://example.com/newterm' } };
/* 兩筆一起送：首頁的 submitFindings 用新批次「取代」畫面上的目擊（一次呼叫＝一篇文章的
   完整結果），不是往上累加。分兩次送的話第二次會把第一次的洗掉。 */
await page.evaluate(async f => {
  await window.__tools.find(t => t.name === 'submitFindings').execute({ findings: f, not_found: [] });
}, [clean, asNew]);
/* badge 走 class 不走文字：.bg.k = 字典裡有、.bg.n = 新詞。頁面有 zh／en 兩套字串，
   斷言綁文字會在語言切換時假失敗（2026-08-31 踩過）。 */
const badges = await page.evaluate(() => [...document.querySelectorAll('#found .tf')].map(el => ({
  term: el.querySelector('b')?.textContent || '',
  known: !!el.querySelector('.bg.k'), isNew: !!el.querySelector('.bg.n') })));
const bOf = t => badges.find(b => b.term === t);
ok('term_normalized:"" is honoured as “new”, not guessed into a known term',
   !!bOf('Claude Cowork') && bOf('Claude Cowork').isNew && !bOf('Claude Cowork').known,
   JSON.stringify(badges));
ok('a term the agent did normalize still reads as known',
   !!bOf('RAG') && bOf('RAG').known, JSON.stringify(badges));

/* contract §4: first_seen counts from when the dictionary received the sighting, never from the
   article's publication date — clean's source.published is 2026-08-01.
   生命史的畫面在 /term/:slug，首頁沒有；所以這裡改驗 lookupTerm 交出來的資料本身 ——
   比驗畫面更貼近契約，換頁也不會失效。 */
const today = new Date().toISOString().slice(0, 10);
const look = await page.evaluate(async () =>
  await window.__tools.find(t => t.name === 'lookupTerm').execute({ term: 'RAG' }));
const lookStr = JSON.stringify(look);
ok('lookupTerm dates from submitted_at, not source.published',
   !lookStr.includes('2026-08-01'), lookStr.slice(0, 120));

/* 署名欄與「載入範例」是 /read 專有的（2026-08-31 隨該頁一併刪除）—— 首頁沒有任何
   輸入欄位，使用者只跟 agent 講話。但契約邊界這一條與表單無關，在首頁一樣要守：
   submitter 由頁面加，agent 的 schema 裡根本沒有那個欄位。 */
ok('submitFindings input schema has no field for the signature — the agent cannot set it',
   !JSON.stringify((await page.evaluate(() => window.__tools.find(t => t.name === 'submitFindings').inputSchema))).includes('submitter'));

/* server unreachable → the page stays honest.
   Since the fourth gate (2026-08-30) the tool call never touches the network, so an unreachable
   server cannot be discovered at submitFindings time — it surfaces when the person confirms.
   What must hold: the batch is NOT lost, the gate stays open, and nothing claims it was stored. */
await page.unroute('**/api/findings');
await page.route('**/api/findings', r => r.abort());
const off = await page.evaluate(async f => {
  const tool = window.__tools.find(t => t.name === 'submitFindings');
  return await tool.execute({ findings: f, not_found: [] });
}, [clean]);
ok("offline: tool still answers 'pending_review' (it never asked the network)", off.status === 'pending_review', `status=${off.status}`);
await page.click('#do-confirm');
await page.waitForFunction(() => {
  const t = document.getElementById('steps').textContent;
  return /連不到伺服器|server unreachable|伺服器沒收|server refused/.test(t);
}, { timeout: 8000 }).catch(() => {});
const offLog = await page.textContent('#steps');
ok('offline: the page says it could not reach the server', /連不到伺服器|server unreachable|伺服器沒收|server refused/.test(offLog), offLog.slice(0, 60));
ok('offline: nothing claims it was stored', !/已寫入字典：|written to the dictionary：/.test(offLog.split('\n')[0]));
ok('offline: the batch is still waiting, not silently dropped', !(await page.evaluate(() => document.getElementById('confirm').hidden)));

await browser.close(); srv.close();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
