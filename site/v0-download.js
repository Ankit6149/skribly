(() => {
  const form = document.querySelector('[data-owner-download-form]');
  const submit = document.querySelector('[data-owner-download-submit]');
  const status = document.querySelector('[data-owner-download-status]');
  if (!(form instanceof HTMLFormElement) || !(submit instanceof HTMLButtonElement) || !status) return;

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const readError = async (response, fallback) => {
    try {
      const payload = await response.json();
      return typeof payload?.error === 'string' ? payload.error : fallback;
    } catch {
      return fallback;
    }
  };

  const downloadFilename = (header) => {
    const match = /filename="?([^";]+)"?/i.exec(header || '');
    return match?.[1] || 'Skribli_v0_Windows.zip';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const email = String(new FormData(form).get('email') || '').trim();
    const password = String(new FormData(form).get('password') || '');
    let accessToken = '';
    submit.disabled = true;
    setStatus('Verifying your owner account...');

    try {
      const configurationResponse = await fetch('/api/v0-download-config', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!configurationResponse.ok) {
        throw new Error(await readError(configurationResponse, 'Owner download access is not configured yet.'));
      }
      const configuration = await configurationResponse.json();
      if (
        typeof configuration?.supabaseUrl !== 'string' ||
        typeof configuration?.publishableKey !== 'string'
      ) {
        throw new Error('Owner download access is not configured correctly.');
      }

      const signInResponse = await fetch(
        `${configuration.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            apikey: configuration.publishableKey,
            Authorization: `Bearer ${configuration.publishableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      );
      if (!signInResponse.ok) {
        throw new Error('Sign-in failed. Use the verified Skribli owner account.');
      }
      const session = await signInResponse.json();
      if (typeof session?.access_token !== 'string' || session.access_token.length < 40) {
        throw new Error('The account provider did not return a valid session.');
      }
      accessToken = session.access_token;

      setStatus('Account verified. Preparing the Windows installer archive...');
      const archiveResponse = await fetch('/api/download', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!archiveResponse.ok) {
        throw new Error(await readError(archiveResponse, 'The v0 artifact is not ready yet.'));
      }

      const archive = await archiveResponse.blob();
      if (archive.size === 0) throw new Error('The installer archive was empty. Please try again.');
      const objectUrl = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadFilename(archiveResponse.headers.get('content-disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setStatus('Download started. Extract the archive, then run the Skribli installer inside it.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The v0 download could not be prepared.', true);
    } finally {
      accessToken = '';
      const passwordInput = form.elements.namedItem('password');
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = '';
      submit.disabled = false;
    }
  });
})();
