export const MAX_NOTE_CHARACTERS = 20_000;
export const DEFAULT_DRAFT_SAVE_DELAY_MS = 350;

export type DraftSaveStatus = 'saved' | 'dirty' | 'saving' | 'failed';

export interface DraftSaveSnapshot {
  draft: string;
  committed: string;
  status: DraftSaveStatus;
  error: string | null;
  characterCount: number;
  maxCharacters: number;
}

export interface DraftChangeResult {
  accepted: boolean;
  error: string | null;
}

interface DraftSaveControllerOptions {
  initialText: string;
  persist: (draft: string) => Promise<boolean>;
  onChange?: (snapshot: DraftSaveSnapshot) => void;
  debounceMs?: number;
  maxCharacters?: number;
}

export function countNoteCharacters(text: string): number {
  return Array.from(text).length;
}

export class DraftSaveController {
  private draft: string;
  private committed: string;
  private status: DraftSaveStatus = 'saved';
  private error: string | null = null;
  private readonly persist: (draft: string) => Promise<boolean>;
  private readonly onChange: ((snapshot: DraftSaveSnapshot) => void) | undefined;
  private listeners = new Set<(snapshot: DraftSaveSnapshot) => void>();
  private readonly debounceMs: number;
  private readonly maxCharacters: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private drainPromise: Promise<boolean> | null = null;
  private disposed = false;
  private deletePrepared = false;

  constructor(options: DraftSaveControllerOptions) {
    this.draft = options.initialText;
    this.committed = options.initialText;
    this.persist = options.persist;
    this.onChange = options.onChange;
    this.debounceMs = options.debounceMs ?? DEFAULT_DRAFT_SAVE_DELAY_MS;
    this.maxCharacters = options.maxCharacters ?? MAX_NOTE_CHARACTERS;
  }

  getSnapshot(): DraftSaveSnapshot {
    return {
      draft: this.draft,
      committed: this.committed,
      status: this.status,
      error: this.error,
      characterCount: countNoteCharacters(this.draft),
      maxCharacters: this.maxCharacters,
    };
  }

  subscribe(listener: (snapshot: DraftSaveSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  setDraft(nextDraft: string): DraftChangeResult {
    if (this.disposed || this.deletePrepared) {
      return {
        accepted: false,
        error: 'This note is already closing and cannot accept more changes.',
      };
    }

    const characterCount = countNoteCharacters(nextDraft);
    if (characterCount > this.maxCharacters) {
      return {
        accepted: false,
        error: `A Skribli note can contain up to ${this.maxCharacters.toLocaleString()} characters.`,
      };
    }

    this.draft = nextDraft;
    this.error = null;

    if (this.draft === this.committed && !this.drainPromise) {
      this.clearTimer();
      this.status = 'saved';
    } else {
      this.status = 'dirty';
      if (!this.drainPromise) this.scheduleSave();
    }

    this.emit();
    return { accepted: true, error: null };
  }

  acceptCommittedText(text: string): void {
    if (this.disposed || this.deletePrepared || this.drainPromise || this.draft !== this.committed) {
      return;
    }
    this.draft = text;
    this.committed = text;
    this.status = 'saved';
    this.error = null;
    this.emit();
  }

  async flush(): Promise<boolean> {
    if (this.disposed || this.deletePrepared) return false;
    this.clearTimer();
    if (this.draft === this.committed) {
      this.status = 'saved';
      this.error = null;
      this.emit();
      return true;
    }
    return this.ensureDrain();
  }

  retry(): Promise<boolean> {
    return this.flush();
  }

  async prepareForDelete(): Promise<void> {
    if (this.disposed) return;
    this.clearTimer();
    this.deletePrepared = true;
    if (this.drainPromise) await this.drainPromise;
  }

  resumeAfterDeleteFailure(message: string): void {
    if (this.disposed) return;
    this.deletePrepared = false;
    this.status = this.draft === this.committed ? 'saved' : 'failed';
    this.error = message;
    this.emit();
  }

  dispose(): void {
    this.clearTimer();
    this.disposed = true;
  }

  private scheduleSave(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.ensureDrain();
    }, this.debounceMs);
  }

  private ensureDrain(): Promise<boolean> {
    if (this.drainPromise) return this.drainPromise;

    const task = this.drain();
    const tracked = task.finally(() => {
      if (this.drainPromise === tracked) this.drainPromise = null;
    });
    this.drainPromise = tracked;
    return tracked;
  }

  private async drain(): Promise<boolean> {
    while (!this.disposed && !this.deletePrepared && this.draft !== this.committed) {
      const draftToPersist = this.draft;
      this.status = 'saving';
      this.error = null;
      this.emit();

      let saved = false;
      try {
        saved = await this.persist(draftToPersist);
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      }

      if (this.disposed) return false;

      if (!saved) {
        this.status = 'failed';
        this.error ||= 'The latest text could not be saved.';
        this.emit();
        return false;
      }

      this.committed = draftToPersist;
      this.status = this.draft === this.committed ? 'saved' : 'dirty';
      this.error = null;
      this.emit();
    }

    return this.draft === this.committed;
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    if (this.disposed) return;
    const snapshot = this.getSnapshot();
    this.onChange?.(snapshot);
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
