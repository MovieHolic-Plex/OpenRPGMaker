import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { appVersionPlugin } from "./scripts/lib/appVersion.mjs";

const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  base: "./",
  envPrefix: "OPENRPG_PLAYER_",
  publicDir: false,
  // 내보낸 게임도 자기가 어느 도구 버전으로 만들어졌는지 알아야 한다 —
  // 버그 리포트가 "게임이 이상해요" 로 시작할 때 도구 버전이 유일한 단서다.
  plugins: [appVersionPlugin()],
  resolve: {
    alias: [
      { find: /^@\/app\/mode$/, replacement: src("player/exportAppModeShim.ts") },
      { find: /^@\/project\/store$/, replacement: src("player/exportProjectStoreShim.ts") },
      // 성 서재 참고문서는 에디터 시드용 15MB JSON 이다. 내보낸 플레이어에는 넣지 않는다.
      { find: "@/assets/sharedCastleReferences.json", replacement: src("player/emptySharedCastleReferences.json") },
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
