/* ルーティングと操作の受け口 */
(function () {
  'use strict';

  var NAV = [
    ['', '概要'], ['issues', '課題カード'], ['stakeholders', '関係者'], ['flow', '現状⇔提案'],
    ['candidates', '候補比較'], ['unknowns', '未確認事項'], ['interviews', 'ヒアリング'], ['pilots', '実証案'],
    ['cases', '事例'], ['claims', '主張'], ['sources', '出典'], ['output', '保存・出力']
  ];

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var params = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '');
    return { parts: path.split('/').filter(Boolean), params: params };
  }

  function renderNav(active) {
    document.getElementById('nav').innerHTML = NAV.map(function (n) {
      return '<a href="#/' + n[0] + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
    var cur = document.querySelector('#nav [aria-current]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function render(keepScroll) {
    var r = parseHash(), root = r.parts[0] || '', app = document.getElementById('app'), html;
    document.body.classList.toggle('print-mode', root === 'print');
    renderNav(root === 'print' ? 'output' : root);
    switch (root) {
      case '': html = Views.overview(); break;
      case 'issues': html = r.parts[1] ? Views.issueDetail(r.parts[1]) : Views.issues(r.params); break;
      case 'stakeholders': html = Views.stakeholders(r.params); break;
      case 'flow': html = Views.flow(r.params); break;
      case 'candidates': html = Views.candidates(); break;
      case 'unknowns': html = Views.unknowns(r.params); break;
      case 'interviews': html = Views.interviews(r.params); break;
      case 'pilots': html = Views.pilots(); break;
      case 'cases': html = Views.cases(r.params); break;
      case 'claims': html = Views.claims(r.params); break;
      case 'sources': html = Views.sources(r.params); break;
      case 'output': html = Views.output(); break;
      case 'print':
        html = '<div class="print-bar no-print"><a href="#/output">← 戻る</a> <button type="button" class="btn" data-action="print">印刷 / PDF</button></div>' +
          '<article class="report">' + (r.parts[1] === 'detail' ? Report.detailHtml() : Report.summaryHtml()) + '</article>';
        break;
      default: html = '<section class="panel"><p>ページが見つかりません。</p></section>';
    }
    var y = window.scrollY;
    app.innerHTML = html;
    if (keepScroll) window.scrollTo(0, y);
    updateSaveState();
  }

  function updateSaveState() {
    var el = document.getElementById('saveState');
    if (!Store.storageOk()) { el.textContent = 'ローカル保存不可：JSON で保存してください'; el.className = 'save-state warn'; return; }
    var t = Store.savedAt();
    el.textContent = t ? '保存済み ' + new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '変更なし';
    el.className = 'save-state';
  }

  function setParam(form) {
    flushPending();
    var r = parseHash(), params = new URLSearchParams();
    new FormData(form).forEach(function (v, k) { if (v) params.set(k, v); });
    var path = '#/' + r.parts.join('/');
    var qs = params.toString();
    history.replaceState(null, '', path + (qs ? '?' + qs : ''));
    var active = document.activeElement, name = active && active.name, pos = active && active.selectionStart;
    render(true);
    if (name) {
      var el = document.querySelector('form[data-filter] [name="' + name + '"]');
      if (el) { el.focus(); if (pos != null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch (e) { /* select 要素など */ } }
    }
  }

  var timers = {};
  function debounce(key, fn, ms) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); }

  function applyBind(el) {
    var p = el.getAttribute('data-bind').split('|');
    Store.setField(p[0], p[1], p[2], el.value);
  }

  function costEdit(el, field) {
    var p = el.getAttribute(field === 'amount' ? 'data-cost' : 'data-costkind').split('|');
    var pilot = Store.data().index.pilots[p[0]];
    var costs = JSON.parse(JSON.stringify(pilot.costs));
    var row = costs[+p[1]];
    if (field === 'amount') {
      row.amount = el.value === '' ? null : Math.max(0, Number(el.value));
      if (row.amount == null) row.kind = 'unknown'; else if (row.kind === 'unknown') row.kind = 'estimate_calc';
    } else row.kind = el.value;
    Store.setField('pilots', p[0], 'costs', costs);
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches('form[data-filter] input[type=search]')) debounce('filter', function () { setParam(el.form); }, 250);
    else if (el.matches('textarea[data-bind], input[data-bind]:not([type=date])')) debounce('bind:' + el.getAttribute('data-bind'), function () { applyBind(el); updateSaveState(); }, 400);
    else if (el.matches('textarea[data-note]')) debounce('note:' + el.getAttribute('data-note'), function () { Store.setNote(el.getAttribute('data-note'), el.value); updateSaveState(); }, 400);
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('form[data-filter] select')) return setParam(el.form);
    if (el.matches('select[data-bind], input[type=date][data-bind]')) { flushPending(); applyBind(el); return render(true); }
    if (el.matches('input[data-cost]')) { flushPending(); costEdit(el, 'amount'); return render(true); }
    if (el.matches('select[data-costkind]')) { flushPending(); costEdit(el, 'kind'); return render(true); }
    if (el.matches('input[data-action=importLayer]')) {
      var file = el.files[0];
      if (!file) return;
      file.text().then(function (txt) {
        var res = Store.importLayer(JSON.parse(txt));
        discardPending();
        var seedV = Store.data().meta.version;
        alert('復元しました。' + (res.seedVersion && res.seedVersion !== seedV ? '\n注意：保存時の初期データ（' + res.seedVersion + '）と現在（' + seedV + '）が違います。' : ''));
        render();
      }).catch(function (err) { alert('復元できませんでした：' + err.message); });
    }
  });

  // 復元・初期化のあとは、画面に残った古い入力を保存しない
  function discardPending() {
    Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); });
    timers = {};
    document.getElementById('app').innerHTML = '';
  }

  // 入力途中の内容を、再描画や画面移動の前に必ず保存する
  function flushPending() {
    Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); });
    timers = {};
    document.querySelectorAll('textarea[data-bind], input[data-bind]:not([type=date])').forEach(function (el) {
      var p = el.getAttribute('data-bind').split('|');
      var cur = (Store.data().index[p[0]][p[1]] || {})[p[2]] || '';
      if (cur !== el.value) applyBind(el);
    });
    document.querySelectorAll('textarea[data-note]').forEach(function (el) {
      var k = el.getAttribute('data-note');
      if (Store.getNote(k) !== el.value) Store.setNote(k, el.value);
    });
  }

  document.addEventListener('submit', function (e) {
    var f = e.target, act = f.getAttribute('data-action');
    if (f.hasAttribute('data-filter')) { e.preventDefault(); return setParam(f); }
    if (!act) return;
    e.preventDefault();
    flushPending();
    var v = Object.fromEntries(new FormData(f).entries());
    if (act === 'addSource') {
      Store.add('sources', { id: Store.nextId('sources', 'U-S'), title: v.title, publisher: v.publisher || '', url: v.url, published: v.published || '不明', accessed: UI.today(), kind: v.kind, status: '確認済み', notes: '利用者が追加' });
    } else if (act === 'addQuestion') {
      Store.add('questions', { id: Store.nextId('questions', 'QU'), to_role: v.to_role, question: v.question, why: v.why || '', if_yes: '', if_no: '', unknown_ids: (v.unknown_ids || '').split(/[\s,、]+/).filter(Boolean), status: '未確認', answer: '', evidence: '', decision_change: '' });
    } else if (act === 'addUnknown') {
      Store.add('unknowns', { id: Store.nextId('unknowns', 'UU'), text: v.text, why: '', ask_whom: v.ask_whom || '', blocking: !!v.blocking, status: '未確認', issue_ids: [], proposal_ids: [] });
    }
    render(true);
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-claim],[data-action],[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-claim')) { e.preventDefault(); return UI.openModal(UI.claimDetailHtml(t.getAttribute('data-claim'))); }
    if (t.hasAttribute('data-close')) { UI.closeModal(); return; }
    var act = t.getAttribute('data-action'), stamp = UI.today();
    switch (act) {
      case 'print': window.print(); break;
      case 'mdSummary': UI.download('kyoto-wg-summary-' + stamp + '.md', Report.summaryMd(), 'text/markdown'); break;
      case 'mdDetail': UI.download('kyoto-wg-detail-' + stamp + '.md', Report.detailMd(), 'text/markdown'); break;
      case 'exportLayer': flushPending(); UI.download('kyoto-wg-notes-' + stamp + '.json', JSON.stringify(Store.exportLayer(), null, 2)); break;
      case 'exportFull': flushPending(); UI.download('kyoto-wg-full-' + stamp + '.json', JSON.stringify(Store.exportFull(), null, 2)); break;
      case 'clearAll': if (confirm('回答・メモ・検証状態などの変更をすべて消します。先に JSON で保存しましたか？')) { discardPending(); Store.clearAll(); render(); } break;
      case 'delQuestion': if (confirm('この問いを削除しますか？')) { flushPending(); Store.remove('questions', t.getAttribute('data-id')); render(true); } break;
      case 'resetPilot': flushPending(); Store.resetItem('pilots', t.getAttribute('data-id')); render(true); break;
    }
  });

  document.getElementById('modal').addEventListener('click', function (e) { if (e.target.id === 'modal') UI.closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') UI.closeModal(); });

  window.addEventListener('hashchange', function () { flushPending(); render(); window.scrollTo(0, 0); });
  window.addEventListener('beforeunload', flushPending);
  window.addEventListener('pagehide', flushPending);

  if (!window.SEED) {
    document.getElementById('app').innerHTML = '<section class="panel"><p>data/bundle.js を読み込めませんでした。<code>node tools/build-data.mjs</code> を実行してください。</p></section>';
  } else render();
})();
