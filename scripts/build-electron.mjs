#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
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

// 데스크톱 앱은 사용자 PC에 bun 이 없다. 리눅스·윈도우 워커를 실행 파일로 넣어 채팅이 그 파일을 띄운다.
const workerEntry = resolve(REPO_ROOT, "scripts/oh-my-pi-worker.ts");
for (const [target, name] of [["bun-linux-x64", "oh-my-pi-worker"], ["bun-windows-x64", "oh-my-pi-worker.exe"]]) {
  const outfile = resolve(OUT_DIR, name);
  const result = spawnSync("bun", ["build", workerEntry, "--compile", `--target=${target}`, `--outfile=${outfile}`], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`AI 워커 컴파일 실패: ${target}`);
  if (!name.endsWith(".exe")) chmodSync(outfile, 0o755);
  process.stdout.write(`built dist-electron/${name}\n`);
}
