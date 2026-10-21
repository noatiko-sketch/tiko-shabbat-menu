# Minimal family UI — 19 October 2026

All seventeen requests implemented:

- Existing minimal vegetable illustrations sit in five distinct muted circles from the cream/green/coral palette.
- One pencil editor replaces the separate swap action. It offers the whole compatible catalog in a dropdown, followed by Create new. Mobile action targets are 44px or larger.
- New dishes require only a name. Server inference assigns their category. Existing catalog dishes retain an editable category dropdown with category icons.
- Larger profile circles in the viewed/liked summary above the menu.
- Replaced accumulated CSS overrides with a coherent responsive stylesheet: fluid 1180px desktop content, up to 1320px on wide screens, two meal columns where appropriate, one column on mobile, no negative margins/cropped headers.
- Save and Cancel share one button style and target size.
- Toasts appear at the top and disappear after 1000ms. Inline form errors remain available for correction.
- Initial loading skeletons, header loading indicator, saving progress bar, spinning save indicators, disabled pending controls and aria-busy states.
- Backend ready checks skip redundant seed writes. Independent snapshot queries run in parallel. Category validation fetches one category instead of reading the entire catalog. History reads are limited to two approved menus. No activity feed is fetched in snapshots. A synchronous pending ref prevents double submits, and mutation version guards prevent an older background read from reverting a completed save in the UI. No optimistic success is displayed before the server confirms persistence.
- Like button reads אהבתי את התפריט. Viewed and liked profiles appear above the menu. Likes remain tied to the current revision and clear after edits, using existing family approval persistence.
- Removed recent updates from UI and API responses. Existing audit rows are preserved internally.
- No automatically selected label. Manual selections show only the person's name and a pencil under the dish.
- Category icons appear at the right of each dish instead of textual category labels. Catalog rows show both icon and category name.
- App logo replaces the star, rendered as a cream/white monochrome mark for contrast on the green bar.
- Category names can be renamed directly through card/title pencils. Category dropdown options include emoji icons and category names.
- Catalog opens to a scrollable four-column category grid (five on wide screens, three on mobile). Opening a category shows its dishes; global search reaches all dishes.
- Removed the separate category-management section. Direct category rename remains.

Validation: TypeScript and production build; 25 backend/model tests; local browser flows for unified editor, creation without category question, actual save and inference, toast disappearance, like persistence, category rename, opening a category and icon labels in category selection. Existing tests still cover concurrency, revision protection, recipe constraints, edge cases and persistence.

Recipe dietary classification continues to use the name rather than undisclosed ingredients. Physical installation on actual phones is not covered by desktop viewport QA.

## Desserts and ordering (added in the same revision)

- Added dessert category מנה אחרונה (🍰), seeded once with עוגה, גלידה, טפיוקה, סלט פירות, פירות, פבלובה, עוגת יומולדת. Later deletions and category renames survive subsequent reads.
- New automatic menus begin Friday with soup and end both meals with a dietary-compatible dessert. Dessert never falls back to a savory dish.
- The upcoming existing menu is upgraded once, preserving its dishes while adding desserts and arranging the default order. Layout changes invalidate previous likes. Intentionally empty menus remain empty.
- A per-meal ordering mode provides up/down buttons without crowding normal edit/delete actions. Positions and slot categories move together through the revision-protected backend. The user's explicit choice allows moving every dish, including soup and dessert. Manual order persists through refresh and is not automatically reset.
- New manual dishes insert before dessert by default; manually ordered meals keep their explicit ordering rules.
- Thirty automated tests now pass. Browser tests additionally confirmed dessert upgrade, soup-first display, ordering mode, boundary-disabled arrows and an actual persisted move.
