const MAGIC = new TextEncoder().encode('SKRV0E01');
const MINIMUM_PACKAGE_BYTES = 53;

export const OWNER_ARTIFACTS = Object.freeze({
  desktop: Object.freeze({
    path: '/assets/skribli-v0-windows.enc',
    filename: 'Skribli_0.1.51_x64-setup.exe',
    mime: 'application/vnd.microsoft.portable-executable',
    label: 'Windows installer',
    description: 'Windows · x64 · v0.1.51 private owner test',
    ready: true,
    next: 'Open the .exe on your Windows PC to install Skribli.',
  }),
  android: Object.freeze({
    path: '/assets/skribli-android-preview-0.0.1-arm64.enc',
    filename: 'Skribli_Mobile_Preview_0.0.1_arm64.apk',
    mime: 'application/vnd.android.package-archive',
    label: 'Android preview APK',
    description: 'Android 7+ · ARM64 · v0.0.1 private preview. Local text notes only; no desktop sync yet.',
    ready: false,
    next: 'Open the .apk on your Android phone. This is a private preview; save notes explicitly.',
  }),
});

export function ownerArtifact(platform) {
  if (!Object.hasOwn(OWNER_ARTIFACTS, platform)) {
    throw new DownloadFailure('platform', 'Choose Desktop or Android.');
  }
  return OWNER_ARTIFACTS[platform];
}

export class DownloadFailure extends Error {
  constructor(category, message, options = {}) {
    super(message, options);
    this.name = 'DownloadFailure';
    this.category = category;
  }
}

export async function fetchEncryptedInstaller(fetchImpl = fetch, timeoutMs = 15_000, platform = 'desktop') {
  const artifact = ownerArtifact(platform);
  if (!artifact.ready) throw new DownloadFailure('availability_pending', 'This preview package is not available yet.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Owner installer request timed out.')), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(artifact.path, { cache: 'no-store', signal: controller.signal });
    } catch (cause) {
      const category = controller.signal.aborted ? 'availability_timeout' : 'availability_network';
      throw new DownloadFailure(category, 'The installer could not be reached.', { cause });
    }

    if (!response?.ok) {
      throw new DownloadFailure('availability_http', `Installer service returned HTTP ${response?.status ?? 'unknown'}.`);
    }

    let encrypted;
    try {
      encrypted = new Uint8Array(await response.arrayBuffer());
    } catch (cause) {
      throw new DownloadFailure('availability_body', 'The installer response ended before it could be read.', { cause });
    }

    if (encrypted.length < MINIMUM_PACKAGE_BYTES || !bytesEqual(encrypted.subarray(0, MAGIC.length), MAGIC)) {
      throw new DownloadFailure('integrity_header', 'The downloaded file is not a valid Skribli installer package.');
    }
    return encrypted;
  } finally {
    clearTimeout(timeout);
  }
}

export async function decryptInstaller(encrypted, downloadKey, cryptoImpl = globalThis.crypto) {
  try {
    const material = await cryptoImpl.subtle.importKey(
      'raw',
      new TextEncoder().encode(downloadKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const aesKey = await cryptoImpl.subtle.deriveKey(
      { name: 'PBKDF2', salt: encrypted.slice(8, 24), iterations: 210_000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    return await cryptoImpl.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.slice(24, 36), tagLength: 128 },
      aesKey,
      encrypted.slice(36)
    );
  } catch (cause) {
    throw new DownloadFailure('authentication', 'The key could not authenticate this installer package.', { cause });
  }
}

function bytesEqual(value, expected) {
  return value.length === expected.length && value.every((byte, index) => byte === expected[index]);
}
