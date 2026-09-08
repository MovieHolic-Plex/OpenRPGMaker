import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ReviewInput } from "@/ai/independentReview";
import { independentReviewPayload as payload } from "./independentReviewFixture";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { llmSolver, runGoldenTask } from "@/evals/runner";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import type { SessionEvent } from "@/ai/assistantSession";
import { fixedDeclarer } from "./intentFixture";

const text = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const write = (price: number): ChatResult => ({ message: { role: "assistant", content: null, tool_calls: [{
  id: `write_${price}`, type: "function", function: { name: "upsert_item", arguments: JSON.stringify({
    item: { id: "item_potion", price }, reason: "Set the requested price" }), },
}] }, finishReason: "tool_calls" });

describe("independent result review", () => {
  it("requests a change, repairs the same draft, and reviews the new revision without writer conversation", async () => {
    const project = createBlankProject();
    const reviews: ReviewInput[] = [];
    let writerCalls = 0;
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12 },
      declareIntent: fixedDeclarer({ mode: "modify", tools: ["upsert_item"],
        readBeforeWrite: { project: true, collections: ["items"], references: true } }),
      priorTranscript: "PRIVATE_WRITER_HISTORY",
      chat: async (_config, request) => {
        const evidence = payload(request);
        if (evidence) {
          expect(request.tools ?? []).toEqual([]);
          expect(request.tool_choice).toBe("none");
          expect(request.messages.map(message => message.role)).toEqual(["system", "user"]);
          expect(JSON.stringify(request.messages)).not.toContain("PRIVATE_WRITER_HISTORY");
          expect(JSON.stringify(request.messages)).not.toContain("WRITER_SUCCESS_SENTINEL");
          reviews.push(evidence);
          return text("```json\n" + JSON.stringify({ revision: evidence.revision, verdict: reviews.length === 1 ? "changes_requested" : "approved",
            summary: "Price inspection", findings: reviews.length === 1 ? [{ id: "price", target: "/database/items/item_potion",
              problem: "Price is 321, expected 654", requestedChange: "Set price to 654", validation: "Read price and assert 654" }] : [] }) + "\n```");
        }
        writerCalls++;
        if (writerCalls === 1) return write(321);
        if (writerCalls === 3) {
          const feedback = request.messages.map(message => typeof message.content === "string" ? message.content : "")
            .find(content => content.includes('"requestedChange":'))!;
          const parsedFeedback: unknown = JSON.parse(feedback.slice(feedback.indexOf("\n{") + 1));
          expect(parsedFeedback).toMatchObject({ findings: [{ requestedChange: "Set price to 654" }] });
          return { message: { role: "assistant", content: null, tool_calls: [{ id: "fresh", type: "function", function: {
            name: "get_database_records", arguments: JSON.stringify({ collection: "items", ids: ["item_potion"], include: "full" }) } }] }, finishReason: "tool_calls" };
        }
        if (writerCalls === 4) return write(654);
        return text("WRITER_SUCCESS_SENTINEL");
      },
    });
    const result = await session.sendUserMessage("Set potion price to 654");
    expect(reviews, result.error).toHaveLength(2);
    expect(reviews[0]?.revision).not.toBe(reviews[1]?.revision);
    expect(reviews[0]?.originalRequest).toBe("Set potion price to 654");
    expect(reviews[0]?.changes).toContainEqual(expect.objectContaining({ path: "/database/items/item_potion",
      before: expect.objectContaining({ price: project.database.items.find(item => item.id === "item_potion")!.price }),
      after: expect.objectContaining({ price: 321 }) }));
    expect(reviews[1]?.changes).toContainEqual(expect.objectContaining({ path: "/database/items/item_potion", after: expect.objectContaining({ price: 654 }) }));
    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls.length).toBeGreaterThan(0);
    expect(session.getProposedProject().database.items.find(item => item.id === "item_potion")?.price).toBe(654);
    expect(project.database.items.find(item => item.id === "item_potion")?.price).not.toBe(654);
  });
});


beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function call(name: string, args: object): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [{ id: name, type: "function",
    function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
}
function approval(revision: number): ChatResult {
  return text(JSON.stringify({ revision, verdict: "approved", summary: "Reviewed title", findings: [] }));
}
function changeRequest(revision: number, problem = "Wrong title"): ChatResult {
  return text(JSON.stringify({ revision, verdict: "changes_requested", summary: "Title needs repair", findings: [{
    id: "title", target: "/system/titleScreen", problem, requestedChange: "Change title", validation: "Read title" }] }));
}
function fixture(options: {
  reviewer?: (evidence: ReviewInput, request: ChatRequest) => Promise<ChatResult> | ChatResult;
  rounds?: ChatResult[];
  maxToolCalls?: number;
  maxTokens?: number;
  renderImages?: import("@/ai/assistantSession").ToolImageRenderer;
} = {}) {
  const project = createBlankProject();
  const requests: ChatRequest[] = [];
  const reviewRequests: ChatRequest[] = [];
  const rounds = options.rounds ?? [call("set_title_screen", { title: "Reviewed title" })];
  const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: options.maxToolCalls ?? 15,
      maxTokens: options.maxTokens ?? 16000 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: [] }),
    renderImages: options.renderImages,
    chat: async (_config, request) => {
      const evidence = payload(request);
      if (evidence) {
        reviewRequests.push(request);
        return options.reviewer ? options.reviewer(evidence, request) : approval(evidence.revision);
      }
      requests.push(request);
      return rounds[requests.length - 1] ?? text("Writer finished");
    },
  });
  return { project, session, requests, reviewRequests };
}

describe("review termination and isolation", () => {
  it.each(["malformed", "transport", "write", "stale"])("stops honestly on %s reviewer output", async mode => {
    const f = fixture({ reviewer: evidence => {
      if (mode === "transport") throw new Error("review transport rejected");
      if (mode === "write") return call("reset_project", {});
      return mode === "stale" ? approval(evidence.revision - 1) : text("not JSON");
    } });
    const result = await f.session.sendUserMessage("Change title");
    expect(result.stoppedReason).toBe("error");
    expect(result.review?.status).toBe("error");
    expect(f.reviewRequests).toHaveLength(1);
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(f.session.getProposedProject().maps).toEqual(f.project.maps);
  });
  it("stops on repeated unchanged findings instead of granting approval", async () => {
    const f = fixture({ reviewer: evidence => changeRequest(evidence.revision) });
    const result = await f.session.sendUserMessage("Change title");
    expect(f.reviewRequests).toHaveLength(2);
    expect(result.stoppedReason).toBe("error");
    expect(result.review?.status).toBe("changes_requested");
    expect(f.session.isDraftReviewApproved()).toBe(false);
  });
  it.each(["round", "writer-tokens", "review-tokens"])("shares the existing %s budget", async boundary => {
    const output = call("set_title_screen", { title: "Budget draft" });
    if (boundary === "writer-tokens") output.usage = { completion_tokens: 100 };
    const f = fixture({ maxToolCalls: boundary === "round" ? 2 : 10, maxTokens: boundary === "round" ? 16000 : 100,
      rounds: [output], reviewer: evidence => ({ ...approval(evidence.revision), usage: { completion_tokens: 100 } }) });
    const result = await f.session.sendUserMessage("Change title");
    expect(result.stoppedReason).toBe(boundary === "round" ? "max-tool-calls" : "token-budget");
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(f.reviewRequests).toHaveLength(boundary === "review-tokens" ? 1 : 0);
  });
  it("does not review or execute writes in ask mode", async () => {
    const f = fixture();
    const result = await f.session.sendUserMessage("What is the title?", () => {}, undefined, { composerMode: "ask" });
    expect(f.reviewRequests).toHaveLength(0);
    expect(result.proposedCalls).toEqual([]);
    expect(f.session.getProposedProject()).toEqual(f.project);
  });
  it("does not review a no-write direct question", async () => {
    const f = fixture({ rounds: [text("A title")] });
    await f.session.sendUserMessage("What is the title?");
    expect(f.reviewRequests).toHaveLength(0);
  });
  it("rejects a write after cancellation during the pre-tool UI yield", async () => {
    const f = fixture(), controller = new AbortController();
    const result = await f.session.sendUserMessage("Change title", event => {
      if (event.type === "tool_started") controller.abort();
    }, controller.signal);
    expect(result.stoppedReason).toBe("aborted");
    expect(f.session.getProposedProject()).toEqual(f.project);
    expect(f.reviewRequests).toHaveLength(0);
    const messages = f.session.getMessages();
    expect(messages.filter(message => message.role === "tool")).toHaveLength(1);
  });
  it("ignores a late approval after cancellation without further mutations", async () => {
    const controller = new AbortController();
    let entered!: () => void, resolveReview!: (result: ChatResult) => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    let revision = 0;
    const f = fixture({ reviewer: evidence => {
      revision = evidence.revision;
      entered();
      return new Promise(resolve => { resolveReview = resolve; });
    } });
    const turn = f.session.sendUserMessage("Change title", () => {}, controller.signal);
    const deadline = AbortSignal.timeout(60000);
    const expired = new Promise<never>((_resolve, reject) => deadline.addEventListener("abort", () => reject(new Error("Review hold deadline exceeded")), { once: true }));
    await Promise.race([ready, expired]);
    const beforeCancel = f.session.getProposedProject();
    controller.abort();
    resolveReview(approval(revision));
    const result = await Promise.race([turn, expired]);
    expect(result.stoppedReason).toBe("aborted");
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(f.session.getProposedProject()).toEqual(beforeCancel);
  });
  it("invalidates approval after edits, and undo cannot revive it", async () => {
    const f = fixture();
    const result = await f.session.sendUserMessage("Change title");
    expect(result.review?.status).toBe("approved");
    const approved = f.session.getProposedProject(), changed = structuredClone(approved);
    changed.meta.title = "Changed after review";
    expect(f.session.isDraftReviewApproved(changed)).toBe(false);
    f.session.rebaseProject(changed);
    f.session.rebaseProject(approved);
    expect(f.session.getResultReview()?.status).toBe("unapproved");
  });
  it("cannot turn a failed actual scene test into approval", async () => {
    const f = fixture({ rounds: [call("set_title_screen", { title: "Draft" }),
      call("run_scene_test", { mapId: "missing", start: { x: 0, y: 0 }, steps: [] })] });
    const result = await f.session.sendUserMessage("Change title and test scene");
    expect(result.review?.status).toBe("changes_requested");
    expect(payload(f.reviewRequests[0]!)?.toolResults).toEqual(expect.arrayContaining([expect.objectContaining({
      name: "run_scene_test", result: expect.objectContaining({ ok: true, data: expect.objectContaining({ ok: false }) }),
    })]));
    expect(result.review?.findings.some(finding => finding.problem.includes("run_scene_test"))).toBe(true);
    expect(f.session.isDraftReviewApproved()).toBe(false);
  });
  it.each(["approved", "rejected"])("defers autonomous milestones until the independent verdict is %s", async verdict => {
    const f = fixture({ reviewer: evidence => {
      expect(store.getCurrent().system).toEqual(f.project.system);
      return verdict === "approved" ? approval(evidence.revision) : changeRequest(evidence.revision);
    } });
    store.replace(f.project);
    resetMapEditHistory();
    const events: SessionEvent[] = [];
    const result = await f.session.sendUserMessage("Change title", event => events.push(event), undefined, { autonomous: true });
    const applied = events.filter(event => event.type === "milestone_applied");
    expect(applied).toHaveLength(verdict === "approved" ? 1 : 0);
    if (verdict === "approved") {
      expect(result.appliedCalls?.map(entry => entry.name)).toEqual(["set_title_screen"]);
      expect(result.proposedCalls).toEqual([]);
      expect(events.findIndex(event => event.type === "result_review")).toBeLessThan(events.findIndex(event => event.type === "milestone_applied"));
    } else expect(store.getCurrent().system).toEqual(f.project.system);
  });
});


describe("review evidence and final revision boundaries", () => {
  it.each(["delivered", "empty", "error"])("requires actual visual evidence after spatial changes: %s", async mode => {
    const mapId = createBlankProject().startMapId;
    const f = fixture({ rounds: [call("set_work_plan", { goal: "Resize map", layers: [{ title: "Resize", items: [{
      title: "Resize", instruction: "Resize map" }] }], acceptance: [{ id: "dimensions", title: "Dimensions", criteria: [{
      kind: "mapDimensions", target: { mapId }, width: 21, height: 15 }] }] }), call("skip_work_item", {}),
      call("resize_map", { mapId, width: 21, height: 15 }), call("show_map_region", { mapId, x: 0, y: 0, w: 21, h: 15 })],
      renderImages: async () => {
        if (mode === "error") throw new Error("Image render failed");
        return mode === "empty" ? [] : [{ label: "Current map", dataUrl: "data:image/png;base64,AA==" }];
      } });
    const result = await f.session.sendUserMessage("Resize map");
    expect(result.review?.status).toBe(mode === "delivered" ? "approved" : "changes_requested");
    const parts = f.reviewRequests[0]?.messages.flatMap(message => Array.isArray(message.content) ? message.content : []) ?? [];
    expect(parts.filter(part => part.type === "image_url")).toHaveLength(mode === "delivered" ? 1 : 0);
    if (mode !== "delivered") expect(result.review?.findings.some(finding => finding.problem.includes("show_map_region"))).toBe(true);
  });
  it("reviews the surface-prepared draft, not a pre-clipping revision", async () => {
    const f = fixture();
    f.session.setReviewDraftTransform(project => {
      project.system.titleScreen!.title = "Prepared title";
      return project;
    });
    const result = await f.session.sendUserMessage("Change title");
    expect(result.review?.status).toBe("approved");
    expect(payload(f.reviewRequests[0]!)?.changes).toContainEqual(expect.objectContaining({ path: "/system",
      after: expect.objectContaining({ titleScreen: expect.objectContaining({ title: "Prepared title" }) }) }));
    expect(f.session.isDraftReviewApproved()).toBe(true);
  });
  it("rejects a draft replaced while a review is in flight", async () => {
    const f = fixture({ reviewer: evidence => {
      const changed = f.session.getProposedProject();
      changed.system.titleScreen!.title = "Concurrent edit";
      f.session.rebaseProject(changed);
      return approval(evidence.revision);
    } });
    const result = await f.session.sendUserMessage("Change title");
    expect(result.stoppedReason).toBe("error");
    expect(result.review?.status).toBe("error");
    expect(f.session.isDraftReviewApproved()).toBe(false);
  });
  it("cannot continue forever by paraphrasing failures without repairing", async () => {
    let round = 0;
    const f = fixture({ reviewer: evidence => {
      return changeRequest(evidence.revision, `Distinct failure ${++round}`);
    } });
    const result = await f.session.sendUserMessage("Change title");
    expect(f.reviewRequests).toHaveLength(3);
    expect(result.stoppedReason).toBe("error");
    expect(f.session.isDraftReviewApproved()).toBe(false);
  });
  it("cannot apply an autonomous draft when cancelled by the approval event", async () => {
    const f = fixture(), controller = new AbortController();
    store.replace(f.project); resetMapEditHistory();
    const result = await f.session.sendUserMessage("Change title", event => {
      if (event.type === "result_review") controller.abort();
    }, controller.signal, { autonomous: true });
    expect(result.stoppedReason).toBe("aborted");
    expect(store.getCurrent().system).toEqual(f.project.system);
    expect(f.session.isDraftReviewApproved()).toBe(false);
  });
});


describe("evaluation evidence integration", () => {
  it.each(["approved", "rejected"])("retains the %s independent verdict alongside actual draft scoring", async verdict => {
    let round = 0;
    const result = await runGoldenTask({ id: "review-title", prompt: "Change title", initialProject: createBlankProject,
      matchers: [{ describe: "Requested title exists", check: project => project.system.titleScreen?.title === "Measured title" }] },
    llmSolver({ config: { ...defaultAiConfig(), agentMode: "chat", autonomyLevel: undefined, maxToolCalls: 10 }, chat: async (_config, request) => {
      const input = payload(request);
      if (input) return verdict === "approved" ? approval(input.revision) : changeRequest(input.revision);
      return round++ === 0 ? call("set_title_screen", { title: "Measured title" }) : text("Writer finished");
    } }));
    expect(result.score.matcherResults[0]?.passed, result.error ?? result.audit).toBe(true);
    expect(result.review?.status).toBe(verdict === "approved" ? "approved" : "changes_requested");
    if (verdict === "rejected") {
      expect(result.score.passed).toBe(false);
      expect(result.error).toBeDefined();
    } else expect(result.error).toBeUndefined();
    expect(result.audit).toBeDefined();
  });
});


describe("no-write authoring and authored start-state review", () => {
  it.each(["acceptance", "completion"])("blocks a no-write authoring result with unmet %s requirements before publishing success", async requirement => {
    const project = createBlankProject();
    const events: SessionEvent[] = [];
    let writerCalls = 0, reviewCalls = 0;
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10 },
      declareIntent: fixedDeclarer(requirement === "acceptance" ? { mode: "create", targetMapId: project.startMapId }
        : { mode: "create", adventure: { village: false, dungeon: false, party: false, battle: true } }),
      chat: async (_config, request) => {
        if (payload(request)) reviewCalls++;
        else writerCalls++;
        return text("UNSUPPORTED_AUTHORING_SUCCESS");
      },
    });
    const result = await session.sendUserMessage("Author the requested content", event => events.push(event));
    expect(result.proposedCalls).toEqual([]);
    expect(result.stoppedReason).toBe("error");
    expect(writerCalls).toBeGreaterThan(1);
    expect(writerCalls).toBeLessThanOrEqual(4);
    expect(reviewCalls).toBe(0);
    expect(events.filter(event => event.type === "assistant_message").map(event => event.type === "assistant_message" && event.content))
      .not.toContain("UNSUPPORTED_AUTHORING_SUCCESS");
    expect(session.getProposedProject()).toEqual(project);
  });
  it("reviews authored start-state party, inventory and gold as actual data", async () => {
    const project = createBlankProject();
    const actorId = project.database.actors[0]!.id;
    const f = fixture({ rounds: [
      call("get_database_records", { collection: "actors", ids: [actorId], include: "full" }),
      call("get_database_records", { collection: "items", ids: ["item_potion"], include: "full" }),
      call("set_session_start", { partyActorIds: [actorId], inventory: { item_potion: 3 }, gold: 654 }),
      call("upsert_test_preset", { preset: { id: "review_start", name: "Starting inventory", inventory: { item_potion: 5 }, gold: 321 } }),
    ] });
    const result = await f.session.sendUserMessage("Set authored starting party, inventory and gold");
    expect(result.review?.status, result.error).toBe("approved");
    expect(payload(f.reviewRequests[0]!)?.changes).toContainEqual({ path: "/session", before: f.project.session,
      after: f.session.getProposedProject().session });
    expect(f.session.getProposedProject().session).toMatchObject({ partyActorIds: [actorId], inventory: { item_potion: 3 }, gold: 654 });
    expect(payload(f.reviewRequests[0]!)?.changes).toContainEqual(expect.objectContaining({ path: "/testPresets",
      after: expect.arrayContaining([expect.objectContaining({ id: "review_start", inventory: { item_potion: 5 }, gold: 321 })]) }));
    expect(f.project.session.gold).not.toBe(654);
  });
});
