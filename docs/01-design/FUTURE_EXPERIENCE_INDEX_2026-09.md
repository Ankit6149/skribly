# Skribli Future Experience Review — September 2026

This folder contains the future-facing UI/UX audit and direction work based on repository baseline `a3f5b3aedbc368bd46a768043fff9001f7e67b99` (`v0.1.24`). The review artifacts are intentionally separate from the production React/Tauri UI.

## Authoritative review order

1. `FUTURE_EXPERIENCE_AUDIT_DEEP_DIVE_2026-09.md`
   - authoritative corrected audit after re-reading the current implementation;
   - documents the real current Skrib command bar, save/lifecycle behavior, automatic tool expansion, Rail responsibilities, Home/Library structure and context truth boundaries;
   - includes the correction that **Complete task is currently exposed inside the delete-confirmation state, not as a normal footer peer**;
   - defines heavy-load acceptance, the state contract, cross-surface journeys, future capability pressure and redesign dependency order.

2. `FUTURE_DESIGN_DIRECTIONS_DECISION_GUIDE_2026-09.md`
   - explains how to judge A · Living Paper, B · Quiet Ink and C · Context Thread as interaction systems rather than skins;
   - defines reveal, motion, risk, accessibility and stress-test rules for all 17 major surface groups;
   - recommends the fourth direction **Quiet Paper / Living Context**.

3. `FUTURE_EXPERIENCE_AUDIT_2026-09.md`
   - original broad future-facing audit;
   - retained as exploration/history;
   - where it conflicts with the Deep Dive or current repo behavior, the Deep Dive is authoritative.

4. `FUTURE_DESIGN_DIRECTIONS_2026-09.md`
   - original detailed three-direction exploration;
   - retained as the long-form ideation source;
   - use the Decision Guide for the latest evaluation rules.

## Browser review pages

- `/interface-audit` — corrected deep audit, current implementation truth, state/journey coverage and redesign sequence.
- `/interface-directions` — elaborated 17-surface A/B/C comparison with per-direction rest/reveal/motion/risk rules and interactive resize specimen.

## Design gate

Do not begin broad production UI refactoring until these are agreed:

- Reminder vs Task semantics;
- Done vs Complete lifecycle;
- Open here vs Return language;
- Active / Past / Trash information architecture;
- free resize + Fit / tool-expansion behavior;
- Rail visibility/auto-hide contract;
- the final hybrid visual system and its state/accessibility rules.

## Scope boundary

These artifacts do **not** modify the production desktop React/Tauri UI. They are the decision gate before production refactoring.