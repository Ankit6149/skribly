# Test strategy

## Automated

- Rust unit tests for context scoring and persistence
- TypeScript tests for models, state transitions, and geometry
- migration tests with old database fixtures
- extension selector/fingerprint tests
- static licence/dependency audit

## Cross-platform integration matrix

Test at minimum:

- Windows 11 x64
- macOS Apple Silicon
- single and multiple monitors
- 100%, 125%, 150%, and Retina scaling where available
- Notepad/TextEdit
- File Explorer/Finder
- Chrome/Edge/Safari window-level behavior
- VS Code
- fullscreen applications
- sleep/wake
- crash/restart
- permission revoked while running

## Golden path

Create → edit → close target → restart Skribly → reopen target → restore → re-anchor → archive → restore from archive.

Do not use screenshot-only tests as proof that overlay mechanics work.
