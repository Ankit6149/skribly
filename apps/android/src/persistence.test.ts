import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { MobileNote } from "@skribly/shared";

const note: MobileNote = {
  schemaVersion: 1,
  id: "synthetic",
  text: "First thought",
  colour: "mint",
  createdAt: 10,
  updatedAt: 10,
  revision: 1,
  trashedAt: null,
};
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
});

describe("atomic mobile persistence", () => {
  it("saves and reads after transaction completion", async () => {
    const store = await import("./persistence");
    await store.saveNote(note, null);
    expect(await store.listNotes()).toEqual([note]);
  });
  it("permits exactly one concurrent edit of the same revision", async () => {
    const store = await import("./persistence");
    await store.saveNote(note, null);
    const results = await Promise.allSettled([
      store.saveNote(
        { ...note, text: "Edit A", revision: 2, updatedAt: 20 },
        1,
      ),
      store.saveNote(
        { ...note, text: "Edit B", revision: 2, updatedAt: 20 },
        1,
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect((await store.listNotes())[0]?.revision).toBe(2);
  });
  it("does not replace an existing ID with a new draft", async () => {
    const store = await import("./persistence");
    await store.saveNote(note, null);
    await expect(
      store.saveNote({ ...note, text: "Replacement" }, null),
    ).rejects.toThrow("another window");
    expect(await store.listNotes()).toEqual([note]);
  });
  it("keeps note text through Trash and restore", async () => {
    const store = await import("./persistence");
    await store.saveNote(note, null);
    await store.saveNote(
      { ...note, trashedAt: 20, updatedAt: 20, revision: 2 },
      1,
    );
    await store.saveNote({ ...note, updatedAt: 30, revision: 3 }, 2);
    expect(await store.listNotes()).toEqual([
      { ...note, updatedAt: 30, revision: 3 },
    ]);
  });
  it("fails closed on a future record and leaves its bytes unchanged", async () => {
    const store = await import("./persistence");
    await store.listNotes();
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("skribli-android-local-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const future = { ...note, schemaVersion: 99, text: "Preserve this record" };
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("notes", "readwrite");
      transaction.objectStore("notes").put(future);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    await expect(store.listNotes()).rejects.toThrow("recovery");
    await expect(store.saveNote({ ...note, revision: 2 }, 1)).rejects.toThrow(
      "another window",
    );
    const kept = await new Promise<unknown>((resolve, reject) => {
      const request = db
        .transaction("notes", "readonly")
        .objectStore("notes")
        .get(note.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(kept).toEqual(future);
    db.close();
  });
  it("rejects a revision skip and invalid draft before changing content", async () => {
    const store = await import("./persistence");
    await store.saveNote(note, null);
    await expect(store.saveNote({ ...note, revision: 3 }, 1)).rejects.toThrow(
      "another window",
    );
    await expect(
      store.saveNote({ ...note, text: "x".repeat(100_001), revision: 2 }, 1),
    ).rejects.toThrow("too large");
    expect(await store.listNotes()).toEqual([note]);
  });
});
