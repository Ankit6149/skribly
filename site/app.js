(() => {
  if (!document.head.querySelector('link[href$="landing-typography.css"]')) {
    const typography = document.createElement('link');
    typography.rel = 'stylesheet';
    typography.href = './landing-typography.css';
    document.head.appendChild(typography);
  }

  const configureOwnerDownload = (element) => {
    if (!element) return;
    const endpoint = window.SKRIBLY_COMMERCE?.download?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('/')) return;
    element.setAttribute('href', endpoint);
    element.removeAttribute('aria-disabled');
    element.classList.remove('is-disabled');

    const mainLabel = element.querySelector('span');
    if (mainLabel) mainLabel.textContent = 'Owner v0 access';
    else if (!element.querySelector('small')) element.textContent = 'Owner v0 access';
    const versionLabel = element.querySelector('small');
    if (versionLabel) versionLabel.textContent = 'Download key required';
  };

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    configureOwnerDownload(link);
  });

  document.querySelectorAll('[data-version-label]').forEach((element) => {
    element.textContent = 'Download key required';
  });

  document.querySelectorAll('[data-release-notes-link]').forEach((link) => {
    link.setAttribute('href', '/release-notes');
  });

  const schema = document.querySelector('script[data-skribly-schema]');
  if (schema) {
    try {
      const payload = JSON.parse(schema.textContent || '{}');
      payload.softwareVersion = 'v0 owner test';
      payload.description =
        'Skribli is a local-first Windows contextual annotation app, beginning with typed Skribs. The encrypted v0 installer requires the owner download key.';
      schema.textContent = JSON.stringify(payload);
    } catch {
      // Static structured data already contains the same product status.
    }
  }
})();
