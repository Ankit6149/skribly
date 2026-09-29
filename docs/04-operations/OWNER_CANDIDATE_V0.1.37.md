# Skribli v0.1.37 — private owner candidate

25 September 2026. This follows the owner's report that the context chip lost its chip shape, the paper curves look pixelated, the Plus rail feels too large, and the More rail feels small and misaligned. It includes the previous v0.1.36 attachment and sign-in packaging changes.

## Change

The pastel context label is again a fully rounded vertical chip, inset slightly from the paper edge. The Plus and More action rails now use matching 30 px circular controls and 16 px icons, with their triggers and right rail columns centered on the same axis. The Windows native paper region gives the CSS curves a 2 logical px edge allowance at normal and higher display scaling. This keeps the browser's antialiased border inside the native window mask instead of cutting it with GDI's hard pixel boundary. The 38 px lower-right CSS curve remains.

## Verification

- 232 desktop frontend tests passed across 39 files.
- Desktop TypeScript and production Vite build passed, including theme and compact-surface validation.
- Rust format check and all 22 Windows placement/region tests passed, including note/dot geometry at 100–200% scaling.
- Windows NSIS owner installer built from the final source. The executable reports 0.1.37 and contains the active public entitlement verification key.
- Installer SHA-256: `5D19515E440A4B94062CAC001A17E71CCF349685C55CEC8FB9388B874BE5D32E`; 3,547,975 bytes; Authenticode `NotSigned`.

## Owner acceptance still required

Install v0.1.37 over the current owner build with the same account. Confirm sign-in and existing notes. Open a note at small and larger sizes, compare the chip and both icon rails, and inspect the top and lower-right curves at your Windows display scale. Open and close Plus and More, then switch applications and check for white strips or jagged edges. Confirm attachment removal still persists after reopening a note. Source and build checks do not prove native WebView appearance, sign-in, or persistence on the installed machine. Do not reset the account or delete notes for this check.

Local private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.37/Skribli_0.1.37_x64-setup.exe`. This is an unsigned owner test package. Public downloads remain disabled until the repository's signed-release and owner Windows acceptance gates pass.
