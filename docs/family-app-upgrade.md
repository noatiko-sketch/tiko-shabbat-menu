# Family app upgrade — 18 October 2026

The live Site database is authoritative for menus and the dish catalog. Legacy Apps Script is used only for initial menu import into an empty database. Google Drive's food list was imported into catalog-import.json as an initial seed; subsequent catalog edits are owned by this Site and are never overwritten by that seed.

Implemented requests:
1. Installable standalone web app for Android and iPhone; uploaded Tiko logo is the home screen icon. Manifest, Apple icon metadata, install instructions, optional Android install prompt, network-only menu data, clear offline page.
2. Name selection for אמא / אבא / נעה / אביגיל / יפעת, retained on each device for up to 90 days, with an explicit switch control. No account/password needed. Names are self-selected, not verified.
3. Dish changes carry server-assigned actor and timestamp. Removed dishes and catalog/category changes appear in the activity feed.
4. Shared viewed status distinguishes the current menu revision from an older revision.
5. Independent approvals per family member for the upcoming Saturday, keyed to the exact content revision. Editing invalidates their display. Family status retains one row per member, replacing the old week; menu approval metadata remains for existing history/non-repeat behavior.
6. Adding a dish accepts an explicit category and persists it to the shared catalog.
7. Shared catalog supports search, all/category filters, add/edit/remove dishes, dietary suitability, and create/rename/remove categories. Catalog edits do not change historical or already selected menu dishes.
8. Automatic category inference from Hebrew dish names, with a visible suggested category before saving. Users can override the category and dietary suitability.
9. Every dish appears under All dishes; unknown categories fall back to extra. Removing a category atomically reassigns its catalog dishes to extra. The extra category cannot be removed.

Verification: TypeScript, model tests (dates, separate weeks, approval invalidation, explicit and inferred categories, attribution, fallback), production build, and local browser flows for generation, multiple identities, approvals, edits, category creation, dish reclassification, category removal with dish retention. Real iPhone/Android installation requires checking on physical devices; browser preview cannot certify OS installation UX.

Concurrency: menu writes use revision compare-and-swap with guarded dependent catalog/activity mutations in the same D1 batch. Stale writes return 409 and refresh the client. Shared status is refreshed every 30 seconds while the page is visible and no menu form is open. Viewing/approving an old revision cannot count as approving a newer revision.

The hosting audience must be public to support the requested name-only access. Anyone with the URL can select a family name and edit the shared meal plan. Robots indexing is disabled; this is not an authentication boundary.
