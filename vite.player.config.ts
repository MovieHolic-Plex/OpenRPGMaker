import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { appVersionPlugin } from "./scripts/lib/appVersion.mjs";
import { playerEditorOnlyAssetsVitePlugin } from "./scripts/lib/playerEditorOnlyAssets.mjs";

const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  base: "./",
  envPrefix: "OPENRPG_PLAYER_",
  publicDir: false,
  // 내보낸 게임도 자기가 어느 도구 버전으로 만들어졌는지 알아야 한다 —
  // 버그 리포트가 "게임이 이상해요" 로 시작할 때 도구 버전이 유일한 단서다.
  // 타일셋 AI 참고문서(에디터 전용, 약 14MB)는 빈 값으로 싣는다 — scripts/lib/playerEditorOnlyAssets.mjs.
  plugins: [playerEditorOnlyAssetsVitePlugin(), appVersionPlugin()],
  resolve: {
    alias: [
      { find: /^@\/app\/mode$/, replacement: src("player/exportAppModeShim.ts") },
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
