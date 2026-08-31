import { describe, expect, it } from "vitest";
import { moveWing, resizeWing } from "@/editor/panels/databaseVillageModel";
import { VILLAGE_RANGE, templateFromRecord } from "@/editor/tools/village/authoringData";
import type { VillageHouseTemplateRecord } from "@/project/types/village";

// 격자 드래그의 순수 층. 클램프를 **여기서** 끝내는 것이 계약이다 — 규약을 어기는 값이
// 레코드에 들어가는 순간 시공이 그 집을 조용히 건너뛰므로, 드래그로는 애초에 어길 수 없어야
// 한다. 뷰는 픽셀→칸 변환만 하고 이 함수를 부른다.

function record(overrides: Partial<VillageHouseTemplateRecord> = {}): VillageHouseTemplateRecord {
  return {
    id: "my-house",
    name: "내 집",
    w: 8,
    h: 9,
    stories: 1,
    wings: [{ x: 0, y: 0, w: 8, h: 5 }, { x: 0, y: 5, w: 4, h: 4 }],
    ...overrides,
  };
}

describe("날개 이동 — moveWing", () => {
  it("칸 단위로 옮긴다", () => {
    const wings = moveWing(record(), 1, 2, 0);
    expect(wings[1]).toEqual({ x: 2, y: 5, w: 4, h: 4 });
    // 건드리지 않은 날개는 그대로다.
    expect(wings[0]).toEqual({ x: 0, y: 0, w: 8, h: 5 });
  });

  it("바운딩 박스 밖으로 나가지 않는다", () => {
    const wings = moveWing(record(), 1, 99, 99);
    expect(wings[1]).toEqual({ x: 4, y: 5, w: 4, h: 4 });
  });

  it("음수로도 새지 않는다", () => {
    const wings = moveWing(record({ wings: [{ x: 3, y: 3, w: 4, h: 5 }] }), 0, -99, -99);
    expect(wings[0]).toEqual({ x: 0, y: 0, w: 4, h: 5 });
  });

  it("사용자가 폭을 줄인 직후에도 상한을 넘기지 않는다", () => {
    // 박스는 5 인데 날개가 8 — 오른쪽 여유가 음수다. 클램프가 0 으로 접혀야 한다.
    const wings = moveWing(record({ w: 5, wings: [{ x: 0, y: 0, w: 8, h: 5 }] }), 0, 3, 0);
    expect(wings[0]?.x).toBe(0);
  });

  it("없는 인덱스는 아무 것도 바꾸지 않는다", () => {
    const source = record();
    expect(moveWing(source, 7, 1, 1)).toEqual(source.wings);
  });

  it("반환값은 원본 배열을 건드리지 않는다", () => {
    const source = record();
    const wings = moveWing(source, 1, 1, 1);
    expect(source.wings?.[1]).toEqual({ x: 0, y: 5, w: 4, h: 4 });
    expect(wings[1]).toEqual({ x: 1, y: 5, w: 4, h: 4 });
  });
});

describe("날개 크기 — resizeWing", () => {
  it("e·s 변은 반대편을 그대로 두고 크기만 바꾼다", () => {
    expect(resizeWing(record(), 1, "e", 2)[1]).toEqual({ x: 0, y: 5, w: 6, h: 4 });
    expect(resizeWing(record({ h: 12 }), 1, "s", 2)[1]).toEqual({ x: 0, y: 5, w: 4, h: 6 });
  });

  it("w·n 변은 반대편 변을 붙잡아 둔다", () => {
    const source = record({ wings: [{ x: 2, y: 2, w: 5, h: 5 }] });
    const west = resizeWing(source, 0, "w", 1)[0]!;
    // 오른쪽 변(x+w=7)이 그대로다 — 왼쪽을 끌면 폭만 준다.
    expect(west.x + west.w).toBe(7);
    expect(west).toEqual({ x: 3, y: 2, w: 4, h: 5 });

    const north = resizeWing(source, 0, "n", 1)[0]!;
    expect(north.y + north.h).toBe(7);
    expect(north).toEqual({ x: 2, y: 3, w: 5, h: 4 });
  });

  it("규약 하한 아래로 줄지 않는다", () => {
    const { wingW, wingH } = VILLAGE_RANGE;
    expect(resizeWing(record(), 1, "e", -99)[1]?.w).toBe(wingW.min);
    expect(resizeWing(record(), 1, "s", -99)[1]?.h).toBe(wingH.min);
    expect(resizeWing(record(), 1, "w", 99)[1]?.w).toBe(wingW.min);
    expect(resizeWing(record(), 1, "n", 99)[1]?.h).toBe(wingH.min);
  });

  it("바운딩 박스와 규약 상한 중 작은 쪽에서 멈춘다", () => {
    // 박스 폭 8, 날개 x=4 → 오른쪽으로 4칸까지.
    const wings = resizeWing(record({ wings: [{ x: 4, y: 0, w: 3, h: 5 }] }), 0, "e", 99);
    expect(wings[0]).toEqual({ x: 4, y: 0, w: 4, h: 5 });
    // w 변을 왼쪽으로 끌어도 규약 상한(8)을 넘지 않는다.
    const wide = resizeWing(record({ w: 8, h: 24, wings: [{ x: 8, y: 0, w: 8, h: 5 }] }), 0, "w", -99);
    expect(wide[0]?.w).toBe(VILLAGE_RANGE.wingW.max);
  });

  it("높이 상한도 규약을 따른다", () => {
    const wings = resizeWing(record({ h: 99, wings: [{ x: 0, y: 0, w: 6, h: 6 }] }), 0, "s", 99);
    expect(wings[0]?.h).toBe(VILLAGE_RANGE.wingH.max);
  });
});

describe("드래그로 만들 수 있는 값은 규약을 통과한다", () => {
  // 격자 드래그가 규약 위반을 만들 수 있으면 사용자는 「손을 놓자마자 위반」을 본다.
  // 여기서 보는 것은 **날개 하나의 기하**다 — 열 구간 판정(minWingRun)은 조합의 문제라
  // 이동/크기 조작만으로는 보장할 수 없고, 뷰가 실시간 판정 문구로 알려준다.
  it("이동·크기 조작을 여러 번 겹쳐도 날개가 박스 안에 남는다", () => {
    let current = record({ w: 8, h: 9, wings: [{ x: 0, y: 0, w: 8, h: 9 }] });
    const moves: readonly [number, number][] = [[3, 3], [-9, 2], [9, -9], [1, 1]];
    for (const [dx, dy] of moves) {
      current = { ...current, wings: moveWing(current, 0, dx, dy) };
      for (const edge of ["e", "s", "w", "n"] as const) {
        current = { ...current, wings: resizeWing(current, 0, edge, edge === "e" || edge === "s" ? 5 : -5) };
      }
      const wing = current.wings![0]!;
      expect(wing.x, JSON.stringify(wing)).toBeGreaterThanOrEqual(0);
      expect(wing.y, JSON.stringify(wing)).toBeGreaterThanOrEqual(0);
      expect(wing.x + wing.w, JSON.stringify(wing)).toBeLessThanOrEqual(current.w);
      expect(wing.y + wing.h, JSON.stringify(wing)).toBeLessThanOrEqual(current.h);
      expect(wing.w).toBeGreaterThanOrEqual(VILLAGE_RANGE.wingW.min);
      expect(wing.h).toBeGreaterThanOrEqual(VILLAGE_RANGE.wingH.min);
    }
  });

  it("날개 하나짜리 형태는 조작 뒤에도 시공 가능하다", () => {
    const moved = { ...record({ wings: [{ x: 0, y: 0, w: 8, h: 9 }] }), wings: moveWing(record({ wings: [{ x: 0, y: 0, w: 8, h: 9 }] }), 0, 2, 2) };
    const resolved = templateFromRecord(moved);
    expect("template" in resolved, "reason" in resolved ? resolved.reason : "").toBe(true);
  });
});
