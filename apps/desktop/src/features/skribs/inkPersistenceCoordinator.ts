import { validateInkStrokes, type InkStroke } from './inkModel';

export type InkPersistenceStatus = 'idle' | 'saving' | 'error';

export interface InkPersistenceState {
  status: InkPersistenceStatus;
  hasUnsavedChanges: boolean;
  error: string | null;
}

export interface InkPersistenceSnapshot extends InkPersistenceState {
  strokes: InkStroke[];
}

type SnapshotListener = (snapshot: InkPersistenceSnapshot) => void;

export class InkPersistenceCoordinator {
  private strokes: InkStroke[];
  private submittedRevision = 0;
  private persistedRevision = 0;
  private pendingOperations = 0;
  private persistenceChain: Promise<void> = Promise.resolve();
  private persistenceError: string | null = null;
  private listener: SnapshotListener | undefined;

  constructor(initialStrokes: InkStroke[]) {
    validateInkStrokes(initialStrokes);
    this.strokes = initialStrokes;
  }

  getSnapshot(): InkPersistenceSnapshot {
    const hasUnsavedChanges = this.submittedRevision > this.persistedRevision;
    return {
      strokes: this.strokes,
      status: this.pendingOperations > 0 ? 'saving' : hasUnsavedChanges ? 'error' : 'idle',
      hasUnsavedChanges,
      error: hasUnsavedChanges ? this.persistenceError : null,
    };
  }

  setListener(listener?: SnapshotListener): void {
    this.listener = listener;
    listener?.(this.getSnapshot());
  }

  acceptInitialStrokes(strokes: InkStroke[]): boolean {
    validateInkStrokes(strokes);
    const snapshot = this.getSnapshot();
    if (this.pendingOperations > 0 || snapshot.hasUnsavedChanges) return false;
    this.strokes = strokes;
    this.persistenceError = null;
    this.emit();
    return true;
  }

  submit(strokes: InkStroke[], persist: (strokes: InkStroke[]) => Promise<void>): Promise<boolean> {
    validateInkStrokes(strokes);
    this.strokes = strokes;
    const revision = ++this.submittedRevision;
    this.pendingOperations += 1;
    this.persistenceError = null;
    this.emit();

    const operation = this.persistenceChain
      .catch(() => undefined)
      .then(() => persist(strokes));
    this.persistenceChain = operation;

    return operation
      .then(
        () => {
          this.persistedRevision = Math.max(this.persistedRevision, revision);
          if (this.persistedRevision >= this.submittedRevision) this.persistenceError = null;
          return true;
        },
        (reason: unknown) => {
          if (revision > this.persistedRevision) {
            this.persistenceError = reason instanceof Error ? reason.message : String(reason);
          }
          return false;
        }
      )
      .finally(() => {
        this.pendingOperations = Math.max(0, this.pendingOperations - 1);
        this.emit();
      });
  }

  private emit(): void {
    this.listener?.(this.getSnapshot());
  }
}
