(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = $('#toast');
  let toastTimer;
  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
  }

  function showStudio(name) {
    $$('[data-studio-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.studioPanel === name));
    $$('[data-studio]').forEach((button) => button.classList.toggle('is-active', button.dataset.studio === name));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  $$('[data-studio]').forEach((button) => button.addEventListener('click', () => showStudio(button.dataset.studio)));

  function showNoteView(name) {
    $$('[data-note-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.notePanel === name));
    $$('[data-note-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.noteView === name));
    window.scrollTo({ top: 66, behavior: 'auto' });
  }
  $$('[data-note-view]').forEach((button) => button.addEventListener('click', () => showNoteView(button.dataset.noteView)));
  $$('[data-note-jump]').forEach((button) => button.addEventListener('click', () => showNoteView(button.dataset.noteJump)));

  function showScreen(name) {
    $$('[data-screen-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.screenPanel === name));
    $$('[data-screen]').forEach((button) => button.classList.toggle('is-active', button.dataset.screen === name));
  }
  $$('[data-screen]').forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screen)));

  const scale = $('#scaleSelect');
  const runtime = $('#runtimeSelect');
  scale?.addEventListener('change', () => {
    document.body.classList.remove('scale-125', 'scale-150');
    if (scale.value === '125%') document.body.classList.add('scale-125');
    if (scale.value === '150%') document.body.classList.add('scale-150');
  });
  runtime?.addEventListener('change', () => {
    document.body.classList.remove('runtime-offline', 'runtime-readonly', 'runtime-attention');
    if (runtime.value !== 'normal') document.body.classList.add(`runtime-${runtime.value}`);
    notify({ normal: 'Normal runtime restored.', offline: 'Offline account path simulated; local note UI remains available.', readonly: 'Read-only local data state simulated.', attention: 'Needs-attention save state simulated.' }[runtime.value]);
  });

  const everydayToolPanel = $('#everydayToolPanel');
  $$('[data-tool]').forEach((button) => button.addEventListener('click', () => {
    if (!everydayToolPanel) return;
    const tool = button.dataset.tool;
    const wasActive = button.classList.contains('is-active');
    $$('[data-tool]').forEach((candidate) => candidate.classList.remove('is-active'));
    if (wasActive) { everydayToolPanel.hidden = true; return; }
    button.classList.add('is-active');
    everydayToolPanel.hidden = false;
    const content = {
      attach: '<b>Attach</b> · Photo · Document · Video',
      draw: '<b>Draw</b> · Open the expanded Drawing state without cramming controls into the compact note.',
      remind: '<b>Remind</b> · Later today · Tomorrow · Custom…',
      color: '<b>Color</b> · Yellow · Peach · Mint · Sky · Lavender',
      text: '<b>Text</b> · Small · Medium · Large',
    };
    everydayToolPanel.innerHTML = content[tool];
  }));

  $$('.show-actions button,.object-actions button').forEach((button) => button.addEventListener('click', () => {
    const label = button.textContent.trim();
    if (label === 'Remove') {
      const object = button.closest('.media-object') || button.closest('.attachment-showcase > article');
      if (object) object.style.opacity = '.32';
      notify('Attachment removed in the review specimen.');
      return;
    }
    notify(`${label} interaction previewed.`);
  }));

  function buildDates(container, selectedDay = 4, reminderDays = [4, 8, 15]) {
    if (!container || container.children.length) return;
    const startOffset = 2; // September 2026 starts Tuesday.
    for (let i = 0; i < 42; i += 1) {
      const day = i - startOffset + 1;
      const button = document.createElement('button');
      button.type = 'button';
      if (day < 1) { button.textContent = String(31 + day); button.style.opacity = '.22'; }
      else if (day > 30) { button.textContent = String(day - 30); button.style.opacity = '.22'; }
      else {
        button.textContent = String(day);
        if (day === selectedDay) button.classList.add('selected');
        if (reminderDays.includes(day)) button.dataset.reminder = 'true';
        button.addEventListener('click', () => {
          $$('button', container).forEach((candidate) => candidate.classList.remove('selected'));
          button.classList.add('selected');
        });
      }
      container.appendChild(button);
    }
  }
  buildDates($('#dateGrid'));
  buildDates($('#globalDateGrid'), 4, [4, 8, 15, 21]);

  let drawTool = 'pen';
  $$('[data-draw]').forEach((button) => button.addEventListener('click', () => {
    drawTool = button.dataset.draw;
    $$('[data-draw]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
    const props = $('#drawProps');
    if (!props) return;
    if (drawTool === 'eraser') props.innerHTML = '<b>Eraser size</b><label>Size <input type="range" min="4" max="30" value="12"></label>';
    else if (drawTool === 'select') props.innerHTML = '<b>Select strokes</b><span style="color:var(--muted);font-size:7px">Move or delete the selected stroke. Brush controls are intentionally hidden.</span>';
    else props.innerHTML = `<b>${drawTool === 'pen' ? 'Pen' : 'Highlighter'} properties</b><button class="ink black"></button><button class="ink olive"></button><button class="ink blue"></button><label>Size <input type="range" min="2" max="14" value="4"></label>`;
  }));

  const canvas = $('#drawingCanvas');
  const ctx = canvas?.getContext('2d');
  let drawing = false;
  let last = null;
  function point(event) {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * (canvas.width / r.width), y: (event.clientY - r.top) * (canvas.height / r.height) };
  }
  canvas?.addEventListener('pointerdown', (event) => {
    if (drawTool === 'select') return;
    drawing = true;
    last = point(event);
    canvas.setPointerCapture(event.pointerId);
    const hint = $('.canvas-paper > span');
    if (hint) hint.hidden = true;
  });
  canvas?.addEventListener('pointermove', (event) => {
    if (!drawing || !ctx) return;
    const next = point(event);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = drawTool === 'highlighter' ? '#d7ad3b' : '#262923';
    ctx.globalAlpha = drawTool === 'highlighter' ? .3 : 1;
    ctx.globalCompositeOperation = drawTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.lineWidth = drawTool === 'eraser' ? 18 : drawTool === 'highlighter' ? 12 : 4;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    ctx.restore();
    last = next;
  });
  canvas?.addEventListener('pointerup', () => { drawing = false; last = null; });
  canvas?.addEventListener('pointercancel', () => { drawing = false; last = null; });

  const resizable = $('#resizableNote');
  const resizeHandle = $('#resizeHandle');
  const sizeReadout = $('#sizeReadout');
  let resizeStart = null;
  const limits = { minW: 380, minH: 300, maxW: 820, maxH: 760 };
  function setNoteSize(width, height, source = 'preset') {
    if (!resizable) return;
    const stage = $('#resizeStage');
    const stageMax = Math.max(limits.minW, (stage?.clientWidth || 860) - 54);
    const w = Math.max(limits.minW, Math.min(Math.min(limits.maxW, stageMax), Math.round(width)));
    const h = Math.max(limits.minH, Math.min(limits.maxH, Math.round(height)));
    resizable.style.width = `${w}px`;
    resizable.style.height = `${h}px`;
    if (sizeReadout) sizeReadout.textContent = `${w} × ${h}`;
    $$('[data-size]').forEach((button) => button.classList.remove('is-active'));
    if (source !== 'custom') {
      const match = $(`[data-size="${source}"]`);
      match?.classList.add('is-active');
    }
  }
  $$('[data-size]').forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.size;
    if (value === 'fit') {
      setNoteSize(560, 390, 'fit');
      notify('Fit content uses a smart height while respecting safe minimums.');
      return;
    }
    const [w, h] = value.split('x').map(Number);
    setNoteSize(w, h, value);
  }));
  resizeHandle?.addEventListener('pointerdown', (event) => {
    if (!resizable) return;
    event.preventDefault();
    resizeStart = { x: event.clientX, y: event.clientY, w: resizable.getBoundingClientRect().width, h: resizable.getBoundingClientRect().height };
    resizeHandle.setPointerCapture(event.pointerId);
  });
  resizeHandle?.addEventListener('pointermove', (event) => {
    if (!resizeStart) return;
    setNoteSize(resizeStart.w + event.clientX - resizeStart.x, resizeStart.h + event.clientY - resizeStart.y, 'custom');
  });
  resizeHandle?.addEventListener('pointerup', () => {
    if (!resizeStart) return;
    const rect = resizable.getBoundingClientRect();
    const presets = [[420,360,'420x360'],[560,460,'560x460'],[720,620,'720x620']];
    const snap = presets.find(([w,h]) => Math.abs(rect.width-w) < 18 && Math.abs(rect.height-h) < 18);
    if (snap) { setNoteSize(snap[0], snap[1], snap[2]); notify(`Snapped to ${snap[2].replace('x',' × ')}.`); }
    else notify(`Custom size ${Math.round(rect.width)} × ${Math.round(rect.height)} would be remembered for this Skrib.`);
    resizeStart = null;
  });
  resizeHandle?.addEventListener('pointercancel', () => { resizeStart = null; });
  resizeHandle?.addEventListener('dblclick', () => { setNoteSize(560, 460, '560x460'); notify('Reset to Medium.'); });

  $$('.rail-main').forEach((button) => button.addEventListener('click', () => notify(`Open here: ${$('b', button)?.textContent || 'Skrib'} opens beside the current place without changing its saved anchor.`)));
  $$('.rail-location').forEach((button) => button.addEventListener('click', () => notify('Return: focus a matching live window or start an allowlisted app when possible. Exact closed URLs are not promised.')));
  $('.rail-launcher')?.addEventListener('click', (event) => event.currentTarget.classList.toggle('open'));

  $$('.tray-menu button').forEach((button) => button.addEventListener('click', () => {
    const text = button.textContent.trim();
    if (text.includes('My Skribs')) showStudio('widgets');
    else if (text.includes('All Skribs')) { showStudio('screens'); showScreen('library'); }
    else if (text.includes('Open Skribli')) { showStudio('screens'); showScreen('home'); }
    else if (text.includes('Quick guide')) { showStudio('screens'); showScreen('onboarding'); }
    else notify('Quit would stop the Skribli background process. Closing ordinary windows does not.');
  }));

  $$('.home-grid aside button').forEach((button, index) => button.addEventListener('click', () => {
    if (index === 0) showStudio('widgets');
    if (index === 1) { showStudio('screens'); showScreen('library'); }
    if (index === 2) { showStudio('screens'); showScreen('account'); }
  }));

  $$('.agenda button').forEach((button) => button.addEventListener('click', () => {
    if (button.textContent.includes('Open Skrib')) { showStudio('notes'); showNoteView('anatomy'); }
    else { button.closest('.agenda').style.opacity = '.45'; notify('Reminder completed in this specimen; the Skrib remains intact.'); }
  }));

  $$('.error-grid button').forEach((button) => button.addEventListener('click', () => notify(`${button.textContent.trim()} simulated in the System & States studio.`)));
})();
