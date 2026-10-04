import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@skribly/shared": decodeURIComponent(
        new URL("../../packages/shared/src/index.ts", import.meta.url).pathname,
      ).replace(/^\/(\w:)/, "$1"),
    },
  },
  clearScreen: false,
  server: { port: 1430, strictPort: true, host: "0.0.0.0" },
  envPrefix: ["VITE_", "TAURI_"],
});
