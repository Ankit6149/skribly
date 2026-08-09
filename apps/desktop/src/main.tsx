import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import { App } from "./App";
import "./styles/global.css";
import "./styles/accessibility.css";
import "./styles/note-experience.css";
import "./styles/account.css";
import "./styles/trash.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
