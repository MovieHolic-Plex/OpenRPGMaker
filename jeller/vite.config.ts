import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// MCGA는 자체 호스팅 Supabase(192.168.100.121)의 REST/Edge Function으로 통신.
// 클라이언트는 thin client — 상태 페치(폴링) + 행동 제출만.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".ts", ".js"],
  },
  server: {
    port: 5174,
    open: false,
    proxy: {
      // Supabase REST + functions를 동일 출처로 우회 (CORS 회피 + 환경 통일)
      "/db": {
        target: "http://192.168.100.121:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/db/, "/rest/v1"),
      },
      "/fn": {
        target: "http://192.168.100.121:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fn/, "/functions/v1"),
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
