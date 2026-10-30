import type { EventPageGraphic } from "@/project/types";

/**
 * 도구가 모델 대신 스스로 고른 캐릭터 칩(그림 없는 대화 페이지의 기본 주민, 이름으로 찾은 문·상자 칩).
 *
 * Pi 의 캐릭터 그림 선택 관문(charsetSelectionGate)은 「모델이 list_npc_graphics 결과로 본 칩만 쓴다」는 계약이다.
 * 도구가 고른 기본 그림은 모델의 선택이 아니므로 그 계약의 대상이 아니다 — 실측(2026-10-30 blank 재현): 그림 없이
 * upsert_event 로 대화 이벤트를 만들면 도구가 붙인 주민 기본 칩(people1:4)·문 칩(object1:0)을 관문이 「캐릭터 그림
 * 선택을 되돌렸습니다」로 거절해 이벤트 전체가 사라졌다. 도구는 여기에 적고, 관문은 같은 호출 안에서 적힌 칩만 면제한다.
 * 편집기(관문 없음)에서는 적기만 하고 아무도 읽지 않는다.
 */
let collecting: Array<{ resource: string; pattern: number }> | null = null;

export function noteToolChosenGraphic(graphic: EventPageGraphic | undefined): void {
  const sprite = graphic?.sprite;
  if (!collecting || !sprite || graphic?.transparent === true || typeof sprite.id !== "string") return;
  collecting.push({ resource: sprite.id, pattern: typeof graphic.pattern === "number" ? graphic.pattern : 0 });
}

/** fn 을 돌리는 동안 도구가 스스로 고른 칩을 모은다. 비동기 도구도 같은 호출 안의 기록만 받는다(중첩 호출은 바깥 목록을 되살린다). */
export async function collectToolChosenGraphics<T>(fn: () => T | Promise<T>): Promise<{ value: T; chosen: Array<{ resource: string; pattern: number }> }> {
  const outer = collecting;
  const chosen: Array<{ resource: string; pattern: number }> = [];
  collecting = chosen;
  try {
    const value = await fn();
    return { value, chosen };
  } finally {
    collecting = outer;
  }
}
