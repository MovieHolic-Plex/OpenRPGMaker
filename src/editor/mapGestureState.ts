// editor/mapGestureState.ts
// 지도 위에서 사람의 손이 움직이는 중인가 — 드래그·칠하기·팬·영역 지정·붙여넣기 미리보기.
//
// 왜(2026-10-16): 지도 위 번호 상자·핀·주문 사각형은 AI 이벤트가 올 때마다 다시 그려진다. 사람이 드래그하는 동안 그 재그리기가 프레임을 먹으면
// 드래그가 끊긴다. EditScene 이 제스처 판정(`shouldDeferCameraFocus` — 카메라 초점 양보와 같은 판정)을 한 곳에 알리고,
// 지도 쪽 표면은 제스처 중에는 「바뀌었다」만 표시해 두었다가 제스처가 끝나면 한 번에 반영한다(`yieldWhileGesture`).
// 좌표 따라가기(팬·줌)는 양보하지 않는다 — 상자가 지도에서 떨어져 보이면 안 된다.

let active = false;
const listeners = new Set<(active: boolean) => void>();

export function isMapGestureActive(): boolean {
  return active;
}

/** EditScene 이 프레임마다 판정을 알린다. 값이 바뀔 때만 구독자를 깨운다. */
export function setMapGestureActive(next: boolean): void {
  if (active === next) return;
  active = next;
  for (const listener of [...listeners]) listener(next);
}

export function subscribeMapGesture(listener: (active: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * 제스처 중에는 `apply` 를 미루고, 끝나면(또는 `maxDeferMs` 가 지나면) 한 번 부른다. 제스처가 아니면 바로 부른다.
 * 반환값: 미뤘으면 true. 긴 팬에서 표면이 영영 낡지 않도록 미룸에는 상한이 있다.
 */
export function yieldWhileGesture(apply: () => void, state: { off: (() => void) | null; timer: ReturnType<typeof setTimeout> | null }, maxDeferMs = 1000): boolean {
  if (!active) { apply(); return false; }
  if (state.off) return true;
  const run = (): void => {
    state.off?.(); state.off = null;
    if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
    apply();
  };
  state.off = subscribeMapGesture(on => { if (!on) run(); });
  state.timer = setTimeout(run, maxDeferMs);
  return true;
}

/** 테스트 전용. */
export function resetMapGestureForTest(): void {
  active = false;
  listeners.clear();
}
