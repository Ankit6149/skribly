# Performance budget

These are engineering targets, not public promises until measured on representative hardware.

| Metric | Initial target |
|---|---:|
| Idle CPU with static windows | approximately 0% |
| Idle memory | below 90 MB, stretch target below 70 MB |
| Tray-ready startup | under 1 second on a typical SSD laptop |
| Overlay follow latency | one to two display frames |
| Local save acknowledgement | visually immediate |
| Network while idle | none |
| Installer | below 30 MB excluding system-provided webview |

## Rules

- event-driven window observation; no continuous full-screen polling
- no screen capture or OCR
- no permanent animation loops
- render only visible contexts
- unload the library/settings UI when not needed if practical
- debounce persistence without risking data loss
- profile both x64 and Apple Silicon
- test multi-monitor and mixed-DPI setups

Every release must record measured idle memory, idle CPU, startup, and ink latency.
