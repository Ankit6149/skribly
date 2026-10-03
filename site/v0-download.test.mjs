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
