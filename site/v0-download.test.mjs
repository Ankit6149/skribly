import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptInstaller, DownloadFailure, fetchEncryptedInstaller } from './v0-download-core.mjs';

const validHeaderPackage = () => {
  const bytes = new Uint8Array(53);
  bytes.set(new TextEncoder().encode('SKRV0E01'));
  return bytes;
};

const responseFor = (status, bytes = validHeaderPackage()) => ({
  ok: status >= 200 && status < 300,
  status,
  arrayBuffer: async () => bytes.buffer,
});

test('missing/offline owner artifact is classified as availability', async () => {
  await assert.rejects(
    fetchEncryptedInstaller(async () => responseFor(404), 100),
    (error) => error instanceof DownloadFailure && error.category === 'availability_http'
  );
  await assert.rejects(
    fetchEncryptedInstaller(async () => { throw new TypeError('offline fixture'); }, 100),
    (error) => error instanceof DownloadFailure && error.category === 'availability_network'
  );
});

test('owner artifact retrieval uses an abort deadline', async () => {
  const response = await fetchEncryptedInstaller((_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }), 5).catch((error) => error);
  assert.ok(response instanceof DownloadFailure);
  assert.equal(response.category, 'availability_timeout');
});

test('malformed or truncated package is classified as integrity failure', async () => {
  const invalid = new Uint8Array(53);
  await assert.rejects(
    fetchEncryptedInstaller(async () => responseFor(200, invalid), 100),
    (error) => error instanceof DownloadFailure && error.category === 'integrity_header'
  );
  await assert.rejects(
    fetchEncryptedInstaller(async () => responseFor(200, new Uint8Array(12)), 100),
    (error) => error instanceof DownloadFailure && error.category === 'integrity_header'
  );
});

test('AES-GCM rejection stays one honest authentication category', async () => {
  const cryptoImpl = { subtle: { importKey: async () => { throw new Error('synthetic auth failure'); } } };
  await assert.rejects(
    decryptInstaller(validHeaderPackage(), 'synthetic-test-key', cryptoImpl),
    (error) => error instanceof DownloadFailure && error.category === 'authentication'
  );
});

test('valid synthetic package uses the existing PBKDF2 and AES-GCM envelope', async () => {
  let deriveArguments;
  let decryptArguments;
  const cryptoImpl = {
    subtle: {
      importKey: async (format, keyBytes, algorithm, extractable, usages) => {
        assert.equal(format, 'raw');
        assert.equal(new TextDecoder().decode(keyBytes), 'synthetic-test-key');
        assert.equal(algorithm, 'PBKDF2');
        assert.equal(extractable, false);
        assert.deepEqual(usages, ['deriveKey']);
        return 'material';
      },
      deriveKey: async (...args) => { deriveArguments = args; return 'aes-key'; },
      decrypt: async (...args) => { decryptArguments = args; return new Uint8Array([1, 2, 3]).buffer; },
    },
  };
  const decrypted = await decryptInstaller(validHeaderPackage(), 'synthetic-test-key', cryptoImpl);
  assert.deepEqual([...new Uint8Array(decrypted)], [1, 2, 3]);
  assert.equal(deriveArguments[0].iterations, 210_000);
  assert.equal(deriveArguments[0].hash, 'SHA-256');
  assert.equal(decryptArguments[0].name, 'AES-GCM');
  assert.equal(decryptArguments[0].tagLength, 128);
});

// UI regression fixtures use synthetic bytes and keys; no owner artifact or secret.
import { mountOwnerDownloads } from './v0-download-ui.mjs';
import { ownerArtifact } from './v0-download-core.mjs';

function uiFixture(overrides = {}) {
  const element = (extra = {}) => ({
    disabled: false, hidden: false, value: '', checked: false, textContent: '', dataset: {},
    classList: { toggle() {} }, handlers: {}, focus() { this.focused = true; },
    addEventListener(type, callback) { this.handlers[type] = callback; }, ...extra,
  });
  const key = element({ value: 'synthetic-owner-download-key' });
  const choices = [element({ value: 'desktop', checked: true }), element({ value: 'android' })];
  const form = element({ reportValidity: () => true, elements: { namedItem: () => key }, querySelectorAll: () => choices });
  const submit = element(), retry = element(), status = element(), detail = element();
  const nodes = { '[data-v0-key-form]': form, '[data-v0-key-submit]': submit,
    '[data-v0-retry]': retry, '[data-v0-key-status]': status, '[data-v0-package-detail]': detail };
  const fetched = [], downloaded = [], decrypted = [];
  const deps = {
    artifactFor: (platform) => ({ ...ownerArtifact(platform), ready: true }),
    fetchPackage: async (platform) => { fetched.push(platform); return new Uint8Array([platform === 'desktop' ? 1 : 2]); },
    decrypt: async (bytes, value) => { decrypted.push({ bytes, value }); return bytes; },
    download: async (bytes, artifact) => downloaded.push({ bytes, artifact }),
    isFailure: (error, prefix) => error instanceof DownloadFailure && error.category.startsWith(prefix),
    ...overrides,
  };
  mountOwnerDownloads({ querySelector: (selector) => nodes[selector] }, deps);
  const choose = async (platform) => {
    for (const choice of choices) choice.checked = choice.value === platform;
    await choices.find((choice) => choice.checked).handlers.change();
  };
  const send = () => form.handlers.submit({ preventDefault() {} });
  return { key, choices, form, submit, retry, status, detail, fetched, downloaded, decrypted, choose, send };
}

test('platform selection dispatches matching package, filename and MIME using the same transient key', async () => {
  const fixture = uiFixture();
  await fixture.send();
  assert.deepEqual(fixture.fetched, ['desktop']);
  assert.equal(fixture.downloaded[0].artifact.filename, 'Skribli_0.1.51_x64-setup.exe');
  assert.equal(fixture.downloaded[0].artifact.mime, 'application/vnd.microsoft.portable-executable');
  assert.equal(fixture.key.value, '');
  await fixture.choose('android');
  fixture.key.value = 'synthetic-owner-download-key';
  await fixture.send();
  assert.deepEqual(fixture.fetched, ['desktop', 'android']);
  assert.equal(fixture.downloaded[1].artifact.filename, 'Skribli_Mobile_Preview_0.0.1_arm64.apk');
  assert.equal(fixture.downloaded[1].artifact.mime, 'application/vnd.android.package-archive');
  assert.equal(fixture.decrypted[0].value, fixture.decrypted[1].value);
  assert.equal(fixture.key.value, '');
  assert.match(fixture.status.textContent, /Android phone/);
});

test('changing platform after a successful retry cannot reuse a different platform ciphertext', async () => {
  const fixture = uiFixture();
  await fixture.retry.handlers.click();
  await fixture.choose('android');
  await fixture.send();
  assert.deepEqual(fixture.fetched, ['desktop', 'android']);
  assert.deepEqual([...fixture.decrypted[0].bytes], [2]);
});

test('an in-flight download locks platform and ignores duplicate submissions', async () => {
  let resolveFetch;
  let fetches = 0;
  const fixture = uiFixture({ fetchPackage: () => { fetches++; return new Promise((resolve) => { resolveFetch = resolve; }); } });
  const pending = fixture.send();
  assert.equal(fixture.key.value, '');
  assert.equal(fixture.key.disabled, true);
  assert.ok(fixture.choices.every((choice) => choice.disabled));
  await fixture.send();
  assert.equal(fetches, 1);
  resolveFetch(new Uint8Array([1]));
  await pending;
  assert.equal(fixture.downloaded.length, 1);
  assert.equal(fixture.key.disabled, false);
  assert.ok(fixture.choices.every((choice) => !choice.disabled));
});

test('failed authentication clears ciphertext and key, restores focus and fetches fresh on retry', async () => {
  let attempts = 0;
  const fixture = uiFixture({ decrypt: async (bytes) => {
    if (++attempts === 1) throw new DownloadFailure('authentication', 'synthetic rejection');
    return bytes;
  } });
  await fixture.send();
  assert.equal(fixture.key.value, '');
  assert.equal(fixture.key.focused, true);
  assert.equal(fixture.submit.disabled, false);
  assert.equal(fixture.status.dataset.state, 'error');
  fixture.key.value = 'another-synthetic-download-key';
  await fixture.send();
  assert.deepEqual(fixture.fetched, ['desktop', 'desktop']);
  assert.equal(fixture.downloaded.length, 1);
});

test('unavailable builds cannot submit or fetch and selection stays reversible', async () => {
  const fixture = uiFixture({ artifactFor: (platform) => ({ ...ownerArtifact(platform), ready: platform === 'desktop' }) });
  await fixture.choose('android');
  assert.equal(fixture.submit.disabled, true);
  await fixture.send();
  assert.equal(fixture.fetched.length, 0);
  await fixture.choose('desktop');
  assert.equal(fixture.submit.disabled, false);
});

test('platform allowlist rejects arbitrary URLs before any network call', async () => {
  let requests = 0;
  await assert.rejects(fetchEncryptedInstaller(async () => { requests++; }, 100, 'https://example.invalid/secret'),
    (error) => error.category === 'platform');
  assert.equal(requests, 0);
  await fetchEncryptedInstaller(async (url, options) => {
    assert.equal(url, '/assets/skribli-v0-windows.enc');
    assert.equal(options.cache, 'no-store');
    assert.equal(Object.hasOwn(options, 'body'), false);
    return responseFor(200);
  }, 100, 'desktop');
});
