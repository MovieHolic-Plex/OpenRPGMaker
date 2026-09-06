import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations, conversationScopeKey, saveConversation } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { buildAiActivityLogRecord } from "@/ai/activityLog";
import { clearAgentBlueprint, getAgentBlueprintState, setAgentBlueprintFromSpec } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview, getAgentGhostDraftMap, getAgentGhostPreviewState, setAgentGhostDraftMapProvider, subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { closeAiConversationHistoryModal, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { getPendingRegionApply, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

const activity = vi.hoisted(() => ({ record: vi.fn<typeof import("@/ai/activityLog").recordAiActivity>() }));
vi.mock("@/ai/activityLog", async (original) => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: activity.record,
}));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Uninitialized deferred"); };
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function button(root: ParentNode, testid: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);
  if (!found) throw new Error(`Missing button: ${testid}`);
  return found;
}

let restoreDom: (() => void) | undefined;
beforeEach(async () => {
  restoreDom = installFakeDom();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
  });
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  activity.record.mockReset();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replaceProject(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  clearAgentGhostPreview();
  setAgentGhostDraftMapProvider(null);
  clearAgentBlueprint();
  await clearConversations();
});

afterEach(async () => {
  closeAiConversationHistoryModal();
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  getPendingRegionApply()?.discard();
  clearAgentGhostPreview();
  setAgentGhostDraftMapProvider(null);
  clearAgentBlueprint();
  restoreDom?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function pendingRegion() {
  const base = store.getCurrent();
  const draft = structuredClone(base);
  const mapId = base.startMapId;
  draft.maps[mapId].lowerTiles[0] += 1;
  const onApply = vi.fn((project: typeof base) => store.replace(project));
  const onDiscard = vi.fn();
  const pending = setPendingRegionApply({
    baseProject: base, clippedProject: draft, mapId,
    region: { x: 0, y: 0, width: 1, height: 1 }, changedCells: 1, changedEvents: 0,
    instruction: "independent region", getCurrentProject: () => store.getCurrent(), onApply, onDiscard,
    onSettle: () => { clearAgentGhostPreview(); setAgentGhostDraftMapProvider(null); },
  });
  setAgentGhostDraftMapProvider((id) => pending.clippedProject.maps[id]);
  const previews = getAgentGhostPreviewState().previews;
  expect(previews.length).toBeGreaterThan(0);
  return { pending, base, draft, mapId, previews, onApply, onDiscard };
}

function expectPending(region: ReturnType<typeof pendingRegion>): void {
  expect(getPendingRegionApply()).toBe(region.pending);
  expect(region.pending.settled).toBe(false);
  expect(region.onApply).not.toHaveBeenCalled();
  expect(region.onDiscard).not.toHaveBeenCalled();
  expect(store.getCurrent()).toBe(region.base);
  expect(getAgentGhostPreviewState()).toMatchObject({ previews: region.previews, runningToolName: "" });
  expect(getAgentGhostDraftMap(region.mapId)).toBe(region.draft.maps[region.mapId]);
}

function approve(region: ReturnType<typeof pendingRegion>): void {
  expect(region.pending.apply()).toEqual({ ok: true, applied: true });
  expect(region.onApply).toHaveBeenCalledTimes(1);
  expect(region.pending.settled).toBe(true);
  expect(getPendingRegionApply()).toBeNull();
  expect(store.getCurrent().maps[region.mapId].lowerTiles[0]).toBe(region.draft.maps[region.mapId].lowerTiles[0]);
  expect(getAgentGhostPreviewState().previews).toEqual([]);
}

async function saveHistory(id: string): Promise<void> {
  await saveConversation({
    id, title: id, model: "test", savedAt: 100,
    projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
    entries: [{ kind: "user", text: id }, { kind: "assistant", text: "answer" }],
  });
}

describe("independent region presentation at chat boundaries", () => {
  it("keeps an idle pending region visible and explicitly applicable after new chat", async () => {
    const panel = renderAiChatPanel();
    await whenAiChatPanelSettled();
    const region = pendingRegion();
    setAgentBlueprintFromSpec({ mapId: region.mapId, assets: [{ id: "old-plan", kind: "clear", x: 0, y: 0, w: 2, h: 2 }] });
    button(panel, "ai-new-chat").click();
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(getAgentBlueprintState().entries).toEqual([]);
    expectPending(region);
    approve(region);
  });

  it("restores the region provider before publishing after cancelling a held chat request", async () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://llm.invalid/v1", apiKey: "sk-test", agentMode: "chat",
    }));
    const started = deferred<AbortSignal>();
    const aborted = deferred<void>();
    const response = deferred<Response>();
    const orphaned = deferred<void>();
    activity.record.mockImplementation(async (entry) => {
      if (entry.result.orphaned) orphaned.resolve();
      return buildAiActivityLogRecord(entry);
    });
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => {
      const body: { messages?: unknown; response_format?: unknown } = JSON.parse(String(init?.body ?? "{}"));
      if (!Array.isArray(body.messages)) return Promise.resolve(new Response("{}"));
      if (body.response_format) return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: '{"mode":"other","needsPlan":false}' }, finish_reason: "stop" }],
      })));
      if (!init?.signal) throw new Error("Chat request must carry cancellation");
      init.signal.addEventListener("abort", () => aborted.resolve(), { once: true });
      started.resolve(init.signal);
      return response.promise;
    }));
    const panel = renderAiChatPanel();
    await whenAiChatPanelSettled();
    const region = pendingRegion();
    const input = panel.querySelector<HTMLTextAreaElement>('[data-testid="ai-input"]');
    if (!input) throw new Error("Missing composer");
    input.value = "Inspect this map";
    button(panel, "ai-send").click();
    const signal = await started.promise;
    expect(getAgentGhostDraftMap(region.mapId)).not.toBe(region.draft.maps[region.mapId]);
    const publishedMaps: ReturnType<typeof getAgentGhostDraftMap>[] = [];
    const unsubscribe = subscribeAgentGhostPreview((state) => {
      if (state.previews.length > 0) publishedMaps.push(getAgentGhostDraftMap(region.mapId));
    });
    publishedMaps.length = 0;
    try {
      button(panel, "ai-new-chat").click();
      await aborted.promise;
      expect(signal.aborted).toBe(true);
      expectPending(region);
      expect(publishedMaps.length).toBeGreaterThan(0);
      expect(publishedMaps.every((map) => map === region.draft.maps[region.mapId])).toBe(true);
    } finally {
      unsubscribe();
      response.resolve(new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "late-response-sentinel" }, finish_reason: "stop" }],
      })));
      await orphaned.promise;
    }
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(panel.textContent).not.toContain("late-response-sentinel");
    expectPending(region);
    approve(region);
  }, 15_000);

  it.each(["boot", "manual"] as const)("preserves a pending region during same-project %s restore", async (mode) => {
    await saveHistory("saved-chat");
    const region = pendingRegion();
    const panel = renderAiChatPanel();
    await whenAiChatPanelSettled();
    if (mode === "manual") {
      button(panel, "ai-new-chat").click();
      button(panel, "ai-open-conversations").click();
      await whenAiConversationHistoryModalSettled();
      button(document, "ai-history-open").click();
      await whenAiConversationHistoryModalSettled();
    }
    expect(panel.dataset.aiConversation).toBe("active");
    expectPending(region);
    approve(region);
  });

  it.each([false, true])("does not restore the old region on a project switch (saved target: %s)", async (savedTarget) => {
    const panel = renderAiChatPanel();
    await whenAiChatPanelSettled();
    const region = pendingRegion();
    if (savedTarget) await saveHistory("same-shaped-project-history");
    const identity = store.getProjectIdentity().id;
    // Identical content/scope is still a different project identity.
    store.replaceProject(structuredClone(region.base));
    await whenAiChatPanelSettled();
    expect(store.getProjectIdentity().id).not.toBe(identity);
    expect(panel.dataset.aiConversation).toBe(savedTarget ? "active" : "empty");
    expect(getAgentGhostPreviewState().previews).toEqual([]);
    expect(getAgentGhostDraftMap(region.mapId)).toBeUndefined();
    expect(region.onApply).not.toHaveBeenCalled();
  });
});
