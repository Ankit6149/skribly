# Compact pill, Iconify and highlighting follow-up

The owner requested steady colors on hover, miniature context cards, Iconify instead of Lucide, supported Chrome site logos with Chrome fallback, and readable highlighting on saturated papers. This follow-up supersedes the earlier Supericons-renderer description while retaining its licensed app mark assets.

Desktop and Android source UI icons now use locally bundled Iconify Solar Bold. The Android v0.0.2 APK remains unchanged. Note and widget app marks use the same offline Iconify renderer; supported Chrome site logos use bundled monochrome Simple Icons. GitHub, ChatGPT, Figma, YouTube, Notion, Stack Overflow, GitLab, Reddit, Wikipedia, Drive, Docs, Discord and Slack have marks. Recognition uses conservative saved-title labels or explicit URL hosts. It is only a display hint; native context matching and permissions are unchanged. Unknown Chrome titles retain Chrome.

The contextual native geometry remains 460x250. Browser DOM verification at that size found two 207.8x174 cards, a 32px header, no horizontal overflow, four synthetic Code notes and internal vertical scrolling. The fixture filters to Code rather than pretending unrelated apps belong to this context. Cards use the shared papers, tint, smooth sides, bottom-right curve, 36px light circles and 18px marks. Open and Return remain separate controls. [Compact screenshot](compact-iconify-panel.png) is a browser source capture; the capture backend scales the viewport content and is not native pixel-size evidence.

Card gradients, app-filter backgrounds and panel control colors remain unchanged on hover. Active filter colors and keyboard outlines remain deliberate state feedback.

Five opaque highlight fills pair with #262923 ink, with a fine underline for similar light papers. The removable highlight marker preserves formatting and prior text colors; sanitization recreates it only for approved fills. Descendant text shares the highlight ink. Unit checks verify every fill exceeds 7:1 contrast and saved/reopened markup retains the marker. Browser interaction selected real editor text, applied Mint on indigo, and verified computed fill rgb(207,229,215) and ink rgb(38,41,35). Changing that note to saturated orange retained the highlighted text and the same paired colors. [Dark-note screenshot](dark-note-highlight-iconify.png) shows the actual composer with the ChatGPT mark and readable highlight.

The browser source preview required restarting Vite after removing Lucide; its stale dependency optimizer referenced the removed package. Fresh loading from the actual 127.0.0.1 server restored rendering. These browser checks do not establish installed native blur, docking, OS focus, notification delivery or release acceptance.

## 12 October follow-up — white circle contrast

Note action circles now use opaque warm white with soft charcoal `#424242` on hover, keyboard focus and expanded state. This prevents dark-note foregrounds from creating white icons on white circles. The indigo source preview verified the More action in an actual hovered/expanded state: background `rgb(255,253,247)`, button and SVG ink `rgb(66,66,66)`. Card backgrounds remain unchanged. Forced-colors states use Highlight/HighlightText. Screenshot: [white-circle-dark-icon.png](white-circle-dark-icon.png). This is source UI proof, not installed native acceptance.

## Final owner refinements — 12 October

The owner requested preserving the original draw tray surface. Its original background and selected-tool fills are restored; only tool SVG ink is changed to soft charcoal. The icon-pill hover details use dark text. Plain Fluent plus and cross replace their circled glyphs, with an additional 0.75px round stroke for weight. The cross retains white-circle hover feedback. Empty-editor placeholder ink now derives from the note foreground at 60% opacity, making it pale on dark papers and dark on light papers; typed text colors are unchanged.

Earlier draw-tray screenshot shows an interim white tray and is historical, not proof of the final tray color. At the owner's request, no further browser interactions or new test runs were performed for these final refinements. Installed owner verification remains open.
