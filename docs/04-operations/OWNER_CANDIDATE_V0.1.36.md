# Skribli v0.1.36 — private owner candidate

25 September 2026. This candidate includes the earlier v0.1.31 sign-in packaging correction, the Living Paper note changes, and the v0.1.35 native window silhouette fix. It responds to the owner's report that attached images/files could not be removed directly and that the attachment count tab opened a tray much wider than the tab.

## Change

Each inline image, video, and file now has a small visible circular remove control. The attachment tray gives every item the same direct remove control. Removal uses the persisted attachment store and removes the corresponding inline object from the note; a failed storage operation reports an error instead of visually discarding the file. The count tab remains 174 px wide and opens upward as a vertical tray of the same width. Its height follows the attached items until available note height is reached, then its contents scroll. Opening it no longer resizes the note window. The count tab remains visible on short notes.

## Verification

- 232 desktop frontend tests passed across 39 files, including direct inline removal for image, video, and document attachments and persisted removal from the tray.
- Desktop TypeScript and production Vite build passed, including theme and compact-surface validation.
- Windows NSIS owner installer built from the final source. The executable reports 0.1.36 and contains the active public entitlement verification key.
- Installer SHA-256: `3FF6FAD643C17AED672A07C27116FD92F5D267F6F8FD3E47BB202744340511E7`; 3,548,323 bytes; Authenticode `NotSigned`.

## Owner acceptance still required

Install v0.1.36 over the current owner build with the same account. Confirm sign-in and that existing notes remain. In a note, attach one image and one file, remove each with the small cross, close and reopen the note, and check that the removed items stay gone. Open the count tab with one and several attachments: the tray should stay as narrow as the tab, grow upward with its contents, and scroll when full. Check the white strip around the place tab and both lower corners after Attach, More, and switching applications. The tests and package build do not establish real installed Windows sign-in, persistence, or visual acceptance. Do not reset the account or delete notes for this check.

Local private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.36/Skribli_0.1.36_x64-setup.exe`. This is an unsigned owner test package, not a public release.
