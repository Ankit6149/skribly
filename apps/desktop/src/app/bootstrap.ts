function describeFailure(value: unknown): string {
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (typeof value === 'string' && value.trim()) return value.trim();
  return 'The desktop interface did not finish loading.';
}

function showStartupFailure(value: unknown): void {
  const shell = document.getElementById('skribli-boot-shell');
  if (!shell) return;

  shell.dataset.state = 'failure';
  const kicker = document.getElementById('skribli-boot-kicker');
  const title = document.getElementById('skribli-boot-title');
  const message = document.getElementById('skribli-boot-message');
  if (kicker) kicker.textContent = 'STARTUP NEEDS ATTENTION';
  if (title) title.textContent = 'Skribli could not finish opening.';
  if (message) {
    message.textContent = `${describeFailure(value)} Your local Skribs remain safe. Try again, then reinstall the latest build if this continues.`;
  }
  console.error('Skribli startup failed.', value);
}

window.addEventListener('error', (event) => showStartupFailure(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showStartupFailure(event.reason));
document.getElementById('skribli-boot-retry')?.addEventListener('click', () => window.location.reload());

void import('./main').catch(showStartupFailure);
