// Capture genuine extension DOM in a separate promotional frame. No raster manipulation.
// CSP bypass is confined to this capture context to add the frame; runtime tests use CSP.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = process.argv[2] ? createRequire(path.join(process.argv[2], 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'store-assets'); await mkdir(output, { recursive: true });
const fixture = JSON.parse(await readFile(path.join(root, 'test-results/preview-fixture.json'), 'utf8'));
const context = await chromium.launchPersistentContext(path.join(root, 'test-results/capture-profile'), {
  executablePath: process.env.PROMPT_LIBRARY_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 800 }, locale: 'ja-JP', reducedMotion: 'reduce',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${path.join(root, 'extension')}`, `--load-extension=${path.join(root, 'extension')}`]
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  const captions = {
    ja: {
      library: ['探す。コピーする。\nそれだけで、すぐ使える。', ['タグ・検索・お気に入りで整理', '2行カードで、コンパクトに', 'アカウント不要。外部通信なし。']],
      settings: ['必要な機能は、\n設定にすっきり。', ['日本語 / Englishに対応', '表示サイズと並び順を選択', 'JSONでバックアップ・移行・共有']],
      sample: '表示内容はサンプルです。'
    },
    en: {
      library: ['Find your words.\nCopy. Get to work.', ['Search, tags, and favorites', 'Compact two-row prompt cards', 'No accounts. No external connections.']],
      settings: ['Your library.\nYour preferences.', ['Japanese and English', 'Choose your size and sort order', 'JSON backup, migration, and sharing']],
      sample: 'Example prompts shown.'
    }
  };
  for (const language of ['ja', 'en']) {
    for (const mode of ['library', 'settings']) {
      const library = structuredClone(fixture);
      library.settings.language = language;
      if (language === 'en') {
        const titles = ['Meeting notes into action', 'Polish a business email', 'Explore a new idea', 'Translate into natural English', 'Explain a complex topic', 'Identify project risks', 'Check an argument', 'Plan your research', 'Review a code snippet', 'Reflect on the day'];
        const content = ['Summarize these meeting notes into decisions, open questions, and action items with owners.', 'Rewrite this message as a clear, considerate business email.', 'Explore this idea from different perspectives and suggest improvements.', 'Translate this text into natural English while preserving its meaning.', 'Explain this topic using everyday examples.', 'List the risks and practical ways to address them.', 'Identify logical gaps and suggest clearer wording.', 'List the questions to research and a useful order to investigate them.', 'Review the code and prioritize bugs and readability improvements.', 'Summarize what I learned and what to try tomorrow.'];
        const tags = [['Work','Summary'],['Email','Writing'],['Ideas'],['Translation','English'],['Learning','Explanation'],['Planning'],['Writing'],['Research'],['Development'],['Reflection']];
        library.prompts.forEach((prompt, index) => { prompt.title = titles[index]; prompt.content = content[index]; prompt.tags = tags[index]; });
      }
      await worker.evaluate(async library => { await chrome.storage.local.clear(); await chrome.storage.local.set({ library }); }, library);
      await page.goto(`chrome-extension://${id}/popup.html`);
      await page.waitForFunction(() => performance.getEntriesByName('library-ready').length > 0);
      if (mode === 'settings') await page.locator('#open-settings').click();
      await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => node.blur()));
      await page.locator('#filters').evaluate(node => { node.scrollLeft = 0; });
      await page.addStyleTag({ content: `
        html{background:#f7f6f2!important}body{margin:100px 70px 100px auto!important;width:440px!important;height:600px!important;background:transparent!important}
        #app{border:1px solid #e2dfe9;border-radius:14px;box-shadow:0 18px 65px #29243d13}
        #store-frame{position:fixed;left:80px;top:160px;width:610px;color:#252638;font-family:"Segoe UI",Meiryo,sans-serif}
        #store-frame .eyebrow{font-size:13px;font-weight:650;letter-spacing:2.5px;color:#756b98;margin-bottom:30px}
        #store-frame h2{font-size:42px;line-height:1.45;letter-spacing:-1.5px;white-space:pre-line;margin:0 0 28px;font-weight:650}
        #store-frame p{font-size:17px;line-height:2.15;color:#777083;margin:0}
        #store-frame .line{display:block}
        #store-caption{position:fixed;left:80px;bottom:78px;font:12px "Segoe UI",Meiryo,sans-serif;color:#9a93a5}
      ` });
      await page.evaluate(({ language, mode, captions }) => {
        const frame = document.createElement('aside'); frame.id = 'store-frame';
        const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'PROMPT LIBRARY';
        const title = document.createElement('h2'); title.textContent = captions[language][mode][0];
        const details = document.createElement('p');
        for (const line of captions[language][mode][1]) { const span = document.createElement('span'); span.className = 'line'; span.textContent = line; details.append(span); }
        frame.append(eyebrow, title, details);
        const caption = document.createElement('span'); caption.id = 'store-caption'; caption.textContent = captions[language].sample;
        document.body.append(frame, caption);
      }, { language, mode, captions });
      await page.screenshot({ path: path.join(output, `${mode}-${language}-1280x800.png`) });
      console.log(`Captured ${mode}-${language}-1280x800.png`);
    }
  }
  const policy = await context.newPage();
  await policy.goto(new URL('../docs/index.html', import.meta.url).href);
  await policy.screenshot({ path: path.join(root, 'test-results/privacy-page.png'), fullPage: true });
  if (!await policy.locator('#ja').count() || !await policy.locator('#en').count()) throw new Error('Policy languages are missing');
  await writeFile(path.join(output, 'README.md'), '# Store assets\n\n- logo-300.png: extension logo (300×300).\n- library-ja-1280x800.png / settings-ja-1280x800.png: Japanese listing.\n- library-en-1280x800.png / settings-en-1280x800.png: English listing.\n\nScreenshots show the actual 1.0.0 extension in a promotional frame, using sample prompts. The capture frame is not shipped in the extension.\n');
} finally { await context.close(); }
