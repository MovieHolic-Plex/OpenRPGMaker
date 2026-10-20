// 프로젝트 코어 번들(project-core.cjs, electron/main/projectCore.ts)을 미리 읽는다.
//
// 코어(약 80MB, 읽는 데 1~2초 메인 스레드를 막는다)는 편집기 부팅에는 필요 없고 **첫 저장**(역직렬화·검증)에서 처음 쓰인다.
// 시작 화면에서 미리 읽었더니 사용자가 그 사이 카드를 누르면 편집기 문서 요청(app://)이 그만큼 밀렸다(2026-10-20 실측 +0.6s).
// 그래서 편집기가 프로젝트를 읽은 뒤 메인이 한가해지면(앱 요청·IPC 가 잠시 없으면) 읽는다. 그 전에 저장하면 그때 읽는다(require 캐시).
// 소스로 돌 때(테스트·dev 스크립트)는 파일이 없으므로 아무 일도 하지 않는다.
import { existsSync } from "node:fs";
import { join } from "node:path";

let preloaded = false;
let scheduled = false;
let lastActivity = 0;

const IDLE_MS = 2_500;
const MAX_WAIT_MS = 60_000;

export function preloadProjectCore(): void {
  if (preloaded) return;
  preloaded = true;
  const path = join(__dirname, "project-core.cjs");
  if (!existsSync(path)) return;
  const started = performance.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(path);
    if (process.env.OPRN_IPC_TIMING === "1") process.stderr.write(`[ipc-timing] project-core preload ${Math.round(performance.now() - started)}ms at ${Math.round(started)}\n`);
  } catch (error) {
    console.warn("[main] 프로젝트 코어를 미리 읽지 못했습니다(처음 쓸 때 다시 읽는다):", error);
  }
}

/** 앱 문서 요청·IPC 가 들어왔다 — 한가함 판정을 미룬다. */
export function noteMainActivity(): void {
  lastActivity = performance.now();
}

/** 메인이 IDLE_MS 동안 요청을 받지 않으면(최대 MAX_WAIT_MS 뒤에는 무조건) 코어를 읽는다. 여러 번 불러도 한 번만 잡는다. */
export function preloadProjectCoreWhenIdle(): void {
  if (preloaded || scheduled) return;
  scheduled = true;
  const startedAt = performance.now();
  const tick = (): void => {
    const now = performance.now();
    if (now - lastActivity >= IDLE_MS || now - startedAt >= MAX_WAIT_MS) { preloadProjectCore(); return; }
    setTimeout(tick, 500);
  };
  setTimeout(tick, IDLE_MS);
}
