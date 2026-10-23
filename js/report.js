/* 打ち合わせ用の要約と、出典付き詳細。中身はブロックの配列で組み立て、HTML と Markdown の両方に変換する。 */
(function () {
  'use strict';
  var esc = UI.esc, L = UI.LABELS;

  function refs(ids, used) {
    (ids || []).forEach(function (i) { used[i] = true; });
    return ids && ids.length ? ' [' + ids.join(', ') + ']' : '';
  }

  function summaryBlocks() {
    var d = Store.data(), m = d.meta, B = [];
    B.push({ h: 1, t: m.title + '：打ち合わせ用要約' });
    B.push({ p: '作成 ' + UI.today() + '／初期データ ' + (m.version || '') + '／打ち合わせ ' + (m.meeting || '') });
    B.push({ p: m.caution });
    B.push({ h: 2, t: '検証する構造仮説' });
    B.push({ ul: d.hypotheses.map(function (h) { return h.id + ' ' + h.text + '（' + h.status + '）'; }) });
    B.push({ h: 2, t: '候補案（総合点なし）' });
    B.push({
      table: {
        head: ['案', '状態', 'ひとことで', '誰が払うか', '成否を左右する未確認事項'],
        rows: d.proposals.map(function (p) {
          return [p.id + ' ' + p.title, p.status, p.one_liner, p.payer,
            (p.unknown_ids || []).map(function (u) { return d.index.unknowns[u]; })
              .filter(function (u) { return u && u.blocking && u.status !== '解消'; })
              .map(function (u) { return u.id + ' ' + u.text; }).join(' ／ ') || 'なし'];
        })
      }
    });
    var cmp = Store.getNote('compare');
    if (cmp) { B.push({ h: 3, t: '比較メモ' }); B.push({ p: cmp }); }
    B.push({ h: 2, t: '打ち合わせで確認したいこと' });
    B.push({ ul: (m.meeting_asks || []) });
    B.push({ h: 2, t: '最小実証案' });
    d.pilots.forEach(function (p) {
      var sum = 0, unk = 0;
      (p.costs || []).forEach(function (c) { if (typeof c.amount === 'number') sum += c.amount; else unk++; });
      B.push({ h: 3, t: p.id + ' ' + p.title });
      B.push({
        ul: ['対象：' + p.target, '期間：' + p.duration, '確かめること：' + p.question,
          '人：' + (p.people || []).map(function (x) { return x.role + ' ' + x.count; }).join('、'),
          '費用（試算・見積の合計）：' + sum.toLocaleString('ja-JP') + ' 円' + (unk ? '（金額未確認 ' + unk + ' 項目を除く）' : '') + '。見積は未取得',
          '中止条件：' + (p.stop || []).join('／')]
      });
    });
    var answered = d.questions.filter(function (x) { return x.status === '回答あり' || x.status === '一部回答'; });
    B.push({ h: 2, t: 'ヒアリングの進み具合' });
    B.push({ p: d.questions.length + ' 問中 ' + answered.length + ' 問に回答の記録あり。' });
    if (answered.length) B.push({ ul: answered.map(function (x) { return x.id + ' ' + x.question + ' → ' + (x.answer || '') + (x.decision_change ? '（判断の変化：' + x.decision_change + '）' : ''); }) });
    return B;
  }

  function detailBlocks() {
    var d = Store.data(), m = d.meta, B = [], used = {};
    B.push({ h: 1, t: m.title + '：出典付き詳細' });
    B.push({ p: '作成 ' + UI.today() + '／初期データ ' + (m.version || '') + '。[ ] 内は主張ID。末尾に主張と出典の一覧があります。' });
    B.push({ p: m.caution });
    d.issues.forEach(function (i) {
      var w = i.q1_who || {}, f = i.q2_flow || {}, ex = i.q3_existing || {}, nc = i.q6_no_chain || {}, fz = i.q8_falsify || {};
      B.push({ h: 2, t: i.id + '. ' + i.title + '（' + i.domain + '／' + (i.hypotheses || []).join(',') + '／根拠 ' + (L.strength[i.evidence_level] || '') + '）' });
      B.push({ p: i.summary });
      if (i.boundary) B.push({ p: '※ ' + i.boundary });
      B.push({ h: 3, t: '1. 誰が・どこで・どのくらい' });
      B.push({ p: w.text + ' 規模：' + (w.quant || '未確認') + refs(w.claims, used) });
      B.push({ h: 3, t: '2. 流れ・負担・受益・決定' });
      B.push({ ol: f.steps || [] });
      B.push({ ul: ['負担：' + f.cost_bearer, '受益：' + f.beneficiaries, '決定：' + f.decision_makers + refs(f.claims, used)] });
      B.push({ h: 3, t: '3. 既存手段と残る問題' });
      B.push({ table: { head: ['手段', 'カバー', '残る問題'], rows: (ex.means || []).map(function (x) { return [x.name, x.covers, x.gap + refs(x.claims, used)]; }) } });
      B.push({ p: ex.remaining });
      B.push({ h: 3, t: '4. 変えるべき仕組み' });
      B.push({ ul: (i.q4_mechanism || []).map(function (x) { return x.target + '：' + x.change; }) });
      B.push({ h: 3, t: '5. 支払う主体と理由' });
      B.push({ ul: (i.q5_payers || []).map(function (x) { return x.who + '：' + x.rationale + '（確からしさ ' + (L.strength[x.confidence] || x.confidence) + '）' + refs(x.claims, used); }) });
      B.push({ h: 3, t: '6. ブロックチェーンなしとの比較' });
      B.push({ ul: ['なしの案：' + nc.alternative, '比較：' + nc.comparison, 'チェーンが効く条件：' + nc.chain_adds] });
      B.push({ h: 3, t: '7. 副作用' });
      B.push({ ul: (i.q7_risks || []).map(function (x) { return x.type + '：' + x.text + ' → ' + x.mitigation; }) });
      B.push({ h: 3, t: '8. 否定条件と最小の確認' });
      B.push({ ul: (fz.conditions || []).map(function (x) { return '否定条件：' + x; }).concat((fz.minimal_check || []).map(function (x) { return '確認：' + x; })) });
      var unk = (i.unknown_ids || []).map(function (u) { return d.index.unknowns[u]; }).filter(Boolean);
      if (unk.length) { B.push({ h: 3, t: '未確認事項' }); B.push({ ul: unk.map(function (u) { return u.id + '［' + u.status + '］' + u.text + '（確認先：' + u.ask_whom + '）'; }) }); }
      var note = Store.getNote('issue:' + i.id);
      if (note) { B.push({ h: 3, t: 'メモ' }); B.push({ p: note }); }
      refs(i.claims, used);
    });
    B.push({ h: 2, t: '候補案' });
    d.proposals.forEach(function (p) {
      B.push({ h: 3, t: p.id + ' ' + p.title + '（' + p.status + '）' });
      B.push({ ul: ['ひとことで：' + p.one_liner, '変える仕組み：' + p.mechanism, '誰が払うか：' + p.payer, '払う理由：' + p.why_pay, 'チェーンの役割：' + p.chain_role, 'なしの版：' + p.no_chain] });
      B.push({ table: { head: ['観点', '内容', '根拠の強さ'], rows: d.dims.map(function (dim) { var c = (p.dims || {})[dim.key] || {}; return [dim.label, (c.text || '') + refs(c.claims, used), L.strength[c.strength] || '未確認']; }) } });
    });
    B.push({ h: 2, t: 'ヒアリング記録' });
    B.push({ table: { head: ['ID', '相手', '問い', '状態', '回答', '根拠', '判断の変化'], rows: d.questions.map(function (x) { return [x.id, x.to_role, x.question, x.status, x.answer || '', x.evidence || '', x.decision_change || '']; }) } });
    B.push({ h: 2, t: '主張一覧' });
    var claimIds = Object.keys(used).sort();
    B.push({ table: { head: ['ID', '種類', '内容', '時点', '出典ID', '照合'], rows: claimIds.map(function (id) { var c = d.index.claims[id]; return c ? [id, L.claimType[c.type], c.text, c.as_of || '', (c.source_ids || []).join(', '), c.verification ? L.verdict[c.verification.verdict] + '（' + c.verification.checked_on + '）' : '未照合'] : [id, '', '（見つからない）', '', '', '']; }) } });
    var srcUsed = {}; claimIds.forEach(function (id) { var c = d.index.claims[id]; if (c) (c.source_ids || []).forEach(function (s) { srcUsed[s] = true; }); });
    B.push({ h: 2, t: '出典一覧' });
    B.push({ ul: Object.keys(srcUsed).sort().map(function (sid) { var s = d.index.sources[sid]; return s ? sid + ' ' + s.title + '（' + s.publisher + '、公表 ' + s.published + '、取得 ' + s.accessed + '、' + (s.status || '取得時に確認') + '） ' + s.url : sid; }) });
    return B;
  }

  function toHtml(B) {
    return B.map(function (b) {
      if (b.h) return '<h' + b.h + '>' + esc(b.t) + '</h' + b.h + '>';
      if (b.p != null) return '<p>' + esc(b.p) + '</p>';
      if (b.ul) return '<ul>' + b.ul.map(function (x) { return '<li>' + linkify(x) + '</li>'; }).join('') + '</ul>';
      if (b.ol) return '<ol>' + b.ol.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
      if (b.table) return '<table class="tbl"><thead><tr>' + b.table.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        b.table.rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
      return '';
    }).join('\n');
  }
  function linkify(s) {
    return esc(s).replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '">' + u + '</a>'; });
  }
  function cell(x) { return String(x == null ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' '); }
  function toMd(B) {
    return B.map(function (b) {
      if (b.h) return '#'.repeat(b.h) + ' ' + b.t + '\n';
      if (b.p != null) return b.p + '\n';
      if (b.ul) return b.ul.map(function (x) { return '- ' + x; }).join('\n') + '\n';
      if (b.ol) return b.ol.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n') + '\n';
      if (b.table) return '| ' + b.table.head.map(cell).join(' | ') + ' |\n|' + b.table.head.map(function () { return '---'; }).join('|') + '|\n' +
        b.table.rows.map(function (r) { return '| ' + r.map(cell).join(' | ') + ' |'; }).join('\n') + '\n';
      return '';
    }).join('\n');
  }

  window.Report = {
    summaryHtml: function () { return toHtml(summaryBlocks()); },
    detailHtml: function () { return toHtml(detailBlocks()); },
    summaryMd: function () { return toMd(summaryBlocks()); },
    detailMd: function () { return toMd(detailBlocks()); }
  };
})();
