# Skribli v0.1.38 — private owner candidate

Superseded by [v0.1.39](OWNER_CANDIDATE_V0.1.39.md). The owner's installed screenshot showed that the opaque side backing appeared as an unwanted solid pastel band.

25 September 2026. This follows the owner's installed note feedback: the place pill should sit halfway outside the paper, its hover should not show “Drag the paper,” and the in-app dot should be smaller. The intermittent white strips reported after Attach, More, and switching applications remain a specific Windows acceptance check.

## Change

The rounded place pill now crosses the paper edge by 14 px, roughly half its 30 px width. The strip behind the exposed half uses the selected paper colour instead of transparency, so the edge can redraw without showing a white gutter. The generic drag tooltip was removed from the note header; the header still moves the note. The in-app presence dot shrank from 14 px to 10 px and remains centered in its 28 px clickable control. This candidate retains the v0.1.37 curve and rail alignment, direct attachment removal, and sign-in packaging correction.

## Verification

- 233 desktop frontend tests passed across 39 files.
- Desktop TypeScript, production Vite build, theme validation, and compact-surface validation passed.
- Windows NSIS owner installer built from the final source. The executable reports 0.1.38 and contains the active public entitlement verification key.
- Installer SHA-256: `63D28E40720241F64B5C4BAC2E9F9BF0327A861DAD5EEAB52344CB3E58DFC4DD`; 3,550,164 bytes; Authenticode `NotSigned`.
- The native region geometry is unchanged from v0.1.37, when Rust formatting and all 22 Windows placement/region tests passed.

## Owner acceptance still required

Install v0.1.38 over the current owner build with the same account and existing notes. Confirm sign-in, then open a note in several pastel colours: the pill should straddle the paper edge, remain round, and show the saved place on hover without a drag tooltip. Check the smaller app dot, Attach and More, the lower corners, and switching to and from other applications for white flashes or strips. Reopen a note to confirm removed files stay removed. The source checks and installer build do not establish installed WebView appearance, account access, persistence, or upgrade safety. Do not reset the account or delete notes for this check.

Local private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.38/Skribli_0.1.38_x64-setup.exe`. This is an unsigned owner test package. Public downloads remain disabled until the signed-release and owner Windows acceptance gates pass.
