# Widget feature

This directory is the canonical home for the global and contextual Skribli widgets.

Current ownership:

- `ContextRail.tsx` — widget lifecycle/state coordinator;
- `GlobalPanelHandle.tsx` — separate global edge-handle surface;
- `components/` — launchers, header, filters, Skrib ribbons, and opening journey;
- `lifecycle/` — native-window observation, context presence, paint acknowledgement, and saved-note opening coordination;
- `model/` — grouping, context matching, counts, and scope types;
- `styles/` — widget-owned CSS.

The former `features/rail/` compatibility namespace has been removed. New widget code belongs here.
