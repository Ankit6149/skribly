# Skribli Chromium extension

This extension is intentionally deferred until whole-window anchoring works on both desktop platforms. The current workspace is a typecheck-only scaffold: `npm --workspace @skribly/chromium-extension run typecheck` checks the placeholder TypeScript but does not emit `dist/background.js` or a loadable extension package. The manifest path is a future build target, not an available artifact.

Its eventual responsibilities are limited to:

- current URL and page identity
- user-directed DOM element selection
- stable selector and nearby-text fingerprints
- scroll/layout repositioning
- local authenticated communication with the Skribli desktop app

It must not request broad host permissions by default or transmit browsing data to a cloud service. A future approved delivery implementation must emit every manifest-referenced asset and validate loading the unpacked extension before this workspace can claim a build.
