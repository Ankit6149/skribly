# Distribution and store-cost working notes

**Last reviewed:** 2026-07-20  
**Status:** working business notes; verify before launch

## Windows

### Direct distribution

- Skribly may be distributed from its own website using a signed installer.
- Microsoft Store listing is optional.
- Code signing is strongly recommended for direct distribution; certificate pricing varies and is not budgeted here.

### Microsoft Store

Microsoft currently documents a free onboarding flow for new individual developers, started through its Store developer onboarding page. Microsoft also documents that non-gaming apps may use their own commerce platform and keep 100% of app revenue, or use Microsoft commerce and pay a 15% app fee.

Practical working route:

- direct signed installer
- optional Microsoft Store listing for trust/discovery
- own checkout where Store policy and implementation allow

## macOS

### Direct distribution

A public trusted `.dmg` distributed outside the Mac App Store normally requires Apple Developer Program membership for Developer ID signing and notarization. Apple lists the membership at US$99 per membership year, with local-currency pricing possible.

Apple commission on a direct website sale: 0%. Payment processor and Indian tax obligations still apply.

### Mac App Store

Apple lists a standard commission of 30% for digital goods/services, with 15% for qualifying developers enrolled in the App Store Small Business Program. The Small Business Program generally applies up to US$1 million in eligible proceeds and requires enrollment.

Skribly's system-wide accessibility/overlay behavior should be technically and policy-tested before assuming Mac App Store compatibility.

## Working recommendation

1. Windows direct installer first; evaluate Microsoft Store in parallel.
2. macOS direct signed/notarized installer after a Mac build/test path exists.
3. Mac App Store only after permissions, sandbox behavior, and commercial value justify the effort.

## Official sources

- Microsoft Store benefits and commerce: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/why-distribute-through-store
- Microsoft free individual onboarding: https://learn.microsoft.com/en-us/windows/apps/publish/whats-new-individual-developer
- Apple Developer enrollment: https://developer.apple.com/programs/enroll/
- Apple membership comparison: https://developer.apple.com/support/compare-memberships/
- Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/

The exact fees, eligibility, policies, and local-currency charges can change. Reverify immediately before enrollment or sale.
