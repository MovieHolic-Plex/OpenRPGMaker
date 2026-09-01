import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

/**
 * 스탠드얼론(단일 HTML) 플레이어 빌드.
 *
 * vite.player.config.ts 와 다른 점만 적는다 — 나머지는 같아야 한다.
 * - format: "iife" + inlineDynamicImports: 코드 분할이 있으면 `file://` 에서 청크를 못 가져온다.
 * - cssCodeSplit: false: CSS 한 덩어리로 뽑아 HTML 에 인라인한다.
 * - phaserRuntime alias: `import.meta.url` 주입식 대신 번들 포함판(phaserRuntimeBundled).
 *
 * 이 설정의 산출물은 그 자체로 완성물이 아니다. scripts/build-standalone-html.mjs 가
 * JS·CSS·에셋·프로젝트를 묶어 HTML 한 장으로 만든다.
 */
const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  base: "./",
  envPrefix: "OPENRPG_PLAYER_",
  publicDir: false,
  resolve: {
    alias: [
      { find: /^@\/app\/mode$/, replacement: src("player/exportAppModeShim.ts") },
      { find: /^@\/project\/store$/, replacement: src("player/exportProjectStoreShim.ts") },
      { find: /^@\/app\/phaserRuntime$/, replacement: src("app/phaserRuntimeBundled.ts") },
      { find: "@", replacement: src("") },
    ],
    extensions: [".ts", ".js"],
  },
  build: {
    target: "es2022",
    outDir: "dist/standalone-player",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: src("player/exportEntry.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "standalone.js",
        assetFileNames: "standalone[extname]",
      },
    },
  },
});
