// 파일 메뉴가 다른 폴더를 열기 전에 보는 저장 결과. Electron 을 부르지 않는다.
//
// 편집기의 미저장 변경은 렌더러 메모리에 있다. 메인이 폴더를 먼저 바꾸면 그 변경은
// 저장되지 않은 채 문서가 다시 뜬다. 렌더러가 flush 를 끝낸 뒤에만 넘어간다.

import { OPRN_APP_SCHEME } from "./channels";

/** 저장이 끝났고, 그 결과가 문서를 남기지 않은 종류. conflict·error 는 없다. */
const SETTLED_FLUSH_KINDS = new Set(["saved", "saved-local", "not-loaded", "not-configured", "disabled"]);

/**
 * 폴더를 바꿔도 되는 보고인가.
 * dirty 가 남아 있으면 종류가 saved 여도 거절한다 — flush 도중에 다시 칠한 변경을 버리지 않는다.
 */
export function folderSwitchFlushOk(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const report = payload as { kind?: unknown; dirty?: unknown };
  return report.dirty === false && typeof report.kind === "string" && SETTLED_FLUSH_KINDS.has(report.kind);
}

/** 창 컨트롤·저장 신호를 받을 렌더러 문서. 배포는 app://, 개발 서버는 그 출처만. */
export function isAppRendererFrame(url: string, devServerUrl: string | undefined): boolean {
  if (url.startsWith(`${OPRN_APP_SCHEME}://`)) return true;
  if (!devServerUrl) return false;
  try {
    return new URL(url).origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}
