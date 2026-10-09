// 라이브 LegacyDb 저작/검증 테스트 전용 설정 — 기본 스위트(vitest.config.ts)에서
// 제외된 파일을 의도적으로 돌릴 때만 사용한다. .env.local과 원격 쓰기 권한이 필요하다.
//   npx vitest run --config vitest.live.config.ts
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
    include: ["test/lakeVillageRebuildFinal.test.ts"],
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
