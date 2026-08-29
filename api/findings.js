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
function docLang(findings) {
  let text = findings.map(f => f.definition_quote || '').join(' ');
  const t = findings[0] && findings[0].source && findings[0].source.title;
  if (t) text += ' ' + t;
  const cjk = (text.match(CJK_RE) || []).length, latin = (text.match(LATIN_RE) || []).length;
  if (cjk + latin === 0) return 'zh';   // no evidence either way; the corpus is overwhelmingly zh
  return cjk * 3 > latin ? 'zh' : 'en';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  const notFound = (Array.isArray(body.not_found) ? body.not_found : [])
    .filter(s => typeof s === 'string' && s.trim()).slice(0, MAX_FINDINGS);

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
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  try {
    if (await overLimit(`rate:sub:${submitter}`, PER_SUBMITTER_HOURLY) ||
        await overLimit(`rate:ip:${sha16(ip)}`, PER_IP_HOURLY)) {
      return res.status(429).json({ error: 'hourly submission limit reached' });
    }

    const accepted = [], rejected = [];
    findings.forEach((f, index) => {
      const reasons = checkServer(f || {});
      if (reasons.length) rejected.push({ index, term_raw: (f && f.term_raw) || '', reasons });
      else accepted.push(f);
    });

    if (!accepted.length) {
      return res.status(200).json({
        contract_version: 1, accepted: 0, not_found: notFound, rejected, status: 'stored',
      });
    }

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
    const pairs = accepted.map(f => `${docHash(f)}|${termKey(f)}`);
    const [known] = await redis([['HMGET', 'docterm', ...pairs]]);
    const existing = Array.isArray(known) ? known : [];

    // group by document first: every sighting from one article shares its lang (§4)
    const byDoc = new Map();
    accepted.forEach(f => { const h = docHash(f) || '_';
      if (!byDoc.has(h)) byDoc.set(h, []); byDoc.get(h).push(f); });
    const langOf = new Map([...byDoc].map(([h, fs]) => [h, docLang(fs)]));

    const rows = accepted.map((f, i) => {
      const h = docHash(f), key = termKey(f);
      const id = existing[i] || (h ? `${h}-${sha16(key).slice(0, 12)}` : `p${now}-${sha16(key + submitter).slice(0, 12)}`);
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
      cmds.push(['HSET', 'docterm', pairs[i], r.id]);
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

    return res.status(200).json({
      contract_version: 1,
      accepted: rows.length,
      not_found: notFound,
      rejected,
      status: 'stored',
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
