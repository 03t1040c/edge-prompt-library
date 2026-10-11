import { DEFAULT_SETTINGS, MAX_IMPORT_BYTES, MAX_PROMPTS, emptyLibrary, makeExport, mergePrompts, normalizePrompt, normalizeSettings, parseImport, parseTags, resolveLanguage, tagColor, visiblePrompts } from './core.mjs';
import { translate } from './i18n.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const list = $('#prompt-list');
const panel = $('#panel');
const search = $('#search');
const confirmation = $('#confirmation');
let library = emptyLibrary();
let language = resolveLanguage('auto', navigator.language);
let filters = { query: '', tag: '', favorites: false };
let results = [];
let selectedId = null;
let renderLimit = 40;
let panelType = null;
let previousFocus = null;
let draft = null;
let draftTimer;
let toastTimer;
let copying = false;
let loading = true;
let writeQueue = Promise.resolve();
let importData;
let shareIds = new Set();
let shortcut = 'Alt+Shift+P';
const t = (key, values) => translate(language, key, values);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key in node && !key.startsWith('aria') && key !== 'role' && key !== 'form') node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', `#i-${name}`); svg.append(use); return svg;
}
function iconButton(name, label, handler, className = '') {
  return el('button', { type: 'button', class: `icon-button ${className}`, title: label, 'aria-label': label, onclick: handler }, icon(name));
}
function button(label, handler, { secondary = false, danger = false, full = false, name, disabled = false } = {}) {
  return el('button', { type: 'button', class: `button${secondary ? ' secondary' : ''}${danger ? ' danger' : ''}${full ? ' full' : ''}`, disabled, onclick: handler }, name ? icon(name) : null, label);
}
function toast(key, values, error = false) {
  const node = $('#toast'); clearTimeout(toastTimer);
  node.replaceChildren(icon(error ? 'close' : 'check'), document.createTextNode(t(key, values)));
  node.className = `toast${error ? ' error' : ''}`; node.hidden = false;
  toastTimer = setTimeout(() => { node.hidden = true; }, error ? 4500 : 2200);
}
function report(error, fallback = 'error') {
  const key = ['invalidPrompt', 'tooLong', 'invalidTags', 'fileTooLarge', 'invalidJson', 'invalidFile', 'tooMany', 'duplicateIds'].includes(error?.message) ? error.message : fallback;
  toast(key, {}, true);
}
// Serialize writes. Read current disk data at mutation time, avoiding stale-popup overwrites.
function mutate(update) {
  const operation = writeQueue.then(async () => {
    const { library: stored } = await chrome.storage.local.get('library');
    const next = stored ? { ...stored, settings: normalizeSettings(stored.settings) } : emptyLibrary();
    const result = update(next);
    // Reserve enough space for this library's own importable, formatted backup.
    const serialized = JSON.stringify(makeExport(next), null, 2);
    if (new TextEncoder().encode(serialized).length > MAX_IMPORT_BYTES) throw new Error('fileTooLarge');
    await chrome.storage.local.set({ library: next });
    library = next;
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}
function applyAppearance() {
  const settings = library.settings;
  language = resolveLanguage(settings.language, navigator.language);
  document.documentElement.lang = language;
  const [width, height] = settings.size === 'small' ? [360, 480] : settings.size === 'large' ? [760, 600] : [440, 600];
  document.documentElement.style.setProperty('--width', `${width}px`);
  document.documentElement.style.setProperty('--height', `${height}px`);
  document.body.className = `size-${settings.size}`;
  search.placeholder = t('search'); search.setAttribute('aria-label', t('search'));
  search.setAttribute('aria-description', settings.keyboardEnabled ? t('searchHelp') : '');
  for (const [selector, key] of [['#add-prompt', 'add'], ['#open-settings', 'settings'], ['#clear-search', 'clearSearch'], ['#favorites-filter', 'favorites']]) {
    $(selector).title = t(key); $(selector).setAttribute('aria-label', t(key));
  }
  $('#filters').setAttribute('aria-label', t('tags'));
  list.setAttribute('aria-label', t('all'));
  $('#search-key').hidden = !settings.keyboardEnabled || Boolean(filters.query);
  $('#keyboard-hint').replaceChildren(...(settings.keyboardEnabled ? [el('kbd', {}, '↑↓'), t('keyboardHint'), el('kbd', {}, '↵'), t('enterHint')] : []));
  $('#sort-label').textContent = t(settings.sort);
}
function renderFilters() {
  const root = $('#filters');
  const focusedTag = root.querySelector(':focus')?.dataset.tag;
  const registeredTags = new Set();
  for (const prompt of library.prompts) for (const tag of prompt.tags) registeredTags.add(tag);
  if (filters.tag && !registeredTags.has(filters.tag)) filters.tag = '';
  const allTags = [...registeredTags].sort(new Intl.Collator(language).compare);
  const firstTags = allTags.slice(0, 12);
  if (filters.tag && !firstTags.includes(filters.tag)) firstTags[11] = filters.tag;
  const tags = firstTags.map(tag => el('button', {
    type: 'button', class: `filter tag-filter tag-${tagColor(tag)}${filters.tag === tag ? ' active' : ''}`,
    title: tag, 'data-tag': tag, 'aria-pressed': String(filters.tag === tag), onclick: () => {
      filters.tag = filters.tag === tag ? '' : tag; refresh(true);
    }
  }, el('span', { class: 'filter-label' }, tag)));
  if (allTags.length > 12) tags.push(el('button', { type: 'button', class: 'icon-button tag-overflow', title: t('moreTags'), 'aria-label': t('moreTags'), onclick: () => openTags(registeredTags) }, '…'));
  const scroll = root.scrollLeft;
  root.replaceChildren(...tags); root.hidden = !allTags.length; root.scrollLeft = scroll;
  if (focusedTag !== undefined) [...root.querySelectorAll('[data-tag]')].find(node => node.dataset.tag === focusedTag)?.focus({ preventScroll: true });
  const favorite = $('#favorites-filter');
  favorite.classList.toggle('active', filters.favorites);
  favorite.setAttribute('aria-pressed', String(filters.favorites));
}
function openTags(registeredTags) {
  let limit = 40;
  const input = el('input', { type: 'search', placeholder: t('tagSearch'), 'aria-label': t('tagSearch'), oninput: () => { limit = 40; render(); } });
  const matches = el('div', { class: 'tag-picker' });
  const allTags = [...registeredTags].sort(new Intl.Collator(language).compare);
  function render() {
    const query = input.value.normalize('NFKC').toLowerCase();
    const tags = allTags.filter(tag => tag.normalize('NFKC').toLowerCase().includes(query));
    matches.replaceChildren(...tags.slice(0, limit).map(tag => el('button', { type: 'button', class: 'tag-choice', onclick: () => {
      filters.tag = filters.tag === tag ? '' : tag; closePanel(); refresh(true);
    } }, el('span', { class: `tag tag-${tagColor(tag)}` }, tag))));
    if (tags.length > limit) matches.append(button(t('more'), () => { limit += 40; render(); }, { secondary: true, full: true }));
  }
  render();
  openPanel('tags', t('moreTags'), el('div', { class: 'panel-body' }, el('label', { class: 'field' }, input), matches));
}
function renderCard(prompt) {
  const card = el('article', { class: `prompt-card${selectedId === prompt.id ? ' selected' : ''}`, 'data-id': prompt.id });
  const tags = el('span', { class: 'card-tags', title: prompt.tags.join(', ') }, prompt.tags.slice(0, 2).map(tag => el('span', { class: `tag tag-${tagColor(tag)}` }, tag)));
  if (prompt.tags.length > 2) tags.append(el('span', { class: 'tag-more' }, `+${prompt.tags.length - 2}`));
  const copy = button(t('copy'), () => copyPrompt(prompt.id));
  copy.className = 'copy-area'; copy.setAttribute('aria-label', `${t('copy')}: ${prompt.title}`);
  copy.replaceChildren(el('span', { class: 'card-title', title: prompt.title }, prompt.title),
    el('span', { class: 'card-usage', title: t('uses', { n: prompt.usageCount.toLocaleString(language) }) }, el('span', { class: 'usage-count' }, t('usesShort', { n: prompt.usageCount.toLocaleString(language) }))),
    el('span', { class: 'card-line-two' }, prompt.tags.length ? tags : null,
    // Preview a bounded excerpt; copying always uses the complete original text.
    el('span', { class: 'card-content' }, prompt.content.slice(0, 400).replace(/\s+/gu, ' '))));
  const favorite = iconButton('star', t(prompt.favorite ? 'unfavorite' : 'favorite'), async () => {
    try { await mutate(data => { const p = data.prompts.find(p => p.id === prompt.id); if (p) p.favorite = !p.favorite; }); refresh(); } catch (error) { report(error, 'storageError'); }
  }, `favorite-button${prompt.favorite ? ' is-favorite' : ''}`);
  favorite.setAttribute('aria-pressed', String(prompt.favorite));
  card.append(copy, el('div', { class: 'card-actions' }, iconButton('edit', t('edit'), () => openEditor(prompt), 'edit-button'), favorite));
  return card;
}
function renderList() {
  const scroll = list.scrollTop;
  const fragment = document.createDocumentFragment();
  if (!results.length) {
    const empty = !library.prompts.length;
    fragment.append(el('div', { class: 'empty' }, el('div', { class: 'empty-icon' }, icon(empty ? 'book' : 'search')),
      el('h2', {}, t(empty ? 'emptyTitle' : 'noResults')), el('p', {}, t(empty ? 'emptyText' : 'noResultsText')),
      button(t(empty ? 'firstPrompt' : 'resetFilters'), empty ? () => openEditor() : resetFilters, { secondary: !empty, name: empty ? 'plus' : null })));
  } else {
    for (const prompt of results.slice(0, renderLimit)) fragment.append(renderCard(prompt));
    if (results.length > renderLimit) fragment.append(button(t('more'), () => {
      renderLimit += 40; renderList();
    }, { secondary: true, full: true }));
  }
  list.replaceChildren(fragment); list.scrollTop = scroll;
  list.setAttribute('aria-busy', 'false');
}
function refresh(reset = false) {
  if (reset) { renderLimit = 40; selectedId = null; list.scrollTop = 0; }
  renderFilters();
  results = visiblePrompts(library.prompts, { ...filters, sort: library.settings.sort, language });
  if (selectedId && !results.some(p => p.id === selectedId)) selectedId = null;
  renderList();
  $('#result-count').textContent = t(filters.query || filters.tag || filters.favorites ? 'results' : 'count', { n: results.length.toLocaleString(language), total: library.prompts.length.toLocaleString(language) });
  $('#clear-search').hidden = !filters.query;
  $('#search-key').hidden = !library.settings.keyboardEnabled || Boolean(filters.query);
  $('#sort-label').textContent = t(library.settings.sort);
}
function resetFilters() { filters = { query: '', tag: '', favorites: false }; search.value = ''; refresh(true); search.focus(); }
async function copyPrompt(id) {
  if (copying || loading) return;
  const prompt = library.prompts.find(p => p.id === id);
  if (!prompt) return;
  copying = true;
  try { await navigator.clipboard.writeText(prompt.content); }
  catch { toast('copyError', {}, true); copying = false; return; }
  toast('copied');
  try {
    await mutate(data => { const stored = data.prompts.find(p => p.id === id); if (stored) { stored.usageCount = Math.min(Number.MAX_SAFE_INTEGER, stored.usageCount + 1); stored.lastUsedAt = Date.now(); } });
    refresh();
  } catch { toast('copiedButNotSaved', {}, true); }
  finally { copying = false; }
}
function openPanel(type, title, body, footer = null, focus = true) {
  if (panel.hidden) previousFocus = document.activeElement;
  panelType = type;
  panel.replaceChildren(...[el('header', { class: 'panel-header' }, iconButton('back', t('back'), closePanel), el('h2', { id: 'panel-title' }, title), iconButton('close', t('close'), closePanel)), body, footer].filter(Boolean));
  panel.hidden = false;
  for (const child of $('#app').children) if (child !== panel && child.id !== 'toast' && child.id !== 'confirmation') child.inert = true;
  if (focus) requestAnimationFrame(() => { $('input,select,button,textarea', body)?.focus(); });
}
function closePanel() {
  if (!confirmation.hidden) return;
  if (panelType === 'editor') flushDraft();
  panel.hidden = true; panelType = null;
  for (const child of $('#app').children) child.inert = false;
  previousFocus?.isConnected ? previousFocus.focus() : $('#add-prompt').focus();
}
function selectField(label, options, value, change, note = null) {
  const select = el('select', { onchange: () => change(select.value), 'aria-label': label }, options.map(([key, text]) => el('option', { value: key, selected: key === value }, text)));
  return el('label', { class: 'field' }, el('span', {}, label), select, note ? el('small', {}, note) : null);
}
async function saveSetting(key, value) {
  try {
    await mutate(data => { data.settings[key] = value; });
    const scroll = $('.panel-body', panel)?.scrollTop || 0;
    applyAppearance(); refresh(key === 'sort');
    if (key === 'language') { openSettings(false); $('.panel-body', panel).scrollTop = scroll; }
  } catch (error) { report(error, 'storageError'); if (panelType === 'settings') openSettings(false); }
}
function openSettings(focus = true) {
  const settings = library.settings;
  const sizeButtons = ['small', 'medium', 'large'].map(size => el('button', { type: 'button', class: settings.size === size ? 'active' : '', 'aria-pressed': String(settings.size === size), onclick: async () => {
    await saveSetting('size', size);
    for (const [index, node] of sizeButtons.entries()) { node.classList.toggle('active', library.settings.size === ['small', 'medium', 'large'][index]); node.setAttribute('aria-pressed', String(node.classList.contains('active'))); }
  } }, t(size)));
  const toggle = el('input', { type: 'checkbox', checked: settings.keyboardEnabled, 'aria-label': t('keyboard'), onchange: () => saveSetting('keyboardEnabled', toggle.checked) });
  const appearance = el('section', { class: 'settings-section' }, el('h3', { class: 'section-title' }, t('preferences')),
    selectField(t('language'), [['auto', t('auto')], ['ja', '日本語'], ['en', 'English']], settings.language, value => saveSetting('language', value)),
    selectField(t('sort'), ['name', 'frequency', 'recent'].map(key => [key, t(key)]), settings.sort, value => saveSetting('sort', value), t('sortNote')),
    el('div', { class: 'field' }, el('span', {}, t('size')), el('div', { class: 'segmented', role: 'group', 'aria-label': t('size') }, sizeButtons), el('small', {}, t('sizeNote'))),
    el('div', { class: 'field' }, el('div', { class: 'toggle-row' }, el('span', { class: 'field-label' }, t('keyboard')), el('label', { class: 'toggle' }, toggle, el('span', { class: 'toggle-track' }))),
      el('small', {}, t('keyboardNote')), el('div', { class: 'shortcut-line' }, el('kbd', {}, shortcut || t('shortcutUnavailable')), el('button', { type: 'button', class: 'text-button', onclick: () => chrome.tabs.create({ url: 'edge://extensions/shortcuts' }) }, t('shortcutSettings')))));
  const data = el('section', { class: 'settings-section' }, el('h3', { class: 'section-title' }, t('dataHeading')),
    el('div', { class: 'data-block' }, el('h3', {}, t('backup')), el('p', {}, t('backupNote')), button(t('exportBackup'), () => download('backup'), { secondary: true, name: 'download' })),
    el('div', { class: 'data-block' }, el('h3', {}, t('import')), el('p', {}, t('importNote')), button(t('import'), () => $('#import-file').click(), { secondary: true, name: 'upload' })),
    el('div', { class: 'data-block' }, el('h3', {}, t('share')), el('p', {}, t('shareNote')), button(t('choosePrompts'), openShare, { secondary: true, name: 'share', disabled: !library.prompts.length })));
  const privacy = el('aside', { class: 'local-notice' }, el('div', { class: 'notice-title' }, icon('lock'), t('localTitle')), el('p', {}, t('localText')), el('p', { class: 'storage-note' }, t('storageNote')));
  openPanel('settings', t('settings'), el('div', { class: 'panel-body' }, appearance, data, privacy, el('p', { class: 'version' }, 'Prompt Library · 0.1.0')), null, focus);
}
function readEditorDraft() {
  const form = $('#editor-form'); if (!form) return null;
  return { id: form.dataset.id || null, title: $('#prompt-title').value, tags: $('#prompt-tags').value, content: $('#prompt-content').value };
}
function flushDraft() {
  clearTimeout(draftTimer);
  const value = readEditorDraft(); if (!value) return;
  draft = value;
  // Invoked immediately, before popup disposal. No debounce-dependent data loss on close.
  chrome.storage.local.set({ draft: value }).catch(() => toast('storageError', {}, true));
}
function openEditor(prompt = null) {
  if (loading) return;
  if (!prompt && library.prompts.length >= MAX_PROMPTS) { toast('tooMany', {}, true); return; }
  const restored = draft && (prompt ? draft.id === prompt.id : !draft.id) ? draft : null;
  const values = restored || { title: prompt?.title || '', tags: prompt?.tags.join(', ') || '', content: prompt?.content || '' };
  const title = el('input', { id: 'prompt-title', value: values.title, maxLength: 160, required: true, placeholder: t('titlePlaceholder'), autocomplete: 'off' });
  const tags = el('input', { id: 'prompt-tags', value: values.tags, maxLength: 600, placeholder: t('tagsPlaceholder'), autocomplete: 'off' });
  const content = el('textarea', { id: 'prompt-content', value: values.content, maxLength: 100000, required: true, placeholder: t('contentPlaceholder'), spellcheck: false });
  const errorNode = el('p', { class: 'error-message', role: 'alert', hidden: true });
  const form = el('form', { id: 'editor-form', 'data-id': prompt?.id || '', oninput: () => { clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 200); }, onsubmit: savePrompt },
    el('label', { class: 'field' }, el('span', {}, t('title')), title),
    el('label', { class: 'field' }, el('span', {}, t('tags')), tags, el('small', {}, t('tagsNote'))),
    el('label', { class: 'field' }, el('span', {}, t('content')), content), el('p', { class: 'draft-note' }, t('unsaved')), errorNode);
  const save = el('button', { class: 'button', type: 'submit', form: 'editor-form' }, t('save'));
  const footer = el('footer', { class: 'panel-footer' }, prompt ? iconButton('trash', t('delete'), () => deletePrompt(prompt.id)) : el('button', { class: 'text-button', type: 'button', onclick: async () => {
    clearTimeout(draftTimer); await chrome.storage.local.remove('draft'); draft = null; panelType = null; closePanel();
  } }, t('deleteDraft')), el('div', { class: 'button-row' }, button(t('cancel'), closePanel, { secondary: true }), save));
  openPanel('editor', t(prompt ? 'editPrompt' : 'newPrompt'), el('div', { class: 'panel-body' }, form), footer);
  if (restored) toast('draftRestored');
  async function savePrompt(event) {
    event.preventDefault();
    if (!title.value.trim() || !content.value.trim()) { errorNode.textContent = t('required'); errorNode.hidden = false; return; }
    save.disabled = true; clearTimeout(draftTimer);
    try {
      await mutate(data => {
        const existing = prompt ? data.prompts.find(p => p.id === prompt.id) : null;
        const updated = normalizePrompt({ ...existing, id: existing?.id || crypto.randomUUID(), title: title.value, tags: parseTags(tags.value), content: content.value });
        if (existing) data.prompts[data.prompts.indexOf(existing)] = updated;
        else { if (data.prompts.length >= MAX_PROMPTS) throw new Error('tooMany'); data.prompts.push(updated); }
      });
      draft = null; await chrome.storage.local.remove('draft'); panelType = null; closePanel(); refresh(); toast('promptSaved');
    } catch (error) { report(error, 'storageError'); save.disabled = false; }
  }
}
function confirmAction(title, note, label, action) {
  const focused = document.activeElement;
  const box = el('div', { class: 'confirm-box', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-note' }, el('h3', { id: 'confirm-title' }, title), el('p', { id: 'confirm-note' }, note));
  const close = () => { confirmation.hidden = true; panel.inert = false; focused?.isConnected && focused.focus(); };
  const accept = button(label, async () => { accept.disabled = true; try { await action(); close(); } catch (error) { report(error, 'storageError'); accept.disabled = false; } }, { danger: true });
  const cancel = button(t('cancel'), close, { secondary: true });
  box.append(el('div', { class: 'button-row' }, cancel, accept));
  confirmation.replaceChildren(box); confirmation.hidden = false; panel.inert = true; cancel.focus();
  confirmation.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } };
}
function deletePrompt(id) {
  confirmAction(t('deleteTitle'), t('deleteNote'), t('delete'), async () => {
    await mutate(data => { data.prompts = data.prompts.filter(p => p.id !== id); });
    clearTimeout(draftTimer); draft = null; await chrome.storage.local.remove('draft');
    // Close the confirmation before its underlying editor.
    confirmation.hidden = true; panel.inert = false; panelType = null; closePanel(); refresh(); toast('promptDeleted');
  });
}
async function download(kind, ids = null) {
  try {
    await writeQueue;
    const data = makeExport(library, kind, ids);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = el('a', { href: url, download: `prompt-library-${kind}-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000); toast('exported');
  } catch (error) { report(error); }
}
function openShare() {
  shareIds = new Set(library.prompts.map(p => p.id));
  const total = el('span', {}, t('selected', { n: shareIds.size }));
  const exportButton = button(t('exportCollection'), () => download('collection', shareIds), { name: 'download' });
  const checks = library.prompts.map(prompt => {
    const check = el('input', { type: 'checkbox', checked: true, onchange: () => {
      check.checked ? shareIds.add(prompt.id) : shareIds.delete(prompt.id); update();
    } });
    return el('label', { class: 'share-item' }, check, el('span', {}, prompt.title));
  });
  const selectAll = el('button', { type: 'button', class: 'text-button', onclick: () => {
    const all = shareIds.size === library.prompts.length;
    shareIds = new Set(all ? [] : library.prompts.map(p => p.id));
    for (const node of checks) $('input', node).checked = !all;
    update();
  } }, t('clearSelection'));
  function update() { total.textContent = t('selected', { n: shareIds.size }); exportButton.disabled = !shareIds.size; selectAll.textContent = t(shareIds.size === library.prompts.length ? 'clearSelection' : 'selectAll'); }
  openPanel('share', t('shareTitle'), el('div', { class: 'panel-body' }, el('p', { class: 'helper' }, t('shareNote')), el('div', { class: 'share-toolbar' }, total, selectAll), el('div', { class: 'share-list' }, checks)), el('footer', { class: 'panel-footer' }, button(t('back'), openSettings, { secondary: true }), exportButton));
}
function openImport() {
  const data = importData;
  const mergeButton = button(t('merge'), async () => {
    mergeButton.disabled = true;
    try {
      const added = await mutate(library => { const merged = mergePrompts(library.prompts, data.prompts); library.prompts = merged.prompts; return merged.added; });
      applyAppearance(); refresh(); openSettings(); toast('imported', { n: added });
    } catch (error) { report(error, 'storageError'); mergeButton.disabled = false; }
  });
  openPanel('import', t('importTitle'), el('div', { class: 'panel-body' },
    el('div', { class: 'import-summary' }, el('strong', {}, t('importSummary', { n: data.prompts.length })), data.kind === 'backup' ? el('p', {}, t('importBackupNote')) : null),
    el('div', { class: 'import-option' }, el('h3', {}, t('merge')), el('p', {}, t('mergeNote')), mergeButton),
    el('div', { class: 'import-option' }, el('h3', {}, t('replace')), el('p', {}, t('replaceNote')), button(t('replace'), () => confirmAction(t('replace'), t('replaceConfirm'), t('replace'), async () => {
      await mutate(library => { library.prompts = data.prompts; if (data.settings) library.settings = data.settings; });
      draft = null; await chrome.storage.local.remove('draft'); confirmation.hidden = true; panel.inert = false;
      applyAppearance(); refresh(true); openSettings(); toast('replaced', { n: data.prompts.length });
    }), { secondary: true }))));
}
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try { if (file.size > MAX_IMPORT_BYTES) throw new Error('fileTooLarge'); importData = parseImport(await file.text()); openImport(); }
  catch (error) { report(error); }
});
search.addEventListener('input', () => { filters.query = search.value; refresh(true); });
$('#clear-search').addEventListener('click', () => { search.value = ''; filters.query = ''; refresh(true); search.focus(); });
$('#add-prompt').addEventListener('click', () => openEditor());
$('#open-settings').addEventListener('click', () => { if (!loading) openSettings(); });
$('#favorites-filter').addEventListener('click', () => { if (!loading) { filters.favorites = !filters.favorites; refresh(true); } });
document.addEventListener('keydown', event => {
  // Dialog Tab/Escape are standard accessibility controls, independent of optional shortcuts.
  const modal = !confirmation.hidden ? confirmation : !panel.hidden ? panel : null;
  if (modal) {
    if (event.key === 'Tab') {
      const nodes = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href]')].filter(n => n.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.key === 'Escape' && confirmation.hidden) { event.preventDefault(); closePanel(); }
    return;
  }
  if (loading || !library.settings.keyboardEnabled || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (event.key === '/' && target !== search) { event.preventDefault(); search.focus(); return; }
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
  // Preserve native Enter on explicit buttons (favorite, edit, filters, settings).
  if (event.key === 'Enter' && target !== search && !target.classList.contains('copy-area')) return;
  if (!results.length) return;
  event.preventDefault();
  let index = results.findIndex(p => p.id === selectedId);
  if (event.key === 'Enter') { copyPrompt(target.closest('.prompt-card')?.dataset.id || selectedId || results[0].id); return; }
  index = index < 0 ? 0 : Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
  selectedId = results[index].id;
  if (index >= renderLimit) { renderLimit = Math.ceil((index + 1) / 40) * 40; renderList(); }
  for (const card of list.querySelectorAll('.prompt-card')) card.classList.toggle('selected', card.dataset.id === selectedId);
  const selected = [...list.querySelectorAll('.prompt-card')].find(card => card.dataset.id === selectedId);
  selected?.scrollIntoView({ block: 'nearest' });
  // Keep typing in the search box while arrow keys select a card.
  if (target !== search) $('.copy-area', selected)?.focus({ preventScroll: true });
});
window.addEventListener('pagehide', () => { if (panelType === 'editor') flushDraft(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && panelType === 'editor') flushDraft(); });

// CSS and the shell paint independently of storage and of the service worker.
applyAppearance();
try {
  const stored = await chrome.storage.local.get(['library', 'draft']);
  if (stored.library) {
    if (!Array.isArray(stored.library.prompts) || stored.library.prompts.length > MAX_PROMPTS) throw new Error('invalidFile');
    library = { version: 1, prompts: stored.library.prompts.map(p => normalizePrompt(p)), settings: normalizeSettings(stored.library.settings) };
  }
  draft = stored.draft || null;
  loading = false; applyAppearance(); refresh();
  if (library.settings.keyboardEnabled) search.focus({ preventScroll: true });
  performance.mark('library-rendered');
  requestAnimationFrame(() => requestAnimationFrame(() => performance.mark('library-ready')));
  // Shortcut metadata is deliberately outside the initial render path.
  chrome.commands.getAll().then(commands => { shortcut = commands.find(c => c.name === 'open-library')?.shortcut || ''; }).catch(() => {});
} catch {
  list.setAttribute('aria-busy', 'false');
  list.replaceChildren(el('div', { class: 'empty' }, el('h2', {}, t('loadError')), button(t('retry'), () => location.reload(), { secondary: true })));
  toast('loadError', {}, true);
}
