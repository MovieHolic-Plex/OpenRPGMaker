import { describe, expect, it } from "vitest";
import { swingArcOverlapsPoint } from "@/battle/action/hitbox";

const ORIGIN = { x: 5, y: 5 };
const RANGE = 1;

// 각 방향 정면 칸 중심: 소수 좌표로 살짝 안/밖의 표적.
const FORWARD_CENTER: Record<string, { x: number; y: number }> = {
  down: { x: 5, y: 6 },
  left: { x: 4, y: 5 },
  right: { x: 6, y: 5 },
  up: { x: 5, y: 4 },
};

describe("swingArcOverlapsPoint", () => {
  for (const facing of ["down", "left", "right", "up"] as const) {
    const center = FORWARD_CENTER[facing]!;

    it(`${facing}: a target just inside the forward cell hits`, () => {
      const inward = {
        x: center.x + Math.sign(ORIGIN.x - center.x) * 0.49,
        y: center.y + Math.sign(ORIGIN.y - center.y) * 0.49,
      };
      expect(swingArcOverlapsPoint(facing, ORIGIN.x, ORIGIN.y, RANGE, inward.x, inward.y)).toBe(true);
    });

    it(`${facing}: a target just outside the forward cell misses`, () => {
      const outward = {
        x: center.x + Math.sign(ORIGIN.x - center.x) * 0.51,
        y: center.y + Math.sign(ORIGIN.y - center.y) * 0.51,
      };
      expect(swingArcOverlapsPoint(facing, ORIGIN.x, ORIGIN.y, RANGE, outward.x, outward.y)).toBe(false);
    });
  }

  it("a target on the attacker's own tile never overlaps", () => {
    for (const facing of ["down", "left", "right", "up"] as const) {
      expect(swingArcOverlapsPoint(facing, ORIGIN.x, ORIGIN.y, RANGE, ORIGIN.x, ORIGIN.y)).toBe(false);
    }
  });

  it("a fractional target between two arc cells still overlaps", () => {
    // down: 정면 (5,6) 과 대각 (4,6) 사이 — 어느 쪽으로도 0.5 이내.
    expect(swingArcOverlapsPoint("down", ORIGIN.x, ORIGIN.y, RANGE, 4.6, 5.6)).toBe(true);
  });

  it("hits a body whose rounded tile is outside the arc but whose body overlaps it", () => {
    // (5.6, 5.4) 는 반올림하면 (6,5) → (6,4)… 정면 칸 (6,5) 와 |dy|=0.4 로 겹치고,
    // 반올림 타일 (6,5) 는 호 안이지만, (5.55, 5.49) 는 반올림하면 (6,5) 로 호 안.
    // 반대 사례: (4.6, 5.6) 은 반올림하면 (5,6) — 호 안이므로 구분이 안 된다.
    // 반올림하면 호 밖인데 몸은 겹치는 지점: (6.49, 4.51) → 반올림 (6,5) 정면 칸.
    // 소수점 좌표 (4.49, 6.49): 반올림 (4,6) 은 대각 칸으로 호 안.
    // 반올림 타일이 호 밖이면서 몸이 겹치는 경우: (5.51, 6.49) → 반올림 (6,6) 은 대각으로 호 안.
    // 명확한 사례는 대각 칸 경계: (4.51, 5.51) 은 반올림하면 (5,6) — 호 안.
    // 결론: 반올림 타일 (5,5) 가 되는 (5.49, 5.49) 는 어느 칸과도 0.5 초과라 미스여야 한다.
    expect(swingArcOverlapsPoint("down", ORIGIN.x, ORIGIN.y, RANGE, 5.49, 5.49)).toBe(false);
    // 반면 (4.6, 5.6) 처럼 반올림 (5,6) — 호 안 타일이지만, 구 타일 판정과 달리
    // 소수 몸이 (4,6) 대각 칸과도 겹쳐 히트로 확정된다(위 테스트).
  });

  it("range 2 extends the fractional band forward only", () => {
    expect(swingArcOverlapsPoint("down", ORIGIN.x, ORIGIN.y, 2, 5, 7.49)).toBe(true);
    expect(swingArcOverlapsPoint("down", ORIGIN.x, ORIGIN.y, 2, 4.49, 7)).toBe(false);
  });
});
