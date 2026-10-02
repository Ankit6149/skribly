# Desktop window composition

This directory owns **which product feature is mounted into each Tauri WebView window**.

It must stay thin. Product/domain behavior belongs under `features/`; native HWND lifecycle belongs in Rust.

| Tauri label | React composition |
| --- | --- |
| `home` | `HomeWindow` |
| `main` | `NoteWindow` |
| `rail` | `GlobalWidgetWindow` |
| `context-rail` | `ContextWidgetWindow` |
| `global-rail-handle` | `GlobalWidgetHandleWindow` |

Window components should not become another feature layer. Their job is composition, window-specific providers, and window-only error boundaries when needed.
