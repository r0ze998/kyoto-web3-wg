/* 画面共通の小さな部品 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var LABELS = {
    claimType: { fact: '事実', party_claim: '当事者の主張', inference: '推測' },
    stage: {
      announced: '導入発表', pilot: '実証', ongoing: '継続運用',
      financially_sustained: '採算・自走を確認', ended: '終了・廃止', unknown: '段階不明'
    },
    sourceStatus: ['取得時に確認', '確認済み', '要再確認', 'リンク切れ', '内容と不一致'],
    claimStatus: ['有効', '要更新', '反証あり', '撤回'],
    costKind: { estimate_calc: '試算', quote: '見積', unknown: '未確認' },
    qStatus: ['未確認', '回答あり', '一部回答', '確認不可'],
    strength: { strong: '強', medium: '中', weak: '弱', none: '根拠なし', unknown: '未確認' },
    verdict: {
      verified: '照合済み', corrected: '訂正済み', outdated: '古い情報', unsupported: '裏付けなし',
      source_unavailable: '出典を開けず', added: '検証時に追加', none: '未照合'
    }
  };

  function claimChip(id) {
    var d = Store.data(), c = d.index.claims[id];
    if (!c) return '<span class="chip chip-missing" title="見つからない主張ID">' + esc(id) + '?</span>';
    return '<button type="button" class="chip chip-' + esc(c.type) + '" data-claim="' + esc(id) + '" title="' +
      esc(LABELS.claimType[c.type] + '：' + c.text) + '">' + esc(id) + '</button>';
  }

  function claimChips(ids) {
    if (!ids || !ids.length) return '<span class="muted small">出典なし</span>';
    return ids.map(claimChip).join(' ');
  }

  function sourceLink(s) {
    if (!s) return '';
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '</a>';
  }

  function claimDetailHtml(id) {
    var d = Store.data(), c = d.index.claims[id];
    if (!c) return '<p>主張 ' + esc(id) + ' は見つかりません。</p>';
    var srcs = (c.source_ids || []).map(function (sid) {
      var s = d.index.sources[sid];
      return s ? '<li>' + sourceLink(s) + '<br><span class="small muted">' + esc(s.publisher) + '／公表 ' +
        esc(s.published) + '／取得 ' + esc(s.accessed) + '／' + esc(s.status || '取得時に確認') + '</span></li>'
        : '<li>' + esc(sid) + '（出典データなし）</li>';
    }).join('');
    return '<h2 id="modalTitle">' + esc(c.id) + ' <span class="tag tag-' + esc(c.type) + '">' +
      esc(LABELS.claimType[c.type] || c.type) + '</span></h2>' +
      '<p class="claim-text">' + esc(c.text) + '</p>' +
      '<dl class="kv"><dt>時点</dt><dd>' + esc(c.as_of || '不明') + '</dd>' +
      (c.number ? '<dt>数値</dt><dd>' + esc(c.number) + '</dd>' : '') +
      '<dt>状態</dt><dd>' + esc(c.status || '有効') + '</dd>' +
      '<dt>出典との照合</dt><dd>' + verdictTag(c) + (c.verification ? ' <span class="small muted">' + esc(c.verification.checked_on) + '</span>' +
        (c.verification.note ? '<div class="small">' + esc(c.verification.note) + '</div>' : '') : '') + '</dd></dl>' +
      '<h3>出典</h3><ul class="plain">' + (srcs || '<li class="muted">なし</li>') + '</ul>' +
      '<p><a href="#/claims?q=' + encodeURIComponent(c.id) + '" data-close>主張一覧で開く</a></p>';
  }

  function verdictTag(c) {
    var v = (c.verification && c.verification.verdict) || 'none';
    return '<span class="tag tag-v-' + esc(v) + '">' + esc(LABELS.verdict[v] || v) + '</span>';
  }

  function openModal(html) {
    document.getElementById('modalBody').innerHTML = html;
    var m = document.getElementById('modal');
    m.hidden = false;
    m.querySelector('.modal-close').focus();
  }
  function closeModal() { document.getElementById('modal').hidden = true; }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function select(name, options, value, attrs) {
    return '<select name="' + esc(name) + '" ' + (attrs || '') + '>' + options.map(function (o) {
      var v = typeof o === 'string' ? o : o[0], l = typeof o === 'string' ? o : o[1];
      return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('') + '</select>';
  }

  function list(items, fn) {
    if (!items || !items.length) return '<p class="muted">未記入</p>';
    return '<ul>' + items.map(function (x) { return '<li>' + (fn ? fn(x) : esc(x)) + '</li>'; }).join('') + '</ul>';
  }

  function matchText(obj, q) {
    if (!q) return true;
    var hay = JSON.stringify(obj).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) >= 0; });
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  window.UI = {
    esc: esc, LABELS: LABELS, claimChip: claimChip, claimChips: claimChips, sourceLink: sourceLink,
    claimDetailHtml: claimDetailHtml, verdictTag: verdictTag, openModal: openModal, closeModal: closeModal, download: download,
    select: select, list: list, matchText: matchText, today: today
  };
})();
