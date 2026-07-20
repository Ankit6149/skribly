import { useState } from "react";

export function DemoSkrib() {
  const [text, setText] = useState("This Skrib will return with its context.");

  return (
    <article className="skrib-card">
      <header>
        <strong>First Skrib</strong>
        <button type="button" aria-label="Pin Skrib">⌖</button>
      </header>
      <textarea
        aria-label="Skrib text"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <footer>
        <span>Prototype context</span>
        <span>Local only</span>
      </footer>
    </article>
  );
}
