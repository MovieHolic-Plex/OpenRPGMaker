// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { createRequestSource } from "@/ai/assistantRequestContract";
import { AI_CONFIG_STORAGE_KEY, chatCompletion } from "@/ai/llmClient";
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
import { declaredIntent } from "./intentFixture";
import { isWikiExtraction } from "./wikiTransportFixture";

const PRESERVATION = /\b(?:preserve|unchanged|without|never|not|no|keep|don't|cannot)\b|유지|보존|금지|말고|없이|하지\s*마/giu;

function classifyKickoffIntent(facts: { readonly userText: string }) {
  const request = createRequestSource("preview", facts.userText);
  const entries = request.units.flatMap(unit => {
    const marks = [...unit.source.quote.matchAll(PRESERVATION)];
    if (marks.length === 0) return [];
    const digits = [...unit.source.quote.matchAll(/\d+(?:\.\d+)?/g)];
    const criteria = [
      { kind: "entityPreserve" as const, subject: { kind: "project" as const } },
      ...digits.map(match => ({
        kind: "entityCount" as const,
        collection: { kind: "database" as const, collection: "items" as const },
        selector: { all: true as const },
        comparison: "eq" as const,
        count: Number(match[0]),
        basis: "current" as const,
      })),
    ];
    const bindings = [
      ...marks.map(match => ({
        source: {
          start: unit.source.start + match.index,
          end: unit.source.start + match.index + match[0].length,
          quote: match[0],
        },
        role: "prohibit" as const,
        criterionIndex: 0,
        fieldPath: [] as const,
      })),
      ...digits.map((match, index) => ({
        source: {
          start: unit.source.start + match.index,
          end: unit.source.start + match.index + match[0].length,
          quote: match[0],
        },
        role: "count" as const,
        criterionIndex: 1 + index,
        fieldPath: ["count"],
      })),
    ];
    return [{ source: [unit.source], criteria, bindings }];
  });
  return {
    intent: declaredIntent({
      mode: "modify",
      needsPlan: true,
      tools: ["upsert_tile_group"],
      requestRequirements: { entries },
      summary: facts.userText.slice(0, 200),
    }),
    elapsedMs: 0,
  };
}

vi.mock("@/ai/assistantSession", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/assistantSession")>();
  class ClusterSession extends actual.AssistantSession {
    constructor(
      project: ConstructorParameters<typeof actual.AssistantSession>[0],
      options: ConstructorParameters<typeof actual.AssistantSession>[1] = {},
    ) {
      super(project, { ...options, declareIntent: options.declareIntent ?? classifyKickoffIntent });
    }
  }
  return { ...actual, AssistantSession: ClusterSession };
});

// Only model transport, UI yielding and transient notifications are substituted.
// The modal, session, registered tool, application guard, store and undo are real.
vi.mock("@/ai/llmClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/ai/llmClient")>(),
  chatCompletion: vi.fn(),
}));
vi.mock("@/ai/yieldToUi", () => ({ defaultYieldToUi: async () => {} }));
vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  localStorage.clear();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    authMode: "apiKey", apiKey: "test-key", baseUrl: "https://example.test",
    model: "test", maxTokens: 1024, maxToolCalls: 4, agentMode: "chat",
  }));
  resetAiConnectionStatusCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(completedHouseProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  history.resetMapEditHistory();
  vi.mocked(toast).mockClear();
  let wrote = false;
  vi.mocked(chatCompletion).mockReset().mockImplementation(async (_config, request) => {
    if (isWikiExtraction(request.messages)) return { message: { role: "assistant", content: '{"upserts":[]}' }, finishReason: "stop" };
    if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({
      action: "new_plan", goal: "Classify tile metadata", layers: [{ title: "Metadata", items: [{
        title: "Metadata", instruction: "upsert_tile_group", successTools: ["upsert_tile_group"],
      }] }],
    }) }, finishReason: "stop" };
    if (wrote) return { message: { role: "assistant", content: "DONE" }, finishReason: "stop" };
    wrote = true;
    return {
      message: { role: "assistant", content: null, tool_calls: [{
        id: "metadata", type: "function", function: {
          name: "upsert_tile_group",
          arguments: JSON.stringify({ name: "QA metadata", role: "prop", tileIds: [322],
            reason: "Classify an unrelated tile without modifying the map" }),
        },
      }] }, finishReason: "tool_calls",
    };
  });
});

afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-modal-close"]')?.click();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetAiConnectionStatusCache();
});

function element(testId: string): HTMLElement {
  const node = document.querySelector(`[data-testid="${testId}"]`);
  if (!(node instanceof HTMLElement)) throw new Error(`Missing ${testId}`);
  return node;
}

// Subscribe before the action; no sleeps, polling, or guessed microtask drains.
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

async function openProposal(): Promise<AssistantSession> {
  const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage");
  openClusterAiModal({ kind: "range-classify", tilesetId: DEFAULT_TILESET_ID,
    rect: { x: 0, y: 0, w: 1, h: 1 }, tileIds: [322] });
  const result = await send.mock.results[0].value;
  expect(result.proposedCalls, JSON.stringify(result)).toHaveLength(1);
  expect(result.proposedCalls[0].name).toBe("upsert_tile_group");
  expect(result.proposedCalls[0].result.ok).toBe(true);
  const session = send.mock.contexts[0];
  if (!(session instanceof AssistantSession)) throw new Error("Missing real modal session");
  element("cluster-ai-accept");
  return session;
}

function observeApplication() {
  return {
    snapshot: vi.spyOn(history, "recordProjectSnapshot"),
    commit: vi.spyOn(commits, "recordProjectCommit"),
    baseline: vi.spyOn(commits, "resetManualProjectCommitBaseline"),
    replace: vi.spyOn(store, "replace"),
    focus: vi.spyOn(focus, "focusAcceptedAgentChanges"),
    rebase: vi.spyOn(AssistantSession.prototype, "rebaseProject"),
  };
}

describe("cluster modal live-house acceptance", () => {
  it.each(["upper", "stack", "upper-and-stack", "new-house"] as const)(
    "rejects a successful metadata proposal after %s changes without applying or rebasing", async (scenario) => {
      if (scenario === "new-house") store.update((draft) => { delete houseMap(draft).layoutPlan; });
      const session = await openProposal();
      const proposalBytes = serialize(session.getProposedProject());
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
      expect(serialize(session.getProposedProject())).toBe(proposalBytes);
      expect(element("cluster-ai-accept")).toBeTruthy();
      expect(toast).toHaveBeenCalledExactlyOnceWith(expect.any(String), "error");
    });

  it.each([false, true])("applies safe metadata exactly once with existing human edits=%s", async (edited) => {
    if (edited) store.update((draft) => {
      const map = houseMap(draft);
      const index = 4 * map.width + 5;
      map.upperTiles[index] = 322;
      map.upperTileStacks = { [index]: [199, 322] };
    }, { scope: "project", origin: "human" });
    const before = serialize(store.getCurrent());
    const session = await openProposal();
    const proposed = serialize(session.getProposedProject());
    const observed = observeApplication();
    const settled = statusChanged();
    element("cluster-ai-accept").click();
    await settled;

    expect(serialize(store.getCurrent())).toBe(proposed);
    expect(store.getCurrent().tilesets[DEFAULT_TILESET_ID].tileGroups?.some((group) => group.name === "QA metadata")).toBe(true);
    for (const spy of Object.values(observed)) expect(spy).toHaveBeenCalledTimes(1);
    expect(observed.rebase).toHaveBeenCalledWith(store.getCurrent());
    expect(history.getMapEditHistoryEntries()).toHaveLength(1);
    expect(document.querySelector('[data-testid="cluster-ai-accept"]')).toBeNull();
    expect(toast).toHaveBeenCalledExactlyOnceWith(expect.any(String), "ok");
    expect(history.undoMapEdit()).toBe(true);
    expect(serialize(store.getCurrent())).toBe(before);
  });
});
