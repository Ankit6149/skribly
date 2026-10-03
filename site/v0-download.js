import { decryptInstaller, DownloadFailure, fetchEncryptedInstaller } from './v0-download-core.mjs';

const form = document.querySelector('[data-v0-key-form]');
const submit = document.querySelector('[data-v0-key-submit]');
const retry = document.querySelector('[data-v0-retry]');
const status = document.querySelector('[data-v0-key-status]');

if (form instanceof HTMLFormElement && submit instanceof HTMLButtonElement && status instanceof HTMLElement && retry instanceof HTMLButtonElement) {
  let encryptedPackage = null;

  const setStatus = (message, state = 'info') => {
    status.textContent = message;
    status.dataset.state = state;
    status.classList.toggle('is-error', state === 'error');
  };

  const setBusy = (busy) => {
    submit.disabled = busy;
    retry.disabled = busy;
  };

  const retryFetch = async () => {
    retry.hidden = true;
    setBusy(true);
    setStatus('Checking the owner installer package…');
    try {
      encryptedPackage = await fetchEncryptedInstaller();
      setStatus('The installer package is available. Enter your key to decrypt it.');
      form.elements.namedItem('downloadKey')?.focus();
    } catch (error) {
      if (error instanceof DownloadFailure && error.category.startsWith('availability_')) {
        setStatus('The installer is temporarily unavailable. Check your connection and retry.', 'error');
      } else if (error instanceof DownloadFailure && error.category === 'integrity_header') {
        setStatus('The downloaded package is invalid. Contact the owner before trying again.', 'error');
      } else {
        setStatus('The installer could not be checked. Retry in a moment.', 'error');
      }
      retry.hidden = false;
    } finally {
      setBusy(false);
    }
  };

  retry.addEventListener('click', retryFetch);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const keyInput = form.elements.namedItem('downloadKey');
    if (!(keyInput instanceof HTMLInputElement)) return;
    const downloadKey = keyInput.value;
    keyInput.value = '';
    setBusy(true);
    retry.hidden = true;
    setStatus('Checking key and preparing the installer…');

    try {
      if (!encryptedPackage) encryptedPackage = await fetchEncryptedInstaller();
      const installer = await decryptInstaller(encryptedPackage, downloadKey);
      const objectUrl = URL.createObjectURL(
        new Blob([installer], { type: 'application/vnd.microsoft.portable-executable' })
      );
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = form.dataset.installerFilename || 'Skribli_Windows_setup.exe';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      encryptedPackage = null;
      setStatus('Installer download started. Open the .exe to install Skribli on this PC.');
    } catch (error) {
      if (error instanceof DownloadFailure && error.category.startsWith('availability_')) {
        setStatus('The installer is temporarily unavailable. Check your connection and retry.', 'error');
        retry.hidden = false;
      } else if (error instanceof DownloadFailure && error.category === 'integrity_header') {
        encryptedPackage = null;
        setStatus('The downloaded package is invalid. Contact the owner before trying again.', 'error');
        retry.hidden = false;
      } else if (error instanceof DownloadFailure && error.category === 'authentication') {
        setStatus('A wrong key or damaged ciphertext can both prevent authentication. Recheck the key; if it persists, contact the owner.', 'error');
        keyInput.focus();
      } else {
        setStatus('The installer could not be prepared. Retry in a moment.', 'error');
        retry.hidden = false;
      }
    } finally {
      keyInput.value = '';
      setBusy(false);
    }
  });
}
