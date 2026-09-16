// 격리(quarantine) 테스트 전용 설정 — 기본 스위트(vitest.config.ts)는 `*.quarantine.test.ts` 를
// 제외한다. 그 제외가 `test:quarantine` 스크립트에도 그대로 걸려서, 2026-09-16 실측으로
// `npm run test:quarantine` 이 "No test files found" 로 끝나고 있었다(격리 156파일이 실제로는
// 아무데서도 돌지 않았다). 되돌리기 경로가 죽어 있었으므로 이 설정을 따로 둔다.
//   node scripts/run-vitest.mjs run --config vitest.quarantine.config.ts --maxWorkers=2 --minWorkers=1
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
    include: ["test/**/*.quarantine.test.ts"],
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 90_000,
    silent: true,
  },
});
