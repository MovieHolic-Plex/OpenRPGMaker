import { describe, expect, it } from "vitest";
import type { TurnResult } from "@/ai/assistantSession";
import {
  buildRegionTaskLogExport,
  runRegionTask,
  serializeRegionTaskLog,
  type RegionTaskDeps,
  type RegionTaskSessionLike,
} from "@/editor/regionTask/runRegionTask";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

const MAP_ID = "map_region_log";
const REGION: RegionRect = { x: 1, y: 1, width: 4, height: 4 };

function baseProject(): Project {
  const context = { project: createBlankProject() };
  expect(runTool(context, "create_map", { id: MAP_ID, name: "로그맵", width: 12, height: 12 }).ok).toBe(true);
  context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
  context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
  return context.project;
}

describe("region task log export", () => {
  it("buildRegionTaskLogExport serializes audit and ui events", () => {
    const log = buildRegionTaskLogExport({
      mapId: MAP_ID,
      mapName: "로그맵",
      region: REGION,
      instruction: "나무 2개",
      composedMessage: "나무 2개\n\n[컨텍스트]",
      result: {
        ok: true,
        applied: true,
        changedCells: 4,
        changedEvents: 0,
        clippedCells: 0,
        proposedCalls: 1,
        assistantText: "완료",
      },
      turn: {
        assistantText: "완료",
        proposedCalls: [
          {
            name: "place_props",
            args: { mapId: MAP_ID, count: 2 },
            summary: "소품 2",
            result: { ok: true, summary: "소품 2" },
            destructive: false,
          },
        ],
        stoppedReason: "final",
      },
      uiEvents: [{ at: "2026-01-01T00:00:00.000Z", type: "tool_call", text: "place_props", toolName: "place_props", toolOk: true }],
      session: {
        async sendUserMessage() {
          return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
        },
        getProposedProject: () => baseProject(),
        getAuditEntries: () => [{ kind: "user", text: "나무 2개", at: "2026-01-01T00:00:00.000Z" }],
        getHarnessSnapshot: () => ({
          model: "test-model",
          maxTokens: 1024,
          messages: [{ role: "user", content: "나무 2개" }],
          audit: [],
        }),
      },
    });
    expect(log.kind).toBe("region-task-log");
    expect(log.toolCalls).toHaveLength(1);
    expect(log.audit[0]?.kind).toBe("user");
    expect(log.harness?.model).toBe("test-model");
    const json = serializeRegionTaskLog(log);
    expect(json).toContain("region-task-log");
    expect(json).toContain("place_props");
  });

  it("runRegionTask attaches log with uiEvents from onEvent stream", async () => {
    const base = baseProject();
    const proposed = structuredClone(base);
    // mark a cell change inside region so apply happens
    proposed.maps[MAP_ID].upperTiles[2 * 12 + 2] = 260;

    const turn: TurnResult = {
      assistantText: "영역 완료",
      proposedCalls: [],
      stoppedReason: "final",
    };
    const session: RegionTaskSessionLike = {
      async sendUserMessage(_text, onEvent) {
        onEvent?.({ type: "status", text: "진행" });
        onEvent?.({
          type: "tool_call",
          name: "place_props",
          args: { mapId: MAP_ID, count: 1 },
          result: { ok: true, summary: "배치" },
        });
        return turn;
      },
      getProposedProject: () => proposed,
      getAuditEntries: () => [{ kind: "tool", name: "place_props", args: {}, ok: true, summary: "배치" }],
      getHarnessSnapshot: () => ({ model: "lite", maxTokens: 512, messages: [], audit: [] }),
    };
    const deps: RegionTaskDeps = {
      getProject: () => base,
      applyProject: () => undefined,
      createSession: () => session,
    };
    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "나무" },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(result.log).toBeDefined();
    expect(result.log?.uiEvents.some((event) => event.type === "tool_call" && event.toolName === "place_props")).toBe(true);
    expect(result.log?.audit.some((entry) => entry.kind === "tool")).toBe(true);
    expect(result.log?.harness?.model).toBe("lite");
  });
});
