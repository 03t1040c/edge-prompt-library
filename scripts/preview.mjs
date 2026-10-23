// Local development preview only. Not included in the extension package.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let route = decodeURIComponent(url.pathname);
    if (route === '/') route = '/extension/popup.html';
    const target = path.resolve(root, `.${route}`);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    let data = await readFile(target);
    if (target.endsWith('popup.html')) data = data.toString().replace('<script defer src="popup.js"', '<script src="/scripts/preview-adapter.js"></script><script defer src="popup.js"');
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(4317, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4317/extension/popup.html'));
