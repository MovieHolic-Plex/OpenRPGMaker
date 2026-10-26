// 프로젝트 창을 닫을 때의 결정. Electron 을 부르지 않는다 — 메인(main.ts)과 테스트가 같은 표를 본다.
//
// 닫기는 저장(flush) → 렌더러 ack → destroy 다. 두 가지를 지키지 않으면 저장이 끊긴다.
// 1. 이미 저장을 기다리는 중에 close 가 한 번 더 오면(닫기 연타, Quit 이 창을 다시 닫기) 그것도 막는다.
//    막지 않으면 기본 동작이 창을 바로 없애 저장 중이던 변경을 잃는다.
//    destroy() 는 close 를 다시 보내지 않으므로, 이 막음이 저장이 끝난 뒤의 실제 파괴를 가로채지 않는다.
// 2. Quit(Cmd+Q·독·종료)은 창이 close 를 막으면 통째로 취소된다. 저장 때문에 막았으면, 그 창들의 저장이
//    끝난 뒤에 Quit 을 다시 건다. 막을 일이 없었으면(시작 화면) 첫 Quit 이 그대로 끝난다.

export type CloseDecision = "allow" | "flush" | "hold";

/** 이 close 를 그대로 둘지, 저장을 시작할지, 이미 시작한 저장이 끝날 때까지 창을 붙들지. */
export function decideWindowClose(alreadyClosing: boolean, hasSession: boolean): CloseDecision {
  if (alreadyClosing) return "hold";
  if (!hasSession) return "allow";
  return "flush";
}

/**
 * 저장 때문에 종료를 한 번이라도 막았는지. allow(시작 화면)는 종료를 막지 않으므로 표시를 바꾸지 않는다.
 * 한 번 참이 되면 저장이 끝날 때까지 유지한다 — 다음 창의 일반 닫기가 앞선 Quit 을 지우면 안 된다.
 */
export function nextQuitHeld(alreadyHeld: boolean, quitRequested: boolean, decision: CloseDecision): boolean {
  if (decision === "allow") return alreadyHeld;
  return alreadyHeld || quitRequested;
}

/**
 * 저장 때문에 막힌 Quit 을 다시 걸지. 아직 저장 중인 창이 있으면 그 창이 닫힌 다음에 한다.
 * Quit 을 요청하지 않았거나, 막을 일이 없었으면 거짓 — 마지막 창을 그냥 닫아도 macOS 앱은 남는다.
 */
export function shouldRetryQuit(input: {
  readonly quitRequested: boolean;
  readonly quitHeld: boolean;
  readonly windowsStillFlushing: number;
}): boolean {
  return input.quitRequested && input.quitHeld && input.windowsStillFlushing === 0;
}
