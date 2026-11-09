# Tiko family app — shared development

Read README.md first. Keep changes small and preserve the current Hebrew RTL design and behavior unless requested otherwise.

## One application and one production database
- Source of truth: https://github.com/noatiko-sketch/tiko-shabbat-menu, latest main. Work here on a feature branch and open a PR.
- Public URL: https://noatiko-sketch.github.io/tiko-shabbat-menu/.
- Mobile fallback: the same frontend is served by the existing Apps Script deployment at `?mobile=1`, using native google.script.run instead of the cross-site Pages bridge. `npm run build` produces `work/google-Mobile.html`; publishing uploads it as Mobile while preserving Index and the manifest. Frontend changes must also publish this file to Google before Pages.
- The old ChatGPT Site is legacy. Do not edit or publish it for Tiko requests.
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
- The user selected GitHub Pages + Google only. Do not add Vercel or another host.
- npm run build creates the static React app in dist-pages. pages.yml publishes main after checks. Do not publish this static port back to Sites.
- The same Google deployment performs data operations via the origin/nonce-bound Bridge HTML and google.script.run. Never expose TIKO_BRIDGE_TOKEN, family code or OAuth credentials in the frontend.
- Keep Google authorization checks, family actor validation, locks, conflict detection and idempotent mutations. Never seed a second database or fall back to D1 in production.
- Generate google/Code.gs after editing the shared engine or wrapper. Google code deploys before Pages when changed; see docs/github-hosting.md for one-time OAuth setup and the initial manual path.
- Preserve the existing Index and manifest when uploading Google files. Keep the same deployment URL, Script Properties and original Drive file.
- Keep the old Site and old archive automation until the new UI, Google connection and independent Google archive trigger are verified.
