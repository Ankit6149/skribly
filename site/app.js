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
      showToast(
        'Public downloads are disabled while the exact Windows release candidate completes lifecycle, installer, recovery, accessibility, and physical desktop validation.'
      );
    });
  };

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    disableAction(link, 'Downloads unavailable');
  });

  document.querySelectorAll('[data-version-label]').forEach((element) => {
    element.textContent = 'Windows validation active';
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
      payload.softwareVersion = 'Pre-release validation';
      payload.description =
        'Skribli is a local-first Windows contextual annotation app, beginning with typed Skribs. Public downloads are disabled while the release candidate is validated.';
      schema.textContent = JSON.stringify(payload);
    } catch {
      // Static structured data already contains the same product status.
    }
  }
})();
