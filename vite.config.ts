import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiProxy = {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
  },
} as const;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
});
