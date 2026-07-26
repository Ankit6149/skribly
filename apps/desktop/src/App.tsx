import { useEffect } from "react";
import { OverlayHost } from "./features/overlay/OverlayHost";
import { useLicenseStore } from "./stores/licenseStore";

export function App() {
  const initWriteStatus = useLicenseStore((state) => state.init);

  useEffect(() => {
    void initWriteStatus();
  }, [initWriteStatus]);

  return (
    <main className="app-overlay-root">
      <OverlayHost />
    </main>
  );
}
