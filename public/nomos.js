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
      apiDown: '目擊資料層讀不到；現在顯示的是空狀態。', demoOn: '示範資料（fixtures/sightings-sample.json），不是真目擊。',
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
      doneThanks:'謝謝你的貢獻', doneCount:n=>n, doneUnit:n=>'個詞進了字典',
      doneTitle:n=>'進字典了 —— '+n+' 筆',
      doneNote:'這些詞現在誰都看得到了。字典剛剛長大了一點。',
      doneNothing:'這篇沒有可收的', doneAgain:'再看一次字典',
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
      callsTitle:'AGENT ↔ 這一頁', callsEmpty:'還沒有 agent 來叫工具。它一呼叫，這裡就會出現。',
      callsFromAgent:'agent → 這一頁', callsToAgent:'這一頁 → agent',
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
      apiDown: 'Sighting storage is unreachable; this is the empty state.', demoOn: 'Demo data (fixtures/sightings-sample.json), not real sightings.',
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
      doneThanks:'Thanks for contributing', doneCount:n=>n, doneUnit:n=>n===1?'term entered the dictionary':'terms entered the dictionary',
      doneTitle:n=>'In the dictionary — '+n+' added',
      doneNote:'Anyone can see these now. The dictionary just grew.',
      doneNothing:'nothing from this article', doneAgain:'back to the dictionary',
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
      callsTitle:'AGENT ↔ THIS PAGE', callsEmpty:'No agent has called a tool yet. The moment one does, it shows up here.',
      callsFromAgent:'agent → page', callsToAgent:'page → agent',
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
      lang: '日本語'
    },
    ja: {
      tagline: 'ノモス —— AI の言葉の意味は、みんなの使い方が決める。辞書を変えたいなら、記事を一本持ってきて。',
      nTerms: '件の平易な語釈', nSightings: '件の目撃', nSources: n => n + ' 本の記事から', nFresh: '件の辞書にまだない新語', nContrib: '人の寄稿者',
      fresh: '最近見つかった新語', freshNote: '（エージェントが記事から持ち帰った、辞書未収録のもの）', freshEmpty: 'まだありません —— 最初の新語はここに出ます。',
      active: '最近動きのある既知の語', activeNote: '（直近 30 日の目撃が多い順）', activeEmpty: '直近 30 日の目撃はありません。',
      all: 'すべての語釈', filterPh: '語を探す（英語・中国語・別名）', count: n => '(' + n + ')',
      contribute: '辞書を変えたいですか？', bring: 'あなたのエージェントに記事を持ってこさせる', contributeNote: '編集できるのは目撃の投稿だけ —— エージェント（WebMCP）はそのページから入ります。エージェントがなくても、本文を貼れば既知の語だけ照合できます。',
      firstSeen: d => '初出 ' + d, sources: n => n + ' 件の出典', sightings: n => n + ' 件の目撃', quiet: n => n + ' 日動きなし', conflict: '用法が食い違う', newTerm: '新語', times: n => n + '回',
      assumedNoDef: '知っている前提で使われ、まだ誰も定義していない', editorial: '手書きの語釈（編集部によるもので、信号ではありません）：',
      noSightings: 'まだ目撃がありません —— この語に触れた記事を持ってきてください。', noDefs: '見かけてはいるものの、まだどの出典も定義していません。',
      evidence: '証拠を並べるだけで、正解は決めません。引用は必ず出典とともに。', back: '← 辞書に戻る', notFound: '辞書になく、まだ誰も見かけていません。',
      apiDown: '目撃データに接続できません。これは空の状態です。', demoOn: 'デモ用データ（fixtures/sightings-sample.json）であり、実際の目撃ではありません。',
      editorialTag: '手書きの語釈（編集部によるもので、信号ではありません）', explainedBy: n => '説明している記事（' + n + '）', mentionedBy: n => '言及している記事（' + n + '）',
      nLast: '最後の目撃', hot: '今週よく見かけた語', hotNote: '（直近 7 日の目撃数。大きいほど多く見かけた。↑ は今週から入った語）', hotEmpty: '直近 7 日の目撃はありません。', up: '↑ 新',
      sell: '🟢 売り文句として', risk: '🔴 リスクとして', feed: '動き', feedNote: '（最新の目撃と、その出典）', feedEmpty: 'まだ目撃がありません。', seenIn: (src, term) => '誰かが「' + src + '」で ' + term + ' を見かけました', allLink: n => '全 ' + n + ' 件の語釈へ →', noMatch: '該当する語がありません。',
      justNow: 'たった今', hoursAgo: n => n + ' 時間前', yesterday: '昨日', daysAgo: n => n + ' 日前',
      stepBring:'あなたの AI に一言だけ', stepBringNote:'ここに入力するものはありません。リンクを AI に渡せば、AI がこの辞書のツールを自分で呼びます。調べてほしい語を挙げてもよいですし、挙げなければ AI が自分で判断します。',
      urlPh:'記事のリンク', termsPh:'探す語（1 行に 1 語、任意）', nickPh:'署名（任意）',
      sayThisLine:'<リンクを貼る> を読んで、ai-nomos の feedDocument で AI 用語を拾って。',
      copied:'コピーしました',
      docWords:n=>n.toLocaleString()+' 語',
      confirmTitle:'この記事を辞書に入れますか？',
      confirmNote:'AI は読み終えました。あなたが押すまで何も書き込まれません —— それまでは、あなたにしか見えません。',
      confirmBtn:n=>'辞書に入れる（'+n+'）', discardBtn:'この記事は入れない',
      discarded:'破棄しました —— 何も書き込まれていません', confirming:'書き込み中…',
      doneThanks:'ご協力ありがとうございます', doneCount:n=>n, doneUnit:n=>'語が辞書に入りました',
      doneTitle:n=>'辞書に入りました —— '+n+' 件',
      doneNote:'これらの語は誰でも見られるようになりました。辞書が少し大きくなりました。',
      doneNothing:'この記事から入れられるものはありません', doneAgain:'辞書に戻る',
      stored:'辞書に書き込みました', notStored:'入れられるものがありません（すべてロックに掛かりました）',
      storeFail:e=>'サーバーが拒否しました：'+e, storeOff:e=>'サーバーに接続できません（'+e+'）',
      foundTitle:'この記事から見つけたもの', startOver:'← 別の記事にする',
      busyReading:'あなたの AI が読んでいます', busyDone:'読み終えました',
      elapsed:(m,sec)=>(m?m+'分 ':'')+sec+'秒',
      badgeKnown:'辞書にあり', badgeNew:'新語', badgeYours:'あなたが挙げた語', badgeAdded:'AI が足した語',
      notAiTerm:'AI 用語ではないと AI が判断', noQuoteHere:'この記事は説明していません',
      nfHere:n=>'挙げられましたが、記事にはありませんでした：'+n.join('、'),
      stFed:'AI が課題を受け取りました',
      stOpened:'AI がこの記事を開きました', stChecking:'辞書にすでにある語を照合しています',
      stCheckingN:(q,k)=>q+' 件を照会し、'+k+' 件は辞書にありました',
      stReporting:'目撃を送り返してきました', stReportingN:n=>'そのうち '+n+' 件が、あなた待ちです',
      stWaiting:'あなたが AI に話しかけるのを待っています', stWaitingNote:'ツールは準備できています。まだどのエージェントも呼んでいません。',
      codes:{MISSING_FIELD:'必須項目が欠けています',ENUM_INVALID:'選択肢にない値です',SENTENCE_LACKS_TERM:'sentence に term_raw が含まれていません',SENTENCE_TOO_LONG:'sentence が 120 字を超えています',QUOTE_NOT_IN_CONTEXT:'definition_quote が context にありません',EDGE_WITHOUT_QUOTE:'domain=edge なのに定義文がありません',STOPLISTED:'除外リストの語です',NOT_AI_TERM:'AI 用語でないものをエージェントが挙げました',PII_DETECTED:'貼り付けた文書に個人情報または金額が含まれています'},
      rejectedBy:n=>'サーバーが '+n+' 件を拒否しました',
      callsTitle:'AGENT ↔ このページ', callsEmpty:'まだどのエージェントもツールを呼んでいません。呼ばれた瞬間、ここに出ます。',
      callsFromAgent:'エージェント → ページ', callsToAgent:'ページ → エージェント',
      callsRunning:'実行中', callsN:n=>n+' 回の呼び出し',
      seeDict:'辞書を見る →', theDict:'辞書',
      howTitle: 'この辞書が育つしくみ',
      how1t: 'あなたが記事のリンクを持ってくる', how1b: 'ついでに、読んでいてわからなかった語も。',
      how2t: 'あなた自身の AI が読みに行く', how2b: '記事が私たちのサーバーを通ることはありません —— あなたのブラウザの中で、あなたのエージェントが読みます。',
      how3t: '何を残すかは、あなたが決める', how3b: 'どの語釈にも、それが出てきた文と出典リンクが付いています。自分で確かめられます。',
      mcpOn: 'このブラウザなら使えます —— 記事を持ってきてください',
      mcpOff: 'このサイトは AI エージェント向けに作られています',
      mcpOffHow: 'Chrome 152 以降はそのまま対応しています。ChatGPT デスクトップ版なら Work モードでサイトツールを有効にしてください。エージェントがなくても使えます —— 本文を貼れば、ページが既知の語を自分で照合します。',
      tryIt: '記事を持ってくる', copyBtn:'コピー',
      sideZh: '中国語の出典', sideEn: '英語の出典', sideJa: '日本語の出典',
      sideCount: n => n + ' 本の記事',
      sideEmpty: l => 'この語の' + l + 'の目撃はまだありません —— 持ってきてください。',
      crossLead: '二つの言語圏での語られ方',
      crossSame: '二つの言語圏の傾きは、ほぼ同じです。',
      crossDiff: (a, b) => a + ' は ' + b + ' に傾いています',
      crossSell: '売り文句', crossRisk: 'リスク', crossTech: '技術的な説明',
      langOf: { zh: '中国語', en: '英語', ja: '日本語' },
      heroTag: 'ノモス —— AI の言葉の意味は、みんなの使い方が決める。辞書を変えたいなら、記事を一本持ってきて。',
      hotLead: 'その語と、いちばん多く使われている一文', hotNoQuote: 'まだ誰も定義していません。',
      sellVsWorryHome: '売り込む側と、心配する側',
      freshHome: '記事から落ちてきたばかりの新語', freshFell: n => n + ' 本の記事から落ちてきて、誰も説明していません。',
      unnamed: '名前なし',
      feedHome: '読まれたばかりの記事と、そこから出てきた語', feedThrew: n => 'この記事からは ' + n + ' 語が出てきました',
      onlyEdit: '編集できるのは、目撃の投稿だけです。',
      senses: d => '通りの読み方 · 説明している ' + d + ' 本の記事から', sameLine: n => ' 他 ' + n + ' 件も同じ言い方',
      spellings: '通りの書き方', moreSpellings: n => '他 ' + n + ' 通り',
      sellVsWorry: '売り込む側と、心配する側', sellingIt: ' 件が売り文句', technicalN: n => n + ' 件が技術的な説明', worriedIt: ' 件が心配する側',
      howGood: ' 件がどれだけ良いかを語り', howBad: ' 件がどれだけ危ういかを語る', noQuoteSide: 'この側には定義文がありません。',
      onlyMention: (more, n) => (more ? '他に ' : '') + n + ' 本は言及のみ：',
      density: '専門用語の濃さ', mentions: '回の言及', explainedN: '回は説明あり', assumedN: '回は知っている前提',
      vAssumed: '多くは知っている前提 —— 読者が置いていかれやすい語です。', vFriendly: '説明する人のほうが多く、親切に扱われている語です。', vPassing: '多くは通りすがりの言及で、書き手は説明が要るとは思っていません。',
      mentionNoExplain: '本が言及しているが説明していない',
      editorialInline: '編集部の語釈であり、信号ではありません',
      enums: { has_definition: '定義文あり', mentioned: '言及のみ', assumed: '知っている前提', selling_point: '売り文句', technical: '技術的な説明', risk_or_limit: 'リスク・限界' },
      lang: '中文'
    }
  };
  if (!I18N[LANG]) LANG = 'zh';
  const T = k => I18N[LANG][k];
  const applyLang = () => {
    document.documentElement.lang = { zh:'zh-Hant', en:'en', ja:'ja' }[LANG] || 'en';
    document.querySelectorAll('[data-i]').forEach(el => { const v = T(el.dataset.i); if (v == null) return; if (el.dataset.attr) el.setAttribute(el.dataset.attr, v); else el.textContent = v; });
    localStorage.setItem('lang', LANG);
    renderLangs();
  };
  /* 三顆並列（2026-08-31）：一眼看得到有三種語言，不用按到第三次才發現。
     ⚠ 語料側（詞條頁的中／英／日分頁）與介面語言是兩件事 —— 這裡切的是介面。 */
  const LANG_ORDER = ['zh', 'en', 'ja'];
  const LANG_LABEL = { zh: '中文', en: 'EN', ja: '日本語' };
  /* 各頁用 onLangChange 註冊自己的重繪（詞條頁還要重載翻譯） */
  let LANG_CB = null;
  const onLangChange = fn => { LANG_CB = fn; };
  const setLang = l => { if (I18N[l] && l !== LANG) { LANG = l; applyLang(); if (LANG_CB) LANG_CB(l); } };
  const toggleLang = () => setLang(LANG_ORDER[(LANG_ORDER.indexOf(LANG) + 1) % LANG_ORDER.length]);
  const renderLangs = () => {
    const box = document.getElementById('langs'); if (!box) return;
    box.innerHTML = LANG_ORDER.map(l =>
      '<button class="lang' + (l === LANG ? ' on' : '') + '" data-lang="' + l + '">'
      + LANG_LABEL[l] + '</button>').join('');
    box.querySelectorAll('button').forEach(b =>
      b.onclick = () => { setLang(b.dataset.lang); });
  };

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
    /* no interim fallback: public/sightings.json was removed 2026-09-03 (it shipped a full offline copy of every url+term_key pair). API down = empty state. */
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
     清單，所以①綠②永遠不亮。第二個訊號只有首頁上 feedDocument 真的被呼叫過才算數。

     2026-09-01 複測（Chrome 152 原生 document.modelContext，旗標已開）：
       ① API 存在、registerTool 成功、getTools() 正常回工具　→ 通
       ③ 那些工具沒有進 agent 的工具清單　　　　　　　　　　 → 仍斷
     agent 端只能用 javascript_tool 手動 executeTool 繞過橋接，那不算 agent 呼叫。
     8/27 的結論未過期。另：Chrome 152 原生 client 不提供 requestUserInteraction
     ——ai-nomos 不受影響，契約 §6 的第四關本來就是頁面自己畫確認框（contract.md:192）。

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
  return { esc, T, ago, reveal, mcp, onMcp, lang: () => LANG, applyLang, toggleLang, setLang, renderLangs, onLangChange, loadLexicon, bySlug, lex: () => LEX, built: () => BUILT, loadTranslations, tq, tline, loadSightings, termKey, groupByTerm, stats, quoteHtml, metaLine };
})();
