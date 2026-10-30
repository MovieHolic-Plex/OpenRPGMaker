import type { Dir } from "@/player/input";
import type { RuntimeEventView } from "@/project/runtimeEventState";

/**
 * 정면·발밑에 조사할 것이 없을 때, 바로 곁(상하좌우 한 칸, 그다음 대각 한 칸)에 몸이 닿은 조사 이벤트를 고른다 — 순수 함수.
 *
 * 왜(2026-10-31 미스터리·방탈출 판 74개 판정 기록 집계): 판정자가 Enter/z 를 눌러 아무 일도 없던 608번 중 436번(72%)이
 * 조사 이벤트에서 두 칸 안이었다. 대상 바로 옆에 서서 등·옆을 대고 누르거나, 2칸 가구의 대각 모서리에서 누르면 RM 관례(정면 한 칸만)로는
 * 아무 일이 없다. 추리 판 엔딩 미달 18판 중 10판이 「단서·조사 지점을 못 찾음」이었다(vm1~8-1029·sl1~3-1030).
 * 정면에 아무것도 없을 때만 쓰므로 정면 대상이 있는 기존 동작은 그대로다.
 *
 * 고르는 순서: 지금 목표가 가리키는 이벤트 → 상하좌우 → 대각. 같은 등급이면 위·왼쪽·오른쪽·아래 순(결정적).
 * 밀기·숨기 이벤트는 고르지 않는다(등 뒤 가구가 밀리거나 몸이 숨는 일은 의도가 아니다).
 */
export type NearbyActionTarget = {
  readonly view: RuntimeEventView;
  /** 주인공이 돌아설 방향. 대각이면 가로 방향. */
  readonly face: Dir;
  readonly diagonal: boolean;
};

export function pickNearbyActionTarget(
  views: readonly RuntimeEventView[],
  tileX: number,
  tileY: number,
  options: {
    readonly front?: { readonly x: number; readonly y: number };
    readonly preferIds?: ReadonlySet<string>;
    readonly usable?: (view: RuntimeEventView) => boolean;
  } = {},
): NearbyActionTarget | undefined {
  let best: { target: NearbyActionTarget; rank: number } | undefined;
  for (const view of views) {
    if (view.trigger.kind !== "action") continue;
    const kind = view.page?.interaction?.kind;
    if (kind === "pushable" || kind === "hiding") continue;
    if (options.usable && !options.usable(view)) continue;
    const rect = view.bodyRect;
    // 주인공 칸에서 몸 사각까지의 칸 거리(가로·세로 따로)
    const dx = tileX < rect.left ? rect.left - tileX : tileX > rect.right ? rect.right - tileX : 0;
    const dy = tileY < rect.top ? rect.top - tileY : tileY > rect.bottom ? rect.bottom - tileY : 0;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 1 || ay > 1 || (ax === 0 && ay === 0)) continue;
    const diagonal = ax === 1 && ay === 1;
    if (!diagonal && options.front && options.front.x === tileX + dx && options.front.y === tileY + dy) continue;
    const face: Dir = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
    const order = face === "up" ? 0 : face === "left" ? 1 : face === "right" ? 2 : 3;
    const rank = (options.preferIds?.has(view.event.id) ? 0 : 100) + (diagonal ? 10 : 0) + order;
    if (!best || rank < best.rank) best = { target: { view, face, diagonal }, rank };
  }
  return best?.target;
}
