# Risks and decision gates

## Risk 1: fine-grained click-through overlay

**Impact:** product-blocking  
**Mitigation:** cross-platform spike before feature development  
**Fallback:** Flutter or Avalonia spike; multiple small interactive windows if performance remains acceptable

## Risk 2: context identity is unreliable

**Impact:** misplaced annotations destroy trust  
**Mitigation:** layered matching, confidence scoring, explicit re-anchor UX, conservative failure

## Risk 3: macOS permissions and distribution

**Impact:** onboarding friction and annual cost  
**Mitigation:** Accessibility-only v1, direct notarized distribution, clear explanation, test on real Macs

## Risk 4: browser layouts change

**Impact:** broken webpage anchors  
**Mitigation:** selector + semantic fingerprints + manual repair

## Risk 5: product becomes heavy

**Impact:** users uninstall an always-running utility  
**Mitigation:** performance budgets, no Electron/AI/OCR, event-driven tracking, visible-context rendering only

## Risk 6: category is already occupied

**Impact:** weak differentiation  
**Mitigation:** annotations beyond notes, handwriting, modern tactile UX, cross-platform, local-first, collapsed markers

## Gate decisions

1. Stack accepted after overlay spike.
2. SQLite schema accepted after whole-window anchor model is stable.
3. Browser extension starts only after native-window MVP works.
4. Paid beta starts only after signing, privacy, recovery, and CA review.
