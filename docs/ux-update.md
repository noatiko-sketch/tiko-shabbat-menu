# Family UI update — 20 October 2026

Implements audit suggestions 1–10 and 12; empty-search behavior (11) remains unchanged. Dish editor shows the existing dish immediately and marks it in search. Category-first addition progressively reveals fields and allows preparation assignment at creation. Dish and preparation are submitted together; unchanged dish saves use assignment-only to retain author attribution. Cancel discards staged choices. Transfer stays a separate explicit action, shows destination dates, and is unavailable until staged changes are saved or discarded.

Shared model supports optional Action.responsible for add/replace, validated before persistence and excluded from catalog. Apps Script bridge API9 uses the same private Drive state and existing locking/revision rules. All four live deployments were updated to Apps Script version9 (20 Oct2026 23:04 Asia/Jerusalem), retaining their URLs and access settings.

Menu hero is smaller; portraits keep their colors and distinguish viewed/unviewed with Eye/EyeOff. Delete controls moved into editors with existing confirmation. Catalog search/add grouped, editor column retained, category heading navigation accounts for sticky bars. Labels, credits and touch targets improved. Save/cancel maintain matching shapes with a clear primary save action.

Validation: TypeScript; 69 automated tests; local browser UI replacement+assignment persisted after reload, cancel discarded staged assignment, unchanged saves disabled. Drive generated-bridge VM tests prove combined save writes once, replay writes zero times, invalid choices save neither field, stale edits do not overwrite other family members. Live read confirmed API9 and original Drive state ID before Site publish.
