import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@evolu/common": path.resolve(__dirname, "../../packages/common/src/index.ts"),
      "@evolu/svelte": path.resolve(__dirname, "../../packages/svelte/src/lib/index.svelte.ts"),
      "@evolu/web": path.resolve(__dirname, "../../packages/web/src/index.ts"),
    },
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  optimizeDeps: {
    // A workaround for Vite bug: https://github.com/vitejs/vite/issues/13314#issuecomment-1560745780
    exclude: ["@sqlite.org/sqlite-wasm", "@evolu/common", "@evolu/svelte", "@evolu/web"],
  },
});
