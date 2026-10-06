#!/usr/bin/env node
// 테스트(TS)를 esbuild 로 한 파일로 묶어 node --test 로 돌린다. 일회용 Postgres 를 스스로 띄우고 지운다.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// ESM 은 NODE_PATH 를 보지 않는다 — 묶은 파일을 패키지 안에 둬야 node_modules/pg 를 찾는다.
mkdirSync(join(root, ".test-build"), { recursive: true });
const out = mkdtempSync(join(root, ".test-build", "run-"));
const files = readdirSync(join(root, "test")).filter((name) => name.endsWith(".test.ts"));
try {
  for (const file of files) {
    await build({
      entryPoints: [join(root, "test", file)], outfile: join(out, file.replace(/\.ts$/, ".mjs")), bundle: true, platform: "node", target: "node24", format: "esm",
      external: ["pg", "pg-native"], banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }, logLevel: "warning",
      nodePaths: [join(root, "node_modules")],
    });
  }
  const run = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...files.map((file) => join(out, file.replace(/\.ts$/, ".mjs")))], {
    stdio: "inherit", cwd: root, env: { ...process.env, STORE_SERVER_ROOT: root, NODE_PATH: join(root, "node_modules") },
  });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
