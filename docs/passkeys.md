# Family Passkeys

Production remains GitHub Pages + the same Apps Script deployment and original Drive JSON. No new hosting, database or biometric collection. Existing family-code login remains available.

## Usage and recovery

1. Sign in using the family code.
2. Open **כניסה במכשיר ומפתחות גישה**, enter a recognizable key name and choose **הגדרת כניסה במכשיר**.
3. When preparation finishes, choose **אישור ושמירת מפתח במכשיר** and approve the OS prompt. The second, explicit click preserves user activation on Safari even when the Google bridge is slow.
4. On a later visit, choose **כניסה באמצעות המכשיר**. Login challenges are prepared in the background so this one click directly requests device approval. The phone can use fingerprint, Face ID or its screen-lock code. Supported desktop authenticators also work.
5. The family code unlocks management and recovery, including revocation. Each registration belongs to the family access boundary, not a selected family profile. Attribution continues to use the chosen profile.

Keys may sync through Apple/Google password managers. Revocation removes the credential and all its sessions, including synced copies. Losing a phone is also a reason to secure its Apple/Google account. The app stores public keys only; the private key and biometric data stay with the authenticator/password manager.

## Protocol and storage

ES256/P-256, discoverable credentials, user presence and user verification are required. Registration requests `attestation: none`; no authenticator provenance is asserted. The server verifies exact challenge, ceremony type, RP ID hash, HTTPS origin, credential ID, flags, public key format and DER signature. Cross-origin/embedded ceremonies are rejected. Positive signature counters must increase; zero counters support synced credentials.

A bundled synchronous verifier uses pinned Noble Curves and Tiny CBOR because Apps Script V8 lacks WebCrypto and TextEncoder/Decoder. Strict UTF-8 adapters are supplied at build time. Third-party license copies are under `vendor/`. Regenerate with `node scripts/build-drive-bridge.mjs`.

Challenges are HMAC-derived using the existing private `TIKO_BRIDGE_TOKEN`, expire after five minutes, are single-use even after failed verification, and are capped at 30 outstanding. There are at most 20 family credentials. Enrollment, list and revocation require the recovery code (or the existing owner authorization), not merely a Passkey session.

By default, login sessions last at most eight hours and are kept only in tab memory. Opting into **זכור אותי במכשיר זה** creates a fixed 30-day revocable session and saves its random token, expiry and opaque session ID in localStorage, scoped to the Google deployment. The family code is never saved. Code login and verified Passkey login both support opt-in. Reload/startup validates the saved token against Google before mounting the family app. Storage failures are disclosed and leave only the current tab signed in. The existing GitHub Pages origin must remain trusted because frontend JavaScript on that origin can access browser storage. Drive stores a hash of each bearer token, associated credential (or explicit code-authenticated method) and a keyed family-code version. Revocation, expiration and family-code rotation invalidate sessions. Recovery-code management lists remembered devices without hashes/tokens and can revoke one device independently. Revoking a Passkey also revokes every associated remembered session. Signing out forgets this browser and revokes its token. Turning off remember replaces the saved session with a tab-only eight-hour token. At most 60 sessions are retained. The origin/nonce-bound Google bridge carries authentication on existing requests. All auth writes use the original Drive lock; `passkeys_v1` is not part of any public snapshot.

The default RP is `noatiko-sketch.github.io`, matching production. `TIKO_PAGES_ORIGIN` may override it with an HTTPS hostname. Changing origin/hostname requires new registration. A private bridge token of at least 32 characters is required; no new secret needs to be added to the frontend.

## Verification

`npm run check` includes real Node-generated P-256 signatures exercised against the generated Apps Script bundle in a VM without WebCrypto, TextEncoder or TextDecoder. Tests cover successful enrollment/login, signature forgery, challenge replay/expiry/consumption, origin/RP mismatch, missing UV/UP, wrong user handle, counters, bounded challenges, hashed sessions, revocation, logout, code rotation and session expiry. Existing menu/shopping tests remain required. Remembered-session tests additionally exercise code and signature opt-in, 30-day expiry, device revocation, code rotation, forgetting/token replacement, browser reload validation, blocked storage and absence of saved family codes. Physical iPhone/Android enrollment and device prompts must be checked on users' own devices; automated signature fixtures do not assert hardware compatibility.
