import { describe, expect, it } from "vitest";
import { createEmptyToolProject, runTool } from "@/editor/tools";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import type { Project, StructureKitDef } from "@/project/types";

// 성벽 정단면 1×5 킷 — 프로토 데모에서 [등록]으로 저장되는 것과 동일한 shape.
const WALL_KIT: StructureKitDef = {
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
const SHOP_KIT: StructureKitDef = {
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
function projectWithRepeatKit(ai: StructureKitDef["ai"]): { project: Project; mapId: string } {
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

describe("repeatability — 한 채 완결 구조물이 3개씩 찍히지 않는다", () => {
  it("fixed 인 킷은 repeat 를 줘도 1회만 찍는다", () => {
    // 우물·간판처럼 한 채로 완결인 구조물. repeat 기본값 3 때문에 3개가 찍히던 문제.
    const { project, mapId } = projectWithRepeatKit({
      description: "돌 우물",
      placementRules: "광장 중앙",
      repeatability: "fixed",
    });
    const context = { project };

    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_repeat_test",
      origin: { x: 0, y: 0 },
      repeat: 5,
    });
    expect(result.ok).toBe(true);

    const map = context.project.maps[mapId]!;
    expect(map.lowerTiles[0]).toBe(421);
    expect(map.lowerTiles[1]).toBe(421);
    // 폭 2 킷이 1회만 찍혔다면 x=2 는 원래 타일 그대로다.
    expect(map.lowerTiles[2]).not.toBe(421);
  });

  it("repeat 인 킷은 repeat 를 그대로 따른다 — house 종류라 fallback 이면 false 다", () => {
    // kind:"section"이면 fallback(kind === "section")도 true라 override 유무를 가리지 못한다.
    // house는 fallback이 false이므로, ai.repeatability:"repeat"가 실제로 override할 때만 통과한다.
    const project = createEmptyToolProject("반복 테스트(집)");
    const context = { project };
    // 높이를 넉넉히 잡아 맵 중앙(기본 시작 위치)이 y:0-8 집 발자국 밖에 오게 한다.
    runTool(context, "create_map", { name: "반복맵(집)", width: 30, height: 20 });
    const mapId = Object.keys(context.project.maps)[0]!;
    const tilesetId = context.project.maps[mapId]!.tilesetId;
    context.project.tilesets[tilesetId]!.structureKits = [{
      id: "kit_house_repeat_test",
      kind: "house",
      name: "반복 집 킷",
      houseKitId: "blue-stone",
      wings: [{ x: 0, y: 0, w: 9, h: 8 }],
      learnedFrom: "db-authored",
      ai: {
        description: "테스트용 반복 집",
        placementRules: "테스트",
        repeatability: "repeat",
      },
    }];

    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_house_repeat_test",
      origin: { x: 0, y: 0 },
      repeat: 3,
    });

    expect(result.ok).toBe(true);
    expect((result.data as { repeat: number }).repeat).toBe(3);
  });

  it("ai 가 없으면 기존 동작(section 은 반복)을 유지한다", () => {
    const { project, mapId } = projectWithRepeatKit(undefined);
    const context = { project };

    runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_repeat_test", origin: { x: 0, y: 0 }, repeat: 3,
    });
    expect(context.project.maps[mapId]!.lowerTiles[4]).toBe(421);
  });

  it("ai 는 있지만 repeatability 가 없으면 기존 동작(section 은 반복)을 유지한다", () => {
    const { project, mapId } = projectWithRepeatKit({
      description: "설명은 있지만 반복 여부는 안 정함",
      placementRules: "아무 데나",
    });
    const context = { project };

    runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_repeat_test", origin: { x: 0, y: 0 }, repeat: 3,
    });
    expect(context.project.maps[mapId]!.lowerTiles[4]).toBe(421);
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

    expect(prompt).toContain("돌담을 두른 두레우물.");
    expect(prompt).toContain("마을 광장 중앙");
    expect(prompt).toContain("한 채 완결");
  });
});

describe("structureKit 하네스 툴 — 봇이 등록 스탬프를 읽고 시공한다", () => {
  it("list_structure_kits가 킷의 타일 행렬(기계 표면)을 그대로 돌려준다", () => {
    const { project, mapId } = projectWithKit();

    const result = runTool({ project }, "list_structure_kits", { mapId });

    expect(result.ok).toBe(true);
    const data = result.data as {
      kits: { kitId: string; kind: string; width: number; height: number; learnedFrom: string; rows?: { tiles: number[] }[] }[];
    };
    // 2026-07-20: 내장 파라메트릭 집 킷 6종이 등록 킷 앞에 함께 실린다.
    const learned = data.kits.filter((kit) => kit.learnedFrom === "user-paint");
    expect(learned).toHaveLength(1);
    expect(learned[0]).toMatchObject({ kitId: "kit_wall_test", kind: "section", width: 1, height: 5 });
    expect(learned[0]!.rows!.map((row) => row.tiles)).toEqual([[19], [49], [109], [51], [81]]);
    const houses = data.kits.filter((kit) => kit.kind === "house");
    expect(houses.length).toBeGreaterThanOrEqual(6);
    expect(houses.every((kit) => kit.rows === undefined)).toBe(true);
  });

  it("stamp_structure_kit이 단면을 가로 repeat회로 결정론 시공한다", () => {
    const { project, mapId } = projectWithKit();
    const context = { project };

    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_wall_test",
      origin: { x: 3, y: 2 },
      repeat: 6,
    });

    expect(result.ok).toBe(true);
    const map = context.project.maps[mapId]!;
    const wallColumn = [19, 49, 109, 51, 81];
    for (let x = 3; x < 9; x += 1) {
      for (let row = 0; row < 5; row += 1) {
        expect(map.lowerTiles[(2 + row) * map.width + x], `cell (${x},${2 + row})`).toBe(wallColumn[row]!);
      }
    }
    // 시공 범위 밖은 건드리지 않는다.
    expect(map.lowerTiles[2 * map.width + 9]).not.toBe(19);
    expect(result.diff?.tilesChanged ?? 0).toBeGreaterThanOrEqual(30);
  });

  it("맵 밖 시공·없는 킷은 게이트에서 거부된다", () => {
    const { project, mapId } = projectWithKit();

    const outOfBounds = runTool({ project }, "stamp_structure_kit", {
      mapId,
      kitId: "kit_wall_test",
      origin: { x: 18, y: 2 },
      repeat: 6,
    });
    expect(outOfBounds.ok).toBe(false);

    const missing = runTool({ project }, "stamp_structure_kit", {
      mapId,
      kitId: "kit_none",
      origin: { x: 1, y: 1 },
      repeat: 3,
    });
    expect(missing.ok).toBe(false);
    expect(missing.summary).toContain("kit_none");
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

  it("stamp_structure_kit이 부위를 origin 기준 절대좌표로 돌려준다", () => {
    const { project, mapId } = projectWithPartsKit();
    const context = { project };
    const origin = { x: 6, y: 4 };

    const result = runTool(context, "stamp_structure_kit", { mapId, kitId: "kit_shop_test", origin });

    expect(result.ok).toBe(true);
    const data = result.data as { parts?: { id: string; kind: string; x: number; y: number; w: number; h: number; note?: string }[] };
    expect(data.parts).toEqual([
      { id: "pt_entrance", kind: "entrance", x: 7, y: 5, w: 1, h: 3, note: "남쪽 현관" },
      { id: "pt_sign", kind: "sign", x: 8, y: 5, w: 1, h: 1 },
    ]);
    // 워프 칸 규약: 입구의 dy + h - 1 행. 별도 warpCell 필드 없이 여기서 계산된다.
    const entrance = data.parts!.find((part) => part.kind === "entrance")!;
    expect({ x: entrance.x, y: entrance.y + entrance.h - 1 }).toEqual({ x: 7, y: 7 });
  });

  it("stamp_structure_kit은 부위가 있어도 맵 이벤트를 심지 않는다", () => {
    const { project, mapId } = projectWithPartsKit();
    const context = { project };
    const before = context.project.maps[mapId]!.events.length;

    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_shop_test",
      origin: { x: 6, y: 4 },
    });

    expect(result.ok).toBe(true);
    expect(context.project.maps[mapId]!.events).toHaveLength(before);
    expect(result.diff?.eventsAdded ?? 0).toBe(0);
  });

  it("부위 없는 킷 시공은 parts 필드를 만들지 않는다", () => {
    const { project, mapId } = projectWithKit();

    const result = runTool({ project }, "stamp_structure_kit", {
      mapId,
      kitId: "kit_wall_test",
      origin: { x: 3, y: 2 },
      repeat: 2,
    });

    expect(result.ok).toBe(true);
    expect((result.data as { parts?: unknown }).parts).toBeUndefined();
  });

  it("시스템 프롬프트에 '내 구조물' 다이제스트가 실린다", () => {
    const { project, mapId } = projectWithKit();

    const prompt = buildSystemPrompt(project, { currentMapId: mapId });

    expect(prompt).toContain("내 구조물");
    expect(prompt).toContain("성벽 단면");
    expect(prompt).toContain("stamp_structure_kit");
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

  it("repeatY 로 세로로 쌓는다 — 예전에는 가로 반복밖에 없었다", () => {
    const { context, mapId } = verticalWallProject();
    const result = runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_vwall", origin: { x: 4, y: 0 }, repeatY: 4,
    });
    expect(result.ok).toBe(true);
    const map = context.project.maps[mapId]!;
    // 1×3 킷 4단 = 12칸이 x=4 열에 연속으로 들어간다.
    const column = Array.from({ length: 12 }, (_unused, y) => map.lowerTiles[y * map.width + 4]);
    expect(column).toEqual([19, 49, 81, 19, 49, 81, 19, 49, 81, 19, 49, 81]);
    const data = result.data as { repeatY: number; repeat: number; height: number; placementIds: string[] };
    expect(data.repeatY).toBe(4);
    expect(data.repeat).toBe(1);
    expect(data.height).toBe(12);
    // 단위마다 배치 기록이 하나 — "맨 위 한 단만 지워줘"가 가능해야 한다.
    expect(data.placementIds).toHaveLength(4);
  });

  it("세로 증분 킷은 repeat(가로)를 줘도 1회로 조이고 그 사실을 말한다", () => {
    const { context, mapId } = verticalWallProject();
    const result = runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_vwall", origin: { x: 0, y: 0 }, repeat: 5,
    });
    expect(result.ok).toBe(true);
    // 조인 사실이 문장에 남아야 한다 — 말없이 조이면 모델은 5칸을 채웠다고 믿는다.
    expect(result.summary).toContain("증분 축 제한");
    expect((result.data as { repeat: number }).repeat).toBe(1);
    // 옆 열은 손대지 않았다 — create_map 이 깔아 둔 지면이 그대로다(빈 칸은 -1 이 아니다).
    const map = context.project.maps[mapId]!;
    expect(map.lowerTiles[1]).not.toBe(19);
  });

  it("세로 증분이 없는 킷에 repeatY 를 주면 1회로 조인다 — 조용히 3층이 생기지 않는다", () => {
    const { project, mapId } = projectWithKit();
    const context = { project };
    const result = runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_wall_test", origin: { x: 0, y: 0 }, repeat: 1, repeatY: 3,
    });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain("증분 축 제한");
    expect((result.data as { repeatY: number }).repeatY).toBe(1);
  });

  it("맵을 벗어나는 세로 반복은 한 칸도 쓰지 않고 거부한다", () => {
    const { context, mapId } = verticalWallProject();
    const result = runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_vwall", origin: { x: 0, y: 0 }, repeatY: 9,
    });
    expect(result.ok).toBe(false);
    const map = context.project.maps[mapId]!;
    expect(map.lowerTiles.every((tile) => tile !== 19)).toBe(true);
  });

  it("repeatY 도 1~50 정수만 받는다", () => {
    const { context, mapId } = verticalWallProject();
    const result = runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_vwall", origin: { x: 0, y: 0 }, repeatY: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("repeatY");
  });

  it("시스템 프롬프트가 축·테마·칸 힌트를 사람 말로 싣는다", () => {
    const { context } = verticalWallProject();
    const prompt = buildSystemPrompt(context.project);
    expect(prompt).toContain("세로 증분 가능");
    expect(prompt).toContain("테마: 성채");
    expect(prompt).toContain("세로로 증분 가능");
    expect(prompt).toContain("repeatY");
  });
});
