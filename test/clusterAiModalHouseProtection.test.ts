// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { locks } from "node:worker_threads";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import * as focus from "@/editor/agentFocus";
import { editorState } from "@/editor/editorState";
import * as history from "@/editor/mapEditHistory";
import { resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { serialize } from "@/project/io";
import * as commits from "@/project/projectCommitLog";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import { completedHouseProject, houseMap } from "./fixtures/completedHouse";
import { installAdmitClient } from "./aiJobAdmitSupport";

vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("navigator", { locks });
  localStorage.clear();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    authMode: "apiKey", apiKey: "test-key", baseUrl: "https://example.test",
    model: "test", maxTokens: 1024, maxToolCalls: 4, agentMode: "chat",
  }));
  resetAiConnectionStatusCache();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(completedHouseProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  history.resetMapEditHistory();
  vi.mocked(toast).mockClear();
  harness = installAdmitClient();
});

afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-modal-close"]')?.click();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetAiConnectionStatusCache();
});

function element(testId: string): HTMLElement {
  const node = document.querySelector(`[data-testid="${testId}"]`);
  if (!(node instanceof HTMLElement)) throw new Error(`Missing ${testId}`);
  return node;
}

function statusChanged(): Promise<void> {
  const status = element("cluster-ai-status");
  const before = status.textContent;
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (status.textContent === before) return;
      clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error("Cluster acceptance did not settle"));
    }, 5000);
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  });
}

function metadataGroup() {
  return {
    defaultLayer: "lower" as const,
    description: "QA metadata",
    id: "qa-metadata",
    name: "QA metadata",
    placementRules: "",
    role: "prop" as const,
    tileIds: [322],
  };
}

function proposedCalls() {
  return [{
    name: "upsert_tile_group",
    summary: "QA metadata",
    args: { name: "QA metadata", role: "prop", tileIds: [322] },
    destructive: false,
    result: { ok: true, summary: "Classify an unrelated tile without modifying the map" },
  }];
}

async function openProposal(): Promise<void> {
  const pending = harness.nextAdmitted();
  openClusterAiModal({
    kind: "range-classify",
    tilesetId: DEFAULT_TILESET_ID,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    tileIds: [322],
  });
  await pending;
  const generated = structuredClone(store.getCurrent());
  generated.tilesets[DEFAULT_TILESET_ID].tileGroups = [
    ...(generated.tilesets[DEFAULT_TILESET_ID].tileGroups ?? []),
    metadataGroup(),
  ];
  const settled = statusChanged();
  await harness.complete({ assistantText: "분류했습니다.", proposedCalls: proposedCalls() }, undefined, generated);
  await settled;
  element("cluster-ai-accept");
}

function observeApplication() {
  return {
    snapshot: vi.spyOn(history, "recordProjectSnapshot"),
    commit: vi.spyOn(commits, "recordProjectCommit"),
    baseline: vi.spyOn(commits, "resetManualProjectCommitBaseline"),
    replace: vi.spyOn(store, "replace"),
    focus: vi.spyOn(focus, "focusAcceptedAgentChanges"),
  };
}

describe("cluster modal live-house acceptance", () => {
  it.each(["upper", "stack", "upper-and-stack", "new-house"] as const)(
    "rejects a successful metadata proposal after %s changes without applying",
    async (scenario) => {
      if (scenario === "new-house") store.update((draft) => { delete houseMap(draft).layoutPlan; });
      await openProposal();
      history.recordProjectSnapshot("Human edit");
      store.update((draft) => {
        const map = houseMap(draft);
        const index = 4 * map.width + 5;
        if (scenario === "new-house") map.layoutPlan = houseMap(completedHouseProject()).layoutPlan;
        if (scenario === "upper" || scenario === "upper-and-stack") map.upperTiles[index] = 322;
        if (scenario === "stack" || scenario === "upper-and-stack") map.upperTileStacks = { [index]: [199, 322] };
      }, { scope: "project", origin: "human" });
      const accepted = store.getCurrent();
      const bytes = serialize(accepted);
      const entries = history.getMapEditHistoryEntries();
      const observed = observeApplication();
      const settled = statusChanged();
      element("cluster-ai-accept").click();
      await settled;

      expect(store.getCurrent()).toBe(accepted);
      expect(serialize(store.getCurrent())).toBe(bytes);
      expect(history.getMapEditHistoryEntries()).toEqual(entries);
      for (const spy of Object.values(observed)) expect(spy).not.toHaveBeenCalled();
      expect(element("cluster-ai-accept")).toBeTruthy();
      expect(toast).toHaveBeenCalledExactlyOnceWith(expect.any(String), "error");
    },
  );

  it.each([false, true])("applies safe metadata exactly once with existing human edits=%s", async (edited) => {
    if (edited) store.update((draft) => {
      const map = houseMap(draft);
      const index = 4 * map.width + 5;
      map.upperTiles[index] = 322;
      map.upperTileStacks = { [index]: [199, 322] };
    }, { scope: "project", origin: "human" });
    const before = serialize(store.getCurrent());
    await openProposal();
    const observed = observeApplication();
    const settled = statusChanged();
    element("cluster-ai-accept").click();
    await settled;

    expect(store.getCurrent().tilesets[DEFAULT_TILESET_ID].tileGroups?.some((group) => group.name === "QA metadata")).toBe(true);
    expect(observed.replace).toHaveBeenCalled();
    expect(document.querySelector('[data-testid="cluster-ai-accept"]')).toBeNull();
    expect(toast).toHaveBeenCalledExactlyOnceWith(expect.any(String), "ok");
    expect(history.undoMapEdit()).toBe(true);
    expect(serialize(store.getCurrent())).toBe(before);
  });
});
