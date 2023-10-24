import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  base: "./",
  server: {
    host: ["localhost", "127.0.0.1"],
  },

  // build
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
