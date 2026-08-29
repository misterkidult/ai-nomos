/* GET /api/sightings — contract §5. Public (★) fields only; sentence/context never leave the server.
   ?term_key=<slug>  one term        ?days=30  the trending window        no query  latest 200 */

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
const MAX = 200;

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

    let ids;
    if (termKey) {
      // every sighting of one term, newest first — no cap, a term has at most a few dozen
      [ids] = await redis([['ZREVRANGE', `by_term:${termKey}`, 0, -1]]);
    } else if (Number.isFinite(days) && days > 0) {
      const since = Math.floor(Date.now() / 1000) - days * 86400;
      [ids] = await redis([['ZREVRANGEBYSCORE', 'recent', '+inf', since]]);
    } else {
      [ids] = await redis([['ZREVRANGE', 'recent', 0, MAX - 1]]);
    }
    ids = ids || [];

    const [contributors] = await redis([['SCARD', 'contributors']]);
    const blobs = ids.length ? await redis(ids.map(id => ['GET', `sighting:${id}`])) : [];
    // source_hash is the dedup key, not a public field (contract §4 marks only ★ public)
    const sightings = blobs
      .filter(Boolean)
      .map(b => (typeof b === 'string' ? JSON.parse(b) : b))
      .map(({ source_hash, ...pub }) => pub);

    // 60s CDN cache: the feed changes only when an agent submits, and stale-while-revalidate
    // keeps the page fast without ever serving something more than a minute behind.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      contract_version: 1,
      contributors: contributors || 0,
      sightings,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
