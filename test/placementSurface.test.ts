import { describe, expect, it } from "vitest";

import {
  asPlacementFacing,
  asPlacementZone,
  checkPlacementSurface,
  describePlacementSurface,
  evaluatePlacementConditions,
  surfaceRuleFromClusterRule,
  tileSetSurfaceProbe,
  type SurfaceProbe,
} from "@/project/placementSurface";
import type { PlacementSurfaceCondition } from "@/project/types";

/**
 * 테스트용 방. `#` = 벽, `.` = 바닥.
 * 좌표는 문자열 인덱스 그대로 — (x, y) = (열, 행).
 */
function probeFromArt(rows: readonly string[]): SurfaceProbe {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  return tileSetSurfaceProbe({
    height,
    tileAt: (x, y) => (rows[y]?.[x] === "#" ? 1 : 0),
    width,
    wallTiles: new Set([1]),
  });
}

/** 5×5 방: 테두리가 벽, 안이 바닥. */
const ROOM = [
  "#####",
  "#...#",
  "#...#",
  "#...#",
  "#####",
];

describe("placementSurface — 배치 면 판정", () => {
  it("벽에 붙은 바닥: 북쪽은 위 칸이 벽일 때만 통과한다", () => {
    const probe = probeFromArt(ROOM);
    const north = { facing: "north", zone: "againstWall" } as const;

    // (2,1): 위가 테두리 벽 → 통과
    expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: north }).ok).toBe(true);
    // (2,2): 위가 바닥 → 실패
    const middle = checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: north });
    expect(middle.ok).toBe(false);
    expect(middle.reason).toContain("북쪽");
  });

  it("방향을 명시하면 다른 쪽이 벽이어도 통과하지 않는다 — 실패 이유가 붙어 있는 쪽을 알려준다", () => {
    const probe = probeFromArt(ROOM);
    // (1,2): 서쪽이 벽, 북쪽은 바닥
    const check = checkPlacementSurface({
      probe,
      rect: { x: 1, y: 2, w: 1, h: 1 },
      rule: { facing: "north", zone: "againstWall" },
    });
    expect(check.ok).toBe(false);
    expect(check.satisfiedFacings).toEqual(["west"]);
    expect(check.reason).toContain("서쪽");
  });

  it("방향을 any 로 두면 네 방향 중 하나만 벽이어도 통과한다", () => {
    const probe = probeFromArt(ROOM);
    expect(
      checkPlacementSurface({ probe, rect: { x: 1, y: 2, w: 1, h: 1 }, rule: { zone: "againstWall" } }).ok,
    ).toBe(true);
    expect(
      checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "againstWall" } }).ok,
    ).toBe(false);
  });

  it("화덕처럼 키 큰 물건은 **발밑 줄**로 판정한다 — 윗칸이 벽에 겹쳐도 통과", () => {
    const probe = probeFromArt(ROOM);
    // 1×2 세로쌍의 좌상단을 벽 행(y=0)에 두고 발밑을 y=1 에 둔다.
    // 사각 전체를 봤다면 y=0 이 벽이라 어떤 바닥 zone 도 만족할 수 없다.
    const stove = checkPlacementSurface({
      probe,
      rect: { x: 2, y: 0, w: 1, h: 2 },
      rule: { facing: "north", zone: "againstWall" },
    });
    expect(stove.ok).toBe(true);
    expect(stove.reason).toContain("북쪽");
  });

  it("빈 땅(clearArea)은 사각 전체를 본다 — 발밑만 보는 anyFloor 와 갈린다", () => {
    const probe = probeFromArt(ROOM);
    const rect = { x: 2, y: 0, w: 1, h: 2 };
    expect(checkPlacementSurface({ probe, rect, rule: { zone: "anyFloor" } }).ok).toBe(true);
    expect(checkPlacementSurface({ probe, rect, rule: { zone: "clearArea" } }).ok).toBe(false);
  });

  it("구석은 세로 한 쪽 + 가로 한 쪽이 모두 벽이어야 한다", () => {
    const probe = probeFromArt(ROOM);
    expect(checkPlacementSurface({ probe, rect: { x: 1, y: 1, w: 1, h: 1 }, rule: { zone: "corner" } }).ok).toBe(true);
    // (2,1): 북쪽만 벽 — 가로가 비어 구석이 아니다
    expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: { zone: "corner" } }).ok).toBe(false);
  });

  it("벽에서 떨어진 바닥(openFloor)은 네 방향 모두 트여 있어야 한다", () => {
    const probe = probeFromArt(ROOM);
    expect(checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "openFloor" } }).ok).toBe(true);
    expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: { zone: "openFloor" } }).ok).toBe(false);
  });

  it("벽면(wallFace)은 발밑 자체가 벽이어야 한다 — 창문·아궁이", () => {
    const probe = probeFromArt(ROOM);
    expect(checkPlacementSurface({ probe, rect: { x: 2, y: 0, w: 1, h: 1 }, rule: { zone: "wallFace" } }).ok).toBe(true);
    expect(checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "wallFace" } }).ok).toBe(false);
  });

  it("맵 밖은 벽으로 센다 — 경계에 등을 대는 것도 «벽에 붙은» 것이다", () => {
    // 테두리 없는 3×3 바닥. (1,0) 의 북쪽은 맵 밖.
    const probe = probeFromArt(["...", "...", "..."]);
    expect(
      checkPlacementSurface({ probe, rect: { x: 1, y: 0, w: 1, h: 1 }, rule: { facing: "north", zone: "againstWall" } }).ok,
    ).toBe(true);
  });

  it("가로로 넓은 물건은 발밑 줄 **전부**가 그 방향으로 벽이어야 한다", () => {
    // 위쪽 벽이 왼쪽 2칸만 있는 방
    const probe = probeFromArt([
      "##..",
      "....",
      "....",
    ]);
    const rule = { facing: "north", zone: "againstWall" } as const;
    expect(checkPlacementSurface({ probe, rect: { x: 0, y: 1, w: 2, h: 1 }, rule }).ok).toBe(true);
    // 3칸이면 (2,0) 이 바닥이라 실패
    expect(checkPlacementSurface({ probe, rect: { x: 0, y: 1, w: 3, h: 1 }, rule }).ok).toBe(false);
  });
});

describe("placementSurface — 조건 목록 판정", () => {
  const north: PlacementSurfaceCondition = {
    id: "pc_north",
    strength: "hard",
    zone: "againstWall",
    facing: "north",
  };
  const openSoft: PlacementSurfaceCondition = { id: "pc_open", strength: "soft", zone: "openFloor" };

  it("hard 는 blocked, soft 는 warnings 로 갈린다", () => {
    const probe = probeFromArt(ROOM);
    // (2,2): 북쪽이 바닥(hard 위반) + 네 방향 트임(soft 통과)
    const middle = evaluatePlacementConditions({
      conditions: [north, openSoft],
      probe,
      rect: { x: 2, y: 2, w: 1, h: 1 },
    });
    expect(middle.blocked).toHaveLength(1);
    expect(middle.warnings).toHaveLength(0);

    // (2,1): 북쪽이 벽(hard 통과) + 북쪽이 벽이라 openFloor 위반(soft)
    const top = evaluatePlacementConditions({
      conditions: [north, openSoft],
      probe,
      rect: { x: 2, y: 1, w: 1, h: 1 },
    });
    expect(top.blocked).toHaveLength(0);
    expect(top.warnings).toHaveLength(1);
  });

  it("조건이 없거나 undefined 면 아무것도 막지 않는다 — 기존 킷 하위 호환", () => {
    const probe = probeFromArt(ROOM);
    const rect = { x: 2, y: 2, w: 1, h: 1 };
    expect(evaluatePlacementConditions({ conditions: undefined, probe, rect }).blocked).toHaveLength(0);
    expect(evaluatePlacementConditions({ conditions: [], probe, rect }).blocked).toHaveLength(0);
  });

  it("사람이 쓴 message 가 있으면 그것을 앞세우고 판정 이유를 괄호로 붙인다", () => {
    const probe = probeFromArt(ROOM);
    const verdict = evaluatePlacementConditions({
      conditions: [{ ...north, message: "화덕은 북벽에 붙습니다" }],
      probe,
      rect: { x: 2, y: 2, w: 1, h: 1 },
    });
    expect(verdict.blocked[0]?.text).toContain("화덕은 북벽에 붙습니다");
    expect(verdict.blocked[0]?.text).toContain("북쪽");
  });
});

describe("placementSurface — 라벨과 파싱", () => {
  it("사람 말 설명은 방향까지 담는다", () => {
    expect(describePlacementSurface({ facing: "north", zone: "againstWall" })).toBe("북쪽(위) 벽에 붙은 바닥");
    expect(describePlacementSurface({ zone: "againstWall" })).toBe("벽에 붙은 바닥");
    // 방향은 againstWall 에서만 뜻이 있다 — 다른 면에서는 무시한다
    expect(describePlacementSurface({ facing: "north", zone: "openFloor" })).toBe("벽에서 떨어진 바닥");
  });

  it("모르는 값은 undefined 로 떨어진다 — 억지 매핑 금지", () => {
    expect(asPlacementZone("againstWall")).toBe("againstWall");
    expect(asPlacementZone("againstWallFloor")).toBeUndefined();
    expect(asPlacementFacing("north")).toBe("north");
    expect(asPlacementFacing("up")).toBeUndefined();
  });

  it("surface 클러스터 규칙 params → 규칙. 다른 kind 나 잘못된 zone 은 undefined", () => {
    expect(
      surfaceRuleFromClusterRule({
        id: "r",
        kind: "surface",
        params: { facing: "north", zone: "againstWall" },
        strength: "hard",
      }),
    ).toEqual({ facing: "north", zone: "againstWall" });
    expect(
      surfaceRuleFromClusterRule({ id: "r", kind: "surface", params: { zone: "뭐지" }, strength: "hard" }),
    ).toBeUndefined();
    expect(
      surfaceRuleFromClusterRule({ id: "r", kind: "spacing", params: { minGap: 2 }, strength: "soft" }),
    ).toBeUndefined();
  });
});
