import { LicenseGate } from "./features/licensing/LicenseGate";
import { OverlayHost } from "./features/overlay/OverlayHost";

export function App() {
  return (
    <main className="app-overlay-root">
      <LicenseGate>
        <OverlayHost />
      </LicenseGate>
    </main>
  );
}
