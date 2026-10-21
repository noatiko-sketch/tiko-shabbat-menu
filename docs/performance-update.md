# Shared Drive performance update — 20 October 2026

Merged into the current live Site source (version 27), retaining its complete UI and data bindings.

- All menu/catalog/category/like writes render an optimistic projection immediately. The single client queue sends each completed action once, in order; controls remain available. The existing header is the pending-save indicator. Persisted responses replace projections; errors cancel dependent index actions, restore the last confirmed state, and trigger one deduplicated fresh reload.
- Queue entries retain the menu and catalog versions they were based on. They never silently rebase over another family member's changes discovered by an earlier response.
- The canonical Drive JSON is always read fresh. No CacheService, shared in-memory data cache, browser data cache, CDN cache or D1 fallback was introduced. In-flight client read coalescing lasts only for the outstanding request; all API fetches/responses use no-store.
- Normal read-only snapshots do not take a ScriptLock. If normalization, menu creation or a new viewed revision requires a write, the wrapper acquires the lock and re-reads the state before applying/saving. Every actual write still holds the same script lock across all deployments.
- Initialized requests skip the food-list Drive read. Initialization reconciles manual additions with normalized-name sets instead of repeated quadratic scans.
- The modern Site requests compact responses (the current menu, entire current catalog, categories and statuses). Legacy clients retain their candidate/history response. Candidate groups are computed once per category/meal for legacy responses.
- Views are recorded with the initial snapshot, or with a mutation, instead of a second POST per menu revision. Already-seen revisions don't write again or change the timestamp.
- Catalog has an independent version for conflict detection; catalog-mutating menu actions also check it. Menu changes retain their existing compare-and-swap protection. State writes preserve every unrelated/unknown field.
- A bounded list of mutation receipts makes resubmitted request IDs idempotent. It contains request IDs and actor names only, not cached snapshots.
- Category counts and search results use request/view-local memoization of pure computations.

## Verification

The VM harness runs the actual generated Apps Script bundle against instrumented Drive/Lock services. Assertions cover actual read/write/lock counts, changes arriving between unlocked read and lock acquisition, stale menu/catalog writes by different actors, idempotency, sequential pending actions, rollback and cancelled dependent writes. Existing menu, dietary, attribution, profile, approvals, history, and drag geometry suites remain in place.

Synthetic 160-dish fixture: compact snapshot 18,964 bytes vs 195,242 bytes (90% less; actual family payload is measured separately). Four unchanged viewed snapshots use four state reads, zero food reads, zero writes and zero locks. First view uses two state reads, one lock and one write; repeat views do not write. A completed move writes once, and replaying its ID does not write again.

A live pre-change read on 20 October returned 43,697 bytes in 9.98 seconds. This is a single sample, not a latency guarantee. Google Apps Script startup and Drive/network latency remain external constraints; the UI no longer waits for them to display the accepted edit.

Live compact read after deployment: 20,370 bytes vs 43,697 bytes previously (53% smaller). End-to-end sample 8.99 s; Site's server-timing measured the Google bridge portion at 1.874 s. These single measurements include different network/startup conditions and do not establish a fixed speedup.

The user additionally requested a more visible potato illustration for the side-dish category. The existing matching transparent potato illustration is reused as /categories/potatoes.png; other category artwork, profile illustrations and all layout CSS remain unchanged.

Preparation assignment was requested during the performance work: an icon on each dish opens a five-avatar picker, with an icon to clear an existing assignment. The prepared_by field belongs to the menu dish, is preserved by reorder/replacement, uses the same optimistic queue and CAS, and never writes assignment data into the catalog. No existing dish receives an assignment during upgrade. The final suite contains 63 passing tests. Live same-label category save verified immediate dialog closure and enabled catalog/new-dish controls without altering the category label.

## Additional authorized changes in this update

- Transfer action moves a dish to the other meal or either meal of the following Saturday. Both menus are updated in one locked Drive write; source revision is checked, destination edits are preserved, dietary incompatibility/duplicate/full target abort the whole operation. Preparation assignment follows the dish. UI action is an icon in the existing editor.
- Likes can be toggled off without removing another person's like or the historical approved copy.
- New menu slots select a category first and show only compatible dishes from that category. Creation still uses automatic classification.
- The header and tabs stay fixed during scrolling; existing layout and colors are preserved.
- Completed Saturdays are copied once to shabbat_archive with final menus, dish authors/preparation, menu revision, category labels and family status. Later edits cannot overwrite the final archive. Fresh reads/mutations archive missed completed Saturdays before status changes. An idempotent archive_completed updater supports unattended end-of-week runs without credentials beyond the existing name-only API.

67 tests pass. An actual simultaneous pair of same-label category updates from Noa/Dad returned 200 and 409; the menu and all category labels remained identical. Real API results retain Cache-Control: no-store. The extra same-label writes only incremented conflict metadata, with no content changes.

Final visual follow-up: preparation is a clickable chef-hat chip beneath the dish title (above author attribution), with the assigned name shown beside the icon. The picker shows both avatars and names. Side dishes, soup and dips use distinct flat illustrations with more visible terracotta/green bowls; generated raster assets are exported as small transparent 256px WebP files for delivery.

End-of-Shabbat archival is enabled via the linked Site task Automation_9b59e1e9658c8191a84d5e8e1690b2be, Sundays at 00:15 Asia/Jerusalem. The unattended updater and independent persisted readback were verified, with 2026-10-10 and 2026-10-17 archived without changing their source menus.
