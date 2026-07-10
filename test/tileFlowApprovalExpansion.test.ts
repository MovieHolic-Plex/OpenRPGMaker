// 타일 시공 흐름 재설계 1단계 (2026-07-07 §2.1.1·§2.1.2) 계약 테스트.
// T1 (게이트): v3 공정 프리미티브는 set_build_spec 스펙 게이트를 타지 않는다 —
//   승인 어휘가 있으면 밑그림 없이도 build_wall이 성공한다.
// T2 (파츠 불변식): propose_tile_vocabulary 수락 시 전개형 patternKind 그룹은
//   반드시 patternGrammar.parts를 갖는다. tileIds가 모자라면 승인 자체가 거부된다.

import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { SPATIAL_BUILD_TOOLS, SPEC_BOUNDARY_SLACK_TOOLS } from "@/ai/buildSpec";
import { runTool, type ToolContext } from "@/editor/tools";
import { derivePatternGrammar } from "@/editor/tools/v3";
import { ToolError } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { approvedVocabulary } from "@/project/tileVocabulary";
import type { TilesetDef } from "@/project/types";

type ChatResult = import("@/ai/llmClient").ChatResult;

const CONFIG = { baseUrl: "x", model: "test-model", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 };
const V3_PRIMITIVES = ["build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props"] as const;
const NINE_TILES = [301, 302, 303, 331, 332, 333, 361, 362, 363];

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (): Promise<ChatResult> => {
    if (index >= steps.length) throw new Error("scripted chat exhausted");
    return steps[index++];
  };
}

function toolCallMsg(name: string, args: unknown, id: string): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalMsg(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

function contextWithMap(): { ctx: ToolContext; tileset: () => TilesetDef } {
  const ctx: ToolContext = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "m1", name: "시공 테스트", width: 20, height: 20 });
  expect(created.ok).toBe(true);
  return { ctx, tileset: () => ctx.project.tilesets[DEFAULT_TILESET_ID] };
}

function approveWallGroup(ctx: ToolContext): string {
  const result = runTool(ctx, "propose_tile_vocabulary", {
    items: [{ kind: "group", tileIds: NINE_TILES, name: "테스트석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }],
  });
  expect(result.ok).toBe(true);
  const data = result.data as { cards: { groupId?: string }[] };
  const groupId = data.cards[0].groupId;
  expect(typeof groupId).toBe("string");
  return groupId!;
}

describe("T1 — v3 프리미티브는 스펙 게이트 제외", () => {
  it("SPATIAL_BUILD_TOOLS/SPEC_BOUNDARY_SLACK_TOOLS에 v3 6종이 없다 (레거시 배치 툴은 유지)", () => {
    for (const name of V3_PRIMITIVES) {
      expect(SPATIAL_BUILD_TOOLS.has(name)).toBe(false);
      expect(SPEC_BOUNDARY_SLACK_TOOLS.has(name)).toBe(false);
    }
    expect(SPATIAL_BUILD_TOOLS.has("build_house")).toBe(true);
    expect(SPATIAL_BUILD_TOOLS.has("paint_tiles")).toBe(true);
    expect(SPATIAL_BUILD_TOOLS.has("clear_region")).toBe(true);
  });

  it("승인 어휘가 있으면 set_build_spec 없이 build_wall이 성공한다", async () => {
    const { ctx } = contextWithMap();
    const groupId = approveWallGroup(ctx);

    const chat = scriptedChat([
      toolCallMsg("build_wall", { mapId: "m1", rect: { x: 4, y: 4, w: 5, h: 4 }, wallVocabId: groupId }, "c1"),
      finalMsg("벽을 지었습니다."),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const turn = await session.sendUserMessage("벽 깔아줘");

    expect(turn.stoppedReason).toBe("final");
    const wallCall = turn.proposedCalls.find((call) => call.name === "build_wall");
    expect(wallCall).toBeDefined();
    expect(wallCall!.result.ok).toBe(true);
    // 스펙 게이트 차단 흔적이 없어야 한다.
    const audit = session.getAuditEntries();
    expect(audit.some((entry) => entry.kind === "tool" && !entry.ok)).toBe(false);
    // draft에 실제로 벽이 칠해졌다.
    const map = session.getProposedProject().maps["m1"];
    expect(map.lowerTiles[4 * map.width + 4]).toBe(NINE_TILES[0]); // topLeft
    expect(map.lowerTiles[5 * map.width + 5]).toBe(NINE_TILES[4]); // center
  });
});

describe("T2 — 승인 시 패턴 파츠 자동 생성 불변식", () => {
  it("nine_slice 9개 tileIds 수락 → patternGrammar.parts 9칸 매핑 + 승인 어휘 patternKind 노출", () => {
    const { ctx, tileset } = contextWithMap();
    const groupId = approveWallGroup(ctx);

    const group = tileset().tileGroups!.find((entry) => entry.id === groupId)!;
    expect(group.origin).toBe("user");
    const grammar = group.patternGrammar;
    expect(grammar).toBeDefined();
    expect(grammar!.kind).toBe("nine_slice_expandable");
    expect(grammar!.parts).toHaveLength(9);
    const role = (name: string) => grammar!.parts.find((part) => part.role === name)?.tileIds;
    expect(role("topLeft")).toEqual([NINE_TILES[0]]);
    expect(role("center")).toEqual([NINE_TILES[4]]);
    expect(role("bottomRight")).toEqual([NINE_TILES[8]]);

    const vocab = approvedVocabulary(tileset());
    expect(vocab.groups.find((entry) => entry.id === groupId)?.patternKind).toBe("nine_slice_expandable");
  });

  it("nine_slice 9개 미만이면 승인 거부(pattern-underspecified) — 그룹이 커밋되지 않는다", () => {
    const { ctx, tileset } = contextWithMap();
    const before = tileset().tileGroups?.length ?? 0;
    // 번들 하네스 그룹은 source:"bundled-default"로 이미 시드 승인되어 있다(2026-07-11) —
    // "미승인 시도가 승인 목록을 늘리지 않는다"를 검증하려면 그 기준선을 잡아야 한다.
    const approvedBefore = approvedVocabulary(tileset()).groups.length;
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [{ kind: "group", tileIds: [301, 302, 303], name: "모자란벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "pattern-underspecified")).toBe(true);
    // 쓰기 draft가 폐기되어 부분 마킹이 남지 않는다.
    expect(tileset().tileGroups?.length ?? 0).toBe(before);
    expect(approvedVocabulary(tileset()).groups).toHaveLength(approvedBefore);
  });

  it("vertical 2개(1×2 문 규약)는 top/bottom, 3의 배수는 top/repeatBody/bottom으로 파생된다", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const door = derivePatternGrammar("vertical_expandable", [116, 146], tileset);
    expect(door!.parts).toEqual([
      { role: "top", tileIds: [116] },
      { role: "bottom", tileIds: [146] },
    ]);
    const pillar = derivePatternGrammar("vertical_expandable", [10, 11, 20, 21, 30, 31], tileset);
    expect(pillar!.parts).toEqual([
      { role: "top", tileIds: [10, 11] },
      { role: "repeatBody", tileIds: [20, 21] },
      { role: "bottom", tileIds: [30, 31] },
    ]);
    expect(() => derivePatternGrammar("vertical_expandable", [1, 2, 3, 4], tileset)).toThrow(ToolError);
  });

  it("autotile_3x3 승인은 8-이웃 variantMap 오토타일 그룹을 등록하고 내장 폴백(흙길/모래)을 승계한다", () => {
    const { ctx, tileset } = contextWithMap();
    const fallbackCount = 2; // 기본 타일셋의 내장 폴백: 흙길·모래
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [{ kind: "group", tileIds: NINE_TILES, name: "테스트길", role: "terrain", patternKind: "autotile_3x3", layerHome: "lower" }],
    });
    expect(result.ok).toBe(true);
    const def = tileset();
    const groups = def.autotileGroups ?? [];
    expect(groups.length).toBe(fallbackCount + 1);
    const registered = groups.find((group) => group.name === "테스트길")!;
    expect(registered.neighborhood).toBe(8);
    expect(Object.keys(registered.variantMap)).toHaveLength(256);
    expect(registered.variantMap[String(255)]).toBe(NINE_TILES[4]); // 4방+대각 모두 연결 = body
  });
});
