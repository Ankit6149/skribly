import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [inputPath, outputPath, downloadKey] = process.argv.slice(2);
if (!inputPath || !outputPath || !downloadKey || downloadKey.length < 24) {
  throw new Error('Usage: node encrypt-v0-artifact.mjs <input.zip> <output.enc> <key-at-least-24-characters>');
}

const magic = Buffer.from('SKRV0E01', 'ascii');
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(downloadKey, salt, 210_000, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const plaintext = await readFile(inputPath);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.concat([magic, salt, iv, ciphertext]));
console.log(`Encrypted ${plaintext.length} bytes for owner-key delivery.`);
