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
- The user authorized migration away from ChatGPT Sites, preserving the original Drive data and using automatic GitHub publication without Cloudflare or a purchased domain.
- The new target is Next.js on Vercel, built with npm run build. Merge to main publishes automatically after the host is connected. See docs/github-hosting.md for remaining cutover checks.
- Production routes use server-only process.env.TIKO_BRIDGE_URL and TIKO_BRIDGE_TOKEN. Never expose those through NEXT_PUBLIC_, logs, source control or PR descriptions. Missing configuration must fail closed; never fall back to D1.
- Keep live secrets out of Preview environments; branch deployments are disabled. Validate with isolated data.
- Keep the existing Site live until the new host, shared Git publication and independent weekly archive schedule are verified. Do not publish this Node.js port back to Sites.
- If the shared backend changes, regenerate google/Code.gs, run tests, and deploy the matching Apps Script bundle before enabling dependent behavior.
