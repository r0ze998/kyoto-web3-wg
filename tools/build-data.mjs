// data/research/*.json（出典・主張・事例）と data/analysis.json（課題・案・実証・問い）を
// 1つにまとめ、参照の整合性を確かめてから data/bundle.js に書き出す。
// 使い方: node tools/build-data.mjs [--check]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const checkOnly = process.argv.includes('--check');

const research = { sources: [], claims: [], cases: [] };
const gaps = [];
for (const f of readdirSync(join(dataDir, 'research')).filter((f) => f.endsWith('.json')).sort()) {
  const j = JSON.parse(readFileSync(join(dataDir, 'research', f), 'utf8'));
  for (const k of Object.keys(research)) research[k].push(...(j[k] || []));
  for (const g of j.gaps || []) gaps.push({ topic: j.topic, text: g });
}
const analysis = JSON.parse(readFileSync(join(dataDir, 'analysis.json'), 'utf8'));
const seed = { ...analysis, ...research, gaps };

const errors = [];
const warnings = [];
const ids = {};
for (const c of ['sources', 'claims', 'cases', 'issues', 'stakeholders', 'matrix', 'proposals', 'pilots', 'questions', 'unknowns']) {
  ids[c] = new Set();
  for (const x of seed[c] || []) {
    if (!x.id) errors.push(`${c}: id がない要素`);
    else if (ids[c].has(x.id)) errors.push(`${c}: id 重複 ${x.id}`);
    ids[c].add(x.id);
  }
}
const need = (coll, id, where) => { if (!ids[coll].has(id)) errors.push(`${where}: ${coll} に ${id} がない`); };
const needAll = (coll, arr, where) => (arr || []).forEach((id) => need(coll, id, where));

const CLAIM_TYPES = ['fact', 'party_claim', 'inference'];
const STAGES = ['announced', 'pilot', 'ongoing', 'financially_sustained', 'ended', 'unknown'];
for (const s of seed.sources) {
  if (!/^https?:\/\//.test(s.url || '')) errors.push(`source ${s.id}: URL 不正`);
  if (!s.published) warnings.push(`source ${s.id}: 公表日なし`);
}
for (const c of seed.claims) {
  if (!CLAIM_TYPES.includes(c.type)) errors.push(`claim ${c.id}: type 不正 ${c.type}`);
  if (c.type !== 'inference' && !(c.source_ids || []).length) errors.push(`claim ${c.id}: 出典なし`);
  needAll('sources', c.source_ids, `claim ${c.id}`);
}
for (const x of seed.cases) {
  if (!STAGES.includes(x.stage)) errors.push(`case ${x.id}: stage 不正 ${x.stage}`);
  needAll('sources', x.source_ids, `case ${x.id}`);
}
const claimRefs = (arr, where) => needAll('claims', arr, where);
for (const i of seed.issues) {
  const w = `issue ${i.id}`;
  for (const k of ['q1_who', 'q2_flow', 'q3_existing', 'q4_mechanism', 'q5_payers', 'q6_no_chain', 'q7_risks', 'q8_falsify']) {
    if (!i[k]) errors.push(`${w}: ${k} がない`);
  }
  claimRefs(i.claims, w);
  claimRefs(i.q1_who?.claims, w);
  claimRefs(i.q2_flow?.claims, w);
  (i.q3_existing?.means || []).forEach((m) => claimRefs(m.claims, w));
  (i.q5_payers || []).forEach((m) => claimRefs(m.claims, w));
  needAll('unknowns', i.unknown_ids, w);
  needAll('cases', i.case_ids, w);
  // 課題カードの中で引いている主張は、すべて「関連する主張」にも入っているべき
  const inner = new Set([...(i.q1_who?.claims || []), ...(i.q2_flow?.claims || []),
    ...(i.q3_existing?.means || []).flatMap((m) => m.claims || []), ...(i.q5_payers || []).flatMap((m) => m.claims || [])]);
  for (const c of inner) if (!(i.claims || []).includes(c)) warnings.push(`${w}: ${c} が claims 一覧にない`);
}
for (const m of seed.matrix) { need('issues', m.issue_id, `matrix ${m.id}`); need('stakeholders', m.stakeholder_id, `matrix ${m.id}`); claimRefs(m.claims, `matrix ${m.id}`); }
for (const p of seed.proposals) {
  needAll('issues', p.issue_ids, `proposal ${p.id}`); needAll('unknowns', p.unknown_ids, `proposal ${p.id}`); claimRefs(p.claims, `proposal ${p.id}`);
  for (const d of seed.dims) {
    const cell = p.dims?.[d.key];
    if (!cell) errors.push(`proposal ${p.id}: 観点 ${d.key} が未記入`);
    else claimRefs(cell.claims, `proposal ${p.id}.${d.key}`);
  }
}
for (const p of seed.pilots) {
  need('proposals', p.proposal_id, `pilot ${p.id}`);
  needAll('unknowns', p.unknown_ids, `pilot ${p.id}`);
  for (const c of p.costs || []) {
    if (!['estimate_calc', 'quote', 'unknown'].includes(c.kind)) errors.push(`pilot ${p.id}: 費用種別不正`);
    if (c.kind === 'quote') errors.push(`pilot ${p.id}: 初期データに「見積」は入れない（実際の見積がないため）`);
    if (c.kind === 'unknown' && c.amount != null) errors.push(`pilot ${p.id}: 未確認なのに金額あり`);
  }
}
for (const q of seed.questions) {
  needAll('unknowns', q.unknown_ids, `question ${q.id}`);
  // 人に聞く問いの回答は初期データに入れない（ヒアリングを創作しない）。
  // 公開資料で確かめる問いだけは、根拠に公開資料を明記した場合に限り入れてよい。
  const fromPublic = /^公開資料/.test(q.to_role || '') && /^公開資料/.test(q.evidence || '');
  if ((q.answer || q.evidence || q.decision_change) && !fromPublic) errors.push(`question ${q.id}: 初期データに回答を入れない（ヒアリングを創作しない）`);
}
for (const u of seed.unknowns) { needAll('issues', u.issue_ids, `unknown ${u.id}`); needAll('proposals', u.proposal_ids, `unknown ${u.id}`); }
// 問いがひとつも付いていない未確認事項は、確認の手段が決まっていない
for (const u of seed.unknowns) if (!seed.questions.some((q) => (q.unknown_ids || []).includes(u.id))) warnings.push(`unknown ${u.id}: 対応する問いがない`);

const usedClaims = new Set();
const collect = (a) => (a || []).forEach((c) => usedClaims.add(c));
seed.issues.forEach((i) => collect(i.claims)); seed.proposals.forEach((p) => { collect(p.claims); Object.values(p.dims || {}).forEach((c) => collect(c.claims)); });
seed.matrix.forEach((m) => collect(m.claims));
const unusedClaims = seed.claims.filter((c) => !usedClaims.has(c.id)).length;

for (const w of warnings) console.warn('warn:', w);
console.log(`sources ${seed.sources.length} / claims ${seed.claims.length}（画面から未参照 ${unusedClaims}）/ cases ${seed.cases.length} / issues ${seed.issues.length} / proposals ${seed.proposals.length} / pilots ${seed.pilots.length} / questions ${seed.questions.length} / unknowns ${seed.unknowns.length}`);
if (errors.length) { for (const e of errors) console.error('ERROR:', e); process.exit(1); }
if (!checkOnly) {
  writeFileSync(join(dataDir, 'bundle.js'), '/* 自動生成: node tools/build-data.mjs。直接編集しない */\nwindow.SEED = ' + JSON.stringify(seed) + ';\n');
  console.log('wrote data/bundle.js');
}
