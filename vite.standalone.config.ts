import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { writePlayerArtifactManifest } from "./scripts/lib/playerArtifactContract.mjs";
import { writeReleaseCollector } from "./scripts/lib/releaseCollectorBuild.mjs";
import { appVersionPlugin } from "./scripts/lib/appVersion.mjs";
import { playerBundleGuardPlugin } from "./scripts/lib/playerBundleGuard.mjs";
import { playerEditorOnlyAssetsVitePlugin } from "./scripts/lib/playerEditorOnlyAssets.mjs";
import { runtimeLicenseBannerPlugin } from "./scripts/lib/runtimeLicenseBanner.mjs";

/**
 * 스탠드얼론(단일 HTML) 플레이어 빌드.
 *
 * vite.player.config.ts 와 다른 점만 적는다 — 나머지는 같아야 한다.
 * - format: "iife" + inlineDynamicImports: 코드 분할이 있으면 `file://` 에서 청크를 못 가져온다.
 * - cssCodeSplit: false: CSS 한 덩어리로 뽑아 HTML 에 인라인한다.
 * - phaserRuntime alias: `import.meta.url` 주입식 대신 번들 포함판(phaserRuntimeBundled).
 * - flagship alias: 내장 데모(?demo=)는 싣지 않는다(standaloneFlagshipShim).
 *
 * 이 설정의 산출물은 그 자체로 완성물이 아니다. scripts/build-standalone-html.mjs 가
 * JS·CSS·에셋·프로젝트를 묶어 HTML 한 장으로 만든다.
 */
const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url));
let thisRoot: string;
let outputDirectory: string;

export default defineConfig({
  base: "./",
  envPrefix: "OPENRPG_PLAYER_",
  publicDir: false,
  plugins: [{
    name: "standalone-sdk",
    configResolved(config) { thisRoot = config.root; outputDirectory = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      await writeReleaseCollector(thisRoot, outputDirectory);
      await writePlayerArtifactManifest({ artifactRoot: outputDirectory, repoRoot: thisRoot });
    },
  }, playerBundleGuardPlugin(), playerEditorOnlyAssetsVitePlugin(), appVersionPlugin(), runtimeLicenseBannerPlugin(fileURLToPath(new URL("./LICENSE-RUNTIME.md", import.meta.url)))],
  // iife 출력은 import.meta.url 을 `{}.url`(undefined)로 그린다. 그러면 `new URL("data:…", import.meta.url)` 같은
  // 정적 에셋 참조(retroSkillChoreography 의 도트 효과 시트)가 «Invalid base URL» 로 부팅을 통째로 막았다
  // (2026-10-23 실측: 실행형 HTML 이 타이틀 없이 빈 화면). 에셋은 전부 data: 로 인라인되므로 기준 주소는 형식만 맞으면 된다.
  define: { "import.meta.url": JSON.stringify("file:///oprn-standalone/standalone.js") },
  resolve: {
    alias: [
      { find: /^@\/app\/mode$/, replacement: src("player/exportAppModeShim.ts") },
      { find: /^@\/project\/store$/, replacement: src("player/exportProjectStoreShim.ts") },
      { find: /^@\/app\/phaserRuntime$/, replacement: src("app/phaserRuntimeBundled.ts") },
      // 내장 데모(?demo=)는 player.html 경로 몫이다. 진짜 모듈은 에디터 도구·장소 스냅숏을 끌고 온다(standaloneFlagshipShim.ts).
      { find: /^@\/project\/flagship$/, replacement: src("player/standaloneFlagshipShim.ts") },
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
    // CSS imports (including HUD icons) must not leave sibling files beside one HTML.
    assetsInlineLimit: Number.POSITIVE_INFINITY,
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
