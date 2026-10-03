import { listen } from '@tauri-apps/api/event';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAttachmentObjectUrl,
  formatAttachmentSize,
  getRichContent,
  revokeAttachmentObjectUrl,
  type SkribAttachment,
} from '../notes/persistence/richContentStore';
import { listReminders, type ReminderWithStatus } from '../reminders/persistence/reminderStore';

interface LibraryRichContentProps {
  noteId: string;
}

function formatDue(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export const LibraryRichContent: React.FC<LibraryRichContentProps> = ({ noteId }) => {
  const [attachments, setAttachments] = useState<SkribAttachment[]>([]);
  const [inkStrokeCount, setInkStrokeCount] = useState(0);
  const [reminders, setReminders] = useState<ReminderWithStatus[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setIsLoading(true);
    try {
      const [richContent, allReminders] = await Promise.all([getRichContent(noteId), listReminders()]);
      if (generation !== requestGeneration.current) return;
      setAttachments(richContent.attachments);
      setInkStrokeCount(richContent.inkDocument?.strokes.length ?? 0);
      setReminders(allReminders.filter((reminder) => reminder.noteId === noteId));
      setLoadedNoteId(noteId);
      setError(null);
    } catch (reason) {
      if (generation !== requestGeneration.current) return;
      setLoadedNoteId(noteId);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (generation === requestGeneration.current) setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void refresh();
    return () => { requestGeneration.current += 1; };
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void Promise.all(
      ['skribly://reminders-updated', 'skribly://rich-content-updated'].map((eventName) =>
        listen(eventName, () => {
          if (!disposed) void refresh();
        })
      )
    ).then((callbacks) => {
      if (disposed) callbacks.forEach((callback) => callback());
      else unlisten = () => callbacks.forEach((callback) => callback());
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [refresh]);

  useEffect(() => {
    const next: Record<string, string> = {};
    attachments.forEach((attachment) => {
      try {
        next[attachment.id] = createAttachmentObjectUrl(attachment);
      } catch {
        // Keep the attachment metadata visible if the preview URL is unavailable.
      }
    });
    setUrls(next);
    return () => Object.values(next).forEach(revokeAttachmentObjectUrl);
  }, [attachments]);

  const visibleAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.kind !== 'ink'),
    [attachments]
  );

  if (loadedNoteId !== noteId) {
    return isLoading ? <div className="library-state" role="status">Loading saved files…</div> : null;
  }
  if (error) return <div className="library-rich-error" role="alert">Rich note data unavailable: {error}</div>;
  if (visibleAttachments.length === 0 && inkStrokeCount === 0 && reminders.length === 0) return null;

  return (
    <section className="library-rich-content" aria-label="Drawing, attachments, and reminders">
      {inkStrokeCount > 0 && (
        <div className="library-rich-summary">
          <span className="library-kicker">DRAWING</span>
          <strong>{inkStrokeCount.toLocaleString()} editable stroke{inkStrokeCount === 1 ? '' : 's'}</strong>
          <span>Open the Skrib from its context to continue drawing.</span>
        </div>
      )}

      {visibleAttachments.length > 0 && (
        <div className="library-rich-section">
          <div className="library-rich-heading">
            <span className="library-kicker">ATTACHMENTS</span>
            <span>{visibleAttachments.length.toLocaleString()} local files</span>
          </div>
          <div className="library-rich-attachments">
            {visibleAttachments.map((attachment) => {
              const url = urls[attachment.id];
              return (
                <article key={attachment.id}>
                  <div className="library-rich-preview">
                    {attachment.kind === 'image' && url ? (
                      <img src={url} alt="" />
                    ) : attachment.kind === 'video' && url ? (
                      <video controls preload="metadata" aria-label={attachment.name}>
                        <source src={url} type={attachment.mimeType} />
                      </video>
                    ) : (
                      <span aria-hidden="true">{attachment.kind === 'video' ? 'VID' : 'DOC'}</span>
                    )}
                  </div>
                  <div>
                    <strong title={attachment.name}>{attachment.name}</strong>
                    <span>{formatAttachmentSize(attachment.size)}</span>
                  </div>
                  {url && <a href={url} download={attachment.name}>Open copy</a>}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {reminders.length > 0 && (
        <div className="library-rich-section">
          <div className="library-rich-heading">
            <span className="library-kicker">REMINDERS</span>
            <span>{reminders.length.toLocaleString()} linked</span>
          </div>
          <div className="library-rich-reminders">
            {reminders.map((reminder) => (
              <div key={reminder.id} className={reminder.status}>
                <span>{reminder.status}</span>
                <strong>{formatDue(reminder.dueAt)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
