# Changes

## 1.0.1 — 2026-10-23

- Start with 12 cards at small/medium popup sizes and 24 at large size. More prompts are still accessible by the existing button and arrow keys.
- Load one deferred JavaScript file instead of a module with two dependent module requests. Build using Node.js standard modules, without third-party dependencies.
- Read editing drafts and shortcut metadata only when opening the editor or Settings. Existing drafts are restored after reopening the popup.
- Reuse tag sorting and number-formatting objects within a popup session.
- Ignore stale draft/settings completions after the user changes or closes the panel.
- Serialize library saves across extension views to preserve concurrent changes, and export backups from the latest saved data.
- Reject saving an editor whose prompt has been deleted in another view, with a localized explanation.
- Preserve the existing storage format, backup compatibility, permissions, offline behavior, and two-line card layout.

An isolated comparison with 2,000 prompts and 60 static local background tabs measured a median of 138.2ms in 1.0.0 and 118.7ms in 1.0.1 (about 14% lower). Initial DOM elements dropped from 794 to 318. This does not establish the cause of multi-second delays reported in the user's regular browser. See PERFORMANCE.md for limits and CPU-throttled results.

## 1.0.0 — 2026-10-18

Initial store submission package, Japanese/English UI, local prompt library, tags, favorites, sorting, keyboard controls, JSON backup and sharing.
