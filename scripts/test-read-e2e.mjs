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
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'text/plain' }); res.end(readFileSync(p)); }
  catch { res.writeHead(404); res.end('nope'); }
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
await page.goto('http://127.0.0.1:8799/read.html');
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

const log = await page.textContent('#log');
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
await page.waitForFunction(() => !document.getElementById('confirm') || document.getElementById('confirm').hidden, { timeout: 5000 });
const log2 = await page.textContent('#log') + await page.textContent('body');

ok('confirming POSTs to /api/findings', !!posted);
ok('POST carried findings + not_found + submitter', posted && posted.findings.length === 2 && posted.not_found[0] === 'Multi-Agent' && /^anon-/.test(posted.submitter));
/* 頁面會把拒絕碼在地化再顯示，所以斷言看的是那個字串不是 code 本身 */
ok('server verdict is the one that counts (PII_DETECTED is server-only)',
   /含個資或金額|carries PII/.test(await page.textContent('#log')));
ok('unsigned submission sends an empty signature', posted && posted.submitter_name === '');
/* Copilot passed the page's locks so it is on screen, but the server rejected it — the page must
   not present it as stored. What matters is the log carries the server's reason. */
ok('the clean finding is shown', (await page.textContent('#findings')).includes('RAG'));
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
await page.evaluate(async f => {
  await window.__tools.find(t => t.name === 'submitFindings').execute({ findings: f, not_found: [] });
}, [asNew]);
const rows = await page.textContent('#findings');
ok('term_normalized:"" is honoured as “new”, not guessed into a known term',
   rows.includes('Claude Cowork') && !/Claude Cowork[\s\S]{0,120}已知/.test(rows));
ok('a term the agent did normalize still reads as known', /RAG[\s\S]{0,80}已知/.test(rows));

/* contract §4: first_seen counts from when the dictionary received the sighting, never from the
   article's publication date — clean's source.published is 2026-08-01 */
const life = await page.textContent('#life');
const today = new Date().toISOString().slice(0, 10);
ok('life history dates from submitted_at, not source.published',
   life.includes(today) && !life.includes('2026-08-01'), life.slice(0, 120).replace(/\s+/g, ' '));

/* the signature: typed once, sent, remembered, and never handed to the agent */
await page.fill('#nick', '  果核 Kidult  ');
posted = null;
await page.route('**/api/findings', async route => {
  posted = JSON.parse(route.request().postData());
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    contract_version: 1, accepted: 1, not_found: [], rejected: [], status: 'stored' }) });
});
await page.evaluate(async f => {
  const tool = window.__tools.find(t => t.name === 'submitFindings');
  return await tool.execute({ findings: f, not_found: [] });
}, [{ ...clean, source: { ...clean.source, url: 'https://example.com/signed' } }]);
await page.click('#do-confirm');   /* 第四關：人按了才會送出 */
await page.waitForFunction(() => document.getElementById('confirm').hidden, { timeout: 5000 });
ok('signature sent with the submission', posted && posted.submitter_name === '果核 Kidult', `got ${JSON.stringify(posted && posted.submitter_name)}`);
ok('signature shown next to the sighting', (await page.textContent('#findings')).includes('果核 Kidult'));
ok('submitFindings input schema has no field for the signature — the agent cannot set it',
   !JSON.stringify((await page.evaluate(() => window.__tools.find(t => t.name === 'submitFindings').inputSchema))).includes('submitter'));
await page.reload();
await page.waitForFunction(() => window.__tools && window.__tools.length === 5, { timeout: 8000 });
ok('signature remembered across a reload', (await page.inputValue('#nick')) === '果核 Kidult');

/* sample button must never write */
posted = null;
await page.click('#demo');
await page.waitForTimeout(400);
ok('sample button did NOT POST', posted === null);
ok('sample logged as not written', (await page.textContent('#log')).includes('未寫入'));

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
  const t = document.getElementById('log').textContent;
  return /連不到伺服器|server unreachable|伺服器沒收|server refused/.test(t);
}, { timeout: 8000 }).catch(() => {});
const offLog = await page.textContent('#log');
ok('offline: the page says it could not reach the server', /連不到伺服器|server unreachable|伺服器沒收|server refused/.test(offLog), offLog.slice(0, 60));
ok('offline: nothing claims it was stored', !/已寫入字典：|written to the dictionary：/.test(offLog.split('\n')[0]));
ok('offline: the batch is still waiting, not silently dropped', !(await page.evaluate(() => document.getElementById('confirm').hidden)));

await browser.close(); srv.close();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
