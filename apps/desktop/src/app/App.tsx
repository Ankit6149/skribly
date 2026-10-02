import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { HomeHost } from '../features/account/HomeHost';
import { OverlayHost } from '../features/overlay/OverlayHost';
import { ContextRail } from '../features/rail/ContextRail';
import { GlobalPanelHandle } from '../features/rail/GlobalPanelHandle';
import { useLicenseStore } from '../stores/licenseStore';
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
      {windowKind === 'home' ? (
        <HomeHost />
      ) : windowLabel === 'global-rail-handle' ? (
        <GlobalPanelHandle />
      ) : windowKind === 'rail' ? (
        <ContextRail contextual={windowLabel === 'context-rail'} />
      ) : (
        <OverlayHost />
      )}
    </main>
  );
}
