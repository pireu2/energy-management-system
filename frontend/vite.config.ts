import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Dev server proxy: forward /api/* to the API gateway (docker-compose maps it to localhost:8080)
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://api-gateway",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
