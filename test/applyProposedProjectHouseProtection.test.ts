import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import * as history from "@/editor/mapEditHistory";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { serialize } from "@/project/io";
import * as commits from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { completedHouseProject, houseMap, mutateProject } from "./fixtures/completedHouse";
import { fixedDeclarer } from "./intentFixture";

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(completedHouseProject());
  history.resetMapEditHistory();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function previewRename() {
  const base = captureProposalBase(store.getCurrent());
  const ctx = { project: store.getCurrent() };
  const result = mutateProject(ctx, (draft) => { houseMap(draft).name = "AI rename"; });
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  expect(ctx.project).not.toBe(store.getCurrent());
  return { proposed: ctx.project, base };
}

const HUMAN_EDITS = ["lowerTiles", "upperTiles", "lowerTileStacks", "upperTileStacks"] as const;
type HumanEdit = typeof HUMAN_EDITS[number];
function editHouse(project: Project, layer: HumanEdit): void {
  const map = houseMap(project);
  const index = 4 * map.width + 5;
  if (layer === "lowerTiles" || layer === "upperTiles") map[layer][index] = 322;
  else map[layer] = { ...map[layer], [index]: [199, 322] };
}

function observeApplication() {
  return {
    snapshot: vi.spyOn(history, "recordProjectSnapshot"),
    commit: vi.spyOn(commits, "recordProjectCommit"),
    baseline: vi.spyOn(commits, "resetManualProjectCommitBaseline"),
    replace: vi.spyOn(store, "replace"),
    replaceProject: vi.spyOn(store, "replaceProject"),
  };
}

function expectNoApplication(observed: ReturnType<typeof observeApplication>, accepted: Project, bytes: string): void {
  expect(store.getCurrent()).toBe(accepted);
  expect(serialize(store.getCurrent())).toBe(bytes);
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
  for (const spy of Object.values(observed)) expect(spy).not.toHaveBeenCalled();
}

for (const source of ["agent", "agent-milestone"] as const) {
  describe(`${source} live house baseline`, () => {
    it.each(HUMAN_EDITS)("atomically rejects a stale preview after human %s edits", async (layer) => {
      const { proposed, base } = previewRename();
      const previewBytes = serialize(proposed);
      store.update((draft) => editHouse(draft, layer), { scope: "project", origin: "human" });
      const accepted = store.getCurrent();
      const acceptedBytes = serialize(accepted);
      const observed = observeApplication();

      const result = await applyProposedProject(proposed, { base, source, summary: "Rename", toolNames: [] });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Stale house preview was applied");
      expect(result.reason).toBe("stale-base");
      expect(result.issue).toBeTruthy();
      expectNoApplication(observed, accepted, acceptedBytes);
      expect(serialize(proposed)).toBe(previewBytes);
    });

    it.each([false, true])("retains a house completed after preview, including resetProject=%s", async (resetProject) => {
      store.update((draft) => { delete houseMap(draft).layoutPlan; });
      const { proposed, base } = previewRename();
      store.update((draft) => { houseMap(draft).layoutPlan = houseMap(completedHouseProject()).layoutPlan; },
        { scope: "project", origin: "human" });
      const accepted = store.getCurrent();
      const acceptedBytes = serialize(accepted);
      const observed = observeApplication();

      const result = await applyProposedProject(proposed, { base, source, summary: "Rename", toolNames: [], resetProject });

      expect(result.ok).toBe(false);
      expectNoApplication(observed, accepted, acceptedBytes);
      expect(houseMap(store.getCurrent()).layoutPlan?.regions).toHaveLength(1);
    });

    it("applies an unchanged-store preview with one undo entry and one commit", async () => {
      const { proposed, base } = previewRename();
      const observed = observeApplication();

      const result = await applyProposedProject(proposed, { base, source, summary: "Rename", toolNames: [] });

      expect(result.ok).toBe(true);
      expect(houseMap(store.getCurrent()).name).toBe("AI rename");
      expect(history.getMapEditHistoryEntries()).toHaveLength(1);
      expect(observed.snapshot).toHaveBeenCalledTimes(1);
      expect(observed.commit).toHaveBeenCalledTimes(1);
    });

    it("uses current human tile and stack edits as the next accepted baseline", async () => {
      store.update((draft) => { for (const layer of HUMAN_EDITS) editHouse(draft, layer); },
        { scope: "project", origin: "human" });
      const { proposed, base } = previewRename();

      const result = await applyProposedProject(proposed, { base, source, summary: "Rename", toolNames: [] });

      expect(result.ok).toBe(true);
      const map = houseMap(store.getCurrent());
      const index = 4 * map.width + 5;
      expect(map.name).toBe("AI rename");
      expect(map.lowerTiles[index]).toBe(322);
      expect(map.upperTiles[index]).toBe(322);
      expect(map.lowerTileStacks?.[index]).toEqual([199, 322]);
      expect(map.upperTileStacks?.[index]).toEqual([199, 322]);
    });

    it("preserves human edits in raw walls and non-house regions against stale proposals", async () => {
      store.update((draft) => {
        const region = houseMap(draft).layoutPlan?.regions[0];
        if (!region) throw new Error("Missing fixture region");
        region.role = "custom";
      });
      const { proposed, base } = previewRename();
      store.update((draft) => editHouse(draft, "upperTiles"), { scope: "project", origin: "human" });

      const result = await applyProposedProject(proposed, { base, source, summary: "Rename", toolNames: [] });

      expect(result).toMatchObject({ ok: false, reason: "stale-base" });
      const map = houseMap(store.getCurrent());
      expect(map.upperTiles[4 * map.width + 5]).toBe(322);
      expect(map.name).not.toBe("AI rename");
      expect(history.getMapEditHistoryEntries()).toHaveLength(0);
    });

    it("still rejects a current-base proposal that changes a completed house", async () => {
      const { proposed, base } = previewRename();
      editHouse(proposed, "upperTiles");
      const accepted = store.getCurrent();
      const bytes = serialize(accepted);
      const observed = observeApplication();
      const result = await applyProposedProject(proposed, { base, source, summary: "House edit", toolNames: [] });
      expect(result).toMatchObject({ ok: false, reason: "commit-rejected" });
      if (result.ok) throw new Error("House protection failed");
      expect(result.issues).toEqual([result.issue]);
      expectNoApplication(observed, accepted, bytes);
    });
  });
}

describe("real autonomous milestone application", () => {
  it.each(["human-edit", "new-house", "unchanged"] as const)("checks the live store at completion: %s", async (scenario) => {
    if (scenario === "new-house") store.update((draft) => { delete houseMap(draft).layoutPlan; });
    const project = store.getCurrent();
    const events: SessionEvent[] = [];
    const observed = observeApplication();
    const goal = "Set the title";
    const plan = { action: "new_plan", goal, layers: [{ title: "Title", items: [{
      title: "Title", instruction: "set_title_screen", successTools: ["set_title_screen"],
    }] }] };
    let wrote = false;
    const session = new AssistantSession(project, {
      config: { authMode: "apiKey", agentMode: "auto", baseUrl: "x", model: "test", apiKey: "test", maxToolCalls: 4, maxTokens: 1024 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, tools: ["set_title_screen"] }),
      yieldToUi: async () => {},
      chat: async (_config, request): Promise<ChatResult> => {
        if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify(plan) }, finishReason: "stop" };
        if (wrote) return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
        wrote = true;
        return { message: { role: "assistant", content: null, tool_calls: [{
          id: "title", type: "function", function: { name: "set_title_screen", arguments: JSON.stringify({ title: "AI title" }) },
        }] }, finishReason: "tool_calls" };
      },
    });
    let accepted = project;
    let acceptedBytes = serialize(project);
    let successfulWrite = false;
    const result = await session.sendUserMessage(goal, (event) => {
      events.push(event);
      // The exact tool completion signal occurs after the detached write, before milestone apply.
      if (event.type !== "tool_call" || event.name !== "set_title_screen" || !event.result.ok) return;
      successfulWrite = true;
      if (scenario !== "unchanged") store.update((draft) => {
        if (scenario === "human-edit") {
          editHouse(draft, "upperTiles");
          editHouse(draft, "upperTileStacks");
        } else houseMap(draft).layoutPlan = houseMap(completedHouseProject()).layoutPlan;
      }, { scope: "project", origin: "human" });
      accepted = store.getCurrent();
      acceptedBytes = serialize(accepted);
    }, undefined, { autonomous: true });

    expect(successfulWrite).toBe(true);
    expect(result.error).toBeUndefined();
    if (scenario === "unchanged") {
      expect(events.filter((event) => event.type === "milestone_applied")).toHaveLength(1);
      expect(result.appliedCalls?.map((call) => call.name)).toEqual(["set_title_screen"]);
      expect(store.getCurrent().meta?.title).toBe("AI title");
      expect(observed.commit).toHaveBeenCalledTimes(1);
      expect(history.getMapEditHistoryEntries()).toHaveLength(1);
    } else {
      expect(events.filter((event) => event.type === "proposal_paused")).toHaveLength(1);
      expect(events.filter((event) => event.type === "milestone_applied")).toHaveLength(0);
      expect(result.appliedCalls ?? []).toHaveLength(0);
      expectNoApplication(observed, accepted, acceptedBytes);
    }
  });
});
