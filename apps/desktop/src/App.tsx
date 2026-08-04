import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { LibraryHost } from './features/library/LibraryHost';
import { OverlayHost } from './features/overlay/OverlayHost';
import { useLicenseStore } from './stores/licenseStore';

export function App() {
  const initWriteStatus = useLicenseStore((state) => state.init);
  const windowLabel = getCurrentWindow().label;
  const isLibraryWindow = windowLabel === 'library';

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
    <main className={isLibraryWindow ? 'app-library-root' : 'app-overlay-root'}>
      {isLibraryWindow ? <LibraryHost /> : <OverlayHost />}
    </main>
  );
}
