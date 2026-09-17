#!/usr/bin/env node
// dev 서버 런처 — `npm run dev`(메인 체크아웃, 9999)와 `npm run dev:worktree`(체크아웃별 고정 포트)의 입구.
//
// 왜 vite 를 직접 안 부르나(2026-09-17 실측): 이 박스에 rpg-zzu 체크아웃이 21개다. `npm run dev` 는
// 9999 하드코딩이라 워크트리 에이전트가 그대로 치면 메인 포트를 잡고(그러면 사용자가 9999 에서 남의
// 브랜치를 본다), `npm run dev:worktree` 는 포트가 없어 `.env.local` 의 DEV_SERVER_PORT 로 떨어지는데
// 손으로 복사한 `.env.local` 은 메인의 9841 을 그대로 물고 있어 9개 워크트리가 같은 포트였다. 그래서
// 세션마다 임의 `--port` 가 붙고 「포트가 고정이 안 된다」 가 됐다. 여기서 두 가지를 강제한다:
//   1. 링크된 워크트리에서 `npm run dev` 는 거절한다(명시 --port 가 있으면 통과 — playwright webServer).
//   2. `npm run dev:worktree` 는 포트를 스스로 배정·기록한다(겹침·예약 포트는 미배정으로 본다).
//      한 번 기록되면 같은 워크트리 = 같은 포트다. 명시 `--port` 는 임시 우회로 남는다.
//
// 사용: node scripts/dev-server.mjs <main|worktree> [vite 인자…]
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAIN_DEV_PORT,
  PREVIEW_PORT,
  RESERVED_PORTS,
  currentBranch,
  decideMainDev,
  ensureWorktreeDevPort,
  isLinkedWorktree,
  parsePortArg,
  sourceRepoRoot,
  withoutPortArg,
} from "./lib/worktreeDevPort.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [mode, ...userArgs] = process.argv.slice(2);

function fail(message, code = 2) {
  console.error(`[dev] ${message}`);
  process.exit(code);
}

/** 포트를 쥔 프로세스와 그 cwd — 「내 서버가 이미 떠 있다」 와 「남의 서버다」 를 가른다(리눅스 한정, 실패해도 무해). */
function describeHolder(port) {
  if (process.platform !== "linux") return null;
  try {
    const out = execFileSync("ss", ["-ltnpH", `sport = :${port}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pid = /pid=(\d+)/.exec(out)?.[1];
    if (!pid) return null;
    let cwd = null;
    try { cwd = execFileSync("readlink", [`/proc/${pid}/cwd`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* 권한 없음 */ }
    return { pid: Number(pid), cwd };
  } catch {
    return null;
  }
}

function portFree(host, port) {
  return new Promise((resolveFree) => {
    const server = net.createServer();
    server.once("error", () => resolveFree(false));
    server.listen({ host, port }, () => server.close(() => resolveFree(true)));
  });
}

function launchVite(viteArgs, env) {
  const viteJs = join(ROOT, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteJs)) {
    fail(`node_modules 가 없다(${viteJs}). 워크트리면 'npm run wt -- adopt --path ${ROOT}' 로 node_modules 정션·env 를 채운 뒤 다시 실행.`);
  }
  const child = spawn(process.execPath, [viteJs, ...viteArgs], { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => { if (!child.killed) child.kill(signal); });
  }
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

const linked = isLinkedWorktree(ROOT);
const explicitPort = parsePortArg(userArgs);

if (mode === "main") {
  const decision = decideMainDev({ linked, explicitPort });
  if (!decision.ok) fail(decision.reason);
  console.log(`[dev] ${linked ? `워크트리 ${ROOT}` : "메인 체크아웃"} · 포트 ${decision.port}${explicitPort === null ? "" : " (명시)"} · http://127.0.0.1:${decision.port}`);
  // 원래 스크립트 그대로 — 사용자 인자는 뒤에 붙어 vite CLI 규칙(마지막 값 우선)으로 덮는다.
  launchVite(["--configLoader", "runner", "--host", "0.0.0.0", "--port", String(MAIN_DEV_PORT), "--strictPort", ...userArgs], {});
} else if (mode === "worktree") {
  let port;
  let note;
  if (explicitPort !== null) {
    if (RESERVED_PORTS.has(explicitPort)) fail(`포트 ${explicitPort} 는 예약돼 있다(${MAIN_DEV_PORT}=메인 dev, ${PREVIEW_PORT}=preview).`);
    port = explicitPort;
    note = "명시 --port · 이 워크트리의 고정 포트가 아니다(임시)";
  } else {
    const assigned = ensureWorktreeDevPort(ROOT);
    port = assigned.port;
    if (assigned.reason === "kept") note = `고정 · ${assigned.envLocal} DEV_SERVER_PORT`;
    else if (assigned.reason === "missing") note = `${assigned.copied ? ".env.local 을 메인에서 복사하고 " : ""}DEV_SERVER_PORT 가 없어 새로 배정 → .env.local 에 기록`;
    else if (assigned.reason === "duplicate") {
      const main = sourceRepoRoot(ROOT);
      const names = assigned.holders.map((path) => (path === main ? `메인 체크아웃(${path})` : path));
      const shown = names.length > 3 ? `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}곳` : names.join(", ");
      note = `이전 값 ${assigned.previous} 은 ${shown} 과 겹쳐 새로 배정 → .env.local 갱신`;
    }
    else note = `이전 값 ${assigned.previous} 은 예약 포트라 새로 배정 → .env.local 갱신`;
  }
  const branch = currentBranch(ROOT);
  console.log(`[dev] ${linked ? "워크트리" : "체크아웃"} ${ROOT}${branch ? ` [${branch}]` : ""}`);
  console.log(`[dev] 포트 ${port} · ${note}`);
  console.log(`[dev] http://127.0.0.1:${port}   (e2e: DEV_SERVER_PORT=${port} npx playwright test …)`);
  if (!(await portFree("127.0.0.1", port))) {
    const holder = describeHolder(port);
    if (holder?.cwd && holder.cwd === ROOT) {
      fail(`포트 ${port} 에 이 워크트리의 서버가 이미 떠 있다(pid ${holder.pid}). 그것을 쓰라: http://127.0.0.1:${port}`, 0);
    }
    fail(`포트 ${port} 사용 중${holder ? ` — pid ${holder.pid}${holder.cwd ? ` (${holder.cwd})` : ""}` : ""}. 남의 서버면 끄지 말고, 임시로 '-- --port <다른 값>' 을 주거나 그쪽이 끝나길 기다린다.`, 1);
  }
  launchVite(["--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port), "--strictPort", ...withoutPortArg(userArgs)], { DEV_SERVER_PORT: String(port) });
} else {
  fail("사용: node scripts/dev-server.mjs <main|worktree> [vite 인자…]");
}
