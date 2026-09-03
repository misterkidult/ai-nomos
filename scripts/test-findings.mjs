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
/* members of a sorted set, highest score first — what ZREVRANGE* read from */
const desc = key => [...(store.z.get(key) || new Map())].sort((a, b) => b[1] - a[1]).map(([m]) => m);

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
      case 'SCARD': return { result: (store.set.get(key) || new Set()).size };
      case 'ZCARD': return { result: (store.z.get(key) || new Map()).size };
      /* the two read commands api/sightings.js issues. Members newest first, exactly like Redis. */
      case 'ZREVRANGE': { const s = desc(key); const [a, b] = [+rest[0], +rest[1]];
        return { result: s.slice(a, b < 0 ? undefined : b + 1) }; }
      case 'ZREVRANGEBYSCORE': { let s = desc(key).filter(m => +store.z.get(key).get(m) >= +rest[1]);
        const i = rest.findIndex(x => String(x).toUpperCase() === 'LIMIT');
        if (i >= 0) s = s.slice(+rest[i + 1], +rest[i + 1] + +rest[i + 2]);
        return { result: s }; }
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

/* 9 — 儲存層守衛：覆寫防護（S1）與 url scheme allowlist（S4／M3）。
      整段走自己的 IP 桶，免得跟上面的限額測試互吃額度。 */
const { createHash } = await import('node:crypto');
const sha16 = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const IP = { 'x-forwarded-for': '198.51.100.7' };

/* 9a — 別人的紀錄擋得住，而且一個位元都不准動。
   攻擊者只用公開欄位：url 與 term_key 都是 ★（契約 §4），照抄就能重算出覆寫鑰匙。
   換掉的引句仍是 context 的子字串，所以契約 §3 九條鎖全過 —— 唯一擋得住它的就是覆寫檢查。 */
const OWNED = 'https://example.com/owned';
const owned = { ...fixture[0], source: { ...fixture[0].source, url: OWNED } };
r = await post({ findings: [owned], not_found: [], submitter: 'owner-1', submitter_name: '原作者' }, IP);
ok('S1 前置：原作者寫入成功', r.body.accepted === 1, `accepted=${r.body.accepted}`);
const ownedId = store.hash.get('docterm').get(`${sha16(OWNED)}|rag`);
const ownedBefore = store.str.get(`sighting:${ownedId}`);
r = await post({ findings: [{ ...owned, definition_quote: '它讓模型先查再答。' }],
                 not_found: [], submitter: 'attacker', submitter_name: 'PWNED' }, IP);
ok('S1：覆寫他人紀錄被擋', r.body.accepted === 0 && r.body.rejected.length === 1,
   `accepted=${r.body.accepted} rejected=${r.body.rejected.length}`);
ok('S1：被擋的那筆計入 rejected 但不帶 §3 拒絕碼',
   r.body.rejected[0].reasons.length === 0, JSON.stringify(r.body.rejected[0].reasons));
ok('S1：原紀錄一個位元都沒動', store.str.get(`sighting:${ownedId}`) === ownedBefore);

/* 9b — 同一個 submitter 覆寫自己的紀錄，契約 §5「re-feeding overwrites」照舊成立 */
r = await post({ findings: [{ ...owned, definition_quote: '它讓模型先查再答。' }],
                 not_found: [], submitter: 'owner-1', submitter_name: '原作者' }, IP);
ok('S1：同 submitter 覆寫自己仍放行',
   r.body.accepted === 1 &&
   JSON.parse(store.str.get(`sighting:${ownedId}`)).definition_quote === '它讓模型先查再答。');

/* 9c — 開張那 1,314 筆是 scripts/kv-load.py 直接灌的，row 裡根本沒有 submitter 欄位
   （kv-load.py:60-67）。那是權威資料，從此透過本端點永久不可覆寫。 */
const LEGACY = 'https://example.com/kv-load-batch';
store.hash.get('docterm').set(`${sha16(LEGACY)}|rag`, 'job7-3');
store.str.set('sighting:job7-3', JSON.stringify({
  id: 'job7-3', term_key: 'rag', definition_quote: '開張批次的權威引句。',
  origin: 'agent', contract_version: 1,        // ⚠ 故意沒有 submitter，與 kv-load.py 的 row 一致
}));
r = await post({ findings: [{ ...fixture[0], source: { ...fixture[0].source, url: LEGACY } }],
                 not_found: [], submitter: 'anyone' }, IP);
ok('S1：submitter 為 undefined 的開張資料被擋',
   r.body.accepted === 0 && r.body.rejected.length === 1, `accepted=${r.body.accepted}`);
ok('S1：開張資料的引句沒被換掉',
   JSON.parse(store.str.get('sighting:job7-3')).definition_quote === '開張批次的權威引句。');

/* 9d — url scheme 用 allowlist。前四種是 2026-09-03 實測會穿過字串比對、瀏覽器仍正規化成
   `javascript:` 的變形（報告附錄二）；後兩種是 data: 與根本解析不了的字串。 */
const badUrls = [
  ['javascript:', 'javascript:alert(1)'],
  ['大小寫混合', 'JaVaScRiPt:alert(1)'],
  ['前置空白', '  javascript:alert(1)'],
  ['內嵌 tab', 'java\tscript:alert(1)'],
  ['data:', 'data:text/html,<script>alert(1)</script>'],
  ['解析不了的字串', 'x'],
];
let blocked = 0, noCode = 0;
for (const [label, u] of badUrls) {
  const rr = await post({ findings: [{ ...fixture[0], source: { ...fixture[0].source, url: u } }],
                          not_found: [], submitter: `xss-${label}` }, IP);
  if (rr.body.accepted === 0 && rr.body.rejected.length === 1) blocked++;
  if (rr.body.rejected[0] && rr.body.rejected[0].reasons.length === 0) noCode++;
}
ok(`S4：${badUrls.length} 種非 http(s) url 全部被擋`, blocked === badUrls.length,
   `擋下 ${blocked}/${badUrls.length}`);
ok('S4：被擋的那筆計入 rejected 但不帶 §3 拒絕碼', noCode === badUrls.length);
ok('S4：沒有任何非 http(s) url 進到儲存',
   ![...store.str.values()].some(v => /javascript|data:text\/html/i.test(v)));

/* 9e — M3：`source:{url:"x"}` 不再是 PII 鎖的免死金牌。fixtures 第 12 筆是夾帶個資的貼上文件，
   加一個假 url 本來能讓 _locks.js 把它當公開文章而跳過 PII 正則。 */
r = await post({ findings: [{ ...fixture[12], source: { url: 'x' } }],
                 not_found: [], submitter: 'pii-bypass' }, IP);
ok('M3：拿不合法 url 跳過 PII 鎖，整筆被擋',
   r.body.accepted === 0 && r.body.rejected.length === 1, `accepted=${r.body.accepted}`);

/* 9f — 守衛不能做成全擋：合法 https 的新文件照樣寫得進去 */
r = await post({ findings: [clean()], not_found: [], submitter: 'still-works' }, IP);
ok('合法 https url 不受影響', r.body.accepted === 1, `accepted=${r.body.accepted}`);

/* 10 — S2：大小與型別。每一筆都刻意過得了契約 §3 的九條鎖 —— 擋下它們的只能是新的 badShape。 */
const IP2 = { 'x-forwarded-for': '198.51.100.11' };
let s2n = 0;
/* 乾淨底稿，每次換一篇新文件，免得撞上 S1 的覆寫檢查 */
const s2 = over => ({ ...fixture[0], source: { ...fixture[0].source, url: `https://example.com/s2-${s2n++}` }, ...over });
/* 引句必須是 context 的子字串（§3 QUOTE_NOT_IN_CONTEXT），所以兩個一起給 */
const withQuote = q => s2({ definition_quote: q, context: `前一句。${q}後一句。` });

/* 10a — definition_quote：300 是上限不是禁令，301 整筆被拒、不截斷 */
r = await post({ findings: [withQuote('長'.repeat(300))], not_found: [], submitter: 's2-300' }, IP2);
ok('S2：definition_quote 剛好 300 字仍收', r.body.accepted === 1, `accepted=${r.body.accepted}`);
const quote301 = '溢'.repeat(301);   // 跟上面那筆合法的 300 字用不同的字，才驗得出「有沒有被截斷存進去」
r = await post({ findings: [withQuote(quote301)], not_found: [], submitter: 's2-301' }, IP2);
ok('S2：definition_quote 301 字整筆被拒',
   r.body.accepted === 0 && r.body.rejected.length === 1, `accepted=${r.body.accepted}`);
ok('S2：被拒的那筆不帶 §3 拒絕碼', r.body.rejected[0].reasons.length === 0,
   JSON.stringify(r.body.rejected[0].reasons));
ok('S2：超長引句沒有被截斷後存進去（儲存裡沒有它的任何前綴）',
   ![...store.str.values()].some(v => v.includes('溢')));

/* 10b — context：不落地，但仍要有界。2000 是上限，2001 整筆被拒 */
const Q = fixture[0].definition_quote;
const ctx = n => Q + '甲'.repeat(n - [...Q].length);
r = await post({ findings: [s2({ definition_quote: Q, context: ctx(2000) })],
                 not_found: [], submitter: 's2-ctx-ok' }, IP2);
ok('S2：context 剛好 2000 字仍收', r.body.accepted === 1, `accepted=${r.body.accepted}`);
r = await post({ findings: [s2({ definition_quote: Q, context: ctx(2001) })],
                 not_found: [], submitter: 's2-ctx-big' }, IP2);
ok('S2：context 2001 字整筆被拒',
   r.body.accepted === 0 && r.body.rejected.length === 1, `accepted=${r.body.accepted}`);

/* 10c — 型別。報告 S2 的原攻擊：term_raw 傳巢狀物件，鎖看的是 String(f.term_raw) ＝
   "[object Object]"，只要 sentence 含這串就過鎖，但存進去的是原始物件。 */
const badTypes = [
  ['term_raw 是物件', s2({ term_raw: { evil: 'x'.repeat(50) },
                           sentence: '這篇提到 [object Object] 這個講法。' })],
  ['definition_quote 是數字', s2({ definition_quote: 12345, context: '前一句。12345 後一句。' })],
  ['term_normalized 是陣列', s2({ term_normalized: ['RAG'] })],
  ['context 是 null', s2({ context: null, definition_quote: '' })],
  ['source.title 是物件', s2({ source: { url: 'https://example.com/s2-title', title: { a: 1 } } })],
  ['source 是字串', s2({ source: 'https://example.com/s2-str' })],
];
let typed = 0, typedNoCode = 0;
for (const [lbl, f] of badTypes) {
  const rr = await post({ findings: [f], not_found: [], submitter: `s2-type-${lbl}` }, IP2);
  if (rr.body.accepted === 0 && rr.body.rejected.length === 1) typed++;
  if (rr.body.rejected[0] && rr.body.rejected[0].reasons.length === 0) typedNoCode++;
}
ok(`S2：${badTypes.length} 種非字串型別全部被拒`, typed === badTypes.length,
   `擋下 ${typed}/${badTypes.length}`);
ok('S2：其中不帶 §3 拒絕碼的筆數', typedNoCode === badTypes.length, `${typedNoCode}/${badTypes.length}`);
ok('S2：沒有任何物件被序列化進儲存', ![...store.str.values()].some(v => v.includes('[object Object]')));

/* 10d — rejected[].term_raw 是標籤不是資料：超長／非字串不原樣回吐，否則拒絕本身就是放大器 */
r = await post({ findings: [s2({ term_raw: 'x'.repeat(5000), sentence: 'RAG 佔位。' })],
                 not_found: ['y'.repeat(5000), '正常詞'], submitter: 's2-echo' }, IP2);
ok('S2：回吐的 term_raw 截到 120', [...r.body.rejected[0].term_raw].length === 120,
   `len=${[...r.body.rejected[0].term_raw].length}`);
ok('S2：超長的 not_found 不回吐', JSON.stringify(r.body.not_found) === '["正常詞"]');

/* 11 — M1：偽造 x-forwarded-for 不能重置限速。攻擊模型是每次都換 submitter（繞開
   PER_SUBMITTER_HOURLY）＋每次都送不同的 XFF 前綴（舊碼取第一段，等於每次換一個新桶）。
   最後一段模擬邊緣附加上來的真實 client ip —— 那才是該計數的東西。 */
let m1;
for (let i = 0; i < 130; i++) {
  m1 = await post({ findings: [fixture[0]], not_found: [], submitter: `forge-${i}` },
                  { 'x-forwarded-for': `10.0.0.${i % 250}, 203.0.113.9` });
}
ok('M1：偽造 XFF 前綴擋不住 per-IP 限速', m1.code === 429, `code=${m1.code}`);
/* 同一輪裡另一個真的不同的 client 仍然打得進來 —— 限速沒有變成全站一個桶 */
const other = await post({ findings: [clean()], not_found: [], submitter: 'clean-ip' },
                         { 'x-forwarded-for': '198.51.100.44' });
ok('M1：真正不同的 client ip 不受牽連', other.code === 200, `code=${other.code}`);

/* 12 — S3：讀取端點的 200 筆硬上限。跑真的 api/sightings.js handler。 */
const { default: sightings } = await import(new URL('../api/sightings.js', import.meta.url));
const getSightings = async url => {
  const rr = res();
  await sightings({ method: 'GET', url, headers: {} }, rr);
  return rr;
};
/* 撐到遠超過 200 筆：recent 與 by_term:bulk 各 250 個成員 */
const recent = store.z.get('recent'), byBulk = new Map();
for (let i = 0; i < 250; i++) {
  const id = `bulk-${i}`;
  store.str.set(`sighting:${id}`, JSON.stringify({ id, term_key: 'bulk', term_raw: 'Bulk',
    definition_quote: 'x', origin: 'agent', lang: 'zh', submitted_at: '2026-09-01T00:00:00Z' }));
  recent.set(id, String(1756000000 + i));
  byBulk.set(id, String(1756000000 + i));
}
store.z.set('by_term:bulk', byBulk);
ok('S3 前置：recent 超過 200 筆', recent.size > 200, `recent=${recent.size}`);

let mark = sent.length;
let sr = await getSightings('/api/sightings?days=99999');
ok('S3：?days=99999 只回 200 筆', sr.body.sightings.length === 200,
   `got=${sr.body.sightings.length}`);
ok('S3：每個 id 一條 GET 的放大也被封頂',
   sent.slice(mark).filter(c => c[0] === 'GET').length === 200,
   `GET=${sent.slice(mark).filter(c => c[0] === 'GET').length}`);

sr = await getSightings('/api/sightings?term_key=bulk');
ok('S3：?term_key= 也吃 200 上限', sr.body.sightings.length === 200,
   `got=${sr.body.sightings.length}`);

sr = await getSightings('/api/sightings');
ok('S3：無查詢仍是最新 200 筆（行為不變）', sr.body.sightings.length === 200,
   `got=${sr.body.sightings.length}`);

sr = await getSightings('/api/sightings?days=1');
ok('S3：短窗口回傳的是窗口內的筆數，不是被墊到 200',
   sr.body.sightings.length > 0 && sr.body.sightings.length < 200,
   `got=${sr.body.sightings.length}`);

/* totals：封頂之後，整體數字必須仍然來自全集，不能是被回傳那一頁數出來的 */
sr = await getSightings('/api/sightings?days=99999');
ok('totals：sightings 是全集數，不是被封頂的那一頁',
   sr.body.totals && sr.body.totals.sightings === recent.size,
   `totals.sightings=${sr.body.totals && sr.body.totals.sightings} recent=${recent.size}`);
ok('totals：documents 來自 docs 集合',
   sr.body.totals && sr.body.totals.documents === (store.set.get('docs') || new Set()).size,
   `totals.documents=${sr.body.totals && sr.body.totals.documents}`);
ok('totals：全集數大於單頁數（這正是封頂會誤導的地方）',
   sr.body.totals.sightings > sr.body.sightings.length,
   `${sr.body.totals.sightings} > ${sr.body.sightings.length}`);
ok('capped：碰到上限時為 true', sr.body.capped === true, `capped=${sr.body.capped}`);

sr = await getSightings('/api/sightings?days=1');
ok('capped：沒碰到上限時為 false', sr.body.capped === false, `capped=${sr.body.capped}`);
ok('totals：窗口再小，全集數不變',
   sr.body.totals.sightings === recent.size,
   `totals.sightings=${sr.body.totals.sightings}`);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
