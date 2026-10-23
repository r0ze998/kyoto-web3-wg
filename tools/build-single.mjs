// アプリ一式（HTML・CSS・JS・データ）を1つの HTML ファイルにまとめる。
// 展開や開発環境なしで、ファイルを開くだけで動く配布用。
// 使い方: node tools/build-single.mjs [出力ファイル]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'out', 'kyoto-wg-notes.html');
mkdirSync(dirname(out), { recursive: true });

let html = readFileSync(join(root, 'index.html'), 'utf8');
// </script> がデータ中にあっても HTML が壊れないようにする
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
  `<style>\n${readFileSync(join(root, href), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  `<script>\n${safe(readFileSync(join(root, src), 'utf8'))}\n</script>`);

if (/<(script|link)[^>]+(src|href)="(?!https?:|#)/.test(html)) throw new Error('外部ファイルの参照が残っています');
writeFileSync(out, html);
console.log('wrote', out, Math.round(html.length / 1024), 'KB');
