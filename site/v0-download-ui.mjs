// One transient key, an allowlisted platform, and no shared cache across platforms.
export function mountOwnerDownloads(root, { decrypt, fetchPackage, artifactFor, isFailure, download }) {
  const form = root.querySelector('[data-v0-key-form]');
  const submit = root.querySelector('[data-v0-key-submit]');
  const retry = root.querySelector('[data-v0-retry]');
  const status = root.querySelector('[data-v0-key-status]');
  const detail = root.querySelector('[data-v0-package-detail]');
  if (!form || !submit || !retry || !status || !detail) return;
  const choices = [...form.querySelectorAll('input[name="platform"]')];
  const keyInput = form.elements.namedItem('downloadKey');
  if (!keyInput || !choices.length) return;
  let busy = false;
  let cached = null;
  const selected = () => choices.find((choice) => choice.checked)?.value;
  const setStatus = (message, state = 'info') => {
    status.textContent = message;
    status.dataset.state = state;
    status.classList.toggle('is-error', state === 'error');
  };
  const setBusy = (value) => {
    busy = value;
    submit.disabled = value || !artifactFor(selected()).ready;
    retry.disabled = value;
    keyInput.disabled = value;
    for (const choice of choices) choice.disabled = value;
  };
  const updateChoice = () => {
    if (busy) return;
    cached = null;
    retry.hidden = true;
    const artifact = artifactFor(selected());
    detail.textContent = artifact.description;
    submit.textContent = `Download ${artifact.label}`;
    setStatus(artifact.ready
      ? 'Enter the same download key. It is cleared after each download.'
      : 'The Android preview is being prepared. Its download will be enabled when the APK is verified.');
    setBusy(false);
  };
  for (const choice of choices) choice.addEventListener('change', updateChoice);
  const reportFailure = (error) => {
    if (isFailure(error, 'availability_')) {
      setStatus('This package is temporarily unavailable. Check your connection and retry.', 'error');
      retry.hidden = false;
    } else if (isFailure(error, 'integrity_header')) {
      cached = null;
      setStatus('The downloaded package is invalid. Contact the owner before trying again.', 'error');
      retry.hidden = false;
    } else if (isFailure(error, 'authentication')) {
      cached = null;
      setStatus('A wrong key or damaged ciphertext can both prevent authentication. Recheck the key; if it persists, contact the owner.', 'error');
      keyInput.focus();
    } else {
      cached = null;
      setStatus('The package could not be prepared. Retry in a moment.', 'error');
      retry.hidden = false;
    }
  };
  const packageFor = async (platform) => {
    if (cached?.platform === platform) return cached.bytes;
    const bytes = await fetchPackage(platform);
    cached = { platform, bytes };
    return bytes;
  };
  retry.addEventListener('click', async () => {
    if (busy) return;
    const platform = selected();
    if (!artifactFor(platform).ready) return;
    cached = null;
    retry.hidden = true;
    setBusy(true);
    setStatus('Checking the selected package…');
    try {
      await packageFor(platform);
      setStatus('The package is available. Enter your key to decrypt it.');
    } catch (error) { reportFailure(error); }
    finally { setBusy(false); keyInput.focus(); }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const platform = selected();
    const artifact = artifactFor(platform);
    if (!artifact.ready) return;
    const key = keyInput.value;
    keyInput.value = '';
    setBusy(true);
    retry.hidden = true;
    setStatus('Checking key and preparing your download…');
    let failed = false;
    try {
      const bytes = await decrypt(await packageFor(platform), key);
      await download(bytes, artifact);
      cached = null;
      setStatus(`Download started. ${artifact.next}`);
    } catch (error) { failed = true; reportFailure(error); }
    finally {
      keyInput.value = '';
      setBusy(false);
      if (failed) keyInput.focus();
    }
  });
  updateChoice();
}
