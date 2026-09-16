#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(REPO_ROOT, "dist-electron");
const ENTRIES = [
  { entry: resolve(REPO_ROOT, "electron/main/main.ts"), outfile: resolve(OUT_DIR, "main.cjs") },
  { entry: resolve(REPO_ROOT, "electron/preload/index.ts"), outfile: resolve(OUT_DIR, "preload.cjs") },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { entry, outfile } of ENTRIES) {
  await build({
    absWorkingDir: REPO_ROOT,
    bundle: true,
    entryPoints: [entry],
    format: "cjs",
    logLevel: "warning",
    outfile,
    platform: "node",
    target: "node22",
    external: ["electron", "node:*"],
  });
  process.stdout.write(`built ${outfile.replace(`${REPO_ROOT}/`, "")}\n`);
}
