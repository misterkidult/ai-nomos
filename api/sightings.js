/* GET /api/sightings — contract §5. Public (★) fields only; sentence/context never leave the server.
   ?term_key=<slug>  one term        ?days=30  the trending window        no query  latest 200
   200 (MAX) is the ceiling on every path, not just the default one — see the comment on it below. */

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
const MAX = 200;

/* Contract §4 marks the public fields with ★; everything else stays on the server. This is an
   allowlist on purpose: stripping the private fields instead would publish every new field a
   later writer adds, and sentence/context are the two that must never leave. `id` is not starred
   in §4 but the pages use it — see context/loop-spec.md, open question for the contract owner. */
const PUBLIC = ['id', 'term_key', 'term_raw', 'term_normalized', 'explained', 'intent', 'domain',
  'definition_quote', 'origin', 'submitted_at', 'submitter_name', 'lang'];

const publish = s => {
  const out = {};
  for (const k of PUBLIC) if (s[k] !== undefined) out[k] = s[k];
  // source.hash is the dedup key, not public; the url/title/published are what make a quote checkable
  if (s.source) out.source = { url: s.source.url, title: s.source.title, published: s.source.published };
  return out;
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'storage not configured' });

  try {
    const q = new URL(req.url, 'http://x').searchParams;
    const termKey = q.get('term_key');
    const days = parseInt(q.get('days') || '', 10);
    const lang = q.get('lang');   // contract §4: the source document's language, zh|en

    /* MAX applies to every path, not just the default one. Each id becomes its own GET below, so
       an uncapped query is an amplifier: `?days=99999` puts `since` in the past, matches the whole
       `recent` set and turns one HTTP request into one Redis command per stored sighting (~1,300
       today). `s-maxage` does not stop it either — the CDN keys on the full URL and this handler
       ignores every parameter but three, so `&z=<random>` misses the cache every time.
       The cap is asked for in the command AND applied to the answer: the LIMIT keeps the range
       scan from returning the whole set, and the slice holds the ceiling whatever a command
       happens to return. 200 is not a new number — contract §5 already states it. */
    let ids;
    if (termKey) {
      [ids] = await redis([['ZREVRANGE', `by_term:${termKey}`, 0, MAX - 1]]);
    } else if (Number.isFinite(days) && days > 0) {
      const since = Math.floor(Date.now() / 1000) - days * 86400;
      [ids] = await redis([['ZREVRANGEBYSCORE', 'recent', '+inf', since, 'LIMIT', 0, MAX]]);
    } else {
      [ids] = await redis([['ZREVRANGE', 'recent', 0, MAX - 1]]);
    }
    ids = (ids || []).slice(0, MAX);

    /* Totals are counted server-side over the WHOLE set, never derived from the capped page above.
       The 200 cap (S3) means `sightings` is a window, so a page that counted its own rows would
       report the window instead of the dictionary — "N terms / N documents" would silently shrink
       to whatever fits. These are set cardinalities (ZCARD/SCARD), one command each, so they cost
       nothing next to the per-id GETs and stay correct however small the window gets. */
    const [contributors, totalSightings, totalDocs] = await redis([
      ['SCARD', 'contributors'], ['ZCARD', 'recent'], ['SCARD', 'docs'],
    ]);
    const blobs = ids.length ? await redis(ids.map(id => ['GET', `sighting:${id}`])) : [];
    // Allowlist (PR #2): stripping private fields instead would publish every new field a later
    // writer adds. submitter_name (★ in §4) is the one identity meant to be seen; submitter and
    // source_hash stay server-side.
    const sightings = blobs
      .filter(Boolean)
      .map(b => (typeof b === 'string' ? JSON.parse(b) : b))
      .map(publish)
      // §5: ?lang= narrows to one language side of a term. Unknown values match nothing rather
      // than silently returning everything.
      .filter(s => !lang || s.lang === lang);

    // 60s CDN cache: the feed changes only when an agent submits, and stale-while-revalidate
    // keeps the page fast without ever serving something more than a minute behind.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      contract_version: 1,
      contributors: contributors || 0,
      /* Whole-corpus counts; `sightings` below is at most MAX records of it. */
      totals: { sightings: totalSightings || 0, documents: totalDocs || 0 },
      capped: sightings.length >= MAX,
      sightings,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
