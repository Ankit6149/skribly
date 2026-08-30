(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const viewCopy = {
    editor: ['Surface 01 · Note editor', 'A focused canvas with tools that make room.'],
    rail: ['Surface 02 · Pill and rail', 'Notes stay visible, grouped, and anchored to a real place.'],
    library: ['Surface 03 · All Skribs', 'A quiet library built for reading before reopening.'],
    reminder: ['Surface 04 · Reminder flow', 'Scheduling is explicit, readable, and hard to mis-set.'],
    system: ['Surface 05 · Interaction map', 'Every primary click has one predictable result.'],
  };

  function showView(view) {
    $$('.lab-surface-nav button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.showView === view);
    });
    $$('.lab-view').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.view === view));
    const copy = viewCopy[view] || viewCopy.editor;
    $('#viewEyebrow').textContent = copy[0];
    $('#viewTitle').textContent = copy[1];
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  $$('[data-show-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.showView)));

  $$('.view-notes').forEach((panel) => {
    panel.classList.add('is-collapsed');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'view-notes-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span><i class="ph ph-info"></i> Design notes</span><i class="ph ph-caret-down"></i>';
    panel.prepend(toggle);
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      panel.classList.toggle('is-collapsed', expanded);
    });
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.classList.contains('resize-handle')) return;
    button.classList.remove('is-clicked');
    requestAnimationFrame(() => button.classList.add('is-clicked'));
    window.setTimeout(() => button.classList.remove('is-clicked'), 150);
  });

  const noteMock = $('#noteMock');
  const toolTray = $('#noteToolTray');
  const inkCanvas = $('#inkCanvas');
  const noteWriting = $('#noteWriting');
  let activeTool = 'attach';

  function setTool(tool, forceOpen = true) {
    const isAlreadyOpen = activeTool === tool && !noteMock.classList.contains('tray-closed');
    const shouldOpen = forceOpen ? true : !isAlreadyOpen;
    activeTool = tool;
    noteMock.classList.toggle('tray-closed', !shouldOpen);
    toolTray.classList.toggle('is-open', shouldOpen);
    noteMock.classList.toggle('is-drawing', shouldOpen && tool === 'draw');
    $$('[data-tool]').forEach((button) => button.classList.toggle('is-active', shouldOpen && button.dataset.tool === tool));
    $$('[data-tool-panel]').forEach((panel) => panel.classList.toggle('is-active', shouldOpen && panel.dataset.toolPanel === tool));
    if (tool === 'draw' && shouldOpen) resizeInkCanvas();
  }

  $$('[data-tool]').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool, false)));
  $$('[data-close-tray]').forEach((button) => button.addEventListener('click', () => {
    noteMock.classList.add('tray-closed');
    toolTray.classList.remove('is-open');
    noteMock.classList.remove('is-drawing');
    $$('[data-tool]').forEach((item) => item.classList.remove('is-active'));
  }));

  const noteColors = ['yellow', 'peach', 'mint', 'sky', 'lavender'];
  $$('[data-note-color]').forEach((button) => button.addEventListener('click', () => {
    noteColors.forEach((color) => noteMock.classList.remove(`note-${color}`));
    noteMock.classList.add(`note-${button.dataset.noteColor}`);
    $$('[data-note-color]').forEach((item) => item.classList.toggle('is-selected', item === button));
    noteMock.classList.remove('is-color-changing');
    requestAnimationFrame(() => noteMock.classList.add('is-color-changing'));
    window.setTimeout(() => noteMock.classList.remove('is-color-changing'), 190);
  }));

  const sizePresets = [
    { name: 'Comfortable', width: 520, height: 430, icon: 'ph-arrows-out-simple', label: 'Increase to canvas' },
    { name: 'Canvas', width: 640, height: 540, icon: 'ph-arrows-in-simple', label: 'Compact note' },
    { name: 'Compact', width: 420, height: 360, icon: 'ph-arrows-out-simple', label: 'Increase to comfortable' },
  ];
  let sizeIndex = 0;
  const cycleSize = $('#cycleSize');

  function applySize(index, custom = false) {
    const preset = sizePresets[index];
    noteMock.style.width = `${preset.width}px`;
    noteMock.style.height = `${preset.height}px`;
    noteMock.classList.remove('size-comfortable', 'size-canvas', 'size-compact');
    noteMock.classList.add(`size-${preset.name.toLowerCase()}`);
    $('#noteSizeLabel').textContent = `${custom ? 'Custom' : preset.name} · drag a corner`;
    const icon = $('i', cycleSize);
    icon.className = `ph ${preset.icon}`;
    cycleSize.title = preset.label;
    cycleSize.setAttribute('aria-label', preset.label);
    noteMock.classList.add('is-resizing');
    window.setTimeout(() => noteMock.classList.remove('is-resizing'), 200);
    requestAnimationFrame(resizeInkCanvas);
  }

  cycleSize.addEventListener('click', () => {
    sizeIndex = (sizeIndex + 1) % sizePresets.length;
    applySize(sizeIndex);
  });

  $$('[data-resize-corner]').forEach((handle) => {
    let didDrag = false;
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      didDrag = false;
      noteMock.classList.add('is-resizing');
      handle.setPointerCapture(event.pointerId);
      const start = { x: event.clientX, y: event.clientY, width: noteMock.offsetWidth, height: noteMock.offsetHeight };
      const corner = handle.dataset.resizeCorner;

      function move(pointerEvent) {
        const horizontal = corner.includes('left') ? start.x - pointerEvent.clientX : pointerEvent.clientX - start.x;
        const vertical = corner.includes('top') ? start.y - pointerEvent.clientY : pointerEvent.clientY - start.y;
        if (Math.abs(horizontal) > 2 || Math.abs(vertical) > 2) didDrag = true;
        const width = Math.max(400, Math.min(680, start.width + horizontal));
        const height = Math.max(340, Math.min(560, start.height + vertical));
        noteMock.style.width = `${Math.round(width)}px`;
        noteMock.style.height = `${Math.round(height)}px`;
        $('#noteSizeLabel').textContent = `Custom · ${Math.round(width)} × ${Math.round(height)}`;
        resizeInkCanvas();
      }

      function stop(pointerEvent) {
        handle.releasePointerCapture(pointerEvent.pointerId);
        window.setTimeout(() => noteMock.classList.remove('is-resizing'), 120);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      }

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });

    handle.addEventListener('click', () => {
      if (didDrag) {
        didDrag = false;
        return;
      }
      const grows = handle.dataset.resizeCorner === 'bottom-right';
      const width = Math.max(400, Math.min(680, noteMock.offsetWidth + (grows ? 16 : -16)));
      const height = Math.max(340, Math.min(560, noteMock.offsetHeight + (grows ? 16 : -16)));
      noteMock.style.width = `${width}px`;
      noteMock.style.height = `${height}px`;
      $('#noteSizeLabel').textContent = `Custom · ${width} × ${height}`;
      noteMock.classList.add('is-resizing');
      window.setTimeout(() => noteMock.classList.remove('is-resizing'), 180);
      resizeInkCanvas();
    });
  });

  const attachmentIcons = { Image: 'ph-image', Video: 'ph-video-camera', Document: 'ph-file-text', Link: 'ph-link' };
  let attachmentCount = 0;
  $$('[data-add-attachment]').forEach((button) => button.addEventListener('click', () => {
    attachmentCount += 1;
    const type = button.dataset.addAttachment;
    const chip = document.createElement('span');
    chip.className = 'attachment-chip';
    chip.innerHTML = `<i class="ph ${attachmentIcons[type]}"></i>${type.toLowerCase()}-${attachmentCount}.${type === 'Image' ? 'png' : type === 'Video' ? 'mp4' : type === 'Link' ? 'url' : 'pdf'}`;
    $('#noteChips').append(chip);
    chip.classList.add('is-entering');
  }));

  const noteReminderChip = $('#noteReminderChip');
  $$('[data-reminder-quick]').forEach((button) => button.addEventListener('click', () => {
    $('span', noteReminderChip).textContent = `${button.dataset.reminderQuick} · 09:30`;
    noteReminderChip.hidden = false;
    noteReminderChip.classList.remove('is-entering');
    requestAnimationFrame(() => noteReminderChip.classList.add('is-entering'));
  }));
  $('button', noteReminderChip).addEventListener('click', () => { noteReminderChip.hidden = true; });

  let textSize = 18;
  $$('[data-text-step]').forEach((button) => button.addEventListener('click', () => {
    textSize = Math.max(14, Math.min(28, textSize + Number(button.dataset.textStep)));
    noteWriting.style.fontSize = `${textSize}px`;
    $('#textSizeValue').textContent = textSize;
  }));
  $$('[data-text-align]').forEach((button) => button.addEventListener('click', () => {
    noteWriting.style.textAlign = button.dataset.textAlign;
    $$('[data-text-align]').forEach((item) => item.classList.toggle('is-selected', item === button));
  }));

  const noteMore = $('#moreNote');
  const noteMoreMenu = $('#noteMoreMenu');
  noteMore.addEventListener('click', () => {
    const isOpen = noteMore.getAttribute('aria-expanded') === 'true';
    noteMore.setAttribute('aria-expanded', String(!isOpen));
    noteMoreMenu.hidden = isOpen;
  });
  $$('button', noteMoreMenu).forEach((button) => button.addEventListener('click', () => {
    noteMore.setAttribute('aria-expanded', 'false');
    noteMoreMenu.hidden = true;
  }));

  const collapsedDot = $('#collapsedDot');
  function collapseEditor(complete = false) {
    noteMock.classList.add(complete ? 'is-completing' : 'is-collapsing');
    window.setTimeout(() => {
      noteMock.hidden = true;
      noteMock.classList.remove('is-collapsing', 'is-completing');
      collapsedDot.hidden = false;
      collapsedDot.classList.remove('is-entering');
      requestAnimationFrame(() => collapsedDot.classList.add('is-entering'));
    }, 150);
  }
  $('#collapseNote').addEventListener('click', () => collapseEditor(false));
  $('#closeNote').addEventListener('click', () => collapseEditor(false));
  $('#doneNote').addEventListener('click', () => collapseEditor(true));
  let dotDragged = false;
  collapsedDot.addEventListener('click', () => {
    if (dotDragged) {
      dotDragged = false;
      return;
    }
    collapsedDot.hidden = true;
    noteMock.hidden = false;
    noteMock.classList.remove('is-entering');
    requestAnimationFrame(() => noteMock.classList.add('is-entering'));
    window.setTimeout(() => noteMock.classList.remove('is-entering'), 190);
  });

  const editorStage = $('.editor-stage');
  function makeDraggable(handle, surface, isDot = false) {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const stageRect = editorStage.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const start = { x: event.clientX, y: event.clientY, left: surfaceRect.left - stageRect.left, top: surfaceRect.top - stageRect.top };
      let moved = false;
      surface.style.position = 'absolute';
      surface.style.right = 'auto';
      surface.style.marginTop = '0';
      surface.style.transform = 'none';
      surface.style.left = `${start.left}px`;
      surface.style.top = `${start.top}px`;
      handle.setPointerCapture(event.pointerId);

      function move(pointerEvent) {
        const dx = pointerEvent.clientX - start.x;
        const dy = pointerEvent.clientY - start.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        const left = Math.max(10, Math.min(stageRect.width - surface.offsetWidth - 10, start.left + dx));
        const top = Math.max(10, Math.min(stageRect.height - surface.offsetHeight - 10, start.top + dy));
        surface.style.left = `${Math.round(left)}px`;
        surface.style.top = `${Math.round(top)}px`;
      }

      function stop(pointerEvent) {
        handle.releasePointerCapture(pointerEvent.pointerId);
        if (isDot && moved) dotDragged = true;
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      }

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  }
  makeDraggable($('.note-drag', noteMock), noteMock);
  makeDraggable(collapsedDot, collapsedDot, true);

  let drawMode = 'pen';
  let strokeWidth = 2;
  let drawing = false;
  let lastPoint = null;
  const inkContext = inkCanvas.getContext('2d');

  function resizeInkCanvas() {
    const rect = inkCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    if (!rect.width || !rect.height) return;
    const snapshot = document.createElement('canvas');
    snapshot.width = inkCanvas.width;
    snapshot.height = inkCanvas.height;
    snapshot.getContext('2d').drawImage(inkCanvas, 0, 0);
    inkCanvas.width = Math.round(rect.width * ratio);
    inkCanvas.height = Math.round(rect.height * ratio);
    inkContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (snapshot.width && snapshot.height) inkContext.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, rect.width, rect.height);
  }

  $$('[data-draw-mode]').forEach((button) => button.addEventListener('click', () => {
    drawMode = button.dataset.drawMode;
    $$('[data-draw-mode]').forEach((item) => item.classList.toggle('is-selected', item === button));
    inkCanvas.style.cursor = drawMode === 'select' ? 'default' : 'crosshair';
  }));
  const strokeOptions = [
    { name: 'Thin', value: 2, key: 'thin' },
    { name: 'Medium', value: 5, key: 'medium' },
    { name: 'Thick', value: 9, key: 'thick' },
  ];
  let strokeIndex = 0;
  $('#cycleStroke').addEventListener('click', () => {
    strokeIndex = (strokeIndex + 1) % strokeOptions.length;
    const option = strokeOptions[strokeIndex];
    strokeWidth = option.value;
    $('#strokeLabel').textContent = option.name;
    $('#cycleStroke').dataset.size = option.key;
    $('#cycleStroke').setAttribute('aria-label', `Stroke size: ${option.name.toLowerCase()}`);
  });
  $('#clearInk').addEventListener('click', () => inkContext.clearRect(0, 0, inkCanvas.width, inkCanvas.height));

  function pointFromEvent(event) {
    const rect = inkCanvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  inkCanvas.addEventListener('pointerdown', (event) => {
    if (drawMode === 'select') return;
    drawing = true;
    lastPoint = pointFromEvent(event);
    inkCanvas.setPointerCapture(event.pointerId);
  });
  inkCanvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const point = pointFromEvent(event);
    inkContext.beginPath();
    inkContext.moveTo(lastPoint.x, lastPoint.y);
    inkContext.lineTo(point.x, point.y);
    inkContext.lineCap = 'round';
    inkContext.lineJoin = 'round';
    inkContext.lineWidth = drawMode === 'highlight' ? strokeWidth * 3 : strokeWidth;
    inkContext.strokeStyle = drawMode === 'highlight' ? 'rgba(248, 203, 65, 0.5)' : '#262923';
    inkContext.globalCompositeOperation = drawMode === 'erase' ? 'destination-out' : 'source-over';
    inkContext.stroke();
    lastPoint = point;
  });
  function stopDrawing() { drawing = false; lastPoint = null; }
  inkCanvas.addEventListener('pointerup', stopDrawing);
  inkCanvas.addEventListener('pointercancel', stopDrawing);
  new ResizeObserver(resizeInkCanvas).observe($('#noteCanvas'));

  const notes = {
    'target-close': { title: 'v0.1.12 target-close smoke', location: 'GitHub › skribly › Issue #168', app: 'Chrome · GitHub', color: 'mint' },
    'interface-plan': { title: 'Plan note and rail refinement', location: 'ChatGPT › Skribli build', app: 'ChatGPT · Skribli build', color: 'peach' },
    'payment-list': { title: 'Payment readiness list', location: 'Notion › Launch plan', app: 'Notion · Launch plan', color: 'yellow' },
    'token-pass': { title: 'Token cleanup', location: 'skribly › context-rail.css', app: 'VS Code · skribly', color: 'sky' },
    'release-check': { title: 'Release check', location: 'skribly › v0.1.14', app: 'VS Code · skribly', color: 'lavender' },
    'invoice-folder': { title: 'Licence documents', location: 'Documents › Skribli › Finance', app: 'File Explorer · Documents', color: 'peach' },
  };

  const railMock = $('#railMock');
  function setRailOpen(open) {
    railMock.classList.toggle('is-open', open);
    railMock.classList.add('is-settling');
    window.setTimeout(() => railMock.classList.remove('is-settling'), 190);
    $('#globalRailPill').classList.toggle('is-rail-open', open);
  }
  $('#globalRailPill').addEventListener('click', () => setRailOpen(true));
  $('#collapseRail').addEventListener('click', () => setRailOpen(false));

  $$('[data-rail-scope]').forEach((button) => button.addEventListener('click', () => {
    const isAll = button.dataset.railScope === 'all';
    $$('[data-rail-scope]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', String(selected));
    });
    $$('.all-only').forEach((group) => group.hidden = !isAll);
  }));
  $$('.all-only').forEach((group) => group.hidden = true);

  function selectRailNote(button) {
    $$('.rail-note-row').forEach((row) => row.classList.toggle('is-selected', row === button));
    const note = notes[button.dataset.noteId];
    const inspector = $('#railInspector');
    noteColors.forEach((color) => inspector.classList.remove(`note-${color}`));
    inspector.classList.add(`note-${note.color}`);
    $('.rail-inspector-location', inspector).innerHTML = `<i class="ph ph-map-pin"></i> ${note.location}`;
    $('p', inspector).textContent = note.title;
    inspector.classList.remove('is-refreshing');
    requestAnimationFrame(() => inspector.classList.add('is-refreshing'));
    window.setTimeout(() => inspector.classList.remove('is-refreshing'), 180);
    setRailOpen(true);
  }
  $$('.rail-note-row').forEach((button) => button.addEventListener('click', () => selectRailNote(button)));

  const railSearch = $('#railSearch');
  const railSearchInput = $('input', railSearch);
  $('#railSearchToggle').addEventListener('click', () => {
    railSearch.hidden = false;
    railSearchInput.focus();
  });
  $('button', railSearch).addEventListener('click', () => {
    railSearchInput.value = '';
    railSearch.hidden = true;
    $$('.rail-note-row').forEach((row) => row.hidden = false);
  });
  railSearchInput.addEventListener('input', () => {
    const query = railSearchInput.value.toLowerCase().trim();
    $$('.rail-note-row').forEach((row) => row.hidden = query && !row.textContent.toLowerCase().includes(query));
  });

  let toastTimer;
  function showToast(element, text) {
    clearTimeout(toastTimer);
    $('span', element).textContent = text;
    element.hidden = false;
    toastTimer = setTimeout(() => { element.hidden = true; }, 2600);
  }
  $('#readRailNote').addEventListener('click', () => showToast($('#railToast'), 'Reading in the rail · it stays pinned'));
  $('#openRailContext').addEventListener('click', () => showToast($('#railToast'), 'Original location opened · rail stays pinned'));

  $$('[data-library-note]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-library-note]').forEach((item) => item.classList.toggle('is-selected', item === button));
    const note = notes[button.dataset.libraryNote];
    $('#libraryTitle').textContent = note.title;
    $('#libraryLocation').textContent = note.location;
    const paper = $('#libraryPaper');
    paper.textContent = note.title;
    noteColors.forEach((color) => paper.classList.remove(`note-${color}`));
    paper.classList.add(`note-${note.color}`);
    const detail = $('.library-detail');
    detail.classList.remove('is-refreshing');
    requestAnimationFrame(() => detail.classList.add('is-refreshing'));
    window.setTimeout(() => detail.classList.remove('is-refreshing'), 180);
  }));

  const calendarDays = $('#calendarDays');
  const days = [31, ...Array.from({ length: 30 }, (_, index) => index + 1), 1, 2, 3, 4];
  days.forEach((day, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day;
    if (index === 0 || index > 30) button.classList.add('is-outside');
    if (day === 8 && index === 8) button.classList.add('is-selected');
    if (index > 0 && index <= 30) {
      button.addEventListener('click', () => {
        $$('.calendar-days button').forEach((item) => item.classList.remove('is-selected'));
        button.classList.add('is-selected');
        updateReminderSummary(day);
      });
    }
    calendarDays.append(button);
  });

  let reminderHour = 9;
  let reminderMinute = 30;
  let reminderDay = 8;
  let repeatValue = 'once';
  function updateReminderSummary(day = reminderDay) {
    reminderDay = day;
    const date = new Date(2026, 8, reminderDay);
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const time = `${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}`;
    $('#reminderTime').textContent = time;
    $('#reminderSummary').textContent = `${weekday}, ${reminderDay} September at ${time} · ${repeatValue}`;
  }
  $$('[data-time-step]').forEach((button) => button.addEventListener('click', () => {
    reminderHour = button.dataset.timeStep === 'hour-up' ? (reminderHour + 1) % 24 : (reminderHour + 23) % 24;
    updateReminderSummary();
  }));
  $$('.repeat-options button').forEach((button) => button.addEventListener('click', () => {
    $$('.repeat-options button').forEach((item) => item.classList.toggle('is-active', item === button));
    repeatValue = button.textContent.trim().toLowerCase();
    updateReminderSummary();
  }));
  $('#saveReminder').addEventListener('click', () => {
    const button = $('#saveReminder');
    button.classList.add('is-success');
    button.innerHTML = '<i class="ph ph-check-circle"></i> Saved';
    showToast($('#reminderToast'), 'Reminder added to the note');
    window.setTimeout(() => {
      button.classList.remove('is-success');
      button.innerHTML = '<i class="ph ph-check"></i> Save reminder';
    }, 1200);
  });

  window.addEventListener('resize', resizeInkCanvas);
  setRailOpen(true);
  applySize(0);
  updateReminderSummary();
})();
