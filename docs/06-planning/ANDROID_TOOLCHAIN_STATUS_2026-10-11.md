# Android-first toolchain and next work - 11 October 2026

Owner choice: Android first, iPhone later. Executor: Codex / root. This is an inventory and implementation plan; no software installation or phone build was performed in this pass.

The existing `apps/android` foundation uses React/TypeScript/Vite with Tauri 2 and Rust. Continue that stack and shared design tokens. A second Flutter/React Native application is unnecessary for the current scope. The current delivery record is the private ARM64 v0.0.2 preview, not the older v0.0.1 foundation: [4 October owner platform refresh](../04-operations/OWNER_PLATFORM_REFRESH_2026-10-04.md). It includes offline notes and reminders; real-phone acceptance and live desktop sync remain open.

| Software | Current PC evidence | Next setup |
| --- | --- | --- |
| Android Studio | Not found in its standard Program Files location | Install from the official Android site, or identify an existing installation. Use its SDK Manager. |
| Android SDK/platform/build tools | SDK directory exists under LocalAppData; installed platform is android-34. Generated app declares compile/target SDK 36. | Install the platform/build tools matching this generated configuration. |
| Android NDK | No NDK directory in the current SDK | Install a compatible NDK; configure `NDK_HOME` for the chosen toolchain. |
| JDK | Eclipse Adoptium Java 17 exists | Verify `JAVA_HOME` and compatibility with the project's Gradle setup before building. |
| Node/npm | Verified portable Node 22.23.1 / npm 10.9.8 available in ignored development artifacts | Use the existing toolchain; configure the working shell path. |
| Rust and Android targets | Cargo/rustup and all four Android Rust targets already installed | Retain them; verify the Android linker/NDK configuration. |
| ADB / command-line tools | `platform-tools/adb.exe` and `cmdline-tools/latest` exist; not on the current shell path | Set `ANDROID_HOME` and scoped paths; verify a real phone is detected. |
| Phone/emulator | No real-phone acceptance in this pass | Prefer an ARM64 Android phone with USB debugging for private tests; an emulator is optional additional coverage. |

Tauri's [official prerequisites](https://v2.tauri.app/start/prerequisites/) specify Android Studio, Java/SDK/NDK configuration and Rust Android targets. Android's [installation guide](https://developer.android.com/studio/install.html) and [emulator guide](https://developer.android.com/studio/run/emulator) cover the optional emulator setup. These sources were checked on 11 October 2026. Required package versions should follow the reviewed project build configuration, rather than an unreviewed global toolchain upgrade.

After setup: initialize/inspect the generated native project, use the existing private debug build script, then verify launch, edit/save/restart, Android Back, keyboard and system-bar insets, rotation/process death, TalkBack, reminder notification delivery and storage/recovery on a real phone. Carry the desktop paper palette and icon language into a phone layout only after this foundation is accepted. Do not copy the Windows edge overlay behavior into Android or claim that desktop sync is connected.

For iPhone later, Tauri's iOS target requires macOS with full Xcode, iOS Rust targets and the documented Apple toolchain dependencies. App distribution/signing is a separate step. The current Windows setup alone cannot build the iOS application. No iPhone implementation is claimed here.

Public mobile release remains separate from toolchain installation and the existing debug-signed preview. Next execution is Android toolchain restoration and real-phone acceptance, followed by the phone UI pass. No new human decision is needed for Android priority; installation and distribution are outside this inventory task.
