#!/usr/bin/env node
// 공개 저장소(OpenRPGMaker) 스냅샷을 만든다. 이력은 싣지 않는다 — 한 커밋의 트리만 복사한다.
//
//   node scripts/oss/export-public.mjs [--ref origin/main] [--out ~/oss-export/OpenRPGMaker] [--git]
//
// 1. publicSet.mjs 의 제외 경로를 뺀 트리를 git archive 로 푼다.
// 2. self-hosted 러너를 쓰는 워크플로를 뺀다 — 공개 저장소의 포크 PR 이 이 서버에서 돌면 안 된다.
// 3. 텍스트 파일 안의 내부 호스트·홈 경로·tailnet IP 를 공개용 값으로 바꾼다(원본 저장소는 그대로).
// 4. PUBLIC_EXPORT.json 에 원본 커밋·뺀 것·바꾼 것을 남긴다.
// --git 이면 출력 폴더를 커밋 하나짜리 git 저장소로 만든다. 푸시는 하지 않는다.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PUBLIC_EXCLUDE, publicExcludePathspecs } from "./publicSet.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const ref = opt("ref", "origin/main");
const out = path.resolve(opt("out", path.join(process.env.HOME, "oss-export", "OpenRPGMaker")));

const commit = execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();

// ── 1. 트리 풀기 ───────────────────────────────────────
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// 수 GB 라 메모리로 받지 않고 임시 tar 파일을 거친다.
const tarFile = `${out}.tar`;
execFileSync("git", ["archive", "--format=tar", `--output=${tarFile}`, ref, "--", ".", ...publicExcludePathspecs()]);
execFileSync("tar", ["-x", "-f", tarFile, "-C", out]);
rmSync(tarFile);

// ── 2. self-hosted 워크플로 빼기 ───────────────────────
const droppedWorkflows = [];
const workflowDir = path.join(out, ".github", "workflows");
if (existsSync(workflowDir)) {
  for (const name of readdirSync(workflowDir)) {
    const file = path.join(workflowDir, name);
    if (/self-hosted/.test(readFileSync(file, "utf8"))) {
      rmSync(file);
      droppedWorkflows.push(`.github/workflows/${name}`);
    }
  }
}

// ── 3. 내부 기반 정보 바꾸기 ───────────────────────────
// 바꾸는 값은 어차피 공개망에서 닿지 않는 이름·경로다. 지우는 게 아니라 같은 모양의 공개용 값으로 둔다.
const REWRITES = [
  [/\bmdc-server\b/g, "localhost"],
  [/\/home\/main\b\/?/g, "~/"],
  [/\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/g, "127.0.0.1"],
];
// 확장자로 고르면 .env.example 같은 파일을 놓친다 — 앞 8KB 에 NUL 이 없으면 텍스트로 본다.
const MAX_TEXT = 8 * 1024 * 1024;
const isText = (buffer) => !buffer.subarray(0, 8192).includes(0);
const rewritten = {};
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.isFile() || statSync(full).size > MAX_TEXT) continue;
    const buffer = readFileSync(full);
    if (!isText(buffer)) continue;
    let text = buffer.toString("utf8");
    let hits = 0;
    for (const [re, value] of REWRITES) text = text.replace(re, () => { hits += 1; return value; });
    if (hits) { writeFileSync(full, text); rewritten[path.relative(out, full)] = hits; }
  }
};
walk(out);

// ── 4. 기록 ───────────────────────────────────────────
let files = 0;
let bytes = 0;
const brokenLinks = [];
let largest = [];
const measure = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== ".git") measure(full); continue; }
    // 심링크는 따라가지 않는다 — 대상이 지워진 끊긴 링크가 있으면 statSync 가 죽는다(실측 2026-10-08).
    if (entry.isSymbolicLink() && !existsSync(full)) brokenLinks.push(path.relative(out, full));
    const size = lstatSync(full).size;
    files += 1; bytes += size;
    largest.push([path.relative(out, full), size]);
  }
};
measure(out);
largest = largest.sort((a, b) => b[1] - a[1]).slice(0, 15);
const record = {
  sourceCommit: commit, ref, exportedAt: new Date().toISOString(),
  excluded: PUBLIC_EXCLUDE, droppedWorkflows,
  rewrittenFiles: Object.keys(rewritten).length, rewrites: rewritten,
  files, bytes, largest, brokenLinks,
};
writeFileSync(path.join(out, "PUBLIC_EXPORT.json"), JSON.stringify(record, null, 2) + "\n");

if (args.includes("--git")) {
  const g = (...a) => execFileSync("git", a, { cwd: out, stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 30 });
  g("init", "-q", "-b", "main");
  // 원본에서 .gitignore 에 걸린 채 추적되던 파일(.env.packaged 등)도 실어야 한다 — 막 푼 트리라 빌드 산출물은 없다.
  g("add", "-A", "--force");
  g("-c", "user.name=OPRN", "-c", "user.email=noreply@openrpgmaker.com", "commit", "-q", "-m", `OpenRPGMaker snapshot of ${commit.slice(0, 12)}`);
}

console.log(`${out}`);
console.log(`source ${commit.slice(0, 12)} · ${files} files · ${(bytes / 1048576).toFixed(1)}MB · workflows dropped ${droppedWorkflows.length} · rewritten ${Object.keys(rewritten).length} files`);
if (brokenLinks.length) console.log(`broken symlinks: ${brokenLinks.join(", ")}`);
console.log(`largest: ${largest.slice(0, 5).map(([f, s]) => `${f} ${(s / 1048576).toFixed(1)}MB`).join(", ")}`);
