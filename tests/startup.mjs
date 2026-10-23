// Isolated Edge benchmark: 2,000 prompts, local test tabs, optional CPU throttling.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyLibrary, normalizePrompt } from '../extension/core.mjs';
const require = process.argv[2] ? createRequire(path.join(process.argv[2], 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');
const label = process.argv[3] || 'after';
if (!/^[a-z-]+$/u.test(label)) throw new Error('Invalid benchmark label');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'test-results'); await mkdir(output, { recursive: true });
const context = await chromium.launchPersistentContext(path.join(output, `startup-${label}-profile`), {
  executablePath: process.env.PROMPT_LIBRARY_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, viewport: { width: 800, height: 650 }, locale: 'ja-JP', reducedMotion: 'reduce',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${path.join(root, 'extension')}`, `--load-extension=${path.join(root, 'extension')}`]
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const library = emptyLibrary(); library.settings.language = 'ja';
  library.prompts = Array.from({ length: 2000 }, (_, index) => normalizePrompt({ id: String(index), title: `プロンプト ${index}`, tags: ['仕事', `タグ${index % 12}`], content: '会議の内容を整理し、決定事項と担当者を明確にしてください。'.repeat(10), usageCount: index }));
  await worker.evaluate(library => chrome.storage.local.set({ library }), library);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const backgroundTabs = [];
  const measurements = [];
  for (const [tabCount, cpuRate] of [[0, 1], [60, 1], [60, 4]]) {
    while (backgroundTabs.length < tabCount) {
      const batch = await Promise.all(Array.from({ length: Math.min(5, tabCount - backgroundTabs.length) }, async () => {
        const tab = await context.newPage();
        await tab.goto(`data:text/html;charset=utf-8,${encodeURIComponent('<!doctype html><title>Local test tab</title><main>' + '<p>Local background tab for startup measurement.</p>'.repeat(100) + '</main>')}`);
        return tab;
      }));
      backgroundTabs.push(...batch);
    }
    await page.bringToFront();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    const samples = [];
    for (let run = 0; run < 8; run++) {
      await page.goto('about:blank'); await page.goto(`chrome-extension://${id}/popup.html`);
      await page.waitForFunction(() => performance.getEntriesByName('library-ready').length > 0);
      samples.push(await page.evaluate(() => ({
        readyMs: performance.getEntriesByName('library-ready')[0].startTime,
        renderedMs: performance.getEntriesByName('library-rendered')[0].startTime,
        cards: document.querySelectorAll('.prompt-card').length,
        elements: document.querySelectorAll('*').length
      })));
    }
    const sorted = samples.map(sample => sample.readyMs).sort((a, b) => a - b);
    const result = { localBackgroundTabs: tabCount, cpuSlowdown: cpuRate, medianMs: (sorted[3] + sorted[4]) / 2, maxMs: sorted.at(-1), samples };
    measurements.push(result);
    console.log(JSON.stringify({ label, tabs: tabCount, cpuRate, medianMs: +result.medianMs.toFixed(1), maxMs: +result.maxMs.toFixed(1), cards: samples[0].cards, elements: samples[0].elements }));
  }
  await writeFile(path.join(output, `startup-${label}.json`), JSON.stringify({ version: await worker.evaluate(() => chrome.runtime.getManifest().version), label, date: new Date().toISOString(), browser: context.browser()?.version(), measurements, note: 'Fresh extension document in an already running headless Edge. 60 static local tabs; CPU slowdown applies to the measured renderer. Not a measurement of physical toolbar clicks or real-world site workloads.' }, null, 2));
} finally { await context.close(); }
