// 実ブラウザ（Chromium）で主要導線・モバイル表示・保存/復元を確かめる。
// 使い方: node tests/e2e.mjs [出力ディレクトリ]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(root, 'tests', 'out');
mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = p.endsWith('/') ? join(p, 'index.html') : p;
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
  res.end(readFileSync(file));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const results = [];
function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

const ROUTES = ['', 'issues', 'issues/I1', 'stakeholders', 'stakeholders?view=all', 'flow', 'candidates', 'unknowns', 'interviews', 'pilots', 'cases', 'claims', 'sources', 'output', 'print/summary', 'print/detail'];

const browser = await playwright.chromium.launch();
try {
  /* ---------- PC ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(base);
  check('起動：タイトルと進め方が出る', await page.locator('h1').first().textContent() && await page.locator('.flow-steps li').count() === 4);

  for (const r of ROUTES) {
    await page.goto(base + '#/' + r);
    const txt = await page.locator('#app').innerText();
    check(`画面 #/${r} が描画される`, txt.length > 50 && !/見つかりません|undefined|\[object Object\]|NaN/.test(txt),
      /undefined|\[object Object\]|NaN/.test(txt) ? '不正な文字列あり' : '');
  }
  await page.goto(base + '#/');
  await page.screenshot({ path: join(outDir, 'pc-overview.png'), fullPage: true });

  // 導線 1: 候補比較
  await page.goto(base + '#/candidates');
  const propCols = await page.locator('table.compare thead th').count() - 1;
  check('候補比較：案が3つ前後並ぶ', propCols >= 2 && propCols <= 4, `${propCols} 案`);
  check('候補比較：総合点の列がない', !/(総合点|合計点|スコア)\s*[:：]?\s*\d/.test(await page.locator('table.compare').innerText()));
  await page.screenshot({ path: join(outDir, 'pc-candidates.png'), fullPage: true });

  // 主張チップ → 出典つきモーダル
  await page.locator('table.compare [data-claim]').first().click();
  check('主張チップで出典が開く', await page.locator('#modal:not([hidden]) a[href^="http"]').count() > 0);
  await page.keyboard.press('Escape');

  // 導線 2: 未確認事項 → 絞り込み
  await page.goto(base + '#/unknowns');
  const allU = await page.locator('#app table tbody tr').count();
  await page.selectOption('form[data-filter] select[name=blocking]', '1');
  await page.waitForTimeout(100);
  const blk = await page.locator('#app table tbody tr').count();
  check('未確認事項：成否に影響するものだけに絞れる', blk > 0 && blk <= allU, `${blk}/${allU}`);

  // 検索
  await page.goto(base + '#/issues');
  const allI = await page.locator('.cards .card').count();
  await page.fill('form[data-filter] input[name=q]', '町内会');
  await page.waitForTimeout(500);
  const hitI = await page.locator('.cards .card').count();
  check('課題カード：検索で絞り込める', hitI > 0 && hitI < allI, `${hitI}/${allI}`);
  check('課題カード：検索中も入力欄にフォーカスが残る', await page.evaluate(() => document.activeElement && document.activeElement.name === 'q'));

  // 導線 3: ヒアリング記録 → 保存
  await page.goto(base + '#/interviews');
  const firstQ = page.locator('.qcard').first();
  const qid = (await firstQ.locator('header b').textContent()).trim();
  await firstQ.locator('textarea[data-bind$="|answer"]').fill('E2Eテスト用の回答');
  await firstQ.locator('textarea[data-bind$="|decision_change"]').fill('E2E: 判断の変化');
  await firstQ.locator('select[data-bind$="|status"]').selectOption('回答あり');
  await page.waitForTimeout(600);
  // 未確認事項の状態を変える
  await page.goto(base + '#/unknowns');
  const uSel = page.locator('select[data-bind^="unknowns|"]').first();
  const uBind = await uSel.getAttribute('data-bind');
  await uSel.selectOption('確認中');
  // 出典の検証状態を変える
  await page.goto(base + '#/sources');
  const sSel = page.locator('select[data-bind^="sources|"]').first();
  const sBind = await sSel.getAttribute('data-bind');
  await sSel.selectOption('要再確認');

  // 導線 4: 実証案の費用を編集
  await page.goto(base + '#/pilots');
  const cost = page.locator('input[data-cost]').first();
  await cost.fill('123000');
  await cost.dispatchEvent('change');
  await page.waitForTimeout(100);
  check('実証案：費用を変えると合計に反映', (await page.locator('.pilot tfoot').first().innerText()).includes('円'));
  check('実証案：中止条件がある', await page.locator('.pilot').first().innerText().then((t) => t.includes('中止条件')));
  await page.screenshot({ path: join(outDir, 'pc-pilots.png'), fullPage: true });

  // 再読み込みで残る
  await page.reload();
  await page.goto(base + '#/interviews');
  check('再読み込み後もヒアリング回答が残る', (await page.locator(`#q-${qid} textarea[data-bind$="|answer"]`).inputValue()) === 'E2Eテスト用の回答');
  await page.goto(base + '#/unknowns');
  check('再読み込み後も未確認事項の状態が残る', (await page.locator(`select[data-bind="${uBind}"]`).inputValue()) === '確認中');
  await page.goto(base + '#/sources');
  check('再読み込み後も出典の検証状態が残る', (await page.locator(`select[data-bind="${sBind}"]`).inputValue()) === '要再確認');

  // 要約に回答が反映される
  await page.goto(base + '#/print/summary');
  check('要約にヒアリング回答が反映される', (await page.locator('.report').innerText()).includes('E2Eテスト用の回答'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: join(outDir, 'summary.pdf'), format: 'A4' });
  await page.goto(base + '#/print/detail');
  await page.pdf({ path: join(outDir, 'detail.pdf'), format: 'A4' });
  check('詳細に出典一覧が出る', (await page.locator('.report').innerText()).includes('出典一覧'));
  await page.emulateMedia({ media: 'screen' });

  // JSON 保存 → 消去 → 復元
  await page.goto(base + '#/output');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=exportLayer]')]);
  const jsonPath = join(outDir, 'notes-export.json');
  await dl.saveAs(jsonPath);
  const exported = JSON.parse(readFileSync(jsonPath, 'utf8'));
  check('JSON 書き出し：回答が含まれる', JSON.stringify(exported).includes('E2Eテスト用の回答'));
  page.once('dialog', (d) => d.accept());
  await page.click('[data-action=clearAll]');
  await page.goto(base + '#/interviews');
  check('消去後は回答が空', (await page.locator(`#q-${qid} textarea[data-bind$="|answer"]`).inputValue()) === '');
  await page.goto(base + '#/output');
  page.once('dialog', (d) => d.accept());
  await page.setInputFiles('input[data-action=importLayer]', jsonPath);
  await page.waitForTimeout(300);
  await page.goto(base + '#/interviews');
  check('JSON 復元：回答が戻る', (await page.locator(`#q-${qid} textarea[data-bind$="|answer"]`).inputValue()) === 'E2Eテスト用の回答');
  await page.goto(base + '#/sources');
  check('JSON 復元：出典の検証状態が戻る', (await page.locator(`select[data-bind="${sBind}"]`).inputValue()) === '要再確認');
  // 不正な JSON は拒否
  const badPath = join(outDir, 'bad.json');
  (await import('node:fs')).writeFileSync(badPath, '{"hello":1}');
  await page.goto(base + '#/output');
  let msg = '';
  page.once('dialog', (d) => { msg = d.message(); d.accept(); });
  await page.setInputFiles('input[data-action=importLayer]', badPath);
  await page.waitForTimeout(300);
  check('他形式の JSON は復元しない', msg.includes('できませんでした'), msg);

  check('PC：コンソールエラーなし', errors.length === 0, errors.slice(0, 3).join(' / '));
  await ctx.close();

  /* ---------- モバイル ---------- */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  const merr = [];
  mp.on('pageerror', (e) => merr.push(e.message));
  for (const r of ROUTES) {
    await mp.goto(base + '#/' + r);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`モバイル #/${r}：横にはみ出さない`, overflow <= 1, `超過 ${overflow}px`);
  }
  for (const [r, name] of [['', 'mobile-overview'], ['issues/I1', 'mobile-issue'], ['candidates', 'mobile-candidates'], ['interviews', 'mobile-interviews'], ['flow', 'mobile-flow']]) {
    await mp.goto(base + '#/' + r);
    await mp.screenshot({ path: join(outDir, name + '.png'), fullPage: false });
  }
  // モバイルでも入力・保存できる
  await mp.goto(base + '#/interviews');
  await mp.locator('.qcard textarea[data-bind$="|answer"]').first().fill('モバイル入力');
  await mp.waitForTimeout(600);
  await mp.reload();
  check('モバイル：入力が保存される', (await mp.locator('.qcard textarea[data-bind$="|answer"]').first().inputValue()) === 'モバイル入力');
  check('モバイル：コンソールエラーなし', merr.length === 0, merr.slice(0, 3).join(' / '));
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
