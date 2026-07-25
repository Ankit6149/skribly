import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";
import "./styles/founder-alpha.css";
import "./styles/onboarding.css";
import "./styles/license.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
