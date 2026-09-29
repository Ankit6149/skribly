# Skribli v0.1.33 - owner candidate

## What changed

This private owner candidate supersedes v0.1.32 for testing the compact note. It includes the enforced-build public licence verification key fix diagnosed from the exact v0.1.31 sign-in error, the small circular context presence, and the latest note UI pass. No account, session, or note data was reset or deleted.

The actual desktop note now has a larger smooth bottom-right curve, a small place tab attached just outside the paper edge with hover/focus place detail, and a contrasting pastel tab colour that varies by note. Secondary actions form a hover/focus icon rail with labels on hover; the narrow note shows all pinned actions in two columns. A caret-side tool rail offers inline attachment, checklist toggle, and optional heading. Selecting text shows the writing toolbar. Type `/` at the start of a block or `Ctrl+/` anywhere in the editor for a keyboard insert menu; H, C, A, and B choose heading, checklist, attachment, and bullets. Heading text retains its own line in the plain-text copy. The original logo, pastel palette, and selective Kalam writing remain.

## Verification

- Desktop frontend: 223 tests in 39 files passed; TypeScript and production Vite build passed.
- Actual `SkribComposer` was visually inspected in a browser at 420 x 360 and 320 x 280. The right rail and insert menu were inspected open at both sizes. This does not establish native Windows WebView acceptance.
- The v0.1.31 sign-in cause and v0.1.32 public-key build guard are recorded in [the previous candidate report](OWNER_CANDIDATE_V0.1.32.md). This candidate uses the same enforced owner build path.

## Owner acceptance still required

Install v0.1.33 over the current v0.1.31 installation using the same Windows account. Sign in normally and confirm the existing notes remain. In a new and an existing note, check the paper curve, outside place tab, varied tab colour, right rail, caret attachment, checklist add/remove, heading, and `/` insert menu. Check the note at small and medium sizes, then close and reopen it to confirm persistence. If sign-in fails, capture the exact new message and step. A whole-window screenshot of any visual mismatch will let us correct the native view. Do not reset the account or delete notes.

## Package

Local unsigned NSIS installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.33/Skribli_0.1.33_x64-setup.exe`

SHA-256: `7311B5EDD4286FE3FF692D6837C195F140B8F39D7B80A8A0FB7056FAD6BE4BD3`

The copied installer is 3,542,838 bytes and `NotSigned`; the release executable contains the active public verification key. These are package checks, not proof of successful sign-in on the owner's device.

This is an owner test package, not a signed public release. Keep the previous installer and device data for rollback. Older builds can drop inline attachment placement metadata after editing rich attachments, so preserve a backup before downgrading.
