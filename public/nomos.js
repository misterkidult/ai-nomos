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
      contribute: '想改字典？', bring: '叫你的 agent 拿一篇文章給我', contributeNote: '唯一的編輯動作是提交一筆目擊 —— 到了那頁才用到 agent（WebMCP）；沒 agent 也能貼全文本地比對。',
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
      /* 合併後的首頁動線（08-30）：一段一段講現在發生什麼事 */
      stepBring:'跟你的 AI 說一句話', stepBringNote:'不用在這裡填東西。把連結給你的 AI，它會自己來叫這個字典的工具。想查哪幾個詞順口說就好，不說它也會自己判斷。',
      urlPh:'文章連結', termsPh:'想查的詞（一行一個，可留空）', nickPh:'署名（可留空）',
      sayThisLine:'讀這篇 <貼上連結>，用 ai-nomos 的 feedDocument 找出裡面的 AI 術語。',
      copied:'已複製',
      docWords:n=>n.toLocaleString()+' 字',
      confirmTitle:'這篇要進字典嗎？',
      confirmNote:'你的 AI 讀完了。按下去才會寫進字典 —— 在那之前只有你看得到。',
      confirmBtn:n=>'收進字典（'+n+' 筆）', discardBtn:'這篇不收',
      discarded:'已捨棄，沒有寫進字典', confirming:'寫入中…',
      stored:'已寫入字典', notStored:'沒有可收的（都被鎖擋下了）',
      storeFail:e=>'伺服器沒收：'+e, storeOff:e=>'連不到伺服器（'+e+'）',
      foundTitle:'它在這篇裡看到的詞', startOver:'← 換一篇',
      busyReading:'你的 AI 正在讀', busyDone:'讀完了',
      elapsed:(m,sec)=>(m?m+'m ':'')+sec+'s',

      badgeKnown:'字典有', badgeNew:'新詞', badgeYours:'你點名的', badgeAdded:'它自己補的',
      notAiTerm:'它判定這不是 AI 詞', noQuoteHere:'這篇沒有解釋它',
      nfHere:n=>'你點名但這篇裡找不到：'+n.join('、'),
      stFed:'你的 AI 拿到題目了',
      stOpened:'你的 AI 打開了這篇', stChecking:'它在跟字典核對已經有的詞',
      stCheckingN:(q,k)=>'查了 '+q+' 個，字典裡已經有 '+k+' 個',
      stReporting:'它交回目擊紀錄了', stReportingN:n=>n+' 筆，等你決定要不要收',
      stWaiting:'等你的 AI 開口', stWaitingNote:'工具已經備妥，還沒有 agent 來叫。',
      /* 伺服器擋下的原因（契約 §3）。頁面自己也跑同一組鎖，但 PII_DETECTED 只有伺服器有 ——
         所以「伺服器才是最後一關」這件事，得靠這張表講出來。 */
      codes:{MISSING_FIELD:'缺欄位',ENUM_INVALID:'選項不在 enum 內',SENTENCE_LACKS_TERM:'sentence 不含 term_raw',SENTENCE_TOO_LONG:'sentence 超過 120 字',QUOTE_NOT_IN_CONTEXT:'definition_quote 不在 context 裡',EDGE_WITHOUT_QUOTE:'domain=edge 且無定義句',STOPLISTED:'停用清單',NOT_AI_TERM:'agent 自己加的非 AI 詞',PII_DETECTED:'貼上的文件含個資或金額'},
      rejectedBy:n=>'伺服器擋下 '+n+' 筆',
      callsTitle:'WebMCP 工具呼叫', callsEmpty:'尚無呼叫。agent 叫工具時這裡會出現。',
      callsRunning:'執行中', callsN:n=>n+' 次呼叫',
      seeDict:'看字典 →', theDict:'字典本體',
      /* 首頁引導與 WebMCP 訊號（08-29） */
      howTitle: '這本字典怎麼長大',
      how1t: '你給一篇文章的連結', how1b: '還有你看不懂的那幾個詞。',
      how2t: '你的 AI 自己去讀那篇', how2b: '文章不經過我們的伺服器 —— 是它用你的瀏覽器去讀的。',
      how3t: '它讀到什麼，你決定要不要收', how3b: '每一則都附原句與來源連結，你可以自己去查。',
      mcpOn: '你的瀏覽器可以用 —— 拿一篇文章來試',
      mcpOff: '這個站是給 AI agent 用的',
      mcpOffHow: 'Chrome 152 以上原生支援；ChatGPT 桌面版要在 Work 模式開「啟用網站工具」。沒有 agent 也能用，只是變成貼全文做本地比對。',
      tryIt: '拿一篇文章來', copyBtn:'複製',
      /* 雙語詞條（08-29）：同一個 term_key 的兩側 */
      sideZh: '中文語料', sideEn: '英文語料', sideJa: '日文語料',
      sideCount: n => n + ' 篇文章',
      sideEmpty: l => '這個詞還沒有' + l + '目擊 —— 拿一篇來。',
      crossLead: '兩邊怎麼談它',
      crossSame: '兩邊的比重接近。',
      crossDiff: (a, b) => a + '那邊偏' + b,
      crossSell: '賣點', crossRisk: '風險', crossTech: '技術描述',
      langOf: { zh: '中文', en: '英文', ja: '日文' },
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
      contribute: 'Want to change the dictionary?', bring: 'Ask your agent to bring me an article', contributeNote: 'The only edit is submitting a sighting — the agent (WebMCP) comes in on that page; without one you can paste text for a local match.',
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
      /* merged home flow (08-30) */
      stepBring:'Say one thing to your AI', stepBringNote:'Nothing to fill in here. Give your AI the link and it will call this dictionary\u2019s tools itself. Name the words you want looked up if you like — it will judge for itself if you do not.',
      urlPh:'Article link', termsPh:'Terms to look for (one per line, optional)', nickPh:'Sign it (optional)',
      sayThisLine:'Read <paste link> and use ai-nomos\u2019s feedDocument to find the AI jargon in it.',
      copied:'copied',
      docWords:n=>n.toLocaleString()+' words',
      confirmTitle:'Should this article go into the dictionary?',
      confirmNote:'Your AI has read it. Nothing is written until you say so — until then only you can see this.',
      confirmBtn:n=>'Add to the dictionary ('+n+')', discardBtn:'Skip this article',
      discarded:'discarded — nothing was written', confirming:'writing…',
      stored:'written to the dictionary', notStored:'nothing to add (the locks caught them all)',
      storeFail:e=>'server refused: '+e, storeOff:e=>'server unreachable ('+e+')',
      foundTitle:'What it saw in this article', startOver:'← Start over',
      busyReading:'Your AI is reading', busyDone:'Done',
      elapsed:(m,sec)=>(m?m+'m ':'')+sec+'s',

      badgeKnown:'in the dictionary', badgeNew:'new', badgeYours:'you named it', badgeAdded:'it added this',
      notAiTerm:'it ruled this is not an AI term', noQuoteHere:'this article does not explain it',
      nfHere:n=>'You named these but they are not in the article: '+n.join(', '),
      stFed:'Your AI has the assignment',
      stOpened:'Your AI opened this article', stChecking:'It is checking the dictionary for words it already has',
      stCheckingN:(q,k)=>'looked up '+q+', the dictionary already had '+k,
      stReporting:'It sent the sightings back', stReportingN:n=>n+' of them, waiting on you',
      stWaiting:'Waiting for you to ask your AI', stWaitingNote:'The tools are ready; no agent has called them yet.',
      codes:{MISSING_FIELD:'missing field',ENUM_INVALID:'value not in enum',SENTENCE_LACKS_TERM:'sentence lacks term_raw',SENTENCE_TOO_LONG:'sentence over 120 chars',QUOTE_NOT_IN_CONTEXT:'definition_quote not in context',EDGE_WITHOUT_QUOTE:'domain=edge without quote',STOPLISTED:'stoplisted',NOT_AI_TERM:'non-AI term volunteered by the agent',PII_DETECTED:'pasted document carries PII or an amount'},
      rejectedBy:n=>'the server rejected '+n,
      callsTitle:'WebMCP tool calls', callsEmpty:'No calls yet. Tool calls from an agent appear here.',
      callsRunning:'running', callsN:n=>n+' call'+(n===1?'':'s'),
      seeDict:'See the dictionary →', theDict:'The dictionary',
      /* home explainer + WebMCP signal (08-29) */
      howTitle: 'How this dictionary grows',
      how1t: 'You bring a link to an article', how1b: 'plus the words in it you could not follow.',
      how2t: 'Your own AI goes and reads it', how2b: 'The article never touches our server — your agent reads it in your browser.',
      how3t: 'You decide what gets kept', how3b: 'Every entry carries the sentence it came from and a link back, so you can check it yourself.',
      mcpOn: 'Your browser can do this — bring an article',
      mcpOff: 'This site is built for AI agents',
      mcpOffHow: 'Chrome 152+ supports it natively; in the ChatGPT desktop app, turn on site tools in Work mode. It still works without an agent — you paste the text and the page matches known terms itself.',
      tryIt: 'Bring an article', copyBtn:'copy',
      /* bilingual term page (08-29) */
      sideZh: 'Chinese sources', sideEn: 'English sources', sideJa: 'Japanese sources',
      sideCount: n => n + ' articles',
      sideEmpty: l => 'No ' + l + ' sightings for this term yet — bring one.',
      crossLead: 'How the two sides talk about it',
      crossSame: 'The two sides lean about the same way.',
      crossDiff: (a, b) => a + ' leans ' + b,
      crossSell: 'selling', crossRisk: 'worried', crossTech: 'technical',
      langOf: { zh: 'Chinese', en: 'English', ja: 'Japanese' },
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
  const reveal = (selector = '.sec h2, .sense, .hotl .h, .fr .f, .tf, .fd .i, .sr .row, .vs q, .b-qg .q, .refs div, .forms, .dens, .bar, .verdict, .foot, .cx, .sides') => {
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

  /* WebMCP 偵測。
     ⚠ 這只回答「這個瀏覽器看得到 API 嗎」，不回答「agent 真的會叫我的工具嗎」——
     兩者會斷在不同地方：Claude in Chrome 有 modelContext 卻不把頁面工具接進它的
     清單（2026-08-27 探針實測），所以①綠②永遠不亮。第二個訊號只有首頁上
     feedDocument 真的被呼叫過才算數。
     API 可能在載入後才注入，所以輪詢一小段時間才判定沒有。 */
  const mcp = () =>
    (typeof document.modelContext?.registerTool === 'function') ? document.modelContext
    : (navigator.modelContext && typeof navigator.modelContext.registerTool === 'function') ? navigator.modelContext
    : null;
  const onMcp = (cb, ms = 3000) => {
    const t0 = Date.now();
    const tick = () => { const m = mcp();
      if (m) return cb(m);
      if (Date.now() - t0 > ms) return cb(null);
      setTimeout(tick, 200); };
    tick();
  };

  const ago = t => { const h = Math.round((Date.now() - t) / 36e5); if (h < 1) return T('justNow'); if (h < 24) return T('hoursAgo')(h); const d = Math.round(h / 24); return d === 1 ? T('yesterday') : T('daysAgo')(d); };
  return { esc, T, ago, reveal, mcp, onMcp, lang: () => LANG, applyLang, toggleLang, loadLexicon, bySlug, lex: () => LEX, built: () => BUILT, loadTranslations, tq, tline, loadSightings, termKey, groupByTerm, stats, quoteHtml, metaLine };
})();
