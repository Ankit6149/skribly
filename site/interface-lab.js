(() => {
  const railStyles = document.createElement('style');
  railStyles.id = 'skribli-rail-polish';
  railStyles.textContent = `
    /* Rail-only refinement. Everything outside the recall surface intentionally stays on the original Interface Lab design. */
    .rail-stage { overflow: hidden; }

    .global-rail-pill {
      right: 0 !important;
      width: 48px !important;
      min-width: 48px !important;
      height: 82px !important;
      padding: 0 !important;
      display: grid !important;
      grid-template-rows: 1fr auto !important;
      place-items: center !important;
      gap: 0 !important;
      border: 1px solid rgba(38,41,35,.14) !important;
      border-right: 0 !important;
      border-radius: 24px 0 0 24px !important;
      background: rgba(255,253,247,.96) !important;
      color: var(--ink) !important;
      box-shadow: -5px 8px 22px rgba(38,41,35,.12) !important;
      backdrop-filter: blur(10px);
      transform: translateY(-50%) !important;
      transition: width .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease !important;
    }
    .global-rail-pill:hover {
      width: 52px !important;
      background: #fffdf7 !important;
      box-shadow: -8px 10px 26px rgba(38,41,35,.15) !important;
    }
    .global-rail-pill > i {
      align-self: end;
      margin-bottom: 4px;
      font-size: 19px !important;
      color: rgba(38,41,35,.72) !important;
    }
    .global-rail-pill > b {
      position: static !important;
      width: 22px !important;
      height: 22px !important;
      margin-bottom: 9px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 999px !important;
      background: var(--yellow) !important;
      color: var(--ink) !important;
      box-shadow: inset 0 0 0 1px rgba(38,41,35,.08) !important;
      font-size: 8px !important;
      font-weight: 800 !important;
    }
    .global-rail-pill > span { display: none !important; }

    .rail-mock {
      top: 20px !important;
      right: 14px !important;
      width: 350px !important;
      height: 550px !important;
      overflow: hidden !important;
      border: 1px solid rgba(38,41,35,.15) !important;
      border-radius: 16px 10px 22px 16px !important;
      background: #fffdf7 !important;
      box-shadow: 0 22px 56px rgba(38,41,35,.17) !important;
    }
    .rail-mock:not(.is-open) {
      transform: translateX(calc(100% + 28px)) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    .rail-header {
      min-height: 58px !important;
      padding: 0 10px 0 14px !important;
      border-bottom: 1px dashed rgba(38,41,35,.11) !important;
      background: rgba(255,253,247,.96) !important;
    }
    .rail-drag-handle {
      min-width: 0 !important;
      cursor: grab !important;
    }
    .rail-drag-handle:active { cursor: grabbing !important; }
    .rail-drag-handle > i {
      width: 30px !important;
      height: 30px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 10px !important;
      background: var(--mint) !important;
      color: rgba(38,41,35,.68) !important;
      font-size: 15px !important;
    }
    .rail-drag-handle strong {
      font-family: var(--font-display, 'Manrope', sans-serif) !important;
      font-size: 14px !important;
      letter-spacing: -.03em !important;
    }
    .rail-drag-handle small { display: none !important; }
    .rail-header > span:last-child { gap: 3px !important; }
    .rail-header button {
      width: 31px !important;
      height: 31px !important;
      border-radius: 9px !important;
      border: 0 !important;
      background: transparent !important;
    }
    .rail-header button:hover { background: #f4f0e7 !important; }

    .rail-search {
      margin: 7px 10px 2px !important;
      min-height: 34px !important;
      border: 1px solid rgba(38,41,35,.11) !important;
      border-radius: 10px !important;
      background: #fff !important;
      box-shadow: none !important;
    }

    .rail-scope {
      margin: 7px 10px 4px !important;
      padding: 0 !important;
      display: flex !important;
      gap: 18px !important;
      border: 0 !important;
      border-bottom: 1px solid rgba(38,41,35,.11) !important;
      border-radius: 0 !important;
      background: transparent !important;
    }
    .rail-scope button {
      position: relative !important;
      height: 31px !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      color: rgba(38,41,35,.55) !important;
      font-size: 9px !important;
      font-weight: 650 !important;
    }
    .rail-scope button.is-active {
      color: var(--ink) !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .rail-scope button.is-active::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      border-radius: 2px 2px 0 0;
      background: var(--ink);
    }
    .rail-scope b { font-size: 7px !important; }

    .rail-list {
      padding: 2px 7px 5px !important;
      scrollbar-width: thin;
      scrollbar-color: rgba(38,41,35,.18) transparent;
    }
    .rail-group { margin: 0 !important; padding-bottom: 5px !important; }
    .rail-group > header {
      min-height: 26px !important;
      padding: 0 6px !important;
      border: 0 !important;
      background: transparent !important;
      color: rgba(38,41,35,.52) !important;
      font-size: 7px !important;
    }
    .rail-group > header b { display: none !important; }

    .rail-note-row {
      position: relative !important;
      min-height: 51px !important;
      padding: 7px 9px 7px 10px !important;
      grid-template-columns: 7px minmax(0,1fr) !important;
      gap: 9px !important;
      border: 1px solid transparent !important;
      border-radius: 10px !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .rail-note-row:hover { background: #f7f4ec !important; }
    .rail-note-row.is-selected {
      border-color: rgba(38,41,35,.10) !important;
      background: #fff !important;
      box-shadow: 0 3px 10px rgba(38,41,35,.05) !important;
    }
    .rail-note-row > .note-marker {
      width: 7px !important;
      height: 31px !important;
      border-radius: 7px !important;
      box-shadow: inset 0 0 0 1px rgba(38,41,35,.07) !important;
    }
    .rail-note-row > span { gap: 3px !important; }
    .rail-note-row strong { font-size: 9px !important; }
    .rail-note-row small {
      color: rgba(38,41,35,.53) !important;
      font-size: 7px !important;
    }
    .rail-note-row small > i { display: none !important; }
    .rail-note-row > .ph-caret-right { display: none !important; }

    .rail-inspector {
      margin: 5px 9px 9px !important;
      padding: 11px 12px !important;
      border: 1px solid rgba(38,41,35,.10) !important;
      border-radius: 12px 12px 18px 12px !important;
      background-image: linear-gradient(rgba(38,39,31,.035) 1px, transparent 1px) !important;
      background-size: 100% 26px !important;
      box-shadow: none !important;
    }
    .rail-inspector-location {
      color: rgba(38,41,35,.52) !important;
      font-size: 7px !important;
    }
    .rail-inspector-location > i { display: none !important; }
    .rail-inspector p {
      margin: 8px 0 10px !important;
      font-family: var(--font-hand, 'Kalam', cursive) !important;
      font-size: 13px !important;
      line-height: 1.38 !important;
    }
    .rail-inspector > div { justify-content: flex-end !important; }
    #readRailNote { display: none !important; }
    #openRailContext {
      min-height: 29px !important;
      padding: 0 9px !important;
      border-radius: 9px !important;
      border: 1px solid var(--ink) !important;
      background: var(--ink) !important;
      color: #fffdf7 !important;
      font-size: 7px !important;
      font-weight: 700 !important;
    }

    /* The floating rail is the only concept changed in this hybrid. */
    [data-view='rail'] + .view-notes li:nth-child(3) { display: none !important; }
  `;
  document.head.appendChild(railStyles);

  const pill = document.querySelector('#globalRailPill');
  if (pill) {
    pill.title = 'My Skribs';
    pill.setAttribute('aria-label', 'Open My Skribs');
  }

  const dragCopy = document.querySelector('#railDragHandle small');
  if (dragCopy) dragCopy.textContent = '';

  const baseScript = document.createElement('script');
  baseScript.src = './interface-lab-base.js';
  baseScript.defer = false;
  document.body.appendChild(baseScript);
})();
