import { describe, expect, it } from "vitest";
import {
  createSyncKey,
  decryptSkribFromSync,
  encryptSkribForSync,
  type SharedSkrib,
} from "@skribly/shared";

const note: SharedSkrib = {
  schemaVersion: 2,
  documentType: "skrib",
  id: "private-note",
  text: "A secret thought",
  colour: "lavender",
  context: null,
  reminder: null,
  createdAt: 10,
  updatedAt: 20,
  revision: 3,
  archivedAt: null,
  trashedAt: null,
};

describe("encrypted sync boundary", () => {
  it("round trips a Skrib without placing plaintext in the transport envelope", async () => {
    const key = await createSyncKey();
    const envelope = await encryptSkribForSync(note, key, {
      deviceId: "phone-1",
      keyId: "vault-1",
      iv: new Uint8Array(12).fill(7),
    });
    expect(JSON.stringify(envelope)).not.toContain(note.text);
    await expect(decryptSkribFromSync(envelope, key)).resolves.toEqual(note);
  });

  it("rejects tampered ciphertext before parsing it", async () => {
    const key = await createSyncKey();
    const envelope = await encryptSkribForSync(note, key, {
      deviceId: "phone-1",
      keyId: "vault-1",
    });
    await expect(
      decryptSkribFromSync({ ...envelope, ciphertextSha256: "0".repeat(64) }, key),
    ).rejects.toThrow("integrity");
  });

  it("authenticates routing and deletion metadata with the ciphertext", async () => {
    const key = await createSyncKey();
    const envelope = await encryptSkribForSync(note, key, {
      deviceId: "phone-1",
      keyId: "vault-1",
    });
    await expect(
      decryptSkribFromSync({ ...envelope, deletedAt: 42 }, key),
    ).rejects.toThrow("authentication");
    await expect(
      decryptSkribFromSync({ ...envelope, keyId: "attacker-key" }, key),
    ).rejects.toThrow("authentication");
  });
});
