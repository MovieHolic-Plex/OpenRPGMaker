// 구조물의 증분 축·홈 레이어 판정 — 순수 모델 계층.
//
// 왜 별 파일인가: 이 두 함수가 세 소비자(편집기 배지 · contextBuilder 프롬프트 ·
// stamp_structure_kit 반복 횟수)의 공통 근거다. 판정이 흔들리면 "화면에는 세로 증분이라
// 적혀 있는데 시공은 1회" 같은 어긋남이 생기고, 그건 어느 소비자의 테스트로도 안 잡힌다.

import { describe, expect, it } from "vitest";
import {
  structureKitGrowthAxes,
  structureKitLayerHome,
  structureKitRepeatable,
} from "@/editor/harnessSuggestion/structureKitModel";
import { BUILTIN_HOUSE_STRUCTURE_KITS } from "@/editor/harnessSuggestion/builtinHouseStructureKits";
import { TILE } from "@/project/defaults/constants";
import type { SectionStructureKitDef, StructureKitAiMeta } from "@/project/types";

function wall(ai?: StructureKitAiMeta): SectionStructureKitDef {
  return {
    id: "kit_growth_wall",
    kind: "section",
    name: "성벽 단면",
    width: 1,
    height: 3,
    rows: [{ tiles: [19] }, { tiles: [49] }, { tiles: [81] }],
    learnedFrom: "db-authored",
    ...(ai ? { ai } : {}),
  };
}

const meta = (patch: Partial<StructureKitAiMeta>): StructureKitAiMeta => ({
  description: "",
  placementRules: "",
  ...patch,
});

describe("structureKitGrowthAxes", () => {
  it("아무 메타도 없는 section 은 예전 동작 그대로 가로만 반복한다", () => {
    expect(structureKitGrowthAxes(wall())).toEqual({ x: true, y: false });
  });

  it("집 킷은 한 채가 완결 단위라 두 축 모두 닫혀 있다", () => {
    expect(structureKitGrowthAxes(BUILTIN_HOUSE_STRUCTURE_KITS[0]!)).toEqual({ x: false, y: false });
  });

  it("growthAxis 가 repeatability 를 이긴다 — 세로 벽은 가로로 늘어나지 않는다", () => {
    // 두 값이 어긋나는 킷을 일부러 만든다: 예전 필드는 "가로 반복", 새 필드는 "세로 전용".
    const kit = wall(meta({ repeatability: "repeat", growthAxis: "vertical" }));
    expect(structureKitGrowthAxes(kit)).toEqual({ x: false, y: true });
    // 가로 하나만 보는 옛 이름도 같은 판정을 써야 한다(팔레트 선반·인스펙터가 이걸 부른다).
    expect(structureKitRepeatable(kit)).toBe(false);
  });

  it("both 은 두 축을 모두 연다", () => {
    expect(structureKitGrowthAxes(wall(meta({ growthAxis: "both" })))).toEqual({ x: true, y: true });
  });

  it("growthAxis 가 없으면 fixed 는 두 축을 닫는다", () => {
    expect(structureKitGrowthAxes(wall(meta({ repeatability: "fixed" })))).toEqual({ x: false, y: false });
  });

  it("세로 증분은 사람이 적어야만 열린다 — repeat 만으로는 절대 세로로 쌓지 않는다", () => {
    expect(structureKitGrowthAxes(wall(meta({ repeatability: "repeat" }))).y).toBe(false);
  });
});

describe("structureKitLayerHome", () => {
  it("바닥 타일만 있으면 lower", () => {
    expect(structureKitLayerHome(wall())).toBe("lower");
  });

  it("덧그림 타일만 있으면 upper", () => {
    const kit: SectionStructureKitDef = {
      ...wall(),
      rows: [
        { tiles: [TILE.EMPTY], upperTiles: [208] },
        { tiles: [TILE.EMPTY], upperTiles: [208] },
        { tiles: [TILE.EMPTY], upperTiles: [208] },
      ],
    };
    expect(structureKitLayerHome(kit)).toBe("upper");
  });

  it("섞여 있으면 perCell", () => {
    const kit: SectionStructureKitDef = {
      ...wall(),
      rows: [{ tiles: [19] }, { tiles: [49], upperTiles: [208] }, { tiles: [81] }],
    };
    expect(structureKitLayerHome(kit)).toBe("perCell");
  });

  it("사람이 선언한 값이 유도값을 이긴다 — 바닥 칸으로 그린 덧그림 구조물이 있다", () => {
    expect(structureKitLayerHome(wall(meta({ layerHome: "upper" })))).toBe("upper");
  });
});
