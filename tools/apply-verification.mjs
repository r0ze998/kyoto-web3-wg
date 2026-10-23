// 検証パッチ（<X>-patch.json）を data/research/<X>.json に反映する。
// 使い方: node tools/apply-verification.mjs <patch.json> [<patch.json> ...]
// 反映後は node tools/build-data.mjs で参照の整合性を確認すること。
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKED_ON = process.env.CHECKED_ON || new Date().toISOString().slice(0, 10);
const VERDICT_STATUS = { verified: '有効', corrected: '有効', outdated: '要更新', unsupported: '反証あり', source_unavailable: '要更新' };
const CLAIM_FIELDS = ['text', 'type', 'number', 'as_of', 'source_ids', 'tags'];
const SOURCE_FIELDS = ['title', 'publisher', 'url', 'published', 'kind', 'notes'];
const CASE_FIELDS = ['name', 'region', 'operator', 'summary', 'stage', 'stage_evidence', 'status_2026', 'who_pays', 'results', 'lessons', 'source_ids'];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj && obj[f] !== undefined && obj[f] !== '' && !(Array.isArray(obj[f]) && !obj[f].length)) out[f] = obj[f];
  return out;
}

for (const patchPath of process.argv.slice(2)) {
  const patch = JSON.parse(readFileSync(patchPath, 'utf8'));
  const file = join(root, 'data', 'research', `${patch.file}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const claims = byId(data.claims), sources = byId(data.sources), cases = byId(data.cases);
  const log = { claims: {}, sources: 0, cases: 0, newSources: 0, newClaims: 0, removed: 0, missing: [] };

  for (const p of patch.claims || []) {
    const c = claims[p.id];
    if (!c) { log.missing.push(p.id); continue; }
    Object.assign(c, pick(p.fix, CLAIM_FIELDS));
    c.status = VERDICT_STATUS[p.verdict] || '要更新';
    c.verification = { verdict: p.verdict, note: p.note || '', checked_on: CHECKED_ON };
    log.claims[p.verdict] = (log.claims[p.verdict] || 0) + 1;
  }
  for (const p of patch.sources || []) {
    const s = sources[p.id];
    if (!s) { log.missing.push(p.id); continue; }
    Object.assign(s, pick(p.fix, SOURCE_FIELDS));
    s.status = p.status || s.status;
    s.checked_on = CHECKED_ON;
    if (p.note) s.verification_note = p.note;
    log.sources++;
  }
  for (const p of patch.cases || []) {
    const x = cases[p.id];
    if (!x) { log.missing.push(p.id); continue; }
    Object.assign(x, pick(p.fix, CASE_FIELDS));
    x.verification = { note: p.note || '', checked_on: CHECKED_ON };
    log.cases++;
  }
  for (const s of patch.new_sources || []) {
    if (sources[s.id]) { log.missing.push('dup ' + s.id); continue; }
    data.sources.push({ ...s, status: s.status || '確認済み', checked_on: CHECKED_ON });
    log.newSources++;
  }
  for (const c of patch.new_claims || []) {
    if (claims[c.id]) { log.missing.push('dup ' + c.id); continue; }
    data.claims.push({ ...c, status: '有効', verification: { verdict: 'added', note: '検証時に追加', checked_on: CHECKED_ON } });
    log.newClaims++;
  }
  const remove = new Set(patch.remove_claims || []);
  if (remove.size) {
    data.removed_claims = (data.removed_claims || []).concat(data.claims.filter((c) => remove.has(c.id)));
    data.claims = data.claims.filter((c) => !remove.has(c.id));
    log.removed = remove.size;
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  const unchecked = data.claims.filter((c) => !c.verification).map((c) => c.id);
  console.log(patch.file, JSON.stringify(log), unchecked.length ? 'UNCHECKED: ' + unchecked.join(',') : 'all claims checked');
}
