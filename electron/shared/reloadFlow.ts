// 보기 메뉴의 새로고침(Ctrl/Cmd+R). Electron 을 부르지 않는다 — 메인과 렌더러와 테스트가 같은 표를 본다.
//
// 창을 닫을 때는 저장한 뒤 없앤다. 보기 메뉴의 Reload 는 그 경로를 타지 않고 렌더러만 다시 읽는다.
// 데스크톱은 닫기 확인과 겹치지 않게 beforeunload 저장을 건너뛰므로, 그대로 두면 방금 그린 맵이 사라진다.

export type ReloadPlan = "reload-now" | "flush-then-reload" | "ignore";

/** 지금 새로고침을 바로 할지, 저장부터 할지, 이미 저장·닫기 중이라 무시할지. */
export function planWindowReload(input: {
  readonly hasSession: boolean;
  readonly flushListenerReady: boolean;
  readonly closeFlushInProgress: boolean;
  readonly reloadFlushInProgress: boolean;
}): ReloadPlan {
  if (input.closeFlushInProgress || input.reloadFlushInProgress) return "ignore";
  // 시작 화면이거나 편집기 스크립트가 아직 없다. 메모리에 저장할 편집이 없다.
  if (!input.hasSession || !input.flushListenerReady) return "reload-now";
  return "flush-then-reload";
}

/** 이 저장 결과면 메모리의 편집이 디스크와 같다. 충돌·예외는 여기 없다. */
const RELOAD_SAFE_KINDS = new Set(["saved", "saved-local", "not-loaded", "not-configured", "disabled"]);

/**
 * 저장이 끝나도 편집이 남아 있으면(충돌, 기록하지 않은 세션, 저장 실패) 새로고침하지 않는다.
 * 새로고침은 그 메모리를 버린다.
 */
export function reloadFlushAllowsReload(resultKind: string, stillDirty: boolean): boolean {
  if (stillDirty) return false;
  return RELOAD_SAFE_KINDS.has(resultKind);
}
