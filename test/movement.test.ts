import { describe, expect, it } from "vitest";
import {
  facingForStep,
  resolveDiagonalStep,
  resolveMovementIntent,
  type Dir,
} from "@/player/input";

describe("resolveMovementIntent (8방향 입력 해석)", () => {
  it("입력이 없으면 방향/성분 모두 비어있다", () => {
    expect(resolveMovementIntent([])).toEqual({ dir: null, x: 0, y: 0 });
  });

  it("단일 직교 입력을 성분과 facing 으로 변환한다", () => {
    expect(resolveMovementIntent(["right"])).toEqual({ dir: "right", x: 1, y: 0 });
    expect(resolveMovementIntent(["left"])).toEqual({ dir: "left", x: -1, y: 0 });
    expect(resolveMovementIntent(["up"])).toEqual({ dir: "up", x: 0, y: -1 });
    expect(resolveMovementIntent(["down"])).toEqual({ dir: "down", x: 0, y: 1 });
  });

  it("대각선 입력 시 두 축 성분을 만들고 facing 은 수평 우선이다", () => {
    expect(resolveMovementIntent(["right", "up"])).toEqual({ dir: "right", x: 1, y: -1 });
    // 눌린 순서와 무관하게 수평을 바라본다.
    expect(resolveMovementIntent(["up", "right"])).toEqual({ dir: "right", x: 1, y: -1 });
    expect(resolveMovementIntent(["down", "left"])).toEqual({ dir: "left", x: -1, y: 1 });
  });

  it("같은 축의 반대 키가 나중에 눌리면 최신 키를 따른다", () => {
    expect(resolveMovementIntent(["left", "right"])).toEqual({ dir: "right", x: 1, y: 0 });
    expect(resolveMovementIntent(["up", "down"])).toEqual({ dir: "down", x: 0, y: 1 });
  });

  it("세 방향 조합에서 각 축의 최신 입력을 성분으로 채택한다", () => {
    // 수평 최신 = left, 수직 최신 = up → 대각선(왼쪽 위), facing 은 수평(left).
    expect(resolveMovementIntent(["left", "down", "up"])).toEqual({ dir: "left", x: -1, y: -1 });
  });
});

describe("resolveDiagonalStep (대각선 통행/미끄러짐 판정)", () => {
  // blocked: 통행 불가한 (dx,dy) 목록
  const stepper = (blocked: ReadonlyArray<[number, number]>) => (dx: number, dy: number): boolean =>
    !blocked.some(([bx, by]) => bx === dx && by === dy);

  it("입력이 없으면 이동 없음", () => {
    expect(resolveDiagonalStep(0, 0, () => true)).toBeNull();
  });

  it("직교 입력은 해당 칸 통행 여부로 결정된다", () => {
    expect(resolveDiagonalStep(1, 0, stepper([]))).toEqual({ dx: 1, dy: 0 });
    expect(resolveDiagonalStep(1, 0, stepper([[1, 0]]))).toBeNull();
  });

  it("대각선은 양쪽 직교 칸이 모두 열려야 대각선으로 이동한다", () => {
    expect(resolveDiagonalStep(1, -1, stepper([]))).toEqual({ dx: 1, dy: -1 });
  });

  it("수직 직교가 막히면 가로로 미끄러진다(모서리 끼임 방지)", () => {
    // (0,-1) 막힘 → 세로 불가 → 가로 슬라이드
    expect(resolveDiagonalStep(1, -1, stepper([[0, -1]]))).toEqual({ dx: 1, dy: 0 });
  });

  it("수평 직교가 막히면 세로로 미끄러진다", () => {
    // (1,0) 막힘 → 가로 불가 → 세로 슬라이드
    expect(resolveDiagonalStep(1, -1, stepper([[1, 0]]))).toEqual({ dx: 0, dy: -1 });
  });

  it("양쪽 직교가 모두 막히면 이동하지 않는다", () => {
    expect(resolveDiagonalStep(1, -1, stepper([[1, 0], [0, -1]]))).toBeNull();
  });
});

describe("facingForStep (이동 성분 → 4방향 facing)", () => {
  it("직교 이동은 그대로 매핑된다", () => {
    const cases: Array<[number, number, Dir]> = [
      [1, 0, "right"],
      [-1, 0, "left"],
      [0, 1, "down"],
      [0, -1, "up"],
    ];
    for (const [dx, dy, expected] of cases) {
      expect(facingForStep(dx, dy)).toBe(expected);
    }
  });

  it("대각선 이동은 수평 우선으로 facing 을 정한다", () => {
    expect(facingForStep(1, -1)).toBe("right");
    expect(facingForStep(-1, 1)).toBe("left");
  });
});
