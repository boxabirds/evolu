import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: ".vite",
  resolve: {
    alias: {
      "@evolu/common/evolu": path.resolve(__dirname, "../../packages/common/src/Evolu/Internal.ts"),
      "@evolu/common": path.resolve(__dirname, "../../packages/common/src/index.ts"),
      "@evolu/react": path.resolve(__dirname, "../../packages/react/src/index.ts"),
      "@evolu/react-web": path.resolve(__dirname, "../../packages/react-web/src/index.ts"),
      "@evolu/web": path.resolve(__dirname, "../../packages/web/src/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm", "kysely", "@evolu/common", "@evolu/react", "@evolu/react-web", "@evolu/web"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "vite-react-pwa",
        short_name: "vite-react-pwa",
        description: "vite-react-pwa",
        theme_color: "#ffffff",
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },

      devOptions: {
        enabled: false,
        navigateFallback: "index.html",
        suppressWarnings: true,
        type: "module",
      },
    }),
  ],
});
