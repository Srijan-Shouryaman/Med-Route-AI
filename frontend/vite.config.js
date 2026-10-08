import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget =
    env.VITE_API_PROXY_TARGET || env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true, autoRewrite: true },
        "/health": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
