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
 * 장소를 옮기는 조사 이벤트(문·계단·사다리·승강 발판 — 페이지에 transfer 가 있고 말하는 사람이 아닌 것)도 고르지 않는다.
 * 왜(2026-11-10 폴른 스타 우물 VQA D1·fs-defect-sweep C1): 도착 칸에서 대사를 넘기려고 누른 Enter 를 이 보조가 등 뒤·대각의
 * 사다리로 잡아 방금 떠난 맵으로 되돌려 보냈다. 이동은 정면으로 보고 눌렀을 때만 일어난다(RM 관례).
 *
 * 닿으면 싸우는 적(`fieldFoe` 가 참인 접촉 이벤트)도 고른다 — 정면 조사 단추로 열리는 것(findFieldFoeFacing)과 같은 대상이다.
 * 왜(2026-10-31 jb3c terra jrpg): 3×2 몸 보스는 그림이 몸보다 크게 그려져, 판정자가 몸 바로 위 칸에 서서 위를 보고 눌렀을 때
 * 아무 일이 없었다(「정확히 아래 칸에서 위를 봐야 전투가 열린다」). 여러 칸 몸이면 몸에 닿은 어느 칸에서든 열린다.
 */
/** 조사 손이 닿는 칸 거리 — 기물 몸의 어느 칸이든 주인공 칸에서 상하좌우·대각 한 칸까지. */
export const ACTION_REACH_CELLS = 1;

export function withinActionReach(tileX: number, tileY: number, x: number, y: number): boolean {
  const dx = Math.abs(x - tileX), dy = Math.abs(y - tileY);
  return dx <= ACTION_REACH_CELLS && dy <= ACTION_REACH_CELLS && (dx > 0 || dy > 0);
}

/** 기물 몸(클러스터)의 한 칸이라도 주인공 손 닿는 링에 걸리는가. */
export function clusterWithinActionReach(cells: readonly number[], mapWidth: number, tileX: number, tileY: number): boolean {
  return cells.some((cell) => {
    const x = cell % mapWidth;
    return Math.abs(x - tileX) <= ACTION_REACH_CELLS && Math.abs((cell - x) / mapWidth - tileY) <= ACTION_REACH_CELLS;
  });
}

/** 이벤트 칸이 몸 안쪽(사방이 몸)인가 — 3×3 책장 가운데처럼 몸 밖에서만 닿는 칸. */
function isInteriorCell(cells: readonly number[], mapWidth: number, x: number, y: number): boolean {
  const has = new Set(cells);
  const i = y * mapWidth + x;
  return has.has(i - 1) && has.has(i + 1) && has.has(i - mapWidth) && has.has(i + mapWidth);
}

/**
 * 기물 조사가 지금 칸에서 열려도 되는가.
 * 이벤트 칸이 손 닿는 링에 있으면 열린다. 몸 안쪽에 묻힌 이벤트는 몸이 손 닿는 링에 걸릴 때만 열린다 —
 * 3×3 책장 가운데 이벤트를 몸 밖에서 조사하는 길을 남기면서, 1×1 기물을 두 칸 건너에서 여는 길은 막는다.
 */
export function canExamineFrom(
  cells: readonly number[],
  mapWidth: number,
  tileX: number,
  tileY: number,
  eventX: number,
  eventY: number,
): boolean {
  if (withinActionReach(tileX, tileY, eventX, eventY)) return true;
  return clusterWithinActionReach(cells, mapWidth, tileX, tileY) && isInteriorCell(cells, mapWidth, eventX, eventY);
}

export type NearbyActionTarget = {
  readonly view: RuntimeEventView;
  /** 주인공이 돌아설 방향. 대각이면 가로 방향. */
  readonly face: Dir;
  readonly diagonal: boolean;
};

/** 장소를 옮기는 페이지인가 — transfer 가 있고, 이름 붙은 대사를 하는 보이는 사람(대화 끝에 장면을 넘기는 인물)이 아니다. */
function isTravelPage(page: RuntimeEventView["page"]): boolean {
  const commands = page?.commands ?? [];
  if (!commands.some((command) => command.kind === "transfer")) return false;
  const visible = page?.graphic && !page.graphic.transparent && page.graphic.sprite;
  const speaks = commands.some((command) => command.kind === "text" && typeof command.speaker === "string" && command.speaker.trim() !== "");
  return !(visible && speaks);
}

export function pickNearbyActionTarget(
  views: readonly RuntimeEventView[],
  tileX: number,
  tileY: number,
  options: {
    readonly front?: { readonly x: number; readonly y: number };
    readonly preferIds?: ReadonlySet<string>;
    readonly usable?: (view: RuntimeEventView) => boolean;
    /** 닿으면 싸우는 접촉 이벤트(보이는 적·보스)인가 — 참이면 action 이 아니어도 고른다. */
    readonly fieldFoe?: (view: RuntimeEventView) => boolean;
  } = {},
): NearbyActionTarget | undefined {
  let best: { target: NearbyActionTarget; rank: number } | undefined;
  for (const view of views) {
    const foe = view.trigger.kind !== "action" && options.fieldFoe?.(view) === true;
    if (view.trigger.kind !== "action" && !foe) continue;
    const kind = view.page?.interaction?.kind;
    if (kind === "pushable" || kind === "hiding") continue;
    if (!foe && isTravelPage(view.page)) continue;
    if (!foe && options.usable && !options.usable(view)) continue;
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
