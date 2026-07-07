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
    include: ["test/**/*.test.ts"],
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 90_000,
    onConsoleLog: () => false,
  },
});
