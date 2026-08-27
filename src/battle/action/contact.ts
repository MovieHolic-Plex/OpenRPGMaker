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
}

export function enemyIsClosing(input: ContactClosingInput): boolean {
  if (input.mode === "windup" || input.mode === "recover") return false;
  return input.mode === "dash" || input.moving;
}

/** RM eventTouch 의미론: 같은 칸이 아니라 인접(8방) 접촉. */
export function contactTouches(enemyTile: ContactTile, playerTiles: readonly ContactTile[]): boolean {
  return playerTiles.some((tile) => Math.max(Math.abs(enemyTile.x - tile.x), Math.abs(enemyTile.y - tile.y)) <= 1);
}

export function shouldApplyContactDamage(input: ContactDamageInput): boolean {
  if (!enemyIsClosing(input)) return false;
  return contactTouches(input.enemyTile, input.playerTiles);
}
