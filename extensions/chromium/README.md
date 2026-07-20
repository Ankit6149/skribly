# Skribly Chromium extension

This extension is intentionally deferred until whole-window anchoring works on both desktop platforms.

Its eventual responsibilities are limited to:

- current URL and page identity
- user-directed DOM element selection
- stable selector and nearby-text fingerprints
- scroll/layout repositioning
- local authenticated communication with the Skribly desktop app

It must not request broad host permissions by default or transmit browsing data to a cloud service.
