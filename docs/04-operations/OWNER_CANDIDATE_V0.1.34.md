# Skribli v0.1.34 — private owner candidate

25 September 2026. This candidate updates the actual desktop note. The separate design experiment and website were not used for this change.

## What changed

The v0.1.31 installed sign-in error was “Licence activation is not enabled in this build.” The enforced owner build now includes the active public entitlement verification key and rejects a missing key during packaging. No account, session, or note data was reset.

The note follows A · Living Paper in `site/interface-directions.html`: a smoother, larger lower-right paper corner; an outside attached place tab with varied contrasting pastel colour and full application detail on hover or focus; and a click-open right action rail with circular icons and hover/focus labels. The writing area has no title field or heading insert action. `/` at a block start and `Ctrl+/` in the editor open checklist, inline attachment, and bulleted list actions. The editor has a direct inline attachment control when text is selected. Inline images start small and offer small, medium, and large sizes. The image's explicit remove action removes the file from the note and its inline reference, rather than leaving a hidden attachment in the tray. Cancel confirms discarding the current editing session and restores the opening text, rich content, attachments, drawing, reminders, and colour. Done saves and puts the note away. The original logo, pastel theme, and selective Kalam writing remain.

## Verification

- Desktop frontend: 230 tests in 39 files passed; TypeScript and production Vite build passed.
- The Windows NSIS owner installer built successfully. Its release executable reports version 0.1.34 and contains the active public entitlement verification key.
- Installer SHA-256: `B61A489FD79A28031CF0412E8A82841A1486D33BC460EB5DA0CFC1363255E9C2`.
- Installer size: 3,547,432 bytes. Authenticode: `NotSigned`.

## Owner acceptance still required

Install v0.1.34 over v0.1.31 with the same Windows account. Sign in normally and confirm existing notes remain. In a new and an existing note, check writing, the paper corner, place tab, right rail, `/` tools, checklist add/remove, inline attachment, image size, actual file removal, Cancel, Done, and persistence after reopening. Check compact and medium note sizes. If sign-in fails, capture the exact new message and step. A whole-window screenshot of any note mismatch will help correct the installed native view. Do not reset the account or delete notes. The automated checks and successful installer build do not establish real Windows sign-in or visual acceptance.

## Package

Local unsigned NSIS owner installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.34/Skribli_0.1.34_x64-setup.exe`.

This is a private owner test candidate, not a signed public release. Keep the previous installer and device data for rollback. Older builds can drop inline attachment placement metadata after editing rich attachments, so preserve a backup before downgrading.
