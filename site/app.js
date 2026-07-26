(() => {
  if (!document.head.querySelector('link[href$="landing-typography.css"]')) {
    const typography = document.createElement('link');
    typography.rel = 'stylesheet';
    typography.href = './landing-typography.css';
    document.head.appendChild(typography);
  }

  const toast = document.querySelector('[data-toast]');
  let toastTimer = null;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4200);
  };

  const disableAction = (element, label) => {
    if (!element) return;
    element.removeAttribute('href');
    element.removeAttribute('target');
    element.removeAttribute('rel');
    element.setAttribute('aria-disabled', 'true');
    element.classList.add('is-disabled');
    const mainLabel = element.querySelector('span');
    if (mainLabel) mainLabel.textContent = label;
    else if (!element.querySelector('small')) element.textContent = label;
    element.addEventListener('click', (event) => {
      event.preventDefault();
      showToast('Skribli is in active production development. Public downloads are paused until the rebuilt Windows app passes validation.');
    });
  };

  document.title = 'Skribli — Production rebuild in progress';

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    disableAction(link, 'App in production');
  });

  document.querySelectorAll('[data-version-label]').forEach((element) => {
    element.textContent = 'Public download paused';
  });

  document.querySelectorAll('[data-release-notes-link]').forEach((link) => {
    link.setAttribute('href', '/release-notes');
  });

  const eyebrow = document.querySelector('.eyebrow-pill');
  if (eyebrow) {
    const pulse = eyebrow.querySelector('.pulse-dot');
    eyebrow.textContent = '';
    if (pulse) eyebrow.appendChild(pulse);
    eyebrow.append(' In production');
  }

  const downloadSection = document.querySelector('.download-section');
  if (downloadSection) {
    const kicker = downloadSection.querySelector('.section-kicker');
    const heading = downloadSection.querySelector('h2');
    const status = downloadSection.querySelector('[data-download-status]');
    if (kicker) kicker.textContent = 'PRODUCTION REBUILD';
    if (heading) heading.textContent = 'The next Windows build is being rebuilt properly.';
    if (status) {
      status.textContent = 'Public downloads are disabled while native interaction and release behaviour are corrected and validated.';
    }
  }

  const schema = document.querySelector('script[data-skribly-schema]');
  if (schema) {
    try {
      const payload = JSON.parse(schema.textContent || '{}');
      delete payload.downloadUrl;
      delete payload.offers;
      payload.softwareVersion = 'Production build in progress';
      payload.description = 'Skribli is a local-first contextual notes app currently in active production development. Public downloads are paused.';
      schema.textContent = JSON.stringify(payload);
    } catch {
      // The static page already communicates the production hold.
    }
  }

  document.querySelectorAll('[data-demo-dot]').forEach((dot) => {
    dot.addEventListener('click', () => {
      const id = dot.getAttribute('data-demo-dot');
      const note = document.querySelector(`[data-demo-note="${id}"]`);
      if (!note) return;
      document.querySelectorAll('[data-demo-note]').forEach((item) => {
        if (item !== note) item.classList.remove('is-open');
      });
      note.classList.toggle('is-open');
    });
  });

  document.querySelectorAll('[data-close-demo]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-close-demo');
      document.querySelector(`[data-demo-note="${id}"]`)?.classList.remove('is-open');
    });
  });
})();
