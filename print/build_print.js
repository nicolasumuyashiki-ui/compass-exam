// THE COMPASS — 印刷用PDF生成スクリプト
// 使い方: node print/build_print.js  (リポジトリ直下で実行)
// index.html の問題データから「問題冊子」「解答用紙」「講師用解答」「生徒用解答・解説」のPDFを作る
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = src.indexOf('const QUESTIONS = [');
const end = src.indexOf('const SECTIONS');
const dataCode = src.slice(start, src.indexOf('\n', end));
const { QUESTIONS, FICTION_PASSAGE, NONFIC_PASSAGE, SECTIONS } =
  new Function(dataCode + '\nreturn {QUESTIONS,FICTION_PASSAGE,NONFIC_PASSAGE,SECTIONS};')();

const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'tck_logo.png')).toString('base64');
const L = ['A', 'B', 'C', 'D'];

const DIRECTIONS = {
  'A|Part 1': 'Listen to each short conversation, then choose the best answer for each question.',
  'A|Part 2': 'Listen to the following academic talk, then answer the questions below.',
  'B|Sentence': 'Choose the word or phrase that best completes each sentence.',
  'B|Error': 'Each sentence below has one error. Circle the letter (A–D) of the underlined part that contains the error.',
  'C|Words in Context': 'Choose the word that best fits in the blank.',
  'C|Synonyms': 'Choose the word closest in meaning to the underlined word.',
  'C|Word Formation': 'Write the correct form of the word given in brackets.',
  'D|Passage 1': 'Read the passage, then answer the questions.',
  'D|Passage 2': 'Read the passage, then answer the questions.',
};
const cleanPart = p => p.replace(/\s*\((click|type)[^)]*\)/i, '').replace(/\s*\(closest meaning\)/i, '');

const css = `
@page{size:A4;margin:16mm 15mm 16mm 15mm;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Crimson Pro',Georgia,'IPAGothic',serif;color:#1a1a2e;font-size:11.5pt;line-height:1.5;}
.sans{font-family:'DM Sans','IPAGothic',sans-serif;}
.page-break{break-before:page;}
.cover{height:262mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:3px solid #1a1a2e;padding:18mm;position:relative;}
.cover::before{content:'';position:absolute;inset:5px;border:1px solid #d4d0c8;}
.cover .brand{font-family:'Anton',sans-serif;font-size:54pt;letter-spacing:-1px;line-height:1;}
.cover .brand span{color:#2d5a87;}
.cover .org{font-family:'DM Sans';font-weight:700;letter-spacing:4px;font-size:10pt;color:#2d5a87;margin:8px 0 4px;}
.cover .ttl{font-family:'DM Sans','IPAGothic';font-size:13pt;color:#555;margin-bottom:14mm;}
.cover img{width:28mm;margin-bottom:10mm;}
.namebox{width:100%;max-width:140mm;font-family:'DM Sans','IPAGothic';font-size:11pt;text-align:left;margin-bottom:10mm;}
.namebox div{border-bottom:1px solid #1a1a2e;padding:7mm 0 1.5mm;}
.ov{border-collapse:collapse;width:100%;max-width:150mm;font-family:'DM Sans','IPAGothic';font-size:9.5pt;margin-bottom:8mm;}
.ov th,.ov td{border:1px solid #bbb;padding:4px 7px;text-align:left;}
.ov th{background:#1a1a2e;color:#fff;}
.ov tr.tot td{font-weight:700;background:#eef2f7;}
.rules{font-family:'DM Sans','IPAGothic';font-size:9.5pt;text-align:left;max-width:150mm;line-height:1.7;}
.rules li{margin-left:1.2em;}
.sec-head{break-after:avoid;display:flex;align-items:center;gap:10px;border-bottom:2px solid #1a1a2e;padding-bottom:4px;margin:0 0 10px;}
.badge{font-family:'DM Sans';font-weight:700;font-size:9pt;letter-spacing:2px;text-transform:uppercase;color:#fff;padding:3px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.sec-title{font-family:'DM Sans';font-weight:700;font-size:13pt;}
.sec-pts{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:9pt;color:#666;}
.sub{font-family:'DM Sans';font-weight:700;font-size:10.5pt;color:#444;border-left:3px solid #999;padding-left:8px;margin:12px 0 5px;break-after:avoid;}
.dir{font-family:'DM Sans','IPAGothic';font-size:9.5pt;font-style:italic;color:#555;background:#f3f2ee;padding:5px 9px;margin-bottom:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-after:avoid;}
.q{margin-bottom:9px;break-inside:avoid;}
.qh{font-family:'JetBrains Mono',monospace;font-size:9.5pt;color:#2d5a87;font-weight:500;}
.qh .pts{color:#888;font-size:8pt;margin-left:6px;}
.stem{display:inline;}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:1px 18px;margin:3px 0 0 18px;font-family:'DM Sans';font-size:10pt;}
.opts.single{grid-template-columns:1fr;}
.opts b{font-family:'JetBrains Mono';font-weight:500;color:#666;margin-right:5px;}
.err{font-size:12pt;line-height:2.1;margin-left:18px;}
.err .u{text-decoration:underline;text-decoration-thickness:1.3px;text-underline-offset:3px;font-weight:600;}
.err sub{font-family:'JetBrains Mono';font-size:8pt;color:#c44536;font-weight:700;margin:0 3px 0 1px;}
.blank{display:inline-block;width:55mm;border-bottom:1px solid #1a1a2e;height:1.2em;margin:4px 0 0 18px;}
.lines div{border-bottom:1px solid #aaa;height:8.5mm;}
.passage{border:1px solid #c8c4ba;background:#fcfbf8;padding:9px 13px;margin-bottom:10px;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.passage p{margin-bottom:6px;text-indent:1.2em;}
.passage .pt{font-family:'DM Sans';font-weight:700;font-size:10pt;margin-bottom:5px;color:#b8860b;}
.passage .pn{font-family:'JetBrains Mono';font-size:7.5pt;color:#999;margin-right:4px;}
.bold-w{font-weight:700;}
.topic{border:1px solid #bbb;padding:6px 10px;margin-bottom:6px;font-size:11pt;}
.topic b{font-family:'DM Sans';}
.chk{display:inline-block;width:10px;height:10px;border:1.3px solid #1a1a2e;margin-right:6px;vertical-align:-1px;}
.wc{font-family:'DM Sans','IPAGothic';font-size:9pt;color:#666;text-align:right;margin-top:3px;}
.footer-note{font-family:'DM Sans','IPAGothic';font-size:8.5pt;color:#888;text-align:center;margin-top:8px;}
/* answer sheet */
.as-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 14mm;font-family:'DM Sans';font-size:10.5pt;}
.as-row{display:flex;align-items:center;gap:8px;height:5.7mm;break-inside:avoid;border-bottom:1px dotted #ccc;}
.as-row .n{font-family:'JetBrains Mono';width:9mm;text-align:right;color:#2d5a87;}
.bub{display:inline-flex;align-items:center;justify-content:center;width:5.4mm;height:5.4mm;border:1.2px solid #555;border-radius:50%;font-size:8.5pt;color:#555;}
.as-line{flex:1;border-bottom:1px solid #1a1a2e;height:5mm;}
.as-h{font-family:'DM Sans';font-weight:700;font-size:10pt;margin:5px 0 1px;grid-column:1/-1;}
/* key */
.key{border-collapse:collapse;width:100%;font-family:'DM Sans','IPAGothic';font-size:9.5pt;}
.key th,.key td{border:1px solid #ccc;padding:3px 6px;text-align:left;vertical-align:top;}
.key th{background:#1a1a2e;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.key td.a{font-weight:700;color:#c44536;white-space:nowrap;}
`;

const fontLink = `<link href="https://fonts.googleapis.com/css2?family=Anton&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;
const wrap = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${fontLink}<style>${css}</style></head><body>${body}</body></html>`;

function numberParas(html) {
  let n = 0;
  return html.replace(/<p>/g, () => `<p><span class="pn">[${++n}]</span>`);
}

function secHead(sec) {
  const s = SECTIONS[sec];
  return `<div class="sec-head"><div class="badge" style="background:${s.color}">Section ${sec}</div><div class="sec-title">${s.label}</div><div class="sec-pts">/ ${s.max} pts</div></div>`;
}

const overview = `
<table class="ov">
<tr><th>Section</th><th>内容</th><th>問題数</th><th>配点</th></tr>
<tr><td>A. Listening</td><td>Short Conversations + Academic Talk</td><td>10問</td><td>15点</td></tr>
<tr><td>B. Grammar</td><td>Sentence Completion + Error Identification</td><td>10問</td><td>15点</td></tr>
<tr><td>C. Vocabulary</td><td>Words in Context + Synonyms + Word Formation</td><td>15問</td><td>15点</td></tr>
<tr><td>D. Reading</td><td>Fiction Passage + Non-fiction Passage</td><td>15問</td><td>30点</td></tr>
<tr><td>E. Writing</td><td>Summary (45–55 words) + Opinion Essay (150–200 words)</td><td>2問</td><td>25点</td></tr>
<tr class="tot"><td>TOTAL</td><td></td><td>52問</td><td>100点</td></tr>
</table>`;

function cover(subtitle, withName = true, rules = '') {
  return `<div class="cover">
  <img src="${logo}">
  <div class="brand">THE <span>COMPASS</span></div>
  <div class="org">TCK WORKSHOP</div>
  <div class="ttl">Academic English Proficiency Check<br>${subtitle}</div>
  ${withName ? `<div class="namebox"><div>Name / 氏名：</div><div>Date / 受験日：　　　　年　　月　　日</div></div>` : ''}
  ${overview}
  ${rules}
</div>`;
}

const studentRules = `<ul class="rules">
<li>試験時間は<b>80分</b>です。</li>
<li>リスニング（Section A）の音声は<b>1回のみ</b>再生されます（約9分）。音声開始前に設問に目を通しておきましょう。</li>
<li>選択問題は解答用紙の記号を<b>○で囲んで</b>ください。記述問題は解答用紙に記入してください。</li>
<li>Writing（Section E）は問題冊子の解答欄に直接書いてください。</li>
</ul>`;

function renderQ(q) {
  let h = `<div class="q"><span class="qh">${q.id}.<span class="pts">(${q.pts}pt${q.pts > 1 ? 's' : ''})</span></span> `;
  if (q.type === 'mc') {
    h += `<span class="stem">${q.stem}</span><div class="opts${q.single ? ' single' : ''}">`;
    q.opts.forEach((o, i) => h += `<div><b>${L[i]}.</b>${o}</div>`);
    h += '</div>';
  } else if (q.type === 'error') {
    h += `<div class="err">` + q.sentence.map((p, i) => `<span class="u">${p}</span><sub>${L[i]}</sub>`).join(' ') + `</div>`;
  } else if (q.type === 'fill') {
    h += `<span class="stem">${q.stem}</span>`;
    h += q.keywords ? `<div class="sans" style="font-size:9pt;color:#666;margin-left:18px;">→ 解答用紙に記入</div>` : '';
  }
  return h + '</div>';
}

function booklet() {
  let h = cover('Question Booklet / 問題冊子', true, studentRules);
  let cur = '', part = '';
  for (const q of QUESTIONS) {
    if (q.sec !== cur) {
      cur = q.sec; part = '';
      const brk = ['A', 'D'].includes(q.sec);
      h += (brk ? `<div class="page-break"></div>` : `<div style="height:10px"></div>`) + secHead(q.sec);
      if (q.sec === 'A') h += `<div class="dir">🎧 音声を聞いて答えてください。音声は1回のみ流れます。/ The audio will be played only once.</div>`;
    }
    if (typeof q.part === 'string' && q.part !== part) {
      part = q.part;
      if (q.passage) {
        const isF = q.passage === 'fiction';
        if (!isF) h += `<div class="page-break"></div>`;
        h += `<div class="sub">${cleanPart(part)}</div>`;
        h += `<div class="dir">${DIRECTIONS['D|' + (isF ? 'Passage 1' : 'Passage 2')]}</div>`;
        h += `<div class="passage"><div class="pt">${isF ? 'Passage 1 — Fiction' : 'Passage 2 — Non-fiction: Sleep & Learning'}</div>${numberParas(isF ? FICTION_PASSAGE : NONFIC_PASSAGE)}</div>`;
      } else {
        h += `<div class="sub">${cleanPart(part)}</div>`;
        const k = Object.keys(DIRECTIONS).find(k => k.startsWith(q.sec + '|') && part.includes(k.split('|')[1]));
        if (k) h += `<div class="dir">${DIRECTIONS[k]}</div>`;
      }
    }
    h += renderQ(q);
  }
  // Section E
  const lines = n => `<div class="lines">${'<div></div>'.repeat(n)}</div>`;
  h += `<div class="page-break"></div>` + secHead('E');
  h += `<div class="sub">Part 1 — Summary Writing (10 pts)</div>`;
  h += `<div class="dir">Reread Passage 2 (Non-fiction about sleep) and write a summary in 45–55 words. Include the main idea and key points. Do NOT copy sentences from the passage.</div>`;
  h += lines(9) + `<div class="wc">Words: ______ （45–55 words）</div>`;
  h += `<div class="sub" style="margin-top:16px;">Part 2 — Opinion Essay (15 pts)</div>`;
  h += `<div class="dir">Choose ONE topic below (check the box), then write 150–200 words. Include an introduction, body, and conclusion.</div>`;
  h += `<div class="topic"><span class="chk"></span><b>Topic A</b>　"Students learn more from their classmates than from their teachers." Do you agree or disagree?</div>`;
  h += `<div class="topic"><span class="chk"></span><b>Topic B</b>　Some people believe children should grow up in one country. Others say living in multiple countries is beneficial. Which do you support?</div>`;
  h += `<div class="page-break"></div><div class="sub">Part 2 — Opinion Essay（解答欄）　Topic: A ・ B</div>` + lines(27) + `<div class="wc">Words: ______ （150–200 words）</div>`;
  h += `<div class="footer-note">— END OF EXAM —　THE COMPASS / TCK Workshop</div>`;
  return wrap('THE COMPASS — Question Booklet', h);
}

function answerSheet() {
  let h = `<div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #1a1a2e;padding-bottom:6px;margin-bottom:6px;">
    <img src="${logo}" style="width:12mm;"><div><div style="font-family:Anton;font-size:20pt;line-height:1;">THE <span style="color:#2d5a87">COMPASS</span></div>
    <div class="sans" style="font-size:9pt;color:#666;">Answer Sheet / 解答用紙 (Sections A–D)</div></div>
    <div class="sans" style="margin-left:auto;font-size:10pt;width:85mm;">
      <div style="border-bottom:1px solid #1a1a2e;padding:4mm 0 1mm;">Name / 氏名：</div>
      <div style="border-bottom:1px solid #1a1a2e;padding:4mm 0 1mm;">Score：　　　　　/ 75 （A–D）</div></div></div>
  <div class="sans" style="font-size:8.5pt;color:#666;margin-bottom:4px;">選択問題は記号を○で囲む。記述問題は線上に記入。Writing（Section E）は問題冊子に記入。</div>
  <div class="as-grid">`;
  let cur = '';
  for (const q of QUESTIONS) {
    if (q.sec !== cur) { cur = q.sec; h += `<div class="as-h" style="color:${SECTIONS[q.sec].color}">Section ${q.sec} — ${SECTIONS[q.sec].label}</div>`; }
    if (q.keywords) continue;
    h += `<div class="as-row"><span class="n">${q.id}</span>`;
    h += q.type === 'fill' ? `<span class="as-line"></span>` : L.map(l => `<span class="bub">${l}</span>`).join('');
    h += `</div>`;
  }
  h += `</div>`;
  const q50 = QUESTIONS.find(q => q.keywords);
  h += `<div class="as-row" style="border:none;margin-top:6px;"><span class="n">${q50.id}</span><span class="sans" style="font-size:9pt;">${q50.stem}</span></div>`;
  h += `<div class="lines">${'<div style="height:7mm"></div>'.repeat(3)}</div>`;
  return wrap('THE COMPASS — Answer Sheet', h);
}

function answerKey() {
  let h = `<div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #1a1a2e;padding-bottom:6px;margin-bottom:10px;">
    <img src="${logo}" style="width:12mm;"><div><div style="font-family:Anton;font-size:20pt;line-height:1;">THE <span style="color:#2d5a87">COMPASS</span></div>
    <div class="sans" style="font-size:9pt;color:#666;">Answer Key / 解答・採点基準（講師用・生徒配布不可）</div></div></div>`;
  let cur = '';
  for (const q of QUESTIONS) {
    if (q.sec !== cur) {
      if (cur) h += `</table>`;
      cur = q.sec;
      h += `<div class="sec-head" style="margin-top:10px;"><div class="badge" style="background:${SECTIONS[q.sec].color}">Section ${q.sec}</div><div class="sec-title">${SECTIONS[q.sec].label}</div><div class="sec-pts">/ ${SECTIONS[q.sec].max} pts</div></div>`;
      h += `<table class="key"><tr><th style="width:9mm">No.</th><th style="width:16mm">正解</th><th>内容</th><th style="width:12mm">配点</th></tr>`;
    }
    let a, note;
    if (q.type === 'mc') { a = L[q.ans]; note = q.opts[q.ans]; }
    else if (q.type === 'error') { a = L[q.errIdx]; note = `「${q.sentence[q.errIdx]}」→ <b>${q.correction}</b>　（${q.explain}）`; }
    else if (q.keywords) { a = '記述'; note = `次のうち2つ以上に言及していれば正解：homework / extracurricular activities / screen time（完全な文で）`; }
    else { a = q.preferred; note = q.accepts.length > 1 ? `別解可：${q.accepts.filter(x => x !== q.preferred).join(', ')}` : ''; }
    h += `<tr><td>${q.id}</td><td class="a">${a}</td><td>${note}</td><td>${q.pts}</td></tr>`;
  }
  h += `</table>`;
  h += `<div class="sec-head" style="margin-top:14px;"><div class="badge" style="background:${SECTIONS.E.color}">Section E</div><div class="sec-title">Writing</div><div class="sec-pts">/ 25 pts</div></div>
  <div class="sans" style="font-size:9.5pt;line-height:1.7;">Summary（10点）・Essay（15点）は講師が採点してください。<br>
  Summary の要点例：睡眠は学習に重要（記憶の定着・前頭前野）／徹夜は逆効果／推奨9–11時間に対し7時間未満の生徒が多い（宿題・課外活動・スクリーンタイム）／始業時刻を遅らせる学校もあり、反対意見はあるが利点が上回る。</div>`;
  return wrap('THE COMPASS — Answer Key', h);
}


// ---- 生徒配布用 解答・解説 ----
const NOTES = {
  1: '「荷物が重量制限を超えている」', 2: '「残りの作業をメンバーで分担する」',
  3: '「がっかりしているが、前向きでいようとしている」',
  4: '"easier said than done" ＝「言うは易く行うは難し」→ 実際にやるのは難しい',
  5: '「理論上は良さそうだが、うまくいかないかもしれない」',
  6: '「多くの海洋生物にすみかと食べ物を提供する」', 7: '水温が上がるとサンゴは体内の藻を追い出す（＝白化現象）',
  8: '白化による被害の大きさを示す例として挙げている', 9: '「状況は深刻だが、絶望的ではない」',
  10: '危機を伝えつつ回復の可能性にも触れる →「懸念しつつも慎重に希望を持つ」',
  11: 'By the time ＋ 過去形 → 主節はそれより前の出来事なので過去完了 (had started)',
  12: '時制の一致で will → would、遠足は「中止される」ので受動態 (would be canceled)',
  13: 'カンマのある非制限用法では that は使えない。先行詞は物 (The book) → which',
  14: 'I wish ＋ 過去の事実と反対の願望 → 過去完了 (had learned)',
  15: 'It is essential that S ＋ 動詞の原形（仮定法現在）→ follow',
  21: 'revise ＝ 見直す・改定する（expand 拡大する / reject 拒否する / restore 元に戻す）',
  22: 'address (an issue) ＝ (問題に)取り組む・扱う（access 接続する / assess 評価する / assume 想定する）',
  23: 'abolish ＝ 廃止する（reinforce 強化する / establish 設立する / promote 促進する）',
  24: 'glitch ＝ (機械・システムの)小さな不具合（blackout 停電 / leak 漏れ）',
  25: 'skepticism ＝ 懐疑。画期的な理論が「当初は」疑いの目で見られた、という対比',
  26: 'withdraw (a product) ＝ 回収する ≒ recall', 27: 'candid ＝ 率直な ≒ honest',
  28: 'fragile ＝ 壊れやすい ≒ delicate', 29: 'unravel ＝ (謎を)解き明かす ≒ solve',
  30: 'meticulous ＝ 細心の・綿密な ≒ thorough',
  31: '冠詞 The の後なので名詞 → usage（use も可）', 32: 'be動詞の後なので形容詞 → essential（不可欠な）',
  33: 'The ___ of ～ なので名詞 → construction（建設）',
  34: '学校の決定に反対しているので否定の意味 → dissatisfied（unsatisfied も可）',
  35: 'remarkable の後なので名詞。resource → resourceful → resourcefulness（機転・工夫する力）',
  36: '第1段落：街が「頼んでもいない映画」のように流れ、すべてが灰色 → 心が離れていて不満',
  37: '"friends who understood her without needing words" などから、失った「居場所・帰属感」を表す',
  38: '母は荷ほどきのように「機械的に」慣れると言うが、Lena knew better → 慣れるのは簡単ではない',
  39: '"I found something worth getting up for" → 打ち込めるものが変化を乗り越える支えになる',
  40: '希望ほど強くはないが、その「静かないとこ」である好奇心 → 小さな前向きな関心が芽生えた',
  41: '現実に起こりうる引っ越しの話 → Realistic fiction',
  42: '喪失の悲しみと、最後に芽生える小さな前向きさ → Bittersweet（ほろ苦い）',
  43: '第1段落冒頭と全体の流れ：睡眠は学習の成功に欠かせない',
  44: '第3段落：推奨は 9～11 時間、7 時間未満しか眠らない生徒が増えている',
  45: '第1段落：脳が日中にできたつながりを「再生し強化する」過程',
  46: '第2段落：睡眠不足は集中・判断を担う前頭前野 (prefrontal cortex) の働きを弱める',
  47: 'outweigh ＝ ～より重要である・～に勝る（利点が不便さに勝る）',
  48: 'マラソンと栄養のたとえ (analogy) で、学習と睡眠の関係を示している',
  49: '"Critics argue..." で反対意見を紹介し、"Nevertheless..." で反論している',
};
const MODEL_Q50 = 'Many students do not get enough sleep because of homework, extracurricular activities, and screen time.';
const MODEL_SUMMARY = 'Sleep is essential for learning because it helps the brain store memories and supports clear thinking. Staying up all night before a test can lower performance. Although experts recommend 9 to 11 hours, many students sleep less than 7. Later school start times may help, and their benefits seem greater than the problems.';
const MODEL_ESSAY = [
  'Some people believe that children should grow up in one country, while others think that living in several countries is beneficial. In my opinion, growing up in multiple countries offers children valuable advantages.',
  'First, living abroad helps children become more open-minded. When they meet people with different languages, foods, and customs, they learn that there is more than one way to see the world. This experience makes them more respectful of others.',
  'Second, moving between countries builds resilience. Children have to adapt to new schools and make new friends again and again. Although this can be stressful, it teaches them to handle change and solve problems on their own, which are important skills for adult life.',
  'Of course, some children may feel that they do not belong anywhere. However, with support from their families, they can turn this feeling into a strength and connect with people from many backgrounds.',
  'In conclusion, growing up in multiple countries can be challenging, but it gives children a broader perspective and the ability to adapt.',
];
const words = t => t.trim().split(/\s+/).length;

function studentKey() {
  let h = `<div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #1a1a2e;padding-bottom:6px;margin-bottom:8px;">
    <img src="${logo}" style="width:12mm;"><div><div style="font-family:Anton;font-size:20pt;line-height:1;">THE <span style="color:#2d5a87">COMPASS</span></div>
    <div class="sans" style="font-size:9pt;color:#666;">Answers &amp; Explanations / 解答・解説</div></div>
    <div class="sans" style="margin-left:auto;font-size:10pt;width:70mm;"><div style="border-bottom:1px solid #1a1a2e;padding:4mm 0 1mm;">Name / 氏名：</div></div></div>
  <table class="key" style="margin-bottom:6px;"><tr><th>Section</th>${Object.keys(SECTIONS).map(k => `<th style="text-align:center">${k}</th>`).join('')}<th style="text-align:center">合計</th></tr>
  <tr><td>自分の得点</td>${Object.keys(SECTIONS).map(k => `<td style="text-align:center;height:9mm;vertical-align:bottom;">／${SECTIONS[k].max}</td>`).join('')}<td style="text-align:center;vertical-align:bottom;">／100</td></tr></table>
  <div class="sans" style="font-size:8.5pt;color:#666;">※ Section E（Writing）は先生の採点結果を記入してください。</div>`;
  let cur = '';
  for (const q of QUESTIONS) {
    if (q.sec !== cur) {
      if (cur) h += `</table>`;
      cur = q.sec;
      h += `<div class="sec-head" style="margin-top:10px;"><div class="badge" style="background:${SECTIONS[q.sec].color}">Section ${q.sec}</div><div class="sec-title">${SECTIONS[q.sec].label}</div><div class="sec-pts">/ ${SECTIONS[q.sec].max} pts</div></div>`;
      h += `<table class="key"><tr><th style="width:9mm">No.</th><th style="width:22mm">正解</th><th>解説</th><th style="width:13mm">配点</th><th style="width:8mm">✓</th></tr>`;
    }
    let a, note;
    if (q.type === 'mc') { a = L[q.ans]; note = `<i>${q.opts[q.ans]}</i><br>${NOTES[q.id]}`; }
    else if (q.type === 'error') { a = L[q.errIdx]; note = `${q.sentence[q.errIdx]} → <b>${q.correction}</b><br>${q.explain}`; }
    else if (q.keywords) { a = '記述'; note = `解答例：<i>${MODEL_Q50}</i><br>homework / extracurricular activities / screen time のうち<b>2つ以上</b>を、完全な文で書けていれば正解（第3段落）`; }
    else { a = q.preferred; note = NOTES[q.id]; }
    h += `<tr style="break-inside:avoid"><td>${q.id}</td><td class="a">${a}</td><td>${note}</td><td>${q.pts}</td><td></td></tr>`;
  }
  h += `</table>`;
  h += `<div class="page-break"></div><div class="sec-head"><div class="badge" style="background:${SECTIONS.E.color}">Section E</div><div class="sec-title">Writing — Model Answers / 模範解答</div><div class="sec-pts">/ 25 pts</div></div>
  <div class="sub">Part 1 — Summary（${words(MODEL_SUMMARY)} words）</div>
  <div class="passage"><p style="text-indent:0">${MODEL_SUMMARY}</p></div>
  <div class="sans" style="font-size:9.5pt;line-height:1.7;margin-bottom:8px;"><b>入れるべき要点：</b>① 睡眠は学習に重要（記憶の定着・思考力）　② 徹夜は逆効果　③ 推奨 9～11 時間に対し、7 時間未満の生徒が多い　④ 始業を遅らせる取り組み（反対意見はあるが利点が大きい）<br>
  <b>ポイント：</b>本文の文をそのまま写さず、自分の言葉で言いかえる。具体的な数字や引用は最小限に。</div>
  <div class="sub">Part 2 — Opinion Essay（Topic B の例・${words(MODEL_ESSAY.join(' '))} words）</div>
  <div class="passage">${MODEL_ESSAY.map(p => `<p>${p}</p>`).join('')}</div>
  <div class="sans" style="font-size:9.5pt;line-height:1.7;"><b>構成チェック：</b>□ 序論で自分の立場をはっきり書いた　□ 理由を2つ、具体例つきで書いた　□ 反対意見に触れて反論した　□ 結論で立場をもう一度まとめた　□ First / Second / However / In conclusion などのつなぎ言葉を使った　□ 150～200 語に収まっている</div>
  <div class="footer-note">THE COMPASS / TCK Workshop</div>`;
  return wrap('THE COMPASS — Answers & Explanations', h);
}

(async () => {
  const out = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const jobs = [
    ['COMPASS_問題冊子.pdf', booklet()],
    ['COMPASS_解答用紙.pdf', answerSheet()],
    ['COMPASS_解答_講師用.pdf', answerKey()],
    ['COMPASS_解答解説_生徒用.pdf', studentKey()],
  ];
  for (const [name, html] of jobs) {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(out, name), format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log('wrote', name);
  }
  await browser.close();
})();
