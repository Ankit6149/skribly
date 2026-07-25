(() => {
  const config = window.SKRIBLY_COMMERCE;
  const message = document.querySelector('[data-success-message]');
  const download = document.querySelector('[data-secure-download]');
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id') || params.get('checkout_id') || params.get('payment_id');
  const entitlementApiUrl = config?.checkout?.entitlementApiUrl;

  const setFailure = (text) => {
    if (message) message.textContent = text;
    if (download) {
      download.textContent = 'Return to Skribly';
      download.setAttribute('href', './');
    }
  };

  if (!config?.checkout?.enabled) {
    setFailure('Paid Founder Access is not enabled yet. Return to the website to download the current public Founder Alpha build.');
    return;
  }

  if (!entitlementApiUrl || !sessionId) {
    setFailure('Your payment return could not be verified automatically. Use the support link from your checkout receipt instead of sharing payment details here.');
    return;
  }

  if (message) message.textContent = 'Verifying your Founder Access and preparing a secure Windows installer link…';
  if (download) {
    download.textContent = 'Preparing download…';
    download.setAttribute('aria-disabled', 'true');
  }

  fetch(entitlementApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({
      sessionId,
      productId: config.product.id,
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error('Entitlement verification failed.');
      return response.json();
    })
    .then((result) => {
      if (!result?.downloadUrl) throw new Error('No secure installer link was returned.');
      if (message) message.textContent = 'Founder Access verified. Your secure installer link is ready.';
      if (download) {
        download.textContent = 'Download Skribly for Windows';
        download.setAttribute('href', result.downloadUrl);
        download.removeAttribute('aria-disabled');
      }
    })
    .catch(() => {
      setFailure('We could not verify the checkout automatically. Use the support link from your payment receipt and include only the checkout reference—not card or bank details.');
    });
})();
