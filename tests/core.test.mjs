import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { emptyLibrary, makeExport, mergePrompts, normalizePrompt, normalizeSettings, parseImport, parseTags, resolveLanguage, visiblePrompts } from '../extension/core.mjs';
import { messages } from '../extension/i18n.mjs';
const prompt = (id, title, values = {}) => normalizePrompt({ id, title, content: 'テスト本文', tags: ['仕事'], ...values });

test('favorites stay first under all sort orders and filters', () => {
  const prompts = [prompt('a', 'A', { usageCount: 20, lastUsedAt: 30 }), prompt('c', 'C', { favorite: true, usageCount: 1 }), prompt('b', 'B', { usageCount: 10, lastUsedAt: 40 })];
  assert.deepEqual(visiblePrompts(prompts, { sort: 'name' }).map(p => p.id), ['c', 'a', 'b']);
  assert.deepEqual(visiblePrompts(prompts, { sort: 'frequency' }).map(p => p.id), ['c', 'a', 'b']);
  assert.deepEqual(visiblePrompts(prompts, { sort: 'recent' }).map(p => p.id), ['c', 'b', 'a']);
  assert.deepEqual(visiblePrompts(prompts, { tag: '仕事', query: 'テスト', favorites: true }).map(p => p.id), ['c']);
});
test('search matches normalized title, tags, and content with multiple terms', () => {
  const prompts = [prompt('a', 'ＡＩの要約', { tags: ['Work'], content: '議事録を整理' }), prompt('b', 'Else')];
  assert.equal(visiblePrompts(prompts, { query: 'ai WORK 議事録' }).length, 1);
  assert.equal(visiblePrompts(prompts, { query: 'ai absent' }).length, 0);
});
test('backup round trip preserves settings, usage history, and Unicode', () => {
  const library = emptyLibrary(); library.settings.language = 'en'; library.prompts = [prompt('a', '議事録 ✨', { favorite: true, usageCount: 14, lastUsedAt: 30 })];
  const imported = parseImport(JSON.stringify(makeExport(library)));
  assert.deepEqual(imported.prompts, library.prompts);
  assert.deepEqual(imported.settings, library.settings);
});
test('sharing excludes usage history, settings, and favorites; includes selected prompts only', () => {
  const library = emptyLibrary(); library.prompts = [prompt('a', 'A', { favorite: true, usageCount: 9 }), prompt('b', 'B')];
  const shared = makeExport(library, 'collection', new Set(['a']));
  assert.equal(shared.settings, undefined); assert.equal(shared.prompts.length, 1);
  assert.equal(shared.prompts[0].usageCount, undefined); assert.equal(shared.prompts[0].lastUsedAt, undefined); assert.equal(shared.prompts[0].favorite, false);
  assert.equal(parseImport(JSON.stringify(shared)).prompts[0].usageCount, 0);
});
test('merge skips identical prompts, preserves edits with ID conflicts, and keeps existing data', () => {
  const existing = [prompt('a', 'A')];
  const merged = mergePrompts(existing, [prompt('a', 'A'), prompt('a', 'Changed'), prompt('b', 'Changed')]);
  assert.equal(merged.added, 1); assert.equal(merged.prompts.length, 2);
  assert.notEqual(merged.prompts[1].id, 'a'); assert.equal(merged.prompts[0], existing[0]);
});
test('import rejects malformed files before mutation', () => {
  const base = makeExport(emptyLibrary());
  for (const input of ['{', '{}', JSON.stringify({ ...base, version: 99 }), JSON.stringify({ ...base, prompts: [{ title: '', content: 'x' }] }), JSON.stringify({ ...base, prompts: [prompt('a', 'A'), prompt('a', 'B')] }), JSON.stringify({ ...base, prompts: [{ title: 'A', content: 'x', tags: [42] }] }), JSON.stringify({ ...base, prompts: Array.from({ length: 2001 }, (_, i) => prompt(String(i), 'A')) })]) assert.throws(() => parseImport(input));
});
test('settings and usage fields do not accept unsafe or unknown values', () => {
  assert.deepEqual(normalizeSettings({ sort: '__proto__', size: 'huge', keyboardEnabled: 'false' }), emptyLibrary().settings);
  assert.equal(prompt('a', 'A', { usageCount: -1, lastUsedAt: 'bad' }).usageCount, 0);
  assert.deepEqual(parseTags('仕事, 要約、仕事\nメール'), ['仕事', '要約', 'メール']);
  assert.equal(resolveLanguage('auto', 'ja-JP'), 'ja'); assert.equal(resolveLanguage('auto', 'fr-FR'), 'en');
});
test('every UI string is available in both languages', () => {
  assert.deepEqual(Object.keys(messages.ja).sort(), Object.keys(messages.en).sort());
});
test('2000 prompts can be filtered and sorted within the 1s budget', () => {
  const prompts = Array.from({ length: 2000 }, (_, i) => prompt(String(i), `Prompt ${i}`, { usageCount: i, content: 'A useful prompt to summarize meeting notes. '.repeat(10) }));
  const start = performance.now(); const result = visiblePrompts(prompts, { sort: 'frequency', query: 'meeting notes' });
  const duration = performance.now() - start;
  assert.equal(result.length, 2000); assert.equal(result[0].id, '1999'); assert.ok(duration < 1000, `Took ${duration} ms`);
});
test('registered open shortcut honors the disabled setting', async () => {
  let listener; let opens = 0; let enabled = false;
  const chrome = { commands: { onCommand: { addListener(fn) { listener = fn; } } }, storage: { local: { async get() { return { library: { settings: { keyboardEnabled: enabled } } }; } } }, action: { async openPopup() { opens++; } } };
  vm.runInNewContext(await readFile(new URL('../extension/background.js', import.meta.url), 'utf8'), { chrome });
  await listener('open-library'); assert.equal(opens, 0);
  enabled = true; await listener('open-library'); assert.equal(opens, 1);
  await listener('unrelated'); assert.equal(opens, 1);
});
