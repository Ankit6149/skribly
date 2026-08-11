import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/800.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import { App } from "./App";
import { StartupErrorBoundary } from "./features/onboarding/StartupErrorBoundary";
import "./styles/global.css";
import "./styles/accessibility.css";
import "./styles/note-experience.css";
import "./styles/account.css";
import "./styles/trash.css";
import "./styles/startup-recovery.css";
import "./styles/website-theme.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Skribli could not find its application surface.");
}

ReactDOM.createRoot(rootElement, {
  onRecoverableError(error) {
    console.error("Skribli recovered from a rendering error.", error);
  },
}).render(
  <React.StrictMode>
    <StartupErrorBoundary>
      <App />
    </StartupErrorBoundary>
  </React.StrictMode>,
);
