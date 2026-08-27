// 넉백(밀어내기) 순수 규칙.
// 예전에는 스프라이트를 5px 밀었다가 제자리로 되돌리기만 해서 적의 타일 좌표는 그대로였고,
// knockbackResist 도 장식이었다. 이제 실제로 한 칸 밀어낼 수 있는지 판정한다.
// 지형/점유 질의는 콜백으로 받는다 — collision.ts(inBounds/isPassable)와 씬의 적 목록을 소비처가 넘긴다.

export type KnockbackBlockReason = "" | "resisted" | "out-of-bounds" | "blocked" | "occupied" | "no-direction";

export interface KnockbackTile {
  readonly x: number;
  readonly y: number;
}

export interface KnockbackInput {
  readonly enemyTile: KnockbackTile;
  readonly playerTile: KnockbackTile;
  /** 저항 확률 0..1. 1 이면 항상 버틴다. */
  readonly knockbackResist: number;
  /** 저항 굴림 0..1(세션 RNG). */
  readonly roll: number;
  readonly inBounds: (x: number, y: number) => boolean;
  readonly isPassable: (x: number, y: number) => boolean;
  readonly isOccupied: (x: number, y: number) => boolean;
}

export interface KnockbackOutcome {
  readonly displaced: boolean;
  readonly resisted: boolean;
  /** 결과 타일. 밀리지 않았으면 원래 자리. */
  readonly x: number;
  readonly y: number;
  readonly dirX: -1 | 0 | 1;
  readonly dirY: -1 | 0 | 1;
  readonly reason: KnockbackBlockReason;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function resolveKnockback(input: KnockbackInput): KnockbackOutcome {
  const { x, y } = input.enemyTile;
  const stay = (reason: KnockbackBlockReason, dirX: -1 | 0 | 1, dirY: -1 | 0 | 1, resisted = false): KnockbackOutcome =>
    ({ displaced: false, resisted, x, y, dirX, dirY, reason });

  const resist = clamp01(input.knockbackResist);
  // 저항 1 은 굴림이 무엇이든 버틴다(roll < 1 비교만 쓰면 roll===1 에서 새어 나간다).
  if (resist >= 1 || (resist > 0 && clamp01(input.roll) < resist)) return stay("resisted", 0, 0, true);

  const dx = x - input.playerTile.x;
  const dy = y - input.playerTile.y;
  if (dx === 0 && dy === 0) return stay("no-direction", 0, 0);
  // 항상 한 칸만 움직인다 — 축이 더 큰 쪽(동률이면 가로)으로 민다.
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const dirX: -1 | 0 | 1 = horizontal ? (dx >= 0 ? 1 : -1) : 0;
  const dirY: -1 | 0 | 1 = horizontal ? 0 : dy >= 0 ? 1 : -1;

  const toX = x + dirX;
  const toY = y + dirY;
  if (!input.inBounds(toX, toY)) return stay("out-of-bounds", dirX, dirY);
  if (!input.isPassable(toX, toY)) return stay("blocked", dirX, dirY);
  if (input.isOccupied(toX, toY)) return stay("occupied", dirX, dirY);
  return { displaced: true, resisted: false, x: toX, y: toY, dirX, dirY, reason: "" };
}
