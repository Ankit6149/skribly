import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { useLicenseStore } from '../stores/licenseStore';
import { ContextWidgetWindow } from '../windows/context-widget/ContextWidgetWindow';
import { HomeWindow } from '../windows/home/HomeWindow';
import { NoteWindow } from '../windows/note/NoteWindow';
import { GlobalWidgetHandleWindow } from '../windows/widget/GlobalWidgetHandleWindow';
import { GlobalWidgetWindow } from '../windows/widget/GlobalWidgetWindow';
import { classifyWindow, resolveWindowLabel } from './windowRouter';

export function App() {
  const initWriteStatus = useLicenseStore((state) => state.init);
  const windowLabel = resolveWindowLabel({
    nativeLabel: getCurrentWindow().label,
    isDev: import.meta.env.DEV,
    search: typeof window !== 'undefined' ? window.location.search : '',
  });
  const windowKind = classifyWindow(windowLabel);
  const previewWindow =
    import.meta.env.DEV && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('skriblyWindow')
      : null;

  useEffect(() => {
    if (previewWindow) return;
    void initWriteStatus();
  }, [initWriteStatus, previewWindow]);

  useEffect(() => {
    document.documentElement.dataset.skriblyWindow = windowLabel;
    return () => {
      delete document.documentElement.dataset.skriblyWindow;
    };
  }, [windowLabel]);

  return (
    <main
      className={
        windowKind === 'home'
          ? 'app-home-root'
          : windowKind === 'rail'
            ? 'app-rail-root'
            : 'app-overlay-root'
      }
    >
      {windowLabel === 'home' ? (
        <HomeWindow />
      ) : windowLabel === 'global-rail-handle' ? (
        <GlobalWidgetHandleWindow />
      ) : windowLabel === 'context-rail' ? (
        <ContextWidgetWindow />
      ) : windowLabel === 'rail' ? (
        <GlobalWidgetWindow />
      ) : (
        <NoteWindow />
      )}
    </main>
  );
}
