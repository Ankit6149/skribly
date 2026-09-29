# Mobile companion planning proposal

**Date:** 28 September 2026
**Status:** Research and sequencing only. Mobile and cloud sync are not approved Windows v1 features, release commitments, or public claims. The [PRD](../00-product/PRD.md), [roadmap](ROADMAP.md), and [component inventory](../01-design/COMPONENT_INVENTORY.md) keep mobile deferred; optional end-to-end encrypted sync is research under [#69](https://github.com/Ankit6149/skribly/issues/69). Windows release acceptance proceeds independently.

## Product shape

A phone should help a person catch a thought from the context they are already viewing, then find and act on it later. The first mobile experience would have a user-invoked share target for a URL, selected text, image, or approved document; a short compose sheet that shows the source and save state; a recent/inbox library with search; a note detail view; and local reminders. It should use the paper palette and language while following mobile navigation, touch-target, dynamic-text, screen-reader, and reduced-motion conventions. A local-only prototype can test this flow, but it should not be marketed as a desktop companion until transfer between devices actually works.

Mobile context is an explicit shared link or file, not a Windows process name, window title, or screen coordinate. For desktop-only context records, show the saved source label and permit later manual linking. Never promise that a mobile note will automatically appear over another app or over a matching desktop webpage. Desktop browser URL/DOM anchoring is itself deferred.

Platform limits shape this design. An [iOS Share extension](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html) receives content through a user action, and [iOS app sandboxes](https://developer.apple.com/documentation/technologyoverviews/shared-data) restrict access to other apps' data. Combined with [limited background execution](https://developer.apple.com/documentation/Xcode/configuring-background-execution-modes), this rules out promising a persistent Windows-style cross-app overlay on iOS; that is an inference from the platform model, to be validated in an iOS prototype. Android can [receive shared content through `ACTION_SEND`](https://developer.android.com/develop/ui/compose/sharing/receive). Its [cross-app overlay permission](https://developer.android.com/reference/android/Manifest.permission) requires explicit special access and is described as appropriate for very few apps, so an overlay is outside the proposed MVP. [Android background work](https://developer.android.com/develop/background-work/background-tasks/persistent) and [iOS background tasks](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app) do not guarantee immediate sync. Schedule local reminders through [iOS notifications](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app) and the Android notification system, requesting [iOS](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications) or [Android 13+](https://developer.android.com/develop/ui/compose/notifications/notification-permission) permission when the person first needs it.

## What can be shared

The current desktop architecture has two content stores: Rust-owned versioned JSON for note text, context, colour, geometry, and lifecycle; WebView IndexedDB for rich text, ink, attachment blobs, and reminders. The [architecture](../02-engineering/ARCHITECTURE.md) explicitly says portable JSON does not yet include the latter. The existing `packages/shared` types cover only a small aspirational Windows/macOS anchor shape. Supabase account sign-in and the server-owned trial carry identity and entitlement, never note content. Signing in must not imply sync.

Share a versioned, platform-neutral note schema and pure validation, lifecycle, reminder, export/import, and encryption logic where appropriate. Keep Windows capture, native window placement, tray and shortcut handling on desktop. Build mobile-specific share handling, local storage, notifications, security-key storage, navigation, and accessibility. [Tauri 2 supports desktop and mobile](https://v2.tauri.app/start/), making React/Rust reuse worth a short proof of concept, but the Windows WebView screens cannot simply be shrunk to phone size. Compare a Tauri mobile shell with SwiftUI and Kotlin Compose on real-device share capture, cold start, offline saves, large text, and accessibility before choosing. [iOS development requires macOS and Xcode](https://v2.tauri.app/start/prerequisites/), including when using Tauri.

## Dependency sequence and rough effort

Estimates are engineering person-weeks for an experienced team with part-time design, security, and QA. They are planning ranges, not dates or commitments; platform and sync work can overlap only after the shared data contract is stable.

| Stage | Outcome and acceptance evidence | Rough effort |
| --- | --- | ---: |
| Discovery | Interview current desktop users; prototype quick capture, source display, note retrieval, large-text and screen-reader flows on real iOS and Android devices; choose first platform and stack. | 2–3 weeks |
| Portable content foundation | Define a versioned note plus blob manifest covering native record, rich text, ink, attachments, and reminders. Prove migration, complete export/import, rollback, deletion, downgrade, and integrity checks on real data before any sync claim. | 4–8 weeks |
| First mobile beta | Local-first share capture, compose, library/search, reminder and export flows; permission-minimal app; offline and reinstall recovery tests. Private device testing first. | 8–12 weeks |
| Second platform | Implement the same product contract with platform-specific sharing, notifications and accessibility, then test both stores' lifecycle requirements. | 6–10 additional weeks |
| Optional encrypted sync | Only after approved threat model and key-recovery decisions: opt-in device enrollment, ciphertext record/blob transport, bounded offline queue, conflict handling, revocation and deletion. | 8–16+ weeks |
| Release acceptance | Real-device matrix, privacy and store disclosures, account deletion, purchase/entitlement recovery if monetized, support and rollback. | 4–8 weeks |

For a lean two-engineer effort, both platforms plus trustworthy sync plausibly span many months. None of these stages blocks a Windows-only launch.

Mobile distribution has its own cash and calendar costs. iOS development needs a Mac/Xcode; [Apple Developer Program membership is US$99 per year](https://developer.apple.com/programs/enroll/) (or local currency) for TestFlight and App Store distribution. [Google Play Console charges a US$25 one-time registration fee](https://support.google.com/googleplay/android-developer/answer/6112435). For a new personal Play developer account, Google currently requires a [closed test with at least 12 opted-in testers for 14 continuous days](https://support.google.com/googleplay/android-developer/answer/14151465) before requesting production access. These costs and rules should be rechecked at enrollment; hardware, test devices, design, security review, store commissions, and support are additional.

## Sync and privacy gate

If sync is approved, keep local content authoritative on each device and make upload an explicit opt-in. Use stable record and attachment IDs, schema versions, revisions, deletion tombstones, an offline mutation queue, integrity hashes, retry limits, and a visible conflict review for simultaneous edits. Encrypt content on device before upload; define device authorization, recovery key, lost-key behavior, rotation, quota, backup, and account deletion before choosing a storage provider. The server may need minimal routing metadata, but it must not silently receive plaintext Skribs. Treat URL query strings, file names, and shared text as potentially sensitive; let users inspect the source before saving and minimize or strip secret-bearing URL parts by default. Existing local notes stay readable and exportable when an entitlement expires, in line with the [PRD](../00-product/PRD.md).

Mobile commerce would require a cross-platform entitlement model and server verification of any store purchase. A website checkout cannot simply be embedded in a store app: [Apple's App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Google Play's payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) impose rules that vary by storefront, region, and program. If mobile permits account creation, both [Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app) and [Google Play](https://support.google.com/googleplay/android-developer/answer/13327111) require an account deletion path. Review these policies again when a store submission and sales regions are chosen.

## Owner decisions before implementation

1. Is mobile quick capture for mobile-only notes, or a full companion that must show and edit desktop Skribs?
2. Which platform and audience come first, and what real devices/Mac build capacity are available?
3. Is optional encrypted sync valuable enough to justify its security, storage, recovery, and support costs? What should happen when a user loses every device and recovery key?
4. Which shared content types, maximum attachment sizes, and desktop context links are in the first mobile beta?
5. Is mobile included with a desktop licence, free for all, or sold separately? Which regions and stores would receive it?

These decisions need user evidence and an approved architecture/security/business issue set. They should not be inferred from the existence of desktop account sign-in or the private owner installer.
