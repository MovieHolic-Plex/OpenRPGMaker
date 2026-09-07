import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import * as history from "@/editor/mapEditHistory";
import { getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { applyRegionProjectWithHistory, runRegionTask } from "@/editor/regionTask/runRegionTask";
import type { RegionTaskOptions } from "@/editor/regionTask/runRegionTask";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import { houseMap } from "./fixtures/completedHouse";
import { approvedReviewResponse } from "./independentReviewFixture";
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

const IMAGE = {
  label: "Completed house renderer double",
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
};

function toolCall(id: string, name: string, args: Record<string, unknown>): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  };
}

function houseTask(options: Pick<RegionTaskOptions, "region" | "gate" | "mode">) {
  let session: AssistantSession | undefined;
  return {
    run: () => runRegionTask({ mapId: store.getCurrent().startMapId, instruction: "author_house", ...options }, {
      getProject: () => store.getCurrent(),
      applyProject: applyRegionProjectWithHistory,
      createSession: (project, mapId) => {
        const map = project.maps[mapId];
        if (!map) throw new Error("Missing session map");
        // Production order: plan (acceptance criteria) -> write -> fresh visual
        // evidence -> final text. The independent reviewer round is served by the
        // machine-discriminated review transport, never writer prose.
        const steps: ChatResult[] = [
          toolCall("plan", "set_work_plan", {
            goal: "author_house",
            acceptance: [{ id: "house", title: "House built", criteria: [
              { kind: "targetChange", target: { mapId } },
              { kind: "imageReviewed", target: { mapId } },
            ] }],
            layers: [
              { title: "집 짓기", items: [{ title: "집 시공", instruction: "author_house", successTools: ["author_house"] }] },
              { title: "마무리", items: [{ title: "시각 확인", instruction: "show_map_region", successTools: ["show_map_region"] }] },
            ],
          }),
          // Spec gate order: author_house requires an established build spec on the draft.
          toolCall("spec", "set_build_spec", {
            mapId, assets: [{ id: "house", kind: "house", x: 2, y: 2, w: 6, h: 6 }],
          }),
          toolCall("house", "author_house", {
            kind: "single", mapId, kitId: "bright-plaster", wings: [{ x: 2, y: 2, w: 6, h: 6 }],
            interior: "exterior-only", yard: [],
          }),
          // Success-tool ledger order: complete each item while it is current, or the
          // next item reports its successTools missing. Ralph re-injects final text
          // while any plan item is open, so all items must complete before review.
          toolCall("done1", "complete_work_item", { note: "집 시공 완료" }),
          toolCall("shot", "show_map_region", { mapId, x: 0, y: 0, w: map.width, h: map.height }),
          toolCall("done2", "complete_work_item", { note: "시각 확인 완료" }),
        ];
        let consumed = 0;
        session = new AssistantSession(project, {
          config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "gemini-2.5-flash-lite", apiKey: "test", maxToolCalls: 16, maxTokens: 16000 },
          contextOptions: { currentMapId: mapId },
          declareIntent: fixedDeclarer({ mode: "modify", space: "outdoor", useSelection: true, tools: ["author_house"] }),
          yieldToUi: async () => {},
          renderImages: async () => [IMAGE],
          chat: async (_config, request) => {
            const approval = approvedReviewResponse(request);
            if (approval) return approval;
            return steps[consumed++] ?? { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
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

        // When: clipping the north ridge breaks the completed house, so the production
        // review-draft transform throws protected-house-write inside independent review.
        // Full, partial, and legacy immediate converge on this fail-closed error result
        // before any approval slot, store, or history mutation.
        const result = await task.run();
        expect(result.ok).toBe(false);
        expect(result.error).toContain("완성된 집의 보호 영역");
        expect(result.log?.toolCalls).toContainEqual(expect.objectContaining({ name: "author_house", ok: true }));
        expect(result.pending).toBeUndefined();
        expect(getPendingRegionApply()).toBeNull();

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
      expect(result.log?.toolCalls).toContainEqual(expect.objectContaining({ name: "author_house", ok: true }));
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

  // When: the polish-mode review-draft transform re-polishes the ridge (421 -> 360)
  // before the guard, so the completed house seal breaks inside independent review.
  // Full, partial, and legacy immediate converge on this fail-closed error result
  // before any approval slot, store, or history mutation.
  const result = await task.run();
  expect(result.ok).toBe(false);
  expect(result.error).toContain("완성된 집의 보호 영역");
  expect(result.log?.toolCalls).toContainEqual(expect.objectContaining({ name: "author_house", ok: true }));
  expect(result.pending).toBeUndefined();
  expect(getPendingRegionApply()).toBeNull();

  // Then: the session draft still owns the completed values, and neither damaged
  // house metadata nor re-polished tiles reach history/store.
  const completed = task.completed();
  expect(houseMap(completed).lowerTiles[houseMap(completed).width + 2]).toBe(421);
  observed.rejected();
});
