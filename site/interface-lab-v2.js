(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const viewCopy = {
    editor: {
      eyebrow: 'Surface 01 · Contextual',
      title: 'The Skrib should feel present, not installed.',
      description: 'Paper-like enough to feel human; restrained enough to sit beside real work all day.',
    },
    rail: {
      eyebrow: 'Surface 02 · Retrieval',
      title: 'Recall should stay close to the work that triggered it.',
      description: 'The folded Skrib and the My Skribs rail solve different jobs and should look unmistakably different.',
    },
    library: {
      eyebrow: 'Surface 03 · Management',
      title: 'All Skribs is a calm archive, not a productivity dashboard.',
      description: 'Search, read, recover, import, export, Calendar and Trash live in one normal application window.',
    },
    reminder: {
      eyebrow: 'Surface 04 · Scheduling',
      title: 'A reminder should be clear before it is saved.',
      description: 'The current Windows v0 is one-time only, with local calendar state and optional Windows notification delivery.',
    },
    system: {
      eyebrow: 'Surface 05 · Foundation',
      title: 'Refinement comes from restraint and repeatable rules.',
      description: 'The paper metaphor stays meaningful because typography, radius, elevation and colour each have a specific job.',
    },
  };

  function showView(view) {
    const next = viewCopy[view] || viewCopy.editor;
    $$('.surface-nav [data-show-view]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.showView === view);
    });
    $$('.lab-view').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.view === view));
    $('#viewEyebrow').textContent = next.eyebrow;
    $('#viewTitle').textContent = next.title;
    $('#viewDescription').textContent = next.description;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  $$('[data-show-view]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.showView));
  });

  const note = $('#noteMock');
  const noteStage = $('.editor-stage');
  const toolRow = $('#noteToolRow');
  const noteWriting = $('#noteWriting');
  const inkCanvas = $('#inkCanvas');
  const inkContext = inkCanvas.getContext('2d');
  const collapsedDot = $('#collapsedDot');
  const noteMenu = $('#noteMenu');
  const noteMore = $('#moreNote');
  const noteColors = ['yellow', 'peach', 'mint', 'sky', 'lavender'];
  let activeTool = null;
  let activeNoteColor = 'mint';

  function closeTool() {
    activeTool = null;
    toolRow.classList.remove('is-open');
    note.classList.remove('is-drawing');
    $$('[data-tool]').forEach((button) => button.classList.remove('is-active'));
    $$('[data-tool-panel]').forEach((panel) => panel.classList.remove('is-active'));
  }

  function setTool(tool) {
    if (activeTool === tool) {
      closeTool();
      return;
    }
    activeTool = tool;
    toolRow.classList.add('is-open');
    note.classList.toggle('is-drawing', tool === 'draw');
    $$('[data-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.tool === tool));
    $$('[data-tool-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.toolPanel === tool));
    if (tool === 'draw' && sizeIndex !== 2) {
      sizeIndex = 2;
      applySize(sizeIndex);
      requestAnimationFrame(resizeInkCanvas);
    }
  }

  $$('[data-tool]').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));
  $$('[data-close-tool]').forEach((button) => button.addEventListener('click', closeTool));

  $$('[data-note-color]').forEach((button) => {
    button.addEventListener('click', () => {
      activeNoteColor = button.dataset.noteColor;
      noteColors.forEach((color) => {
        note.classList.remove(`note-${color}`);
        collapsedDot.classList.remove(`note-${color}`);
      });
      note.classList.add(`note-${activeNoteColor}`);
      collapsedDot.classList.add(`note-${activeNoteColor}`);
      $$('[data-note-color]').forEach((item) => item.classList.toggle('is-selected', item === button));
    });
  });

  const sizePresets = [
    { name: 'Compact', width: 420, height: 360, next: 'Comfortable', icon: 'ph-arrows-out-simple' },
    { name: 'Comfortable', width: 520, height: 430, next: 'Canvas', icon: 'ph-arrows-out-simple' },
    { name: 'Canvas', width: 640, height: 520, next: 'Compact', icon: 'ph-arrows-in-simple' },
  ];
  let sizeIndex = 1;
  const cycleSize = $('#cycleSize');

  function applySize(index, customLabel = null) {
    const preset = sizePresets[index];
    note.style.width = `${preset.width}px`;
    note.style.height = `${preset.height}px`;
    $('#noteSizeLabel').textContent = customLabel || preset.name;
    const icon = $('i', cycleSize);
    icon.className = `ph ${preset.icon}`;
    cycleSize.title = `${preset.next} size`;
    cycleSize.setAttribute('aria-label', `${preset.next} size`);
    note.classList.add('is-resizing');
    window.setTimeout(() => note.classList.remove('is-resizing'), 180);
    requestAnimationFrame(resizeInkCanvas);
  }

  cycleSize.addEventListener('click', () => {
    sizeIndex = (sizeIndex + 1) % sizePresets.length;
    applySize(sizeIndex);
  });

  $$('[data-resize-corner]').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      note.classList.add('is-resizing');
      const corner = handle.dataset.resizeCorner;
      const start = {
        x: event.clientX,
        y: event.clientY,
        width: note.offsetWidth,
        height: note.offsetHeight,
      };

      const move = (pointerEvent) => {
        const dx = corner.includes('left') ? start.x - pointerEvent.clientX : pointerEvent.clientX - start.x;
        const dy = corner.includes('top') ? start.y - pointerEvent.clientY : pointerEvent.clientY - start.y;
        const width = Math.max(400, Math.min(680, start.width + dx));
        const height = Math.max(340, Math.min(550, start.height + dy));
        note.style.width = `${Math.round(width)}px`;
        note.style.height = `${Math.round(height)}px`;
        $('#noteSizeLabel').textContent = `${Math.round(width)} × ${Math.round(height)}`;
        resizeInkCanvas();
      };

      const stop = (pointerEvent) => {
        if (handle.hasPointerCapture(pointerEvent.pointerId)) handle.releasePointerCapture(pointerEvent.pointerId);
        note.classList.remove('is-resizing');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  });

  const attachmentIcons = {
    Image: 'ph-image',
    Video: 'ph-video-camera',
    Document: 'ph-file-text',
  };
  let attachmentCount = 0;
  $$('[data-add-attachment]').forEach((button) => {
    button.addEventListener('click', () => {
      attachmentCount += 1;
      const type = button.dataset.addAttachment;
      const extension = type === 'Image' ? 'png' : type === 'Video' ? 'mp4' : 'pdf';
      const chip = document.createElement('span');
      chip.className = 'attachment-chip is-entering';
      chip.innerHTML = `<i class="ph ${attachmentIcons[type]}"></i><span>${type.toLowerCase()}-${attachmentCount}.${extension}</span>`;
      $('#noteChips').append(chip);
    });
  });

  const reminderChip = $('#noteReminderChip');
  $$('[data-reminder-quick]').forEach((button) => {
    button.addEventListener('click', () => {
      $('span', reminderChip).textContent = `${button.dataset.reminderQuick} · 09:30`;
      reminderChip.hidden = false;
      reminderChip.classList.remove('is-entering');
      requestAnimationFrame(() => reminderChip.classList.add('is-entering'));
    });
  });
  $('button', reminderChip).addEventListener('click', () => {
    reminderChip.hidden = true;
  });
  $$('[data-open-reminder]').forEach((button) => button.addEventListener('click', () => showView('reminder')));

  let textSize = 18;
  $$('[data-text-step]').forEach((button) => {
    button.addEventListener('click', () => {
      textSize = Math.max(14, Math.min(28, textSize + Number(button.dataset.textStep)));
      noteWriting.style.fontSize = `${textSize}px`;
      $('#textSizeValue').textContent = textSize;
    });
  });

  $$('[data-text-align]').forEach((button) => {
    button.addEventListener('click', () => {
      noteWriting.style.textAlign = button.dataset.textAlign;
      $$('[data-text-align]').forEach((item) => item.classList.toggle('is-selected', item === button));
    });
  });

  noteMore.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = noteMore.getAttribute('aria-expanded') === 'true';
    noteMore.setAttribute('aria-expanded', String(!open));
    noteMenu.hidden = open;
  });
  document.addEventListener('click', (event) => {
    if (noteMenu.hidden) return;
    if (event.target.closest('#noteMenu') || event.target.closest('#moreNote')) return;
    noteMenu.hidden = true;
    noteMore.setAttribute('aria-expanded', 'false');
  });
  $$('button', noteMenu).forEach((button) => button.addEventListener('click', () => {
    noteMenu.hidden = true;
    noteMore.setAttribute('aria-expanded', 'false');
  }));

  function collapseSkrib(complete) {
    closeTool();
    note.classList.add(complete ? 'is-completing' : 'is-collapsing');
    window.setTimeout(() => {
      note.hidden = true;
      note.classList.remove('is-completing', 'is-collapsing');
      collapsedDot.hidden = false;
      collapsedDot.classList.remove('is-entering');
      requestAnimationFrame(() => collapsedDot.classList.add('is-entering'));
    }, 150);
  }

  $('#collapseNote').addEventListener('click', () => collapseSkrib(false));
  $('#doneNote').addEventListener('click', () => collapseSkrib(true));
  collapsedDot.addEventListener('click', () => {
    collapsedDot.hidden = true;
    note.hidden = false;
    note.classList.remove('is-entering');
    requestAnimationFrame(() => note.classList.add('is-entering'));
  });

  function makeDraggable(handle, surface, stage) {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const stageRect = stage.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const start = {
        x: event.clientX,
        y: event.clientY,
        left: surfaceRect.left - stageRect.left,
        top: surfaceRect.top - stageRect.top,
      };
      surface.style.position = 'absolute';
      surface.style.left = `${start.left}px`;
      surface.style.top = `${start.top}px`;
      surface.style.right = 'auto';
      surface.style.transform = 'none';
      handle.setPointerCapture(event.pointerId);

      const move = (pointerEvent) => {
        const left = Math.max(10, Math.min(stageRect.width - surface.offsetWidth - 10, start.left + pointerEvent.clientX - start.x));
        const top = Math.max(10, Math.min(stageRect.height - surface.offsetHeight - 10, start.top + pointerEvent.clientY - start.y));
        surface.style.left = `${Math.round(left)}px`;
        surface.style.top = `${Math.round(top)}px`;
      };

      const stop = (pointerEvent) => {
        if (handle.hasPointerCapture(pointerEvent.pointerId)) handle.releasePointerCapture(pointerEvent.pointerId);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  }
  makeDraggable($('.drag-grip'), note, noteStage);

  let drawMode = 'pen';
  let strokeWidth = 2;
  let inkColor = '#262923';
  let drawing = false;
  let lastPoint = null;

  function resizeInkCanvas() {
    const rect = inkCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    const snapshot = document.createElement('canvas');
    snapshot.width = inkCanvas.width;
    snapshot.height = inkCanvas.height;
    if (snapshot.width && snapshot.height) snapshot.getContext('2d').drawImage(inkCanvas, 0, 0);
    inkCanvas.width = Math.round(rect.width * ratio);
    inkCanvas.height = Math.round(rect.height * ratio);
    inkContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (snapshot.width && snapshot.height) {
      inkContext.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, rect.width, rect.height);
    }
  }

  $$('[data-draw-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      drawMode = button.dataset.drawMode;
      $$('[data-draw-mode]').forEach((item) => item.classList.toggle('is-selected', item === button));
    });
  });

  const strokes = [
    { label: 'Thin', width: 2 },
    { label: 'Medium', width: 5 },
    { label: 'Thick', width: 9 },
  ];
  let strokeIndex = 0;
  $('#cycleStroke').addEventListener('click', () => {
    strokeIndex = (strokeIndex + 1) % strokes.length;
    strokeWidth = strokes[strokeIndex].width;
    $('#strokeLabel').textContent = strokes[strokeIndex].label;
    $('.stroke-preview').style.height = `${Math.min(5, strokeWidth)}px`;
  });

  $$('[data-ink-color]').forEach((button) => {
    button.addEventListener('click', () => {
      inkColor = button.dataset.inkColor;
      $$('[data-ink-color]').forEach((item) => item.classList.toggle('is-selected', item === button));
    });
  });

  $('#clearInk').addEventListener('click', () => {
    inkContext.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
  });

  function pointFromEvent(event) {
    const rect = inkCanvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  inkCanvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    lastPoint = pointFromEvent(event);
    inkCanvas.setPointerCapture(event.pointerId);
  });
  inkCanvas.addEventListener('pointermove', (event) => {
    if (!drawing || !lastPoint) return;
    const point = pointFromEvent(event);
    inkContext.beginPath();
    inkContext.moveTo(lastPoint.x, lastPoint.y);
    inkContext.lineTo(point.x, point.y);
    inkContext.lineCap = 'round';
    inkContext.lineJoin = 'round';
    inkContext.lineWidth = drawMode === 'highlight' ? strokeWidth * 3 : strokeWidth;
    inkContext.strokeStyle = drawMode === 'highlight' ? 'rgba(248, 203, 65, 0.48)' : inkColor;
    inkContext.globalCompositeOperation = drawMode === 'erase' ? 'destination-out' : 'source-over';
    inkContext.stroke();
    lastPoint = point;
  });
  const stopDrawing = () => {
    drawing = false;
    lastPoint = null;
  };
  inkCanvas.addEventListener('pointerup', stopDrawing);
  inkCanvas.addEventListener('pointercancel', stopDrawing);
  new ResizeObserver(resizeInkCanvas).observe($('#noteCanvas'));

  const notes = {
    'target-close': {
      title: 'Target-close smoke test',
      location: 'Chrome · GitHub — Ankit6149/skribly',
      libraryContext: 'CHROME · GITHUB',
      app: 'Chrome',
      preview: 'Verify target capture before closing the note workflow.',
      color: 'mint',
    },
    'interface-plan': {
      title: 'Refine the interface language',
      location: 'ChatGPT — Skribli build',
      libraryContext: 'CHATGPT',
      app: 'ChatGPT',
      preview: 'Reduce visual noise without losing the tactile paper identity.',
      color: 'peach',
    },
    'release-list': {
      title: 'Release-readiness list',
      location: 'GitHub — skribly issues',
      libraryContext: 'CHROME · GITHUB',
      app: 'Chrome',
      preview: 'Keep product truth and native validation ahead of public release.',
      color: 'yellow',
    },
    'token-pass': {
      title: 'Clean the visual tokens',
      location: 'context-rail.css — skribly',
      libraryContext: 'VISUAL STUDIO CODE',
      app: 'Visual Studio Code',
      preview: 'Consolidate spacing, radii and control states before porting surfaces.',
      color: 'sky',
    },
    'release-check': {
      title: 'Validate the Windows build',
      location: 'skribly — Visual Studio Code',
      libraryContext: 'VISUAL STUDIO CODE',
      app: 'Visual Studio Code',
      preview: 'Run exact native checks against the release candidate before reopening downloads.',
      color: 'lavender',
    },
    documents: {
      title: 'Licence documents',
      location: 'Documents — File Explorer',
      libraryContext: 'FILE EXPLORER',
      app: 'File Explorer',
      preview: 'Keep the customer-facing licence and support documents together.',
      color: 'peach',
    },
  };

  const rail = $('#railMock');
  const railStage = $('.rail-stage');
  const railGrip = $('#railDragHandle');
  let railY = 18;

  function clampRailY(value) {
    const stageHeight = railStage.getBoundingClientRect().height;
    const max = Math.max(18, stageHeight - rail.offsetHeight - 18);
    return Math.max(18, Math.min(max, value));
  }

  railGrip.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const start = { y: event.clientY, railY };
    rail.classList.add('is-dragging');
    railGrip.setPointerCapture(event.pointerId);

    const move = (pointerEvent) => {
      railY = clampRailY(start.railY + pointerEvent.clientY - start.y);
      rail.style.setProperty('--rail-y', `${railY}px`);
      rail.style.setProperty('--rail-drag-x', `${Math.max(-22, Math.min(8, pointerEvent.clientX - event.clientX))}px`);
    };
    const stop = (pointerEvent) => {
      if (railGrip.hasPointerCapture(pointerEvent.pointerId)) railGrip.releasePointerCapture(pointerEvent.pointerId);
      rail.classList.remove('is-dragging');
      rail.style.setProperty('--rail-drag-x', '0px');
      railGrip.removeEventListener('pointermove', move);
      railGrip.removeEventListener('pointerup', stop);
      railGrip.removeEventListener('pointercancel', stop);
    };
    railGrip.addEventListener('pointermove', move);
    railGrip.addEventListener('pointerup', stop);
    railGrip.addEventListener('pointercancel', stop);
  });

  function setRailOpen(open) {
    rail.classList.toggle('is-open', open);
    $('#globalRailPill').classList.toggle('is-rail-open', open);
  }
  $('#globalRailPill').addEventListener('click', () => setRailOpen(true));
  $('#collapseRail').addEventListener('click', () => setRailOpen(false));

  $$('[data-rail-scope]').forEach((button) => {
    button.addEventListener('click', () => {
      const all = button.dataset.railScope === 'all';
      $$('[data-rail-scope]').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      $$('.all-only').forEach((group) => {
        group.hidden = !all;
      });
    });
  });
  $$('.all-only').forEach((group) => {
    group.hidden = true;
  });

  function selectRailNote(button) {
    $$('.rail-row').forEach((row) => row.classList.toggle('is-selected', row === button));
    const selected = notes[button.dataset.noteId];
    $('#railLocation').textContent = selected.location;
    $('#railPreviewText').textContent = selected.preview;
    const inspector = $('#railInspector');
    noteColors.forEach((color) => inspector.classList.remove(`note-${color}`));
    inspector.classList.add(`note-${selected.color}`);
    setRailOpen(true);
  }
  $$('.rail-row').forEach((button) => button.addEventListener('click', () => selectRailNote(button)));

  const railSearch = $('#railSearch');
  const railSearchInput = $('input', railSearch);
  $('#railSearchToggle').addEventListener('click', () => {
    railSearch.hidden = false;
    railSearchInput.focus();
  });
  $('button', railSearch).addEventListener('click', () => {
    railSearchInput.value = '';
    railSearch.hidden = true;
    $$('.rail-row').forEach((row) => {
      row.hidden = false;
    });
  });
  railSearchInput.addEventListener('input', () => {
    const query = railSearchInput.value.trim().toLowerCase();
    $$('.rail-row').forEach((row) => {
      row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query);
    });
  });

  let toastTimer = null;
  function showToast(element, message) {
    if (toastTimer) window.clearTimeout(toastTimer);
    $('span', element).textContent = message;
    element.hidden = false;
    toastTimer = window.setTimeout(() => {
      element.hidden = true;
    }, 2200);
  }

  $('#readRailNote').addEventListener('click', () => showToast($('#railToast'), 'Full preview stays inside My Skribs'));
  $('#openRailContext').addEventListener('click', () => showToast($('#railToast'), 'Open original is an explicit context action'));

  function selectLibraryNote(button) {
    $$('[data-library-note]').forEach((item) => item.classList.toggle('is-selected', item === button));
    const selected = notes[button.dataset.libraryNote];
    $('#libraryContext').textContent = selected.libraryContext;
    $('#libraryTitle').textContent = selected.title;
    $('#libraryLocation').textContent = selected.location.replace(`${selected.app} · `, '');
    $('#libraryApp').textContent = selected.app;
    const paper = $('#libraryPaper');
    paper.textContent = selected.preview;
    noteColors.forEach((color) => paper.classList.remove(`note-${color}`));
    paper.classList.add(`note-${selected.color}`);
  }
  $$('[data-library-note]').forEach((button) => button.addEventListener('click', () => selectLibraryNote(button)));

  const calendarDays = $('#calendarDays');
  const days = [31, ...Array.from({ length: 30 }, (_, index) => index + 1), 1, 2, 3, 4];
  let reminderDay = 8;
  let reminderHour = 9;
  let reminderMinute = 30;

  function updateReminderSummary() {
    const date = new Date(2026, 8, reminderDay);
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const time = `${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}`;
    $('#reminderTime').textContent = time;
    $('#reminderSummary').textContent = `${weekday}, ${reminderDay} September at ${time}`;
  }

  days.forEach((day, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day;
    const outside = index === 0 || index > 30;
    if (outside) button.classList.add('is-outside');
    if (!outside && day === reminderDay) button.classList.add('is-selected');
    if (!outside) {
      button.addEventListener('click', () => {
        reminderDay = day;
        $$('.calendar-days button').forEach((item) => item.classList.remove('is-selected'));
        button.classList.add('is-selected');
        updateReminderSummary();
      });
    }
    calendarDays.append(button);
  });

  $$('[data-time-step]').forEach((button) => {
    button.addEventListener('click', () => {
      reminderHour = button.dataset.timeStep === 'hour-up'
        ? (reminderHour + 1) % 24
        : (reminderHour + 23) % 24;
      updateReminderSummary();
    });
  });

  $('#saveReminder').addEventListener('click', () => {
    const button = $('#saveReminder');
    button.innerHTML = '<i class="ph ph-check-circle"></i> Saved';
    showToast($('#reminderToast'), 'Reminder saved locally');
    window.setTimeout(() => {
      button.innerHTML = '<i class="ph ph-check"></i> Save reminder';
    }, 1000);
  });

  window.addEventListener('resize', () => {
    railY = clampRailY(railY);
    rail.style.setProperty('--rail-y', `${railY}px`);
    resizeInkCanvas();
  });

  applySize(sizeIndex);
  resizeInkCanvas();
  updateReminderSummary();
  setRailOpen(true);
})();
