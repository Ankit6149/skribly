(() => {
  if (!document.head.querySelector('link[href$="ux-polish.css"]')) {
    const polish = document.createElement('link');
    polish.rel = 'stylesheet';
    polish.href = './ux-polish.css';
    document.head.appendChild(polish);
  }

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
    element.removeAttribute('target');
    element.removeAttribute('rel');
  };

  const setMeta = (selector, attributes) => {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      document.head.appendChild(element);
    }
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  };

  const downloadUrl = config?.download?.endpoint || '/api/download';
  const checkoutUrl = config?.checkout?.endpoint || '/api/checkout';
  const releaseNotesUrl = config?.links?.releaseNotes || '/release-notes';
  const privacyUrl = config?.links?.privacy || '/privacy';
  const trialDays = Number(config?.trial?.days ?? 7);
  const launchPrice = Number(config?.product?.launchPrice ?? 999);
  const standardPrice = Number(config?.product?.standardPrice ?? 1499);
  const updateMonths = Number(config?.product?.includedUpdateMonths ?? 12);
  const trialIsEnforced = Boolean(config?.trial?.enforcedInApp);
  const checkoutEnabled = Boolean(config?.checkout?.enabled);

  document.title = 'Skribly — Leave notes inside any app';
  setMeta('meta[name="robots"]', {
    name: 'robots',
    content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  });
  setMeta('meta[property="og:url"]', {
    property: 'og:url',
    content: 'https://skribly-desktop.vercel.app/',
  });
  setMeta('meta[name="twitter:card"]', {
    name: 'twitter:card',
    content: 'summary_large_image',
  });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = 'https://skribly-desktop.vercel.app/';

  if (!document.head.querySelector('script[data-skribly-schema]')) {
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.dataset.skriblySchema = 'true';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: 'Skribly',
          applicationCategory: 'ProductivityApplication',
          operatingSystem: 'Windows 10, Windows 11',
          description: 'A local-first contextual notes app that attaches notes to application windows and collapses them into movable dots.',
          url: 'https://skribly-desktop.vercel.app/',
          downloadUrl: 'https://skribly-desktop.vercel.app/api/download',
          softwareVersion: '0.1 beta',
          featureList: [
            'Contextual notes attached to application windows',
            'Movable compact note dots',
            'Local-first text, drawings and attachments',
            'Saved notes recovery widget',
            'Global keyboard shortcut',
          ],
          offers: {
            '@type': 'Offer',
            price: String(launchPrice),
            priceCurrency: config?.product?.currency || 'INR',
            availability: 'https://schema.org/PreOrder',
          },
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'What is Skribly?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Skribly is a Windows contextual notes app. Notes stay attached to the application where they matter and can collapse into small movable dots.',
              },
            },
            {
              '@type': 'Question',
              name: 'How is Skribly different from Microsoft Sticky Notes?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Skribly focuses on application and spatial context. Notes follow an app window, collapse into compact anchors, and help users return to the matching work context.',
              },
            },
            {
              '@type': 'Question',
              name: 'Can I try Skribly before paying?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Yes. The planned paid release includes a ${trialDays}-day full trial with no card. The current Windows beta is free while licence activation is validated.`,
              },
            },
          ],
        },
      ],
    });
    document.head.appendChild(schema);
  }

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    setLink(link, downloadUrl);
    link.addEventListener('click', () => {
      showToast(trialIsEnforced ? 'Preparing your Skribly trial…' : 'Preparing the current Windows beta…');
    });
  });

  document.querySelectorAll('[data-release-notes-link]').forEach((link) => {
    setLink(link, releaseNotesUrl);
  });

  document.querySelectorAll('a[href="#privacy"], [data-privacy-link]').forEach((link) => {
    setLink(link, privacyUrl);
  });

  document.querySelectorAll('a[href*="github.com/Ankit6149/skribly"]').forEach((link) => {
    if (link.hasAttribute('data-release-notes-link')) {
      setLink(link, releaseNotesUrl);
      return;
    }
    if (link.getAttribute('href')?.includes('/issues')) {
      link.textContent = 'FAQ';
      setLink(link, '/answers');
      return;
    }
    link.textContent = 'Release notes';
    setLink(link, releaseNotesUrl);
  });

  document.querySelectorAll('[data-version-label]').forEach((element) => {
    element.textContent = config?.download?.versionLabel || 'Windows beta 0.1';
  });

  document.querySelectorAll('[data-founder-price], [data-launch-price]').forEach((element) => {
    element.textContent = String(launchPrice);
  });

  const founderNav = [...document.querySelectorAll('.desktop-nav a')].find((link) =>
    /founder access/i.test(link.textContent || '')
  );
  if (founderNav) founderNav.textContent = 'Pricing';

  const eyebrow = document.querySelector('.eyebrow-pill');
  if (eyebrow) {
    const pulse = eyebrow.querySelector('.pulse-dot');
    eyebrow.textContent = '';
    if (pulse) eyebrow.appendChild(pulse);
    eyebrow.append(' Windows beta');
  }

  document.querySelectorAll('[data-download-link]').forEach((link) => {
    const label = link.querySelector('span');
    if (label) label.textContent = trialIsEnforced ? `Download ${trialDays}-day trial` : 'Download Windows beta';
    else if (!link.querySelector('small')) link.textContent = trialIsEnforced ? `Download ${trialDays}-day trial` : 'Download Windows beta';
  });

  const pricingSection = document.querySelector('.pricing-section');
  if (pricingSection) {
    const kicker = pricingSection.querySelector('.pricing-copy .section-kicker');
    const heading = pricingSection.querySelector('.pricing-copy h2');
    const copy = pricingSection.querySelector('.pricing-copy p');
    const topline = pricingSection.querySelector('.pricing-topline span:first-child');
    const priceSmall = pricingSection.querySelector('.price-line small');
    const list = pricingSection.querySelector('ul');
    const checkoutNote = pricingSection.querySelector('[data-checkout-note]');

    if (kicker) kicker.textContent = 'PERSONAL WINDOWS LICENCE';
    if (heading) heading.textContent = 'Try every feature. Pay only if it stays useful.';
    if (copy) copy.textContent = `The paid release will include a ${trialDays}-day full trial, followed by a one-time personal licence. No forced monthly subscription.`;
    if (topline) topline.textContent = 'PERSONAL LICENCE';
    if (priceSmall) priceSmall.textContent = 'one time';
    if (list) {
      list.innerHTML = `
        <li>${trialDays}-day full trial with no card</li>
        <li>Permanent use of the purchased version</li>
        <li>${updateMonths} months of feature and maintenance updates</li>
        <li>Optional update pass later—no forced renewal</li>
      `;
    }
    if (checkoutNote) {
      checkoutNote.textContent = checkoutEnabled
        ? 'Secure checkout. Licence delivery follows verified payment.'
        : `The current beta is free. Paid checkout opens after licence activation is tested. Planned standard price ₹${standardPrice}.`;
    }
  }

  document.querySelectorAll('[data-checkout-link]').forEach((link) => {
    setLink(link, checkoutUrl);
    link.textContent = checkoutEnabled ? 'Buy personal licence' : 'Buy licence when checkout opens';
    if (!checkoutEnabled) {
      link.setAttribute('aria-disabled', 'true');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        showToast('Purchases open after licence activation is validated. You can try the Windows beta now.');
      });
    }
  });

  const downloadSection = document.querySelector('.download-section');
  if (downloadSection) {
    const kicker = downloadSection.querySelector('.section-kicker');
    const status = downloadSection.querySelector('[data-download-status]');
    if (kicker) kicker.textContent = 'WINDOWS BETA';
    if (status) {
      status.textContent = trialIsEnforced
        ? `Try every feature for ${trialDays} days. No card required.`
        : 'Download the current Windows beta directly from Skribly. Windows may show an unsigned-app warning during beta.';
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
