import { describe, expect, it } from "vitest";
import { resolveKnockback, type KnockbackInput } from "@/battle/action/knockback";

const OPEN: Pick<KnockbackInput, "inBounds" | "isPassable" | "isOccupied"> = {
  inBounds: () => true,
  isPassable: () => true,
  isOccupied: () => false,
};

function base(overrides: Partial<KnockbackInput> = {}): KnockbackInput {
  return {
    enemyTile: { x: 6, y: 4 },
    playerTile: { x: 5, y: 4 },
    knockbackResist: 0,
    roll: 0.5,
    ...OPEN,
    ...overrides,
  };
}

describe("resolveKnockback", () => {
  it("플레이어 반대편 한 칸으로 실제로 밀어낸다", () => {
    const out = resolveKnockback(base());
    expect(out.displaced).toBe(true);
    expect(out.resisted).toBe(false);
    expect(out.x).toBe(7);
    expect(out.y).toBe(4);
    expect(out.dirX).toBe(1);
    expect(out.dirY).toBe(0);
  });

  it("세로로 붙어 있으면 세로로 밀린다", () => {
    const out = resolveKnockback(base({ enemyTile: { x: 5, y: 3 }, playerTile: { x: 5, y: 6 } }));
    expect(out.displaced).toBe(true);
    expect(out.x).toBe(5);
    expect(out.y).toBe(2);
  });

  it("맵 밖으로는 밀리지 않는다", () => {
    const out = resolveKnockback(base({ inBounds: (x) => x < 7 }));
    expect(out.displaced).toBe(false);
    expect(out.reason).toBe("out-of-bounds");
    expect(out.x).toBe(6);
    expect(out.y).toBe(4);
  });

  it("벽으로는 밀리지 않는다", () => {
    const out = resolveKnockback(base({ isPassable: (x, y) => !(x === 7 && y === 4) }));
    expect(out.displaced).toBe(false);
    expect(out.reason).toBe("blocked");
    expect(out.x).toBe(6);
    expect(out.y).toBe(4);
  });

  it("다른 적이 서 있는 칸으로는 밀리지 않는다", () => {
    const out = resolveKnockback(base({ isOccupied: (x, y) => x === 7 && y === 4 }));
    expect(out.displaced).toBe(false);
    expect(out.reason).toBe("occupied");
  });

  it("knockbackResist 1 은 항상 저항한다", () => {
    for (const roll of [0, 0.25, 0.5, 0.999999, 1]) {
      const out = resolveKnockback(base({ knockbackResist: 1, roll }));
      expect(out.displaced).toBe(false);
      expect(out.resisted).toBe(true);
      expect(out.reason).toBe("resisted");
      expect(out.x).toBe(6);
      expect(out.y).toBe(4);
    }
  });

  it("knockbackResist 는 확률이다 — 굴림이 저항값보다 낮으면 버틴다", () => {
    expect(resolveKnockback(base({ knockbackResist: 0.5, roll: 0.49 })).displaced).toBe(false);
    expect(resolveKnockback(base({ knockbackResist: 0.5, roll: 0.51 })).displaced).toBe(true);
  });

  it("knockbackResist 0 은 굴림과 무관하게 밀린다", () => {
    for (const roll of [0, 0.001, 0.9]) {
      expect(resolveKnockback(base({ knockbackResist: 0, roll })).displaced).toBe(true);
    }
  });

  it("같은 칸이면 방향이 없어 밀지 않는다", () => {
    const out = resolveKnockback(base({ enemyTile: { x: 5, y: 5 }, playerTile: { x: 5, y: 5 } }));
    expect(out.displaced).toBe(false);
    expect(out.reason).toBe("no-direction");
  });

  it("대각 상황은 축이 더 큰 쪽으로만 밀어낸다(한 칸 이동 유지)", () => {
    const out = resolveKnockback(base({ enemyTile: { x: 8, y: 5 }, playerTile: { x: 5, y: 4 } }));
    expect(out.x).toBe(9);
    expect(out.y).toBe(5);
    const vertical = resolveKnockback(base({ enemyTile: { x: 6, y: 9 }, playerTile: { x: 5, y: 4 } }));
    expect(vertical.x).toBe(6);
    expect(vertical.y).toBe(10);
  });
});
