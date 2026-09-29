# Skribli v0.1.40 — private owner candidate

26 September 2026. The owner's screenshots showed a too-rounded Code place chip and rough outer note corners. This candidate keeps the transparent half-outside chip while giving the visible curves room to render inside the hard Windows window region.

## Change

The Code chip now uses a 12 px corner radius instead of a full pill radius. The visible paper is inset 3 px from the top, right, and bottom native boundaries; its left edge is 3 px inside the native paper region. The chip also has a 3 px left and right allowance. This lets CSS draw the visible rounded edges without the GDI region cutting directly through them at common display scales. Clipped outer shadows were removed from both the paper and chip; their subtle borders remain. The note data and account flows are unchanged.

## Verification

- 233 desktop frontend tests passed across 39 files.
- Desktop TypeScript, production Vite build, theme validation, and compact-surface validation passed. The guard checks the transparent inset and chip radius.
- Rust formatting and all 22 Windows placement/region tests passed, including native paper and tab bounds at 100–200% scaling.
- Windows NSIS owner installer built from the final source. The executable reports 0.1.40 and contains the active public entitlement verification key.
- Installer SHA-256: `686F4455E7AC412331FC8F04A8779587D3ADAE82E9F80FCDFD16C070F9824307`; 3,548,500 bytes; Authenticode `NotSigned`.

## Owner acceptance still required

Install v0.1.40 over the current owner build with the same account and notes. Check the Code chip shape and all four paper corners at the normal Windows display scale; switch applications and resize the note to check for jagged or white edges. Confirm the transparent area beside the chip stays clear, then check sign-in, existing notes, and attachment removal persistence. Geometry and frontend tests do not prove installed WebView appearance or account access. Do not reset the account or delete notes for this check.

Local private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.40/Skribli_0.1.40_x64-setup.exe`. Public downloads remain disabled until the signed-release and owner Windows acceptance gates pass.
