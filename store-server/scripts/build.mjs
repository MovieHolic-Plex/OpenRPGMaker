#!/usr/bin/env node
// 서버를 dist/server.mjs 하나로 묶는다. 공용 팩 모듈(../src/assetStore)이 같이 들어간다.
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = process.argv[2] ?? resolve(root, "src/main.ts");
const outfile = process.argv[3] ?? resolve(root, "dist/server.mjs");
await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: "linked",
  external: ["pg", "pg-native"],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});
console.log(`[store build] ${outfile}`);
