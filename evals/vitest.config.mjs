// evals/vitest.config.mjs
// evals 전용 vitest 설정. 기본 `npm test`(test/**/*.test.ts)와 분리되어 있어
// 실제 LLM 호출은 이 설정으로만 실행된다(evals/run.mjs 경유).
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
    extensions: [".ts", ".js"],
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    globals: false,
    testTimeout: 600000, // 실 LLM 호출 여유(10분).
  },
});
