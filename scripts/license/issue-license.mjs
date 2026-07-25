import { createPrivateKey, randomUUID, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [email, deviceId, updatesUntilInput, requestedLicenseId] = process.argv.slice(2);

if (!email || !deviceId || !updatesUntilInput) {
  console.error('Usage: node scripts/license/issue-license.mjs <email> <device-id> <updates-until ISO|epoch> [license-id]');
  process.exit(1);
}

const updatesUntil = /^\d+$/.test(updatesUntilInput)
  ? Number(updatesUntilInput)
  : Math.floor(new Date(updatesUntilInput).getTime() / 1000);

if (!Number.isFinite(updatesUntil) || updatesUntil <= 0) {
  console.error('updates-until must be a valid Unix timestamp or ISO date.');
  process.exit(1);
}

let privatePem = process.env.SKRIBLY_LICENSE_PRIVATE_KEY_PEM;
if (!privatePem) {
  const privatePath = resolve(process.cwd(), 'signing', 'skribly-license-private.pem');
  privatePem = await readFile(privatePath, 'utf8').catch(() => '');
}

if (!privatePem) {
  console.error('No signing key found. Set SKRIBLY_LICENSE_PRIVATE_KEY_PEM or generate signing/skribly-license-private.pem.');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const payload = {
  productId: 'skribly-personal-windows',
  licenseId: requestedLicenseId || randomUUID(),
  email: email.trim().toLowerCase(),
  deviceId: deviceId.trim(),
  issuedAt: now,
  updatesUntil,
  perpetual: true,
};

const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = sign(null, payloadBytes, createPrivateKey(privatePem));
const token = `${payloadBytes.toString('base64url')}.${signature.toString('base64url')}`;

console.log(JSON.stringify({ payload, token }, null, 2));
