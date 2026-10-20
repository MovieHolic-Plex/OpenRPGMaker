// 프로젝트 코어 번들(project-core.cjs, electron/main/projectCore.ts)을 미리 읽는다.
// 시작 화면이 뜬 뒤 한가할 때 부른다 — 처음 쓰는 순간(편집기 첫 load·저장)에 메인 스레드가 2초 남짓 막히지 않게.
// 소스로 돌 때(테스트·dev 스크립트)는 파일이 없으므로 아무 일도 하지 않는다. require 캐시가 대역과 같은 모듈을 돌려준다.
import { existsSync } from "node:fs";
import { join } from "node:path";

let preloaded = false;

export function preloadProjectCore(): void {
  if (preloaded) return;
  preloaded = true;
  const path = join(__dirname, "project-core.cjs");
  if (!existsSync(path)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(path);
  } catch (error) {
    console.warn("[main] 프로젝트 코어를 미리 읽지 못했습니다(처음 쓸 때 다시 읽는다):", error);
  }
}
