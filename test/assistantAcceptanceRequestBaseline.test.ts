import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import type { AcceptancePromise } from "@/ai/assistantAcceptance";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import * as commits from "@/project/projectCommitLog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse, independentReviewPayload, imageDeliveryForRequest } from "./independentReviewFixture";
import type { ReviewInput } from "@/ai/independentReview";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

type Call = { readonly name: string; readonly args: Record<string, unknown> };
const room = { mapId: "request-a-room" };
const start = { mapId: createBlankProject().startMapId };
const region = { x: 0, y: 0, w: 2, h: 2 };
const twoStepItems = [
  { id: "edit", title: "First", instruction: "Rename the room" },
  { id: "verify", title: "Second", instruction: "Check preservation" },
];
function plan(acceptance?: readonly AcceptancePromise[], items = [{ id: "edit", title: "Edit", instruction: "Edit the map" }]): Call {
  return { name: "set_work_plan", args: {
    goal: "Request baseline contract",
    layers: [{ title: "Edit", items }],
    ...(acceptance ? { acceptance } : {}),
  } };
}
const skip: Call = { name: "skip_work_item", args: {} };
const rename = (mapId: string, name: string): Call => ({ name: "set_map_properties", args: { mapId, name } });

async function afterRequestA() {
  // Keep the real captured-baseline apply guard, store, undo, and commit adapter.
  const project = createBlankProject();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  const commit = vi.spyOn(commits, "recordProjectCommit");
  let rounds: readonly (readonly Call[])[] = [];
  let index = 0;
  const events: SessionEvent[] = [];
  const reviews: ReviewInput[] = [];
  const declareIntent = vi.fn(fixedDeclarer({ mode: "modify", targetMapId: start.mapId }));
  const config = { ...defaultAiConfig(), maxToolCalls: 12 };
  const session = new AssistantSession(project, {
    config: { ...config, agentMode: "chat" },
    declareIntent,
    renderImages: async () => [{ label: "Request A room", dataUrl: "data:image/png;base64,AA==" }],
    chat: async (_config, request): Promise<ChatResult> => {
      const review = independentReviewPayload(request);
      const approval = approvedReviewResponse(request);
      if (review && approval) { reviews.push(review); return approval; }
      // New user requests are adopted by the main planner, not by resetting IDs in a generator repair.
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "replan", ...rounds[0]?.find(call => call.name === "set_work_plan")?.args }) }, finishReason: "stop" };
      const batch = rounds[index++];
      const imageDelivery = imageDeliveryForRequest(request);
      return batch ? { imageDelivery, message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({
        id: `call-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" }
        : { imageDelivery, message: { role: "assistant", content: "SCRIPTED_SUCCESS" }, finishReason: "stop" };
    },
  });
  const run = async (batches: readonly (readonly Call[])[], autonomous = true) => {
    rounds = batches; index = 0; events.length = 0; reviews.length = 0;
    const targetMapId = batches.flat().find(call => call.name === "set_map_properties")?.args.mapId;
    if (typeof targetMapId === "string") declareIntent.mockImplementation(fixedDeclarer({ mode: "modify", targetMapId }));
    return session.sendUserMessage("Edit the requested map", event => events.push(event), undefined, { autonomous });
  };
  await run([
    [plan([
      { id: "created", title: "Created room", criteria: [{ kind: "mapDimensions", target: { newMapName: "Request A room" }, width: 20, height: 15 }] },
      { id: "original-change", title: "Original change", criteria: [{ kind: "targetChange", target: start }] },
    ])],
    [{ name: "create_map", args: { id: room.mapId, name: "Request A room", width: 20, height: 15 } }, rename(start.mapId, "Request A start"), skip],
    [{ name: "show_map_region", args: { mapId: room.mapId, x: 0, y: 0, w: 20, h: 15 } }],
  ]);
  expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
  expect(session.baselineProject.maps[room.mapId]).toBeDefined();
  return { session, events, reviews, run, declareIntent, config, commit };
}

describe("per-request acceptance baselines", () => {
  it("preserves a map created in A while B changes another map", async () => {
    // Given A's applied map and retained promises.
    const { session, run } = await afterRequestA();
    // When B adopts new preservation/change promises and changes only its target.
    await run([[plan([
      { id: "keep-room", title: "Keep room", criteria: [{ kind: "preserve", target: room }] },
      { id: "change-again", title: "Change again", criteria: [{ kind: "targetChange", target: start }] },
    ]), rename(start.mapId, "Request B start"), skip]]);
    // Then old and new promises all verify against their own request snapshots.
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [
      { id: "created", status: "verified" }, { id: "original-change", status: "verified" },
      { id: "keep-room", status: "verified" }, { id: "change-again", status: "verified" },
    ] });
  });

  it("does not credit A's change toward a newly accepted B change promise", async () => {
    // Given an already changed map at the start of B.
    const { session, run } = await afterRequestA();
    // When B promises another change but only skips its execution item.
    await run([[plan([{ id: "change-again", title: "Change again", criteria: [{ kind: "targetChange", target: start }] }]), skip]]);
    // Then the original change remains verified, but the new promise fails.
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [
      { id: "created", status: "verified" }, { id: "original-change", status: "verified" },
      { id: "change-again", evidence: [{ passed: false }] },
    ] });
  });

  // 2026-09-17 결정적 검사: 수용(acceptance) 항목은 승인 조건이 아니다. lint error 0 이면 초안은 승인·적용되고,
  // 늦게 채택된 약속은 여전히 B 의 요청 시작 기준선(A 가 적용한 방)으로 평가된다 — 기준선이 초안으로 밀리지 않는다.
  it.each([false, true])("late adoption cannot baseline away B's earlier write (completed=%s)", async completed => {
    const { session, run, events, reviews, commit } = await afterRequestA();
    const authored = structuredClone(store.getCurrent());
    const history = getMapEditHistoryEntries();
    commit.mockClear();
    // When the late plan protects both the whole map and its untouched tile region.
    const result = await run([
      [plan(), rename(room.mapId, "Changed before adoption"), ...(completed ? [{ name: "complete_work_item", args: {} }] : [])],
      [plan([
        { id: "keep-room", title: "Keep room", criteria: [{ kind: "preserve", target: room }] },
        { id: "keep-region", title: "Keep region", criteria: [{ kind: "preserve", target: room, region }] },
        { id: "changed-room", title: "Changed room", criteria: [{ kind: "targetChange", target: room }] },
      ]), skip],
    ]);
    expect(events.filter(event => event.type === "tool_call" && event.name === "set_map_properties")).toMatchObject([{ result: { ok: true } }]);
    if (completed) expect(events.find(event => event.type === "tool_call" && event.name === "complete_work_item")).toMatchObject({ result: { ok: true } });
    // The ledger measures against A's applied room, not B's already-mutated draft.
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [
      { id: "created" }, { id: "original-change" },
      { id: "keep-room", evidence: [{ passed: false }] }, { id: "keep-region", status: "verified" },
      { id: "changed-room", status: "verified" },
    ] });
    // 검수 모델은 호출되지 않고, 결정적 검사가 승인해 자율 런이 초안을 적용한다 …
    expect(reviews).toHaveLength(0);
    expect(events.some(event => event.type === "result_review" && event.review.status === "approved")).toBe(true);
    expect(events.some(event => event.type === "milestone_applied")).toBe(true);
    expect(store.getCurrent().maps[room.mapId]?.name).toBe("Changed before adoption");
    expect(store.getCurrent()).not.toEqual(authored);
    expect(getMapEditHistoryEntries().length).toBeGreaterThan(history.length);
    expect(commit).toHaveBeenCalled();
    // … 그러나 열린 수용 원장은 쓰기 없는 수리 라운드를 상한까지만 돌리고 정직하게 멈춘다.
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("완료 검증이 아직 미완성입니다");
    expect(result.error).toContain("Keep room");
  });

  it("retains B's pre-write baseline across budget-driven synthetic continuation", async () => {
    // B's first item consumes the writer budget, with another item still open.
    const { session, run, events, reviews, config, commit } = await afterRequestA();
    const authored = structuredClone(store.getCurrent());
    commit.mockClear();
    session.updateConfig({ ...config, agentMode: "chat", maxToolCalls: 4 });
    const result = await run([
      [plan(undefined, twoStepItems)],
      [rename(room.mapId, "Changed in first step")],
      [{ name: "complete_work_item", args: {} }],
      [{ name: "get_project_summary", args: {} }],
      [plan([
        { id: "keep-room", title: "Keep room", criteria: [{ kind: "preserve", target: room }] },
        { id: "changed-room", title: "Changed room", criteria: [{ kind: "targetChange", target: room }] },
      ], twoStepItems), skip],
    ]);
    // 예산 소진은 초안 폐기가 아니다: 결정적 검사를 통과한 초안은 final 로 넘어간다. One continuation
    // adopts the late promise; another exhausts the no-write acceptance repair path.
    expect(reviews).toHaveLength(0);
    expect(result.recap?.process.filter(step => step.kind === "continue")).toHaveLength(2);
    // The late promise is still measured against B's pre-write baseline (A's applied room).
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [
      { id: "created" }, { id: "original-change" },
      { id: "keep-room", evidence: [{ passed: false }] }, { id: "changed-room", status: "verified" },
    ] });
    expect(events.some(event => event.type === "result_review" && event.review.status === "approved")).toBe(true);
    expect(events.some(event => event.type === "milestone_applied")).toBe(true);
    expect(store.getCurrent().maps[room.mapId]?.name).toBe("Changed in first step");
    expect(store.getCurrent()).not.toEqual(authored);
    expect(commit).toHaveBeenCalled();
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("완료 검증이 아직 미완성입니다");
  });

  it("retains B's baseline when a manual continuation repairs and replans an unapplied draft", async () => {
    // Missing criteria no longer block application, but repair must not turn the draft into a new baseline.
    const { session, run, declareIntent, reviews, events, commit } = await afterRequestA();
    commit.mockClear();
    const first = await run([[plan([{ id: "repair", title: "Original repair", criteria: null }]), rename(room.mapId, "B changed room"), skip]]);
    // The deterministic check approves and the autonomous run applies; the malformed promise still stops the run.
    expect(events.some(event => event.type === "milestone_applied")).toBe(true);
    expect(store.getCurrent().maps[room.mapId]?.name).toBe("B changed room");
    expect(first.stoppedReason).toBe("error");
    expect(first.error).toContain("완료 검증이 아직 미완성입니다");
    declareIntent.mockImplementation(fixedDeclarer({ mode: "modify", targetMapId: room.mapId, source: "continuation" }));
    // When a continuation repairs the old promise and adds a new one without new writes.
    const result = await run([
      [plan([
        { id: "repair", title: "Replacement", criteria: [{ kind: "eventCount", target: room, count: 0 }] },
        { id: "changed-room", title: "Changed room", criteria: [{ kind: "targetChange", target: room }] },
      ])],
      [{ name: "repair_acceptance", args: { itemId: "repair", criteria: [{ kind: "preserve", target: room }] } }, skip],
    ]);
    // Then repair and duplicate IDs retain the old baseline; new continuation promises use B's too.
    expect(reviews).toHaveLength(0);
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [
      { id: "created" }, { id: "original-change" },
      { id: "repair", title: "Original repair", evidence: [{ passed: false }] },
      { id: "changed-room", status: "verified" },
    ] });
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("완료 검증이 아직 미완성입니다");
    expect(result.appliedCalls ?? []).toEqual([]);
    expect(store.getCurrent().maps[room.mapId]?.name).toBe("B changed room");
  });
});
