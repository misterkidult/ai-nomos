/* ai-nomos shared: lexicon, sightings, i18n. Contract: context/contract.md v1 */
window.NOMOS = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let LANG = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lang') || 'zh';
  const I18N = {
    zh: {
      tagline: '約定成俗 —— AI 的詞，由大家怎麼用決定。想改字典，拿一篇文章來。',
      nTerms: '則白話詞條', nSightings: '則目擊', nSources: n => '來自 ' + n + ' 篇文章', nFresh: '個字典裡還沒有的新詞', nContrib: '位貢獻者',
      fresh: '最近被看見的新詞', freshNote: '（agent 從文章裡帶回來、字典還沒收的）', freshEmpty: '還沒有 —— 第一個新詞會出現在這裡。',
      active: '最近有動靜的已知詞', activeNote: '（近 30 天目擊最多）', activeEmpty: '近 30 天沒有目擊。',
      all: '全部詞條', filterPh: '找一個詞（詞、中文、別名都找）', count: n => '（' + n + ' 則）',
      contribute: '想改字典？', bring: '拿一篇文章來', contributeNote: '唯一的編輯動作是提交一筆目擊 —— 到了那頁才用到 agent（WebMCP）；沒 agent 也能貼全文本地比對。',
      firstSeen: d => '第一次被看見 ' + d, sources: n => n + ' 份來源', sightings: n => n + ' 次目擊', quiet: n => '安靜 ' + n + ' 天', conflict: '用法矛盾', newTerm: '新詞', times: n => n + ' 次',
      assumedNoDef: '假設你懂，還沒有人給定義句', editorial: '字典白話（editorial，不進信號）：',
      noSightings: '還沒有任何目擊 —— 拿一篇提到它的文章來。', noDefs: '有人看見它，但還沒有人給定義句。',
      evidence: '只給證據不裁判；要引用就引用帶來源的那句。', back: '← 回字典', notFound: '字典裡沒有這個詞，也還沒有人看見它。',
      apiDown: '目擊資料層尚未上線（8/29）；現在顯示的是空狀態。', demoOn: '示範資料（fixtures/sightings-sample.json），不是真目擊。',
      nLast: '最近一次目擊', hot: '本週在夯', hotNote: '（近 7 天目擊數；字越大越常被看見，↑＝本週才進榜）', hotEmpty: '近 7 天沒有目擊。', up: '↑ 新進榜',
      sell: '🟢 大家在賣什麼', risk: '🔴 大家在擔心什麼', feed: '動態牆', feedNote: '（最新目擊，每一條都有來源）', feedEmpty: '還沒有目擊。', seenIn: (src, term) => '有人在《' + src + '》看到' + term, allLink: n => '全部 ' + n + ' 則 →', noMatch: '沒有符合的詞。',
      justNow: '剛剛', hoursAgo: n => n + ' 小時前', yesterday: '昨天', daysAgo: n => n + ' 天前',
      enums: { has_definition: '有定義句', mentioned: '順帶提到', assumed: '假設你懂', selling_point: '賣點', technical: '技術描述', risk_or_limit: '風險或限制' },
      lang: 'EN'
    },
    en: {
      tagline: 'Nomos — AI words mean what people use them to mean. To change the dictionary, bring an article.',
      nTerms: 'plain-language entries', nSightings: 'sightings', nSources: n => 'from ' + n + ' articles', nFresh: 'new terms not yet in the dictionary', nContrib: 'contributors',
      fresh: 'Recently seen new terms', freshNote: '(brought back by agents from articles; not yet in the dictionary)', freshEmpty: 'None yet — the first new term will appear here.',
      active: 'Known terms with recent activity', activeNote: '(most sightings in the last 30 days)', activeEmpty: 'No sightings in the last 30 days.',
      all: 'All entries', filterPh: 'Find a term (term, Chinese, aliases)', count: n => '(' + n + ')',
      contribute: 'Want to change the dictionary?', bring: 'Bring an article', contributeNote: 'The only edit is submitting a sighting — the agent (WebMCP) comes in on that page; without one you can paste text for a local match.',
      firstSeen: d => 'first seen ' + d, sources: n => n + ' sources', sightings: n => n + ' sightings', quiet: n => 'quiet ' + n + ' days', conflict: 'conflicting usage', newTerm: 'new', times: n => n + '×',
      assumedNoDef: 'assumed known; nobody has defined it yet', editorial: 'hand-written line (editorial, not a signal): ',
      noSightings: 'No sightings yet — bring an article that mentions it.', noDefs: 'Seen, but no source has defined it yet.',
      evidence: 'Evidence only, no ruling; cite the quote with its source.', back: '← back to the dictionary', notFound: 'Not in the dictionary, and nobody has seen it yet.',
      apiDown: 'Sighting storage is not live yet (8/29); this is the empty state.', demoOn: 'Demo data (fixtures/sightings-sample.json), not real sightings.',
      nLast: 'last sighting', hot: 'Hot this week', hotNote: '(sightings in the last 7 days; bigger = seen more; ↑ = entered the list this week)', hotEmpty: 'No sightings in the last 7 days.', up: '↑ new',
      sell: '🟢 What people are selling', risk: '🔴 What people are worried about', feed: 'Activity', feedNote: '(latest sightings, each with its source)', feedEmpty: 'No sightings yet.', seenIn: (src, term) => 'someone saw ' + term + ' in “' + src + '”', allLink: n => 'all ' + n + ' entries →', noMatch: 'No matching term.',
      justNow: 'just now', hoursAgo: n => n + ' h ago', yesterday: 'yesterday', daysAgo: n => n + ' days ago',
      enums: { has_definition: 'has definition', mentioned: 'mentioned', assumed: 'assumed known', selling_point: 'selling point', technical: 'technical', risk_or_limit: 'risk / limit' },
      lang: '中文'
    }
  };
  if (!I18N[LANG]) LANG = 'zh';
  const T = k => I18N[LANG][k];
  const applyLang = () => {
    document.documentElement.lang = LANG === 'zh' ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-i]').forEach(el => { const v = T(el.dataset.i); if (v == null) return; if (el.dataset.attr) el.setAttribute(el.dataset.attr, v); else el.textContent = v; });
    localStorage.setItem('lang', LANG);
  };
  const toggleLang = () => { LANG = LANG === 'zh' ? 'en' : 'zh'; applyLang(); };

  let LEX = [], BUILT = '';
  const loadLexicon = () => fetch('/lexicon.json').then(r => r.json()).then(d => { LEX = d.terms; BUILT = d.built; return LEX; });
  const bySlug = slug => LEX.find(e => e.slug === slug);

  /* sightings: GET /api/sightings (contract §5). ?demo=1 → fixture. */
  const loadSightings = async (query = '') => {
    const demo = new URLSearchParams(location.search).get('demo');
    const url = demo ? '/fixtures/sightings-sample.json' : '/api/sightings' + query;
    try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); const d = await r.json(); return { ok: true, demo: !!demo, contributors: d.contributors ?? 0, sightings: d.sightings || [] }; }
    catch (e) { return { ok: false, demo: !!demo, contributors: 0, sightings: [] }; }
  };
  const termKey = s => s.term_key || (bySlug(s.term_normalized) ? s.term_normalized : String(s.term_raw || '').trim().toLowerCase());
  const groupByTerm = list => { const m = new Map(); for (const s of list) { const k = termKey(s); if (!m.has(k)) m.set(k, []); m.get(k).push(s); } return m; };
  const stats = rows => {
    /* first/last/quiet = when the dictionary received it (submitted_at); the article's own date stays on the quote */
    const dates = rows.map(s => (s.submitted_at || (s.source && s.source.published) || '').slice(0, 10)).filter(Boolean).sort();
    const defs = rows.filter(s => s.definition_quote);
    return { sightings: rows.length, sources: new Set(rows.map(s => (s.source && s.source.url) || s.id)).size, first: dates[0] || null, last: dates[dates.length - 1] || null,
      quiet: dates.length ? Math.round((Date.now() - new Date(dates[dates.length - 1])) / 864e5) : null, defs, conflicting: new Set(defs.map(d => d.definition_quote)).size > 1 };
  };
  const quoteHtml = s => '<q>' + esc(s.definition_quote) + (s.source && s.source.url ? ' <a href="' + esc(s.source.url) + '" target="_blank" rel="noopener">' + esc(s.source.title || s.source.url) + '</a>' : '') + ' <span class="dim">' + esc((s.source && s.source.published) || '') + '</span></q>';
  const metaLine = st => [st.first ? T('firstSeen')(st.first) : null, T('sources')(st.sources), T('sightings')(st.sightings), st.quiet != null ? T('quiet')(st.quiet) : null].filter(Boolean).join(' · ');

  const ago = t => { const h = Math.round((Date.now() - t) / 36e5); if (h < 1) return T('justNow'); if (h < 24) return T('hoursAgo')(h); const d = Math.round(h / 24); return d === 1 ? T('yesterday') : T('daysAgo')(d); };
  return { esc, T, ago, applyLang, toggleLang, loadLexicon, bySlug, lex: () => LEX, built: () => BUILT, loadSightings, termKey, groupByTerm, stats, quoteHtml, metaLine };
})();
