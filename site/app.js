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
      showToast('Skribli is still in production. Downloads reopen after the Windows build passes final desktop validation.');
    });
  };

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    disableAction(link, 'Skribli is in production');
  });

  document.querySelectorAll('[data-version-label]').forEach((element) => {
    element.textContent = 'Downloads paused';
  });

  document.querySelectorAll('[data-release-notes-link]').forEach((link) => {
    link.setAttribute('href', '/release-notes');
  });

  const schema = document.querySelector('script[data-skribly-schema]');
  if (schema) {
    try {
      const payload = JSON.parse(schema.textContent || '{}');
      delete payload.downloadUrl;
      delete payload.offers;
      payload.softwareVersion = 'In production';
      payload.description = 'Skribli is a local-first contextual notes app that attaches notes to the application where they belong.';
      schema.textContent = JSON.stringify(payload);
    } catch {
      // The static page already contains the same product information.
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
