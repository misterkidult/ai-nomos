#!/usr/bin/env node
/* The verify step of the loop. One command, one exit code, no dependencies.
 *
 * What it is for: context/contract.md is the only source of truth for the page, api/* and the
 * feed, and CLAUDE.md requires api/* to reach verdicts identical to scripts/check-findings.py on
 * fixtures/*.json. Neither was checkable before this file existed. Every assertion here pins one
 * sentence of the contract to the code that implements it.
 *
 * The page's lock implementation is EXTRACTED from public/read.html rather than copied — a copy
 * would drift silently, which is the exact failure this is meant to catch.
 *
 * Usage: node scripts/verify.mjs [--only <substring>]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...xs) => join(ROOT, ...xs);
const read = (...xs) => readFileSync(p(...xs), 'utf8');
const json = (...xs) => JSON.parse(read(...xs));

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const results = [];
let current = null;

async function suite(name, fn) {
  if (only && !name.includes(only)) return;
  current = name;
  try { await fn(); } catch (e) { fail('suite threw', String(e.stack || e)); }
  current = null;
}
const ok = what => results.push({ suite: current, what, pass: true });
const fail = (what, detail) => results.push({ suite: current, what, pass: false, detail });
const is = (what, actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected)
    ? ok(what)
    : fail(what, `expected ${JSON.stringify(expected)}\n     actual   ${JSON.stringify(actual)}`);

/* ------------------------------------------------------------------ *
 * Extract the page's contract objects from public/read.html.
 * STOPLIST → RULES → FINDING_SCHEMA → ENUMS → check() are contiguous there; take the whole span
 * and evaluate it, so the page stays the single definition of its own locks.
 * ------------------------------------------------------------------ */
function extractPageContract() {
  const html = read('public', 'read.html');
  const start = html.indexOf('const STOPLIST=');
  const tail = html.indexOf('return [...why].sort();', start);
  if (start < 0 || tail < 0) throw new Error('cannot locate the lock block in public/read.html');
  const end = html.indexOf('\n}', tail) + 2;
  const src = html.slice(start, end);
  const version = /const CONTRACT_VERSION=(\d+)/.exec(html)?.[1];
  const page = new Function(`${src}; return {STOPLIST, RULES, FINDING_SCHEMA, ENUMS, check};`)();
  return { ...page, CONTRACT_VERSION: version ? Number(version) : null };
}

/* Fenced blocks and the stoplist line out of context/contract.md. */
function extractContract() {
  const md = read('context', 'contract.md');
  const blocks = [...md.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map(m => ({ lang: m[1], body: m[2] }));
  const schema = blocks.find(b => b.lang === 'json' && b.body.includes('"required"'));
  const rules = blocks.find(b => b.body.startsWith('You are helping the user read one article.'));
  const stoplist = /Stoplist \(zh-Hant[^`]*`([^`]+)`/.exec(md)?.[1];
  const version = /`contract_version` is `(\d+)`/.exec(md)?.[1];
  return {
    schema: schema ? JSON.parse(schema.body) : null,
    rules: rules ? rules.body.replace(/\n$/, '') : null,
    stoplist: stoplist ? stoplist.split(',').map(s => s.trim()) : null,
    version: version ? Number(version) : null,
  };
}

/* The reference locks, called in-process from scripts/check-findings.py (never re-implemented). */
function referenceVerdicts(fixture) {
  const driver = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("ref", sys.argv[1])
ref = importlib.util.module_from_spec(spec); spec.loader.exec_module(ref)
print(json.dumps([ref.check(f) for f in json.load(open(sys.argv[2]))], ensure_ascii=False))
`;
  const out = execFileSync('python3', ['-c', driver, p('scripts', 'check-findings.py'), p(fixture)], {
    encoding: 'utf8', maxBuffer: 1 << 26,
  });
  return JSON.parse(out);
}

/* ================================================================== *
 * contract — the page must say exactly what context/contract.md says
 * ================================================================== */
await suite('contract', () => {
  const page = extractPageContract();
  const spec = extractContract();
  const py = read('scripts', 'check-findings.py');
  const pyStoplist = /STOPLIST = "([^"]+)"\.split\(\)/.exec(py)?.[1].split(/\s+/) ?? null;

  is('contract_version: page matches §7', page.CONTRACT_VERSION, spec.version);
  is('stoplist: page matches §2', page.STOPLIST, spec.stoplist);
  is('stoplist: check-findings.py matches §2', pyStoplist, spec.stoplist);
  is('rules: page RULES is §2 verbatim', page.RULES, spec.rules?.replace('<STOPLIST joined by ", ">', page.STOPLIST.join(', ')));
  is('schema: required fields match §1', page.FINDING_SCHEMA.required, spec.schema?.required);
  for (const k of ['explained', 'intent', 'domain'])
    is(`schema: ${k} enum matches §1`, page.FINDING_SCHEMA.properties[k].enum, spec.schema?.properties[k].enum);

  // §3 names nine codes; PII_DETECTED is server-only, the other eight must be reachable in both impls.
  const codes = [...read('context', 'contract.md').matchAll(/^\| `([A-Z_]+)` \|/gm)].map(m => m[1]);
  const clientCodes = codes.filter(c => c !== 'PII_DETECTED');
  const inPage = clientCodes.filter(c => page.check.toString().includes(c));
  const inPy = clientCodes.filter(c => py.includes(`"${c}"`));
  is('locks: page implements every §3 client code', inPage, clientCodes);
  is('locks: check-findings.py implements every §3 client code', inPy, clientCodes);
});

/* ================================================================== *
 * locks — page verdicts === reference verdicts === the golden file
 * ================================================================== */
await suite('locks', () => {
  const { check } = extractPageContract();
  const golden = json('fixtures', 'locks-regression.json');
  const ref = referenceVerdicts('fixtures/locks-regression.json');

  golden.forEach((f, i) => {
    const label = `#${i} ${f._note}`;
    const mine = check(f);
    if (JSON.stringify(ref[i]) !== JSON.stringify(f._expect))
      fail(`reference verdict ${label}`, `expected ${JSON.stringify(f._expect)}\n     actual   ${JSON.stringify(ref[i])}`);
    else ok(`reference verdict ${label}`);
    if (JSON.stringify(mine) !== JSON.stringify(ref[i]))
      fail(`page/reference parity ${label}`, `reference ${JSON.stringify(ref[i])}\n     page      ${JSON.stringify(mine)}`);
    else ok(`page/reference parity ${label}`);
  });

  // CLAUDE.md: identical verdicts on every fixture, not only the golden one.
  for (const name of readdirSync(p('fixtures')).filter(f => f.endsWith('.json'))) {
    const data = json('fixtures', name);
    if (!Array.isArray(data)) continue;
    const r = referenceVerdicts(`fixtures/${name}`);
    const mismatches = data.map((f, i) => [i, check(f), r[i]])
      .filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b));
    if (mismatches.length)
      fail(`page/reference parity on fixtures/${name}`, mismatches.slice(0, 3)
        .map(([i, a, b]) => `#${i} page ${JSON.stringify(a)} vs reference ${JSON.stringify(b)}`).join('\n     '));
    else ok(`page/reference parity on fixtures/${name} (${data.length})`);
  }
});

/* ================================================================== *
 * api:sightings — contract §4/§5 for GET /api/sightings, with Upstash stubbed
 * ================================================================== */
await suite('api:sightings', async () => {
  const mod = p('api', 'sightings.js');
  const load = async tag => (await import(`${pathToFileURL(mod).href}?${tag}`)).default;

  const res = () => {
    const o = { headers: {}, code: null, body: null };
    o.setHeader = (k, v) => { o.headers[k] = v; };
    o.status = c => { o.code = c; return o; };
    o.json = b => { o.body = b; return o; };
    return o;
  };

  // unconfigured storage answers 503 rather than throwing
  delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN; delete process.env.KV_REST_API_READ_ONLY_TOKEN;
  let h = await load('unconfigured');
  let r = res();
  await h({ url: '/api/sightings' }, r);
  is('503 when storage is not configured', r.code, 503);

  process.env.KV_REST_API_URL = 'https://stub.upstash.io';
  process.env.KV_REST_API_READ_ONLY_TOKEN = 'stub-token';
  h = await load('configured');

  // One stored sighting carrying every private field §4 forbids on the public surface.
  const stored = {
    id: 's1', term_key: 'mcp', term_raw: 'MCP', term_normalized: 'MCP',
    explained: 'has_definition', intent: 'technical', domain: 'core',
    definition_quote: 'MCP 是讓模型外接工具的通訊協定',
    sentence: 'MCP 是讓模型外接工具的通訊協定，聯絡人 someone@example.com。',
    context: 'MCP 是讓模型外接工具的通訊協定。這是絕對不能公開的欄位。',
    origin: 'agent', source: { url: 'https://example.com/a', title: 'A', published: '2026-08-01', hash: 'salted' },
    source_hash: 'salted-hash', submitted_at: '2026-08-20T00:00:00Z',
    submitter: 'anon-browser-id', contract_version: 1,
  };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const cmds = JSON.parse(init.body);
    calls.push(cmds);
    const result = cmds.map(c => {
      const verb = c[0].toUpperCase();
      if (verb === 'SCARD') return 3;
      if (verb === 'GET') return JSON.stringify(stored);
      return ['s1'];
    });
    return { ok: true, json: async () => result.map(x => ({ result: x })), text: async () => '' };
  };

  calls.length = 0;
  r = res();
  await h({ url: '/api/sightings' }, r);
  is('200 on the default feed', r.code, 200);
  is('contract_version is 1', r.body.contract_version, 1);
  is('contributors is exposed (§5)', r.body.contributors, 3);
  is('default feed is capped at 200 (§5)', calls[0][0], ['ZREVRANGE', 'recent', '0', '199']);

  const pub = r.body.sightings[0];
  const forbidden = ['sentence', 'context', 'submitter', 'source_hash'].filter(k => k in pub);
  is('§4: private fields never reach the public surface', forbidden, []);
  is('§4: source.hash never reaches the public surface', 'hash' in (pub.source || {}), false);
  for (const k of ['term_key', 'term_raw', 'term_normalized', 'explained', 'intent', 'domain',
                   'definition_quote', 'origin', 'submitted_at'])
    is(`§4: public field ${k} is kept`, k in pub, true);
  is('§4: source.url is kept — the link is what makes a quote checkable', pub.source?.url, 'https://example.com/a');

  calls.length = 0;
  r = res();
  await h({ url: '/api/sightings?term_key=mcp' }, r);
  is('?term_key reads the per-term index uncapped (§5)', calls[0][0], ['ZREVRANGE', 'by_term:mcp', '0', '-1']);

  calls.length = 0;
  r = res();
  await h({ url: '/api/sightings?days=30' }, r);
  is('?days reads the window by score (§5)', calls[0][0][0], 'ZREVRANGEBYSCORE');

  r = res();
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  await h({ url: '/api/sightings' }, r);
  is('upstream failure answers 500, not a crash', r.code, 500);
});

/* ================================================================== *
 * static — the deployment surface the prebuilt flow ships
 * ================================================================== */
await suite('static', () => {
  for (const rw of json('vercel.json').rewrites)
    is(`rewrite ${rw.source} -> ${rw.destination} exists`, existsSync(p('public', rw.destination)), true);

  const lex = json('public', 'lexicon.json');
  is('lexicon.json has terms[]', Array.isArray(lex.terms) && lex.terms.length > 0, true);
  const shaped = lex.terms.every(t => t.slug && t.term);
  is('every lexicon entry has slug and term', shaped, true);
  const dupes = lex.terms.map(t => t.slug).filter((s, i, a) => a.indexOf(s) !== i);
  is('lexicon slugs are unique', dupes, []);

  // CLAUDE.md: public/fixtures/ is a copy of the root fixtures/ used by the degraded mode.
  for (const f of readdirSync(p('public', 'fixtures')))
    is(`public/fixtures/${f} matches fixtures/${f}`, read('public', 'fixtures', f), existsSync(p('fixtures', f)) ? read('fixtures', f) : '<missing>');

  // §6: fixtures are lock regression inputs, never loaded into storage.
  const loaders = [...read('public', 'nomos.js').matchAll(/fixtures\/([\w.-]+)/g)].map(m => m[1]);
  is('nomos.js loads a fixture only behind ?demo=1', loaders.every(f => read('public', 'nomos.js').includes('demo')), true);
});

/* ------------------------------------------------------------------ */
const failed = results.filter(r => !r.pass);
let suiteName = null;
for (const r of results) {
  if (r.suite !== suiteName) { suiteName = r.suite; console.log(`\n${suiteName}`); }
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.what}`);
  if (!r.pass) console.log(`     ${r.detail}`);
}
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
