/* 各画面の描画。HTML 文字列を返すだけにして、操作は app.js がまとめて受ける。 */
(function () {
  'use strict';
  var esc = UI.esc, L = UI.LABELS;

  var UNKNOWN_STATUS = ['未確認', '確認中', '一部解消', '解消', '確認不可'];
  function bind(c, id, field) { return 'data-bind="' + esc(c + '|' + id + '|' + field) + '"'; }
  function textarea(c, id, field, value, ph, rows) {
    return '<textarea ' + bind(c, id, field) + ' rows="' + (rows || 3) + '" placeholder="' + esc(ph || '') + '">' + esc(value || '') + '</textarea>';
  }
  function strengthTag(s) { return '<span class="tag tag-s-' + esc(s || 'unknown') + '">根拠 ' + esc(L.strength[s] || '未確認') + '</span>'; }
  function stageTag(s) { return '<span class="tag tag-stage-' + esc(s) + '">' + esc(L.stage[s] || s) + '</span>'; }
  function hypTags(hs) {
    var d = Store.data();
    return (hs || []).map(function (h) {
      var hy = d.hypotheses.filter(function (x) { return x.id === h; })[0];
      return '<span class="tag tag-h" title="' + esc(hy ? hy.text : '') + '">' + esc(h) + '</span>';
    }).join(' ');
  }
  function unknownStatus(u) {
    var d = Store.data();
    var qs = d.questions.filter(function (q) { return (q.unknown_ids || []).indexOf(u.id) >= 0; });
    var answered = qs.filter(function (q) { return q.status === '回答あり'; }).length;
    return { qs: qs, answered: answered };
  }
  function q(params, key) { return params.get(key) || ''; }

  /* ---------- 概要 ---------- */
  function overview() {
    var d = Store.data(), m = d.meta;
    var openBlocking = d.unknowns.filter(function (u) { return u.blocking && u.status !== '解消'; }).length;
    var steps = [
      ['#/candidates', '1. 候補比較', d.proposals.length + ' 案を同じ観点で並べる（総合点なし）'],
      ['#/unknowns', '2. 未確認事項', d.unknowns.length + ' 件。うち案の成否を左右するもの ' + openBlocking + ' 件が未解消'],
      ['#/interviews', '3. ヒアリング計画', d.questions.length + ' 問。回答・根拠・判断の変化を記録'],
      ['#/pilots', '4. 最小実証案', d.pilots.length + ' 案。人数・費用の仮定・指標・中止条件']
    ];
    return '<section class="panel"><h1>' + esc(m.title || '') + '</h1>' +
      '<p>' + esc(m.purpose || '') + '</p>' +
      '<p class="small muted">初期データ ' + esc(m.version || '') + '／調査日 ' + esc(m.researched || '') + '／次回打ち合わせ ' + esc(m.meeting || '') + '</p>' +
      '<div class="callout">' + esc(m.caution || '') + '</div></section>' +
      '<section class="panel"><h2>進め方</h2><ol class="flow-steps">' + steps.map(function (s) {
        return '<li><a href="' + s[0] + '"><strong>' + esc(s[1]) + '</strong><span>' + esc(s[2]) + '</span></a></li>';
      }).join('') + '</ol></section>' +
      '<section class="panel"><h2>検証する構造仮説</h2><ul>' + d.hypotheses.map(function (h) {
        return '<li><strong>' + esc(h.id) + '</strong> ' + esc(h.text) + '<br><span class="small muted">' + esc(h.status || '') + '</span></li>';
      }).join('') + '</ul></section>' +
      '<section class="panel"><h2>データの内訳</h2><div class="stats">' +
      stat(d.issues.length, '課題カード', '#/issues') + stat(d.claims.length, '主張', '#/claims') +
      stat(d.sources.length, '出典', '#/sources') + stat(d.cases.length, '事例', '#/cases') +
      '</div>' + verifySummary(d) + '<p class="small muted">主張は「事実／当事者の主張／推測」に分けています。色：' +
      '<span class="chip chip-fact">事実</span> <span class="chip chip-party_claim">当事者の主張</span> <span class="chip chip-inference">推測</span></p></section>';
  }
  function verifySummary(d) {
    var cnt = {};
    d.claims.forEach(function (c) { var v = (c.verification && c.verification.verdict) || 'none'; cnt[v] = (cnt[v] || 0) + 1; });
    var keys = Object.keys(L.verdict).filter(function (k) { return cnt[k]; });
    var last = d.claims.reduce(function (m, c) { return c.verification && c.verification.checked_on > m ? c.verification.checked_on : m; }, '');
    return '<p class="small">出典との照合' + (last ? '（最終 ' + esc(last) + '）' : '') + '：' + keys.map(function (k) {
      return '<a href="#/claims?v=' + k + '">' + esc(L.verdict[k]) + ' ' + cnt[k] + '</a>';
    }).join('　') + '</p>';
  }
  function stat(n, label, href) { return '<a class="stat" href="' + href + '"><b>' + n + '</b><span>' + esc(label) + '</span></a>'; }

  /* ---------- 課題カード ---------- */
  function issues(params) {
    var d = Store.data(), qq = q(params, 'q'), dom = q(params, 'domain'), hy = q(params, 'h');
    var domains = []; d.issues.forEach(function (i) { if (domains.indexOf(i.domain) < 0) domains.push(i.domain); });
    var rows = d.issues.filter(function (i) {
      return (!dom || i.domain === dom) && (!hy || (i.hypotheses || []).indexOf(hy) >= 0) && UI.matchText(i, qq);
    });
    return '<section class="panel"><h1>課題カード</h1>' +
      '<form class="filters" data-filter="issues"><input type="search" name="q" value="' + esc(qq) + '" placeholder="検索（例：宿泊税、町内会、通報）" aria-label="検索">' +
      UI.select('domain', [['', '領域：すべて']].concat(domains), dom) +
      UI.select('h', [['', '仮説：すべて']].concat(d.hypotheses.map(function (h) { return [h.id, h.id + ' ' + h.short]; })), hy) +
      '</form><p class="small muted">' + rows.length + ' / ' + d.issues.length + ' 件</p>' +
      '<div class="cards">' + rows.map(function (i) {
        var unk = (i.unknown_ids || []).length;
        return '<a class="card" href="#/issues/' + esc(i.id) + '"><div class="card-top"><span class="tag">' + esc(i.domain) + '</span> ' + hypTags(i.hypotheses) + ' ' + strengthTag(i.evidence_level) + '</div>' +
          '<h3>' + esc(i.id) + '. ' + esc(i.title) + '</h3><p>' + esc(i.summary) + '</p>' +
          '<p class="small muted">未確認事項 ' + unk + ' 件／関連主張 ' + (i.claims || []).length + ' 件</p></a>';
      }).join('') + '</div></section>';
  }

  function issueDetail(id) {
    var d = Store.data(), i = d.index.issues[id];
    if (!i) return '<section class="panel"><p>課題 ' + esc(id) + ' は見つかりません。</p></section>';
    var f = i.q2_flow || {}, w = i.q1_who || {}, ex = i.q3_existing || {}, nc = i.q6_no_chain || {}, fz = i.q8_falsify || {};
    var props = d.proposals.filter(function (p) { return (p.issue_ids || []).indexOf(i.id) >= 0; });
    return '<section class="panel"><p><a href="#/issues">← 課題カード一覧</a></p>' +
      '<div class="card-top"><span class="tag">' + esc(i.domain) + '</span> ' + hypTags(i.hypotheses) + ' ' + strengthTag(i.evidence_level) + '</div>' +
      '<h1>' + esc(i.id) + '. ' + esc(i.title) + '</h1><p>' + esc(i.summary) + '</p>' +
      (i.boundary ? '<div class="callout">' + esc(i.boundary) + '</div>' : '') +
      '<p class="small"><a href="#/stakeholders?issue=' + esc(i.id) + '">関係者の負担・利益・権限を見る</a>' +
      props.map(function (p) { return '　<a href="#/flow?p=' + esc(p.id) + '">現状⇔提案：' + esc(p.title) + '</a>'; }).join('') + '</p></section>' +

      sec('1. 誰が・どの場面で・どのくらい困っているか',
        '<p>' + esc(w.text) + '</p><p><strong>規模：</strong>' + esc(w.quant || '未確認') + '</p>' + refs(w.claims)) +
      sec('2. 業務の流れ・費用負担・受益者・決定権者',
        '<ol>' + (f.steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        '<dl class="kv"><dt>費用・労力を負担</dt><dd>' + esc(f.cost_bearer) + '</dd><dt>恩恵を受ける</dt><dd>' + esc(f.beneficiaries) +
        '</dd><dt>決める人</dt><dd>' + esc(f.decision_makers) + '</dd></dl>' + refs(f.claims)) +
      sec('3. 既存の手段と、なお解消されていない部分',
        '<table class="tbl"><thead><tr><th>既存の手段</th><th>カバーしていること</th><th>残る問題</th><th>根拠</th></tr></thead><tbody>' +
        (ex.means || []).map(function (m) {
          return '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.covers) + '</td><td>' + esc(m.gap) + '</td><td>' + UI.claimChips(m.claims) + '</td></tr>';
        }).join('') + '</tbody></table><p><strong>まとめ：</strong>' + esc(ex.remaining) + '</p>') +
      sec('4. 変えるべき仕組み（契約・業務・分配・参加条件）',
        '<table class="tbl"><tbody>' + (i.q4_mechanism || []).map(function (m) {
          return '<tr><th>' + esc(m.target) + '</th><td>' + esc(m.change) + '</td></tr>';
        }).join('') + '</tbody></table>') +
      sec('5. 支払う主体と、支払う合理的な理由',
        '<table class="tbl"><thead><tr><th>主体</th><th>払う理由（仮説）</th><th>確からしさ</th><th>根拠</th></tr></thead><tbody>' +
        (i.q5_payers || []).map(function (p) {
          return '<tr><td>' + esc(p.who) + '</td><td>' + esc(p.rationale) + '</td><td>' + esc(L.strength[p.confidence] || p.confidence) + '</td><td>' + UI.claimChips(p.claims) + '</td></tr>';
        }).join('') + '</tbody></table>') +
      sec('6. ブロックチェーンなしの案との比較',
        '<dl class="kv"><dt>なしの案</dt><dd>' + esc(nc.alternative) + '</dd><dt>比較</dt><dd>' + esc(nc.comparison) +
        '</dd><dt>チェーンが効く条件</dt><dd>' + esc(nc.chain_adds) + '</dd></dl>') +
      sec('7. 副作用（悪用・虚偽報告・運用負荷・排除・プライバシー）',
        '<table class="tbl"><thead><tr><th>種類</th><th>起きうること</th><th>抑え方</th></tr></thead><tbody>' +
        (i.q7_risks || []).map(function (r) {
          return '<tr><td>' + esc(r.type) + '</td><td>' + esc(r.text) + '</td><td>' + esc(r.mitigation) + '</td></tr>';
        }).join('') + '</tbody></table>') +
      sec('8. 仮説を否定する条件と最小の確認方法',
        '<h4>こうなら仮説は否定される</h4>' + UI.list(fz.conditions) + '<h4>最小の確認方法</h4>' + UI.list(fz.minimal_check)) +
      sec('未確認事項', unknownTable((i.unknown_ids || []).map(function (u) { return d.index.unknowns[u]; }).filter(Boolean))) +
      sec('関連する事例', UI.list((i.case_ids || []).map(function (c) { return d.index.cases[c]; }).filter(Boolean), function (c) {
        return '<a href="#/cases?q=' + esc(c.id) + '">' + esc(c.name) + '</a> ' + stageTag(c.stage);
      })) +
      sec('関連する主張（すべて）', refs(i.claims)) +
      sec('メモ', '<textarea data-note="issue:' + esc(i.id) + '" rows="4" placeholder="自分用のメモ（ローカルに保存）">' + esc(Store.getNote('issue:' + i.id)) + '</textarea>');
  }
  function sec(title, body) { return '<section class="panel"><h2>' + esc(title) + '</h2>' + body + '</section>'; }
  function refs(ids) { return '<p class="refs">根拠：' + UI.claimChips(ids) + '</p>'; }

  /* ---------- 関係者マトリクス ---------- */
  function stakeholders(params) {
    var d = Store.data(), iss = q(params, 'issue') || (d.issues[0] && d.issues[0].id), view = q(params, 'view') || 'issue';
    var head = '<section class="panel"><h1>関係者の負担・利益・権限</h1>' +
      '<form class="filters" data-filter="stakeholders">' +
      UI.select('view', [['issue', '課題ごとに見る'], ['all', '全課題を関係者ごとに見る']], view) +
      (view === 'issue' ? UI.select('issue', d.issues.map(function (i) { return [i.id, i.id + ' ' + i.title]; }), iss) : '') +
      '</form><p class="small muted">「負担」は費用・労力・リスク、「利益」は直接・間接の恩恵、「権限」は決める・止める・使い道を選ぶ力。セルの根拠が弱いものは確からしさを「弱／未確認」にしています。</p>';
    if (view === 'all') {
      return head + d.stakeholders.map(function (s) {
        var rows = d.matrix.filter(function (m) { return m.stakeholder_id === s.id; });
        if (!rows.length) return '';
        return '<h3>' + esc(s.name) + ' <span class="small muted">' + esc(s.kind) + '</span></h3>' + matrixTable(rows, 'issue');
      }).join('') + '</section>';
    }
    var rows = d.matrix.filter(function (m) { return m.issue_id === iss; });
    return head + (rows.length ? matrixTable(rows, 'stakeholder') : '<p class="muted">この課題の行はまだありません。</p>') + '</section>';
  }
  function matrixTable(rows, firstCol) {
    var d = Store.data();
    return '<div class="tbl-wrap"><table class="tbl matrix"><thead><tr><th>' + (firstCol === 'issue' ? '課題' : '関係者') +
      '</th><th>負担</th><th>利益</th><th>権限</th><th>確からしさ</th><th>根拠</th></tr></thead><tbody>' +
      rows.map(function (m) {
        var first = firstCol === 'issue' ? (d.index.issues[m.issue_id] || {}).title : (d.index.stakeholders[m.stakeholder_id] || {}).name;
        return '<tr><th>' + esc(first) + '</th><td>' + esc(m.burden) + '</td><td>' + esc(m.benefit) + '</td><td>' + esc(m.authority) +
          '</td><td>' + esc(L.strength[m.confidence] || m.confidence) + '</td><td>' + UI.claimChips(m.claims) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------- 現状⇔提案 ---------- */
  function flow(params) {
    var d = Store.data(), pid = q(params, 'p') || (d.proposals[0] && d.proposals[0].id), p = d.index.proposals[pid];
    var head = '<section class="panel"><h1>現状と提案後</h1><form class="filters" data-filter="flow">' +
      UI.select('p', d.proposals.map(function (x) { return [x.id, x.id + ' ' + x.title]; }), pid) + '</form>';
    if (!p) return head + '<p>案がありません。</p></section>';
    var cur = p.current || {}, pro = p.proposed || {};
    return head + '<p>' + esc(p.one_liner) + '</p><div class="callout small">「提案後」は検証前の設計案です。実施されたものではありません。</div>' +
      '<div class="two-col"><div class="col col-now"><h2>現状（資料から把握できた範囲）</h2><ol>' +
      (cur.steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol><h3>詰まっている点</h3>' + UI.list(cur.pain) +
      '</div><div class="col col-new"><h2>提案後（仮説）</h2><ol>' +
      (pro.steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol><h3>何が変わるか</h3>' + UI.list(pro.change) +
      '</div></div>' +
      '<dl class="kv"><dt>変える仕組み</dt><dd>' + esc(p.mechanism) + '</dd><dt>誰が払うか</dt><dd>' + esc(p.payer) +
      '</dd><dt>払う理由</dt><dd>' + esc(p.why_pay) + '</dd><dt>ブロックチェーンの役割</dt><dd>' + esc(p.chain_role) +
      '</dd><dt>なしの版</dt><dd>' + esc(p.no_chain) + '</dd></dl>' + refs(p.claims) + '</section>';
  }

  /* ---------- 候補比較 ---------- */
  function candidates() {
    var d = Store.data();
    return '<section class="panel"><h1>有望案の比較</h1>' +
      '<p class="small muted">総合点は付けません。各セルは文章と「根拠の強さ」で示します。根拠の強さは、そのセルの記述を支える出典の強さで、案の良し悪しではありません。</p>' +
      '<p class="small muted scroll-hint">表は横にスクロールできます →</p><div class="tbl-wrap"><table class="tbl compare"><thead><tr><th>観点</th>' + d.proposals.map(function (p) {
        return '<th><a href="#/flow?p=' + esc(p.id) + '">' + esc(p.id) + ' ' + esc(p.title) + '</a><br><span class="tag tag-verdict">' + esc(p.status) + '</span></th>';
      }).join('') + '</tr></thead><tbody>' +
      '<tr><th>ひとことで</th>' + d.proposals.map(function (p) { return '<td>' + esc(p.one_liner) + '</td>'; }).join('') + '</tr>' +
      '<tr><th>対象課題</th>' + d.proposals.map(function (p) {
        return '<td>' + (p.issue_ids || []).map(function (i) { return '<a href="#/issues/' + esc(i) + '">' + esc(i) + '</a>'; }).join(' ') + '</td>';
      }).join('') + '</tr>' +
      d.dims.map(function (dim) {
        return '<tr><th>' + esc(dim.label) + '<br><span class="small muted">' + esc(dim.desc) + '</span></th>' + d.proposals.map(function (p) {
          var c = (p.dims || {})[dim.key] || {};
          return '<td>' + esc(c.text || '未記入') + '<div class="cell-foot">' + strengthTag(c.strength) + ' ' + (c.claims && c.claims.length ? UI.claimChips(c.claims) : '') + '</div></td>';
        }).join('') + '</tr>';
      }).join('') +
      '<tr><th>成立に必要な前提</th>' + d.proposals.map(function (p) { return '<td>' + UI.list(p.prerequisites) + '</td>'; }).join('') + '</tr>' +
      '<tr><th>やらないこと</th>' + d.proposals.map(function (p) { return '<td>' + UI.list(p.not_doing) + '</td>'; }).join('') + '</tr>' +
      '<tr><th>未確認事項</th>' + d.proposals.map(function (p) {
        return '<td>' + (p.unknown_ids || []).map(function (u) {
          var x = d.index.unknowns[u]; return x ? '<a href="#/unknowns?q=' + esc(u) + '" class="' + (x.status === '解消' ? 'done' : '') + '">' + esc(u) + '</a>' : '';
        }).join(' ') + '</td>';
      }).join('') + '</tr>' +
      '</tbody></table></div>' +
      '<h2>比較メモ</h2><textarea data-note="compare" rows="5" placeholder="比較して分かったこと、打ち合わせで決めたいこと">' + esc(Store.getNote('compare')) + '</textarea></section>';
  }

  /* ---------- 未確認事項 ---------- */
  function unknownTable(rows) {
    var d = Store.data();
    if (!rows.length) return '<p class="muted">なし</p>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>未確認のこと</th><th>なぜ重要か</th><th>誰に確認するか</th><th>関連する問い</th><th>状態</th></tr></thead><tbody>' +
      rows.map(function (u) {
        var st = unknownStatus(u);
        return '<tr class="' + (u.blocking ? 'blocking' : '') + '"><td>' + esc(u.id) + (u.blocking ? '<br><span class="tag tag-block">案の成否に影響</span>' : '') +
          '</td><td>' + esc(u.text) + '</td><td>' + esc(u.why) + '</td><td>' + esc(u.ask_whom) + '</td><td>' +
          st.qs.map(function (x) { return '<a href="#/interviews?q=' + esc(x.id) + '">' + esc(x.id) + '</a>' + (x.status === '回答あり' ? '✓' : ''); }).join(' ') +
          '</td><td>' + UI.select('status', UNKNOWN_STATUS, u.status, bind('unknowns', u.id, 'status')) +
          (u.resolution ? '<div class="small">' + esc(u.resolution) + '</div>' : '') +
          (u.claims && u.claims.length ? '<div class="small">' + UI.claimChips(u.claims) + '</div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function unknowns(params) {
    var d = Store.data(), qq = q(params, 'q'), st = q(params, 'status'), bl = q(params, 'blocking'), pr = q(params, 'p');
    var rows = d.unknowns.filter(function (u) {
      return (!st || u.status === st) && (!bl || !!u.blocking === (bl === '1')) &&
        (!pr || (u.proposal_ids || []).indexOf(pr) >= 0) && UI.matchText(u, qq);
    });
    return '<section class="panel"><h1>未確認事項</h1><p class="small muted">課題カードと候補案から抜き出した「分からないこと」。状態を変えるとローカルに保存されます。回答の中身は「ヒアリング」画面で記録します。</p>' +
      '<form class="filters" data-filter="unknowns"><input type="search" name="q" value="' + esc(qq) + '" placeholder="検索" aria-label="検索">' +
      UI.select('status', [['', '状態：すべて']].concat(UNKNOWN_STATUS), st) +
      UI.select('blocking', [['', '重要度：すべて'], ['1', '案の成否に影響'], ['0', 'その他']], bl) +
      UI.select('p', [['', '案：すべて']].concat(d.proposals.map(function (p) { return [p.id, p.id + ' ' + p.title]; })), pr) +
      '</form><p class="small muted">' + rows.length + ' 件</p>' + unknownTable(rows) +
      '<h2>未確認事項を追加</h2><form data-action="addUnknown" class="addform"><input name="text" required placeholder="分からないこと"><input name="ask_whom" placeholder="誰に確認するか（役割）"><label><input type="checkbox" name="blocking"> 案の成否に影響</label><button type="submit">追加</button></form></section>';
  }

  /* ---------- ヒアリング ---------- */
  function interviews(params) {
    var d = Store.data(), qq = q(params, 'q'), st = q(params, 'status'), role = q(params, 'role');
    var roles = []; d.questions.forEach(function (x) { if (roles.indexOf(x.to_role) < 0) roles.push(x.to_role); });
    var rows = d.questions.filter(function (x) { return (!st || x.status === st) && (!role || x.to_role === role) && UI.matchText(x, qq); });
    return '<section class="panel"><h1>ヒアリング計画と記録</h1>' +
      '<div class="callout small">ここに載っている問いは準備用です。回答欄は空のまま始まります。実際に聞いた内容だけを記録し、公開資料で確かめた場合は「根拠」にそう書いてください。外部への連絡はこのツールからは行いません。</div>' +
      '<form class="filters" data-filter="interviews"><input type="search" name="q" value="' + esc(qq) + '" placeholder="検索" aria-label="検索">' +
      UI.select('role', [['', '相手：すべて']].concat(roles), role) +
      UI.select('status', [['', '状態：すべて']].concat(L.qStatus), st) + '</form>' +
      '<p class="small muted">' + rows.length + ' 問</p>' +
      rows.map(function (x) {
        return '<article class="qcard" id="q-' + esc(x.id) + '"><header><b>' + esc(x.id) + '</b> <span class="tag">' + esc(x.to_role) + '</span> ' +
          (x.unknown_ids || []).map(function (u) { return '<a class="small" href="#/unknowns?q=' + esc(u) + '">' + esc(u) + '</a>'; }).join(' ') +
          (x._added ? ' <button type="button" class="link danger" data-action="delQuestion" data-id="' + esc(x.id) + '">削除</button>' : '') + '</header>' +
          '<p class="qtext">' + esc(x.question) + '</p>' +
          '<dl class="kv small"><dt>なぜ聞くか</dt><dd>' + esc(x.why) + '</dd><dt>「はい」なら</dt><dd>' + esc(x.if_yes) + '</dd><dt>「いいえ」なら</dt><dd>' + esc(x.if_no) + '</dd></dl>' +
          '<div class="grid2"><label>状態' + UI.select('status', L.qStatus, x.status, bind('questions', x.id, 'status')) + '</label>' +
          '<label>聞いた日<input type="date" ' + bind('questions', x.id, 'asked_on') + ' value="' + esc(x.asked_on || '') + '"></label></div>' +
          (x.checked_on ? '<p class="small"><span class="tag">公開資料で確認 ' + esc(x.checked_on) + '</span></p>' : '') +
          '<label>回答' + textarea('questions', x.id, 'answer', x.answer, '聞いた内容（要約）。聞いていなければ空のまま') + '</label>' +
          '<label>根拠（誰から・いつ・どの資料）' + textarea('questions', x.id, 'evidence', x.evidence, '例：○○課の担当者に口頭で（日付）／公開資料URL', 2) + '</label>' +
          '<label>判断の変化' + textarea('questions', x.id, 'decision_change', x.decision_change, 'この回答で、どの案・前提がどう変わったか', 2) + '</label>' +
          '</article>';
      }).join('') +
      '<section class="panel"><h2>問いを追加</h2><form data-action="addQuestion" class="addform"><input name="to_role" required placeholder="相手（役割。例：区役所 地域力推進室）"><textarea name="question" required rows="2" placeholder="問い"></textarea><input name="why" placeholder="なぜ聞くか"><input name="unknown_ids" placeholder="関連する未確認事項ID（例：U3 U5）"><button type="submit">追加</button></form></section></section>';
  }

  /* ---------- 実証案 ---------- */
  function pilots() {
    var d = Store.data();
    return '<section class="panel"><h1>最小実証案</h1><p class="small muted">費用は「試算（根拠を書いた概算）」「見積（実際に取った見積）」「未確認」を区別します。初期データに見積はありません。金額は編集でき、ローカルに保存されます。トークン価格の上昇は前提にしていません。</p></section>' +
      d.pilots.map(function (p) {
        var prop = d.index.proposals[p.proposal_id] || {};
        var calc = 0, unknownN = 0;
        (p.costs || []).forEach(function (c) { if (typeof c.amount === 'number') calc += c.amount; else unknownN++; });
        return '<section class="panel pilot"><h2>' + esc(p.id) + '. ' + esc(p.title) + '</h2>' +
          '<p class="small">対象の案：<a href="#/flow?p=' + esc(prop.id) + '">' + esc(prop.id) + ' ' + esc(prop.title) + '</a></p>' +
          '<dl class="kv"><dt>対象</dt><dd>' + esc(p.target) + '</dd><dt>期間</dt><dd>' + esc(p.duration) + '</dd><dt>確かめること</dt><dd>' + esc(p.question) + '</dd></dl>' +
          '<h3>必要な人</h3><table class="tbl"><thead><tr><th>役割</th><th>人数</th><th>根拠</th></tr></thead><tbody>' +
          (p.people || []).map(function (x) { return '<tr><td>' + esc(x.role) + '</td><td>' + esc(x.count) + '</td><td>' + esc(x.basis) + '</td></tr>'; }).join('') + '</tbody></table>' +
          '<h3>費用の仮定</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>項目</th><th>金額（円）</th><th>種別</th><th>根拠</th></tr></thead><tbody>' +
          (p.costs || []).map(function (c, idx) {
            return '<tr><td>' + esc(c.item) + '</td><td><input type="number" min="0" step="1000" inputmode="numeric" data-cost="' + esc(p.id + '|' + idx) + '" value="' + (typeof c.amount === 'number' ? c.amount : '') + '" placeholder="未確認" aria-label="' + esc(c.item) + ' の金額"></td><td>' +
              UI.select('kind', [['estimate_calc', '試算'], ['quote', '見積'], ['unknown', '未確認']], c.kind, 'data-costkind="' + esc(p.id + '|' + idx) + '"') + '</td><td>' + esc(c.basis) + '</td></tr>';
          }).join('') + '</tbody><tfoot><tr><th>金額のある項目の合計</th><td colspan="3"><b>' + calc.toLocaleString('ja-JP') + ' 円</b>' + (unknownN ? '（金額未確認 ' + unknownN + ' 項目を含まない）' : '') + '</td></tr></tfoot></table></div>' +
          '<h3>評価指標</h3><table class="tbl"><thead><tr><th>指標</th><th>測り方</th><th>続ける目安</th></tr></thead><tbody>' +
          (p.metrics || []).map(function (m) { return '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.how) + '</td><td>' + esc(m.threshold) + '</td></tr>'; }).join('') + '</tbody></table>' +
          '<h3>中止条件</h3>' + UI.list(p.stop) +
          '<h3>始める前に必要なこと</h3>' + UI.list(p.prerequisites) +
          '<h3>やらないこと</h3>' + UI.list(p.not_doing) +
          '<h3>メモ</h3><textarea data-note="pilot:' + esc(p.id) + '" rows="3">' + esc(Store.getNote('pilot:' + p.id)) + '</textarea>' +
          (p._edited ? '<p><button type="button" class="link" data-action="resetPilot" data-id="' + esc(p.id) + '">費用の変更を初期値に戻す</button></p>' : '') +
          '</section>';
      }).join('');
  }

  /* ---------- 事例 ---------- */
  function cases(params) {
    var d = Store.data(), qq = q(params, 'q'), st = q(params, 'stage'), w3 = q(params, 'web3');
    var rows = d.cases.filter(function (c) {
      return (!st || c.stage === st) && (!w3 || String(!!c.web3) === w3) && UI.matchText(c, qq);
    });
    return '<section class="panel"><h1>類似事例</h1><p class="small muted">段階は「導入発表／実証／継続運用／採算・自走を確認／終了・廃止」を区別。終了したものは現在使えるものとして扱いません。「2026年の状況」は調査日時点で確認できた範囲です。</p>' +
      '<form class="filters" data-filter="cases"><input type="search" name="q" value="' + esc(qq) + '" placeholder="検索" aria-label="検索">' +
      UI.select('stage', [['', '段階：すべて']].concat(Object.keys(L.stage).map(function (k) { return [k, L.stage[k]]; })), st) +
      UI.select('web3', [['', 'Web3：すべて'], ['true', 'Web3'], ['false', 'Web3以外']], w3) + '</form>' +
      '<p class="small muted">' + rows.length + ' 件</p><div class="cards">' + rows.map(function (c) {
        return '<article class="card case"><div class="card-top">' + stageTag(c.stage) + ' <span class="tag">' + (c.web3 ? 'Web3' : 'Web3以外') + '</span> <span class="small muted">' + esc(c.id) + '</span></div>' +
          '<h3>' + esc(c.name) + '</h3><p class="small muted">' + esc(c.region) + '／' + esc(c.operator) + '</p><p>' + esc(c.summary) + '</p>' +
          '<dl class="kv small"><dt>段階の根拠</dt><dd>' + esc(c.stage_evidence) + '</dd><dt>2026年の状況</dt><dd>' + esc(c.status_2026) +
          '</dd><dt>誰が払うか</dt><dd>' + esc(c.who_pays) + '</dd><dt>実績</dt><dd>' + esc(c.results) + '</dd><dt>示唆</dt><dd>' + esc(c.lessons) + '</dd></dl>' +
          '<p class="refs small">出典：' + (c.source_ids || []).map(function (s) { var x = d.index.sources[s]; return x ? UI.sourceLink(x) : esc(s); }).join('／') + '</p></article>';
      }).join('') + '</div></section>';
  }

  /* ---------- 主張 ---------- */
  function claims(params) {
    var d = Store.data(), qq = q(params, 'q'), ty = q(params, 'type'), tag = q(params, 'tag'), vd = q(params, 'v');
    var tags = {}; d.claims.forEach(function (c) { (c.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var tagList = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; }).slice(0, 40);
    var vOf = function (c) { return (c.verification && c.verification.verdict) || 'none'; };
    var rows = d.claims.filter(function (c) { return (!ty || c.type === ty) && (!tag || (c.tags || []).indexOf(tag) >= 0) && (!vd || vOf(c) === vd) && UI.matchText(c, qq); });
    return '<section class="panel"><h1>主張</h1><p class="small muted">事実＝統計・公文書で確認できるもの。当事者の主張＝事業者・団体の自己申告。推測＝このツール作成時の推論（根拠付き）。</p>' +
      '<form class="filters" data-filter="claims"><input type="search" name="q" value="' + esc(qq) + '" placeholder="検索（IDも可）" aria-label="検索">' +
      UI.select('type', [['', '種類：すべて'], ['fact', '事実'], ['party_claim', '当事者の主張'], ['inference', '推測']], ty) +
      UI.select('tag', [['', 'タグ：すべて']].concat(tagList.map(function (t) { return [t, t + '（' + tags[t] + '）']; })), tag) +
      UI.select('v', [['', '照合：すべて']].concat(Object.keys(L.verdict).map(function (k) { return [k, L.verdict[k]]; })), vd) + '</form>' +
      '<p class="small muted">' + rows.length + ' / ' + d.claims.length + ' 件</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>内容</th><th>時点</th><th>出典</th><th>照合・状態</th></tr></thead><tbody>' +
      rows.map(function (c) {
        return '<tr><td>' + UI.claimChip(c.id) + '<div class="small">' + esc(L.claimType[c.type] || c.type) + '</div></td><td>' + esc(c.text) +
          (c.number ? '<div class="small muted">数値：' + esc(c.number) + '</div>' : '') + '</td><td class="nowrap">' + esc(c.as_of) + '</td><td class="small">' +
          (c.source_ids || []).map(function (s) { var x = d.index.sources[s]; return x ? UI.sourceLink(x) + '（' + esc(x.published) + '）' : esc(s); }).join('<br>') +
          '</td><td>' + UI.verdictTag(c) + UI.select('status', L.claimStatus, c.status || '有効', bind('claims', c.id, 'status')) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  /* ---------- 出典 ---------- */
  function sources(params) {
    var d = Store.data(), qq = q(params, 'q'), kind = q(params, 'kind'), st = q(params, 'status');
    var kinds = []; d.sources.forEach(function (s) { if (kinds.indexOf(s.kind) < 0) kinds.push(s.kind); });
    var rows = d.sources.filter(function (s) { return (!kind || s.kind === kind) && (!st || (s.status || '取得時に確認') === st) && UI.matchText(s, qq); });
    var usage = {}; d.claims.forEach(function (c) { (c.source_ids || []).forEach(function (s) { usage[s] = (usage[s] || 0) + 1; }); });
    return '<section class="panel"><h1>出典</h1><p class="small muted">検証状態と確認日を更新できます（ローカル保存）。「取得時に確認」は、初期データを作った時点でページを開いて内容を確かめたという意味です。</p>' +
      '<form class="filters" data-filter="sources"><input type="search" name="q" value="' + esc(qq) + '" placeholder="検索" aria-label="検索">' +
      UI.select('kind', [['', '種類：すべて']].concat(kinds), kind) +
      UI.select('status', [['', '状態：すべて']].concat(L.sourceStatus), st) + '</form>' +
      '<p class="small muted">' + rows.length + ' / ' + d.sources.length + ' 件</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>出典</th><th>公表</th><th>種類</th><th>使用</th><th>検証状態</th><th>最終確認日</th></tr></thead><tbody>' +
      rows.map(function (s) {
        return '<tr><td class="nowrap">' + esc(s.id) + '</td><td>' + UI.sourceLink(s) + '<div class="small muted">' + esc(s.publisher) + (s.notes ? '／' + esc(s.notes) : '') + '</div>' + (s.verification_note ? '<div class="small">照合：' + esc(s.verification_note) + '</div>' : '') + '</td><td class="nowrap">' +
          esc(s.published) + '</td><td>' + esc(s.kind) + '</td><td><a href="#/claims?q=' + esc(s.id) + '">' + (usage[s.id] || 0) + '</a></td><td>' +
          UI.select('status', L.sourceStatus, s.status || '取得時に確認', bind('sources', s.id, 'status')) + '</td><td><input type="date" ' + bind('sources', s.id, 'checked_on') +
          ' value="' + esc(s.checked_on || s.accessed || '') + '"></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<h2>出典を追加</h2><form data-action="addSource" class="addform"><input name="title" required placeholder="タイトル"><input name="publisher" placeholder="発行者"><input name="url" type="url" required placeholder="https://..."><input name="published" placeholder="公表日（YYYY-MM-DD）">' +
      UI.select('kind', ['自治体資料', '政府資料', '調査・統計', '団体公式', '事業者公式', '報道', '論文', 'ヒアリング記録', 'その他'], '自治体資料') + '<button type="submit">追加</button></form></section>' +
      '<section class="panel"><h2>調査で見つからなかった情報（' + d.gaps.length + ' 件）</h2><p class="small muted">初期データの調査で探したが確認できなかったものと、確認先の候補。未確認事項・ヒアリングの問いの元になっています。</p>' +
      '<details><summary>一覧を開く</summary><ul>' + d.gaps.map(function (g) { return '<li><span class="small muted">' + esc(g.topic) + '</span><br>' + esc(g.text) + '</li>'; }).join('') + '</ul></details></section>';
  }

  /* ---------- 保存・出力 ---------- */
  function output() {
    var st = Store.stats(), saved = Store.savedAt();
    return '<section class="panel"><h1>保存・出力</h1>' +
      '<h2>印刷・PDF</h2><p>ブラウザの印刷から PDF にできます。</p><p class="btns">' +
      '<a class="btn" href="#/print/reading">読みもの（まとめ・DePIN分析・アイデア一覧）</a> <a class="btn" href="#/print/summary">打ち合わせ用の短い要約</a> <a class="btn" href="#/print/detail">出典付きの詳細</a></p>' +
      '<h2>Markdown で書き出す</h2><p class="btns"><button type="button" class="btn" data-action="mdReading">読みもの .md</button> <button type="button" class="btn" data-action="mdSummary">要約 .md</button> <button type="button" class="btn" data-action="mdDetail">詳細 .md</button></p>' +
      '<h2>JSON で保存・復元</h2><p class="small">保存されるのは、あなたの変更（回答・メモ・検証状態・追加した出典や問い・費用の変更）です。初期データはアプリに含まれます。変更の数：' + st.changes + '、メモ：' + st.notes +
      (saved ? '、最終保存 ' + esc(new Date(saved).toLocaleString('ja-JP')) : '') + (Store.storageOk() ? '' : '<br><b class="danger">このブラウザではローカル保存が使えません。JSON に書き出して保存してください。</b>') + '</p>' +
      '<p class="btns"><button type="button" class="btn" data-action="exportLayer">変更を JSON で保存</button> <button type="button" class="btn" data-action="exportFull">全データを JSON で書き出す</button></p>' +
      '<p><label class="btn">JSON から復元<input type="file" accept="application/json,.json" data-action="importLayer" hidden></label></p>' +
      '<p class="small muted">復元すると、いまの変更は JSON の内容で置き換わります。</p>' +
      '<h2>初期化</h2><p><button type="button" class="btn danger" data-action="clearAll">変更をすべて消す</button></p></section>';
  }

  window.Views = {
    overview: overview, issues: issues, issueDetail: issueDetail, stakeholders: stakeholders, flow: flow,
    candidates: candidates, unknowns: unknowns, interviews: interviews, pilots: pilots, cases: cases,
    claims: claims, sources: sources, output: output, unknownStatus: unknownStatus
  };
})();
