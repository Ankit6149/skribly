(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const views = {
    overview: ['Foundation 00 · Design DNA', 'Soft paper. Precise software.', 'Skribli should feel like physical thoughts living inside a disciplined Windows utility—not a dashboard decorated with sticky notes.'],
    structure: ['Foundation 01 · Product structure', 'Four visible windows, one background product.', 'Each surface has one primary job. The user should never have to understand Tauri windows, HWNDs, storage revisions, or entitlement plumbing to use Skribli.'],
    motion: ['Foundation 02 · Hover & motion', 'The resting state stays quiet. The pointer wakes up the right detail.', 'Hover adds acknowledgement, revelation, and occasional transformation without becoming the only way to discover primary behavior.'],
    note: ['Daily 01 · Core Skrib', 'Capture first. Everything else waits for intent.', 'The compact Skrib keeps context, thought, save confidence, and Done visually dominant while advanced capabilities reveal themselves only when used.'],
    attachments: ['Daily 02 · Attachments', 'Files should feel like the things people believe they are.', 'Images become photographic objects, documents become paper, and video begins as a visual frame. Technical metadata stays secondary.'],
    drawing: ['Daily 03 · Drawing', 'Powerful tools, contextual controls.', 'Drawing expands the same Skrib and shows only properties relevant to the selected tool.'],
    reminder: ['Daily 04 · Reminder', 'The Skrib grows into the scheduling workspace it needs.', 'Quick reminders remain tiny. Custom date, time, and recurrence use the same note object instead of an unrelated modal.'],
    dot: ['Daily 05 · Collapsed dot', 'A folded thought, not a generic button.', 'The dot is a tiny contextual presence. Hover reveals dismissal; the primary action remains reopening the saved Skrib.'],
    rail: ['Daily 06 · My Skribs rail', 'Read it here, or return to where it belonged.', 'The rail makes Skribli’s contextual retrieval model explicit without embedding duplicate editors or flooding each row with controls.'],
    library: ['Daily 07 · All Skribs', 'Reading first. Data management second.', 'Search, read, and return dominate. Import, export, Trash, and recovery stay available without turning the library into an admin console.'],
    calendar: ['Daily 08 · Calendar & Trash', 'Global lenses over local Skribs.', 'The calendar gathers reminder state. Trash manages lifecycle. Neither becomes an independent productivity product.'],
    home: ['Low-frequency 01 · Home', 'Skribli is ready. Go back to your work.', 'Home is a readiness and entry surface rather than a dashboard that competes with the applications where thoughts originate.'],
    onboarding: ['Low-frequency 02 · Onboarding', 'Teach the mental model before the feature set.', 'A first successful contextual thought matters more than a tour of every capability.'],
    account: ['Low-frequency 03 · Account & tray', 'Identity is connected. Content stays local.', 'Account and entitlement trust remain visually and conceptually separate from local Skrib persistence.'],
    recovery: ['Trust surface · Recovery', 'Protect aggressively underneath. Speak calmly on the surface.', 'Exceptional states translate technical machinery into Saving, Saved, Needs attention, read-only recovery, and clear next actions.'],
    matrix: ['Acceptance environment', 'Every approved surface gets the same state coverage.', 'The Interface Lab is the review gate for hierarchy, behavior, scale, keyboard use, failure states, and product truth before production UI work.'],
  };

  function showView(view) {
    const target = views[view] ? view : 'overview';
    $$('.lab-view').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.view === target));
    $$('.lab-surface-nav > button').forEach((button) => button.classList.toggle('is-active', button.dataset.showView === target));
    const copy = views[target];
    $('#viewEyebrow').textContent = copy[0];
    $('#viewTitle').textContent = copy[1];
    $('#viewSummary').textContent = copy[2];
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  $$('[data-show-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.showView)));
  $$('[data-jump-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.jumpView)));

  const scale = $('#labScale');
  const runtime = $('#labRuntime');
  const runtimeBadge = $('#runtimeBadge');
  const scaleClasses = ['scale-125', 'scale-150'];
  const runtimeClasses = ['runtime-offline', 'runtime-readonly', 'runtime-attention'];

  scale.addEventListener('change', () => {
    document.body.classList.remove(...scaleClasses);
    if (scale.value !== '100') document.body.classList.add(`scale-${scale.value}`);
  });

  function syncRuntime() {
    document.body.classList.remove(...runtimeClasses);
    if (runtime.value !== 'normal') document.body.classList.add(`runtime-${runtime.value}`);
    const labels = {
      normal: 'Normal runtime',
      offline: 'Offline account path',
      readonly: 'Read-only local data',
      attention: 'Needs attention',
    };
    runtimeBadge.textContent = labels[runtime.value];
    const saveLabel = $('#saveStateLabel');
    const saveDetail = $('#saveStateDetail');
    if (!saveLabel || !saveDetail) return;
    if (runtime.value === 'readonly') {
      saveLabel.textContent = 'Read-only';
      saveDetail.textContent = 'Verified local Skrib is protected';
    } else if (runtime.value === 'attention') {
      saveLabel.textContent = 'Needs attention';
      saveDetail.textContent = 'Retry before folding this Skrib';
    } else {
      saveLabel.textContent = 'Saved';
      saveDetail.textContent = runtime.value === 'offline' ? 'Saved locally · account offline' : 'Latest text is safe';
    }
  }
  runtime.addEventListener('change', syncRuntime);

  $('#toggleNotes').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const next = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(next));
    document.body.classList.toggle('hide-review-notes', !next);
  });

  // Core Skrib
  const noteMock = $('#noteMock');
  const noteWriting = $('#noteWriting');
  const noteTray = $('#noteToolTray');
  let activeNoteTool = null;
  let saveTimer = null;

  function setSaveState(label, detail) {
    if (runtime.value === 'readonly') return;
    $('#saveStateLabel').textContent = label;
    $('#saveStateDetail').textContent = detail;
  }

  function scheduleSave() {
    if (runtime.value === 'readonly') return;
    window.clearTimeout(saveTimer);
    setSaveState('Saving…', 'Keeping the latest edit safe');
    saveTimer = window.setTimeout(() => setSaveState('Saved', runtime.value === 'offline' ? 'Saved locally · account offline' : 'Latest text is safe'), 520);
  }

  noteWriting.addEventListener('input', scheduleSave);

  function openNoteTool(tool) {
    const same = activeNoteTool === tool && !noteTray.hidden;
    activeNoteTool = same ? null : tool;
    $$('[data-note-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.noteTool === activeNoteTool));
    $$('[data-tool-panel]', noteTray).forEach((panel) => { panel.hidden = panel.dataset.toolPanel !== activeNoteTool; });
    noteTray.hidden = !activeNoteTool;
  }

  $$('[data-note-tool]').forEach((button) => button.addEventListener('click', () => {
    if (runtime.value === 'readonly') return;
    openNoteTool(button.dataset.noteTool);
  }));

  $$('[data-note-color]').forEach((button) => button.addEventListener('click', () => {
    ['yellow', 'peach', 'mint', 'sky', 'lavender'].forEach((color) => noteMock.classList.remove(`note-${color}`));
    noteMock.classList.add(`note-${button.dataset.noteColor}`);
    scheduleSave();
  }));

  $$('[data-text-size]').forEach((button) => button.addEventListener('click', () => {
    noteWriting.classList.remove('size-small', 'size-large');
    if (button.dataset.textSize === 'small') noteWriting.classList.add('size-small');
    if (button.dataset.textSize === 'large') noteWriting.classList.add('size-large');
    scheduleSave();
  }));

  $$('[data-add-object]').forEach((button) => button.addEventListener('click', () => {
    $('#attachedObjectRow').hidden = false;
    if (button.dataset.addObject === 'image') {
      $('#attachedObjectRow small').textContent = '3 photos';
    } else if (button.dataset.addObject === 'document') {
      $('#attachedObjectRow small').textContent = '1 document · represented here with the object grammar';
    } else {
      $('#attachedObjectRow small').textContent = '1 video · represented here with the object grammar';
    }
    scheduleSave();
  }));

  $$('[data-quick-reminder]').forEach((button) => button.addEventListener('click', () => {
    setSaveState('Saving…', `${button.dataset.quickReminder} reminder added`);
    window.setTimeout(() => setSaveState('Saved', `${button.dataset.quickReminder} · reminder linked`), 420);
  }));

  $('#repositionNote').addEventListener('click', () => {
    noteMock.animate([
      { transform: 'translate(0,0)' },
      { transform: 'translate(8px,-5px)' },
      { transform: 'translate(0,0)' },
    ], { duration: 280, easing: 'ease-out' });
  });

  $('#closeNote').addEventListener('click', () => {
    setSaveState('Saved', 'Close waits for pending local data, then hides the note');
  });

  $('#deleteNote').addEventListener('click', (event) => {
    const button = event.currentTarget;
    if (runtime.value === 'readonly') return;
    if (button.dataset.confirm === 'true') {
      button.textContent = 'Moved to Trash';
      button.disabled = true;
      setSaveState('Saved', 'Moved to Trash · reversible in All Skribs');
      return;
    }
    button.dataset.confirm = 'true';
    button.textContent = 'Move to Trash?';
  });

  $('#doneNote').addEventListener('click', () => {
    if (runtime.value === 'readonly' || runtime.value === 'attention') return;
    noteMock.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: .72, transform: 'scale(.9) translate(70px, 25px)' },
      { opacity: 0, transform: 'scale(.18) translate(220px, 40px)' },
    ], { duration: 330, easing: 'cubic-bezier(.2,.75,.25,1)' }).finished.then(() => {
      noteMock.hidden = true;
      $('#postDoneDot').hidden = false;
    });
  });

  $('#postDoneDot').addEventListener('click', () => {
    $('#postDoneDot').hidden = true;
    noteMock.hidden = false;
    noteMock.animate([{ opacity: .4, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 230, easing: 'ease-out' });
  });

  $('[data-open-attachment]', noteMock).addEventListener('click', (event) => event.currentTarget.classList.toggle('forced-fan'));
  $('#photoStackDemo').addEventListener('click', (event) => event.currentTarget.classList.toggle('forced-fan'));

  // Drawing canvas
  const drawingCanvas = $('#drawingCanvas');
  const drawingContext = drawingCanvas.getContext('2d');
  let drawing = false;
  let drawTool = 'pen';
  let drawInk = '#262923';
  let drawSize = 4;
  let lastPoint = null;
  let strokes = [];

  function pointerPoint(event) {
    const rect = drawingCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (drawingCanvas.width / rect.width),
      y: (event.clientY - rect.top) * (drawingCanvas.height / rect.height),
    };
  }

  function drawSegment(segment) {
    drawingContext.save();
    drawingContext.lineCap = 'round';
    drawingContext.lineJoin = 'round';
    drawingContext.globalCompositeOperation = segment.tool === 'eraser' ? 'destination-out' : 'source-over';
    drawingContext.globalAlpha = segment.tool === 'highlighter' ? .32 : 1;
    drawingContext.strokeStyle = segment.ink;
    drawingContext.lineWidth = segment.tool === 'eraser' ? segment.size * 3 : segment.tool === 'highlighter' ? segment.size * 2.2 : segment.size;
    drawingContext.beginPath();
    drawingContext.moveTo(segment.from.x, segment.from.y);
    drawingContext.lineTo(segment.to.x, segment.to.y);
    drawingContext.stroke();
    drawingContext.restore();
  }

  function redrawInk() {
    drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    strokes.flat().forEach(drawSegment);
  }

  drawingCanvas.addEventListener('pointerdown', (event) => {
    if (drawTool === 'select') return;
    drawing = true;
    lastPoint = pointerPoint(event);
    strokes.push([]);
    drawingCanvas.setPointerCapture(event.pointerId);
    $('.drawing-hint').hidden = true;
  });
  drawingCanvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const next = pointerPoint(event);
    const segment = { from: lastPoint, to: next, tool: drawTool, ink: drawInk, size: drawSize };
    strokes[strokes.length - 1].push(segment);
    drawSegment(segment);
    lastPoint = next;
  });
  const endDrawing = () => { drawing = false; lastPoint = null; };
  drawingCanvas.addEventListener('pointerup', endDrawing);
  drawingCanvas.addEventListener('pointercancel', endDrawing);

  function syncDrawProperties() {
    const name = $('#drawPropertyName');
    const chips = $$('.ink-chip', $('#drawingProperties'));
    const sizeLabel = $('label', $('#drawingProperties'));
    if (drawTool === 'eraser') {
      name.textContent = 'Eraser size';
      chips.forEach((chip) => { chip.hidden = true; });
      sizeLabel.hidden = false;
    } else if (drawTool === 'select') {
      name.textContent = 'Select and move strokes';
      chips.forEach((chip) => { chip.hidden = true; });
      sizeLabel.hidden = true;
    } else {
      name.textContent = `${drawTool[0].toUpperCase()}${drawTool.slice(1)} properties`;
      chips.forEach((chip) => { chip.hidden = false; });
      sizeLabel.hidden = false;
    }
  }

  $$('[data-draw-tool]').forEach((button) => button.addEventListener('click', () => {
    drawTool = button.dataset.drawTool;
    $$('[data-draw-tool]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
    syncDrawProperties();
  }));
  $$('[data-ink]').forEach((button) => button.addEventListener('click', () => {
    drawInk = button.dataset.ink;
    $$('[data-ink]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
  }));
  $('#drawSize').addEventListener('input', (event) => { drawSize = Number(event.target.value); });
  $('#clearInk').addEventListener('click', () => { strokes = []; redrawInk(); $('.drawing-hint').hidden = false; });
  $('#undoInk').addEventListener('click', () => { strokes.pop(); redrawInk(); if (!strokes.length) $('.drawing-hint').hidden = false; });

  // Calendars
  function createCalendarGrid(container, options = {}) {
    const start = new Date(Date.UTC(2026, 8, 1));
    const offset = start.getUTCDay();
    const daysInPrevMonth = 31;
    const totalCells = 42;
    for (let index = 0; index < totalCells; index += 1) {
      const relativeDay = index - offset + 1;
      const button = document.createElement('button');
      button.type = 'button';
      if (relativeDay < 1) {
        button.textContent = String(daysInPrevMonth + relativeDay);
        button.className = 'outside';
        button.dataset.day = String(relativeDay);
      } else if (relativeDay > 30) {
        button.textContent = String(relativeDay - 30);
        button.className = 'outside';
        button.dataset.day = String(relativeDay);
      } else {
        button.textContent = String(relativeDay);
        button.dataset.day = String(relativeDay);
        if (options.reminderDays?.includes(relativeDay)) button.classList.add('has-reminder');
        if (relativeDay === 4 && options.selectDay) button.classList.add('is-selected');
      }
      container.appendChild(button);
    }
  }

  const reminderGrid = $('#reminderCalendarGrid');
  createCalendarGrid(reminderGrid, { selectDay: true, reminderDays: [4, 8, 15] });
  const globalGrid = $('#globalCalendarGrid');
  createCalendarGrid(globalGrid, { selectDay: true, reminderDays: [4, 8, 15, 21] });

  function reminderSummary() {
    const selected = $('.calendar-grid button.is-selected', $('.reminder-calendar'));
    const day = selected && !selected.classList.contains('outside') ? selected.dataset.day : '4';
    $('#selectedReminderDate').textContent = `${day} September 2026`;
    $('#reminderSummary').textContent = `${day} Sep · ${$('#reminderTime').value} · ${$('#reminderRepeat').value}`;
  }

  $$('.calendar-grid button', reminderGrid).forEach((button) => button.addEventListener('click', () => {
    if (button.classList.contains('outside')) return;
    $$('.calendar-grid button', reminderGrid).forEach((candidate) => candidate.classList.remove('is-selected'));
    button.classList.add('is-selected');
    reminderSummary();
  }));
  $('#reminderTime').addEventListener('input', reminderSummary);
  $('#reminderRepeat').addEventListener('change', reminderSummary);
  $('#saveReminder').addEventListener('click', (event) => {
    event.currentTarget.textContent = 'Saved ✓';
    window.setTimeout(() => { event.currentTarget.textContent = 'Save reminder'; }, 900);
  });
  $('#prevReminderMonth').addEventListener('click', () => { $('#reminderMonthLabel').textContent = 'August 2026'; });
  $('#nextReminderMonth').addEventListener('click', () => { $('#reminderMonthLabel').textContent = 'October 2026'; });

  // Dot
  const dotDemo = $('#dotDemo');
  if (dotDemo) {
    dotDemo.addEventListener('click', (event) => {
      if (event.target.closest('.dot-dismiss')) return;
      showView('note');
    });
    $('.dot-dismiss', dotDemo).addEventListener('click', (event) => {
      event.stopPropagation();
      dotDemo.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.65)' }], { duration: 180, easing: 'ease-in' });
    });
  }

  // Rail
  $$('[data-rail-scope]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-rail-scope]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
    $('.rail-all-only').hidden = button.dataset.railScope !== 'all';
  }));
  $('#railSearch').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    $$('.rail-note-row').forEach((row) => { row.hidden = !row.dataset.railTitle.toLowerCase().includes(query); });
  });
  $$('[data-rail-action]').forEach((button) => button.addEventListener('click', (event) => {
    const row = event.currentTarget.closest('.rail-note-row');
    if (button.dataset.railAction === 'here') {
      $('#railStatus').textContent = `“${row.dataset.railTitle}” opens as the real Skrib beside the current place. The saved anchor remains unchanged.`;
      window.setTimeout(() => showView('note'), 280);
    } else {
      $('#railStatus').textContent = `Return attempts the saved application/window for “${row.dataset.railTitle}”. Exact closed URLs or paths are not promised.`;
    }
  }));
  $$('.rail-note-main').forEach((button) => button.addEventListener('click', () => showView('note')));

  // Library
  const libraryRows = $$('.library-row');
  libraryRows.forEach((button) => button.addEventListener('click', () => {
    libraryRows.forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
    $('#libraryDetailTitle').textContent = button.dataset.noteTitle;
    $('#libraryDetailContext').textContent = button.dataset.noteContext.toUpperCase();
    $('#libraryLocation').textContent = button.dataset.noteContext;
    $('#libraryPaper').textContent = button.dataset.noteCopy;
  }));
  $('#librarySearch').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    libraryRows.forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(query); });
  });
  $('#libraryReturn').addEventListener('click', (event) => {
    const original = event.currentTarget.innerHTML;
    event.currentTarget.innerHTML = 'Returning… <i class="ph ph-arrow-up-right"></i>';
    window.setTimeout(() => { event.currentTarget.innerHTML = original; }, 900);
  });
  $$('[data-library-tab]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.libraryTab === 'calendar' || button.dataset.libraryTab === 'trash') showView('calendar');
  }));

  // Account mock
  $('#accountForm').addEventListener('submit', (event) => {
    event.preventDefault();
    $('#accountFormStatus').textContent = 'Signed-in state simulated. No Skrib content was uploaded.';
  });

  // Button micro feedback for visible review affordance.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    button.classList.remove('is-clicked');
    requestAnimationFrame(() => button.classList.add('is-clicked'));
    window.setTimeout(() => button.classList.remove('is-clicked'), 150);
  });

  syncRuntime();
})();
