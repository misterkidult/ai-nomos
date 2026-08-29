/* ai-nomos shared: lexicon, sightings, i18n. Contract: context/contract.md v1 */
window.NOMOS = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* 預設英文（2026-08-29 拍板）：這是參賽作品，第一次來的人是英文讀者。
     ?lang= 與使用者選過的語言仍優先。⚠ 引句永遠是來源語言，不因介面語言改寫 —— 
     那是證據，要能對照來源頁（契約前言 Translations are a display layer）。 */
  let LANG = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lang') || 'en';
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
      apiDown: '目擊資料層讀不到；現在顯示的是空狀態。', interim: '目擊資料層讀不到，改讀 repo 的過渡檔 sightings.json（只收公開文章）。', demoOn: '示範資料（fixtures/sightings-sample.json），不是真目擊。',
      editorialTag: '字典白話（editorial，不進信號）', explainedBy: n => '解釋這個詞的文章（' + n + '）', mentionedBy: n => '提到這個詞的文章（' + n + '）',
      nLast: '最近一次目擊', hot: '本週在夯', hotNote: '（近 7 天目擊數；字越大越常被看見，↑＝本週才進榜）', hotEmpty: '近 7 天沒有目擊。', up: '↑ 新進榜',
      sell: '🟢 大家在賣什麼', risk: '🔴 大家在擔心什麼', feed: '動態牆', feedNote: '（最新目擊，每一條都有來源）', feedEmpty: '還沒有目擊。', seenIn: (src, term) => '有人在《' + src + '》看到' + term, allLink: n => '全部 ' + n + ' 則 →', noMatch: '沒有符合的詞。',
      justNow: '剛剛', hoursAgo: n => n + ' 小時前', yesterday: '昨天', daysAgo: n => n + ' 天前',
      /* term page (08-29): senses / spellings / sell-vs-worry / jargon density */
      /* 雙語詞條（08-29）：同一個 term_key 的兩側 */
      sideZh: '中文語料', sideEn: '英文語料',
      sideCount: n => n + ' 篇文章',
      sideEmpty: l => '這個詞還沒有' + l + '目擊 —— 拿一篇來。',
      crossLead: '兩邊怎麼談它',
      crossSame: '兩邊的比重接近。',
      crossDiff: (a, b) => a + '那邊偏' + b,
      crossSell: '賣點', crossRisk: '風險', crossTech: '技術描述',
      langOf: { zh: '中文', en: '英文' },
      /* home (08-29 改版) */
      heroTag: '約定成俗 —— AI 的詞，由大家怎麼用決定。想改字典，拿一篇文章來。',
      hotLead: '詞，和最多人用的那句', hotNoQuote: '還沒有人給它定義句。',
      sellVsWorryHome: '賣它的人 vs 擔心它的人',
      freshHome: '個新詞剛從文章裡掉出來', freshFell: n => '從 ' + n + ' 篇文章裡掉出來，沒人解釋它。',
      unnamed: '還沒名分',
      feedHome: '最近讀過的文章，每篇丟出幾個詞', feedThrew: n => '這篇丟出 ' + n + ' 個詞',
      onlyEdit: '唯一的編輯動作是提交一筆目擊。',
      senses: d => '種說法 · 從 ' + d + ' 篇解釋它的文章裡', sameLine: n => ' ＋' + n + ' 篇同一句',
      spellings: '種寫法', moreSpellings: n => '＋另外 ' + n + ' 種寫法',
      sellVsWorry: '賣它的人 vs 擔心它的人', sellingIt: '篇在賣它', technicalN: n => n + ' 篇技術描述', worriedIt: '篇在擔心它',
      howGood: '篇說它有多好', howBad: '篇說它有多危險', noQuoteSide: '沒有人在這一邊留下定義句。',
      onlyMention: (more, n) => (more ? '另外 ' : '') + n + ' 篇只是提到：',
      density: '術語濃度', mentions: '次被提到', explainedN: '次有人解釋', assumedN: '次假設你懂',
      vAssumed: '多半直接當你懂 —— 這個詞最容易被丟著不管。', vFriendly: '解釋的人比丟著不管的多，算是友善的詞。', vPassing: '大多順帶提到，講的人不覺得需要解釋。',
      mentionNoExplain: '篇提到它但沒解釋',
      editorialInline: '字典白話，不進信號',
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
      apiDown: 'Sighting storage is unreachable; this is the empty state.', interim: 'Sighting storage is unreachable; falling back to sightings.json in the repo (public articles only).', demoOn: 'Demo data (fixtures/sightings-sample.json), not real sightings.',
      editorialTag: 'hand-written line (editorial, not a signal)', explainedBy: n => 'Articles that explain it (' + n + ')', mentionedBy: n => 'Articles that mention it (' + n + ')',
      nLast: 'last sighting', hot: 'Hot this week', hotNote: '(sightings in the last 7 days; bigger = seen more; ↑ = entered the list this week)', hotEmpty: 'No sightings in the last 7 days.', up: '↑ new',
      sell: '🟢 What people are selling', risk: '🔴 What people are worried about', feed: 'Activity', feedNote: '(latest sightings, each with its source)', feedEmpty: 'No sightings yet.', seenIn: (src, term) => 'someone saw ' + term + ' in “' + src + '”', allLink: n => 'all ' + n + ' entries →', noMatch: 'No matching term.',
      justNow: 'just now', hoursAgo: n => n + ' h ago', yesterday: 'yesterday', daysAgo: n => n + ' days ago',
      /* term page (08-29) */
      /* bilingual term page (08-29) */
      sideZh: 'Chinese sources', sideEn: 'English sources',
      sideCount: n => n + ' articles',
      sideEmpty: l => 'No ' + l + ' sightings for this term yet — bring one.',
      crossLead: 'How the two sides talk about it',
      crossSame: 'The two sides lean about the same way.',
      crossDiff: (a, b) => a + ' leans ' + b,
      crossSell: 'selling', crossRisk: 'worried', crossTech: 'technical',
      langOf: { zh: 'Chinese', en: 'English' },
      /* home (08-29) */
      heroTag: 'Nomos — AI words mean what people use them to mean. To change the dictionary, bring an article.',
      hotLead: 'the term, and the line most people use', hotNoQuote: 'Nobody has defined it yet.',
      sellVsWorryHome: 'Those selling it vs those worried about it',
      freshHome: 'new terms just fell out of articles', freshFell: n => 'Fell out of ' + n + ' articles; nobody explained it.',
      unnamed: 'UNNAMED',
      feedHome: 'articles just read, and the terms each threw out', feedThrew: n => 'This article threw out ' + n + ' terms',
      onlyEdit: 'The only edit is submitting a sighting.',
      senses: d => 'readings · from ' + d + ' articles that explain it', sameLine: n => ' +' + n + ' more with the same line',
      spellings: 'spellings', moreSpellings: n => '+' + n + ' more spellings',
      sellVsWorry: 'Those selling it vs those worried about it', sellingIt: ' selling it', technicalN: n => n + ' technical', worriedIt: ' worried about it',
      howGood: ' say how good it is', howBad: ' say how dangerous it is', noQuoteSide: 'No definition quote on this side.',
      onlyMention: (more, n) => (more ? 'Another ' : '') + n + ' only mention it: ',
      density: 'Jargon density', mentions: 'mentions', explainedN: 'explained', assumedN: 'assumed known',
      vAssumed: 'Mostly assumed known — the term readers are most likely to be left alone with.', vFriendly: 'More people explain it than assume it; a friendly term.', vPassing: 'Mostly mentioned in passing; writers don’t feel it needs explaining.',
      mentionNoExplain: 'articles mention it without explaining',
      editorialInline: 'editorial line, not a signal',
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

  /* Translation display layer (contract.md §2, "Translations are a display layer").
     Keyed by the source string; never stored with a sighting. Missing key → show the original. */
  let TR = null;
  const loadTranslations = () => LANG === 'zh' ? Promise.resolve(null)
    : fetch('/en.json').then(r => r.ok ? r.json() : null).then(d => (TR = d)).catch(() => null);
  /* quote: translated line with the source kept underneath — the source is what stays checkable */
  const tq = z => { z = String(z ?? '').trim(); const e = TR && TR.quotes && TR.quotes[z];
    return e && e !== z ? esc(e) + '<span class="orig">' + esc(z) + '</span>' : esc(z); };
  /* editorial line: keyed by slug */
  const tline = e => esc((TR && TR.lexicon && TR.lexicon[e.slug]) || e.line);

  /* sightings: GET /api/sightings (contract §5). ?demo=1 → fixture. */
  const loadSightings = async (query = '') => {
    const demo = new URLSearchParams(location.search).get('demo');
    const url = demo ? '/fixtures/sightings-sample.json' : '/api/sightings' + query;
    const get = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
    try { const d = await get(url); return { ok: true, demo: !!demo, contributors: d.contributors ?? 0, sightings: d.sightings || [] }; }
    catch (e) {
      /* fallback while GET /api/sightings is down: the static file in the repo (public articles only, no sentence/context). Ruling 2026-08-29: it stays until the video is recorded on 9/2, then goes. */
      try { const d = await get('/sightings.json'); let list = d.sightings || []; const m = query.match(/term_key=([^&]+)/); if (m) list = list.filter(s => s.term_key === decodeURIComponent(m[1])); return { ok: true, interim: true, demo: false, contributors: d.contributors ?? 0, sightings: list }; }
      catch (e2) { return { ok: false, demo: !!demo, contributors: 0, sightings: [] }; }
    }
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

  /* 捲動進場：對齊 coreplay 2027 官網 main.js（stagger +70ms 封頂 420ms、
     threshold .08、rootMargin -6%、reduced-motion 直接顯示）。
     draw() 後呼叫一次；已掛過的不重掛。 */
  /* ⚠ 目標必須是小元素，不能是整段容器：容器比視窗高時它的頂端永遠跨不過
     threshold，整段就停在 opacity:0（2026-08-29 踩過，首頁四個色帶全空白）。
     官網 main.js 的 REVEAL_TARGETS 也是逐個小元件列出來的。 */
  const reveal = (selector = '.sec h2, .sense, .hotl .h, .fr .f, .fd .i, .sr .row, .vs q, .b-qg .q, .refs div, .forms, .dens, .bar, .verdict, .foot, .cx, .sides') => {
    const els = [...document.querySelectorAll(selector)].filter(el => !el.classList.contains('rv'));
    if (!els.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(el => el.classList.add('rv', 'is-in')); return;
    }
    const idx = new Map();
    els.forEach(el => {
      el.classList.add('rv');
      const parent = el.parentElement, i = idx.get(parent) ?? 0;
      idx.set(parent, i + 1);
      el.style.setProperty('--d', `${Math.min(i * 70, 420)}ms`);
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add('is-in'); io.unobserve(e.target); });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
  };

  const ago = t => { const h = Math.round((Date.now() - t) / 36e5); if (h < 1) return T('justNow'); if (h < 24) return T('hoursAgo')(h); const d = Math.round(h / 24); return d === 1 ? T('yesterday') : T('daysAgo')(d); };
  return { esc, T, ago, reveal, lang: () => LANG, applyLang, toggleLang, loadLexicon, bySlug, lex: () => LEX, built: () => BUILT, loadTranslations, tq, tline, loadSightings, termKey, groupByTerm, stats, quoteHtml, metaLine };
})();
