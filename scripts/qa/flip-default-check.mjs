#!/usr/bin/env node
// P6 이관 검증 하네스 — 기본 저장소를 메모리 어댑터로 **잠깐** 뒤집고 테스트를 돌린다.
//
// 왜 필요한가: 이관된 테스트는 "양쪽 기본값에서 다 통과" 해야 증명된다. 손으로 뒤집으면
// 실행이 길어질 때 리포가 뒤집힌 채 남는다(실측: 두 번 남았다). 이 스크립트는 어떻게 끝나든
// (성공·실패·SIGINT·SIGTERM) 원본을 되돌리고, 동시 실행을 거부한다.
//
// 사용: node scripts/qa/flip-default-check.mjs test/a.test.ts [more...]
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TARGET = join(REPO, "src/project/persistence/repository.ts");
const BACKUP = join(REPO, ".flip-default-check.bak");
const LOCK = join(REPO, ".flip-default-check.lock");

const FLIPS = [
  ['import { createSupabaseRepository } from "./supabaseRepository";', 'import { createMemoryRepository } from "./memoryRepository";'],
  ["let remote: ProjectRepository | null = null;", "let memory: ProjectRepository | null = null;"],
  ["  remote ??= createSupabaseRepository();\n  return remote;", "  memory ??= createMemoryRepository({ target: null });\n  return memory;"],
];

function restore() {
  if (!existsSync(BACKUP)) return;
  writeFileSync(TARGET, readFileSync(BACKUP, "utf8"));
  rmSync(BACKUP, { force: true });
}

// 비동기 spawn 이어야 한다. execFileSync 는 이벤트 루프를 막아 SIGTERM 핸들러가 돌지 못하고
// 프로세스가 그대로 죽어 리포가 뒤집힌 채 남는다(실측). 그리고 detached 로 묶어야 한다 —
// vitest 손자 프로세스가 stdout 파이프를 쥐고 있으면 부모가 죽어도 `$(...)` 가 영원히 안 끝난다.
let vitestChild = null;
function killVitestTree() {
  if (!vitestChild) return;
  try {
    process.kill(-vitestChild.pid, "SIGKILL");
  } catch {
    /* 이미 끝났다 */
  }
  vitestChild = null;
}

function runVitest(targets) {
  return new Promise((resolveExit) => {
    vitestChild = spawn("npx", ["vitest", "run", ...targets, "--reporter=dot"], {
      cwd: REPO,
      stdio: "inherit",
      detached: true,
    });
    vitestChild.on("close", (signalOrCode) => {
      vitestChild = null;
      resolveExit(typeof signalOrCode === "number" ? signalOrCode : 1);
    });
  });
}

const files = process.argv.slice(2);
// 인자가 없으면 전체 스위트를 돌린다 — 뒤집힌 기본값에서 무엇이 깨지는지 한 번에 세려면 이게 필요하다.
if (existsSync(LOCK)) {
  console.error(`${LOCK} 이 있다 — 다른 뒤집기 검증이 진행 중이다. 끝난 뒤 다시 실행하라.`);
  process.exit(2);
}

const original = readFileSync(TARGET, "utf8");
if (!FLIPS.every(([from]) => original.includes(from))) {
  console.error("repository.ts 에서 뒤집을 지점을 찾지 못했다 — 이미 뒤집혔거나 코드가 바뀌었다.");
  process.exit(2);
}

writeFileSync(BACKUP, original);
writeFileSync(LOCK, String(process.pid));
// SIGTERM/SIGINT 는 Node 기본 동작으로 죽으면 finally 를 건너뛴다 — 뒤집힌 채 남는 경로가 바로 그곳이다(실측 2회).
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    restore();
    killVitestTree();
    rmSync(LOCK, { force: true });
    const now = readFileSync(TARGET, "utf8");
    console.error(now.includes("remote ??= createSupabaseRepository();")
      ? `--- ${signal} 수신, 원복했다 ---`
      : `--- ${signal} 수신, 원복 실패! repository.ts 를 손으로 확인하라 ---`);
    process.exit(130);
  });
}
let code = 1;
try {
  writeFileSync(TARGET, FLIPS.reduce((text, [from, to]) => text.replace(from, to), original));
  console.log("--- 기본 저장소를 메모리 어댑터로 뒤집었다 ---");
  code = await runVitest(files);
} catch (error) {
  code = typeof error?.status === "number" ? error.status : 1;
} finally {
  killVitestTree();
  restore();
  rmSync(LOCK, { force: true });
  const now = readFileSync(TARGET, "utf8");
  console.log(now.includes("remote ??= createSupabaseRepository();")
    ? "--- 원복 확인: 기본 저장소는 Supabase 어댑터다 ---"
    : "--- 원복 실패! repository.ts 를 손으로 확인하라 ---");
  if (!now.includes("remote ??= createSupabaseRepository();")) code = 3;
}
process.exit(code);
