# Assignment toasts — 20 October 2026

Two transparent, optimized WebP collages from the user's supplied photos. All toast copy stays accessible HTML. Assets preload (about 116 KB total); no extra server requests or shared data caches were added.

A newly saved self-assignment shows the parents collage. The first current assignment for that person in the selected Saturday shows “אלופה אמא ואבא גאים בך”; two or more current assignments across both meals show “באנה את מלכה!”. Assigning another family member shows “עוד תהרגי אותנו” with the reclining-person bowl collage. Dad receives masculine wording.

Only a changed, nonempty preparation assignment is eligible. The toast is created from its own server-confirmed response, after the mutation queue resolves successfully. Unchanged preparation, clearing, moves, cancellation and failed writes do not trigger a celebration. Existing 1-second toast duration and background save/rollback behavior remain intact. No Google Apps Script or database schema changes.

Validation: 73 unit/backend tests passed, TypeScript checked. Local isolated UI replacement with assignment to another person and self both persisted; self-toast visibility wait passed; reload confirmed preparation. Production family data was not changed for QA.
