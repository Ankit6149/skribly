import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import type { RailWindowState } from './railWindowState';
import '../../styles/context-rail.css';

/** A separate, widget-sized window keeps the edge handle outside the panel. */
export function GlobalPanelHandle() {
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');

  useEffect(() => {
    let live = true;
    let unlisten: (() => void) | undefined;
    void invoke<RailWindowState>('get_rail_window_state', { contextual: false })
      .then((state) => { if (live) setDockSide(state.dockSide ?? 'right'); });
    void listen<'left' | 'right'>('skribly://global-rail-handle-state', ({ payload }) => {
      if (live) setDockSide(payload);
    }).then((release) => {
      if (!live) release();
      else unlisten = release;
    });
    return () => { live = false; unlisten?.(); };
  }, []);

  const close = () => {
    void emitTo('rail', 'skribly://global-rail-dismiss').catch(() => {
      void invoke('set_context_rail_expanded', { contextual: false, expanded: false });
    });
  };

  return <main className={`context-rail collapsed global-widget dock-${dockSide}`}>
    <button type="button" className="context-rail-global-widget" onClick={close}
      aria-label="Close My Skribs panel" title="Close My Skribs panel">
      <span className="global-widget-strip strip-yellow" aria-hidden="true" />
      <span className="global-widget-strip strip-peach" aria-hidden="true" />
      <span className="global-widget-strip strip-lavender" aria-hidden="true" />
    </button>
  </main>;
}
