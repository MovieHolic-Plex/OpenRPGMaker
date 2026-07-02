import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".ts", ".js"],
  },
  server: {
    host: "::",
    port: 5173,
    allowedHosts: ["mdc-server"],
    open: false,
    watch: {
      ignored: ["**/.omo/**", "**/output/**", "**/tmp/**", "**/test-results/**"],
    },
    proxy: {
      "/api/ai": {
        target: "https://yunwu.ai/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, ""),
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
