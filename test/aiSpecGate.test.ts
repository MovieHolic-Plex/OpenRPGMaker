// 스펙 게이트 계약(2026-07-05, '모호도' 대체): 공간 쓰기 툴은 set_build_spec으로 제출되어
// 코드가 결정적으로 검증(경계/겹침)한 밑그림(명세)의 할당 영역 안에서만 실행된다(구간 격리).
// - 자기 신고 수치([모호도 N%]) 개념은 완전히 제거된다.
// - 사용자가 맵에서 선택한 영역([컨텍스트] footer)은 암묵적 명세다.
// - 명세 검증 3회 실패 시 그 계획은 폐기하고 사용자에게 묻도록 유도한다.
import { describe, expect, it } from "vitest";
import { AssistantSession, METADATA_ONLY_TOOLS } from "@/ai/assistantSession";
import {
  SPATIAL_BUILD_TOOLS,
  affectedRegions,
  builtCellsInRegions,
  implicitSpecFromContext,
  regionsCoveredBySpec,
  validateBuildSpec,
  type BuildSpec,
} from "@/ai/buildSpec";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

type ChatResult = import("@/ai/llmClient").ChatResult;

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

const CONFIG = { baseUrl: "x", model: "google/gemini-3.1-flash-lite", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 };

// 20×20 맵 m1이 있는 프로젝트.
function projectWithMap() {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "m1", name: "스펙 테스트", width: 20, height: 20 });
  expect(created.ok).toBe(true);
  return ctx.project;
}

const SPEC_TOOL_ARGS = { id: "m1", name: "스펙 테스트", width: 20, height: 20 };

describe("buildSpec 검증기(결정적)", () => {
  it("경계를 벗어난 에셋은 error", () => {
    const project = projectWithMap();
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "집A", kind: "house", x: 15, y: 15, w: 8, h: 8 }] };
    const issues = validateBuildSpec(project, spec);
    expect(issues.some((issue) => issue.severity === "error" && issue.message.includes("집A"))).toBe(true);
  });

  it("같은 층(lower) 에셋 겹침은 error — 두 id를 모두 언급", () => {
    const project = projectWithMap();
    const spec: BuildSpec = {
      mapId: "m1",
      assets: [
        { id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 },
        { id: "집B", kind: "house", x: 5, y: 5, w: 6, h: 6 },
      ],
    };
    const issues = validateBuildSpec(project, spec);
    const overlap = issues.find((issue) => issue.severity === "error" && issue.message.includes("집A") && issue.message.includes("집B"));
    expect(overlap).toBeDefined();
  });

  it("upper 장식이 lower 위에 겹치는 것과 길×길 교차는 허용", () => {
    const project = projectWithMap();
    const decor: BuildSpec = {
      mapId: "m1",
      assets: [
        { id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 },
        { id: "간판", kind: "prop", layer: "upper", x: 4, y: 4, w: 1, h: 1 },
      ],
    };
    expect(validateBuildSpec(project, decor).filter((issue) => issue.severity === "error")).toEqual([]);
    const roads: BuildSpec = {
      mapId: "m1",
      assets: [
        { id: "길-가로", kind: "road", x: 0, y: 9, w: 20, h: 2 },
        { id: "길-세로", kind: "road", x: 9, y: 0, w: 2, h: 20 },
      ],
    };
    expect(validateBuildSpec(project, roads).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("없는 맵/빈 에셋/깨진 좌표는 error", () => {
    const project = projectWithMap();
    expect(validateBuildSpec(project, { mapId: "없는맵", assets: [{ id: "a", kind: "house", x: 0, y: 0, w: 2, h: 2 }] }).some((i) => i.severity === "error")).toBe(true);
    expect(validateBuildSpec(project, { mapId: "m1", assets: [] }).some((i) => i.severity === "error")).toBe(true);
    expect(validateBuildSpec(project, { mapId: "m1", assets: [{ id: "a", kind: "house", x: 1, y: 1, w: 0, h: 3 }] }).some((i) => i.severity === "error")).toBe(true);
  });
});

describe("affectedRegions — 툴 인자에서 영향 영역 추출", () => {
  it("paint_tiles rect(from/to), cells, build_house(width/height), place_npc(1×1), paint_road(points)", () => {
    expect(affectedRegions("paint_tiles", { mapId: "m1", from: { x: 3, y: 4 }, to: { x: 5, y: 6 } }))
      .toEqual([{ mapId: "m1", x: 3, y: 4, w: 3, h: 3 }]);
    expect(affectedRegions("paint_tiles", { mapId: "m1", cells: [{ x: 1, y: 2 }, { x: 7, y: 8 }] }))
      .toEqual([{ mapId: "m1", x: 1, y: 2, w: 1, h: 1 }, { mapId: "m1", x: 7, y: 8, w: 1, h: 1 }]);
    expect(affectedRegions("build_house", { mapId: "m1", x: 2, y: 3, width: 8, height: 7 }))
      .toEqual([{ mapId: "m1", x: 2, y: 3, w: 8, h: 7 }]);
    expect(affectedRegions("place_npc", { mapId: "m1", x: 5, y: 5, name: "n", pages: [] }))
      .toEqual([{ mapId: "m1", x: 5, y: 5, w: 1, h: 1 }]);
    expect(affectedRegions("paint_road", { mapId: "m1", points: [{ x: 0, y: 9 }, { x: 19, y: 9 }], style: "dirt" }))
      .toEqual([{ mapId: "m1", x: 0, y: 9, w: 1, h: 1 }, { mapId: "m1", x: 19, y: 9, w: 1, h: 1 }]);
  });

  it("regionsCoveredBySpec — 영역 밖 셀 수와 예시 좌표", () => {
    const assets = [{ id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 }];
    expect(regionsCoveredBySpec(assets, [{ mapId: "m1", x: 3, y: 3, w: 2, h: 2 }]).covered).toBe(true);
    const out = regionsCoveredBySpec(assets, [{ mapId: "m1", x: 7, y: 7, w: 2, h: 2 }]);
    expect(out.covered).toBe(false);
    expect(out.outsideCells).toBeGreaterThan(0);
    expect(out.sample).toBeDefined();
  });
});

describe("implicitSpecFromContext — 사용자 선택 영역은 암묵적 명세", () => {
  it("[컨텍스트] footer의 맵 id와 선택 영역을 파싱한다", () => {
    const spec = implicitSpecFromContext("여기 꽃 심어줘\n\n[컨텍스트] 현재 맵: 잿불 마을 (map_ember_village) · 사용자 선택 영역: (3,4) 5×6");
    expect(spec).not.toBeNull();
    expect(spec!.mapId).toBe("map_ember_village");
    expect(spec!.assets[0]).toMatchObject({ x: 3, y: 4, w: 5, h: 6 });
  });

  it("선택 영역이 없으면 null", () => {
    expect(implicitSpecFromContext("안녕\n\n[컨텍스트] 현재 맵: 잿불 마을 (map_ember_village)")).toBeNull();
    expect(implicitSpecFromContext("안녕")).toBeNull();
  });
});

describe("세션 스펙 게이트", () => {
  it("스펙 없이 공간 툴 호출 → 차단(set_build_spec 안내), 비공간 쓰기(create_map)는 그대로 실행", async () => {
    expect(SPATIAL_BUILD_TOOLS.has("build_house")).toBe(true);
    expect(SPATIAL_BUILD_TOOLS.has("create_map")).toBe(false);
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("build_house", { mapId: "m1", x: 2, y: 2, width: 6, height: 7, material: "plaster" }, "c2"),
      finalMsg("밑그림이 필요합니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: { name: string; ok: boolean; summary: string }[] = [];
    await session.sendUserMessage("집 지어줘", (e) => {
      if (e.type === "tool_call") events.push({ name: e.name, ok: e.result.ok, summary: e.result.summary });
    });
    expect(events.find((e) => e.name === "create_map")!.ok).toBe(true);
    const blocked = events.find((e) => e.name === "build_house")!;
    expect(blocked.ok).toBe(false);
    expect(blocked.summary).toContain("스펙");
    const gateMsg = session.getMessages().find((m) => m.role === "tool" && typeof m.content === "string" && m.content.includes("spec-gate"));
    expect(gateMsg).toBeDefined();
    expect(gateMsg!.content).toContain("set_build_spec");
  });

  it("겹침 스펙 거부 → 수정 재제출 → 할당 영역 안 빌드 실행", async () => {
    const badSpec = {
      mapId: "m1",
      title: "마을",
      assets: [
        { id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 },
        { id: "집B", kind: "house", x: 5, y: 5, w: 6, h: 6 },
      ],
    };
    const goodSpec = {
      mapId: "m1",
      title: "마을",
      assets: [
        { id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 },
        { id: "집B", kind: "house", x: 10, y: 2, w: 6, h: 6 },
      ],
    };
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", badSpec, "c2"),
      toolCallMsg("set_build_spec", goodSpec, "c3"),
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 3, y: 3 }, to: { x: 5, y: 5 }, mode: "rect", layer: "lower", tile: 240 }, "c4"),
      finalMsg("집A 자리를 준비했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: { name: string; ok: boolean }[] = [];
    const result = await session.sendUserMessage("마을 만들어줘", (e) => {
      if (e.type === "tool_call") events.push({ name: e.name, ok: e.result.ok });
    });
    expect(events.filter((e) => e.name === "set_build_spec").map((e) => e.ok)).toEqual([false, true]);
    expect(events.find((e) => e.name === "paint_tiles")!.ok).toBe(true);
    // 스펙 자체는 프로젝트 변경이 아니므로 제안에 포함되지 않는다.
    expect(result.proposedCalls.map((c) => c.name).sort()).toEqual(["create_map", "paint_tiles"]);
    expect(session.getActiveSpec()?.assets.length).toBe(2);
  });

  it("할당 영역 밖 빌드는 차단된다(구간 격리)", async () => {
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 }] }, "c2"),
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 15, y: 15 }, to: { x: 16, y: 16 }, mode: "rect", layer: "lower", tile: 240 }, "c3"),
      finalMsg("좌표를 다시 잡겠습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: { name: string; ok: boolean; summary: string }[] = [];
    await session.sendUserMessage("집 지어줘", (e) => {
      if (e.type === "tool_call") events.push({ name: e.name, ok: e.result.ok, summary: e.result.summary });
    });
    const paint = events.find((e) => e.name === "paint_tiles")!;
    expect(paint.ok).toBe(false);
    expect(paint.summary).toContain("밖");
    expect(paint.summary).toContain("허용 slack ±2칸");
  });

  it("할당 영역 동쪽 +1칸 초과는 차단하지 않고 slack warning으로 통과", async () => {
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 }] }, "c2"),
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 6, y: 3 }, to: { x: 8, y: 3 }, mode: "rect", layer: "lower", tile: 240 }, "c3"),
      finalMsg("경계 근처까지 칠했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: Array<{ name: string; ok: boolean; issues?: Array<{ severity: string; code: string; message: string }>; warnings?: string[] }> = [];
    await session.sendUserMessage("집 지어줘", (e) => {
      if (e.type === "tool_call") {
        events.push({
          name: e.name,
          ok: e.result.ok,
          issues: e.result.issues?.map((issue) => ({ severity: issue.severity, code: issue.code, message: issue.message })),
          warnings: e.result.diff?.warnings,
        });
      }
    });
    const paint = events.find((e) => e.name === "paint_tiles")!;
    expect(paint.ok).toBe(true);
    expect(paint.issues).toContainEqual(expect.objectContaining({
      severity: "warning",
      code: "spec-gate-slack",
      message: expect.stringContaining("동쪽 1칸"),
    }));
    expect(paint.issues?.[0]?.message).toContain("slack 허용");
    expect(paint.warnings?.some((warning) => warning.includes("동쪽 1칸"))).toBe(true);
  });

  it("할당 영역 동쪽 +2칸 초과도 slack warning으로 통과", async () => {
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "길", kind: "road", x: 2, y: 2, w: 6, h: 6 }] }, "c2"),
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 6, y: 4 }, to: { x: 9, y: 4 }, mode: "rect", layer: "lower", tile: 240 }, "c3"),
      finalMsg("길을 조금 넓혔습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: Array<{ name: string; ok: boolean; issues?: Array<{ severity: string; code: string; message: string }> }> = [];
    await session.sendUserMessage("길 칠해줘", (e) => {
      if (e.type === "tool_call") {
        events.push({
          name: e.name,
          ok: e.result.ok,
          issues: e.result.issues?.map((issue) => ({ severity: issue.severity, code: issue.code, message: issue.message })),
        });
      }
    });
    const paint = events.find((e) => e.name === "paint_tiles")!;
    expect(paint.ok).toBe(true);
    expect(paint.issues).toContainEqual(expect.objectContaining({
      severity: "warning",
      code: "spec-gate-slack",
      message: expect.stringContaining("동쪽 2칸"),
    }));
  });

  it("할당 영역 동쪽 +3칸 초과는 기존처럼 차단하고 허용 slack을 안내", async () => {
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "길", kind: "road", x: 2, y: 2, w: 6, h: 6 }] }, "c2"),
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 7, y: 4 }, to: { x: 10, y: 4 }, mode: "rect", layer: "lower", tile: 240 }, "c3"),
      finalMsg("좌표를 줄이겠습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: Array<{ name: string; ok: boolean; summary: string; issues?: Array<{ message: string }> }> = [];
    await session.sendUserMessage("길 칠해줘", (e) => {
      if (e.type === "tool_call") {
        events.push({
          name: e.name,
          ok: e.result.ok,
          summary: e.result.summary,
          issues: e.result.issues?.map((issue) => ({ message: issue.message })),
        });
      }
    });
    const paint = events.find((e) => e.name === "paint_tiles")!;
    expect(paint.ok).toBe(false);
    expect(paint.summary).toContain("허용 slack ±2칸");
    expect(paint.issues?.some((issue) => issue.message.includes("허용 slack ±2칸"))).toBe(true);
  });

  it("clear_region은 정리/파괴성 호출이라 할당 영역 +1칸도 slack 없이 차단", async () => {
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "청소", kind: "clear", x: 5, y: 5, w: 3, h: 3 }] }, "c2"),
      toolCallMsg("clear_region", { mapId: "m1", x: 5, y: 5, w: 4, h: 3 }, "c3"),
      finalMsg("정리 영역을 줄이겠습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: Array<{ name: string; ok: boolean; summary: string; issues?: Array<{ message: string }> }> = [];
    await session.sendUserMessage("빈터 청소해줘", (e) => {
      if (e.type === "tool_call") {
        events.push({
          name: e.name,
          ok: e.result.ok,
          summary: e.result.summary,
          issues: e.result.issues?.map((issue) => ({ message: issue.message })),
        });
      }
    });
    const clear = events.find((e) => e.name === "clear_region")!;
    expect(clear.ok).toBe(false);
    expect(clear.summary).toContain("slack 없음");
    expect(clear.issues?.some((issue) => issue.message.includes("slack 없이"))).toBe(true);
  });

  it("확정된 스펙은 턴 간 유지된다 — 다음 턴 '계속해'에서 재제출 없이 빌드", async () => {
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "집A", kind: "house", x: 2, y: 2, w: 6, h: 6 }] }, "c2"),
      finalMsg("밑그림을 잡았습니다. 진행할까요?"),
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 2, y: 2 }, to: { x: 4, y: 4 }, mode: "rect", layer: "lower", tile: 240 }, "c3"),
      finalMsg("집A 기초를 깔았습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    await session.sendUserMessage("집 계획 잡아줘", () => {});
    const turn2: boolean[] = [];
    await session.sendUserMessage("계속해", (e) => {
      if (e.type === "tool_call") turn2.push(e.result.ok);
    });
    expect(turn2).toEqual([true]);
  });

  it("사용자 선택 영역([컨텍스트])은 암묵 스펙으로 인정된다", async () => {
    const project = projectWithMap();
    const chat = scriptedChat([
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 4, y: 4 }, to: { x: 5, y: 5 }, mode: "rect", layer: "lower", tile: 240 }, "c1"),
      finalMsg("선택 영역에 깔았습니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: boolean[] = [];
    await session.sendUserMessage("여기 잔디 깔아줘\n\n[컨텍스트] 현재 맵: 스펙 테스트 (m1) · 사용자 선택 영역: (3,3) 5×5", (e) => {
      if (e.type === "tool_call") events.push(e.result.ok);
    });
    expect(events).toEqual([true]);
  });

  it("사용자 선택 영역 암묵 스펙도 경계 +2칸은 warning으로 통과한다", async () => {
    const project = projectWithMap();
    const chat = scriptedChat([
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 7, y: 4 }, to: { x: 9, y: 4 }, mode: "rect", layer: "lower", tile: 240 }, "c1"),
      finalMsg("선택 영역 가장자리까지 깔았습니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Array<{ ok: boolean; issues?: Array<{ code: string; message: string }> }> = [];
    await session.sendUserMessage("여기 잔디 깔아줘\n\n[컨텍스트] 현재 맵: 스펙 테스트 (m1) · 사용자 선택 영역: (3,3) 5×5", (e) => {
      if (e.type === "tool_call") {
        events.push({
          ok: e.result.ok,
          issues: e.result.issues?.map((issue) => ({ code: issue.code, message: issue.message })),
        });
      }
    });
    expect(events[0]?.ok).toBe(true);
    expect(events[0]?.issues).toContainEqual(expect.objectContaining({
      code: "spec-gate-slack",
      message: expect.stringContaining("동쪽 2칸"),
    }));
  });

  it("스펙 검증 3회 실패 → 폐기 안내, 공간 툴은 계속 차단", async () => {
    const bad = { mapId: "m1", assets: [{ id: "a", kind: "house", x: 18, y: 18, w: 9, h: 9 }] };
    const chat = scriptedChat([
      toolCallMsg("create_map", SPEC_TOOL_ARGS, "c1"),
      toolCallMsg("set_build_spec", bad, "c2"),
      toolCallMsg("set_build_spec", bad, "c3"),
      toolCallMsg("set_build_spec", bad, "c4"),
      toolCallMsg("set_build_spec", bad, "c5"),
      toolCallMsg("paint_tiles", { mapId: "m1", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, mode: "rect", layer: "lower", tile: 240 }, "c6"),
      finalMsg("어디에 지을지 알려주세요. [선택지] 영역 지정 | 중단"),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: { name: string; ok: boolean; summary: string }[] = [];
    await session.sendUserMessage("집?", (e) => {
      if (e.type === "tool_call") events.push({ name: e.name, ok: e.result.ok, summary: e.result.summary });
    });
    const specTries = events.filter((e) => e.name === "set_build_spec");
    expect(specTries.every((e) => !e.ok)).toBe(true);
    expect(specTries[specTries.length - 1].summary).toContain("폐기");
    expect(events.find((e) => e.name === "paint_tiles")!.ok).toBe(false);
  });

  it("비공간 쓰기(타일 메타데이터)는 스펙 없이 실행된다", async () => {
    expect(METADATA_ONLY_TOOLS.has("set_tile_metadata")).toBe(true);
    const chat = scriptedChat([
      toolCallMsg("set_tile_metadata", { confirmedByUser: true, entries: [{ tile: 357, label: "벤치" }] }, "c1"),
      finalMsg("기록했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: boolean[] = [];
    await session.sendUserMessage("357은 벤치야", (e) => {
      if (e.type === "tool_call") events.push(e.result.ok);
    });
    expect(events).toEqual([true]);
  });
});

// 구조물 보호(집 삭제 방지): "집 주변 청소"가 집 자체를 지워버린 사고 방지.
// clear 에셋이 기존 구조물(집 등 지어진 타일)을 덮으면 confirmDestroy 없이는 거부한다.
describe("스펙 게이트 — 구조물 보호(집 삭제 방지)", () => {
  function projectWithHouse() {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 20 }).ok).toBe(true);
    // 집 (3,3) 6×7 → 점유 x∈[3,9), y∈[3,10)
    expect(runTool(ctx, "build_house", { mapId: "m1", origin: { x: 3, y: 3 }, width: 6, height: 7, material: "plaster" }).ok).toBe(true);
    return ctx.project;
  }

  it("builtCellsInRegions는 지어진 칸만 센다(빈 잔디 0, 집 위 다수)", () => {
    const project = projectWithHouse();
    const map = project.maps.m1;
    expect(builtCellsInRegions(map, [{ mapId: "m1", x: 12, y: 12, w: 5, h: 5 }]).count).toBe(0);
    expect(builtCellsInRegions(map, [{ mapId: "m1", x: 3, y: 3, w: 6, h: 7 }]).count).toBeGreaterThan(6);
  });

  it("집을 덮는 clear 에셋은 confirmDestroy 없이는 거부된다(구조물 언급)", () => {
    const project = projectWithHouse();
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "청소", kind: "clear", x: 3, y: 3, w: 8, h: 7 }] };
    const issues = validateBuildSpec(project, spec);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("구조물") && i.message.includes("청소"))).toBe(true);
  });

  it("구조물보다 +1칸 넓힌 clear도 slack 예외 없이 confirmDestroy 없이는 거부", () => {
    const project = projectWithHouse();
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "주변청소", kind: "clear", x: 2, y: 2, w: 8, h: 9 }] };
    const issues = validateBuildSpec(project, spec);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("구조물") && i.message.includes("confirmDestroy"))).toBe(true);
    expect(issues.some((i) => i.message.includes("slack 허용"))).toBe(false);
  });

  it("confirmDestroy:true면 철거 의도로 인정되어 통과", () => {
    const project = projectWithHouse();
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "철거", kind: "clear", x: 3, y: 3, w: 6, h: 7, confirmDestroy: true }] };
    expect(validateBuildSpec(project, spec).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("빈터를 청소하는 것은 통과(구조물 없음)", () => {
    const project = projectWithHouse();
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "청소", kind: "clear", x: 12, y: 12, w: 5, h: 5 }] };
    expect(validateBuildSpec(project, spec).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("집을 덮지 않는 '주변만' 청소는 통과", () => {
    const project = projectWithHouse();
    // 집 오른쪽 인접 열(10,3) 3×7 — footprint(x<9)와 겹치지 않는 빈 잔디
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "주변", kind: "clear", x: 10, y: 3, w: 3, h: 7 }] };
    expect(validateBuildSpec(project, spec).filter((i) => i.severity === "error")).toEqual([]);
  });
});

// 배치 전 정리 확인(사용자 요청): 타일/구조물을 놓을 영역·주변에 기본 타일이 아닌 것이 있으면
// 그냥 덮지 말고 사용자에게 정리 여부를 물은 뒤 overExisting을 선언해야 통과한다.
describe("스펙 게이트 — 배치 전 주변 정리 확인", () => {
  function projectWithHouse() {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 20 }).ok).toBe(true);
    expect(runTool(ctx, "build_house", { mapId: "m1", origin: { x: 3, y: 3 }, width: 6, height: 7, material: "plaster" }).ok).toBe(true);
    return ctx.project;
  }

  it("기존 구조물 위/근처에 배치하려는 비-clear 에셋은 overExisting 없이는 거부(정리 확인 유도)", () => {
    const project = projectWithHouse();
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "새집", kind: "house", x: 3, y: 3, w: 6, h: 7 }] };
    const issues = validateBuildSpec(project, spec);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("overExisting") && i.message.includes("정리"))).toBe(true);
  });

  it("overExisting을 선언하면(사용자에게 확인함) 통과", () => {
    const project = projectWithHouse();
    const keep: BuildSpec = { mapId: "m1", assets: [{ id: "새집", kind: "house", x: 3, y: 3, w: 6, h: 7, overExisting: "keep" }] };
    expect(validateBuildSpec(project, keep).filter((i) => i.severity === "error")).toEqual([]);
    const clear: BuildSpec = { mapId: "m1", assets: [{ id: "새집", kind: "house", x: 3, y: 3, w: 6, h: 7, overExisting: "clear" }] };
    expect(validateBuildSpec(project, clear).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("빈 잔디에 배치는 정리 확인 없이 통과", () => {
    const project = projectWithHouse();
    const spec: BuildSpec = { mapId: "m1", assets: [{ id: "새집", kind: "house", x: 12, y: 11, w: 6, h: 7 }] };
    expect(validateBuildSpec(project, spec).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("같은 스펙에 clear 에셋으로 정리를 명시하면 배치 에셋은 통과", () => {
    const project = projectWithHouse();
    const spec: BuildSpec = {
      mapId: "m1",
      assets: [
        { id: "철거", kind: "clear", x: 3, y: 3, w: 6, h: 7, confirmDestroy: true },
        { id: "새집", kind: "house", x: 3, y: 3, w: 6, h: 7, layer: "upper" },
      ],
    };
    // clear가 배치 영역을 덮으므로 배치 에셋은 overExisting 불필요(단, 겹침은 layer로 허용).
    expect(validateBuildSpec(project, spec).filter((i) => i.severity === "error")).toEqual([]);
  });
});

// 비전 주입(BUG C, 유지): show_tiles/show_tile_grid 결과 뒤에 렌더된 이미지를 user 메시지로 주입해
// 비전 모델이 실제로 타일을 '보고' 판단하게 한다(렌더러 없으면 텍스트 전용으로 무해).
describe("비전 이미지 주입(유지)", () => {
  it("show_tiles 실행 뒤 이미지 파트를 담은 user 메시지가 주입된다", async () => {
    const chat = scriptedChat([
      toolCallMsg("show_tiles", { tileIds: [0] }, "c1"),
      finalMsg("타일 0을 확인했습니다."),
    ]);
    const renderImages = async () => [{ dataUrl: "data:image/png;base64,AAAA", label: "타일 0" }];
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat, renderImages });
    await session.sendUserMessage("타일 0 보여줘", () => {});
    const messages = session.getMessages();
    const toolIndex = messages.findIndex((m) => m.role === "tool" && m.name === "show_tiles");
    expect(toolIndex).toBeGreaterThan(-1);
    const injected = messages[toolIndex + 1];
    expect(injected.role).toBe("user");
    const parts = injected.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.some((p) => p.type === "image_url" && p.image_url?.url === "data:image/png;base64,AAAA")).toBe(true);
  });

  it("렌더러가 없으면 이미지 주입 없이 텍스트 전용으로 동작한다", async () => {
    const chat = scriptedChat([
      toolCallMsg("show_tiles", { tileIds: [0] }, "c1"),
      finalMsg("확인했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    await session.sendUserMessage("타일 0 보여줘", () => {});
    expect(session.getMessages().some((m) => Array.isArray(m.content))).toBe(false);
  });
});
