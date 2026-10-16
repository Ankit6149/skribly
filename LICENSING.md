# Community and commercial source boundaries

The owner approved the open-core direction and confirmed ownership of the original work on 17 October 2026. This revision applies **MPL-2.0** to the first-party Community source roots and individual files listed in [licensing-map.json](licensing-map.json). The unmodified licence is [LICENSE](LICENSE). The map attaches the notice to covered files, including formats that cannot carry comments. Existing third-party notices take precedence for the upstream material they identify.

Covered areas include the Windows desktop and Android foundation, shared packages, the deferred browser-extension source, Community development tooling, validation tooling and GitHub automation. Their original code is reusable under MPL-2.0, including the existing client-side account integration. That integration is not a paid server entitlement or a grant to use the separately licensed production backend. The original app-icon SVG's copyright is included; trademark rights remain separate.

The commercial `supabase/` backend, `site/`, `scripts/license/`, `scripts/packaging/`, `scripts/windows/` and historical `docs/`/design-reference areas are **not included in the Community grant**. Unlisted first-party material remains reserved under NOTICE.md. Private Pro implementations are planned separately; this repository does not claim they already exist. New commercial files must live outside the covered roots and carry explicit terms; do not silently insert proprietary code inside a Community source root.

Third-party icon/font/library licences remain effective. Consult [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), the override map and upstream notices. This grant does not relicense someone else's code, assets, trademarks or dependencies.

Contributions to covered code use the same licence and the Developer Certificate of Origin sign-off described in CONTRIBUTING.md. A sign-off does not assign copyright or grant arbitrary future relicensing rights. Contributions to retained proprietary areas require a separate explicit arrangement; do not assume the Community contribution policy covers them.

Covered source permissions do not expire when paid services end. Pro/service terms must preserve rights in MPL-covered software. Distribution of covered executable code must satisfy the source-availability and notice requirements of MPL-2.0; a commercial EULA must not contradict those rights. See the [licence](LICENSE) and [Mozilla FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

The source transition does not remove binary-release, third-party distribution, signing, privacy, sales or installed-acceptance gates. No public installer or paid offering is authorized merely by changing source licensing.
