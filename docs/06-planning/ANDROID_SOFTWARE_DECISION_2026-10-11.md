# Android software decision — 11 October 2026

The downloadable Android v0.0.2 APK is a private, debug-signed ARM64 preview. Its certified SHA-256 is `23f542276ecb9694d641a30e61db46821160fe0193cf459067d9d887df447dce`. It supports offline notes and reminder entries. System notification scheduling, live desktop sync, and real-phone acceptance are unfinished. Today's desktop UI changes are not in that existing APK. Iconify is updated in Android source, but no new APK is built before the software decision.

## Framework options

| Option | Advantages for Skribli | Costs and limitations |
| --- | --- | --- |
| Keep Tauri 2 + React/TypeScript + Rust | Existing working foundation; reuse shared models, palette and React skills; retain local-first storage | WebView UI requires mobile interaction tuning; background reminders need native Android integration and device tests; fewer ready-made mobile integrations than mature native frameworks |
| React Native | React/TypeScript experience transfers; native controls and extensive mobile integrations | Existing desktop HTML/CSS cannot simply become native screens; mobile UI and integrations must be rebuilt; still needs Android/iOS build tools |
| Flutter | Consistent rendering, strong animation tools, Android and iOS support | Dart and Flutter widgets require a UI rewrite; another stack alongside the React desktop application |
| Kotlin + Jetpack Compose | Direct access to Android APIs, background work and native UI | Separate Android UI and skills; iPhone needs a separate implementation; least reuse of this existing application |

Recommendation: retain the current Tauri foundation for the first Android release. This is a project-specific judgment about reuse and delivery time, not a claim that one framework is universally superior. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), [React Native introduction](https://reactnative.dev/docs/getting-started), [Flutter architecture](https://docs.flutter.dev/resources/architectural-overview), [Jetpack Compose](https://developer.android.com/compose).

## Notifications

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Native local notifications | Reminders can work offline; no push service or server bill; scheduling can stay on the device | Implement permissions, channels, persistent scheduling, cancellation, reboot/time-zone rescheduling and real-device delivery tests. Doze/battery policies affect timing; exact alarms require special handling | First choice for personal reminders |
| Firebase Cloud Messaging (FCM) | Server-sent alerts; messaging product is listed as no-cost; supports Android and later Apple devices | Needs network, device-token lifecycle and a trusted sending backend; Android Google transport depends on its service environment; other backend products can still cost money; does not replace reliable local reminder scheduling | Add only when server-sent alerts are required |
| OneSignal | Convenient messaging dashboard, segmentation and cross-platform SDK workflows | Another vendor and SDK; plan-dependent paid features; Google Android push still needs FCM credentials; a native integration is required for Tauri | Unnecessary for this first release |

Firebase is not required to save notes or deliver reminders scheduled locally. FCM can be added without replacing the existing account/database backend with Firebase Auth or Firestore. No Firebase, OneSignal, analytics SDK or new notification backend was installed in this execution. [Android alarms](https://developer.android.com/develop/background-work/services/alarms), [FCM architecture](https://firebase.google.com/docs/cloud-messaging), [Firebase pricing](https://firebase.google.com/pricing), [OneSignal setup](https://documentation.onesignal.com/docs/en/mobile-sdk-setup).

## Required tools and current gaps

Use Node/npm, Rust with Android targets, a compatible JDK, Android Studio, Android SDK platform/build tools matching the generated Gradle project, NDK, ADB, an emulator and at least one real Android phone. Git and a pinned CI build environment provide repeatable packages. An editor and Figma are optional tools, not runtime services. [Official Tauri setup](https://v2.tauri.app/start/prerequisites/).

This machine has Node 22.23.1/npm 10.9.8, Rust Android targets, Java 17, and ADB/SDK command-line tools. The SDK has platform 34 while the generated project uses 36. No NDK or standard-path Android Studio installation was found. Those gaps must be resolved before a fresh Android build. No global Android tools were installed today.

For iPhone later, a Mac with Xcode and the iOS toolchain is required; Apple signing/distribution is a separate step. A Windows build alone cannot produce an accepted iPhone release. Android Play distribution also requires release signing and store preparation. Neither private preview is public-release acceptance.

## Phone acceptance before public release

Verify launch, save/restart, keyboard and Back behavior, insets, accessibility, storage lifecycle, notification permissions and closed-app/reboot delivery on real phones. Verify encrypted sync only after its transport and key enrollment actually exist. Select the notification scope first; do not add push infrastructure just to deliver local reminders.
