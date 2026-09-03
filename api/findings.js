/* POST /api/findings — the write path of contract §6. Until this existed, submitFindings
   ran entirely in the browser and returned {status:'mock'}: nothing was ever stored, so the
   one editing action the dictionary claims to have had no server side.

   Input is the submitFindings payload of contract §5: {findings: Finding[], not_found: string[]}.
   Response is that section's object, with status 'stored'.

   The locks live in api/_locks.js, kept identical to scripts/check-findings.py — see that file.
   Storage keys match scripts/kv-load.py so the live feed and the 2026-08-29 batch are one set. */

import { createHash } from 'node:crypto';
import lexicon from '../public/lexicon.json' with { type: 'json' };
import { checkServer } from './_locks.js';

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

/* Limits, not security features (contract §4 says the same of the submitter id). They keep one
   runaway agent loop from filling the store; anyone determined can still get around them. */
const MAX_FINDINGS = 50;
const PER_SUBMITTER_HOURLY = 60;
const PER_IP_HOURLY = 120;

const SLUG = new Map(lexicon.terms.map(t => [t.term, t.slug]));
const sha16 = s => createHash('sha256').update(s).digest('hex').slice(0, 16);

/* source.url is ★ public (contract §4) and every page puts it straight into an href, so the
   scheme must be an allowlist: `new URL()` parses it and only http/https survive. String matching
   does not work — `JaVaScRiPt:`, a leading space and an embedded tab all normalise back to
   `javascript:` in the browser (measured 2026-09-03, Chrome 152). A url that will not parse is a
   refusal, not a warning. Refusing it also closes the PII bypass: `source:{url:"x"}` used to make
   _locks.js:54 treat any pasted document as a public article and skip the PII regex. */
const isHttpUrl = u => {
  if (typeof u !== 'string' || !u) return false;
  try { const { protocol } = new URL(u); return protocol === 'http:' || protocol === 'https:'; }
  catch { return false; }
};
/* No url at all is a pasted document (contract §1) and stays legal. A url that is present but not
   http(s) is the case we refuse. */
const badSource = f => !!(f.source && f.source.url) && !isHttpUrl(f.source.url);

/* Python's len() counts code points, JS .length counts UTF-16 units — count code points so these
   caps read the same way contract §3's `sentence ≤ 120` does. */
const cp = s => [...s].length;

/* Size and type. Contract §3 caps `sentence` and nothing else, and REQUIRED only asks whether a
   key is present — so every other string in a finding was bounded by the HTTP body (~4.5 MB) and
   was not even required to be a string. Two consequences this closes:
     · definition_quote is ★ public and is stored forever, so one oversized quote sits in every
       GET /api/sightings answer from then on, and contract §6 leaves no endpoint that can take it
       back out again;
     · term_raw passed the locks as `String(f.term_raw)` but was STORED as the raw value, so a
       nested object went into storage whole and the 120-char sentence cap bounded nothing.
   Over the cap is a refusal of the whole finding, never a truncation: a definition quote is only
   worth storing if it is verbatim — trim it and the reader who clicks through to the article
   finds text that does not match, which is the one promise this dictionary makes. */
const LIMITS = {
  term_raw: 120,          // it has to fit inside its own sentence, which §3 already caps at 120
  term_normalized: 120,   // same shape; it is matched against a lexicon term
  sentence: 120,          // §3's own cap, repeated here only so the type check has a bound to use
  context: 2000,          // never stored — see below
  definition_quote: 300,  // ★ public and stored forever
};
/* Why context is the loose one: it never lands in storage (contract §4, and the row built below
   has no such field). It exists so the QUOTE_NOT_IN_CONTEXT lock can verify the quote against its
   surroundings — one sentence either side of a ≤120 sentence. It still needs a bound, because it
   is attacker-supplied and definition_quote only has to be a substring of it, so an unbounded
   context is an unbounded body and an unbounded parse. 2000 leaves a 300-point quote well over
   five times the room it can need, and caps a full 50-finding request near 100k code points
   instead of 4.5 MB. */
const SOURCE_LIMITS = { url: 2048, title: 300, published: 40 };
const badShape = f => {
  for (const k of Object.keys(LIMITS)) {
    const v = f[k];
    if (v === undefined) continue;                     // a missing key is §3's MISSING_FIELD, not ours
    if (typeof v !== 'string' || cp(v) > LIMITS[k]) return true;
  }
  const s = f.source;
  if (s === undefined || s === null) return false;
  if (typeof s !== 'object' || Array.isArray(s)) return true;
  for (const k of Object.keys(SOURCE_LIMITS)) {
    const v = s[k];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string' || cp(v) > SOURCE_LIMITS[k]) return true;
  }
  return false;
};

/* The rejected[] entry echoes term_raw so the caller can tell which finding was refused. It is a
   label, not stored data, so it is coerced and trimmed rather than refused: echoing an unbounded
   attacker-supplied value back would turn a refusal into an amplifier — 50 oversized term_raw in,
   the same 50 back out, at no cost to the sender. */
const label = v => (typeof v === 'string' ? [...v].slice(0, 120).join('') : '');

/* The rate-limit bucket must not be a value the caller gets to choose. `x-forwarded-for` is a
   list, and only the entry appended by the closest trusted proxy can be believed: anything the
   client sent can only ever sit BEFORE that entry. So read the LAST segment, never the first.
   That reading is safe under both possible edge behaviours without having to measure which one
   Vercel does — if the edge overwrites the header the list is the edge's alone, and if the edge
   appends, the last entry is the one the edge just added. Taking the first segment (what this did
   until 2026-09-04) is the classic XFF trap: under an appending edge it is literally the
   attacker's own string, so `-H 'x-forwarded-for: <random>'` gave every request a fresh bucket.
   Anything that is not an IP literal collapses into one shared 'unknown' bucket — stricter than
   per-caller, never looser. */
const clientIp = h => {
  const xs = String(h['x-forwarded-for'] || '').split(',');
  let ip = xs[xs.length - 1].trim();
  const bracketed = ip.match(/^\[([^\]]+)\]/);                          // [2001:db8::1]:443
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.indexOf(':'));
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || /^[0-9a-f:]{2,45}$/i.test(ip) ? ip : 'unknown';
};

async function redis(commands) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands.map(c => c.map(String))),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).map(x => x.result);
}

/* INCR then EXPIRE on first hit: an hourly bucket, no sliding window. Good enough for a limit. */
async function overLimit(key, cap) {
  const [n] = await redis([['INCR', key]]);
  if (n === 1) await redis([['EXPIRE', key, 3600]]);
  return n > cap;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/* Contract §4: lang is the language of the SOURCE DOCUMENT, not of the term — a term name is no
   evidence of the language it was used in (`Sora 2`, `Midjourney` appear in Chinese articles
   constantly; judging by term name misfiled 90 of 924 sightings in testing). Computed over one
   document's definition quotes plus its title. CJK weighs ×3 because Chinese says in one
   character roughly what English says in three, so an unweighted count calls a Chinese article
   English as soon as it quotes a few product names. Must stay identical to
   scripts/kv-backfill-lang.py. */
const CJK_RE = /[\u4e00-\u9fff]/g, LATIN_RE = /[A-Za-z]/g;
/* Kana first: Japanese prose is full of Han characters, so the CJK:Latin ratio alone reads it as
   Chinese — 11 sightings from one Japanese site sat in the Chinese side until 2026-08-30.
   Chinese never contains kana, so this test is safe to run before the ratio. */
/* ⚠ 只收真正的假名字母，不含 ・(30FB) ー(30FC) ゠(30A0) 這些標點 —— 中文文章用 ・ 當
   分隔符很常見，把整段判成日文（2026-08-30 實測誤判一篇繁中 SEO 百科）。 */
const KANA_RE = /[\u3041-\u3096\u30a1-\u30fa]/;
function docLang(findings) {
  let text = findings.map(f => f.definition_quote || '').join(' ');
  const t = findings[0] && findings[0].source && findings[0].source.title;
  if (t) text += ' ' + t;
  if (KANA_RE.test(text)) return 'ja';
  const cjk = (text.match(CJK_RE) || []).length, latin = (text.match(LATIN_RE) || []).length;
  if (cjk + latin === 0) return 'zh';   // no evidence either way; the corpus is overwhelmingly zh
  return cjk * 3 > latin ? 'zh' : 'en';
}

export default async function handler(req, res) {
  /* The write path answers same-origin browsers and non-browser callers, not other sites.
     `*` let any page anyone visits POST here with that visitor's own browser and their real IP,
     which spreads the per-IP limit across thousands of clean addresses and makes blocking an
     abusive IP hit real readers — it hands away exactly what M1 just fixed.
     A request with no Origin (curl, an agent runtime, a server) is NOT a browser cross-site
     request and stays allowed: the tools are meant to be callable from anywhere, and CORS was
     never what stopped those callers anyway. Only a browser sending someone else's Origin is
     refused, and CORS is the only mechanism that can tell that case apart. */
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const sameOrigin = !!origin && !!host && (() => {
    try { return new URL(origin).host === host; } catch { return false; }
  })();
  if (origin && !sameOrigin) return res.status(403).json({ error: 'cross-site writes are not accepted' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'storage not configured' });

  let body;
  try { body = await readBody(req); }
  catch { return res.status(400).json({ error: 'body is not JSON' }); }

  const findings = Array.isArray(body.findings) ? body.findings : null;
  if (!findings) return res.status(400).json({ error: 'findings must be an array' });
  if (findings.length > MAX_FINDINGS) {
    return res.status(413).json({ error: `at most ${MAX_FINDINGS} findings per request` });
  }
  /* Echoed back verbatim by contract §5, so it is bounded the same way rejected[].term_raw is:
     an over-long entry is dropped, not echoed. */
  const notFound = (Array.isArray(body.not_found) ? body.not_found : [])
    .filter(s => typeof s === 'string' && s.trim() && cp(s) <= 120).slice(0, MAX_FINDINGS);

  /* Anonymous browser id, held client-side. Contract §4: a limit, not a security feature.
     It is never public — api/sightings.js drops it before answering. */
  const submitter = String(body.submitter || '').trim().slice(0, 64) || 'anonymous';

  /* The nickname the submitter signed with (contract §4). Self-asserted and unverified: we
     strip control and zero-width characters so it cannot forge layout or hide inside another
     name, cap it, and otherwise take it as given. Nothing is ever derived from it — it is not
     an identity, and the counters keep using `submitter`. */
  const submitterName = [...String(body.submitter_name || '')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()].slice(0, 24).join('');
  const ip = clientIp(req.headers);

  try {
    if (await overLimit(`rate:sub:${submitter}`, PER_SUBMITTER_HOURLY) ||
        await overLimit(`rate:ip:${sha16(ip)}`, PER_IP_HOURLY)) {
      return res.status(429).json({ error: 'hourly submission limit reached' });
    }

    const accepted = [], rejected = [];

    /* Contract §5 answers with this shape whether anything reached storage or not. The three
       storage-layer guards below (a url that is not http(s), a field of the wrong type or over its
       cap, a record someone else wrote) refuse a finding with an empty `reasons`: the §3 codes are
       per-finding self-consistency checks that scripts/check-findings.py reproduces, and none of
       these guards is one of those — they need storage state, a URL parser, or a size budget that
       belongs to the store rather than to the reader. Adding a code would mean changing contract §3
       and all three lock implementations; that is a separate decision (see
       context/matt-fix-20260903.md and context/matt-fix2-20260903.md, 未決事項). */
    const answer = n => res.status(200).json({
      contract_version: 1, accepted: n, not_found: notFound, rejected, status: 'stored',
    });

    findings.forEach((f, index) => {
      const g = f || {};
      const reasons = checkServer(g);
      if (reasons.length || badSource(g) || badShape(g)) rejected.push({ index, term_raw: label(g.term_raw), reasons });
      else accepted.push({ f: g, index });
    });

    if (!accepted.length) return answer(0);

    const now = Math.floor(Date.now() / 1000);
    const nowIso = new Date(now * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

    /* Dedup key. For a public article the URL is already a ★ public field, so hashing it needs
       no salt and — this is the point — reproduces the hashes scripts/kv-load.py wrote, keeping
       the "N documents" counter one set. A pasted document has no URL; there the client-side
       salted hash of contract §4 is the only key available, so we take what it sends. */
    const docHash = f => {
      const url = f.source && f.source.url;
      if (url) return sha16(url);
      const given = String((f.source && f.source.hash) || body.source_hash || '');
      return /^[0-9a-f]{16,64}$/.test(given) ? given.slice(0, 16) : '';
    };

    const termKey = f => SLUG.get(f.term_normalized || '') || String(f.term_raw || '').trim().toLowerCase();

    /* One sighting per (document, term): contract §2 rule 6 says report a term once per
       document, so re-feeding the same article must overwrite rather than pile up. The id is
       derived from both, which makes every write idempotent — ZADD on an existing member just
       updates its score. Legacy ids from the 2026-08-29 batch are "<job_id>-<index>"; docterm
       maps (document, term) → id so those are reused too once backfilled
       (scripts/kv-backfill-docterm.py). */
    const pairs = accepted.map(a => `${docHash(a.f)}|${termKey(a.f)}`);
    const [known] = await redis([['HMGET', 'docterm', ...pairs]]);
    const existing = Array.isArray(known) ? known : [];

    /* Hitting an existing id proves nothing about who wrote it: both halves of the overwrite key
       are ★ public fields, so anyone reading GET /api/sightings can reconstruct any pair. Overwrite
       only when the stored row carries the same submitter.
       Reading those rows costs a second round trip — the HMGET result is what says which ids to
       read, so it cannot ride in the same pipeline.
       The 1,314 rows of the 2026-08-29 batch went in through scripts/kv-load.py, whose row has no
       submitter field at all, so they are permanently unwritable through this endpoint. That is the
       intended outcome: they are authoritative, and an anonymous agent has no business editing them.
       A docterm entry pointing at a row that is not there protects nothing, so it still writes —
       that is the legacy id reuse scripts/kv-backfill-docterm.py exists for. */
    const owner = new Map();
    const ids = [...new Set(existing.filter(Boolean).map(String))];
    if (ids.length) {
      const blobs = await redis(ids.map(id => ['GET', `sighting:${id}`]));
      ids.forEach((id, i) => {
        const b = blobs[i];
        if (!b) return;                                  // no row: nothing to protect
        let row = null;
        try { row = typeof b === 'string' ? JSON.parse(b) : b; } catch { /* unreadable ⇒ not yours */ }
        owner.set(id, row && typeof row.submitter === 'string' ? row.submitter : null);
      });
    }

    const writable = [];
    accepted.forEach((a, i) => {
      const id = existing[i] ? String(existing[i]) : '';
      if (id && owner.has(id) && owner.get(id) !== submitter) {
        rejected.push({ index: a.index, term_raw: label(a.f.term_raw), reasons: [] });
        return;
      }
      writable.push({ ...a, id, pair: pairs[i] });
    });
    if (!writable.length) return answer(0);

    // group by document first: every sighting from one article shares its lang (§4)
    const byDoc = new Map();
    writable.forEach(w => { const h = docHash(w.f) || '_';
      if (!byDoc.has(h)) byDoc.set(h, []); byDoc.get(h).push(w.f); });
    const langOf = new Map([...byDoc].map(([h, fs]) => [h, docLang(fs)]));

    const rows = writable.map(w => {
      const f = w.f, h = docHash(f), key = termKey(f);
      const id = w.id || (h ? `${h}-${sha16(key).slice(0, 12)}` : `p${now}-${sha16(key + submitter).slice(0, 12)}`);
      return {
        id, term_key: key,
        term_raw: f.term_raw, term_normalized: f.term_normalized || '',
        explained: f.explained, intent: f.intent, domain: f.domain,
        definition_quote: f.definition_quote || '',
        source: f.source ? { url: f.source.url || '', title: f.source.title || '', published: f.source.published || '' } : null,
        source_hash: h,
        lang: langOf.get(h || '_'),
        submitted_at: nowIso,
        origin: 'agent',
        submitter,
        submitter_name: submitterName,
        contract_version: 1,
      };
    });

    const cmds = [];
    const docs = new Map();
    rows.forEach((r, i) => {
      cmds.push(['SET', `sighting:${r.id}`, JSON.stringify(r)]);
      cmds.push(['ZADD', `by_term:${r.term_key}`, now, r.id]);
      cmds.push(['ZADD', 'recent', now, r.id]);
      cmds.push(['HSET', 'docterm', writable[i].pair, r.id]);
      if (r.source_hash && r.source && r.source.url) docs.set(r.source_hash, r.source);
    });
    for (const [h, src] of docs) {
      cmds.push(['SET', `doc:${h}`, JSON.stringify(src)]);
      cmds.push(['SADD', 'docs', h]);
    }
    cmds.push(['SADD', 'contributors', submitter]);

    const results = await redis(cmds);
    const failed = results.filter(x => x && typeof x === 'object' && 'error' in x);
    if (failed.length) throw new Error(`storage rejected ${failed.length} commands`);

    return answer(rows.length);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
