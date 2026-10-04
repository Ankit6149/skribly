import { isMobileNote, type SharedSkrib } from "./mobile";

export const encryptedSyncEnvelopeVersion = 1 as const;
export const encryptedSyncAlgorithm = "AES-GCM-256" as const;

export interface EncryptedSyncEnvelope {
  envelopeVersion: typeof encryptedSyncEnvelopeVersion;
  documentType: "skrib";
  documentId: string;
  documentSchemaVersion: number;
  revision: number;
  updatedAt: number;
  deletedAt: number | null;
  deviceId: string;
  keyId: string;
  algorithm: typeof encryptedSyncAlgorithm;
  iv: string;
  ciphertext: string;
  ciphertextSha256: string;
}

export interface SyncCursor {
  updatedAt: number;
  documentId: string;
}

export interface SyncPullPage {
  envelopes: EncryptedSyncEnvelope[];
  nextCursor: SyncCursor | null;
}

type AuthenticatedEnvelopeMetadata = Pick<
  EncryptedSyncEnvelope,
  | "envelopeVersion"
  | "documentType"
  | "documentId"
  | "documentSchemaVersion"
  | "revision"
  | "updatedAt"
  | "deletedAt"
  | "deviceId"
  | "keyId"
  | "algorithm"
>;

/**
 * Network boundary only. Implementations transport opaque ciphertext and must
 * never receive a plaintext SharedSkrib or an encryption key.
 */
export interface EncryptedSyncTransport {
  push(envelopes: readonly EncryptedSyncEnvelope[]): Promise<void>;
  pull(cursor: SyncCursor | null, limit: number): Promise<SyncPullPage>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function authenticatedMetadataBytes(
  metadata: AuthenticatedEnvelopeMetadata,
): Uint8Array {
  // Keep this field order stable: it is part of the envelope v1 wire format.
  return new TextEncoder().encode(
    JSON.stringify({
      envelopeVersion: metadata.envelopeVersion,
      documentType: metadata.documentType,
      documentId: metadata.documentId,
      documentSchemaVersion: metadata.documentSchemaVersion,
      revision: metadata.revision,
      updatedAt: metadata.updatedAt,
      deletedAt: metadata.deletedAt,
      deviceId: metadata.deviceId,
      keyId: metadata.keyId,
      algorithm: metadata.algorithm,
    }),
  );
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", ownedBuffer(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createSyncKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSkribForSync(
  skrib: SharedSkrib,
  key: CryptoKey,
  metadata: { deviceId: string; keyId: string; iv?: Uint8Array },
): Promise<EncryptedSyncEnvelope> {
  if (!isMobileNote(skrib)) throw new Error("Cannot sync an invalid Skrib record.");
  if (!metadata.deviceId || !metadata.keyId)
    throw new Error("Encrypted sync requires a device and key identifier.");
  const iv = metadata.iv ?? crypto.getRandomValues(new Uint8Array(12));
  if (iv.byteLength !== 12) throw new Error("Encrypted sync requires a 96-bit IV.");
  const plaintext = new TextEncoder().encode(JSON.stringify(skrib));
  const authenticatedMetadata: AuthenticatedEnvelopeMetadata = {
    envelopeVersion: encryptedSyncEnvelopeVersion,
    documentType: "skrib",
    documentId: skrib.id,
    documentSchemaVersion: skrib.schemaVersion,
    revision: skrib.revision,
    updatedAt: skrib.updatedAt,
    deletedAt: skrib.trashedAt,
    deviceId: metadata.deviceId,
    keyId: metadata.keyId,
    algorithm: encryptedSyncAlgorithm,
  };
  const additionalData = authenticatedMetadataBytes(authenticatedMetadata);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ownedBuffer(iv),
      additionalData: ownedBuffer(additionalData),
    },
    key,
    ownedBuffer(plaintext),
  );
  const ciphertext = new Uint8Array(encrypted);
  return {
    ...authenticatedMetadata,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    ciphertextSha256: await sha256(ciphertext),
  };
}

export async function decryptSkribFromSync(
  envelope: EncryptedSyncEnvelope,
  key: CryptoKey,
): Promise<SharedSkrib> {
  if (
    envelope.envelopeVersion !== encryptedSyncEnvelopeVersion ||
    envelope.algorithm !== encryptedSyncAlgorithm ||
    envelope.documentType !== "skrib"
  ) {
    throw new Error("This encrypted sync envelope version is not supported.");
  }
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  if (iv.byteLength !== 12 || (await sha256(ciphertext)) !== envelope.ciphertextSha256)
    throw new Error("Encrypted sync envelope integrity check failed.");
  const additionalData = authenticatedMetadataBytes(envelope);
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ownedBuffer(iv),
        additionalData: ownedBuffer(additionalData),
      },
      key,
      ownedBuffer(ciphertext),
    );
  } catch {
    throw new Error("Encrypted sync envelope authentication failed.");
  }
  const value: unknown = JSON.parse(new TextDecoder().decode(decrypted));
  if (!isMobileNote(value)) throw new Error("Decrypted Skrib record is invalid.");
  if (
    value.id !== envelope.documentId ||
    value.schemaVersion !== envelope.documentSchemaVersion ||
    value.revision !== envelope.revision ||
    value.updatedAt !== envelope.updatedAt
  ) {
    throw new Error("Encrypted sync metadata does not match its Skrib.");
  }
  return value;
}
