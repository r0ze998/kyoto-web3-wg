// 打ち合わせ用の要約と出典付き詳細を、まっさらなブラウザ状態（利用者の変更なし）で PDF に書き出す。
// 使い方: node tools/export-pdf.mjs [出力ディレクトリ]
// 自分の回答・メモを含めた PDF が欲しいときは、アプリの「保存・出力」画面からブラウザの印刷を使う。
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(root, 'out');
mkdirSync(outDir, { recursive: true });
const index = pathToFileURL(join(root, 'index.html')).href;
if (!existsSync(join(root, 'data', 'bundle.js'))) throw new Error('data/bundle.js がありません。node tools/build-data.mjs を先に実行してください');

const browser = await playwright.chromium.launch();
try {
  const page = await (await browser.newContext()).newPage();
  for (const [route, file] of [['summary', 'kyoto-wg-summary.pdf'], ['detail', 'kyoto-wg-detail.pdf']]) {
    await page.goto(`${index}#/print/${route}`);
    const text = await page.locator('.report').innerText();
    if (/E2E|テスト用/.test(text)) throw new Error(`テスト用のデータが ${route} に混じっています`);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: join(outDir, file), format: 'A4' });
    await page.emulateMedia({ media: 'screen' });
    console.log('wrote', join(outDir, file));
  }
} finally {
  await browser.close();
}
