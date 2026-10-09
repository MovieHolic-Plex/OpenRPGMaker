// Real session, tools, review parsing, apply and persistence; only model/transport/render endpoints are doubled.
// The deterministic renderer proves image capture/delivery/currentness, not pixel quality.
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { store } from "@/project/store";
import { AssistantSession, type AssistantSessionOptions, type SessionEvent } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import type { ReviewInput } from "@/ai/independentReview";
import type { OriginalContext } from "@/ai/originalContext";
import type { AcceptancePromise } from "@/ai/assistantAcceptance";

const PROJECT_ID = "rpg-zzu-test-project";

function installHermeticEnv(project: Project): void {
  resetIntentDeclarationCache();
  vi.useFakeTimers(); // Prevent unrelated autosave, never advance timers to synchronize.
  vi.stubEnv("VITE_LEGACY_DB_USE_PROXY", "0");
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", PROJECT_ID);
  vi.stubEnv("VITE_LEGACY_DB_URL", "http://smoke.invalid");
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  vi.stubGlobal("fetch", (async () => Response.json([])) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function toolCallResult(name: string, args: unknown, id: string): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [
    { id, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ] }, finishReason: "tool_calls" };
}

function finalResult(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" };
}

function exhausted(): never {
  throw Object.assign(new Error("scripted chat exhausted"), { name: "LlmError", status: 401 });
}

const ORCH_CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "auto" as const,
  baseUrl: "x", model: "supervisor-model", liteModel: "executor-model", apiKey: "sk",
  // Writer, planner and independent reviewer share budgets.
  maxToolCalls: 16, maxTokens: 16000,
};
const HOUSE_GOAL_AMBIGUOUS = "빈 맵에 집 하나 지어줘";
const selectionFooter = (mapId: string, mapName: string): string =>
  `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (0,0) 20×15`;
const houseGoal = (mapId: string, mapName: string): string =>
  `빈 맵에 야외 집 하나 지어줘\n\n${selectionFooter(mapId, mapName)}`;
const HOUSE_TITLE = "내 집 마을";
const IMAGE = { label: "Lifecycle renderer double", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==" };

function houseAcceptance(mapId: string): readonly AcceptancePromise[] {
  return [{ id: "house", title: "House on the existing map", criteria: [
    { kind: "targetChange", target: { mapId }, region: { x: 2, y: 1, w: 5, h: 6 } },
    { kind: "imageReviewed", target: { mapId } },
  ] }];
}

function housePlan(mapId: string) {
  return {
    goal: "빈 맵에 야외 집 하나 지어줘",
    acceptance: houseAcceptance(mapId),
    layers: [
      { title: "집 짓기", items: [{ title: "집 시공", instruction: `author_house {mapId:'${mapId}'}`, successTools: ["author_house"] }] },
      { title: "마무리", items: [{ title: "타이틀 확정", instruction: `set_title_screen {title:'${HOUSE_TITLE}'}`, successTools: ["set_title_screen"] }] },
    ],
  };
}

function houseWrite(mapId: string): ChatResult {
  return toolCallResult("author_house", {
    kind: "single", mapId, kitId: "blue-stone", wings: [{ x: 2, y: 1, w: 5, h: 6 }],
    interior: "exterior-only", door: true,
  }, "c_house");
}

function showMap(project: Project): ChatResult {
  const map = project.maps[project.startMapId]!;
  return toolCallResult("show_map_region", { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height }, "c_image");
}

function houseSteps(project: Project): ChatResult[] {
  const plan = housePlan(project.startMapId);
  return [
    finalResult(JSON.stringify({ action: "new_plan", ...plan })),
    toolCallResult("set_work_plan", plan, "c_plan"),
    houseWrite(project.startMapId),
    toolCallResult("set_title_screen", { title: HOUSE_TITLE }, "c_title"),
    showMap(project),
    finalResult("모든 레이어를 완료했습니다."),
  ];
}

function scriptedTransport(steps: ChatResult[]) {
  let index = 0;
  const reviews: ReviewInput[] = [];
  const reviewRequests: ChatRequest[] = [];
  const writerRequests: ChatRequest[] = [];
  const storesAtReview: Project[] = [];
  const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
    const review = independentReviewPayload(request);
    const approval = approvedReviewResponse(request);
    if (review && approval) {
      expect(request.tools).toEqual([]);
      expect(request.messages.map(message => message.role)).toEqual(["system", "user"]);
      reviews.push(review);
      reviewRequests.push(request);
      storesAtReview.push(structuredClone(store.getCurrent()));
      return approval;
    }
    if (request.tools?.length) writerRequests.push(request);
    return steps[index++] ?? exhausted();
  };
  return { chat, reviews, reviewRequests, writerRequests, storesAtReview, consumed: () => index };
}

function expectReviewedBatch(
  transport: ReturnType<typeof scriptedTransport>, baseline: Project, events: SessionEvent[], goal: string, toolNames: string[],
): void {
  expect(transport.reviews).toHaveLength(1);
  expect(transport.storesAtReview).toEqual([baseline]);
  expect(transport.reviews[0]?.originalRequest).toBe(goal);
  expect(transport.reviews[0]?.requiredProblems).toEqual([]);
  expect(events.filter(event => event.type === "result_review" || event.type === "milestone_applied").map(event => event.type))
    .toEqual(["result_review", "milestone_applied"]);
  expect(events.filter(event => event.type === "milestone_applied").map(event => event.toolCount)).toEqual([toolNames.length]);
  for (const name of toolNames) expect(transport.reviews[0]?.toolResults).toContainEqual(expect.objectContaining({
    name, result: expect.objectContaining({ ok: true }),
  }));
  const parts = transport.reviewRequests[0]?.messages.flatMap(message => Array.isArray(message.content) ? message.content : []) ?? [];
  expect(parts.filter(part => part.type === "image_url")).toEqual([{ type: "image_url", image_url: { url: IMAGE.dataUrl } }]);
  // This is the actual grounded writer request, before it returns any write calls.
  const firstWriter = transport.writerRequests[0]!;
  expect(firstWriter.tools?.map(tool => tool.function.name)).toEqual(expect.arrayContaining([
    "author_house", "set_title_screen", "get_database_records", "get_original_context",
  ]));
  const originalMessage = firstWriter.messages.find(message => message.role === "user"
    && typeof message.content === "string" && message.content.startsWith('{"originalContext":'));
  expect(originalMessage).toBeDefined();
  const original = JSON.parse(String(originalMessage!.content)) as {
    originalContext: Pick<OriginalContext, "target"> & { entries: { entryId: string; value: unknown }[] };
  };
  expect(original.originalContext.target.mapId).toBe(baseline.startMapId);
  expect(original.originalContext.entries.length).toBeGreaterThan(0);
}

const statusTexts = (session: AssistantSession): string[] =>
  session.getAuditEntries().filter(entry => entry.kind === "status").map(entry => entry.text);

function houseFixture(imageMode: "delivered" | "empty" | "error" = "delivered", ambiguous = false) {
  const project = createBlankProject();
  installHermeticEnv(project);
  const baseline = structuredClone(store.getCurrent());
  const steps = houseSteps(project);
  if (imageMode !== "delivered") steps.push(finalResult("재검수합니다."));
  const transport = scriptedTransport(steps);
  const renderImages = vi.fn<NonNullable<AssistantSessionOptions["renderImages"]>>(async () => {
    if (imageMode === "error") throw new Error("scripted-render-failure");
    return imageMode === "empty" ? [] : [IMAGE];
  });
  const session = new AssistantSession(project, {
    config: ORCH_CONFIG, chat: transport.chat, renderImages, yieldToUi: async () => {},
    // This fixture edits the existing map; it does not request a new interior/map.
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, targetMapId: project.startMapId,
      space: ambiguous ? "unclear" : "outdoor", clarify: ambiguous ? "실내 맵인가요, 야외 외장인가요?" : null }),
  });
  const goal = ambiguous
    ? `${HOUSE_GOAL_AMBIGUOUS}\n\n${selectionFooter(project.startMapId, project.maps[project.startMapId]!.name)}`
    : houseGoal(project.startMapId, project.maps[project.startMapId]!.name);
  const events: SessionEvent[] = [];
  const run = () => session.sendUserMessage(goal, event => events.push(event), undefined, { autonomous: true });
  return { project, baseline, steps, transport, renderImages, session, goal, events, run };
}

describe("자율 런 통합 스모크 (todo 7)", () => {
  it("자동 모드의 무표지 집 요청은 의도 확인을 건너뛰고 계획으로 진행한다", async () => {
    const f = houseFixture("delivered", true);
    const result = await f.run();
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(f.events.some(event => event.type === "work_plan")).toBe(true);
    expectReviewedBatch(f.transport, f.baseline, f.events, f.goal, ["author_house", "set_title_screen"]);
    expect(statusTexts(f.session).some(text => text.includes("agent_run:auto-continue"))).toBe(false);
    expect(f.transport.consumed()).toBe(f.steps.length);
  }, 60_000);

  it("작은 목표 — plan→build→verify→review→apply→save-audit 전체 생명주기 (remote OFF → agent_run_local_only)", async () => {
    const f = houseFixture();
    const result = await f.run();
    expect(result.stoppedReason, JSON.stringify({ error: result.error, statuses: statusTexts(f.session) })).toBe("final");
    const toolCalls = f.events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    expect(toolCalls.map(event => event.name)).toEqual([
      "set_work_plan", "author_house", "run_lint", "evaluate_game_quality", "set_title_screen", "run_lint", "show_map_region",
    ]);
    expect(toolCalls.find(event => event.name === "author_house")?.result.ok).toBe(true);
    expectReviewedBatch(f.transport, f.baseline, f.events, f.goal, ["author_house", "set_title_screen"]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["author_house", "set_title_screen"]);
    expect(result.proposedCalls).toEqual([]);
    const audits = statusTexts(f.session);
    expect(audits.filter(text => text.includes("agent_run:verification-pass"))).toHaveLength(2);
    expect(audits.some(text => text.includes("agent_run:verification_failed"))).toBe(false);
    expect(audits.filter(text => text.includes("agent_run:milestone-applied"))).toHaveLength(1);
    expect(audits.some(text => text.includes("agent_run_local_only"))).toBe(true);
    expect(audits.some(text => text.includes("agent_run_saved"))).toBe(false);
    expect(audits.some(text => text.includes("agent_run:save-failed"))).toBe(false);
    expect(store.getCurrent().meta.title).toBe(HOUSE_TITLE);
    expect(store.getCurrent().maps[f.project.startMapId]!.lowerTiles).not.toEqual(f.project.maps[f.project.startMapId]!.lowerTiles);
    expect(f.transport.consumed()).toBe(f.steps.length);
  }, 60_000);

  it("remote enabled(mocked) → accepted revision flush/read proof, never reloads editor state", async () => {
    const f = houseFixture();
    type Row = { project_id: string; current_json: Project; current_sha256: string };
    let row: Row | undefined;
    const requests: { path: string; method: string }[] = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      const method = init?.method ?? "GET";
      requests.push({ path, method });
      if (path === "/rest/v1/projects") {
        if (method === "GET") return Response.json(row ? [row] : []);
        row = JSON.parse(String(init?.body)) as Row;
        return Response.json(method === "PATCH" ? [row] : []);
      }
      if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
      throw new Error(`Unexpected transport: ${method} ${path}`);
    }));
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    const flush = vi.spyOn(store, "flush");
    const verify = vi.spyOn(store, "verifyPersistedRevision");
    const reload = vi.spyOn(store, "reloadFromRemote");
    const result = await f.run();
    expect(result.stoppedReason, result.error).toBe("final");
    expectReviewedBatch(f.transport, f.baseline, f.events, f.goal, ["author_house", "set_title_screen"]);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    const proof = f.session.getRunEndProof();
    expect(proof).toMatchObject({ status: "succeeded", verified: true, receipt: { projectId: PROJECT_ID } });
    expect(proof?.receipt).toBe((await flush.mock.results[0]!.value).receipt);
    expect(verify.mock.calls[0]?.[0]).toBe(proof?.receipt);
    expect(requests.filter(request => request.path === "/rest/v1/projects").map(request => request.method)).toEqual(["POST", "GET"]);
    expect(requests.filter(request => request.path === "/rest/v1/project_commits" && request.method === "GET")).toEqual([]);
    expect(row?.current_json.system.titleScreen?.title).toBe(HOUSE_TITLE);
    expect(row?.current_sha256).toMatch(/^[a-f0-9]{64}$/);
    const audits = statusTexts(f.session);
    expect(audits.filter(text => text.startsWith("agent_run_saved "))).toHaveLength(1);
    expect(audits.find(text => text.startsWith("agent_run_saved "))).toContain(`projectId=${PROJECT_ID}`);
    expect(audits.find(text => text.startsWith("agent_run_saved "))).toContain(`sha256=${row?.current_sha256}`);
    expect(audits.filter(text => text.includes("agent_run:verification-pass"))).toHaveLength(2);
    expect(audits.filter(text => text.includes("agent_run:milestone-applied"))).toHaveLength(1);
    expect(f.transport.consumed()).toBe(f.steps.length);
  }, 60_000);

  it.each(["empty", "error"] as const)("does not apply or credit spatial work when rendering is %s", async mode => {
    const f = houseFixture(mode);
    const result = await f.run();
    expect(result.stoppedReason).toBe("error");
    expect(f.renderImages).toHaveBeenCalled();
    expect(f.transport.reviews[0]?.requiredProblems).toEqual(expect.arrayContaining([expect.stringContaining("show_map_region")]));
    const parts = f.transport.reviewRequests[0]?.messages.flatMap(message => Array.isArray(message.content) ? message.content : []) ?? [];
    expect(parts.filter(part => part.type === "image_url")).toEqual([]);
    expect(result.review?.status).toBe("changes_requested");
    expect(f.events.some(event => event.type === "milestone_applied")).toBe(false);
    expect(store.getCurrent()).toEqual(f.baseline);
    expect(f.session.getRunEndProof()).toBeNull();
  }, 60_000);
});

describe("파괴적 마일스톤 독립 검수 적용 계약", () => {
  it("reset_project와 후속 집 시공은 검수 전 격리되고 승인된 일괄 적용으로 계속한다", async () => {
    const project = createBlankProject();
    installHermeticEnv(project);
    const baseline = structuredClone(store.getCurrent());
    const mapId = project.startMapId;
    const plan = {
      goal: "프로젝트 초기화 후 집 짓기",
      acceptance: houseAcceptance(mapId),
      layers: [
        { title: "초기화", items: [{ title: "프로젝트 초기화", instruction: "reset_project {prompt:'새 시작', title:'새 세계'}", successTools: ["reset_project"] }] },
        { title: "집 짓기", items: [{ title: "집 시공", instruction: `author_house {mapId:'${mapId}'}`, successTools: ["author_house"] }] },
      ],
    };
    const steps = [
      finalResult(JSON.stringify({ action: "new_plan", ...plan })),
      toolCallResult("set_work_plan", plan, "c_plan"),
      toolCallResult("reset_project", { prompt: "새 시작", title: "새 세계" }, "c_reset"),
      // Reset invalidates the old map's implicit spec; establish a new one on its draft.
      toolCallResult("set_build_spec", { mapId, assets: [{ id: "house", kind: "house", x: 2, y: 1, w: 5, h: 7 }] }, "c_spec"),
      houseWrite(mapId), showMap(project), finalResult("완료했습니다."),
    ];
    const transport = scriptedTransport(steps);
    const session = new AssistantSession(project, {
      config: ORCH_CONFIG, chat: transport.chat, renderImages: async () => [IMAGE], yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, targetMapId: mapId, space: "outdoor" }),
    });
    const events: SessionEvent[] = [];
    const goal = "프로젝트를 초기화하고 야외 집을 지어줘\n\n" + selectionFooter(mapId, project.maps[mapId]!.name);
    const result = await session.sendUserMessage(goal, event => events.push(event), undefined, { autonomous: true });
    expect(result.stoppedReason, JSON.stringify({ error: result.error,
      failures: session.getAuditEntries().filter(entry => entry.kind === "tool" && !entry.ok),
      statuses: statusTexts(session).filter(text => !text.startsWith("tools:exposed") && !text.startsWith("context:grounded")) })).toBe("final");
    expectReviewedBatch(transport, baseline, events, goal, ["reset_project", "author_house"]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["reset_project", "author_house"]);
    expect(events.some(event => event.type === "proposal_paused")).toBe(false);
    const audits = statusTexts(session);
    expect(audits.some(text => text.includes("agent_run:milestone-paused"))).toBe(false);
    expect(audits.some(text => text.includes("agent_run:milestone-skipped-paused"))).toBe(false);
    expect(audits.some(text => text.includes("agent_run:paused-approval"))).toBe(false);
    expect(store.getCurrent().meta.title).toBe("새 세계");
    expect(store.getCurrent().maps[mapId]!.lowerTiles).not.toEqual(project.maps[mapId]!.lowerTiles);
    expect(transport.consumed()).toBe(steps.length);
  }, 60_000);
});
