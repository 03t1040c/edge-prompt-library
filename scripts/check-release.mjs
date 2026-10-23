import { readFile, readdir, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { buildPopupSource } from './build-popup.mjs';
const root = new URL('../', import.meta.url);
const extension = new URL('extension/', root);
const json = async url => JSON.parse(await readFile(url, 'utf8'));
const manifest = await json(new URL('manifest.json', extension));
const pkg = await json(new URL('package.json', root));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version, 'Manifest and package versions must match');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/u);
assert.deepEqual([...manifest.permissions].sort(), ['clipboardWrite', 'storage']);
assert.equal(manifest.host_permissions?.length || 0, 0);
assert.equal(manifest.optional_host_permissions?.length || 0, 0);
assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/u);
const known = new Set(['manifest.json', 'background.js', 'core.mjs', 'i18n.mjs', 'popup.mjs', 'popup.js', 'popup.css', 'popup.html', 'icons', '_locales']);
for (const name of await readdir(extension)) assert.ok(known.has(name), `Unexpected file or directory in package: ${name}`);
assert.equal(await readFile(new URL('popup.js', extension), 'utf8'), await buildPopupSource(), 'popup.js is outdated; run npm run build');
assert.match(await readFile(new URL('popup.html', extension), 'utf8'), /<script defer src="popup\.js"><\/script>/u);
for (const locale of ['en', 'ja']) {
  const messages = await json(new URL(`_locales/${locale}/messages.json`, extension));
  assert.ok(messages.extensionName.message.length > 0 && messages.extensionName.message.length <= 75);
  assert.ok(messages.extensionDescription.message.length > 0 && messages.extensionDescription.message.length <= 132, `${locale} description exceeds 132 characters`);
  assert.ok(messages.openLibrary.message);
}
assert.equal(manifest.name, '__MSG_extensionName__');
assert.equal(manifest.description, '__MSG_extensionDescription__');
for (const filename of [manifest.action.default_popup, manifest.background.service_worker, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)]) assert.ok((await stat(new URL(filename, extension))).isFile(), `Missing runtime file: ${filename}`);
for (const [size, filename] of Object.entries(manifest.icons)) {
  const png = await readFile(new URL(filename, extension));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), Number(size)); assert.equal(png.readUInt32BE(20), Number(size));
}
for (const [filename, width, height] of [['logo-300.png', 300, 300], ...['library-ja', 'settings-ja', 'library-en', 'settings-en'].map(name => [`${name}-1280x800.png`, 1280, 800])]) {
  const png = await readFile(new URL(`store-assets/${filename}`, root));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), width, `Incorrect width: ${filename}`);
  assert.equal(png.readUInt32BE(20), height, `Incorrect height: ${filename}`);
}
assert.ok((await stat(new URL('docs/index.html', root))).isFile(), 'GitHub Pages policy document is missing');
console.log(`Release checks passed: ${manifest.version}, Manifest V3, ja/en, two permissions, local assets only.`);
