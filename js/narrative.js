/* 文章で読む画面（最初に読む・DePIN分析・アイデア一覧）。
   本文中の [[A-C01,B-C02]] は根拠の主張ID。画面ではチップ、印刷・Markdown では [A-C01, B-C02] にする。 */
(function () {
  'use strict';
  var esc = UI.esc;
  var MARK = /\[\[([A-Z]-C\d+(?:\s*,\s*[A-Z]-C\d+)*)\]\]/g;

  function ids(s) { return s.split(',').map(function (x) { return x.trim(); }); }
  // 画面用：エスケープしてから根拠をチップにする
  function rich(text) {
    return esc(text).replace(MARK, function (_, list) { return ' <span class="refs-inline">' + UI.claimChips(ids(list)) + '</span>'; });
  }
  // 印刷・Markdown用
  function plain(text) {
    return String(text == null ? '' : text).replace(MARK, function (_, list) { return ' [' + ids(list).join(', ') + ']'; });
  }
  function collectRefs(text, used) {
    String(text || '').replace(MARK, function (_, list) { ids(list).forEach(function (i) { used[i] = true; }); return ''; });
  }

  function doc(id) { return (Store.data().docs || []).filter(function (x) { return x.id === id; })[0]; }

  function sectionHtml(s) {
    var h = '<section class="panel doc-sec" id="sec-' + esc(s.id) + '"><h2>' + esc(s.heading) + '</h2>';
    if (s.lead) h += '<p class="lead">' + rich(s.lead) + '</p>';
    (s.paras || []).forEach(function (p) { h += '<p>' + rich(p) + '</p>'; });
    if (s.points && s.points.length) h += '<ul class="doc-points">' + s.points.map(function (p) { return '<li>' + rich(p) + '</li>'; }).join('') + '</ul>';
    if (s.table) h += '<div class="tbl-wrap"><table class="tbl doc-tbl"><thead><tr>' + s.table.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + s.table.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i === 0 ? '<th>' + rich(c) + '</th>' : '<td>' + rich(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    if (s.note) h += '<p class="small muted">' + rich(s.note) + '</p>';
    return h + '</section>';
  }

  function docHtml(id, extra) {
    var d = doc(id);
    if (!d) return '<section class="panel"><p>文書 ' + esc(id) + ' がありません。</p></section>';
    var toc = (d.sections || []).map(function (s) { return '<li><a href="#/' + esc(id) + '?s=' + esc(s.id) + '" data-jump="sec-' + esc(s.id) + '">' + esc(s.heading) + '</a></li>'; }).join('');
    return '<section class="panel doc-head"><h1>' + esc(d.title) + '</h1>' +
      (d.updated ? '<p class="small muted">更新 ' + esc(d.updated) + '</p>' : '') +
      (d.intro ? '<div class="callout">' + rich(d.intro) + '</div>' : '') +
      (toc ? '<nav class="toc" aria-label="目次"><b>目次</b><ol>' + toc + (extra && extra.tocExtra ? extra.tocExtra : '') + '</ol></nav>' : '') +
      '<p class="small muted">本文中の小さな記号（例 <span class="chip chip-fact">C-C40</span>）は根拠の主張です。押すと出典が開きます。</p></section>' +
      (d.sections || []).map(sectionHtml).join('') + (extra && extra.after ? extra.after : '');
  }

  /* ---------- アイデア一覧 ---------- */
  var VERDICT_ORDER = ['採用（候補比較へ）', '検討を続ける', '保留（条件待ち）', '見送り'];
  function ideaCard(x) {
    var c = x.chain || {}, b = x.buyer_evidence || {};
    return '<article class="idea" id="idea-' + esc(x.id) + '"><header><span class="tag tag-verdict">' + esc(x.verdict) + '</span> <span class="tag">' + esc(x.domain) + '</span> <span class="tag">' + esc(x.archetype) + '</span></header>' +
      '<h3>' + esc(x.id) + '. ' + esc(x.title) + '</h3><p class="lead">' + rich(x.one_liner) + '</p>' +
      '<dl class="kv"><dt>誰の負担が減るか</dt><dd>' + rich(x.whose_burden) + '</dd>' +
      '<dt>仕組み</dt><dd>' + rich(x.mechanism) + '</dd>' +
      '<dt>誰が払うか（買い手）</dt><dd>' + rich(x.buyer) + '</dd>' +
      '<dt>払う理由</dt><dd>' + rich(x.why_pay) + '</dd>' +
      '<dt>買い手の根拠</dt><dd><span class="tag tag-s-' + esc(b.strength || 'unknown') + '">根拠 ' + esc(UI.LABELS.strength[b.strength] || '未確認') + '</span> ' + rich(b.text || '') + '</dd>' +
      '<dt>ブロックチェーン</dt><dd><b>' + esc(c.need || '') + '</b>：' + rich(c.reason || '') + '</dd>' +
      '<dt>宗教・所有権・プライバシー</dt><dd>' + rich(x.boundaries || '') + '</dd>' +
      '<dt>主な副作用</dt><dd>' + rich(x.risks || '') + '</dd>' +
      '<dt>判定の理由</dt><dd>' + rich(x.verdict_reason) + '</dd>' +
      '<dt>次に確かめること</dt><dd>' + rich(x.next_check) + '</dd>' +
      ((x.links && x.links.length) ? '<dt>関連</dt><dd>' + x.links.map(function (l) { return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>'; }).join('　') + '</dd>' : '') +
      '</dl></article>';
  }
  function ideasHtml(params) {
    var d = Store.data(), list = (d.ideas && d.ideas.ideas) || [], v = params.get('v') || '';
    var rows = list.filter(function (x) { return !v || x.verdict === v; });
    var summary = '<section class="panel" id="sec-list"><h2>一覧（' + list.length + '案）</h2>' +
      '<form class="filters" data-filter="ideas">' + UI.select('v', [['', '判定：すべて']].concat(VERDICT_ORDER), v) + '</form>' +
      '<div class="tbl-wrap"><table class="tbl doc-tbl"><thead><tr><th>案</th><th>誰が払うか</th><th>買い手の根拠</th><th>ブロックチェーン</th><th>判定</th></tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><th><a href="#/ideas?s=idea-' + esc(x.id) + '" data-jump="idea-' + esc(x.id) + '">' + esc(x.id) + '. ' + esc(x.title) + '</a></th><td>' + esc(plainNoRefs(x.buyer)) + '</td><td>' +
          esc(UI.LABELS.strength[(x.buyer_evidence || {}).strength] || '未確認') + '</td><td>' + esc((x.chain || {}).need || '') + '</td><td>' + esc(x.verdict) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    var cards = '<section class="panel" id="sec-cards"><h2>各案の中身</h2>' + rows.map(ideaCard).join('') + '</section>';
    return docHtml('ideas', { after: summary + cards, tocExtra: '<li><a href="#/ideas?s=sec-list" data-jump="sec-list">一覧</a></li><li><a href="#/ideas?s=sec-cards" data-jump="sec-cards">各案の中身</a></li>' });
  }
  function plainNoRefs(t) { return String(t || '').replace(MARK, ''); }

  /* ---------- 印刷・Markdown 用のブロック ---------- */
  function docBlocks(id, used) {
    var d = doc(id), B = [];
    if (!d) return B;
    B.push({ h: 1, t: d.title });
    if (d.updated) B.push({ p: '更新 ' + d.updated });
    if (d.intro) { collectRefs(d.intro, used); B.push({ p: plain(d.intro) }); }
    (d.sections || []).forEach(function (s) {
      B.push({ h: 2, t: s.heading });
      [s.lead].concat(s.paras || []).filter(Boolean).forEach(function (p) { collectRefs(p, used); B.push({ p: plain(p) }); });
      if (s.points && s.points.length) { s.points.forEach(function (p) { collectRefs(p, used); }); B.push({ ul: s.points.map(plain) }); }
      if (s.table) { s.table.rows.forEach(function (r) { r.forEach(function (c) { collectRefs(c, used); }); }); B.push({ table: { head: s.table.head, rows: s.table.rows.map(function (r) { return r.map(plain); }) } }); }
      if (s.note) { collectRefs(s.note, used); B.push({ p: plain(s.note) }); }
    });
    if (id === 'ideas') {
      var list = (Store.data().ideas || {}).ideas || [];
      B.push({ h: 2, t: '一覧' });
      B.push({ table: { head: ['案', '誰が払うか', '買い手の根拠', 'ブロックチェーン', '判定'], rows: list.map(function (x) { return [x.id + '. ' + x.title, plainNoRefs(x.buyer), UI.LABELS.strength[(x.buyer_evidence || {}).strength] || '未確認', (x.chain || {}).need || '', x.verdict]; }) } });
      list.forEach(function (x) {
        var c = x.chain || {}, b = x.buyer_evidence || {};
        B.push({ h: 3, t: x.id + '. ' + x.title + '（' + x.verdict + '）' });
        [x.one_liner, x.whose_burden, x.mechanism, x.buyer, x.why_pay, b.text, c.reason, x.boundaries, x.risks, x.verdict_reason, x.next_check].forEach(function (t) { collectRefs(t, used); });
        B.push({ p: plain(x.one_liner) });
        B.push({ ul: ['誰の負担が減るか：' + plain(x.whose_burden), '仕組み：' + plain(x.mechanism), '誰が払うか：' + plain(x.buyer), '払う理由：' + plain(x.why_pay),
          '買い手の根拠（' + (UI.LABELS.strength[b.strength] || '未確認') + '）：' + plain(b.text), 'ブロックチェーン（' + (c.need || '') + '）：' + plain(c.reason),
          '宗教・所有権・プライバシー：' + plain(x.boundaries), '主な副作用：' + plain(x.risks), '判定の理由：' + plain(x.verdict_reason), '次に確かめること：' + plain(x.next_check)] });
      });
    }
    return B;
  }

  window.Narrative = { docHtml: docHtml, ideasHtml: ideasHtml, docBlocks: docBlocks, rich: rich, plain: plain, collectRefs: collectRefs, MARK: MARK };
})();
