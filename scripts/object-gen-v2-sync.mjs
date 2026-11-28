#!/usr/bin/env node
// object-gen-v2 서브레포 사본 동기화 — 이 저장소 harness/object-gen-v2/ ↔ 개별 저장소 MovieHolic-Plex/object-gen-v2.
//
//   npm run object-gen-v2:sync -- status [--repo <object-gen-v2 체크아웃>]
//   npm run object-gen-v2:sync -- export [--push]   # 이 저장소(기본 origin/main, --worktree 면 HEAD) → object-gen-v2 저장소
//   npm run object-gen-v2:sync -- import            # object-gen-v2 저장소 변경 → 이 작업 트리 harness/object-gen-v2/
//
// 선례: scripts/object-gate-sync.mjs. 두 저장소는 바이트 그대로 같은 git blob 해시를 유지한다.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const PREFIX = "harness/object-gen-v2/";
const SYNC_FILE = ".monorepo-sync";

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith("-")) ?? "status";
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? undefined : (argv[i + 1] ?? ""); };
const flag = (name) => argv.includes(`--${name}`);

function defaultExternalRepo() {
  const candidates = [
    process.env.OBJECT_GEN_V2_REPO,
    resolve(homedir(), "object-gen-v2"),
    resolve(homedir(), "z-project", "object-gen-v2"),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(resolve(p, ".git"))) ?? resolve(homedir(), "object-gen-v2");
}

const mono = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const ext = resolve(opt("repo") ?? defaultExternalRepo());

function git(cwd, args, input) {
  return execFileSync("git", args, { cwd, input, maxBuffer: 1 << 28 }).toString("utf8");
}
function gitBuf(cwd, args) {
  return execFileSync("git", args, { cwd, maxBuffer: 1 << 28 });
}
function hasCommit(cwd, sha) {
  try { git(cwd, ["cat-file", "-e", `${sha}^{commit}`]); return true; } catch { return false; }
}

function monoTree(rev) {
  const out = new Map();
  if (!hasCommit(mono, rev)) return out;
  const raw = git(mono, ["ls-tree", "-r", "-z", rev, "--", "harness/object-gen-v2"]);
  for (const ent of raw.split("\0")) {
    if (!ent) continue;
    const [meta, p] = ent.split("\t");
    if (!p.startsWith(PREFIX)) continue;
    const [mode, , sha] = meta.split(" ");
    out.set(p.slice(PREFIX.length), `${mode} ${sha}`);
  }
  return out;
}

function monoWorktreeBlobs() {
  const root = resolve(mono, "harness/object-gen-v2");
  const out = new Map();
  if (!existsSync(root)) return out;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__pycache__" || entry.name === ".pytest_cache" || entry.name === ".venv" || entry.name.endsWith(".egg-info")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const rel = relative(root, full).replace(/\\/g, "/");
        const mode = (statSync(full).mode & 0o111) ? "100755" : "100644";
        const sha = git(mono, ["hash-object", full]).trim();
        out.set(rel, `${mode} ${sha}`);
      }
    }
  };
  walk(root);
  return out;
}

function extTree(rev = "HEAD") {
  const out = new Map();
  const raw = git(ext, ["ls-tree", "-r", "-z", rev]);
  for (const ent of raw.split("\0")) {
    if (!ent) continue;
    const [meta, p] = ent.split("\t");
    if (p === SYNC_FILE) continue;
    const [mode, , sha] = meta.split(" ");
    out.set(p, `${mode} ${sha}`);
  }
  return out;
}

function plan() {
  if (!existsSync(resolve(ext, ".git"))) {
    throw new Error(`object-gen-v2 체크아웃이 없다: ${ext}\n  git clone https://github.com/MovieHolic-Plex/object-gen-v2.git ${ext}`);
  }
  try { git(mono, ["fetch", "-q", "origin", "main"]); } catch { /* offline ok */ }
  try { git(ext, ["fetch", "-q", "origin"]); } catch { /* offline ok */ }

  const useWorktree = flag("worktree") || monoTree("origin/main").size === 0;
  const headRef = useWorktree ? "WORKTREE" : git(mono, ["rev-parse", "origin/main"]).trim();
  const M = useWorktree ? monoWorktreeBlobs() : monoTree(headRef);
  const G = extTree("HEAD");

  const syncPath = resolve(ext, SYNC_FILE);
  const baseSha = existsSync(syncPath) ? JSON.parse(readFileSync(syncPath, "utf8")).commit : null;
  const B = baseSha && hasCommit(mono, baseSha) ? monoTree(baseSha) : null;

  const paths = new Set([...(B ? B.keys() : []), ...M.keys(), ...G.keys()]);
  const toExt = [], toMono = [], conflict = [];
  for (const p of [...paths].sort()) {
    const m = M.get(p), g = G.get(p);
    if (m === g) continue;
    if (!B) {
      if (m && !g) toExt.push(p);
      else if (g && !m) toMono.push(p);
      else conflict.push(p);
    } else {
      const b = B.get(p);
      if (g === b) toExt.push(p);
      else if (m === b) toMono.push(p);
      else conflict.push(p);
    }
  }
  return { baseSha, headRef, useWorktree, M, G, toExt, toMono, conflict };
}

function show(list, label) {
  if (!list.length) return;
  console.log(`${label} ${list.length}`);
  for (const p of list.slice(0, 20)) console.log(`  ${p}`);
  if (list.length > 20) console.log(`  … ${list.length - 20}개 더`);
}

function writeFromMono(P, relPath) {
  const dest = resolve(ext, relPath);
  const entry = P.M.get(relPath);
  if (!entry) { rmSync(dest, { force: true }); return; }
  const [mode, sha] = entry.split(" ");
  mkdirSync(dirname(dest), { recursive: true });
  const bytes = P.useWorktree
    ? readFileSync(resolve(mono, PREFIX, relPath))
    : gitBuf(mono, ["cat-file", "blob", sha]);
  writeFileSync(dest, bytes, { mode: mode === "100755" ? 0o755 : 0o644 });
}

function writeFromExt(P, relPath) {
  const dest = resolve(mono, PREFIX, relPath);
  const entry = P.G.get(relPath);
  if (!entry) { rmSync(dest, { force: true }); return; }
  const [mode, sha] = entry.split(" ");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, gitBuf(ext, ["cat-file", "blob", sha]), { mode: mode === "100755" ? 0o755 : 0o644 });
}

function main() {
  const P = plan();
  const extHead = git(ext, ["rev-parse", "HEAD"]).trim();
  console.log(`object-gen-v2 서브레포: ${ext} (HEAD ${extHead.slice(0, 10)})`);
  console.log(`기준 ${P.baseSha ? P.baseSha.slice(0, 10) : "초기(2-way)"} · 모노레포 ${P.useWorktree ? "WORKTREE(harness/object-gen-v2)" : `origin/main ${P.headRef.slice(0, 10)}`}`);
  show(P.toExt, "이 저장소에서 바뀜(export 대상)");
  show(P.toMono, "object-gen-v2 저장소에서 바뀜(import 대상)");
  show(P.conflict, "양쪽이 다르게 바뀜(충돌)");
  if (cmd === "status") {
    if (!P.toExt.length && !P.toMono.length && !P.conflict.length) console.log("바이트 100% 일치 (동기화 완료)");
    return P.conflict.length ? 2 : (P.toExt.length || P.toMono.length ? 1 : 0);
  }
  if (P.conflict.length) { console.error("멈춤: 충돌이 있다"); return 2; }
  if (cmd === "export") {
    if (P.useWorktree && !flag("worktree")) {
      console.error("멈춤: origin/main 에 아직 harness/object-gen-v2 가 없다(PR 병합 후 export 하거나 --worktree 명시)");
      return 3;
    }
    if (P.toMono.length) { console.error("멈춤: object-gen-v2 저장소에만 있는 변경이 있다 — 먼저 import"); return 3; }
    if (git(ext, ["status", "--porcelain"]).trim()) { console.error(`멈춤: ${ext} 작업 트리가 깨끗하지 않다`); return 3; }
    for (const p of P.toExt) writeFromMono(P, p);
    const recSha = P.useWorktree ? git(mono, ["rev-parse", "HEAD"]).trim() : P.headRef;
    writeFileSync(resolve(ext, SYNC_FILE), `${JSON.stringify({ commit: recSha, at: new Date().toISOString() }, null, 2)}\n`);
    git(ext, ["add", "-A"]);
    if (!git(ext, ["status", "--porcelain"]).trim()) { console.log("바뀐 것 없음"); return 0; }
    git(ext, ["commit", "-q", "-m", `sync: OpenRPGMaker ${recSha.slice(0, 10)} (${P.toExt.length} files)`]);
    console.log(`커밋: ${git(ext, ["log", "-1", "--format=%h %s"]).trim()}`);
    if (flag("push")) { git(ext, ["push", "-q", "origin", "HEAD"]); console.log("푸시 완료"); }
    return 0;
  }
  if (cmd === "import") {
    for (const p of P.toMono) writeFromExt(P, p);
    console.log(`${P.toMono.length}개 파일을 harness/object-gen-v2/ 에 가져왔다.`);
    return 0;
  }
  console.error("쓰는 법: object-gen-v2-sync.mjs status|export [--push]|import [--repo <경로>]");
  return 64;
}

try { process.exitCode = main(); } catch (e) { console.error(String(e?.message ?? e)); process.exitCode = 1; }
