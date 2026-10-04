import type React from 'react';
import { AppWindow } from 'lucide-react';

export function NotePlaceHeader({
  contextTabRef,
  contextLabel,
  contextFullAppLabel,
  appIconUrl,
  isNewNote,
  hasSavedContext,
  placeDetailOpen,
  onPlaceDetailOpen,
}: {
  contextTabRef: React.Ref<HTMLDivElement>;
  contextLabel: string;
  contextFullAppLabel: string;
  appIconUrl: string | null;
  isNewNote: boolean;
  hasSavedContext: boolean;
  placeDetailOpen: boolean;
  onPlaceDetailOpen: (open: boolean) => void;
}) {
  return (
    <>
      <header className="composer-paper-top" data-tauri-drag-region>
        {hasSavedContext && (
          <div
            ref={contextTabRef}
            className="composer-context-tab"
            data-tauri-drag-region
            tabIndex={0}
            aria-label={`Place: ${contextLabel}`}
            aria-describedby="composer-place-detail"
            onPointerEnter={() => onPlaceDetailOpen(true)}
            onPointerLeave={() => onPlaceDetailOpen(false)}
            onFocus={() => onPlaceDetailOpen(true)}
            onBlur={() => onPlaceDetailOpen(false)}
          >
            {appIconUrl ? (
              <img
                className="composer-context-app-icon"
                src={appIconUrl}
                alt=""
                aria-hidden="true"
                data-tauri-drag-region
              />
            ) : (
              <AppWindow size={20} strokeWidth={1.8} aria-hidden="true" data-tauri-drag-region />
            )}
          </div>
        )}
        <span id="composer-open-state" className="sr-only">
          {hasSavedContext
            ? isNewNote
              ? 'Skribli created a new empty Skrib for this application context.'
              : 'Skribli reopened the existing Skrib for this application context.'
            : isNewNote
              ? 'Skribli created a new general Skrib without an application context.'
              : 'Skribli opened this general Skrib without an application context.'}
        </span>
      </header>
      {hasSavedContext && (
        <div
          id="composer-place-detail"
          className="composer-place-detail"
          role="note"
          data-open={placeDetailOpen}
        >
          <small>Saved place</small>
          <strong>{contextFullAppLabel}</strong>
          <span>{contextLabel}</span>
        </div>
      )}
    </>
  );
}
