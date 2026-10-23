// Focused release regression tests, including delayed APIs and competing views.
// Usage: node tests/final-check.mjs <node_modules> [extension directory] [report label]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { emptyLibrary, normalizePrompt, makeExport } from '../extension/core.mjs';
const require = process.argv[2] ? createRequire(path.join(process.argv[2], 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const extensionPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'extension');
const label = process.argv[4] || 'final';
if (!/^[a-z-]+$/u.test(label)) throw new Error('Invalid report label');
const output = path.join(root, 'test-results'); await mkdir(output, { recursive: true });
const context = await chromium.launchPersistentContext(path.join(output, `final-${label}-profile`), {
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
  viewport: { width: 800, height: 650 }, locale: 'ja-JP', reducedMotion: 'reduce',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
});
const checks = [], errors = [], network = [];
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const url = `chrome-extension://${new URL(worker.url()).host}/popup.html`;
  await context.grantPermissions(['clipboard-read']);
  const makeFixture = (count = 3) => ({ ...emptyLibrary(), settings: { ...emptyLibrary().settings, language: 'ja' }, prompts: Array.from({ length: count }, (_, index) => normalizePrompt({ id: `p${index}`, title: `プロンプト ${index}`, tags: [`タグ${index}`], content: `本文 ${index}\n日本語・English 😀\n${'全文コピーの確認。'.repeat(80)}`, createdAt: 1000 + index })) });
  const disk = async () => (await worker.evaluate(() => chrome.storage.local.get('library'))).library;
  const seed = async (library = makeFixture()) => worker.evaluate(async library => { await chrome.storage.local.clear(); await chrome.storage.local.set({ library }); }, library);
  async function open() {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => { if (/^https?:/u.test(req.url())) network.push(req.url()); });
    await page.goto(url); await page.waitForFunction(() => performance.getEntriesByName('library-ready').length);
    return page;
  }
  async function run(name, operation) {
    const pages = new Set(context.pages());
    try {
      const result = await operation(); if (!result) throw new Error('Assertion failed');
      checks.push({ name, passed: true }); console.log(`PASS ${name}`);
    } catch (error) { checks.push({ name, passed: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
    // Edge may open its own download surface; only dispose views created by this test.
    finally { for (const page of context.pages()) if (!pages.has(page) && page.url() === url) await page.close(); }
  }
  async function gateRead(page, key) {
    await page.evaluate(key => {
      const get = chrome.storage.local.get.bind(chrome.storage.local);
      window.readGate = { started: false, finished: false, release: null };
      const wait = new Promise(resolve => { window.readGate.release = resolve; });
      let once = true;
      chrome.storage.local.get = async (...args) => {
        const value = await get(...args);
        if (once && args[0] === key) { once = false; window.readGate.started = true; await wait; window.readGate.finished = true; }
        return value;
      };
    }, key);
  }
  await run('slow draft loading must not replace a newer Settings view', async () => {
    await seed(); const page = await open(); await gateRead(page, 'draft');
    await page.locator('#add-prompt').evaluate(button => button.click());
    await page.waitForFunction(() => window.readGate.started);
    await page.locator('#open-settings').click();
    await page.evaluate(() => window.readGate.release());
    await page.waitForFunction(() => window.readGate.finished);
    return await page.locator('#panel-title').textContent() === '設定';
  });
  await run('a delayed language save must not reopen a closed settings panel', async () => {
    await seed(); const page = await open(); await page.locator('#open-settings').click(); await gateRead(page, 'library');
    await page.getByLabel('言語 / Language').selectOption('en');
    await page.waitForFunction(() => window.readGate.started);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.evaluate(() => window.readGate.release());
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    return await page.locator('#panel').isHidden() && (await disk()).settings.language === 'en';
  });
  await run('concurrent views preserve both a favorite and a sort setting', async () => {
    await seed(); const first = await open(); const second = await open();
    await second.locator('#open-settings').click();
    for (const page of [first, second]) await page.evaluate(() => {
      const set = chrome.storage.local.set.bind(chrome.storage.local); window.libraryWrites = 0;
      chrome.storage.local.set = async data => { await set(data); if (data.library) window.libraryWrites++; };
    });
    await gateRead(first, 'library');
    await first.locator('.favorite-button').first().evaluate(button => button.click());
    await first.waitForFunction(() => window.readGate.started);
    await second.getByLabel('並び順', { exact: true }).selectOption('recent');
    // Let the second operation race a held first snapshot. A shared lock must queue it.
    await second.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    await first.evaluate(() => window.readGate.release());
    await Promise.all([first.waitForFunction(() => window.libraryWrites === 1), second.waitForFunction(() => window.libraryWrites === 1)]);
    const saved = await disk();
    return saved.prompts[0].favorite && saved.settings.sort === 'recent';
  });
  await run('IME confirmation does not copy or change usage', async () => {
    await seed(); const page = await open();
    await page.locator('#search').evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    return (await disk()).prompts.every(prompt => prompt.usageCount === 0);
  });
  await run('a stale editor must not recreate a prompt deleted in another view', async () => {
    await seed(); const first = await open(); const second = await open();
    await first.locator('.edit-button').first().click(); await first.locator('#prompt-title').fill('変更したタイトル');
    await second.locator('.edit-button').first().click(); await second.getByRole('button', { name: '削除', exact: true }).click();
    await second.locator('#confirmation').getByRole('button', { name: '削除', exact: true }).click();
    await second.waitForFunction(() => document.querySelectorAll('.prompt-card').length === 2);
    await first.getByRole('button', { name: '保存する', exact: true }).click();
    await first.waitForFunction(() => document.querySelector('#toast').textContent.includes('削除されています'));
    return (await disk()).prompts.length === 2;
  });
  await run('backup export includes the latest data saved by another view', async () => {
    await seed(); const first = await open(); const second = await open(); await first.locator('#open-settings').click();
    await second.locator('.favorite-button').first().click(); await second.waitForSelector('.favorite-button.is-favorite');
    const saved = await disk(); const downloading = first.waitForEvent('download');
    await first.getByRole('button', { name: 'バックアップを書き出す', exact: true }).click();
    const download = await downloading; const filename = path.join(output, `final-backup-${label}.json`); await download.saveAs(filename);
    const { readFile } = await import('node:fs/promises'); const exported = JSON.parse(await readFile(filename, 'utf8'));
    return isDeepStrictEqual(exported.prompts, saved.prompts) && isDeepStrictEqual(exported.settings, saved.settings);
  });
  await run('clipboard rejection does not increment usage', async () => {
    await seed(); const page = await open();
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
    await page.locator('.copy-area').first().click();
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('コピーできません'));
    return (await disk()).prompts.every(prompt => prompt.usageCount === 0);
  });
  await run('arrow selection crosses the initial 12 cards and copies complete content', async () => {
    const fixture = makeFixture(50); await seed(fixture); const page = await open();
    const input = page.locator('#search'); await input.focus();
    for (let index = 0; index < 13; index++) await input.press('ArrowDown');
    const id = await page.locator('.prompt-card.selected').getAttribute('data-id');
    if (await page.locator('.prompt-card').count() !== 24) return false;
    await input.press('Enter');
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('コピーしました'));
    const content = fixture.prompts.find(prompt => prompt.id === id).content;
    await page.waitForFunction(id => [...document.querySelectorAll('.prompt-card')].find(card => card.dataset.id === id)?.querySelector('.usage-count').textContent === '1回', id);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The Windows system clipboard may represent line breaks as CRLF.
    if (copied.replace(/\r\n/gu, '\n') !== content) throw new Error(`Clipboard content differs: copied ${copied.length}, expected ${content.length}`);
    return (await disk()).prompts.find(prompt => prompt.id === id).usageCount === 1;
  });
  await run('large popup fills both columns with 24 initial cards', async () => {
    await seed(makeFixture(50)); const page = await open(); await page.locator('#open-settings').click();
    await page.getByRole('button', { name: '大', exact: true }).click(); await page.waitForSelector('body.size-large');
    return await page.locator('.prompt-card').count() === 24;
  });
  await run('canceling backup replacement preserves the original library', async () => {
    const original = makeFixture(); const replacement = makeFixture(2); replacement.settings.language = 'en';
    await seed(original); const page = await open(); await page.locator('#open-settings').click();
    await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeExport(replacement))) });
    await page.getByRole('button', { name: '置き換える', exact: true }).click();
    await page.locator('#confirmation').getByRole('button', { name: 'キャンセル', exact: true }).click();
    return isDeepStrictEqual(await disk(), original);
  });
  await run('backup replacement restores all settings, history, and multiline content', async () => {
    const replacement = makeFixture(2); replacement.settings = { ...replacement.settings, language: 'en', size: 'large', sort: 'recent', keyboardEnabled: false };
    replacement.prompts[1].favorite = true; replacement.prompts[1].usageCount = 321; replacement.prompts[1].lastUsedAt = 4567;
    await seed(); const page = await open(); await page.locator('#open-settings').click();
    await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeExport(replacement))) });
    await page.getByRole('button', { name: '置き換える', exact: true }).click();
    await page.locator('#confirmation').getByRole('button', { name: '置き換える', exact: true }).click();
    await page.waitForSelector('html[lang="en"]'); await page.reload(); await page.waitForFunction(() => performance.getEntriesByName('library-ready').length);
    return isDeepStrictEqual(await disk(), replacement) && await page.locator('body.size-large').count() === 1 && await page.locator('#keyboard-hint').innerText() === '';
  });
  await run('delete confirmation cancels safely and deletes only the chosen prompt', async () => {
    await seed(); const page = await open(); await page.locator('.edit-button').first().click();
    await page.getByRole('button', { name: '削除', exact: true }).click();
    await page.locator('#confirmation').getByRole('button', { name: 'キャンセル', exact: true }).click();
    if ((await disk()).prompts.length !== 3) return false;
    await page.getByRole('button', { name: '削除', exact: true }).click();
    await page.locator('#confirmation').getByRole('button', { name: '削除', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.prompt-card').length === 2);
    return (await disk()).prompts.length === 2 && (await disk()).prompts.every(prompt => prompt.id !== 'p0');
  });
  await run('failed library writes leave original data intact and allow retry', async () => {
    await seed(); const page = await open();
    await page.evaluate(() => {
      const set = chrome.storage.local.set.bind(chrome.storage.local); let once = true;
      chrome.storage.local.set = async data => { if (data.library && once) { once = false; throw new Error('Simulated storage failure'); } return set(data); };
    });
    await page.locator('.favorite-button').first().click();
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('保存できません'));
    if ((await disk()).prompts[0].favorite) return false;
    await page.locator('.favorite-button').first().click(); await page.waitForSelector('.favorite-button.is-favorite');
    return (await disk()).prompts[0].favorite;
  });
  checks.push({ name: 'no JavaScript exceptions', passed: errors.length === 0, errors });
  checks.push({ name: 'no external HTTP(S) requests', passed: network.length === 0, network });
  const report = { version: await worker.evaluate(() => chrome.runtime.getManifest().version), extensionPath, date: new Date().toISOString(), checks };
  await writeFile(path.join(output, `final-check-${label}.json`), JSON.stringify(report, null, 2));
  console.log(`Checks: ${checks.length}; failed: ${checks.filter(check => !check.passed).length}`);
  if (checks.some(check => !check.passed)) process.exitCode = 1;
} finally { await context.close(); }
