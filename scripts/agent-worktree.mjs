#!/usr/bin/env node
// 에이전트별 격리 워크트리 관리 — 코드(에디터/엔진) 작업 전용.
//
// 왜: 여러 에이전트가 한 워킹트리를 공유하면 서로의 미완성 편집을 덮어쓰고, 검증이
// 움직이는 표적을 쫓게 된다(실측: 2분 간격 typecheck 에서 오류 시그니처가 바뀜).
// git worktree 는 파일을 물리적으로 분리하고 병합을 git 에게 맡긴다.
//
// 이 스크립트가 워크트리마다 추가로 해주는 것 (worktree 만으로는 안 되는 것들):
//   1. node_modules 정션 — 워크트리에는 복사되지 않는다(수 GB 중복 방지).
//   2. .env / .env.local 복사 — gitignored 라 워크트리에 따라오지 않는다.
//   3. DEV_SERVER_PORT 고유 배정 — 메인이 9999 --strictPort 를 점유하므로 충돌한다.
//
// 위치 규약: 워크트리는 메인 저장소의 **형제** 디렉터리여야 한다.
// vite.config.ts 의 server.fs.allow 가 `../rpg-zzu/node_modules` 를 허용하는데,
// 이 상대 경로는 워크트리 루트 기준으로 풀리기 때문이다.
//
// 사용:
//   node scripts/agent-worktree.mjs create <name> [--base <ref>]
//   node scripts/agent-worktree.mjs list                 # 포트 + dirty/unmerged 표시
//   node scripts/agent-worktree.mjs remove <name> [--keep-branch] [--force-dirty]
//   node scripts/agent-worktree.mjs snapshot             # 현재 워킹트리를 커밋으로 박제(비침습)
//
// remove 는 미커밋 변경이나 미병합 커밋이 있으면 거부한다. 커밋되지 않은 작업은 reflog 로도
// 회수할 수 없으므로, 정말 버릴 때만 --force-dirty 를 명시한다.
import { execFileSync } from "node:child_process";
import { existsSync, copyFileSync, readFileSync, writeFileSync, symlinkSync, mkdtempSync, unlinkSync, rmSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";

const REPO = resolve(process.cwd());
const REPO_NAME = basename(REPO);
const PARENT = dirname(REPO);
const PORT_BASE = 9801;
const COPIED_ENV_FILES = [".env", ".env.local"];

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8", ...options }).trim();
}

function worktreePath(name) {
  return join(PARENT, `${REPO_NAME}-${name}`);
}

function branchName(name) {
  return `agent/${name}`;
}

/** 등록된 워크트리 목록(메인 제외). */
function listWorktrees() {
  const raw = git(["worktree", "list", "--porcelain"]);
  const entries = [];
  let current = {};
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) entries.push(current);
      current = { path: line.slice("worktree ".length).trim() };
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).trim().replace("refs/heads/", "");
    }
  }
  if (current.path) entries.push(current);
  return entries.filter((entry) => resolve(entry.path) !== REPO);
}

/** 이미 쓰이는 포트를 피해 다음 빈 포트를 고른다(워크트리 .env.local 스캔). */
function nextFreePort() {
  const used = new Set();
  for (const entry of listWorktrees()) {
    const envLocal = join(entry.path, ".env.local");
    if (!existsSync(envLocal)) continue;
    const match = /^DEV_SERVER_PORT=(\d+)$/m.exec(readFileSync(envLocal, "utf8"));
    if (match) used.add(Number(match[1]));
  }
  for (let port = PORT_BASE; port < PORT_BASE + 100; port += 1) {
    if (!used.has(port)) return port;
  }
  throw new Error("빈 DEV_SERVER_PORT 를 찾지 못했습니다.");
}

// 워킹트리(미커밋 포함)를 커밋 객체로 박제한다. 임시 인덱스를 쓰므로 실제 인덱스·워킹트리는
// 건드리지 않는다 — 다른 에이전트가 작업 중이어도 안전하다.
function snapshot(message) {
  const indexFile = join(mkdtempSync(join(tmpdir(), "rpgzzu-snap-")), "index");
  const env = { ...process.env, GIT_INDEX_FILE: indexFile };
  git(["read-tree", "HEAD"], { env });
  git(["add", "-A"], { env });
  const tree = git(["write-tree"], { env });
  const head = git(["rev-parse", "HEAD"]);
  const commit = git(["commit-tree", tree, "-p", head, "-m", message]);
  return commit;
}

/** 워크트리에서 실행돼도 본체 체크아웃을 가리킨다 (Herd 훅 cwd = 새 폴더). */
function sourceRepoRoot(fromPath) {
  try {
    const common = execFileSync("git", ["-C", fromPath, "rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
    }).trim();
    return dirname(common);
  } catch {
    return REPO;
  }
}

// 워크트리에 격리 실행에 필요한 것들을 채운다(생성·기존 보정 공용).
// git worktree 는 추적 파일만 체크아웃하므로 node_modules 와 gitignored env 는 직접 넣어야 한다.
function provision(path, { force = false } = {}) {
  const applied = [];
  const source = sourceRepoRoot(path);

  const linkPath = join(path, "node_modules");
  const linkTarget = join(source, "node_modules");
  if (!existsSync(linkPath) && existsSync(linkTarget)) {
    symlinkSync(linkTarget, linkPath, process.platform === "win32" ? "junction" : "dir");
    applied.push("node_modules 정션");
  }

  for (const file of COPIED_ENV_FILES) {
    const destination = join(path, file);
    if ((force || !existsSync(destination)) && existsSync(join(source, file))) {
      copyFileSync(join(source, file), destination);
      applied.push(`${file} 복사`);
    }
  }

  // 포트 고유 배정 — vite.config.devServerPort() 가 loadEnv 로 읽는다.
  const envLocal = join(path, ".env.local");
  const current = existsSync(envLocal) ? readFileSync(envLocal, "utf8") : "";
  let port = /^DEV_SERVER_PORT=(\d+)$/m.exec(current)?.[1];
  if (!port) {
    port = String(nextFreePort());
    writeFileSync(envLocal, `${current.trimEnd()}\nDEV_SERVER_PORT=${port}\n`.trimStart(), "utf8");
    applied.push(`DEV_SERVER_PORT=${port}`);
  }
  return { port, applied };
}

function announce(path, branch, port) {
  console.log(`\n  경로    ${path}`);
  console.log(`  브랜치  ${branch}`);
  console.log(`  포트    ${port}  (npm run dev:worktree)`);
  console.log(`\n에이전트에게 줄 지시:`);
  console.log(`  cwd = ${path}`);
  console.log(`  dev 서버는 'npm run dev:worktree' (포트 ${port}). 'npm run dev' 는 9999 하드코딩이라 메인과 충돌한다.`);
}

function create(name, baseRef) {
  if (!name) throw new Error("워크트리 이름이 필요합니다: create <name>");
  const path = worktreePath(name);
  if (existsSync(path)) throw new Error(`이미 존재합니다: ${path}`);

  const base = baseRef ?? snapshot(`snapshot: agent worktree base for ${name}`);
  if (!baseRef) console.log(`[base] 현재 워킹트리를 스냅샷했습니다 → ${base.slice(0, 12)}`);

  git(["worktree", "add", "-b", branchName(name), path, base]);
  const { port } = provision(path);

  console.log(`\n워크트리 생성 완료`);
  announce(path, branchName(name), port);
}

// 이 도구 밖에서 만들어진 기존 워크트리를 같은 규약으로 보정한다.
// (node_modules 누락 → 실행 불가, DEV_SERVER_PORT 누락 → 전부 9999 충돌)
function adoptOne(path, label = "") {
  const { port, applied } = provision(path);
  console.log(`${label || basename(path)}  port=${port}  ${path}`);
  console.log(applied.length ? `   보정: ${applied.join(", ")}` : "   보정 없음(이미 정상)");
}

function adopt(name, explicitPath) {
  const path = explicitPath || process.env.WT_WORKTREE_PATH;
  if (path) {
    if (!existsSync(path)) throw new Error(`경로가 없습니다: ${path}`);
    adoptOne(resolve(path), name || basename(path));
    return;
  }

  const targets = name
    ? listWorktrees().filter((entry) => basename(entry.path) === `${REPO_NAME}-${name}` || entry.branch === name)
    : listWorktrees();
  if (targets.length === 0) throw new Error("보정할 워크트리를 찾지 못했습니다.");

  for (const entry of targets) {
    adoptOne(entry.path, entry.branch ?? "(detached)");
  }
}

/**
 * 이름으로 워크트리를 푼다. 브랜치는 **등록된 목록에서 읽는다** — 이름에서
 * `agent/<name>` 을 재구성하면 안 된다. Herd 가 만든 워크트리는 `worktree/<name>` 규약을
 * 쓰고 디렉터리명과 브랜치명이 어긋난다(`worktree-silver-meadow-6a2f` ↔
 * `worktree/silver-meadow-6a2f`). 재구성한 이름으로 rev-list 를 돌리면 항상 실패해
 * 미병합 가드가 조용히 통과한다.
 */
function resolveWorktree(name) {
  const entries = listWorktrees();
  const hit = entries.find(
    (entry) =>
      basename(entry.path) === name ||
      entry.path === resolve(name) ||
      entry.branch === name ||
      entry.branch === branchName(name),
  );
  if (hit) return { path: hit.path, branch: hit.branch ?? null };
  const conventional = worktreePath(name);
  if (existsSync(conventional)) return { path: conventional, branch: branchName(name) };
  throw new Error(`워크트리를 찾을 수 없습니다: ${name}`);
}

/** 워크트리에 미커밋 변경이 있으면 목록을, 없으면 빈 배열을 준다. */
function dirtyFiles(path) {
  const raw = git(["status", "--porcelain"], { cwd: path });
  return raw ? raw.split("\n") : [];
}

/**
 * 브랜치에 main 으로 안 들어간 커밋 수. 세어보지 못하면 **0 이 아니라 예외** — 셀 수 없다는
 * 것은 안전하다는 뜻이 아니다. 조용히 0 을 주면 가드가 무력화된다.
 */
function unmergedCommits(branch) {
  return Number(git(["rev-list", "--count", `main..${branch}`]));
}

/** list 표시용 — 셀 수 없으면 물음표. 여기서는 판단을 하지 않으므로 관용적으로 처리한다. */
function unmergedForDisplay(branch) {
  try {
    return unmergedCommits(branch);
  } catch {
    return null;
  }
}

function remove(name, keepBranch, forceDirty) {
  if (!name) throw new Error("워크트리 이름이 필요합니다: remove <name>");
  const { path, branch } = resolveWorktree(name);

  // git worktree remove --force 는 미커밋 변경을 확인 없이 버린다. 커밋되지 않은 작업은
  // reflog 로도 회수할 수 없는 유일한 상태이므로 기본적으로 거부한다.
  // 실측: 워크트리 5개에 최대 34개 파일의 미커밋 작업이 방치돼 있었다.
  if (!forceDirty) {
    const dirty = dirtyFiles(path);
    if (dirty.length > 0) {
      throw new Error(
        `${path} 에 미커밋 변경 ${dirty.length}건이 있습니다. 커밋해서 회수하거나 정말 버리려면 --force-dirty 를 주십시오.\n` +
          dirty.slice(0, 10).map((line) => `  ${line}`).join("\n") +
          (dirty.length > 10 ? `\n  ... 외 ${dirty.length - 10}건` : ""),
      );
    }
  }

  if (!keepBranch && !forceDirty) {
    if (!branch) {
      throw new Error(
        `${path} 는 detached HEAD 입니다. 커밋 유실 여부를 판정할 수 없으므로 --force-dirty 로만 제거할 수 있습니다.`,
      );
    }
    const ahead = unmergedCommits(branch);
    if (ahead > 0) {
      throw new Error(
        `브랜치 ${branch} 에 main 으로 병합되지 않은 커밋 ${ahead}건이 있습니다. 병합하거나 --keep-branch 를 주십시오.`,
      );
    }
  }

  // node_modules 정션을 먼저 끊는다 — git 은 추적 파일만 지우므로 정션이 남아 디렉터리가
  // 비지 않고, 결과적으로 껍데기 디렉터리가 잔존한다.
  const linkPath = join(path, "node_modules");
  if (existsSync(linkPath)) unlinkSync(linkPath);
  git(["worktree", "remove", "--force", path]);
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  if (!keepBranch && branch) {
    try {
      git(["branch", "-D", branch]);
    } catch {
      console.warn(`[warn] 브랜치 ${branch} 삭제 실패 — 수동 확인 필요.`);
    }
  }
  console.log(
    `제거 완료: ${path}${keepBranch && branch ? ` (브랜치 ${branch} 유지)` : ""}`,
  );
}

function list() {
  const entries = listWorktrees();
  if (entries.length === 0) {
    console.log("등록된 에이전트 워크트리가 없습니다.");
    return;
  }
  for (const entry of entries) {
    const envLocal = join(entry.path, ".env.local");
    const port = existsSync(envLocal)
      ? (/^DEV_SERVER_PORT=(\d+)$/m.exec(readFileSync(envLocal, "utf8"))?.[1] ?? "?")
      : "?";
    // 미커밋 변경과 main 대비 뒤처짐은 워크트리 안에만 보여서 `git branch -vv` 로는 안 보인다.
    // 회수되지 않은 작업을 상시 드러내려고 함께 출력한다.
    const dirty = dirtyFiles(entry.path).length;
    const behind = entry.branch ? unmergedForDisplay(entry.branch) : null;
    const flagged = [
      dirty > 0 ? `dirty=${dirty}` : null,
      behind === null ? "unmerged=?" : behind > 0 ? `unmerged=${behind}` : null,
    ].filter(Boolean);
    const suffix = flagged.length > 0 ? `\t${flagged.join(" ")}` : "\tclean";
    console.log(`${entry.branch ?? "(detached)"}\tport=${port}${suffix}\t${entry.path}`);
  }
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith("--")));
const baseIndex = rest.indexOf("--base");
const baseRef = baseIndex >= 0 ? rest[baseIndex + 1] : undefined;
const pathIndex = rest.indexOf("--path");
const pathRef = pathIndex >= 0 ? rest[pathIndex + 1] : undefined;
const skipValues = new Set([baseRef, pathRef].filter(Boolean));
const positional = rest.filter((arg, index) => {
  if (arg.startsWith("--")) return false;
  if (rest[index - 1] === "--base" || rest[index - 1] === "--path") return false;
  return !skipValues.has(arg);
});

try {
  switch (command) {
    case "create":
      create(positional[0], baseRef);
      break;
    case "remove":
      remove(positional[0], flags.has("--keep-branch"), flags.has("--force-dirty"));
      break;
    case "adopt":
      adopt(positional[0], pathRef);
      break;
    case "list":
      list();
      break;
    case "snapshot":
      console.log(snapshot("snapshot: manual working-tree snapshot"));
      break;
    default:
      console.log("사용: agent-worktree.mjs <create|adopt|remove|list|snapshot> [name] [--base <ref>] [--path <dir>] [--keep-branch] [--force-dirty]");
      process.exit(1);
  }
} catch (error) {
  console.error(`[error] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
