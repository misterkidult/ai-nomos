/* ai-nomos contract layer — the page's half of context/contract.md.
   ⚠ 這是三方共用的唯一定義：/read 與首頁都載這一份，scripts/verify.mjs 也對著它驗
   「頁面的鎖與 §2 §3 逐字相同」。2026-08-30 從 read.html 抽出來（原本兩頁要各寫一份）。
   改這裡＝改契約，走 contract: 開頭的 commit。 */
const CONTRACT_VERSION=1;
const STOPLIST=['導入','自架','本地','整合','平台','系統','流程','資料','知識庫','工具','應用','服務','方案','自動化','數位轉型','雲端','上線','部署','優化'];
const RULES=`You are helping the user read one article. feedDocument gives you its url (fetch and read it yourself; the page never uploads it) and the terms the user wants pulled out (requested_terms). Do not take the user's list at face value: find each requested term in the article and judge it; add AI terms you notice that the user did not list; report everything with submitFindings, following these rules.
0. Order of work: call feedDocument for the link and the rules, open the article, then call reportDocument once with what you can see of it (title, byline, date, rough length, one sentence on what it is about) before you start extracting. The person is watching an otherwise blank screen while you read; that call is what tells them you reached the page. Then report the terms with submitFindings.
1. Copy, don't explain. term_raw = exactly as written. sentence = the one sentence it appears in (max 120 chars). context = that sentence plus one sentence before and after.
   definition_quote only when the document itself explains the term, and it must be a verbatim substring of context. If the document does not explain it, leave it "" — never fill from your own knowledge.
2. For each term answer three single-choice fields: explained (has_definition / mentioned / assumed), intent (selling_point / technical / risk_or_limit), domain (core / edge / not).
3. Do not report: model architecture names, training hyperparameters, algorithm names, statistics terms, or anything in the stoplist below.
4. The known-term list is in lexicon. Report known terms too (so the dictionary sees them again) and set term_normalized to the lexicon term; otherwise term_normalized = "".
5. De-identification applies only to a pasted document (no url): replace third-party company names, person names, amounts, phone numbers and emails in sentence and context with [company], [person], [amount], [phone], [email]. For a public article (url given) copy verbatim — the quote must stay checkable against the page, and the company or product that is the subject of the definition is part of the definition.
6. If a term appears several times, report it once — the occurrence that has a definition.
7. requested = true for terms from requested_terms, false for terms you added. A requested term that is not an AI term still gets a finding, with domain = not — that is your verdict, the page shows it to the user. A requested term you cannot find in the article goes to not_found, not to findings.
8. source: fill url from feedDocument, plus title and published (YYYY-MM-DD) if the article shows them.
Stoplist: ${STOPLIST.join(', ')}`;
const FINDING_SCHEMA={type:'object',additionalProperties:false,
 required:['term_raw','term_normalized','sentence','context','explained','intent','domain','definition_quote','requested'],
 properties:{
  term_raw:{type:'string',description:'exactly as written in the document'},
  term_normalized:{type:'string',description:'the lexicon term this maps to; "" if not a known term'},
  sentence:{type:'string',maxLength:120,description:'the one sentence it appears in, de-identified'},
  context:{type:'string',description:'sentence plus one sentence before and after, de-identified'},
  explained:{type:'string',enum:['has_definition','mentioned','assumed']},
  intent:{type:'string',enum:['selling_point','technical','risk_or_limit']},
  domain:{type:'string',enum:['core','edge','not']},
  definition_quote:{type:'string',description:'verbatim substring of context; "" if the document does not define the term'},
  requested:{type:'boolean',description:'true if the user listed this term in requested_terms; false if you added it'},
  source:{type:'object',additionalProperties:false,description:'where the article came from; url from feedDocument',
    properties:{url:{type:'string'},title:{type:'string'},published:{type:'string',description:'YYYY-MM-DD or ""'}},required:['url']}
 }};

/* ---------- locks (mock of the server; codes per contract §3) ---------- */
const ENUMS={explained:FINDING_SCHEMA.properties.explained.enum,intent:FINDING_SCHEMA.properties.intent.enum,domain:FINDING_SCHEMA.properties.domain.enum};
function check(f){
  const why=new Set();
  if(FINDING_SCHEMA.required.some(k=>!(k in f))) why.add('MISSING_FIELD');
  for(const k in ENUMS) if(!ENUMS[k].includes(f[k])) why.add('ENUM_INVALID');
  const s=String(f.sentence||''),t=String(f.term_raw||'');
  if(t&&s&&!s.toLowerCase().includes(t.toLowerCase())) why.add('SENTENCE_LACKS_TERM');
  if([...s].length>120) why.add('SENTENCE_TOO_LONG');   /* code points, as api/_locks.js and check-findings.py count them */
  const q=f.definition_quote||'';
  if(q&&!(f.context||s).includes(q)) why.add('QUOTE_NOT_IN_CONTEXT');
  if(f.domain==='edge'&&!q) why.add('EDGE_WITHOUT_QUOTE');
  if(STOPLIST.includes(t.trim())) why.add('STOPLISTED');
  if(f.domain==='not'&&f.requested!==true) why.add('NOT_AI_TERM');
  return [...why].sort();
}
