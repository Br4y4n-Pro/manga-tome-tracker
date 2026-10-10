import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: { port: 8080 },
  plugins: [
    tsConfigPaths(),
    // Use src/server.ts (our SSR error wrapper) as the server entry.
    tanstackStart({ server: { entry: "server" } }),
    nitro({
      preset: "cloudflare_module",
      compatibilityDate: "2025-09-01",
      cloudflare: {
        // Generates .output/server/wrangler.json so `wrangler deploy` needs no extra config.
        deployConfig: true,
        nodeCompat: true,
        wrangler: { name: "manga-tome-tracker" },
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
});
