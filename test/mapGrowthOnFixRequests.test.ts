// 「맵을 고쳐달라」는 요청에서 맵 크기가 변수가 되게 하는 네 지점의 회귀 게이트 (2026-09-15).
//
// 진단: resize_map 도구는 내내 있었고 core 로 상시 노출돼 있었는데도, 수정 요청이 맵 크기를 한 번도
// 바꾸지 않았다. 네 계층이 같은 방향으로 막고 있었다.
//  1. buildSpec  — 기존 맵은 경계 검증이 map.width 로 고정이고 plannedMap 은 "없는 맵" 에만 유효했다.
//                  "키우고 거기에 놓겠다" 는 밑그림을 제출할 방법 자체가 없었다.
//  2. specGate   — 거부 문구가 전부 "영역을 좁히세요" 로만 안내해, 모델의 최소 수리는 늘 축소였다.
//  3. author_village — 기존 맵 성장 목표가 MIN_BOUNDS_SIZE(16, 도구 최소치)라 집 20채도 우겨넣었다.
//  4. intentDeclaration — 문장의 수량을 크기로 바꾸는 유일한 환산기가 호출자 0인 죽은 코드였다.
// 2026-09-17: 밑그림 스펙 게이트 해체 — 「밑그림 없는 차단 초안」 테스트는 사라진 차단(2번 계층)을 재던 것이라 삭제. 맵 밖 쓰기는 도구 자체의 out-of-bounds 로 거부된다.
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { plannedGrowthForSpec, validateBuildSpec, type BuildSpec } from "@/ai/buildSpec";
import { formatIntentNote, parseIntentDeclaration, INTENT_SYSTEM_PROMPT, type IntentFacts } from "@/ai/intentDeclaration";
import { estimateVillageSize } from "@/ai/constructionDeclaration";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

type ChatResult = import("@/ai/llmClient").ChatResult;

const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 };

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

/** 20×20 맵 m1 하나가 있는 프로젝트. */
function projectWithMap(width = 20, height = 20): Project {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "m1", name: "고칠 맵", width, height });
  expect(created.ok, created.summary).toBe(true);
  return ctx.project;
}

const FACTS: IntentFacts = {
  userText: "이 마을 더 크게 넓혀줘",
  currentMap: { id: "map_town", name: "마을" },
  selection: null,
  maps: [{ id: "map_town", name: "마을" }],
  facilityLabels: [],
  toolNames: ["author_village", "resize_map"],
  hasActivePlan: false,
};

describe("1. buildSpec — 기존 맵도 확장 plannedMap 을 선언할 수 있다", () => {
  it("현재 크기보다 큰 plannedMap 은 경계 기준이 되어 맵 밖 에셋을 통과시킨다", () => {
    // Given: 20×20 기존 맵과, 40×40 으로 키운 뒤 (24,24) 에 마을을 놓겠다는 밑그림.
    const project = projectWithMap();
    const spec: BuildSpec = {
      mapId: "m1",
      plannedMap: { mapId: "m1", width: 40, height: 40 },
      assets: [{ id: "확장 마을", kind: "village", x: 24, y: 24, w: 14, h: 14 }],
    };

    // When/Then: 확장 선언이 경계 기준이 되어 통과한다. 선언이 없으면 같은 에셋이 거부된다.
    expect(validateBuildSpec(project, spec).filter((issue) => issue.severity === "error")).toEqual([]);
    const withoutPlan = validateBuildSpec(project, { mapId: "m1", assets: spec.assets });
    expect(withoutPlan.some((issue) => issue.code === "spec-asset-out-of-map")).toBe(true);
  });

  it("현재 크기보다 작은 plannedMap 은 거부된다 — 축소는 resize_map 의 이벤트 가드를 지나야 한다", () => {
    // Given: 20×20 맵을 12×12 로 줄이겠다는 밑그림.
    const project = projectWithMap();
    const issues = validateBuildSpec(project, {
      mapId: "m1",
      plannedMap: { mapId: "m1", width: 12, height: 12 },
      assets: [{ id: "작은 마을", kind: "village", x: 0, y: 0, w: 10, h: 10 }],
    });

    // Then: 축소 선언은 전용 코드로 거부되고, 안내는 resize_map 을 직접 부르라고 말한다.
    const shrink = issues.find((issue) => issue.code === "spec-planned-shrink");
    expect(shrink).toBeDefined();
    expect(shrink!.message).toContain("resize_map");
    // 잘못된 선언이 경계 검증까지 꺼뜨리면 안 된다 — 현재 크기로 계속 잰다.
    expect(validateBuildSpec(project, {
      mapId: "m1",
      plannedMap: { mapId: "m1", width: 12, height: 12 },
      assets: [{ id: "밖", kind: "village", x: 18, y: 18, w: 8, h: 8 }],
    }).some((issue) => issue.code === "spec-asset-out-of-map")).toBe(true);
  });

  it("plannedGrowthForSpec 이 필요한 크기를 계산한다 — 확장이 필요 없으면 null", () => {
    expect(plannedGrowthForSpec({ width: 20, height: 20 }, {
      assets: [{ id: "a", kind: "village", x: 10, y: 4, w: 24, h: 10 }],
    })).toEqual({ width: 34, height: 20 });
    expect(plannedGrowthForSpec({ width: 20, height: 20 }, {
      assets: [{ id: "a", kind: "village", x: 2, y: 2, w: 8, h: 8 }],
    })).toBeNull();
    // 상한(256) 을 넘는 요구는 확장으로 풀지 않는다 — 좌표가 틀린 것이다.
    expect(plannedGrowthForSpec({ width: 20, height: 20 }, {
      assets: [{ id: "a", kind: "village", x: 0, y: 0, w: 900, h: 10 }],
    })).toBeNull();
  });
});

describe("2. specGate — 맵이 작아서 막힐 때 resize_map 경로를 실어 보낸다", () => {
  it("맵 밖 에셋으로 거부된 set_build_spec 도 확장 경로를 안내한다", async () => {
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", {
        mapId: "m1",
        assets: [{ id: "마을", kind: "village", x: 4, y: 4, w: 40, h: 30 }],
      }, "c1"),
      finalMsg("크기를 다시 잡겠습니다."),
    ]);
    const session = new AssistantSession(projectWithMap(), { config: CONFIG, chat });
    const results: Array<{ name: string; ok: boolean; issues: string }> = [];

    await session.sendUserMessage("이 맵에 마을 지어줘", (event) => {
      if (event.type === "tool_call") {
        results.push({ name: event.name, ok: event.result.ok, issues: JSON.stringify(event.result.issues ?? []) });
      }
    });

    const rejected = results.find((result) => result.name === "set_build_spec");
    expect(rejected?.ok).toBe(false);
    // 4+40=44, 4+30=34 가 필요한 크기다 — 코드가 계산해 준다.
    expect(rejected!.issues).toContain("width:44");
    expect(rejected!.issues).toContain("height:34");
    expect(rejected!.issues).toContain("resize_map");
  });

  it("키운 뒤에는 같은 밑그림이 통과한다 — 막힘→확장→시공이 한 경로로 이어진다", async () => {
    // Given: resize_map 으로 키우고, 그 크기를 plannedMap 으로 선언한 뒤 집을 짓는 순서.
    const chat = scriptedChat([
      toolCallMsg("resize_map", { mapId: "m1", width: 40, height: 40 }, "c1"),
      toolCallMsg("set_build_spec", {
        mapId: "m1",
        plannedMap: { mapId: "m1", width: 40, height: 40 },
        assets: [{ id: "집", kind: "house", x: 22, y: 22, w: 8, h: 8 }],
      }, "c2"),
      toolCallMsg("build_house", { mapId: "m1", x: 22, y: 22, width: 8, height: 8, material: "plaster" }, "c3"),
      finalMsg("맵을 40×40 으로 키우고 집을 지었습니다."),
    ]);
    const session = new AssistantSession(projectWithMap(), { config: CONFIG, chat });
    const results: Array<{ name: string; ok: boolean; summary: string }> = [];

    await session.sendUserMessage("맵 넓히고 집 지어줘", (event) => {
      if (event.type === "tool_call") results.push({ name: event.name, ok: event.result.ok, summary: event.result.summary });
    });

    // Then: 세 호출이 모두 성공하고 맵이 실제로 커진다.
    expect(results.map((result) => [result.name, result.ok])).toEqual([
      ["resize_map", true], ["set_build_spec", true], ["build_house", true],
    ]);
    const map = session.getProposedProject().maps.m1;
    expect([map!.width, map!.height]).toEqual([40, 40]);
  });
});

describe("4. intentDeclaration — 문장의 규모가 크기로 환산돼 모델에게 돌아간다", () => {
  it("프롬프트가 construction 을 요구하고 파서가 받는다", () => {
    expect(INTENT_SYSTEM_PROMPT).toContain("\"construction\"");
    const raw = JSON.stringify({
      mode: "modify", space: "outdoor", targetMapId: "map_town", tools: [],
      construction: { scale: "large", houseCount: 20, npcCount: 8, targetName: "큰 마을" },
      summary: "마을 확장",
    });
    expect(parseIntentDeclaration(raw, FACTS).intent?.construction).toEqual({
      scale: "large", houseCount: 20, npcCount: 8, targetName: "큰 마을",
    });
  });

  it("질문(mode=question)에는 시공 규모가 붙지 않는다", () => {
    const raw = JSON.stringify({ mode: "question", space: "none", tools: [], construction: { houseCount: 9 }, summary: "몇 채야?" });
    expect(parseIntentDeclaration(raw, FACTS).intent?.construction).toBeUndefined();
  });

  it("수정 요청에서 대상 맵이 작으면 resize_map 을 먼저 부르라고 못박는다", () => {
    // Given: 집 20채를 요구하는 수정 선언 + 30×30 인 실제 대상 맵.
    const size = estimateVillageSize({ houseCount: 20 });
    const note = formatIntentNote(
      {
        mode: "modify", space: "outdoor", facility: null, targetMapId: "map_town", useSelection: false,
        clarify: null, clarifyOptions: [], needsPlan: true, resetsContext: false, tools: [],
        construction: { houseCount: 20 }, summary: "마을 확장", source: "llm",
      },
      { targetMap: { id: "map_town", width: 30, height: 30 } },
    );

    // Then: 현재 크기·필요한 크기·호출까지 한 줄에 다 있다. 수량을 줄이라는 안내는 없다.
    expect(note).toContain(`${size.width}×${size.height}`);
    expect(note).toContain(`resize_map({mapId:"map_town", width:${size.width}, height:${size.height}})`);
    expect(note).toContain("우겨넣지 말 것");
  });

  it("대상 맵이 이미 충분히 크면 키우라고 하지 않는다", () => {
    const note = formatIntentNote(
      {
        mode: "modify", space: "outdoor", facility: null, targetMapId: "map_town", useSelection: false,
        clarify: null, clarifyOptions: [], needsPlan: true, resetsContext: false, tools: [],
        construction: { houseCount: 4 }, summary: "마을 손보기", source: "llm",
      },
      { targetMap: { id: "map_town", width: 120, height: 120 } },
    );
    expect(note).toContain("이미 충분하다");
    expect(note).not.toContain("resize_map(");
  });

  it("선언에 construction 이 없으면 시공 규모 노트도 없다 — 없는 수량을 발명하지 않는다", () => {
    const note = formatIntentNote(
      {
        mode: "modify", space: "outdoor", facility: null, targetMapId: "map_town", useSelection: false,
        clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: [],
        summary: "간판 글자 고쳐줘", source: "llm",
      },
      { targetMap: { id: "map_town", width: 30, height: 30 } },
    );
    expect(note).not.toContain("[시공 규모]");
  });
});
