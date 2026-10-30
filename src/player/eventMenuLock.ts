// 이벤트(컷신·대사 줄)가 도는 동안 메뉴를 잠그는 규칙 — 키보드(X·Esc)·터치 메뉴 단추·조작 안내가 함께 따른다.
//
// 기본은 잠금이다(RPG 만들기 관례). 작가가 「대기 중 이벤트 이동 허용」(displayTextSettings
// allowEventMovementDuringWait)을 켠 이벤트만 필드 조작이 열려 있으므로 메뉴도 열린다 — 이것이 유일한 예외(opt-in)다.
//
// 이어지는 이벤트 사이 틈: 자동 실행 이벤트가 끝나고 다음 자동 실행이 시작되기 전 한두 프레임 동안 running 이 false 였다.
// 그 틈에 누른 X 가 장면 한가운데서 메뉴를 열었다(2026-10-30 첫사랑 「X 키 메뉴」). 이벤트가 끝난 뒤 짧게(EVENT_MENU_SETTLE_MS)
// 더 잠가 둔다 — 정말 조작으로 돌아온 플레이어에게는 느껴지지 않는 길이다.
export const EVENT_MENU_SETTLE_MS = 350;

type LockSession = { readonly messageWindowSettings?: { readonly allowEventMovementDuringWait?: boolean } | undefined };

const lastLockedAt = new WeakMap<object, number>();

/** 지금 이 순간 이벤트가 메뉴를 잠그는가(틈 보정 없음). */
export function eventHoldsMenu(running: boolean | undefined, session: LockSession | undefined): boolean {
  return running === true && session?.messageWindowSettings?.allowEventMovementDuringWait !== true;
}

/**
 * 메뉴 잠금(틈 보정 포함). 매 프레임과 키 입력에서 부른다. key 는 장면마다 하나인 객체(세션).
 */
export function eventMenuLocked(running: boolean | undefined, session: (LockSession & object) | undefined, nowMs: number): boolean {
  if (eventHoldsMenu(running, session)) {
    if (session) lastLockedAt.set(session, nowMs);
    return true;
  }
  if (!session) return false;
  const at = lastLockedAt.get(session);
  return at !== undefined && nowMs - at >= 0 && nowMs - at < EVENT_MENU_SETTLE_MS;
}
