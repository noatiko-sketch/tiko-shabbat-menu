# Family app refinement — 18 October 2026

Completed all twelve requests and the follow-up illustration change:

1. `/install` is the separate, shareable installation entry point; no download/install banner on the menu screen. Manifest start_url remains `/`, so an installed app opens the menu.
2. The first backend read of the upcoming week generates and persists a shared menu if none exists, using INSERT OR IGNORE for concurrent initial opens. It never overwrites an existing menu, including a deliberately emptied one.
3. Profile selection uses the avatar at the top left. Names are fixed; no text control to rename/change a name. Mappings: אמא zucchini, אביגיל avocado, יפעת pomegranate, נעה broccoli, אבא apple.
4. Dad receives masculine imperatives. Other actions use neutral labels such as שמירה.
5. A compact eye + avatar/name strip above the menu shows the viewed revision. Profile selection is a Netflix-style modal.
6. Approvals remain below the menu as icon-only controls with accessible labels and avatar confirmation indicators.
7. Tests call the same backend handlers as production, with a transactional SQLite adapter applying actual schema migrations. Browser tests exercised real HTTP-backed edit/save/reject/approve/catalog-remove flows. No production test dishes were inserted.
8. Catalog view has its own heading: מאגר המנות.
9. No dietary-suitability input or dietary badges. Recipe names are analyzed internally: meat excluded from dairy/vegetarian meals; dairy excluded from meat meals; pareve/fish allowed in both. Mixed meat+dairy names are excluded. Friday pasta/pastry no longer require a dairy label. The existing three-week cycle remains.
10. Both direct menu additions and catalog additions immediately feed backend generation and candidate selection. Custom/unknown categories can participate in flexible slots and category-shortage fallback.
11. Menu and catalog editors render inside the selected row. autofocus keeps the editor visible; no top-of-list edit form.
12. Editing, swapping and removal use SVG action icons with accessible names and tooltips.

Avatars use flat minimal food illustrations matching the existing bowl graphic, with no faces, limbs or textured characters. The initial character avatars were discarded.

Validation: 24 automated tests cover automatic persistence/idempotence, simultaneous first opens, CAS races and losing side effects, direct additions, custom categories, name-based dietary rules, mixed diets and plant milk exceptions, personal approvals and invalidation, seen revision isolation, category deletion/fallback, catalog deletion persistence, empty-menu protection, input validation, cross-origin requests, limits and incomplete approval, dates, gendered text and interrupted catalog seeding. TypeScript and production build pass.

Browser coverage: profile modal, Dad selection, inline menu editor, server rejection of chicken in Friday dinner, successful save and attribution, icon-only approval, catalog heading/search, inline catalog editor and auto classification, removal and persistence response, separate install page. Physical iOS/Android installation remains outside browser verification.

Classification uses the dish name; undisclosed ingredients cannot be inferred reliably from an arbitrary personal recipe title.

Live QA additionally caught an overly broad main-slot category condition. Dips are now excluded from custom-main selection; a narrow revision-guarded repair replaces only an unapproved automatically selected dip in the main slot, without changing the other dishes or any family edit. Regression test covers generation and repair.
