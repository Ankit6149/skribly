import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { OverlayHost } from './features/overlay/OverlayHost';
import { HomeHost } from './features/account/HomeHost';
import { ContextRail } from './features/rail/ContextRail';
import { useLicenseStore } from './stores/licenseStore';

export function App() {
  const initWriteStatus = useLicenseStore((state) => state.init);
  const previewWindow = import.meta.env.DEV && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('skriblyWindow')
    : null;
  const windowLabel = previewWindow === 'rail'
    ? (new URLSearchParams(window.location.search).get('railMode') === 'context' ? 'context-rail' : 'rail')
    : getCurrentWindow().label;
  const isHomeWindow = windowLabel === 'home';
  const isRailWindow = windowLabel === 'rail' || windowLabel === 'context-rail';

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
        isHomeWindow
            ? 'app-home-root'
            : isRailWindow
              ? 'app-rail-root'
              : 'app-overlay-root'
      }
    >
      {isHomeWindow ? (
        <HomeHost />
      ) : isRailWindow ? (
        <ContextRail contextual={windowLabel === 'context-rail'} />
      ) : (
        <OverlayHost />
      )}
    </main>
  );
}
