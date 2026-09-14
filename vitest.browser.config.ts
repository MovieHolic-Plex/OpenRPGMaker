// 브라우저(Chromium) 테스트 전용 설정 — 기본 스위트(vitest.config.ts)는 `*.browser.test.ts` 를
// 제외한다. 32워커 무리 안에서는 Chromium 부팅이 테스트 자신의 준비 마감(30초)을 넘겨
// 늘 이 파일만 회귀로 잡혔다(실측 2026-09-13). 마감을 늘리는 대신 동시성을 낮춰 따로 돌린다.
//   node scripts/run-vitest.mjs run --config vitest.browser.config.ts --maxWorkers=2 --minWorkers=1
// verify-gates 의 `browser` 스테이지가 이 설정을 쓴다.
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".ts", ".js"],
  },
  test: {
    environment: "node",
    include: ["test/**/*.browser.test.ts"],
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    silent: true,
  },
});
