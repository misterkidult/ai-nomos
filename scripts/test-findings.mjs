#!/usr/bin/env node
/* Regression test for POST /api/findings. Runs the real handler against an in-memory
   stand-in for Upstash, so it needs no credentials and touches nothing live, while every
   command the handler issues is executed and inspected afterwards.

   Covers what the endpoint must never get wrong: the lock verdicts agree with the --server
   run of scripts/check-findings.mjs, sentence and context are never stored (contract §4),
   re-feeding an article does not double count, and the limits actually bite.

   Usage: node scripts/test-findings.mjs        (exit 1 on any failure) */
process.env.KV_REST_API_URL = 'http://stub';
process.env.KV_REST_API_TOKEN = 'stub';

const store = { str: new Map(), z: new Map(), set: new Map(), hash: new Map() };
const sent = [];

globalThis.fetch = async (_url, opts) => {
  const cmds = JSON.parse(opts.body);
  const out = cmds.map(c => {
    sent.push(c);
    const [op, key, ...rest] = c;
    switch (op) {
      case 'INCR': { const n = (+store.str.get(key) || 0) + 1; store.str.set(key, String(n)); return { result: n }; }
      case 'EXPIRE': return { result: 1 };
      case 'SET': store.str.set(key, rest[0]); return { result: 'OK' };
      case 'GET': return { result: store.str.get(key) ?? null };
      case 'ZADD': { const s = store.z.get(key) || new Map(); s.set(rest[1], rest[0]); store.z.set(key, s); return { result: 1 }; }
      case 'SADD': { const s = store.set.get(key) || new Set(); rest.forEach(v => s.add(v)); store.set.set(key, s); return { result: 1 }; }
      case 'HSET': { const h = store.hash.get(key) || new Map(); for (let i = 0; i < rest.length; i += 2) h.set(rest[i], rest[i + 1]); store.hash.set(key, h); return { result: 1 }; }
      case 'HMGET': { const h = store.hash.get(key) || new Map(); return { result: rest.map(f => h.get(f) ?? null) }; }
      default: throw new Error('stub does not know ' + op);
    }
  });
  return { ok: true, json: async () => out, text: async () => '' };
};

const { default: handler } = await import(new URL('../api/findings.js', import.meta.url));
const { readFileSync } = await import('node:fs');

function res() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
const post = (body, headers = {}) => handler({ method: 'POST', headers, body }, res());

const fixture = JSON.parse(readFileSync(new URL('../fixtures/locks-v1.json', import.meta.url), 'utf8'));
/* the first fixture row is a clean finding; give each signature test its own document so the
   (document, term) key does not make them overwrite one another */
let nth = 0;
const clean = () => ({ ...fixture[0], source: { ...fixture[0].source, url: `https://example.com/sig${nth++}` } });
let fail = 0;
const ok = (label, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!cond) fail++; };

/* 1 — the lock fixture through the real endpoint */
let r = await post({ findings: fixture, not_found: ['Multi-Agent'], submitter: 'test-a' });
ok('fixture: 200 stored', r.code === 200 && r.body.status === 'stored', `code=${r.code}`);
ok('fixture: 4 accepted / 10 rejected (matches --server run)',
   r.body.accepted === 4 && r.body.rejected.length === 10,
   `accepted=${r.body.accepted} rejected=${r.body.rejected.length}`);
ok('fixture: not_found echoed', JSON.stringify(r.body.not_found) === '["Multi-Agent"]');
ok('fixture: PII row rejected, public-article twin accepted',
   r.body.rejected.some(x => x.index === 12 && x.reasons.includes('PII_DETECTED')) &&
   !r.body.rejected.some(x => x.index === 13));

/* 2 — the stored record: shape and, above all, what never leaves the server */
const stored = [...store.str.entries()].filter(([k]) => k.startsWith('sighting:')).map(([, v]) => JSON.parse(v));
ok('stored: 4 sightings', stored.length === 4, `got ${stored.length}`);
const rag = stored.find(s => s.term_raw === 'RAG');
ok('stored: term_key resolved from lexicon', rag.term_key === 'rag', `term_key=${rag.term_key}`);
ok('stored: origin agent, contract_version 1', rag.origin === 'agent' && rag.contract_version === 1);
ok('stored: sentence/context NEVER stored (contract §4)',
   stored.every(s => !('sentence' in s) && !('context' in s)));
ok('stored: submitted_at is ISO 8601', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(rag.submitted_at));
ok('stored: docs set + doc:<hash> written', store.set.get('docs')?.size === 4);

/* 3 — the signature: kept, sanitised, and never confused with the anonymous id */
r = await post({ findings: [clean()], not_found: [], submitter: 'test-sig', submitter_name: '  Kidult\u200b\n 果核  ' });
const signed = JSON.parse([...store.str.values()].find(v => v.includes('"submitter_name"') && v.includes('Kidult')));
ok('signature stored', signed.submitter_name === 'Kidult 果核', `got ${JSON.stringify(signed.submitter_name)}`);
ok('zero-width and control characters stripped', !/[\u200b\n]/.test(signed.submitter_name));
r = await post({ findings: [clean()], not_found: [], submitter: 'test-sig2', submitter_name: 'x'.repeat(80) });
const long = JSON.parse([...store.str.values()].find(v => v.includes('xxxxxxxx')));
ok('signature capped at 24', [...long.submitter_name].length === 24, `len=${[...long.submitter_name].length}`);
r = await post({ findings: [clean()], not_found: [], submitter: 'test-nosig' });
const unsigned = JSON.parse(store.str.get([...store.str.keys()].find(k => k.startsWith('sighting:') && JSON.parse(store.str.get(k)).submitter === 'test-nosig')));
ok('no signature stores an empty string, not undefined', unsigned.submitter_name === '');

/* 4 — what GET /api/sightings publishes. contract §4 marks submitter and source_hash unstarred:
      the anonymous browser id must never reach a reader, the nickname is the identity that does. */
const publish = ({ source_hash, submitter, ...pub }) => pub;   // exactly what api/sightings.js does
const pub = publish(signed);
ok('public view drops source_hash', !('source_hash' in pub));
ok('public view drops the anonymous submitter id', !('submitter' in pub));
ok('public view keeps the signature and the quote', pub.submitter_name === 'Kidult 果核' && 'definition_quote' in pub);

/* 5 — idempotence: same article + same terms again must not double count */
const before = store.z.get('recent').size, docsBefore = store.set.get('docs').size;
r = await post({ findings: fixture, not_found: [], submitter: 'test-a' });
ok('re-feed: accepted again', r.body.accepted === 4);
ok('re-feed: recent did NOT grow (one sighting per document+term)',
   store.z.get('recent').size === before, `${before} -> ${store.z.get('recent').size}`);
ok('re-feed: docs did NOT grow',
   store.set.get('docs').size === docsBefore, `${docsBefore} -> ${store.set.get('docs').size}`);

/* 6 — legacy ids are honoured once docterm is backfilled */
store.hash.get('docterm').set([...store.hash.get('docterm').keys()].find(k => k.endsWith('|rag')), 'job42-7');
r = await post({ findings: [fixture[0]], not_found: [], submitter: 'test-a' });
ok('legacy id reused instead of forking a duplicate', store.str.has('sighting:job42-7'));

/* 7 — guards */
ok('GET refused', (await handler({ method: 'GET', headers: {} }, res())).code === 405);
ok('non-array findings refused', (await post({ findings: 'nope' })).code === 400);
ok('over 50 findings refused', (await post({ findings: new Array(51).fill(fixture[0]) })).code === 413);

let last;
for (let i = 0; i < 70; i++) last = await post({ findings: [fixture[0]], not_found: [], submitter: 'flooder' });
ok('hourly limit kicks in', last.code === 429, `code=${last.code}`);

/* 8 — a submission where everything is rejected still answers per contract §5 */
r = await post({ findings: [fixture[9]], not_found: [], submitter: 'test-b' });
ok('all-rejected submission returns 200 with accepted 0',
   r.code === 200 && r.body.accepted === 0 && r.body.rejected[0].reasons.includes('STOPLISTED'));

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
