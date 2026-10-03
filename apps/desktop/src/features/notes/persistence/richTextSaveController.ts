export interface RichTextDraft { html: string; plainText: string }

/** One owner for pending formatting. A rejected old write never replaces a newer edit. */
export class RichTextSaveController {
  private pending: RichTextDraft | null = null;
  private inFlight: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = true;

  constructor(private readonly persist: (draft: RichTextDraft) => Promise<void>,
    private readonly onError: (reason: unknown) => void, private readonly delay = 320,
    private readonly onPendingChange?: (pending: boolean) => void) {}

  setDraft(draft: RichTextDraft): void {
    this.pending = draft;
    this.onPendingChange?.(true);
    this.clearTimer();
    if (this.active) this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.delay);
  }

  getPending(): RichTextDraft | null { return this.pending; }

  activate(): void { this.active = true; if (this.pending) this.setDraft(this.pending); }
  suspend(): void { this.active = false; this.clearTimer(); }

  async flush(): Promise<boolean> {
    this.clearTimer();
    if (!this.active) return false;
    if (this.inFlight) return this.inFlight;
    const task = this.drain();
    const tracked = task.finally(() => { if (this.inFlight === tracked) this.inFlight = null; });
    this.inFlight = tracked;
    return tracked;
  }

  private async drain(): Promise<boolean> {
    while (this.active && this.pending) {
      const draft = this.pending;
      try { await this.persist(draft); }
      catch (reason) { this.onError(reason); return false; }
      if (this.pending === draft) this.pending = null;
      if (this.active) this.onPendingChange?.(Boolean(this.pending));
    }
    return !this.pending;
  }

  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = null; }
}
