(() => {
  const config = window.SKRIBLY_COMMERCE;
  const toast = document.querySelector('[data-toast]');
  let toastTimer = null;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3800);
  };

  const setLink = (element, href) => {
    if (!element || !href) return;
    element.setAttribute('href', href);
  };

  const downloadUrl = config?.download?.endpoint || '/api/download';
  const checkoutUrl = config?.checkout?.endpoint || '/api/checkout';
  const releaseNotesUrl = config?.links?.releaseNotes || '/release-notes';
  const privacyUrl = config?.links?.privacy || '/privacy';
  const trialIsEnforced = Boolean(config?.trial?.enforcedInApp);

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    setLink(link, downloadUrl);
    link.addEventListener('click', () => {
      showToast(trialIsEnforced ? 'Preparing your Skribly trial…' : 'Preparing the current Windows beta…');
    });
  });

  document.querySelectorAll('[data-release-notes-link]').forEach((link) => {
    setLink(link, releaseNotesUrl);
  });

  document.querySelectorAll('[data-privacy-link]').forEach((link) => {
    setLink(link, privacyUrl);
  });

  document.querySelectorAll('[data-version-label]').forEach((element) => {
    element.textContent = config?.download?.versionLabel || 'Windows beta';
  });

  document.querySelectorAll('[data-launch-price]').forEach((element) => {
    element.textContent = String(config?.product?.launchPrice ?? 999);
  });

  document.querySelectorAll('[data-standard-price]').forEach((element) => {
    element.textContent = String(config?.product?.standardPrice ?? 1499);
  });

  document.querySelectorAll('[data-trial-days]').forEach((element) => {
    element.textContent = String(config?.trial?.days ?? 7);
  });

  document.querySelectorAll('[data-update-months]').forEach((element) => {
    element.textContent = String(config?.product?.includedUpdateMonths ?? 12);
  });

  const checkoutEnabled = Boolean(config?.checkout?.enabled);
  document.querySelectorAll('[data-checkout-link]').forEach((link) => {
    setLink(link, checkoutUrl);
    if (!checkoutEnabled) {
      link.setAttribute('aria-disabled', 'true');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        showToast('Purchases open after licence activation is validated. The Windows beta is available to try now.');
      });
    }
  });

  document.querySelectorAll('[data-trial-copy]').forEach((element) => {
    element.textContent = trialIsEnforced
      ? `Try every feature for ${config.trial.days} days. No card required.`
      : 'The current beta is free while licence activation is being validated. The paid launch will include a 7-day full trial.';
  });

  document.querySelectorAll('[data-download-label]').forEach((element) => {
    element.textContent = trialIsEnforced ? 'Download 7-day trial' : 'Download Windows beta';
  });

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

  const nav = document.querySelector('[data-nav]');
  const syncNav = () => nav?.classList.toggle('is-scrolled', window.scrollY > 24);
  syncNav();
  window.addEventListener('scroll', syncNav, { passive: true });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  if (!/win/i.test(platform)) {
    document.querySelectorAll('[data-download-link]').forEach((link) => {
      link.addEventListener('click', () => {
        showToast('Skribly currently supports Windows 10 and Windows 11.');
      });
    });
  }
})();
