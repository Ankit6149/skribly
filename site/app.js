(() => {
  const config = window.SKRIBLY_COMMERCE;
  const toast = document.querySelector('[data-toast]');
  let toastTimer = null;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
  };

  const setLink = (element, href) => {
    if (!element || !href) return;
    element.setAttribute('href', href);
    if (/^https?:\/\//.test(href)) {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  };

  const releaseUrl =
    config?.download?.directWindowsAssetUrl ||
    config?.download?.latestReleaseUrl ||
    'https://github.com/Ankit6149/skribly/releases/latest';

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    setLink(link, releaseUrl);
    link.addEventListener('click', () => {
      showToast('Opening the latest Skribly Windows release…');
    });
  });

  document.querySelectorAll('[data-release-notes-link]').forEach((link) => {
    setLink(link, config?.download?.latestReleaseUrl || releaseUrl);
  });

  document.querySelectorAll('[data-version-label]').forEach((element) => {
    element.textContent = config?.download?.versionLabel || 'Founder Alpha';
  });

  document.querySelectorAll('[data-founder-price]').forEach((element) => {
    element.textContent = String(config?.product?.price ?? 499);
  });

  const checkoutLink = document.querySelector('[data-checkout-link]');
  const checkoutNote = document.querySelector('[data-checkout-note]');
  const checkoutEnabled = Boolean(config?.checkout?.enabled && config?.checkout?.checkoutUrl);

  if (checkoutLink && checkoutEnabled) {
    setLink(checkoutLink, config.checkout.checkoutUrl);
    checkoutLink.textContent = 'Buy Founder Access';
    if (checkoutNote) {
      checkoutNote.textContent = `Secure checkout powered by ${config.checkout.provider}. Installer access is delivered after payment.`;
    }
  } else if (checkoutLink) {
    checkoutLink.setAttribute('href', '#download');
    checkoutLink.addEventListener('click', () => {
      showToast('Paid Founder Access is not open yet. You can download the current public test build below.');
    });
  }

  const downloadStatus = document.querySelector('[data-download-status]');
  if (downloadStatus && config?.download?.mode === 'checkout_gated') {
    downloadStatus.textContent = 'Purchase Founder Access to receive the latest Windows installer and future Founder Alpha updates.';
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
        showToast('Skribly Founder Alpha currently supports Windows 10 and Windows 11.');
      });
    });
  }
})();
