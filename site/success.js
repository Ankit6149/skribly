(() => {
  const config = window.SKRIBLY_COMMERCE;
  const title = document.querySelector('[data-success-title]');
  const message = document.querySelector('[data-success-message]');
  const download = document.querySelector('[data-secure-download]');

  if (!config?.checkout?.enabled) {
    if (title) title.textContent = 'Checkout is not open yet.';
    if (message) {
      message.textContent =
        'The current Windows beta is free while licence activation is being validated. Skribli has not charged you on this page.';
    }
    if (download) {
      download.textContent = 'Download Windows beta';
      download.setAttribute('href', config?.download?.endpoint || '/api/download');
    }
    return;
  }

  if (title) title.textContent = 'Your purchase is being verified.';
  if (message) {
    message.textContent =
      'Payment verification is handled server-side. Follow the instructions delivered by the authorised checkout provider; never share complete payment credentials with support.';
  }
  if (download) {
    download.textContent = 'Return to Skribli';
    download.setAttribute('href', '/');
  }
})();
