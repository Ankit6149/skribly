# Platform permissions

## Windows

Expected capabilities include global shortcut registration, top-level window observation, UI Automation queries, tray operation, and local notifications. Avoid admin rights. Skribly should install and run per-user.

## macOS

Precise context detection is expected to require Accessibility permission. Onboarding must explain:

> Skribly uses Accessibility permission to identify windows and restore your annotations. It does not read what you type or record your screen.

Do not request Screen Recording permission in v1.

## Browsers

The Chromium extension begins with minimal permissions. Broad host access must be opt-in or granted only for user-selected sites when technically possible.
