#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(REPO_ROOT, "dist-electron");

const ENTRIES = [
  {
    entry: resolve(REPO_ROOT, "electron/main/main.ts"),
    outfile: resolve(OUT_DIR, "main.cjs"),
    format: "cjs",
    platform: "node",
    target: "node22",
    external: ["electron", "node:*"],
  },
  {
    entry: resolve(REPO_ROOT, "electron/preload/index.ts"),
    outfile: resolve(OUT_DIR, "preload.cjs"),
    format: "cjs",
    platform: "node",
    target: "node22",
    external: ["electron", "node:*"],
  },
  {
    // 브라우저 로컬 서버가 페이지에 주입하는 브리지 — IPC 대신 HTTP 로 같은 채널을 부른다.
    entry: resolve(REPO_ROOT, "electron/browser/bridge.ts"),
    outfile: resolve(OUT_DIR, "browser-bridge.js"),
    format: "iife",
    platform: "browser",
    target: "es2020",
    external: [],
  },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { entry, outfile, format, platform, target, external } of ENTRIES) {
  await build({
    absWorkingDir: REPO_ROOT,
    bundle: true,
    entryPoints: [entry],
    format,
    logLevel: "warning",
    outfile,
    platform,
    target,
    external,
  });
  process.stdout.write(`built ${outfile.replace(`${REPO_ROOT}/`, "")}\n`);
}
