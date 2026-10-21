# Tiko family app — shared development

Read README.md first. Keep changes small and preserve the current Hebrew RTL design and behavior unless requested otherwise.

## One application and one production database
- Existing Site project: appgprj_6ab3c7d07f588191ac6504eb977576c8.
- Public URL: https://tiko-shabbat-menu.noatiko.chatgpt.site.
- Production storage is Google Drive via Apps Script (TIKO_STORAGE=drive), not D1. D1 is a legacy/local test backend. Never switch production to it or create a new Site/database as a shortcut.
- Do not edit the live Drive JSON to test a feature. Tests and local preview use isolated data.
- Never commit live state exports, credentials, environment files, tokens or authenticated browser data. Runtime secrets remain in Sites and Apps Script settings.

## Collaboration
- Start from the latest GitHub main and use a short feature branch per task. Do not overwrite other changes or force-push shared main.
- Open a focused pull request describing the resulting behavior and verification.
- Run npm run check. For frontend/framework changes also run npm run build and inspect the UI when preview is available.
- lib/drive-engine.ts, lib/menu-model.ts, lib/family.ts and lib/recipe-url.ts are the backend source. When these change, regenerate google/Code.gs using node scripts/build-drive-bridge.mjs. Do not hand-edit the generated bundle.
- Preserve optimistic background saves, conflict detection, rollback, attribution and original data. Do not cache shared state.

## Publishing
- GitHub Actions validates changes but does not publish production.
- The owner publishes the current merged main through the existing Sites project. Reconcile any newer Sites changes before importing GitHub code; never replace current production code with an older checkout.
- If the backend changed, deploy its matching Apps Script bundle before activating frontend behavior that depends on it. Keep existing access settings and database IDs. Verify the live API version and original state ID.
- Synchronize any changes made during publication back to GitHub. Do not leave two diverging sources of truth.
