export const VERSION = 1;
export const MAX_PROMPTS = 2000;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const DEFAULT_SETTINGS = Object.freeze({ language: 'auto', sort: 'name', size: 'medium', keyboardEnabled: true });
const sorts = new Set(['name', 'frequency', 'recent']);
const sizes = new Set(['small', 'medium', 'large']);
const languages = new Set(['auto', 'ja', 'en']);
export function normalizeSettings(value = {}) {
  return {
    language: languages.has(value?.language) ? value.language : 'auto',
    sort: sorts.has(value?.sort) ? value.sort : 'name',
    size: sizes.has(value?.size) ? value.size : 'medium',
    keyboardEnabled: typeof value?.keyboardEnabled === 'boolean' ? value.keyboardEnabled : true
  };
}
export function resolveLanguage(language, browserLanguage = 'en') {
  return language === 'auto' ? (browserLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en') : language;
}
export function parseTags(text) {
  return [...new Set(text.split(/[,、\n]/u).map(tag => tag.trim()).filter(Boolean))].slice(0, 12).map(tag => tag.slice(0, 40));
}
export function normalizePrompt(value, { strict = false } = {}) {
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || typeof value.content !== 'string' || !value.title.trim() || !value.content.trim()) throw new Error('invalidPrompt');
  if (value.title.length > 160 || value.content.length > 100000) throw new Error('tooLong');
  if (strict && (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.length > 12 || value.tags.some(t => typeof t !== 'string' || t.length > 40)))) throw new Error('invalidTags');
  return {
    id: typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/u.test(value.id) ? value.id : crypto.randomUUID(),
    title: value.title.trim(), content: value.content,
    tags: Array.isArray(value.tags) ? [...new Set(value.tags.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean))].slice(0, 12).map(t => t.slice(0, 40)) : [],
    favorite: value.favorite === true,
    usageCount: Number.isSafeInteger(value.usageCount) && value.usageCount >= 0 ? value.usageCount : 0,
    lastUsedAt: Number.isFinite(value.lastUsedAt) && value.lastUsedAt >= 0 ? value.lastUsedAt : 0,
    createdAt: Number.isFinite(value.createdAt) && value.createdAt >= 0 ? value.createdAt : Date.now()
  };
}
export function parseImport(text) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('fileTooLarge');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('invalidJson'); }
  if (!data || data.format !== 'edge-prompt-library' || data.version !== VERSION || !['backup', 'collection'].includes(data.kind) || !Array.isArray(data.prompts)) throw new Error('invalidFile');
  if (data.prompts.length > MAX_PROMPTS) throw new Error('tooMany');
  const prompts = data.prompts.map(p => normalizePrompt(p, { strict: true }));
  if (new Set(prompts.map(p => p.id)).size !== prompts.length) throw new Error('duplicateIds');
  return { kind: data.kind, prompts, settings: data.kind === 'backup' ? normalizeSettings(data.settings) : null };
}
export function makeExport(library, kind = 'backup', ids = null) {
  const prompts = ids ? library.prompts.filter(p => ids.has(p.id)) : library.prompts;
  const result = { format: 'edge-prompt-library', version: VERSION, kind, exportedAt: new Date().toISOString(), prompts: prompts.map(p => kind === 'backup' ? { ...p } : ({ id: p.id, title: p.title, content: p.content, tags: [...p.tags], favorite: false })) };
  if (kind === 'backup') result.settings = normalizeSettings(library.settings);
  return result;
}
export function mergePrompts(existing, imported) {
  const ids = new Set(existing.map(p => p.id));
  const signatures = new Set(existing.map(p => JSON.stringify([p.title, p.content, [...p.tags].sort()])));
  const additions = [];
  for (const original of imported) {
    const signature = JSON.stringify([original.title, original.content, [...original.tags].sort()]);
    if (signatures.has(signature)) continue;
    const prompt = { ...original, id: ids.has(original.id) ? crypto.randomUUID() : original.id };
    ids.add(prompt.id); signatures.add(signature); additions.push(prompt);
  }
  if (existing.length + additions.length > MAX_PROMPTS) throw new Error('tooMany');
  return { prompts: [...existing, ...additions], added: additions.length };
}
export function visiblePrompts(prompts, { query = '', tag = '', favorites = false, sort = 'name', language = 'ja' } = {}) {
  const words = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  const compare = new Intl.Collator(language, { numeric: true, sensitivity: 'base' }).compare;
  return prompts.filter(p => {
    if (favorites && !p.favorite || tag && !p.tags.includes(tag)) return false;
    if (!words.length) return true;
    const haystack = `${p.title}\n${p.tags.join(' ')}\n${p.content}`.normalize('NFKC').toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  }).sort((a, b) => Number(b.favorite) - Number(a.favorite) || (sort === 'frequency' ? b.usageCount - a.usageCount : sort === 'recent' ? b.lastUsedAt - a.lastUsedAt : 0) || compare(a.title, b.title) || a.id.localeCompare(b.id));
}
export function tagColor(tag) {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.codePointAt(0)) | 0;
  return Math.abs(hash) % 5;
}
export function emptyLibrary() { return { version: VERSION, prompts: [], settings: { ...DEFAULT_SETTINGS } }; }
