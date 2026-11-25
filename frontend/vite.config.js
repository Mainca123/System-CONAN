import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/catalog": "http://localhost:8081",
      "/api/orders": "http://localhost:8082",
      "/api/assistant": "http://localhost:8083",
    },
  },
});
