import { DemoSkrib } from "./features/skribs/DemoSkrib";

export function App() {
  return (
    <main className="app-shell">
      <section className="prototype-card" aria-label="Skribly scaffold status">
        <p className="eyebrow">SKRIBLY · TECHNICAL SPIKE</p>
        <h1>Leave thoughts where they belong.</h1>
        <p>
          This scaffold intentionally starts with one visual Skrib. The next step is
          proving cross-platform transparent overlays and context restoration.
        </p>
        <DemoSkrib />
      </section>
    </main>
  );
}
