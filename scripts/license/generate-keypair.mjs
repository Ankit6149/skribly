import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'signing');
const privateKeyPath = resolve(outputDirectory, 'skribly-license-private.pem');
const publicKeyPath = resolve(outputDirectory, 'skribly-license-public.txt');

await mkdir(outputDirectory, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicDer = publicKey.export({ type: 'spki', format: 'der' });
const rawPublicKey = publicDer.subarray(publicDer.length - 32);
const encodedPublicKey = rawPublicKey.toString('base64url');

await writeFile(privateKeyPath, privatePem, { encoding: 'utf8', mode: 0o600 });
await writeFile(publicKeyPath, `${encodedPublicKey}\n`, { encoding: 'utf8' });

console.log('Created a new Skribly Ed25519 licence keypair.');
console.log(`Private key: ${privateKeyPath}`);
console.log(`Public key:  ${publicKeyPath}`);
console.log('');
console.log('Keep the private PEM offline or in the payment backend secret store.');
console.log('Set SKRIBLY_LICENSE_PUBLIC_KEY to this public value when building paid releases:');
console.log(encodedPublicKey);
