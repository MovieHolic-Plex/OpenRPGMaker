// 체크아웃(메인·워크트리)마다 고정 dev 포트 — 배정·검증·기록을 한 곳에서.
//
// 2026-09-17 실측: 워크트리 21개 중 9개가 DEV_SERVER_PORT=9841 이었다 — 메인의 `.env.local` 을
// 손으로 복사하면서 메인의 배정이 그대로 따라온 것이다. `wt adopt` 도 「값이 있으면 그대로」 라
// 겹침을 못 고쳤다. 그래서 `npm run dev:worktree` 는 늘 9841 충돌로 죽고, 사람마다 임의 `--port`
// 를 붙여 「포트가 고정이 안 된다」 가 됐다. 여기서는 **다른 체크아웃이 이미 쥔 값·예약 포트는
// 미배정으로 본다** — 배정은 `.env.local` 에 기록돼 그 뒤로는 같은 워크트리 = 같은 포트다.
//
// 순수 함수(decideWorktreePort 등)는 파일·git 을 모른다. 파일·git 을 만지는 것은 아래
// ensureWorktreeDevPort 하나다.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** 메인 체크아웃 `npm run dev` 의 포트 — 워크트리는 절대 잡지 않는다. */
export const MAIN_DEV_PORT = 9999;
/** `vite preview`(systemd `rpg-zzu.service`) — 배정 범위 안에 있어 스캔이 골라 줄 수 있었다. */
export const PREVIEW_PORT = 9888;
export const RESERVED_PORTS = new Set([MAIN_DEV_PORT, PREVIEW_PORT]);
export const PORT_BASE = 9801;
export const PORT_COUNT = 100;
export const ENV_PORT_KEY = "DEV_SERVER_PORT";

const ENV_PORT_LINE = /^DEV_SERVER_PORT=(\d+)[ \t]*$/m;

/** `.env.local` 본문에서 배정 포트를 읽는다. 없거나 숫자가 아니면 null. */
export function readEnvPort(text) {
  const match = ENV_PORT_LINE.exec(text ?? "");
  if (!match) return null;
  const port = Number(match[1]);
  return Number.isInteger(port) && port > 0 ? port : null;
}

/** 배정 줄을 바꾸거나(있으면) 끝에 붙인다(없으면). 다른 줄은 건드리지 않는다. */
export function writeEnvPort(text, port) {
  const line = `${ENV_PORT_KEY}=${port}`;
  const source = text ?? "";
  if (ENV_PORT_LINE.test(source)) return source.replace(ENV_PORT_LINE, line);
  const body = source.trimEnd();
  return body ? `${body}\n${line}\n` : `${line}\n`;
}

/** 복사해 온 `.env.local` 에서 원본의 배정 줄만 지운다 — 원본의 포트는 원본의 것이다. */
export function stripEnvPort(text) {
  return (text ?? "").replace(/^DEV_SERVER_PORT=\d+[ \t]*\n?/gm, "");
}

/** `git worktree list --porcelain` → [{ path, branch|null }]. 첫 항목이 메인 체크아웃이다. */
export function parseWorktreeList(porcelain) {
  const entries = [];
  let current = null;
  for (const line of (porcelain ?? "").split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length).trim(), branch: null };
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).trim().replace("refs/heads/", "");
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * 다른 체크아웃들이 `.env.local` 에 기록한 포트 → 그 경로들. `self` 는 뺀다.
 * `readEnv(path)` 는 그 체크아웃의 `.env.local` 본문(없으면 null)을 돌려준다.
 */
export function claimedPortsByOthers(entries, self, readEnv) {
  const claimed = new Map();
  const selfPath = resolve(self);
  for (const entry of entries) {
    const path = resolve(entry.path);
    if (path === selfPath) continue;
    const port = readEnvPort(readEnv(path));
    if (port === null) continue;
    if (!claimed.has(port)) claimed.set(port, []);
    claimed.get(port).push(path);
  }
  return claimed;
}

/**
 * 이 체크아웃의 포트를 정한다. 지금 값이 있고 남과 겹치지 않고 예약이 아니면 그대로(kept).
 * 아니면 범위 안에서 남이 안 쥔 첫 포트를 새로 준다. 값이 범위 밖이어도 유일하면 그대로 둔다 —
 * 사람이 고른 값을 스캔이 뒤집지 않는다.
 */
export function decideWorktreePort({ current, claimed, reserved = RESERVED_PORTS, base = PORT_BASE, count = PORT_COUNT }) {
  const taken = claimed instanceof Map ? claimed : new Map(Array.from(claimed ?? [], (port) => [port, []]));
  if (current !== null && current !== undefined) {
    if (reserved.has(current)) return { port: allocate(), reason: "reserved", previous: current, holders: [] };
    if (taken.has(current)) return { port: allocate(), reason: "duplicate", previous: current, holders: taken.get(current) };
    return { port: current, reason: "kept", previous: current, holders: [] };
  }
  return { port: allocate(), reason: "missing", previous: null, holders: [] };

  function allocate() {
    for (let port = base; port < base + count; port += 1) {
      if (reserved.has(port) || taken.has(port)) continue;
      return port;
    }
    throw new Error(`${ENV_PORT_KEY} 배정 범위(${base}~${base + count - 1})가 다 찼습니다 — 지운 워크트리의 .env.local 을 정리하세요.`);
  }
}

/** `--port N` / `--port=N` 중 마지막 값. 없으면 null. */
export function parsePortArg(args) {
  let port = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--port" && i + 1 < args.length) port = Number(args[i + 1]);
    else if (arg.startsWith("--port=")) port = Number(arg.slice("--port=".length));
  }
  return Number.isInteger(port) && port > 0 ? port : null;
}

/** `--port` 인자를 뺀 나머지 — 런처가 정한 포트 뒤에 사용자 인자를 붙일 때 쓴다. */
export function withoutPortArg(args) {
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--port") { i += 1; continue; }
    if (arg.startsWith("--port=")) continue;
    rest.push(arg);
  }
  return rest;
}

/**
 * 메인 체크아웃 전용 `npm run dev` 가 여기서 떠도 되는가.
 * 링크된 워크트리에서는 명시 `--port`(예약 아닌 값) 가 있을 때만 통과 — playwright 의 webServer 가
 * 그렇게 부른다. 포트 없이 부르면 9999 를 잡아 메인 서버와 충돌하거나 사용자가 남의 브랜치를 본다.
 */
export function decideMainDev({ linked, explicitPort }) {
  if (!linked) return { ok: true, port: explicitPort ?? MAIN_DEV_PORT };
  if (explicitPort === null || explicitPort === undefined) {
    return { ok: false, reason: `이 디렉터리는 git 워크트리다. ${MAIN_DEV_PORT} 는 메인 체크아웃의 포트라 여기서 'npm run dev' 는 거절한다 — 'npm run dev:worktree' 를 쓰라(이 워크트리의 고정 포트로 뜬다).` };
  }
  if (RESERVED_PORTS.has(explicitPort)) {
    return { ok: false, reason: `포트 ${explicitPort} 는 예약돼 있다(${MAIN_DEV_PORT}=메인 dev, ${PREVIEW_PORT}=preview). 워크트리는 'npm run dev:worktree' 로 자기 고정 포트를 쓴다.` };
  }
  return { ok: true, port: explicitPort };
}

/** `.git` 이 디렉터리가 아니라 gitfile 이면 링크된 워크트리다(`git worktree add`, Paseo, codex, .claude/worktrees 전부). */
export function isLinkedWorktree(root) {
  try {
    return statSync(join(root, ".git")).isFile();
  } catch {
    return false;
  }
}

function gitOut(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/** 공용 git 디렉터리(메인 체크아웃의 .git). 워크트리에서 불러도 같은 값. */
export function gitCommonDir(root) {
  try {
    return gitOut(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  } catch {
    return join(root, ".git");
  }
}

/** 메인 체크아웃 경로 — `.env.local` 복사 원본. */
export function sourceRepoRoot(root) {
  return dirname(gitCommonDir(root));
}

/** 이 체크아웃의 브랜치 이름(분리 HEAD 면 null). 안내문에만 쓴다. */
export function currentBranch(root) {
  try {
    const name = gitOut(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
    return name === "HEAD" ? null : name;
  } catch {
    return null;
  }
}

export function listWorktrees(root) {
  try {
    return parseWorktreeList(gitOut(root, ["worktree", "list", "--porcelain"]));
  } catch {
    return [];
  }
}

/**
 * 스캔→기록 구간을 공용 .git 아래 mkdir 락으로 직렬화한다(agent-worktree.mjs 와 같은 락).
 * 쥔 프로세스가 죽으면 디렉터리가 남으므로 60초 지난 락은 회수한다.
 */
export function withPortLock(root, fn) {
  const lockDir = join(gitCommonDir(root), "wt-port.lock");
  const tick = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > 60_000) rmdirSync(lockDir);
      } catch {
        /* 회수 경합 — 다음 루프에서 재시도 */
      }
      Atomics.wait(tick, 0, 0, 50);
    }
  }
  try {
    return fn();
  } finally {
    try { rmdirSync(lockDir); } catch { /* 이미 회수됨 */ }
  }
}

function readEnvLocal(path) {
  const file = join(path, ".env.local");
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

/**
 * 이 체크아웃의 고정 포트를 보장한다: 없거나·남과 겹치거나·예약이면 새로 배정해 `.env.local` 에
 * 기록한다. `.env.local` 자체가 없으면 메인 체크아웃 것을 복사(원본 배정 줄은 지움)한 뒤 기록한다.
 * 돌려주는 값: { port, reason: kept|missing|duplicate|reserved, previous, holders }.
 */
export function ensureWorktreeDevPort(root) {
  const self = resolve(root);
  return withPortLock(self, () => {
    const envLocal = join(self, ".env.local");
    let text = readEnvLocal(self);
    let copied = false;
    if (text === null) {
      const source = join(sourceRepoRoot(self), ".env.local");
      text = existsSync(source) && resolve(dirname(source)) !== self ? stripEnvPort(readFileSync(source, "utf8")) : "";
      copied = true;
    }
    const claimed = claimedPortsByOthers(listWorktrees(self), self, readEnvLocal);
    const decision = decideWorktreePort({ current: readEnvPort(text), claimed });
    if (decision.reason !== "kept" || copied) writeFileSync(envLocal, writeEnvPort(text, decision.port), "utf8");
    return { ...decision, copied, envLocal };
  });
}
