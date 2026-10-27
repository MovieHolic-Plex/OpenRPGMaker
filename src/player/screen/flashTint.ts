// 화면 플래시가 색조 칸을 잠깐 빌린 뒤, 플래시가 끝나면 그 전에 있던 색조로 되돌린다.
//
// Screen Effect 의 flash 는 보이는 오버레이가 0×0 이던 시절의 우회로로 `screen.tint` 에
// 플래시 색을 써 둔다. 흰색만 끝나면 "none" 으로 지우고, 빨강·파랑·#rrggbb 는 그 색이
// 색조로 남았다. 흰색도 덮기 전의 색조(페이드 아웃의 검정 등)를 지워 버렸다.

import type { M2ScreenRuntimeState } from "@/project/sessionRuntimeTypes";

const tintBeforeFlash = new WeakMap<M2ScreenRuntimeState, string | undefined>();

/** 플래시가 색조를 덮어쓰기 직전에 부른다. 플래시가 겹치면 맨 처음 색조만 기억한다. */
export function rememberTintForFlash(screen: M2ScreenRuntimeState): void {
  if (tintBeforeFlash.has(screen)) return;
  tintBeforeFlash.set(screen, screen.tint);
}

/**
 * 플래시가 끝난 뒤 색조를 되돌린다. 기억해 둔 값이 없으면, 예전 흰색 플래시가 남기던
 * `255,255,255,0.85` 만 걷어 낸다(그 외의 색조는 플래시가 쓴 것이 아니다).
 * 되돌린 색은 바로 보이게 전환 시간을 0 으로 둔다 — 플래시 전에 있던 페이드를 다시 재생하지 않는다.
 */
export function restoreTintAfterFlash(screen: M2ScreenRuntimeState | undefined): void {
  if (!screen) return;
  if (!tintBeforeFlash.has(screen)) {
    if (screen.tint === "255,255,255,0.85") {
      screen.tint = "none";
      screen.tintDurationMs = 0;
    }
    return;
  }
  const tint = tintBeforeFlash.get(screen);
  tintBeforeFlash.delete(screen);
  delete screen.flash;
  delete screen.flashUntilMs;
  if (tint === undefined) delete screen.tint;
  else screen.tint = tint;
  screen.tintDurationMs = 0;
}
