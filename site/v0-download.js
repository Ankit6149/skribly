(() => {
  const form = document.querySelector('[data-v0-key-form]');
  const submit = document.querySelector('[data-v0-key-submit]');
  const status = document.querySelector('[data-v0-key-status]');
  if (!(form instanceof HTMLFormElement) || !(submit instanceof HTMLButtonElement) || !status) return;

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const bytesEqual = (value, expected) =>
    value.length === expected.length && value.every((byte, index) => byte === expected[index]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const keyInput = form.elements.namedItem('downloadKey');
    if (!(keyInput instanceof HTMLInputElement)) return;
    const downloadKey = keyInput.value;
    submit.disabled = true;
    setStatus('Checking key and decrypting the installer...');

    try {
      const response = await fetch('/assets/skribli-v0-windows.enc', { cache: 'no-store' });
      if (!response.ok) throw new Error('The current v0 installer is not ready yet.');
      const encrypted = new Uint8Array(await response.arrayBuffer());
      const magic = new TextEncoder().encode('SKRV0E01');
      if (encrypted.length < 53 || !bytesEqual(encrypted.slice(0, 8), magic)) {
        throw new Error('The installer package is invalid.');
      }

      const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(downloadKey),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encrypted.slice(8, 24), iterations: 210_000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const installer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encrypted.slice(24, 36), tagLength: 128 },
        aesKey,
        encrypted.slice(36)
      );

      const objectUrl = URL.createObjectURL(
        new Blob([installer], { type: 'application/vnd.microsoft.portable-executable' })
      );
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'Skribli_0.1.16_x64-setup.exe';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setStatus('Installer download started. Open the .exe to install Skribli on this PC.');
    } catch {
      setStatus('That key is incorrect, or the installer is not ready yet.', true);
    } finally {
      keyInput.value = '';
      submit.disabled = false;
    }
  });
})();
