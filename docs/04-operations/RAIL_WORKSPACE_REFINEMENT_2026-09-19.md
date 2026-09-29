# Rail and desktop workspace correction — 19 September 2026

## Owner report and scope

The owner supplied four screenshots showing a clipped global widget, two expanded floating lists, and rectangular shadow boundaries beside the collapsed edge tab. They also reported broken left-side docking and requested horizontal, hover-revealed note cards beneath the in-app count pill, followed by a calmer main workspace. The website, logo and note editor redesign are not part of this pass; note editor visual redesign remains a follow-up after the workspace/rail behavior is accepted.

These screenshots are the owner's evidence, not a new live runtime audit. No installation, app launch or screenshot capture was performed by the agent. The owner continues to test the installer.

## Corrections

- Separate native view identity and ordered state updates for the two floating windows, with one expanded panel at a time. The global entry remains available when the contextual entry is open.
- Dock-side-aware widget shape and placement, with no exterior shadow on the tiny collapsed widget. Drag-release cleanup prevents a later hover from continuing an abandoned gesture.
- Context notes use a bounded horizontal strip. Hover/focus reveals more of the chosen card without opening a native note or changing saved content. Explicit actions still open here or return to the owning app.
- Home now presents the shortcut and two workspace destinations instead of repeating onboarding/status, explanatory cards and preferences. Account/preferences live in Settings. Sidebar text is concise; failures to open the rail or hide Home are shown instead of becoming silent errors.
- Library navigation has one owner: the sidebar. Removed duplicate embedded tabs, put import/export under Manage notes, and tucked metadata into Note details. Archive/Trash requests render their requested page immediately instead of reporting the previous local view back to the sidebar.
- Content areas scroll within the shared application window. No second Home/library window was added. Website tokens, pastel note colours, existing logo and Kalam content remain.

## Verification and acceptance

Source is the existing dirty Desktop checkout on baseline `43c298b`; these changes are not committed or publicly released and do not claim that every historical feature is finished.

### Candidate v0.1.28

- Frontend: 197 tests across 33 files passed; TypeScript and production build passed.
- Native: 168 library, 3 executable, and 37 integration tests passed (208 total).
- Product truth, note lifecycle, library, Trash, import, repository governance, compact surface/theme validation and Rust formatting passed.
- Release build produced normal NSIS EXE and MSI installers with account configuration and native entitlement enforcement retained. Existing dead-code and frontend bundle-size warnings remain; no new test failure is being waived.
- Static installer branding passed: product name and canonical app/NSIS icon match; no Tauri branding detected. Installed payload/startup testing was not requested or run.
- React review tightened asynchronous listener cleanup, stale-state guards, semantic button labels and sidebar-owned navigation. Existing map context was used only as a guide; current source was authoritative.
- No installation, app launch, data reset, public release, tag, signing or website change occurred.

Artifacts are in `Desktop/Skribli-v0.1.28`:

| Package | Bytes | SHA-256 |
| --- | ---: | --- |
| `Skribli_0.1.28_x64-setup.exe` | 3537169 | `4ded3ff4a7307bfb80e5856485d1d7ab039d5bc9e17eeb2c080b8bf40db00dee` |
| `Skribli_0.1.28_x64_en-US.msi` | 4702208 | `3a046af7525b85d21b4fd8ba0958e3ef77cccc2e4e18d53da8841b4888bf80e5` |

These local installers need no website download key. They remain unsigned; this pass does not establish SmartScreen reputation. The existing account sign-in/entitlement requirements still apply.

Owner acceptance must cover: alternating global/context open/close; rapid clicks; hover and keyboard preview; opening a note without losing its rail; left/right edge dragging; release outside the widget; changing apps; negative/mixed-DPI monitors; narrow and resized Home/library windows; Settings persistence; Archive/Trash navigation; and import/export access.

Screenshots and unit tests cannot establish that the compositor background issue is gone on the owner's Windows device. Keep runtime issues open until that check passes. Signing, payments and website-origin context remain separate outstanding items.
