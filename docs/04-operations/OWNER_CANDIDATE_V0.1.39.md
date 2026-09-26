# Skribli v0.1.39 — private owner candidate

Superseded by [v0.1.40](OWNER_CANDIDATE_V0.1.40.md) after the owner's screenshots showed rough native note edges and an overly rounded Code chip.

25 September 2026. The owner's screenshot of v0.1.38 showed a solid peach band beside the note. That band was the 14 px opaque backing added behind the half-outside place pill. It was visible by design in code, but wrong for the intended transparent edge.

## Change

The backdrop is transparent again; only the paper and place pill carry pastel colour. The pill still overlaps the paper edge by 14 px. The Windows native note region now starts at the paper's left edge and joins a bounded capsule for the pill, excluding the otherwise empty side strip from the native window. This reduces the area where stale WebView pixels can appear during an app switch or resize. The note, account, and attachment data paths are unchanged.

## Verification

- 233 desktop frontend tests passed across 39 files.
- Desktop TypeScript, production Vite build, theme validation, and compact-surface validation passed. The compact-surface guard checks that the final backdrop rule stays transparent.
- Rust formatting and all 22 Windows placement/region tests passed, including the paper offset and tab bounds at 100–200% scaling.
- Windows NSIS owner installer built from the final source. The executable reports 0.1.39 and contains the active public entitlement verification key.
- Installer SHA-256: `3B37D6330CA28001DF1AC982C4A46D6DDB15C1D7B7690EEED86D9A25657796CD`; 3,545,697 bytes; Authenticode `NotSigned`.

## Owner acceptance still required

Install v0.1.39 over the current owner build with the same account and existing notes. Open a note in different pastel colours: the desktop should show through beside the pill, including below it, with no solid band. Switch applications, open Attach and More, and resize the note to check for white flashes or clipped edges. Confirm sign-in, existing notes, and attachment removal persistence. Source and geometry tests cannot prove installed WebView compositing or account access. Do not reset the account or delete notes for this check.

Local private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.39/Skribli_0.1.39_x64-setup.exe`. Public downloads remain disabled until the signed-release and owner Windows acceptance gates pass.
