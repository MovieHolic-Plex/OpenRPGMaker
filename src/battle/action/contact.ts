// 접촉 피해 판정 순수 규칙.
// 예전에는 살아 있는 적이 체비셰프 1칸 안에 있기만 하면 무조건 피해를 줬다(가만히 서 있어도).
// 이제 "거리를 좁히는 적"만 접촉 피해를 준다: 이번 프레임 실제로 이동 중이거나 대시 중.
// windup/recover 중인 적은 접촉 피해가 없다 — 예고된 타격 자체가 피해원이다.
// Phaser·씬 접근 없음.

export type ContactEnemyMode = "combat" | "windup" | "dash" | "recover";

export interface ContactTile {
  readonly x: number;
  readonly y: number;
}

export interface ContactClosingInput {
  readonly mode: ContactEnemyMode;
  /** 이번 프레임 적이 실제로 칸 사이를 이동하고 있는가. */
  readonly moving: boolean;
}

export interface ContactDamageInput extends ContactClosingInput {
  readonly enemyTile: ContactTile;
  /** 플레이어가 점유한 칸들(이동 중이면 목표 칸 포함). */
  readonly playerTiles: readonly ContactTile[];
  /**
   * 적의 **몸 사각**. 주면 앵커 대신 이 사각의 인접으로 판정한다 — 3x3 골렘의 머리 옆에 선
   * 플레이어는 앵커에서 2칸이라 앵커 판정으로는 안 닿았다.
   * 생략하면 앵커 한 칸이므로 기존 동작과 완전히 같다.
   */
  readonly enemyBody?: ContactRect;
}

export interface ContactRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export function enemyIsClosing(input: ContactClosingInput): boolean {
  if (input.mode === "windup" || input.mode === "recover") return false;
  return input.mode === "dash" || input.moving;
}

/** RM eventTouch 의미론: 같은 칸이 아니라 인접(8방) 접촉. */
export function contactTouches(enemyTile: ContactTile, playerTiles: readonly ContactTile[]): boolean {
  return playerTiles.some((tile) => Math.max(Math.abs(enemyTile.x - tile.x), Math.abs(enemyTile.y - tile.y)) <= 1);
}

/**
 * 몸 사각 판. 사각을 사방 한 칸 넓힌 영역에 플레이어 칸이 들어오면 접촉이다.
 * 1x1 사각이면 체비셰프 1 과 같은 집합이라 {@link contactTouches} 와 동일하다.
 */
export function contactRectTouches(body: ContactRect, playerTiles: readonly ContactTile[]): boolean {
  return playerTiles.some(
    (tile) =>
      tile.x >= body.left - 1 && tile.x <= body.right + 1 && tile.y >= body.top - 1 && tile.y <= body.bottom + 1
  );
}

export function shouldApplyContactDamage(input: ContactDamageInput): boolean {
  if (!enemyIsClosing(input)) return false;
  if (input.enemyBody) return contactRectTouches(input.enemyBody, input.playerTiles);
  return contactTouches(input.enemyTile, input.playerTiles);
}
