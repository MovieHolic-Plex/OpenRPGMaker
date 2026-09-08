// @vitest-environment happy-dom
// R2 direct path: persistent soft-vocabulary origin/source normalization happens
// BEFORE independent review, so the reviewed candidate equals the applied one.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, chatCompletion, defaultAiConfig, type ChatRequest } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import * as history from "@/editor/mapEditHistory";
import { createProposalHost } from "@/editor/panels/aiProposalCard";
import { resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";
import { isWikiExtraction } from "./wikiTransportFixture";
import { fixedDeclarer } from "./intentFixture";

vi.mock("@/ai/llmClient", async importOriginal => ({
  ...await importOriginal<typeof import("@/ai/llmClient")>(), chatCompletion: vi.fn(),
}));
vi.mock("@/ai/yieldToUi", () => ({ defaultYieldToUi: async () => {} }));

const TILESET_GROUP = "g-soft";
let reviewRequests: ChatRequest[] = [];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 30, maxTokens: 16000 }));
  resetAiConnectionStatusCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  const mapId = project.startMapId;
  const tileset = project.tilesets[project.maps[mapId]!.tilesetId]!;
  tileset.tileGroups = [...(tileset.tileGroups ?? []), {
    id: TILESET_GROUP, name: "soft 재료", role: "prop", defaultLayer: "lower",
    tileIds: [5], description: "", placementRules: "", origin: "ai",
  } as never];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selection: null });
  history.resetMapEditHistory();
  reviewRequests = [];
  const state = { planned: false, staged: false, placed: false, shown: false };
  vi.mocked(chatCompletion).mockReset().mockImplementation(async (_config, request) => {
    if (isWikiExtraction(request.messages)) return { message: { role: "assistant", content: '{"upserts":[]}' }, finishReason: "stop" };
    const review = independentReviewPayload(request);
    if (review) {
      reviewRequests.push(request);
      return approvedReviewResponse(request)!;
    }
    if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({
      action: "new_plan", goal: "Scatter soft props", layers: [{ title: "Props", items: [{
        title: "Props", instruction: "Scatter soft props", successTools: ["place_props"] }] }],
      acceptance: [{ id: "props", title: "Props", criteria: [{ kind: "targetChange", target: { mapId } }] }] }) }, finishReason: "stop" };
    const tool = (name: string, args: unknown, id: string) => ({ role: "assistant", content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    if (!state.planned) {
      state.planned = true;
      return { message: tool("set_work_plan", { goal: "Scatter soft props", layers: [{ title: "Props", items: [{
        title: "Props", instruction: "Scatter soft props", successTools: ["place_props"] }] }],
        acceptance: [{ id: "props", title: "Props", criteria: [{ kind: "targetChange", target: { mapId } }] }] }, "plan"), finishReason: "tool_calls" };
    }
    if (!state.staged) {
      state.staged = true;
      return { message: tool("set_build_spec", { mapId, title: "Props",
        assets: [{ id: "props_a", kind: "props", x: 1, y: 1, w: 4, h: 4, overExisting: "keep" }],
        buildOrder: ["props"], density: "normal", layoutStyle: "straight", pathWidth: 1 }, "spec"), finishReason: "tool_calls" };
    }
    if (!state.placed) {
      state.placed = true;
      return { message: tool("place_props", { mapId, area: { x: 1, y: 1, w: 4, h: 4 }, material: "soft 재료", count: 2 }, "props"), finishReason: "tool_calls" };
    }
    if (!state.shown) {
      state.shown = true;
      return { message: tool("show_map_region", { mapId, x: 0, y: 0, w: 20, h: 15 }, "show"), finishReason: "tool_calls" };
    }
    return { message: { role: "assistant", content: "Finished" }, finishReason: "stop" };
  });
});
afterEach(() => {
  document.body.replaceChildren();
  editorState.set({ currentMapId: null });
  vi.restoreAllMocks(); vi.unstubAllGlobals(); resetAiConnectionStatusCache();
});

function groupOrigin(): string | undefined {
  const project = store.getCurrent();
  const tileset = project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
  return tileset.tileGroups?.find(group => group.id === TILESET_GROUP)?.origin;
}

it("direct soft-confirm route reviews the normalized values and applies them equally", async () => {
  expect(groupOrigin()).toBe("ai");
  const mapId = store.getCurrent().startMapId;
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 30 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: ["place_props"] }),
    renderImages: async () => [{ label: "Current map", dataUrl: "data:image/png;base64,AA==" }],
  });
  const result = await session.sendUserMessage("Scatter soft props");
  expect(result.review?.status, result.error).toBe("approved");
  expect(result.appliedCalls ?? []).toEqual([]);
  // The reviewer already saw origin:user: normalization preceded review.
  expect(reviewRequests.length).toBeGreaterThanOrEqual(1);
  const changes = independentReviewPayload(reviewRequests[0]!)!.changes;
  const tilesetChange = changes.find(change => change.path === "/tilesets");
  expect(tilesetChange, JSON.stringify(changes.map(change => change.path))).toBeDefined();
  expect(JSON.stringify(tilesetChange!.after)).toContain('"origin":"user"');
  expect(groupOrigin()).toBe("ai");

  // The real direct proposal host applies exactly the reviewed candidate.
  const host = createProposalHost({ proposalNoticeHost: document.createElement("div"),
    controller: { session, auditHistory: [] },
    appendBubble: (_role, text) => { const node = document.createElement("div"); node.textContent = text; return node; },
    setStatus: () => {} });
  const beforeTiles = JSON.stringify(session.getProposedProject().tilesets);
  expect(await host.applyProposal(result.proposedCalls)).toBe("applied");
  expect(groupOrigin()).toBe("user");
  // Reviewed tilesets equal applied tilesets: no post-approval transformation.
  expect(JSON.stringify(store.getCurrent().tilesets)).toBe(beforeTiles);
  expect(history.getMapEditHistoryEntries()).toHaveLength(1);
  expect(history.undoMapEdit()).toBe(true);
  expect(groupOrigin()).toBe("ai");
}, 90000);
