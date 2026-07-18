import { configDefaults, defineConfig } from "vitest/config";
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
    include: ["test/**/*.test.ts"],
    // lakeVillageRebuildFinal은 .env.local + 라이브 Supabase 업서트가 필요한 저작 스크립트다.
    // 기본 스위트에서 돌리면 CI는 무조건 실패하고 로컬은 원격 공유 프로젝트를 덮어쓴다.
    // 의도적으로 돌릴 때: npx vitest run --config vitest.live.config.ts
    exclude: [...configDefaults.exclude, "test/lakeVillageRebuildFinal.test.ts"],
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 90_000,
    silent: true,
  },
});
