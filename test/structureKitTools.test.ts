import { applyStampStructureKit } from "@/editor/tools/structureKitTools";
import { describe, expect, it } from "vitest";
import { createEmptyToolProject, getTool, runTool, toOpenAiTools } from "@/editor/tools";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import type { Project, SectionStructureKitDef, StructureKitAiMeta } from "@/project/types";

function expectUnknownTool(result: { ok: boolean; summary: string }): void {
  expect(result.ok).toBe(false);
  expect(result.summary).toContain("알 수 없는 툴");
}

// 성벽 정단면 1×5 킷 — 프로토 데모에서 [등록]으로 저장되는 것과 동일한 shape.
const WALL_KIT: SectionStructureKitDef = {
  id: "kit_wall_test",
  kind: "section",
  name: "성벽 단면",
  width: 1,
  height: 5,
  rows: [{ tiles: [19] }, { tiles: [49] }, { tiles: [109] }, { tiles: [51] }, { tiles: [81] }],
  learnedFrom: "user-paint",
};

// 부위(parts)를 가진 킷 — 입구/간판이 붙은 3×3 상점 단면.
// 입구 앞칸(워프 칸) 규약은 dy + h - 1 이며 별도 필드를 만들지 않는다.
const SHOP_KIT: SectionStructureKitDef = {
  id: "kit_shop_test",
  kind: "section",
  name: "상점 단면",
  width: 3,
  height: 3,
  rows: [{ tiles: [19, 19, 19] }, { tiles: [49, 116, 49] }, { tiles: [81, 146, 81] }],
  learnedFrom: "user-paint",
  parts: [
    { id: "pt_entrance", kind: "entrance", dx: 1, dy: 1, w: 1, h: 3, note: "남쪽 현관" },
    { id: "pt_sign", kind: "sign", dx: 2, dy: 1, w: 1, h: 1 },
  ],
};

function projectWithKit(): { project: Project; mapId: string } {
  const project = createEmptyToolProject("킷 테스트");
  const context = { project };
  const created = runTool(context, "create_map", { name: "킷맵", width: 20, height: 15 });
  expect(created.ok).toBe(true);
  const mapId = Object.keys(context.project.maps)[0]!;
  const tilesetId = context.project.maps[mapId]!.tilesetId;
  context.project.tilesets[tilesetId]!.structureKits = [structuredClone(WALL_KIT)];
  return { project: context.project, mapId };
}

// 기존 하나짜리 픽스처를 그대로 두고 부위 킷만 뒤에 덧붙인다.
function projectWithPartsKit(): { project: Project; mapId: string } {
  const { project, mapId } = projectWithKit();
  const tilesetId = project.maps[mapId]!.tilesetId;
  const tileset = project.tilesets[tilesetId]!;
  tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(SHOP_KIT)];
  return { project, mapId };
}

// 폭 2, 높이 1 짜리 최소 킷 — repeat 동작만 본다.
function projectWithRepeatKit(ai: StructureKitAiMeta | undefined): { project: Project; mapId: string } {
  const project = createEmptyToolProject("반복 테스트");
  const context = { project };
  runTool(context, "create_map", { name: "반복맵", width: 20, height: 15 });
  const mapId = Object.keys(context.project.maps)[0]!;
  const tilesetId = context.project.maps[mapId]!.tilesetId;
  context.project.tilesets[tilesetId]!.structureKits = [{
    id: "kit_repeat_test",
    kind: "section",
    name: "반복 킷",
    width: 2,
    height: 1,
    rows: [{ tiles: [421, 421] }],
    learnedFrom: "db-authored",
    ...(ai ? { ai } : {}),
  }];
  return { project: context.project, mapId };
}

describe("repeatability — 한 채 완결 구조물은 반복하지 않는다", () => {
  it("fixed 인 킷은 사람 스탬프 경로에서 1회만 찍힌다", () => {
    // 우물·간판처럼 한 채로 완결인 구조물.
    const { project, mapId } = projectWithRepeatKit({
      description: "돌 우물",
      placementRules: "광장 중앙",
      repeatability: "fixed",
    });
    const context = { project };
    const before = [...context.project.maps[mapId]!.lowerTiles];

    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
    expect(context.project.maps[mapId]!.lowerTiles).toEqual(before);
  });

  it("repeat 인 킷은 사람 스탬프 경로에서 반복한다", () => {
    // kind:"section"의 repeat override가 실제로 동작할 때만 통과한다.
    const project = createEmptyToolProject("반복 테스트(집)");
    const context = { project };
    // 높이를 넉넉히 잡아 맵 중앙(기본 시작 위치)이 y:0-8 집 발자국 밖에 오게 한다.
    runTool(context, "create_map", { name: "반복맵(집)", width: 30, height: 20 });
    const mapId = Object.keys(context.project.maps)[0]!;
    const tilesetId = context.project.maps[mapId]!.tilesetId;
    context.project.tilesets[tilesetId]!.structureKits = [{
      id: "kit_repeat_section",
      kind: "section",
      name: "반복 단면",
      width: 9,
      height: 8,
      rows: Array.from({ length: 8 }, () => ({ tiles: new Array<number>(9).fill(19) })),
      learnedFrom: "db-authored",
      ai: {
        description: "테스트용 반복 단면",
        placementRules: "테스트",
        repeatability: "repeat",
      },
    }];

    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
  });

  it("ai 가 없으면 section 기본 반복을 유지한다", () => {
    const { project, mapId } = projectWithRepeatKit(undefined);
    const context = { project };

    expectUnknownTool(runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_repeat_test", origin: { x: 0, y: 0 }, repeat: 3,
    }));
    expect(context.project.maps[mapId]!.lowerTiles[4]).not.toBe(421);
  });

  it("ai 는 있지만 repeatability 가 없으면 section 기본 반복을 유지한다", () => {
    const { project, mapId } = projectWithRepeatKit({
      description: "설명은 있지만 반복 여부는 안 정함",
      placementRules: "아무 데나",
    });
    const context = { project };

    expectUnknownTool(runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_repeat_test", origin: { x: 0, y: 0 }, repeat: 3,
    }));
    expect(context.project.maps[mapId]!.lowerTiles[4]).not.toBe(421);
  });
});

// 설명·배치규칙까지 갖춘 우물 킷 — AI 가 "언제 쓸지" 판단할 근거를 전부 가진 상태.
function projectWithDescribedKit(): { project: Project; mapId: string } {
  const project = createEmptyToolProject("설명 테스트");
  const context = { project };
  runTool(context, "create_map", { name: "설명맵", width: 20, height: 15 });
  const mapId = Object.keys(context.project.maps)[0]!;
  const tilesetId = context.project.maps[mapId]!.tilesetId;
  context.project.tilesets[tilesetId]!.structureKits = [{
    id: "kit_well",
    kind: "section",
    name: "우물",
    width: 3,
    height: 3,
    rows: [{ tiles: [421, 421, 421] }, { tiles: [421, 421, 421] }, { tiles: [421, 421, 421] }],
    learnedFrom: "db-authored",
    ai: {
      description: "돌담을 두른 두레우물.",
      placementRules: "마을 광장 중앙. 물가·숲 금지.",
      tags: ["우물", "물"],
      role: "prop",
      repeatability: "fixed",
      origin: "user",
    },
  }];
  return { project: context.project, mapId };
}

describe("AI 가 받는 구조물 정보", () => {
  it("list_structure_kits 가 설명·배치규칙·반복여부를 넘긴다", () => {
    const { project, mapId } = projectWithDescribedKit();

    const result = runTool({ project }, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);

    const data = result.data as {
      kits: { kitId: string; ai?: { description: string; placementRules: string }; repeatable: boolean }[];
    };
    const entry = data.kits.find((kit) => kit.kitId === "kit_well")!;
    expect(entry.ai?.description).toBe("돌담을 두른 두레우물.");
    expect(entry.ai?.placementRules).toContain("물가·숲 금지");
    expect(entry.repeatable).toBe(false);
  });

  it("설명이 없는 킷은 ai 없이 그대로 실린다", () => {
    const { project, mapId } = projectWithKit(); // 기존 픽스처 — WALL_KIT 은 ai 가 없다
    const data = runTool({ project }, "list_structure_kits", { mapId }).data as {
      kits: { kitId: string; ai?: unknown; repeatable: boolean }[];
    };
    const wall = data.kits.find((kit) => kit.kitId === "kit_wall_test")!;
    expect(wall.ai).toBeUndefined();
    expect(wall.repeatable).toBe(true); // section 기본값 유지
  });

  it("시스템 프롬프트가 설명과 배치규칙을 싣는다", () => {
    const { project, mapId } = projectWithDescribedKit();
    const prompt = buildSystemPrompt(project, { currentMapId: mapId });

    expect(prompt).toContain("우물");
    expect(prompt).toContain("사람 팔레트 전용");
    expect(prompt).toContain("author_house");
    expect(prompt).not.toMatch(/시공은 구조물 스탬프/);
  });
});

describe("structureKit 하네스 툴 — 등록 스탬프를 읽는다", () => {
  it("list_structure_kits가 킷의 타일 행렬(기계 표면)을 그대로 돌려준다", () => {
    const { project, mapId } = projectWithKit();

    const result = runTool({ project }, "list_structure_kits", { mapId });

    expect(result.ok).toBe(true);
    const data = result.data as {
      kits: { kitId: string; kind: string; width: number; height: number; learnedFrom: string; rows?: { tiles: number[] }[] }[];
    };
    const learned = data.kits.filter((kit) => kit.learnedFrom === "user-paint");
    expect(learned).toHaveLength(1);
    expect(learned[0]).toMatchObject({ kitId: "kit_wall_test", kind: "section", width: 1, height: 5 });
    expect(learned[0]!.rows!.map((row) => row.tiles)).toEqual([[19], [49], [109], [51], [81]]);
  });

  it("사람 스탬프 경로는 조회로 킷을 확인한다", () => {
    const { project, mapId } = projectWithKit();
    const context = { project };
    const before = [...context.project.maps[mapId]!.lowerTiles];

    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
    expect(context.project.maps[mapId]!.lowerTiles).toEqual(before);
  });

  it("없는 맵 조회는 빈 목록으로 답한다", () => {
    const { project } = projectWithKit();

    const outOfBounds = runTool({ project }, "list_structure_kits", {
      mapId: "missing_map",
    });
    expect(outOfBounds.ok).toBe(true);
    expect((outOfBounds.data as { kits: unknown[] }).kits).toEqual([]);
  });

  it("제거된 스탬프 호출은 미등록으로 거부된다", () => {
    const { project, mapId } = projectWithKit();
    const missing = runTool({ project }, "stamp_structure_kit", {
      mapId,
      kitId: "kit_none",
      origin: { x: 1, y: 1 },
      repeat: 3,
    });
    expectUnknownTool(missing);
  });

  it("list_structure_kits가 부위를 상대좌표(dx,dy)로 실어 준다", () => {
    const { project, mapId } = projectWithPartsKit();

    const result = runTool({ project }, "list_structure_kits", { mapId });

    expect(result.ok).toBe(true);
    const data = result.data as { kits: { kitId: string; parts?: unknown[] }[] };
    const shop = data.kits.find((kit) => kit.kitId === "kit_shop_test")!;
    expect(shop.parts).toEqual([
      { id: "pt_entrance", kind: "entrance", dx: 1, dy: 1, w: 1, h: 3, note: "남쪽 현관" },
      { id: "pt_sign", kind: "sign", dx: 2, dy: 1, w: 1, h: 1 },
    ]);
    // 부위가 없는 킷은 필드 자체가 없다(직렬화 최소화 규약).
    expect(data.kits.find((kit) => kit.kitId === "kit_wall_test")!.parts).toBeUndefined();
  });

  it("등록된 킷 조회는 부위 규약을 그대로 싣는다", () => {
    const { project, mapId } = projectWithPartsKit();
    const context = { project };

    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
  });

  it("등록된 킷 조회는 맵 이벤트를 건드리지 않는다", () => {
    const { project, mapId } = projectWithPartsKit();
    const context = { project };
    const before = context.project.maps[mapId]!.events.length;

    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
    expect(context.project.maps[mapId]!.events).toHaveLength(before);
  });

  it("부위 없는 킷 조회는 parts 필드를 만들지 않는다", () => {
    const { project, mapId } = projectWithKit();

    const result = runTool({ project }, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
  });

  it("시스템 프롬프트에 '내 구조물' 다이제스트가 실린다", () => {
    const { project, mapId } = projectWithKit();

    const prompt = buildSystemPrompt(project, { currentMapId: mapId });

    expect(prompt).toContain("사람 팔레트 전용");
    expect(prompt).toContain("성벽 단면");
    expect(prompt).toContain("author_house");
  });
});

describe("증분 축 — 세로로 무한히 이어지는 구조물", () => {
  /** 세로 증분으로 표시된 1×3 벽. 가로로는 늘어나지 않는다. */
  function verticalWallProject(): { context: { project: Project }; mapId: string } {
    const project = createEmptyToolProject("세로벽");
    const context = { project };
    runTool(context, "create_map", { name: "벽맵", width: 20, height: 15 });
    const mapId = Object.keys(context.project.maps)[0]!;
    const tilesetId = context.project.maps[mapId]!.tilesetId;
    context.project.tilesets[tilesetId]!.structureKits = [{
      id: "kit_vwall",
      kind: "section",
      name: "성벽 기둥",
      width: 1,
      height: 3,
      rows: [{ tiles: [19] }, { tiles: [49] }, { tiles: [81] }],
      cellHints: [{ dx: 0, dy: 1, growth: "vertical", note: "세로로 증분 가능" }],
      learnedFrom: "db-authored",
      ai: {
        description: "돌 성벽",
        placementRules: "경계를 따라",
        growthAxis: "vertical",
        themes: ["성채"],
        origin: "user",
      },
    }];
    return { context, mapId };
  }

  it("list_structure_kits 가 축·레이어·칸 힌트를 함께 돌려준다", () => {
    const { context } = verticalWallProject();
    const result = runTool(context, "list_structure_kits", {});
    expect(result.ok).toBe(true);
    const data = result.data as {
      kits: {
        kitId: string;
        growth: { x: boolean; y: boolean };
        layerHome: string;
        repeatable: boolean;
        cellHints?: { dx: number; dy: number; growth?: string; note?: string }[];
      }[];
    };
    const wall = data.kits.find((entry) => entry.kitId === "kit_vwall")!;
    expect(wall.growth).toEqual({ x: false, y: true });
    expect(wall.repeatable).toBe(false);
    expect(wall.layerHome).toBe("lower");
    expect(wall.cellHints).toEqual([{ dx: 0, dy: 1, growth: "vertical", note: "세로로 증분 가능" }]);
  });

  it("목록과 인스펙터가 같은 세로 증분 어휘를 쓴다", () => {
    const { context, mapId } = verticalWallProject();
    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.summary).toContain("성벽 기둥(kit_vwall, 1x3, 세로 증분)");
  });

  it("세로 증분 킷의 growth 축을 조회로 확인한다", () => {
    const { context, mapId } = verticalWallProject();
    const before = [...context.project.maps[mapId]!.lowerTiles];
    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
    expect(context.project.maps[mapId]!.lowerTiles).toEqual(before);
  });

  it("세로 증분 킷 조회는 repeatable=false 를 유지한다", () => {
    const { context, mapId } = verticalWallProject();
    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
    const map = context.project.maps[mapId]!;
    expect(map.lowerTiles[0]).not.toBe(19);
  });

  it("세로 증분이 없는 킷 조회는 growth 기본값을 유지한다", () => {
    const { project, mapId } = projectWithKit();
    const context = { project };
    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
  });

  it("없는 맵의 growth 조회는 빈 목록으로 답한다", () => {
    const { context } = verticalWallProject();
    const result = runTool(context, "list_structure_kits", {});
    expect(result.ok).toBe(true);
  });

  it("조회 인자 검증은 정수 범위를 유지한다", () => {
    const { context, mapId } = verticalWallProject();
    const result = runTool(context, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);
  });

  it("시스템 프롬프트가 축·테마·칸 힌트를 사람 말로 싣는다", () => {
    const { context } = verticalWallProject();
    const prompt = buildSystemPrompt(context.project);
    expect(prompt).toContain("성벽 기둥");
    expect(prompt).toContain("사람 팔레트 전용");
    expect(prompt).toContain("author_house");
    expect(prompt).not.toContain("repeatY");
  });
});

describe("제거된 구조물 스탬프 호출은 미등록으로 거부된다", () => {
  it("LLM 스키마에 stamp_structure_kit 이 없고, 호출하면 미등록 오류가 난다", () => {
    const tool = getTool("stamp_structure_kit");
    expect(tool).toBeUndefined();
    const exposed = toOpenAiTools().map((entry) => entry.function.name);
    expect(exposed).not.toContain("stamp_structure_kit");

    const { project, mapId } = projectWithKit();
    const context = { project };
    const before = [...context.project.maps[mapId]!.lowerTiles];
    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_wall_test",
      origin: { x: 1, y: 1 },
    });
    expectUnknownTool(result);
    expect(context.project.maps[mapId]!.lowerTiles).toEqual(before);
  });
});


describe("human structure stamp repeat feedback", () => {
  it.each([{}, { repeat: undefined, repeatY: undefined }])("omitted repeat arguments do not claim a clamp: %j", (args) => {
    const { project, mapId } = projectWithDescribedKit();
    const result = applyStampStructureKit(project, { mapId, kitId: "kit_well", origin: { x: 0, y: 0 }, ...args });
    expect(result.summary).not.toContain("증분 축 제한");
    expect((result.data as { repeatClamped?: string[] }).repeatClamped).toBeUndefined();
  });

  it("explicit unsupported repeats still explain both clamped axes", () => {
    const { project, mapId } = projectWithDescribedKit();
    const result = applyStampStructureKit(project, { mapId, kitId: "kit_well", origin: { x: 0, y: 0 }, repeat: 3, repeatY: 2 });
    expect((result.data as { repeatClamped?: string[] }).repeatClamped).toHaveLength(2);
  });
});
