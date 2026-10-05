#!/usr/bin/env node
// 서버(dist/server.mjs)와 로컬·스테이징 실행기(dist/local.mjs)를 묶는다. 공용 팩 모듈(../src/assetStore)이 같이 들어간다.
// 실행기는 첫 진열 팩을 만들려고 편집기 번들 타일셋 정의(JSON)도 함께 묶는다.
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const common = {
  bundle: true, platform: "node", target: "node24", format: "esm", sourcemap: "linked", logLevel: "warning",
  external: ["pg", "pg-native"],
  // 편집기 모듈이 쓰는 @/ 별칭을 루트 tsconfig 로 푼다.
  tsconfig: resolve(root, "..", "tsconfig.json"),
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
};
await build({ ...common, entryPoints: [resolve(root, "src/main.ts")], outfile: resolve(root, "dist/server.mjs") });
await build({ ...common, entryPoints: [resolve(root, "scripts/local.ts")], outfile: resolve(root, "dist/local.mjs") });
console.log("[store build] dist/server.mjs dist/local.mjs");
