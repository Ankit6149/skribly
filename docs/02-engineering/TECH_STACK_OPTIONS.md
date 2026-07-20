# Technology stack options

## Current shortlist

### 1. Tauri 2 + React + Rust — provisional choice

**Strengths**

- best fit with existing React skills
- fast reproduction of the Soft Paper Play visual system
- system webview rather than bundled Chromium
- Rust native extensibility
- shared TypeScript models with the Chromium extension
- commercially straightforward open-source licences

**Risks**

- per-region overlay hit testing may require native code
- WebView2 and WebKit require cross-platform visual testing
- Rust and platform APIs add learning cost
- advanced ink may require optimization later

### 2. Flutter + Dart

**Strengths**

- strong custom rendering, gesture, touch, and stylus model
- consistent UI across platforms
- mature ecosystem and permissive licence

**Risks**

- new language
- native overlay/context tracking still requires C++/Swift adapters
- less sharing with the browser extension
- larger renderer payload than a system-webview app

### 3. Avalonia + C#

**Strengths**

- MIT licence
- no webview
- C# productivity
- Skia-based custom visuals
- coherent desktop architecture

**Risks**

- new C#/XAML stack
- sophisticated click-through overlays still need native adapters
- slower design iteration for the current team

### 4. Electron + React

**Strengths**

- fastest prototype path
- mature transparent-window and ignore-mouse-event APIs
- largest desktop JavaScript ecosystem

**Risks**

- bundled Chromium/Node baseline conflicts with the lightweight promise
- higher idle memory and larger installer

## Rejected for now

- Qt/QML: technically strong, but commercial/LGPL compliance creates avoidable complexity for this founder context.
- .NET MAUI: less natural for a system-wide overlay utility.
- Uno: capable but less direct than Avalonia for this desktop-only product.
- Neutralino: lightweight but smaller native integration ecosystem.
- multiple UI frameworks in one app: explicitly prohibited.

## Mixing rule

Choose exactly one primary UI/window framework. Other languages may appear only as:

- thin platform adapters
- isolated performance-critical libraries
- browser-extension code

Do not combine Tauri UI with Avalonia or Qt overlays.
