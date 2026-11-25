#!/usr/bin/env node
// 데스크톱 패키지에 실릴 dist 의 PNG 를 무손실로 다시 압축한다(oxipng, 화소·팔레트 순서·투명도는 그대로).
// 저장소의 원본 PNG 는 건드리지 않는다 — 그림 해시를 쓰는 관문·영수증(object-gate 등)과 웹 빌드가 원본을 본다.
// 실측(2026-11-23, app-size-2): 초상 밖 PNG 188.0MB → 124.7MB, 8,860장 RGBA 화소 비교 차이 0.
//
// 쓰기: node scripts/desktop-png-optimize.mjs [--dist dist]
// desktop-ondemand-assets.mjs 다음, electron-builder 전에 돈다(.github/workflows/desktop-release.yml).
// oxipng 는 고정 판을 받아 SHA-256 을 확인하고 node_modules/.cache 에 둔다. 리눅스 x64 호스트만(릴리스 러너와 같다).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OXIPNG = {
  version: "10.2.1",
  url: "https://github.com/oxipng/oxipng/releases/download/v10.2.1/oxipng-10.2.1-x86_64-unknown-linux-musl.tar.gz",
  sha256: "1813750ef592c5350ca79c88f98b2c0876d05c826dc7156245256d4255c1ad17",
};

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function oxipngBinary() {
  if (process.env.OPRN_OXIPNG) return process.env.OPRN_OXIPNG;
  if (process.platform !== "linux" || process.arch !== "x64") throw new Error(`oxipng 고정 판은 linux x64 만 받는다 — OPRN_OXIPNG 로 경로를 준다 (${process.platform}/${process.arch})`);
  const cacheDir = resolve(REPO_ROOT, "node_modules/.cache/oprn-oxipng", OXIPNG.version);
  const binary = join(cacheDir, "oxipng");
  if (existsSync(binary)) return binary;
  mkdirSync(cacheDir, { recursive: true });
  const response = await fetch(OXIPNG.url);
  if (!response.ok) throw new Error(`oxipng ${OXIPNG.version} 내려받기 실패: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== OXIPNG.sha256) throw new Error(`oxipng ${OXIPNG.version} SHA-256 이 맞지 않는다`);
  const tarball = join(cacheDir, "oxipng.tar.gz");
  writeFileSync(tarball, bytes);
  const untar = spawnSync("tar", ["-xzf", tarball, "-C", cacheDir, "--strip-components=1", `oxipng-${OXIPNG.version}-x86_64-unknown-linux-musl/oxipng`], { stdio: "inherit" });
  if (untar.status !== 0 || !existsSync(binary)) throw new Error("oxipng 압축을 풀지 못했다");
  chmodSync(binary, 0o755);
  return binary;
}

function pngFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pngFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) out.push(path);
  }
  return out;
}

const distDir = resolve(REPO_ROOT, arg("dist", "dist"));
const files = pngFiles(distDir);
const before = files.reduce((sum, file) => sum + statSync(file).size, 0);
const binary = await oxipngBinary();
const started = Date.now();
const threads = String(Math.max(1, Math.min(8, availableParallelism())));
// --strip safe: 표시에 영향 없는 덩어리(글·시간·EXIF)만 뺀다. 색 관련 덩어리(gAMA·iCCP·sRGB·tRNS·PLTE)는 남는다.
const OXIPNG_ARGS = ["-o", "2", "--strip", "safe"];

// 내용 주소 캐시 (2026-11-25 dev-bottlenecks): 릴리스마다 PNG 9,748장을 다시 눌렀다(204~257초). 릴리스 사이에 바뀌는 그림은 적다.
// 열쇠 = sha256(oxipng 판 + 인자 + 원본 바이트). 값 = 그 원본을 oxipng 가 눌러 낸 바이트. 같은 입력이면 oxipng 는 같은 출력을 낸다.
// OPRN_PNG_OPTIMIZE_CACHE_DIR 가 있을 때만 쓴다(desktop-release.yml). 쓰기는 임시 파일 → 이름 바꾸기라 동시 실행에도 반쯤 파일을 읽지 않는다.
const cacheDir = process.env.OPRN_PNG_OPTIMIZE_CACHE_DIR ? resolve(process.env.OPRN_PNG_OPTIMIZE_CACHE_DIR) : "";
const salt = JSON.stringify([OXIPNG.version, OXIPNG_ARGS]);
const keyOf = (file) => createHash("sha256").update(salt).update(readFileSync(file)).digest("hex");
const cachePath = (key) => join(cacheDir, key.slice(0, 2), `${key}.png`);
const keys = new Map();
let todo = files;
let hits = 0;
if (cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  todo = [];
  const now = new Date();
  for (const file of files) {
    const key = keyOf(file);
    const cached = cachePath(key);
    if (existsSync(cached)) {
      copyFileSync(cached, file);
      utimesSync(cached, now, now);
      hits += 1;
    } else {
      keys.set(file, key);
      todo.push(file);
    }
  }
}
for (let index = 0; index < todo.length; index += 200) {
  const result = spawnSync(binary, [...OXIPNG_ARGS, "-q", "-t", threads, ...todo.slice(index, index + 200)], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`oxipng 실패 (exit ${result.status})`);
}
if (cacheDir) {
  for (const [file, key] of keys) {
    const target = cachePath(key);
    mkdirSync(dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.tmp`;
    copyFileSync(file, temp);
    renameSync(temp, target);
  }
  // 열흘 넘게 안 쓴 항목은 지운다(릴리스 한 판이 약 220MB).
  const stale = Date.now() - 10 * 864e5;
  for (const dir of readdirSync(cacheDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const entry of readdirSync(join(cacheDir, dir.name))) {
      const path = join(cacheDir, dir.name, entry);
      if (statSync(path).mtimeMs < stale) rmSync(path, { force: true });
    }
  }
}
const after = files.reduce((sum, file) => sum + statSync(file).size, 0);
const cacheNote = cacheDir ? ` (cache hit ${hits}, miss ${todo.length})` : "";
process.stdout.write(`png-optimize: ${files.length} files ${(before / 1e6).toFixed(1)}MB → ${(after / 1e6).toFixed(1)}MB in ${Math.round((Date.now() - started) / 1000)}s${cacheNote}\n`);
