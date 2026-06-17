import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Vite's proxy goes through node:net's `localhost` resolution, which on
// Windows resolves to ::1 (IPv6) by default and fails with EACCES when the
// upstream binds IPv4 only. Pin to 127.0.0.1 and read the api port from
// env so e2e runs and local dev both work.
const API_PORT = Number(process.env["MODELHARBOR_API_PORT"] ?? 3000);
const API_TARGET = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": API_TARGET,
      "/v1": API_TARGET,
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
