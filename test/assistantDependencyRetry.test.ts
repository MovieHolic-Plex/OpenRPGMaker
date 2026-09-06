import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type AssistantSessionOptions } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { parseRunRecapPayload, serializeRunRecap } from "@/ai/runRecap";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";

type Call = { name: string; args: Record<string, unknown> };
type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;
const CONFIG = { authMode: "apiKey" as const, agentMode: "auto" as const, baseUrl: "x", model: "stub", liteModel: "executor", apiKey: "test", maxToolCalls: 24, maxTokens: 32768 };
const call = (name: string, args: Record<string, unknown> = {}): Call => ({ name, args });
const spec = (mapId = "m1", valid = true): Call => call("set_build_spec", { mapId, assets: [{ id: "terrain", kind: "terrain", x: 2, y: 2, w: valid ? 6 : 40, h: 6 }] });
const fill = (mapId = "m1"): Call => call("fill_region", { mapId, rect: { x: 3, y: 3, w: 3, h: 3 }, material: "모래", shape: "rect" });
const title = (n: number): Call => call("set_title_screen", { title: `Independent ${n}` });
const GOOD_PAGES = [{ commands: [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 }] }, { conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["Already supplied."] }];
const npc = (pages: unknown = GOOD_PAGES, id = "npc_target"): Call => call("place_npc", { mapId: "m1", id, name: id, x: id === "npc_target" ? 2 : 8, y: 2, graphic: { transparent: true }, pages });
const correctedNpc = (n: number): Call => call("place_npc", { ...npc().args, name: `Corrected ${n}` });
const badNpc = (n: number): Call => {
  const command = { kind: ["changeItems", "item", "gainItem", "changeItems"][n % 4], itemId: "item_potion", op: "+=", amount: 1 };
  return npc(n % 4 === 3 ? [{ lines: ["First page"] }, { commands: [command] }] : [{ commands: [command] }]);
};

beforeEach(() => resetIntentDeclarationCache());
afterEach(() => { resetIntentDeclarationCache(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function setup(rounds: Call[][], options: { planned?: boolean; maxToolCalls?: number; references?: boolean; successTools?: string[] } = {}) {
  const ctx = { project: createBlankProject() };
  for (const id of ["m1", "m2"]) expect(runTool(ctx, "create_map", { id, name: id, width: 20, height: 20 }).ok).toBe(true);
  for (const c of [npc(), npc(GOOD_PAGES, "npc_other")]) expect(runTool(ctx, c.name, c.args).ok).toBe(true);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(ctx.project);
  resetMapEditHistory();
  const plan = { goal: "도구 실행 확인", layers: [{ title: "작업", items: [{ title: "실행 확인", instruction: "도구 실행 후 조회", successTools: options.successTools ?? ["get_map_region"] }] }] };
  const state = { batches: 0, planners: 0 };
  const chat: AssistantSessionOptions["chat"] = async (_config, request): Promise<ChatResult> => {
    if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify(state.planners++ === 0 ? { action: "new_plan", ...plan } : { action: "resume" }) }, finishReason: "stop" };
    const batch = rounds[state.batches++];
    if (!batch) return { message: { role: "assistant", content: "작업을 확인했습니다." }, finishReason: "stop" };
    return { message: { role: "assistant", content: null, tool_calls: batch.map((c, i) => ({ id: `batch_${state.batches}_${i}`, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) }, finishReason: "tool_calls" };
  };
  const session = new AssistantSession(ctx.project, {
    config: { ...CONFIG, maxToolCalls: options.maxToolCalls ?? CONFIG.maxToolCalls }, chat,
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: options.planned ?? false, ...(options.references ? { readBeforeWrite: { project: false, collections: [], references: true } } : {}) }),
  });
  const events: ToolEvent[] = [];
  const collect = (event: SessionEvent): void => { if (event.type === "tool_call") events.push(event); };
  return { session, events, collect, state, project: ctx.project };
}

function expectResponses(session: AssistantSession): void {
  const messages = session.getMessages();
  const ids = messages.flatMap((message) => message.role === "assistant" ? (message.tool_calls ?? []).map((c) => c.id) : []);
  const responses = messages.filter((message) => message.role === "tool").map((message) => message.tool_call_id);
  expect(responses).toEqual(ids);
  expect(new Set(responses).size).toBe(responses.length);
}

function expectDeferred(event: ToolEvent, reason: string): void {
  expect(event.result).toMatchObject({ ok: false, data: { code: "tool-deferred", executed: false, reason } });
}

const readMap = call("get_map_region", { mapId: "m1", x: 0, y: 0, w: 12, h: 8 });

describe("batch prerequisites through AssistantSession", () => {
  it.each([false, true])("defers failed-map writes without poisoning successTools or retries (old spec=%s)", async (oldSpec) => {
    const batch = [...(oldSpec ? [spec()] : []), spec("m1", false), ...Array.from({ length: 5 }, () => fill()), call("get_project_summary"), spec("m2"), fill("m2"), title(1)];
    const { session, events, collect, project } = setup([batch], { planned: true, maxToolCalls: 1, successTools: ["fill_region", "get_map_region"] });
    const result = await session.sendUserMessage("지형 작업 확인", collect);
    const deferred = events.filter((event) => event.name === "fill_region" && event.args.mapId === "m1");
    expect(deferred).toHaveLength(5);
    deferred.forEach((event) => expectDeferred(event, "build-spec-dependency-failed"));
    expect(events.find((event) => event.name === "get_project_summary")?.result.ok).toBe(true);
    expect(events.find((event) => event.name === "fill_region" && event.args.mapId === "m2")?.result.ok).toBe(true);
    expect(events.find((event) => event.name === "set_title_screen")?.result.ok).toBe(true);
    expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("in_progress");
    expect(session.getProposedProject().maps.m1).toEqual(project.maps.m1);
    expect(result.recap).toMatchObject({ toolFailures: 1, deferredToolCalls: 5 });
    expect(parseRunRecapPayload(serializeRunRecap(result.recap!))).toMatchObject({ toolFailures: 1, deferredToolCalls: 5 });
    expect(session.getAuditEntries().filter((entry) => entry.kind === "tool" && entry.name === "fill_region" && entry.args.mapId === "m1")).toEqual(deferred.map(() => expect.objectContaining({ ok: false, deferred: true, issueCodes: ["build-spec-dependency-failed"] })));
    expectResponses(session);
  });

  it.each([false, true])("a corrected spec resumes spatial execution (later batch=%s)", async (laterBatch) => {
    const failed = [spec("m1", false), fill(), call("get_project_summary")];
    const corrected = [spec(), fill()];
    const { session, events, collect } = setup(laterBatch ? [failed, corrected] : [[...failed, ...corrected]]);
    const result = await session.sendUserMessage("지형 칠해줘", collect);
    const fills = events.filter((event) => event.name === "fill_region");
    expectDeferred(fills[0], "build-spec-dependency-failed");
    expect(fills[1].result.ok).toBe(true);
    expect(result.proposedCalls.map((c) => c.name)).toEqual(["fill_region"]);
    expectResponses(session);
  });

  it.each([false, true])("failed record creation defers only ID dependents, then creation/read/correction succeeds (read contract=%s)", async (references) => {
    const enemy = call("upsert_enemy", { enemy: { id: "enemy_dependency", name: "Dependency" } });
    const troop = call("upsert_troop", { troop: { id: "troop_dependency", name: "Dependency troop", enemyIds: ["enemy_dependency"] } });
    const { session, events, collect } = setup([
      [call("upsert_enemy", { enemy: { id: "enemy_dependency", name: "Dependency", invalidField: true } }), troop, title(1), call("get_project_summary"), enemy, troop],
      [call("get_database_records", { collection: "enemies", ids: ["enemy_dependency"] })],
      [troop],
    ], { references });
    await session.sendUserMessage("적과 트룹을 등록해줘", collect);
    expect(events[0].result.ok).toBe(false);
    expectDeferred(events[1], "record-dependency-failed");
    expect(events[2].result.ok).toBe(true);
    expect(events[3].result.ok).toBe(true);
    expect(events[4].result.ok).toBe(true);
    if (references) expectDeferred(events[5], "read-before-write-required");
    else expect(events[5].result.ok).toBe(true);
    expect(events.at(-1)?.result.ok).toBe(true);
    expect(session.getProposedProject().database.troops.find((entry) => entry.id === "troop_dependency")?.enemyIds).toEqual(["enemy_dependency"]);
    expectResponses(session);
  });

  it("keeps the failed-read whole-batch contract and excludes deferred writes from the failure budget", async () => {
    const { session, events, collect } = setup([[call("get_database_records", { collection: "invalid" }), call("get_project_summary"), ...Array.from({ length: 5 }, (_, i) => title(i))]], { planned: true, maxToolCalls: 1 });
    const result = await session.sendUserMessage("조회 후 수정", collect);
    events.slice(2).forEach((event) => expectDeferred(event, "read-dependency-failed"));
    expect(events[1].result.ok).toBe(true);
    expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("in_progress");
    expect(result.recap).toMatchObject({ toolFailures: 1, deferredToolCalls: 5 });
    expectResponses(session);
  });
});

describe("stable target retry budgets through AssistantSession", () => {
  it("bounds fresh-batch lookup refusals without claiming they executed", async () => {
    const rounds = [
      ...Array.from({ length: 4 }, (_, i) => [correctedNpc(i)]),
      [call("get_database_records", { collection: "items", ids: ["item_potion"] })],
      [correctedNpc(4), readMap],
    ];
    const { session, events, collect, state, project } = setup(rounds, { planned: true, references: true, maxToolCalls: 1 });
    const result = await session.sendUserMessage("조회 없이 반복하는 주민 수정", collect, undefined, { autonomous: true });
    expect(result.workPlan?.layers[0].items[0].status).toBe("blocked");
    expect(state.batches).toBe(4);
    expect(events).toHaveLength(4);
    events.forEach((event) => expectDeferred(event, "read-before-write-required"));
    expect(result.recap).toMatchObject({ toolFailures: 0, deferredToolCalls: 4, ralphContinues: 0 });
    expect(session.getProposedProject().maps.m1).toEqual(project.maps.m1);
    expectResponses(session);
  });

  it("does not charge downstream same-batch refusals against their independent retry target", async () => {
    const failedEnemy = call("upsert_enemy", { enemy: { id: "enemy_budget", name: "Budget", invalidField: true } });
    const enemy = call("upsert_enemy", { enemy: { id: "enemy_budget", name: "Budget" } });
    const troop = call("upsert_troop", { troop: { id: "troop_budget", name: "Budget troop", enemyIds: ["enemy_budget"] } });
    const { session, events, collect } = setup([
      ...Array.from({ length: 3 }, () => [failedEnemy, troop, troop, troop, troop]),
      [enemy, call("get_database_records", { collection: "enemies", ids: ["enemy_budget"] })],
      [troop],
    ], { planned: true, references: true, successTools: ["upsert_troop"] });
    const result = await session.sendUserMessage("실패한 적 뒤 트룹 호출을 보류하고 복구", collect);
    const troops = events.filter((event) => event.name === "upsert_troop");
    expect(troops).toHaveLength(13);
    troops.slice(0, 12).forEach((event) => expectDeferred(event, "record-dependency-failed"));
    expect(troops[12].result.ok).toBe(true);
    expect(result.workPlan?.layers[0].items[0].status).toBe("done");
    expect(result.recap).toMatchObject({ toolFailures: 3, deferredToolCalls: 12 });
    expectResponses(session);
  });

  it("bounds spelling and page-path variations despite unrelated writes and synthetic continuations, then rearms for a real user", async () => {
    const rounds = Array.from({ length: 4 }, (_, i) => [badNpc(i), title(i), npc(GOOD_PAGES, "npc_other")]);
    const { session, events, collect, state } = setup(rounds, { planned: true, maxToolCalls: 1 });
    const first = await session.sendUserMessage("주민 명령 수정", collect, undefined, { autonomous: true });
    expect(first.workPlan?.layers[0].items[0].status).toBe("blocked");
    expect(state.batches).toBe(4);
    expect(events.filter((event) => event.name === "place_npc" && event.args.id === "npc_target").map((event) => event.result.issues?.[0]?.code)).toEqual(Array(4).fill("invalid-args"));
    expect(first.stoppedReason).toBe("final");
    expect(first.recap?.ralphContinues).toBe(0);
    expectResponses(session);

    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "acceptance-contract", evidence: [] }] });
    // Repair the missing spatial contract in the successful correction batch.
    // Target only this NPC's cell, so unrelated writes cannot satisfy the promise.
    const criteria = [{ kind: "targetChange", target: { mapId: "m1" }, region: { x: 2, y: 2, w: 1, h: 1 } }];
    rounds.push([badNpc(0)], [badNpc(1)], [badNpc(2)], [correctedNpc(1), readMap,
      call("repair_acceptance", { itemId: "acceptance-contract", criteria }),
    ]);
    const second = await session.sendUserMessage("같은 주민 명령을 다시 고쳐줘", collect, undefined, { autonomous: true });
    expect(second.workPlan?.layers[0].items[0].status).toBe("done");
    expect(state.batches).toBe(8);
    expect(events.find((event) => event.name === "repair_acceptance")?.result).toMatchObject({ ok: true, data: { acceptance: { status: "verifying", items: [{ evidence: [{ passed: false }] }] } } });
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ id: "acceptance-contract", evidence: [{ expected: JSON.stringify(criteria[0]), passed: true }] }] });
    expect(second.proposedCalls).toEqual([]);
    expect(second.appliedCalls?.map((entry) => entry.name)).toEqual(["place_npc"]);
    expect(events.filter((event) => event.name === "place_npc" && event.args.id === "npc_target").map((event) => event.result.ok)).toEqual([false, false, false, false, false, false, false, true]);
    expect(events.filter((event) => event.name === "place_npc" && event.args.id === "npc_target").at(-1)?.result.ok).toBe(true);
    expectResponses(session);
  });

  it("successful correction resets that target's accumulated failures", async () => {
    const { session, events, collect } = setup([
      [badNpc(0)], [badNpc(1)], [badNpc(2)], [correctedNpc(1)],
      [badNpc(3)], [badNpc(0)], [badNpc(1)], [correctedNpc(2), readMap],
    ], { planned: true });
    const result = await session.sendUserMessage("주민 명령 수정", collect);
    expect(result.workPlan?.layers[0].items[0].status, JSON.stringify(session.getAuditEntries().filter((entry) => entry.kind === "tool"))).toBe("done");
    expect(events.filter((event) => event.name === "place_npc").map((event) => event.result.ok)).toEqual([false, false, false, true, false, false, false, true]);
    expectResponses(session);
  });

  it("does not execute attempts beyond the bound even within one model batch", async () => {
    const { session, events, collect } = setup([[...Array.from({ length: 6 }, (_, i) => badNpc(i)), title(1)]], { planned: true, maxToolCalls: 1 });
    const result = await session.sendUserMessage("주민 명령 수정", collect);
    expect(result.workPlan?.layers[0].items[0].status).toBe("blocked");
    events.slice(4, 6).forEach((event) => expectDeferred(event, "tool-retry-exhausted"));
    expect(events[6].result.ok).toBe(true);
    expect(result.recap).toMatchObject({ toolFailures: 4, deferredToolCalls: 2 });
    expectResponses(session);
  });
});
