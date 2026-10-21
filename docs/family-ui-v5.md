# Installation, sorting and replacement update

- Canonical share/start URL remains `/`, with no installation explanations. `/install` is a compact optional installation landing; all explanations live only at `/install/help`. Standalone launches on `/install` redirect to `/`.
- Dad’s existing transparent image is centered using a CSS transform based on its illustration bounds, without changing the illustration.
- Like hearts use light red in both the family summary and approval button.
- Sorting mode uses pointer-capture grip controls instead of arrow buttons, with touch support, same-meal drop validation, edge scrolling, cancel handling and keyboard support. Each completed move uses the existing revision-checked backend and persists once on release. Background polling pauses during ordering.
- Replacement candidates share the current slot category and still honor meat/dairy exclusions. The searchable dropdown uses cmdk keyboard navigation; adding a new slot can choose any compatible category. Creation remains available.

Validation: TypeScript, production build, existing model/backend suite plus category replacement regressions. Physical phone drag behavior requires manual verification; browser tools were unavailable for this update.
