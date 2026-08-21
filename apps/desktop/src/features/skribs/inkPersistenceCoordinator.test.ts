import { describe, expect, it } from 'vitest';
import { type InkStroke } from './inkModel';
import { InkPersistenceCoordinator, type InkPersistenceSnapshot } from './inkPersistenceCoordinator';

function stroke(id: string): InkStroke {
  return {
    id,
    tool: 'pen',
    color: '#262923',
    width: 4,
    points: [{ x: 0.25, y: 0.5, pressure: 0.5 }],
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('InkPersistenceCoordinator', () => {
  it('keeps rapid optimistic strokes when an older parent acknowledgement arrives', async () => {
    const firstSaveStarted = deferred();
    const allowFirstSave = deferred();
    const persisted: InkStroke[][] = [];
    const coordinator = new InkPersistenceCoordinator([]);
    const first = stroke('first');
    const second = stroke('second');
    let callCount = 0;
    const persist = async (strokes: InkStroke[]) => {
      callCount += 1;
      if (callCount === 1) {
        firstSaveStarted.resolve();
        await allowFirstSave.promise;
      }
      persisted.push(strokes);
    };

    const firstSave = coordinator.submit([first], persist);
    await firstSaveStarted.promise;
    const secondSave = coordinator.submit([first, second], persist);

    expect(coordinator.acceptInitialStrokes([first])).toBe(false);
    expect(coordinator.getSnapshot().strokes).toEqual([first, second]);

    allowFirstSave.resolve();
    await Promise.all([firstSave, secondSave]);

    expect(persisted).toEqual([[first], [first, second]]);
    expect(coordinator.getSnapshot()).toMatchObject({
      strokes: [first, second],
      status: 'idle',
      hasUnsavedChanges: false,
      error: null,
    });
  });

  it('keeps a failed drawing dirty and observable until the complete drawing saves', async () => {
    const coordinator = new InkPersistenceCoordinator([]);
    const snapshots: InkPersistenceSnapshot[] = [];
    const first = stroke('first');
    coordinator.setListener((snapshot) => snapshots.push(snapshot));

    expect(await coordinator.submit([first], async () => {
      throw new Error('disk unavailable');
    })).toBe(false);

    expect(coordinator.getSnapshot()).toMatchObject({
      strokes: [first],
      status: 'error',
      hasUnsavedChanges: true,
      error: 'disk unavailable',
    });
    expect(coordinator.acceptInitialStrokes([])).toBe(false);
    expect(snapshots.at(-1)).toMatchObject({ status: 'error', hasUnsavedChanges: true });

    expect(await coordinator.submit([first], async () => undefined)).toBe(true);
    expect(coordinator.getSnapshot()).toMatchObject({
      strokes: [first],
      status: 'idle',
      hasUnsavedChanges: false,
      error: null,
    });
  });
});
