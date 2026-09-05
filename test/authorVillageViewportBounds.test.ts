// "여기에 마을 깔아줘" = 사용자가 보고 있는 화면에 마을. 실행 경계에서 구체적인 bounds 를
// 기록해 프리뷰·적용·감사 재생이 카메라 이동과 무관하게 같은 영역을 시공하는지 검증한다.
import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { AiConfig, ChatResult } from "@/ai/llmClient";
import { createAuthorVillageTool } from "@/editor/tools/authorVillageTool";
import { viewportVillageBounds } from "@/editor/tools/authorVillageSupport";
import { setEditorMapViewport } from "@/editor/editorMapViewport";
import { buildVillageDomain, inspectVillageBuild, type VillageBuildDomainArgs } from "@/editor/tools/villageBuilder";
import { MIN_SIZE } from "@/editor/tools/village/constants";
import type { ToolResult } from "@/editor/tools/types";
import type { GameMap, Project } from "@/project/types";
import { createExistingProject, EXISTING_TARGET, runFacade } from "./authorVillageFacadeFixtures";

afterEach(() => {
  setEditorMapViewport(null);
});

/** build 의존성만 감싸 실제 시공을 그대로 돌리면서 bounds 를 기록한다. */
function runWithRecordedBounds(project: Project): {
  readonly result: ToolResult;
  readonly calls: readonly VillageBuildDomainArgs[];
} {
  const calls: VillageBuildDomainArgs[] = [];
  const tool = createAuthorVillageTool({
    build(draft, args) {
      calls.push(args);
      return buildVillageDomain(draft, args);
    },
    inspect: inspectVillageBuild,
  });
  const result = runFacade(project, {
    target: EXISTING_TARGET,
    houseCount: 2,
    countPolicy: "exact",
    seed: 7,
    interior: false,
  }, tool);
  return { result, calls };
}

function publishViewport(mapId: string, centerX: number, centerY: number): void {
  setEditorMapViewport({ mapId, centerX, centerY, x: centerX - 8, y: centerY - 8, w: 16, h: 16 });
}

function changedCellIndexes(before: GameMap, after: GameMap): number[] {
  const changed: number[] = [];
  for (let index = 0; index < before.lowerTiles.length; index += 1) {
    if (before.lowerTiles[index] !== after.lowerTiles[index] || before.upperTiles[index] !== after.upperTiles[index]) {
      changed.push(index);
    }
  }
  return changed;
}

const SESSION_CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "x",
  model: "viewport-test-model",
  liteModel: "viewport-test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 4096,
  agentMode: "chat",
};

describe("viewportVillageBounds", () => {
  it("뷰포트 중심을 최소 한 변(minSpan) 사각형의 가운데로 둔다", () => {
    expect(viewportVillageBounds({ mapId: "m1", centerX: 60, centerY: 40 }, { width: 200, height: 200 }, 20))
      .toEqual({ x: 50, y: 30, w: 20, h: 20 });
  });

  it("맵 모서리 근처 중심은 맵 안으로 밀어 넣는다", () => {
    expect(viewportVillageBounds({ mapId: "m1", centerX: 2, centerY: 2 }, { width: 200, height: 200 }, 20))
      .toEqual({ x: 0, y: 0, w: 20, h: 20 });
    expect(viewportVillageBounds({ mapId: "m1", centerX: 198, centerY: 199 }, { width: 200, height: 200 }, 20))
      .toEqual({ x: 180, y: 180, w: 20, h: 20 });
  });

  it("맵이 minSpan 보다 작으면 맵 크기로 줄인다", () => {
    expect(viewportVillageBounds({ mapId: "m1", centerX: 6, centerY: 6 }, { width: 12, height: 12 }, 20))
      .toEqual({ x: 0, y: 0, w: 12, h: 12 });
    expect(viewportVillageBounds({ mapId: "m1", centerX: 6, centerY: 40 }, { width: 12, height: 200 }, 20))
      .toEqual({ x: 0, y: 30, w: 12, h: 20 });
  });
});

describe("author_village + 뷰포트 bounds", () => {
  it("실행 경계가 기록한 bounds 는 카메라가 움직여도 같은 영역을 다시 시공한다", async () => {
    const baseline = createExistingProject(50);
    let viewport = { mapId: "map_existing", centerX: 34, centerY: 34, x: 26, y: 26, w: 16, h: 16 };
    publishViewport(viewport.mapId, viewport.centerX, viewport.centerY);
    let round = 0;
    const chat = async (): Promise<ChatResult> => {
      round += 1;
      if (round === 1) {
        return {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call_author_village",
              type: "function",
              function: {
                name: "author_village",
                arguments: JSON.stringify({
                  target: EXISTING_TARGET,
                  houseCount: 2,
                  countPolicy: "exact",
                  seed: 7,
                  interior: false,
                }),
              },
            }],
          },
          finishReason: "tool_calls",
        };
      }
      return { message: { role: "assistant", content: "완료" }, finishReason: "stop" };
    };
    const session = new AssistantSession(baseline, {
      config: SESSION_CONFIG,
      chat,
      contextOptions: {
        getCurrentMapId: () => "map_existing",
        getViewport: () => viewport,
      },
    });

    const turn = await session.sendUserMessage(
      "여기에 마을을 지어줘\n\n[컨텍스트] 현재 맵: Existing village (map_existing) · 사용자 선택 영역: (24,24) 20×20",
    );
    const recordedArgs = turn.proposedCalls[0]?.args;
    expect(recordedArgs?.target).toEqual({
      ...EXISTING_TARGET,
      bounds: { x: 24, y: 24, w: MIN_SIZE, h: MIN_SIZE },
    });

    const first = structuredClone(baseline);
    const firstBefore = structuredClone(first.maps.map_existing);
    const firstResult = runFacade(first, recordedArgs ?? {});
    expect(firstResult.ok, `${firstResult.summary} ${JSON.stringify(firstResult.issues ?? [])}`).toBe(true);

    viewport = { mapId: "map_existing", centerX: 10, centerY: 10, x: 2, y: 2, w: 16, h: 16 };
    publishViewport(viewport.mapId, viewport.centerX, viewport.centerY);
    const second = structuredClone(baseline);
    const secondBefore = structuredClone(second.maps.map_existing);
    const secondResult = runFacade(second, recordedArgs ?? {});
    expect(secondResult.ok, `${secondResult.summary} ${JSON.stringify(secondResult.issues ?? [])}`).toBe(true);

    const firstRegion = changedCellIndexes(firstBefore, first.maps.map_existing);
    const secondRegion = changedCellIndexes(secondBefore, second.maps.map_existing);
    expect(firstRegion.length).toBeGreaterThan(0);
    expect(secondRegion).toEqual(firstRegion);
  }, 30_000);

  it.each(["target", "root"])("%s 의 fullMap:true는 뷰포트 20×20 보정에 축소되지 않는다", async (location) => {
    const baseline = createExistingProject(30);
    let round = 0;
    const args = {
      target: { ...EXISTING_TARGET, ...(location === "target" ? { fullMap: true } : {}) },
      ...(location === "root" ? { fullMap: true } : {}),
      houseCount: 2, countPolicy: "exact", seed: 7, interior: false, npcCount: 0,
    };
    const session = new AssistantSession(baseline, {
      config: SESSION_CONFIG,
      contextOptions: { getCurrentMapId: () => "map_existing", getViewport: () => ({ mapId: "map_existing", centerX: 15, centerY: 15, x: 7, y: 7, w: 16, h: 16 }) },
      chat: async (): Promise<ChatResult> => round++ === 0 ? {
        message: { role: "assistant", content: null, tool_calls: [{ id: "full_map", type: "function", function: {
          name: "author_village", arguments: JSON.stringify(args),
        } }] }, finishReason: "tool_calls",
      } : { message: { role: "assistant", content: "마을을 구성했습니다." }, finishReason: "stop" },
    });
    await session.sendUserMessage("맵 전체에 마을을 지어줘\n\n[컨텍스트] 현재 맵: Existing village (map_existing) · 사용자 선택 영역: (0,0) 30×30");
    const entry = session.getAuditEntries().find((entry) => entry.kind === "tool" && entry.name === "author_village");
    expect(entry?.kind === "tool" && entry.ok, entry?.kind === "tool" ? entry.summary : "호출 없음").toBe(true);
    expect(entry?.kind === "tool" ? entry.args.target : null).toEqual(args.target);
    const map = session.getProposedProject().maps.map_existing;
    expect(changedCellIndexes(baseline.maps.map_existing, map).some((index) => index % map.width < 5 || index % map.width >= 25)).toBe(true);
  }, 30_000);

  it("도구에 bounds 가 없으면 기존 전체 재포장 동작이 그대로다", () => {
    const project = createExistingProject(50);
    publishViewport("map_existing", 34, 34);

    const { result, calls } = runWithRecordedBounds(project);

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(calls[0].bounds).toBeUndefined();
    expect((result.diff?.warnings ?? []).some((entry) => entry.includes("bounds 를 생략해"))).toBe(true);
  });
});
