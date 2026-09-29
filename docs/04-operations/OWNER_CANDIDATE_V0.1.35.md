# Skribli v0.1.35 — private owner candidate

25 September 2026. This candidate follows the owner's installed-note screenshots showing intermittent white strips beside the place tab, at the lower-left edge, and beyond the large lower-right paper curve. The owner also reported the strip after opening Attach or More and while switching applications, and requested a tighter tool rail.

## Change

The desktop note no longer reserves an 8 px transparent side gutter inside the native window. The place tab remains fixed to the paper edge. The Windows note region now matches the paper's 20 px standard corners and 38 px lower-right curve, so the transparent wedge outside that curve is excluded from native drawing. The More rail has closer 28 px circular buttons; very short notes use a compact two-column rail. The v0.1.34 note and sign-in packaging changes remain included.

## Verification

- Desktop TypeScript and production Vite build passed, including the compact-surface validation.
- Rust format check and the native region tests passed for the standard note, collapsed dot, and note sizes at 100–200% scale.
- Windows NSIS owner installer built. The executable reports 0.1.35 and contains the active public entitlement verification key.
- Installer SHA-256: `DF2F99D4C8B034FEEF34B618F6EF32532B0804AAF874AEC893ACB19842A73A5C`; 3,545,430 bytes; Authenticode `NotSigned`.

## Owner acceptance still required

The code and build checks cannot prove Windows WebView redraw behavior. Install v0.1.35 over the current owner build using the same account. Open a note, open and close Attach and More several times, switch between applications, move the note between displays if available, and inspect both lower corners and the place-tab edge. Check that the compact rail remains usable and that corner resizing still works. Sign in and confirm existing notes remain. Capture a whole-window screenshot if the white strip persists. Do not reset the account or delete notes.

Local private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.35/Skribli_0.1.35_x64-setup.exe`. This is an unsigned owner test package, not a public release.
