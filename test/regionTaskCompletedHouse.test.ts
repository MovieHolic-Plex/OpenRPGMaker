import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import * as history from "@/editor/mapEditHistory";
import { getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { composePartialProject } from "@/editor/regionTask/partialApplyCompose";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import { applyRegionProjectWithHistory, runRegionTask } from "@/editor/regionTask/runRegionTask";
import type { RegionTaskOptions } from "@/editor/regionTask/runRegionTask";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import { houseMap } from "./fixtures/completedHouse";
import { fixedDeclarer } from "./intentFixture";

const BBOX_ONLY = { x: 2, y: 2, width: 6, height: 6 };
const WHOLE_HOUSE = { x: 2, y: 1, width: 6, height: 7 };

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  project.startPos = { x: 0, y: 0 };
  houseMap(project).lowerTiles.fill(240);
  houseMap(project).upperTiles.fill(-1);
  store.replace(project);
  history.resetMapEditHistory();
});

afterEach(() => {
  getPendingRegionApply()?.discard();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function houseTask(options: Pick<RegionTaskOptions, "region" | "gate" | "mode">) {
  let session: AssistantSession | undefined;
  return {
    run: () => runRegionTask({ mapId: store.getCurrent().startMapId, instruction: "author_house", ...options }, {
      getProject: () => store.getCurrent(),
      applyProject: applyRegionProjectWithHistory,
      createSession: (project, mapId) => {
        let wrote = false;
        session = new AssistantSession(project, {
          config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "test", apiKey: "test", maxToolCalls: 4, maxTokens: 1024 },
          contextOptions: { currentMapId: mapId },
          declareIntent: fixedDeclarer({ mode: "modify", space: "outdoor", useSelection: true, tools: ["author_house"] }),
          yieldToUi: async () => {},
          chat: async (): Promise<ChatResult> => {
            if (wrote) return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
            wrote = true;
            return { message: { role: "assistant", content: null, tool_calls: [{
              id: "house", type: "function", function: { name: "author_house", arguments: JSON.stringify({
                kind: "single", mapId, kitId: "bright-plaster", wings: [{ x: 2, y: 2, w: 6, h: 6 }],
                interior: "exterior-only", yard: [],
              }) },
            }] }, finishReason: "tool_calls" };
          },
        });
        return session;
      },
    }),
    completed: () => {
      if (!session) throw new Error("Missing real session");
      const proposed = session.getProposedProject();
      expect(captureHouseProtection(proposed)).toMatchObject([{ id: "house_1", source: "layout" }]);
      const map = houseMap(proposed);
      expect(map.upperTiles[map.width + 2]).toBe(354);
      expect(map.lowerTiles.slice(map.width + 3, map.width + 7)).toEqual([374, 374, 374, 374]);
      expect(map.upperTiles[map.width + 7]).toBe(355);
      return proposed;
    },
  };
}

function observeApplication() {
  const before = store.getCurrent();
  const bytes = serialize(before);
  const snapshot = vi.spyOn(history, "recordProjectSnapshot");
  const replace = vi.spyOn(store, "replace");
  return {
    rejected: () => {
      expect(store.getCurrent()).toBe(before);
      expect(serialize(store.getCurrent())).toBe(bytes);
      expect(history.getMapEditHistoryEntries()).toHaveLength(0);
      expect(snapshot).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
    accepted: () => {
      expect(history.getMapEditHistoryEntries()).toHaveLength(1);
      expect(snapshot).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledTimes(1);
    },
  };
}

for (const mode of ["task", "polish"] as const) {
  describe(`completed new region house (${mode})`, () => {
    for (const approval of ["full", "partial", "immediate"] as const) {
      it(`atomically rejects ${approval} application after clipping the north ridge`, async () => {
        // Given: a real successful author_house proposal on an initially house-free project.
        const task = houseTask({ region: BBOX_ONLY, mode, gate: approval === "immediate" ? "immediate" : "approval" });
        const observed = observeApplication();

        // When: full/partial approval or legacy immediate application follows clipping/review.
        if (approval === "immediate") {
          await expect(task.run()).rejects.toMatchObject({ code: "protected-house-write" });
        } else {
          const result = await task.run();
          expect(result.ok, result.error).toBe(true);
          expect(result.log?.toolCalls).toMatchObject([{ name: "author_house", ok: true }]);
          expect(result.clippedCells).toBe(6);
          const pending = result.pending;
          if (!pending) throw new Error("Missing real region approval");
          const map = houseMap(pending.clippedProject);
          expect(map.layoutPlan?.regions).toMatchObject([{ id: "house_1", role: "house" }]);
          expect(map.upperTiles[map.width + 2]).toBe(-1);
          expect(map.lowerTiles.slice(map.width + 3, map.width + 7)).toEqual([240, 240, 240, 240]);
          expect(map.upperTiles[map.width + 7]).toBe(-1);
          const groups = groupRegionChanges(pending.baseProject, pending.clippedProject, map.id, BBOX_ONLY);
          const partial = composePartialProject({
            base: pending.baseProject, clipped: pending.clippedProject, mapId: map.id, region: BBOX_ONLY,
            selectedChunkIds: [...groups.lower, ...groups.upper].map((chunk) => chunk.id), groups,
          });
          const outcome = approval === "full" ? pending.apply() : pending.applyProject(partial);
          expect(outcome.ok).toBe(false);
          expect(outcome.applied).toBe(false);
          expect(outcome.error).toBeTruthy();
          expect(pending.lastApplyError).toBe(outcome.error);
          expect(pending.settled).toBe(false);
        }

        // Then: neither damaged house metadata nor unowned partial house tiles reach history/store.
        task.completed();
        observed.rejected();
      });
    }

    it.each(["approval", "immediate"] as const)("applies a whole house including the ridge via %s with one undo", async (gate) => {
      // Given
      const task = houseTask({ region: WHOLE_HOUSE, mode, gate });
      const observed = observeApplication();

      // When
      const result = await task.run();
      expect(result.ok, result.error).toBe(true);
      expect(result.log?.toolCalls).toMatchObject([{ name: "author_house", ok: true }]);
      expect(result.clippedCells).toBe(0);
      if (gate === "approval") {
        if (!result.pending) throw new Error("Missing real region approval");
        expect(result.pending.apply()).toEqual({ ok: true, applied: true });
      } else {
        expect(result.applied).toBe(true);
      }

      // Then
      expect(captureHouseProtection(store.getCurrent())).toEqual(captureHouseProtection(task.completed()));
      observed.accepted();
    });
  });
}

it.each(["full", "partial", "immediate"] as const)("rejects %s review polishing a completed new house without any clipping", async (approval) => {
  // Given: the house completes over accepted ground that only the region polish changes.
  store.update((project) => {
    const map = houseMap(project);
    map.lowerTiles[map.width + 2] = 421;
  }, { scope: "project", origin: "human" });
  const task = houseTask({ region: WHOLE_HOUSE, mode: "polish", gate: approval === "immediate" ? "immediate" : "approval" });
  const observed = observeApplication();

  // When: partial's replacement candidate starts intact, then approval re-polishes it.
  if (approval === "immediate") {
    await expect(task.run()).rejects.toMatchObject({ code: "protected-house-write" });
  } else {
    const result = await task.run();
    expect(result.ok, result.error).toBe(true);
    expect(result.log?.toolCalls).toMatchObject([{ name: "author_house", ok: true }]);
    expect(result.clippedCells).toBe(0);
    const pending = result.pending;
    if (!pending) throw new Error("Missing real region approval");
    const map = houseMap(pending.clippedProject);
    expect(map.lowerTiles[map.width + 2]).toBe(360);
    const intact = task.completed();
    expect(houseMap(intact).lowerTiles[map.width + 2]).toBe(421);
    const outcome = approval === "full" ? pending.apply() : pending.applyProject(intact);
    expect(outcome.ok).toBe(false);
    expect(outcome.applied).toBe(false);
    expect(pending.settled).toBe(false);
    expect(houseMap(pending.clippedProject).lowerTiles[map.width + 2]).toBe(360);
  }

  // Then: the immutable completion baseline, not the reviewed candidate, owns the values.
  const completed = task.completed();
  expect(houseMap(completed).lowerTiles[houseMap(completed).width + 2]).toBe(421);
  observed.rejected();
});
