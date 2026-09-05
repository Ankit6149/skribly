import React from 'react';
import { LoaderCircle, MapPinCheckInside } from 'lucide-react';
import skriblyLogo from '../../../src-tauri/icons/128x128.png';
import type { OpenNoteProgress } from './openNoteContext';

interface OpeningJourneyProps {
  progress: OpenNoteProgress;
  compact?: boolean;
}

export const OpeningJourney: React.FC<OpeningJourneyProps> = ({ progress, compact = false }) => (
  <div
    className={`opening-journey ${compact ? 'compact' : ''}`}
    data-phase={progress.phase}
    role="status"
    aria-live="polite"
    aria-label={`${progress.title} ${progress.detail}`}
  >
    <div className="opening-journey-mark" aria-hidden="true">
      <img src={skriblyLogo} alt="" />
      <span className="opening-journey-status">
        {progress.phase === 'complete' ? (
          <MapPinCheckInside size={14} />
        ) : (
          <LoaderCircle size={14} />
        )}
      </span>
    </div>
    <div className="opening-journey-copy">
      <strong>{progress.title}</strong>
      <span>{progress.detail}</span>
    </div>
    <span className="opening-journey-track" aria-hidden="true">
      <i />
    </span>
  </div>
);
