// Build the public policy document from the same Markdown distributed in the repository.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const markdown = await readFile(new URL('PRIVACY.md', root), 'utf8');
const escape = text => text.replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const paragraphs = markdown.trim().split(/\r?\n\s*\r?\n/u);
const content = paragraphs.map(block => {
  const match = /^(#{1,3}) (.*)$/su.exec(block);
  if (match) {
    const id = match[2] === '日本語' ? 'ja' : match[2] === 'English' ? 'en' : null;
    return `<h${match[1].length}${id ? ` id="${id}"` : ''}>${escape(match[2])}</h${match[1].length}>`;
  }
  return `<p>${escape(block).replace(/\r?\n/gu, ' ')}</p>`;
}).join('\n');
const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Privacy policy for Prompt Library, a local-only Microsoft Edge extension. 日本語・English。"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Prompt Library · Privacy Policy</title><style>
:root{font-family:system-ui,"Segoe UI",Meiryo,sans-serif;color:#28283b;background:#f7f6f2;line-height:1.9}body{margin:0;padding:48px 24px 64px}main{max-width:760px;margin:auto}nav{display:flex;gap:20px;margin:0 0 30px}a{color:#5854c7;text-underline-offset:4px}h1{font-size:25px;line-height:1.5;letter-spacing:-.4px;margin-bottom:18px}h2{font-size:21px;border-top:1px solid #dedbe5;padding-top:32px;margin-top:42px;scroll-margin-top:24px}h3{font-size:16px;margin:26px 0 8px}p{font-size:14px;color:#565160;margin:0 0 16px}footer{margin-top:40px;border-top:1px solid #dedbe5;padding-top:20px;font-size:12px;color:#81798c}@media(max-width:500px){body{padding:26px 20px}h1{font-size:21px}}
</style></head><body><main><nav aria-label="Language"><a href="#ja" lang="ja">日本語</a><a href="#en" lang="en">English</a></nav>${content}<footer>Prompt Library · Microsoft Edge extension</footer></main></body></html>`;
await mkdir(new URL('docs/', root), { recursive: true });
await writeFile(new URL('docs/index.html', root), html);
await writeFile(new URL('docs/.nojekyll', root), '');
console.log('GitHub Pages document generated: docs/index.html');
