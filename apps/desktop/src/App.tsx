import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { LibraryHost } from './features/library/LibraryHost';
import { OverlayHost } from './features/overlay/OverlayHost';
import { HomeHost } from './features/account/HomeHost';
import { ContextRail } from './features/rail/ContextRail';
import { useLicenseStore } from './stores/licenseStore';

export function App() {
  const initWriteStatus = useLicenseStore((state) => state.init);
  const windowLabel = getCurrentWindow().label;
  const isLibraryWindow = windowLabel === 'library';
  const isHomeWindow = windowLabel === 'home';
  const isRailWindow = windowLabel === 'rail';

  useEffect(() => {
    void initWriteStatus();
  }, [initWriteStatus]);

  useEffect(() => {
    document.documentElement.dataset.skriblyWindow = windowLabel;
    return () => {
      delete document.documentElement.dataset.skriblyWindow;
    };
  }, [windowLabel]);

  return (
    <main
      className={
        isLibraryWindow
          ? 'app-library-root'
          : isHomeWindow
            ? 'app-home-root'
            : isRailWindow
              ? 'app-rail-root'
              : 'app-overlay-root'
      }
    >
      {isLibraryWindow ? (
        <LibraryHost />
      ) : isHomeWindow ? (
        <HomeHost />
      ) : isRailWindow ? (
        <ContextRail />
      ) : (
        <OverlayHost />
      )}
    </main>
  );
}
