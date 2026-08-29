/* Contract §3 locks. The Python reference is scripts/check-findings.py; this file must
   produce identical verdicts on fixtures/*.json — scripts/check-findings.mjs + `make locks`
   diff the two. Keep the two in step or the diff fails.

   check()       the eight codes the page also mirrors (read.html)
   checkServer() adds PII_DETECTED, which is server-only per contract §3 */

export const ENUMS = {
  explained: ['has_definition', 'mentioned', 'assumed'],
  intent: ['selling_point', 'technical', 'risk_or_limit'],
  domain: ['core', 'edge', 'not'],
};

export const REQUIRED = ['term_raw', 'term_normalized', 'sentence', 'context', 'explained', 'intent', 'domain', 'definition_quote', 'requested'];

/* contract §2, zh-Hant generic words. Extend in the contract, then here and in read.html. */
export const STOPLIST = ['導入', '自架', '本地', '整合', '平台', '系統', '流程', '資料', '知識庫', '工具', '應用', '服務', '方案', '自動化', '數位轉型', '雲端', '上線', '部署', '優化'];

/* Python's len() counts code points; JS .length counts UTF-16 units. Identical for CJK,
   different the moment an emoji shows up — count code points so the two agree. */
const cp = s => [...s].length;

export function check(f) {
  const why = new Set();
  if (REQUIRED.some(k => !(k in f))) why.add('MISSING_FIELD');
  for (const k of Object.keys(ENUMS)) if (!ENUMS[k].includes(f[k])) why.add('ENUM_INVALID');

  const s = String(f.sentence || ''), t = String(f.term_raw || '');
  if (t && s && !s.toLowerCase().includes(t.toLowerCase())) why.add('SENTENCE_LACKS_TERM');
  if (cp(s) > 120) why.add('SENTENCE_TOO_LONG');

  const q = f.definition_quote || '';
  if (q && !String(f.context || s).includes(q)) why.add('QUOTE_NOT_IN_CONTEXT');
  if (f.domain === 'edge' && !q) why.add('EDGE_WITHOUT_QUOTE');
  if (STOPLIST.includes(t.trim())) why.add('STOPLISTED');
  if (f.domain === 'not' && f.requested !== true) why.add('NOT_AI_TERM');

  return [...why].sort();
}

/* PII: pasted documents only. A finding with source.url is a public article — contract §2
   rule 5 says copy it verbatim, because the quote has to stay checkable against the page. */
const PII = [
  /[\w.+-]+@[\w-]+\.[\w.-]{2,}/,                          // email
  /(?:\+886[\s-]?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,        // TW mobile
  /(?:\+886[\s-]?|0)\d{1,2}[\s-]?\d{3,4}[\s-]?\d{4}/,     // TW landline
  /統一編號\s*[:：]?\s*\d{8}|統編\s*[:：]?\s*\d{8}/,        // 統編
  /(?:NT\$|新台幣|US\$|\$|USD|TWD)\s?\d[\d,]*(?:\.\d+)?/,  // amount, prefixed
  /\d[\d,]*(?:\.\d+)?\s*(?:元|萬元|億元)/,                  // amount, suffixed
];

export function checkServer(f) {
  const why = new Set(check(f));
  const isPublicArticle = !!(f.source && f.source.url);
  if (!isPublicArticle) {
    const blob = [f.sentence, f.context, f.definition_quote].filter(Boolean).join('\n');
    if (PII.some(re => re.test(blob))) why.add('PII_DETECTED');
  }
  return [...why].sort();
}
