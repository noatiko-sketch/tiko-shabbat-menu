# One recipe per dish — 21 October 2026

`recipe_url` is an optional HTTP(S) URL (2048 character limit) on catalog and menu dishes. An explicit empty string removes the link; omission preserves the catalog link for old clients. URL validation is shared with Apps Script without requiring the URL global. The UI offers an optional LTR URL field in menu and catalog editors. A quiet book icon next to the dish title opens the recipe in a separate tab with noopener/noreferrer. Unsafe saved values never render as links.

Recipe changes save with the existing dish mutation and original optimistic queue: one Drive write, stale revisions rejected, failures roll back. Catalog changes sync matching dishes in upcoming and future drafts, preserving names, cook assignments and author metadata. Closed/archived menus retain their recorded recipe. Automatic generation and transfers carry recipe URLs. The current meal's duplicate occurrences sync as well.

The two special toast assets now show the supplied family photographs in simpler sage/terracotta cooking vessels. Versioned WebP filenames prevent old cached illustrations from being reused; toast wording and one-second duration are unchanged.

Validation: 79 tests, including bundled Apps Script one-write/replay/invalid-link behavior, recipe preservation through add/replace/transfer/generation/archive, optimistic parity and stale-edit conflicts. Isolated local UI save and reload confirmed the book link and persisted URL. No production dish data was modified for QA.

Backend rollout: Apps Script version 10 was created and deployed successfully at the existing deployment AKfycbxaQXG0Dgfc9ey--b7jGO6QBHxfeF0fUXH_qJJWKB8ZYRpnebFIJ0TUabzDRMgJRhqR. This is the same original Script project, token and Drive state ID. Hosting's bridge URL points to this existing deployment because browser-extension availability ended before the former bridge deployment could be advanced from version 9. No database or audience change. Other deployments remain on their existing versions.

Asset sources and prompts: imagegen built-in edits preserving the original photographic people, removing scenery, placing reclining woman in a simple sage bowl with terracotta rim and parents in a sage pot with terracotta handles. A targeted edit requested flat colors and clean alpha edges. Final images: public/toasts/bowl-minimal.webp and public/toasts/parents-minimal.webp.
