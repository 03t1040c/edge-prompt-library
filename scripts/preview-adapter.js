// Separate localhost-only mock; never shipped with the extension.
if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  window.chrome = {
    storage: { local: {
      async get(keys) { const store = JSON.parse(localStorage.getItem('prompt-library-preview') || '{}'); return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, store[key]])); },
      async set(values) { const store = JSON.parse(localStorage.getItem('prompt-library-preview') || '{}'); localStorage.setItem('prompt-library-preview', JSON.stringify({ ...store, ...values })); },
      async remove(key) { const store = JSON.parse(localStorage.getItem('prompt-library-preview') || '{}'); delete store[key]; localStorage.setItem('prompt-library-preview', JSON.stringify(store)); }
    } },
    commands: { async getAll() { return [{ name: 'open-library', shortcut: 'Alt+Shift+P' }]; } },
    tabs: { async create() { alert('Extension shortcut settings are available when installed in Edge.'); } }
  };
}
