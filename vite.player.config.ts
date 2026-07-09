import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  base: "./",
  publicDir: false,
  resolve: {
    alias: [
      { find: /^@\/app\/mode$/, replacement: src("player/exportAppModeShim.ts") },
      { find: /^@\/editor\/cutscene$/, replacement: src("player/exportCutsceneShim.ts") },
      { find: /^@\/editor\/eventCommands\/m2Catalog$/, replacement: src("player/exportM2CatalogShim.ts") },
      { find: /^@\/editor\/tilesetImage$/, replacement: src("player/exportTilesetImageShim.ts") },
      { find: /^@\/project\/io$/, replacement: src("player/exportProjectIoShim.ts") },
      { find: /^@\/project\/io\/resourceReferenceValidation$/, replacement: src("player/exportResourceReferenceValidationShim.ts") },
      { find: /^@\/project\/store$/, replacement: src("player/exportProjectStoreShim.ts") },
      { find: "@", replacement: src("") },
    ],
    extensions: [".ts", ".js"],
  },
  build: {
    target: "es2022",
    outDir: "dist/export-player",
    emptyOutDir: true,
    sourcemap: false,
    manifest: "player-manifest.json",
    rollupOptions: {
      input: fileURLToPath(new URL("./player.html", import.meta.url)),
      output: {
        entryFileNames: "player.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
