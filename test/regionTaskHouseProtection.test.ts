import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import * as history from "@/editor/mapEditHistory";
import { getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { composePartialProject } from "@/editor/regionTask/partialApplyCompose";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import { applyRegionProjectWithHistory, runRegionTask } from "@/editor/regionTask/runRegionTask";
import { runTool } from "@/editor/tools";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { houseMap } from "./fixtures/completedHouse";
import { fixedDeclarer } from "./intentFixture";

const REGION = { x: 0, y: 0, width: 2, height: 2 };

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const ctx = { project: createBlankProject() };
  ctx.project.startPos = { x: 0, y: 0 };
  houseMap(ctx.project).lowerTiles.fill(240);
  houseMap(ctx.project).upperTiles.fill(-1);
  const built = runTool(ctx, "author_house", {
    kind: "single", mapId: ctx.project.startMapId, kitId: "blue-stone",
    wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: "exterior-only", yard: [],
  });
  expect(built.ok, JSON.stringify(built.issues)).toBe(true);
  store.replace(ctx.project);
  // Accepted human terrain on the protected north ridge is the baseline, not the original kit.
  store.update((draft) => {
    const map = houseMap(draft);
    map.lowerTiles[map.width + 2] = 421;
  }, { scope: "project", origin: "human" });
  history.resetMapEditHistory();
});

afterEach(() => {
  getPendingRegionApply()?.discard();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function proposeRegion(region = REGION) {
  const result = await runRegionTask({
    mapId: store.getCurrent().startMapId, region, instruction: "paint_tiles", mode: "polish", gate: "approval",
  }, {
    getProject: () => store.getCurrent(),
    applyProject: applyRegionProjectWithHistory,
    createSession: (project, mapId) => {
      let wrote = false;
      return new AssistantSession(project, {
        config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "test", apiKey: "test", maxToolCalls: 4, maxTokens: 1024 },
        contextOptions: { currentMapId: mapId },
        declareIntent: fixedDeclarer({ mode: "modify", space: "outdoor", useSelection: true, tools: ["paint_tiles"] }),
        yieldToUi: async () => {},
        chat: async (): Promise<ChatResult> => {
          if (wrote) return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
          wrote = true;
          return { message: { role: "assistant", content: null, tool_calls: [{
            id: "paint", type: "function", function: { name: "paint_tiles", arguments: JSON.stringify({
              mapId, mode: "cells", layer: "upper", tile: 237, cells: [{ x: region.x + 1, y: region.y + 1 }],
            }) },
          }] }, finishReason: "tool_calls" };
        },
      });
    },
  });
  expect(result.ok, result.error).toBe(true);
  expect(result.applied).toBe(false);
  expect(result.proposedCalls).toBe(1);
  expect(result.log?.toolCalls).toMatchObject([{ name: "paint_tiles", ok: true }]);
  expect(result.changedCells).toBe(1);
  const pending = result.pending;
  if (!pending) throw new Error("Missing real region approval");
  expect(getPendingRegionApply()).toBe(pending);
  return { result, pending };
}

function observeApplication() {
  return {
    snapshot: vi.spyOn(history, "recordProjectSnapshot"),
    replace: vi.spyOn(store, "replace"),
  };
}

function expectNoApplication(before: Project, observed: ReturnType<typeof observeApplication>): void {
  expect(store.getCurrent()).toBe(before);
  expect(serialize(store.getCurrent())).toBe(serialize(before));
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
  expect(observed.snapshot).not.toHaveBeenCalled();
  expect(observed.replace).not.toHaveBeenCalled();
}

for (const approval of ["full", "partial"] as const) {
  describe(`real region polish ${approval} approval`, () => {
    it("rejects protected seam changes when the store has not changed", async () => {
      // Given: only the registered tool's safe upper paint is requested outside the house.
      const before = store.getCurrent();
      const beforeBytes = serialize(before);
      const { result, pending } = await proposeRegion();
      const map = houseMap(pending.clippedProject);
      expect(result.seamCells).toBe(1);
      expect(map.lowerTiles[map.width + 2]).toBe(360);
      expect(serialize(store.getCurrent())).toBe(beforeBytes);
      const groups = groupRegionChanges(before, pending.clippedProject, map.id, REGION);
      const requested = composePartialProject({
        base: before, clipped: pending.clippedProject, mapId: map.id, region: REGION,
        selectedChunkIds: groups.upper.map((chunk) => chunk.id), groups,
      });
      // Partial selection excludes the ridge, but approval's real review polishes it again.
      expect(houseMap(requested).lowerTiles[map.width + 2]).toBe(421);
      const observed = observeApplication();

      // When
      const outcome = approval === "full" ? pending.apply() : pending.applyProject(requested);

      // Then: reject the entire candidate, not just the seam or its undo record.
      expect(outcome.ok).toBe(false);
      expect(outcome.applied).toBe(false);
      expect(outcome.error).toBeTruthy();
      expect(pending.lastApplyError).toBe(outcome.error);
      expect(pending.settled).toBe(false);
      expectNoApplication(before, observed);
      expect(serialize(store.getCurrent())).toBe(beforeBytes);
      expect(houseMap(store.getCurrent()).lowerTiles[map.width + 2]).toBe(421);
      expect(houseMap(store.getCurrent()).upperTiles[map.width + 1]).toBe(-1);
    });

    it("applies an unrelated outside edit when accepted house values remain unchanged", async () => {
      // Given: the same human-edited house, but the selected region is away from its ridge.
      const region = { x: 10, y: 10, width: 2, height: 2 };
      const before = store.getCurrent();
      const protectedBefore = captureHouseProtection(before);
      const { pending } = await proposeRegion(region);
      const mapId = before.startMapId;
      const groups = groupRegionChanges(before, pending.clippedProject, mapId, region);
      const requested = composePartialProject({
        base: before, clipped: pending.clippedProject, mapId, region,
        selectedChunkIds: groups.upper.map((chunk) => chunk.id), groups,
      });
      const observed = observeApplication();

      // When
      const outcome = approval === "full" ? pending.apply() : pending.applyProject(requested);

      // Then
      expect(outcome).toEqual({ ok: true, applied: true });
      expect(pending.settled).toBe(true);
      expect(getPendingRegionApply()).toBeNull();
      expect(captureHouseProtection(store.getCurrent())).toEqual(protectedBefore);
      const map = houseMap(store.getCurrent());
      expect(map.upperTiles[11 * map.width + 11]).toBe(237);
      expect(history.getMapEditHistoryEntries()).toHaveLength(1);
      expect(observed.snapshot).toHaveBeenCalledTimes(1);
      expect(observed.replace).toHaveBeenCalledTimes(1);
    });
  });
}

describe("final region application uses the current store", () => {
  it.each(["lowerTiles", "upperTiles", "lowerTileStacks", "upperTileStacks", "new-house"] as const)(
    "rejects stale %s candidates before history or replacement",
    (change) => {
      // Given: a detached safe candidate predating an accepted human change.
      const proposed = structuredClone(store.getCurrent());
      houseMap(proposed).upperTiles[11 * houseMap(proposed).width + 11] = 237;
      store.update((draft) => {
        const map = houseMap(draft);
        const index = map.width + 2;
        switch (change) {
          case "lowerTiles": case "upperTiles": map[change][index] = 199; break;
          case "lowerTileStacks": case "upperTileStacks": map[change] = { [index]: [199, 322] }; break;
          case "new-house": map.layoutPlan?.regions.push({ id: "human-house", role: "house", label: "House", x: 15, y: 15, w: 4, h: 4 }); break;
        }
      }, { scope: "project", origin: "human" });
      const before = store.getCurrent();
      const observed = observeApplication();

      // When / Then
      expect(() => applyRegionProjectWithHistory(proposed, "Region", before.startMapId))
        .toThrow(expect.objectContaining({ code: "protected-house-write" }));
      expectNoApplication(before, observed);
    },
  );
});
