// 사용법: VITE_CACHE_DIR=/tmp/f-vite-ssr node run-ssr.mjs <script.mts> [args...]
// 스크립트의 run(...args, mods) 를 vite ssrLoadModule 로 돌린다(vitest 아님).
import { createServer } from "vite";
import { resolve } from "node:path";
const [script, ...args] = process.argv.slice(2);
const server = await createServer({ configFile: resolve("vite.config.ts"), server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", logLevel: "error", cacheDir: process.env.VITE_CACHE_DIR ?? "/tmp/f-vite-ssr" });
try {
  const mods = {
    defaultAssets: await server.ssrLoadModule("/src/project/defaults/defaultAssets.ts"),
    serialize: await server.ssrLoadModule("/src/project/io/serialize.ts"),
    digest: await server.ssrLoadModule("/src/project/persistence/core/contentDigest.ts"),
  };
  globalThis.__ssrImport = (p) => server.ssrLoadModule(p);
  const mod = await server.ssrLoadModule(resolve("verify-shots/editor-lag-fix/F", script));
  await mod.run(...args, mods);
} finally {
  await server.close();
}
