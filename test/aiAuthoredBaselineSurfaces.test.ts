// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, chatCompletion, defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import * as history from "@/editor/mapEditHistory";
import * as commits from "@/project/projectCommitLog";
import { createProposalHost } from "@/editor/panels/aiProposalCard";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { approvedReviewResponse } from "./independentReviewFixture";
import { isWikiExtraction } from "./wikiTransportFixture";
import { fixedDeclarer } from "./intentFixture";

vi.mock("@/ai/llmClient", async importOriginal => ({
  ...await importOriginal<typeof import("@/ai/llmClient")>(), chatCompletion: vi.fn(),
}));
vi.mock("@/ai/yieldToUi", () => ({ defaultYieldToUi: async () => {} }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10, maxTokens: 16000 }));
  resetAiConnectionStatusCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  history.resetMapEditHistory();
  let wrote = false;
  vi.mocked(chatCompletion).mockReset().mockImplementation(async (_config, request) => {
    if (isWikiExtraction(request.messages)) return { message: { role: "assistant", content: '{"upserts":[]}' }, finishReason: "stop" };
    const review = approvedReviewResponse(request);
    if (review) return review;
    if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "new_plan", goal: "Change title", layers: [{ title: "Title", items: [{
      title: "Title", instruction: "set_title_screen", successTools: ["set_title_screen"],
    }] }] }) }, finishReason: "stop" };
    if (wrote) return { message: { role: "assistant", content: "Finished" }, finishReason: "stop" };
    wrote = true;
    return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
      name: "set_title_screen", arguments: JSON.stringify({ title: "Reviewed title", reason: "Change requested title" }),
    } }] }, finishReason: "tool_calls" };
  });
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-modal-close"]')?.click();
  document.body.replaceChildren();
  editorState.set({ currentMapId: null });
  vi.restoreAllMocks(); vi.unstubAllGlobals(); resetAiConnectionStatusCache();
});

function editPrice(): void {
  store.update(project => {
    const potion = project.database.items.find(item => item.id === "item_potion");
    if (!potion) throw new Error("Missing potion fixture");
    potion.price = 9876;
  });
}

function observeApply() {
  return [vi.spyOn(history, "recordProjectSnapshot"), vi.spyOn(commits, "recordProjectCommit"), vi.spyOn(store, "replace")];
}

// Exact DOM publication, subscribed before kickoff/click, with a rejecting deadline.
function whenDom(predicate: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!predicate()) return;
      clearTimeout(timeout); observer.disconnect(); resolve();
    });
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Surface did not settle")); }, 60000);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  });
}

it.each(["ordinary", "direct"] as const)("rejects %s proposal host apply after approval, even if public prompt context is refreshed", async route => {
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: ["set_title_screen"] }),
  });
  const result = await session.sendUserMessage("Change title");
  expect(result.review?.status).toBe("approved");
  const host = createProposalHost({ proposalNoticeHost: document.createElement("div"), controller: { session, auditHistory: [] },
    appendBubble: (_role, text) => { const node = document.createElement("div"); node.textContent = text; return node; }, setStatus: () => {} });
  editPrice();
  // A prompt refresh is not regeneration and must not rewrite apply authority.
  session.refreshProjectContext(store.getCurrent());
  if (route === "ordinary") session.refreshAcceptance(store.getCurrent());
  const live = structuredClone(store.getCurrent());
  const observed = observeApply();
  expect(await host.applyProposal(result.proposedCalls)).toBe("rejected");
  expect(session.isDraftReviewApproved()).toBe(false);
  expect(store.getCurrent()).toEqual(live);
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
  for (const spy of observed) expect(spy).not.toHaveBeenCalled();
});

it("rejects the real cluster acceptance button after a reviewed draft's base changes", async () => {
  const sending = vi.spyOn(AssistantSession.prototype, "sendUserMessage");
  openClusterAiModal({ kind: "range-classify", tilesetId: DEFAULT_TILESET_ID, rect: { x: 0, y: 0, w: 1, h: 1 }, tileIds: [322] });
  expect(sending, document.body.textContent ?? "").toHaveBeenCalledTimes(1);
  const result = await sending.mock.results[0]?.value;
  expect(result).toMatchObject({ review: { status: "approved" } });
  const session = sending.mock.contexts[0];
  if (!(session instanceof AssistantSession)) throw new Error("Missing real cluster session");
  expect(session.getResultReview()?.status).toBe("approved");
  editPrice();
  const live = structuredClone(store.getCurrent());
  const observed = observeApply();
  const status = document.querySelector('[data-testid="cluster-ai-status"]');
  const previous = status?.textContent;
  const settled = whenDom(() => status?.textContent !== previous);
  const accept = document.querySelector('[data-testid="cluster-ai-accept"]');
  if (!(accept instanceof HTMLButtonElement)) throw new Error("Missing cluster accept button");
  accept.click();
  await settled;
  expect(session.isDraftReviewApproved()).toBe(false);
  expect(store.getCurrent()).toEqual(live);
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
  for (const spy of observed) expect(spy).not.toHaveBeenCalled();
  expect(document.querySelector('[data-testid="cluster-ai-accept"]')).toBe(accept);
});
