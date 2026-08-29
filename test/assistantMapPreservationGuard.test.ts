// test/assistantMapPreservationGuard.test.ts
// "고쳐 달랬는데 새로 만들었다" 회귀 가드 — 세션 수준 종합(2026-08-29 modify 진단 P4).
//
// 개별 가드는 각자 테스트가 있다(roomHarnessOverwriteGuard, workItemOutcomeTargetMap,
// modifyIntent, approvalDestructiveOutcome). 이 파일은 **세션을 통과할 때** 그 가드들이
// 실제로 맵을 지켜 주는지, 그리고 모델이 우회할 길(같은 id 새 맵 / 세션 덮어쓰기)이
// 막혀 있는지를 본다.

import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

type ChatResult = import("@/ai/llmClient").ChatResult;

const CONFIG: import("@/ai/llmClient").AiConfig = {
  authMode: "apiKey",
  baseUrl: "x",
  model: "minimax/minimax-m3",
  apiKey: "sk",
  maxToolCalls: 12,
  maxTokens: 8192,
};
const BEDROOM_ID = "map_bedroom";

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (): Promise<ChatResult> => {
    if (index >= steps.length) throw new Error("scripted chat exhausted");
    return steps[index++]!;
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

/** 저작된 실내 맵(아래쪽 5줄 도배 + NPC 1명)이 있는 프로젝트. */
function projectWithBedroom(): Project {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: BEDROOM_ID, name: "침실", width: 16, height: 13 }).ok).toBe(true);
  const map = ctx.project.maps[BEDROOM_ID]!;
  // NPC 자리(3,3)는 남겨 둔다 — 12는 통행 불가라 그 위에는 NPC 를 놓을 수 없다.
  for (let index = 8 * 16; index < 13 * 16; index += 1) map.lowerTiles[index] = 12;
  const npc = runTool(ctx, "place_npc", {
    mapId: BEDROOM_ID,
    x: 3,
    y: 3,
    id: "npc_keepme",
    name: "지켜야 하는 주민",
    graphic: { transparent: true },
    pages: [{ lines: ["기존 대사"] }],
  });
  expect(npc.ok, npc.summary).toBe(true);
  return ctx.project;
}

const MODIFY_REQUEST = `이 침실 가구 배치 좀 고쳐줘\n\n[컨텍스트] 현재 맵: 침실 (${BEDROOM_ID}) · 사용자 선택 영역: (2,2) 10×8`;

async function runSession(project: Project, steps: readonly ChatResult[], text = MODIFY_REQUEST) {
  const session = new AssistantSession(project, {
    config: CONFIG,
    chat: scriptedChat(steps),
    contextOptions: { currentMapId: BEDROOM_ID },
  });
  const events: { name: string; ok: boolean; summary: string }[] = [];
  await session.sendUserMessage(text, (event) => {
    if (event.type === "tool_call") events.push({ name: event.name, ok: event.result.ok, summary: event.result.summary });
  });
  return { session, events };
}

describe("수정 요청에서 맵 보존", () => {
  it("기존 맵 id 로 방 세션을 시작하려 하면 거부되고 맵이 그대로 남는다", async () => {
    const project = projectWithBedroom();
    const before = Object.keys(project.maps).sort();

    const { session, events } = await runSession(project, [
      toolCallMsg("start_interior_room_session", {
        mapId: BEDROOM_ID,
        name: "침실",
        width: 16,
        height: 13,
        wings: [{ x: 2, y: 5, w: 12, h: 5 }],
        door: { x: 8, y: 9 },
        theme: "bedroom",
      }, "c1"),
      toolCallMsg("tile_erase", { mapId: BEDROOM_ID, rect: { x: 2, y: 9, w: 4, h: 2 } }, "c2"),
      finalMsg("가구 자리를 정리했습니다."),
    ]);

    const blocked = events.find((event) => event.name === "start_interior_room_session");
    expect(blocked?.ok).toBe(false);
    const proposed = session.getProposedProject();
    // 맵 집합 불변 + 기존 맵 크기·이벤트 보존.
    expect(Object.keys(proposed.maps).sort()).toEqual(before);
    expect(proposed.maps[BEDROOM_ID]?.width).toBe(16);
    expect(proposed.maps[BEDROOM_ID]?.events.some((event) => event.id === "npc_keepme")).toBe(true);
    // 거부 메시지는 대안을 제시한다 — 거부만 하면 다른 id 로 새 맵을 만들어 우회한다.
    const guidance = session.getMessages().find(
      (message) => message.role === "tool" && typeof message.content === "string" && message.content.includes("furnish_interior_space"),
    );
    expect(guidance).toBeDefined();
  });

  it("같은 id 로 create_map 하면 map-exists 로 거부되고 편집 경로를 안내한다", async () => {
    const project = projectWithBedroom();

    const { session, events } = await runSession(project, [
      toolCallMsg("create_map", { id: BEDROOM_ID, name: "침실 2", width: 20, height: 20 }, "c1"),
      finalMsg("기존 맵을 직접 고치겠습니다."),
    ]);

    const blocked = events.find((event) => event.name === "create_map");
    expect(blocked?.ok).toBe(false);
    expect(project.maps[BEDROOM_ID]?.width).toBe(16);
    const guidance = session.getMessages().find(
      (message) => message.role === "tool" && typeof message.content === "string" && message.content.includes("이미 존재하는 맵 id"),
    );
    expect(typeof guidance?.content === "string" && guidance.content).toContain("get_map_region");
  });

  it("같은 id 로 duplicate_map 하는 우회도 막힌다", async () => {
    const project = projectWithBedroom();

    const { session, events } = await runSession(project, [
      toolCallMsg("duplicate_map", { sourceMapId: BEDROOM_ID, newMapId: BEDROOM_ID, name: "침실 복제" }, "c1"),
      finalMsg("복제하지 않고 그 맵을 고치겠습니다."),
    ]);

    expect(events.find((event) => event.name === "duplicate_map")?.ok).toBe(false);
    expect(Object.keys(session.getProposedProject().maps).sort()).toEqual(Object.keys(project.maps).sort());
  });

  it("시스템 프롬프트가 현재 맵 id 와 대상 선택 규칙을 함께 싣는다", async () => {
    const project = projectWithBedroom();
    const { session } = await runSession(project, [finalMsg("무엇을 고칠까요?")]);

    const system = session.getMessages().find((message) => message.role === "system");
    expect(typeof system?.content).toBe("string");
    const prompt = String(system?.content);
    expect(prompt).toContain(BEDROOM_ID);
    expect(prompt).toContain("현재 맵 요약");
    expect(prompt).toContain("대상 선택");
    expect(prompt).toContain("furnish_interior_space");
  });

  it("정직한 수정(지우고 다시 놓기)은 그대로 통과한다", async () => {
    const project = projectWithBedroom();

    const { session, events } = await runSession(project, [
      toolCallMsg("tile_erase", { mapId: BEDROOM_ID, rect: { x: 2, y: 9, w: 4, h: 2 } }, "c1"),
      finalMsg("정리했습니다."),
    ]);

    const erase = events.find((event) => event.name === "tile_erase");
    expect(erase?.ok, erase?.summary).toBe(true);
    expect(Object.keys(session.getProposedProject().maps).sort()).toEqual(Object.keys(project.maps).sort());
  });
});
