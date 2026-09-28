import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import { applyLegacyEnvAliases } from "./scripts/lib/oprnEnv.mjs";
import { whatsNewPlugin } from "./scripts/lib/whatsNew.mjs";

applyLegacyEnvAliases();

export default defineConfig({
  // 톱바가 「새 소식」 서랍을 동적 import 한다 — 톱바를 그리는 테스트도 가상 모듈을 풀 수 있어야 한다.
  plugins: [whatsNewPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".ts", ".js"],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // lakeVillageRebuildFinal은 .env.local + 라이브 LegacyDb 업서트가 필요한 저작 스크립트다.
    // 기본 스위트에서 돌리면 CI는 무조건 실패하고 로컬은 원격 공유 프로젝트를 덮어쓴다.
    // 의도적으로 돌릴 때: node scripts/run-vitest.mjs run --config vitest.live.config.ts
    // *.bun.test.ts 는 bun:test 을 import 하므로 vitest 가 수집하면 무조건 실패한다.
    // 전원 경로는 npm run test:oh-my-pi (bun test) 다.
    // `*.browser.test.ts` 는 verify-gates 의 **browser 스테이지**가 따로 돌린다(동시성 낮춤).
    // 32워커 무리에 섞이면 Chromium 부팅이 준비 마감을 넘겨 늘 이 파일이 회귀로 잡혔다.
    exclude: [...configDefaults.exclude, "test/lakeVillageRebuildFinal.test.ts", "test/**/*.bun.test.ts", "test/**/*.quarantine.test.ts", "test/**/*.browser.test.ts"],
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 90_000,
    silent: true,
  },
});
