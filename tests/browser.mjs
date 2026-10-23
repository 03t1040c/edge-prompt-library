// Run: node tests/browser.mjs <directory containing playwright>
// Uses an isolated, headless Edge profile; never touches the normal Edge profile.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { emptyLibrary, normalizePrompt, makeExport } from '../extension/core.mjs';
const require = process.argv[2] ? createRequire(path.join(process.argv[2], 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'test-results'); await mkdir(output, { recursive: true });
const context = await chromium.launchPersistentContext(path.join(output, 'edge-profile'), {
  executablePath: process.env.PROMPT_LIBRARY_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, viewport: { width: 800, height: 650 }, locale: 'ja-JP', reducedMotion: 'reduce',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${path.join(root, 'extension')}`, `--load-extension=${path.join(root, 'extension')}`]
});
const errors = []; const network = []; const checks = [];
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const url = `chrome-extension://${id}/popup.html`;
  // Read permission exists only in this test browser, to verify the write result.
  await context.grantPermissions(['clipboard-read']);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/u.test(request.url())) network.push(request.url()); });
  const ready = () => page.waitForFunction(() => performance.getEntriesByName('library-ready').length > 0);
  const seed = async library => { await worker.evaluate(async library => { await chrome.storage.local.clear(); await chrome.storage.local.set({ library }); }, library); };
  const disk = () => worker.evaluate(async () => (await chrome.storage.local.get('library')).library);
  const check = (label, condition) => { assert.ok(condition, label); checks.push(label); console.log(`PASS ${label}`); };
  await worker.evaluate(() => chrome.storage.local.clear());
  await page.goto(url); await ready();
  check('empty state is localized to Japanese', await page.getByRole('button', { name: '最初のプロンプトを追加' }).isVisible());
  check('empty library has no placeholder tags or all button', await page.locator('#filters').isHidden() && await page.locator('#filters button').count() === 0);
  await page.getByRole('button', { name: '最初のプロンプトを追加' }).click();
  await page.locator('#prompt-title').fill('議事録を要約');
  await page.locator('#prompt-tags').fill('仕事, 要約');
  await page.locator('#prompt-content').fill('次の議事録を、決定事項とToDoに分けて要約してください。');
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  await page.waitForSelector('.prompt-card');
  check('create persists a prompt', (await disk()).prompts.length === 1);
  // Actual clipboard write under the extension clipboardWrite permission.
  await page.locator('.copy-area').click();
  await page.waitForFunction(() => document.querySelector('.usage-count').textContent === '1回');
  check('copy writes clipboard and increments usage once', await page.evaluate(() => navigator.clipboard.readText()) === (await disk()).prompts[0].content);
  await page.getByRole('button', { name: 'お気に入りに追加', exact: true }).click();
  await page.waitForSelector('.favorite-button.is-favorite');
  check('favorite does not copy or increment usage', (await disk()).prompts[0].usageCount === 1);
  await page.getByRole('button', { name: 'プロンプトを追加', exact: true }).click();
  await page.locator('#prompt-title').fill('下書きのテスト');
  await page.locator('#prompt-content').fill('これは書きかけの内容です');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.reload(); await ready();
  await page.getByRole('button', { name: 'プロンプトを追加', exact: true }).click();
  check('unfinished draft is lazily restored after reopening the popup', await page.locator('#prompt-title').inputValue() === '下書きのテスト');
  await page.getByRole('button', { name: '書きかけを破棄', exact: true }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('言語 / Language').selectOption('en');
  await page.waitForSelector('html[lang="en"]');
  check('English settings and privacy notice', await page.getByText('Entirely on your device', { exact: true }).isVisible());
  await page.getByLabel('Sort by', { exact: true }).selectOption('frequency');
  await page.getByRole('button', { name: 'Large', exact: true }).click();
  await page.waitForSelector('body.size-large');
  check('large popup is within 800x600', await page.evaluate(() => document.body.offsetWidth === 760 && document.body.offsetHeight === 600));
  await page.getByRole('button', { name: 'Small', exact: true }).click();
  await page.waitForSelector('body.size-small');
  check('small English settings fit without horizontal overflow', await page.locator('.panel-body').evaluate(node => node.scrollWidth <= node.clientWidth));
  await page.getByRole('button', { name: 'Medium', exact: true }).click();
  await page.waitForSelector('body.size-medium');
  const keyboard = page.getByRole('checkbox', { name: 'Keyboard controls', exact: true });
  await keyboard.uncheck();
  await page.waitForFunction(() => document.getElementById('keyboard-hint').textContent === '');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const beforeUsage = (await disk()).prompts[0].usageCount;
  await page.locator('#search').fill('議事録'); await page.locator('#search').press('ArrowDown'); await page.locator('#search').press('Enter');
  check('disabled optional keyboard controls do not copy', (await disk()).prompts[0].usageCount === beforeUsage);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Keyboard controls', exact: true }).check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('#search').press('ArrowDown'); await page.locator('#search').press('Enter');
  await page.waitForFunction(() => document.querySelector('.usage-count').textContent === '2 uses');
  check('search-arrow-enter copies the selected prompt', (await disk()).prompts[0].usageCount === 2);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise; await download.saveAs(path.join(output, 'backup.json'));
  const backup = JSON.parse(await readFile(path.join(output, 'backup.json'), 'utf8'));
  check('downloaded backup includes settings and usage', backup.kind === 'backup' && backup.prompts[0].usageCount === 2 && backup.settings.language === 'en');
  await page.getByRole('button', { name: 'Choose prompts to share', exact: true }).click();
  const collectionPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected prompts', exact: true }).click();
  await (await collectionPromise).saveAs(path.join(output, 'collection.json'));
  const collection = JSON.parse(await readFile(path.join(output, 'collection.json'), 'utf8'));
  check('shared file excludes private settings and usage', !('settings' in collection) && !('usageCount' in collection.prompts[0]));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('not a valid JSON'));
  check('invalid import leaves data intact', (await disk()).prompts.length === 1);
  const imported = makeExport({ ...emptyLibrary(), prompts: [normalizePrompt({ id: 'imported', title: '<img src=x onerror=alert(1)>', content: 'Imported prompt', tags: ['Shared'] })] }, 'collection');
  await page.locator('#import-file').setInputFiles({ name: 'prompts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await page.getByRole('button', { name: 'Add to library', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Added 1 prompts'));
  check('collection merges without changing language settings', (await disk()).prompts.length === 2 && (await disk()).settings.language === 'en');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('#search').fill('');
  check('imported HTML is rendered as plain text', await page.locator('.card-title').filter({ hasText: '<img src=x' }).count() === 1 && await page.locator('.prompt-card img').count() === 0);
  // Visual fixtures exist only in the test profile, never in a user's library.
  const fixture = emptyLibrary(); fixture.settings.language = 'ja'; fixture.settings.sort = 'frequency';
  fixture.prompts = [
    ['会議メモを、次のアクションへ', '次の会議メモを整理し、決定事項・未決事項・担当者つきのToDoに分けて簡潔にまとめてください。', ['仕事', '要約'], 28, true],
    ['伝わるメールに整える', '次の文章を、相手への配慮があり、要点が明確なビジネスメールに書き直してください。', ['メール', '文章'], 19, true],
    ['アイデアの壁打ち相手', 'このアイデアを異なる視点から検討し、強み・懸念点・改善案をそれぞれ3つ提案してください。', ['アイデア'], 12, false],
    ['自然な英語に翻訳', '次の日本語を、意味とニュアンスを保ちながら自然で読みやすい英語に翻訳してください。', ['翻訳', '英語'], 8, false],
    ['複雑な話を、わかりやすく', '次の内容を、この分野に詳しくない人にも伝わるように、身近な例を交えて説明してください。', ['学習', '説明'], 4, false],
    ['企画のリスクを洗い出す', 'この企画を実行する場合のリスクと、それぞれへの対策を具体的に提案してください。', ['企画'], 3, false],
    ['文章の論理をチェック', '次の文章の論理の飛躍や矛盾を指摘し、改善案を示してください。', ['文章'], 3, false],
    ['調べものの計画を立てる', 'このテーマの調査を進めるために、調べるべき項目と順序を整理してください。', ['調査'], 2, false],
    ['コードレビューを依頼', '次のコードについて、バグや可読性の改善点を優先度順に挙げてください。', ['開発'], 1, false],
    ['今日の振り返り', '今日の取り組みを整理し、学んだことと明日試すことをまとめてください。', ['振り返り'], 0, false]
  ].map(([title, content, tags, usageCount, favorite], index) => normalizePrompt({ id: `fixture-${index}`, title, content, tags, usageCount, favorite }));
  await seed(fixture); await page.reload(); await ready();
  await page.locator('#search').blur();
  const expectedTags = [...new Set(fixture.prompts.flatMap(prompt => prompt.tags))].sort(new Intl.Collator('ja').compare);
  check('filter chips contain only registered tags', JSON.stringify(await page.locator('#filters [data-tag]').evaluateAll(nodes => nodes.map(node => node.dataset.tag))) === JSON.stringify(expectedTags.slice(0, 12)));
  check('tag chips display names without numeric count suffixes', await page.locator('#filters [data-tag]').evaluateAll(nodes => nodes.every(node => node.textContent === node.dataset.tag)));
  check('favorites is icon-only beside the sort label', await page.locator('.list-controls #favorites-filter').count() === 1 && await page.locator('#favorites-filter').innerText() === '' && await page.locator('#filters svg').count() === 0);
  check('filter colors match the corresponding card tags', await page.evaluate(() => [...document.querySelectorAll('#filters [data-tag]')].every(chip => {
    const tag = [...document.querySelectorAll('.card-tags .tag')].find(node => node.textContent === chip.dataset.tag);
    return tag && getComputedStyle(tag).backgroundColor === getComputedStyle(chip).backgroundColor;
  })));
  await page.locator('#filters [data-tag="仕事"]').click();
  check('tag selection filters cards and marks the tag', await page.locator('.prompt-card').count() === 1 && await page.locator('#filters [data-tag="仕事"]').getAttribute('aria-pressed') === 'true');
  await page.locator('#favorites-filter').click();
  check('favorites combines independently with a selected tag', await page.locator('.prompt-card').count() === 1 && await page.locator('#favorites-filter').getAttribute('aria-pressed') === 'true');
  await page.locator('#filters [data-tag="仕事"]').click();
  check('deselecting a tag retains the favorites filter', await page.locator('.prompt-card').count() === 2 && await page.locator('#filters .active').count() === 0);
  await page.locator('#favorites-filter').click();
  check('no selected tag or favorite filter shows every prompt', await page.locator('.prompt-card').count() === fixture.prompts.length && await page.locator('#filters .active').count() === 0);
  await page.locator('#filters [data-tag="企画"]').click();
  check('tag filters include nonfavorite prompts', await page.locator('.prompt-card').count() === 1);
  await page.locator('#favorites-filter').click();
  check('favorite filter returns an empty result for a nonfavorite tag', await page.locator('.prompt-card').count() === 0);
  await page.locator('#favorites-filter').click();
  await page.locator('#filters [data-tag="企画"]').click();
  const overflowTag = expectedTags.at(-1);
  await page.getByRole('button', { name: 'タグを選ぶ', exact: true }).click();
  await page.getByRole('searchbox', { name: 'タグを検索', exact: true }).fill(overflowTag);
  check('tag picker displays tag names without numeric count suffixes', await page.locator('.tag-choice').innerText() === overflowTag);
  await page.locator('.tag-choice').click();
  check('overflow picker searches real tags and keeps the selected tag visible', await page.locator('#filters [data-tag]').evaluateAll((nodes, tag) => nodes.some(node => node.dataset.tag === tag && node.getAttribute('aria-pressed') === 'true'), overflowTag));
  await page.locator('#filters [data-tag]').filter({ hasText: overflowTag }).click();
  await page.locator('#search').blur();
  check('standard popup fully displays ten two-line cards', await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.prompt-card')];
    return cards.length === 10 && cards[9].getBoundingClientRect().bottom <= document.querySelector('#prompt-list').getBoundingClientRect().bottom && cards.every(card => card.getBoundingClientRect().height <= 41);
  }));
  await page.locator('#app').screenshot({ path: path.join(output, 'library-ja.png') });
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.locator('#app').screenshot({ path: path.join(output, 'settings-ja.png') });
  await page.locator('.panel-body').evaluate(node => node.scrollTop = node.scrollHeight);
  await page.locator('#app').screenshot({ path: path.join(output, 'privacy-ja.png') });
  await page.getByLabel('言語 / Language').selectOption('en');
  await page.waitForSelector('html[lang="en"]');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('#app').screenshot({ path: path.join(output, 'library-en.png') });
  check('no literal null or undefined leaked into UI', !/\b(null|undefined)\b/u.test(await page.locator('#app').innerText()));
  // Warm Edge process, fresh extension document on every sample. No network mocks.
  const measurements = [];
  for (const count of [0, 50, 2000]) {
    const data = emptyLibrary(); data.settings.language = 'ja';
    data.prompts = Array.from({ length: count }, (_, index) => normalizePrompt({ id: String(index), title: `プロンプト ${index}`, tags: ['仕事', `タグ${index % 12}`], content: '会議の内容を整理し、決定事項と担当者を明確にしてください。'.repeat(10), usageCount: index }));
    await seed(data);
    const samples = [];
    for (let run = 0; run < 10; run++) {
      await page.goto('about:blank'); await page.goto(url); await ready();
      samples.push(await page.evaluate(() => ({ ready: performance.getEntriesByName('library-ready')[0].startTime, rendered: performance.getEntriesByName('library-rendered')[0].startTime, paint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null })));
    }
    const readyTimes = samples.map(s => s.ready).sort((a, b) => a - b);
    measurements.push({ count, medianMs: readyTimes[5], maxMs: readyTimes.at(-1), samples });
    check(`${count} prompts: all 10 document loads ready within 500ms (max ${readyTimes.at(-1).toFixed(1)}ms)`, readyTimes.at(-1) < 500);
    if (count === 2000) {
      check('initial DOM is limited to 12 cards', await page.locator('.prompt-card').count() === 12);
      await page.getByRole('button', { name: 'さらに表示', exact: true }).click();
      check('more prompts remain accessible without copying', await page.locator('.prompt-card').count() === 36);
    }
  }
  // Genuine action popup opening. Edge does not expose this target as a Playwright Page.
  await seed(fixture);
  const actionStart = performance.now();
  const cdp = await context.newCDPSession(page);
  const before = new Set((await cdp.send('Target.getTargets')).targetInfos.map(t => t.targetId));
  await worker.evaluate(() => chrome.action.openPopup());
  const popupTarget = (await cdp.send('Target.getTargets')).targetInfos.find(target => !before.has(target.targetId) && target.url === url);
  check('action.openPopup opens the actual toolbar popup', Boolean(popupTarget));
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: false });
  let messageId = 0;
  function targetCommand(method, params = {}) {
    const id = ++messageId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cdp.off('Target.receivedMessageFromTarget', receive); reject(new Error('Popup CDP timeout')); }, 3000);
      function receive(event) {
        if (event.sessionId !== sessionId) return;
        const response = JSON.parse(event.message); if (response.id !== id) return;
        clearTimeout(timer); cdp.off('Target.receivedMessageFromTarget', receive);
        response.error ? reject(new Error(response.error.message)) : resolve(response.result);
      }
      cdp.on('Target.receivedMessageFromTarget', receive);
      cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
    });
  }
  let popupMetrics;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await targetCommand('Runtime.evaluate', { expression: 'performance.getEntriesByName("library-ready")[0]?.startTime || 0', returnByValue: true });
    popupMetrics = response.result.value; if (popupMetrics) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const observed = performance.now() - actionStart;
  measurements.push({ actionPopupObservedMs: observed, documentReadyMs: popupMetrics });
  check(`actual toolbar popup is ready within 500ms (${observed.toFixed(1)}ms including test overhead)`, popupMetrics > 0 && observed < 500);
  const capture = await targetCommand('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(output, 'toolbar-popup.png'), Buffer.from(capture.data, 'base64'));
  await cdp.send('Target.closeTarget', { targetId: popupTarget.targetId });
  check('extension makes no HTTP(S) requests', network.length === 0);
  check('no browser script errors', errors.length === 0);
  const version = context.browser()?.version();
  const report = { browser: version, date: new Date().toISOString(), checks, errors, network, measurements, note: 'Headless Edge, isolated profile, warm browser process. Timing is navigation-to-two-animation-frames after library render. Does not guarantee cold browser or overloaded system performance.' };
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ browser: version, measurements, checks: checks.length }, null, 2));
  // Leave a useful fixture for an explicit local preview only.
  await writeFile(path.join(output, 'preview-fixture.json'), JSON.stringify(fixture));
} finally { await context.close(); }
