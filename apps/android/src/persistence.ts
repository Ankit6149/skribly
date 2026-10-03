import { isMobileNote, type MobileNote } from "@skribly/shared";

const databaseName = "skribli-android-local-v1";
const storeName = "notes";
let pendingDatabase: Promise<IDBDatabase> | undefined;

function database(): Promise<IDBDatabase> {
  if (!pendingDatabase) {
    pendingDatabase = new Promise<IDBDatabase>((resolve, reject) => {
      let abandoned = false;
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(storeName, { keyPath: "id" });
      request.onerror = () => {
        abandoned = true;
        reject(
          new Error(
            "Local storage is unavailable. Your draft has not been saved.",
          ),
        );
      };
      request.onblocked = () => {
        abandoned = true;
        reject(
          new Error("Close another Skribli window, then retry local storage."),
        );
      };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          pendingDatabase = undefined;
        };
        resolve(db);
      };
    }).catch((error) => {
      pendingDatabase = undefined;
      throw error;
    });
  }
  return pendingDatabase;
}

/** Never replace malformed/future records with an empty library. */
export async function listNotes(): Promise<MobileNote[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    let result: MobileNote[];
    request.onsuccess = () => {
      if (
        !Array.isArray(request.result) ||
        !request.result.every(isMobileNote)
      ) {
        transaction.abort();
        reject(
          new Error(
            "Some local records need recovery. They have been kept unchanged.",
          ),
        );
        return;
      }
      result = request.result;
    };
    transaction.oncomplete = () =>
      resolve(result.sort((a, b) => b.updatedAt - a.updatedAt));
    transaction.onerror = transaction.onabort = () =>
      reject(
        new Error(
          "Could not read local Skribs. Stored records have been kept.",
        ),
      );
  });
}

/** Compare revision and write in ONE readwrite transaction. Success means transaction complete. */
export async function saveNote(
  note: MobileNote,
  expectedRevision: number | null,
): Promise<void> {
  if (!isMobileNote(note))
    throw new Error(
      "This draft is invalid or too large. It has not been saved.",
    );
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.get(note.id);
    let failure =
      "Could not save locally. Your draft is still open; please retry.";
    request.onsuccess = () => {
      const current: unknown = request.result;
      const matches =
        expectedRevision === null
          ? current === undefined && note.revision === 1
          : isMobileNote(current) &&
            current.revision === expectedRevision &&
            note.revision === expectedRevision + 1;
      if (!matches) {
        failure =
          "This Skrib changed in another window. Your draft is still open; return to the library to reload it.";
        transaction.abort();
        return;
      }
      store.put(note);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () =>
      reject(new Error(failure));
  });
}
