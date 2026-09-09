import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type AssistantSessionOptions } from "@/ai/assistantSession";
import { defaultAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { parseRunRecapPayload, serializeRunRecap } from "@/ai/runRecap";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import * as commits from "@/project/projectCommitLog";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse } from "./independentReviewFixture";

type Call = { name: string; args: Record<string, unknown> };
type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;
const CONFIG: AiConfig = { ...defaultAiConfig(), maxToolCalls: 24, maxTokens: 32768 };
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

function setup(rounds: Call[][], options: { planned?: boolean; maxToolCalls?: number; references?: boolean; successTools?: string[]; mapTargets?: string[] } = {}) {
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
  const plan = { goal: "도구 실행 확인", layers: [{ title: "작업", items: [{ title: "실행 확인", instruction: "도구 실행 후 조회", successTools: options.successTools ?? ["get_map_region"], ...(options.mapTargets ? { mapTargets: options.mapTargets } : {}) }] }] };
  const state = { batches: 0, planners: 0, reviews: 0 };
  const requests: ChatRequest[] = [];
  const chat: AssistantSessionOptions["chat"] = async (_config, request): Promise<ChatResult> => {
    const review = approvedReviewResponse(request);
    if (review) { state.reviews += 1; return review; }
    if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify(state.planners++ === 0 ? { action: "new_plan", ...plan } : { action: "resume" }) }, finishReason: "stop" };
    requests.push(request);
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
  return { session, events, collect, state, requests, project: ctx.project };
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
const readSlime = call("get_monster_resource", { resourceId: "generated-enemy-slime-01" });

function expectSlimeReadDelivered(request: ChatRequest, event: ToolEvent): void {
  expect(event.name).toBe("get_monster_resource");
  expect(event.result).toMatchObject({ ok: true, data: { resource: { resourceId: "generated-enemy-slime-01", tags: expect.arrayContaining(["slime"]) } } });
  const response = request.messages.find((message) => message.role === "tool" && message.name === "get_monster_resource");
  expect(response).toBeDefined();
  if (typeof response?.content !== "string") throw new Error("Missing serialized monster read");
  expect(JSON.parse(response.content)).toMatchObject({ ok: true, data: event.result.data });
}

describe("batch prerequisites through AssistantSession", () => {
  it.each([false, true])("defers failed-map writes without poisoning successTools or retries (old spec=%s)", async (oldSpec) => {
    const batch = [...(oldSpec ? [spec()] : []), spec("m1", false), ...Array.from({ length: 5 }, () => fill()), call("get_project_summary"), spec("m2"), fill("m2"), title(1), readMap];
    const { session, events, collect, project, state } = setup([batch, [call("complete_work_item")]], {
      planned: true, maxToolCalls: 1, successTools: ["fill_region", "get_map_region"], mapTargets: ["m1"],
    });
    const result = await session.sendUserMessage("지형 작업 확인", collect);
    const deferred = events.filter((event) => event.name === "fill_region" && event.args.mapId === "m1");
    expect(deferred).toHaveLength(5);
    deferred.forEach((event) => expectDeferred(event, "build-spec-dependency-failed"));
    expect(events.find((event) => event.name === "get_project_summary")?.result.ok).toBe(true);
    expect(events.find((event) => event.name === "fill_region" && event.args.mapId === "m2")?.result.ok).toBe(true);
    expect(events.find((event) => event.name === "set_title_screen")?.result.ok).toBe(true);
    expect(events.find((event) => event.name === "get_map_region")?.result.ok).toBe(true);
    expect(session.getWorkPlan()?.layers[0].items[0]).toMatchObject({
      status: "in_progress", mapTargets: ["m1"], successTools: ["fill_region", "get_map_region"],
    });
    expect(session.getProposedProject().maps.m1).toEqual(project.maps.m1);
    expect(session.getProposedProject().maps.m2).not.toEqual(project.maps.m2);
    expect(result.recap).toMatchObject({ toolFailures: 1, deferredToolCalls: 5 });
    if (!result.recap) throw new Error("Expected a run recap");
    expect(parseRunRecapPayload(serializeRunRecap(result.recap))).toMatchObject({ toolFailures: 1, deferredToolCalls: 5 });
    expect(state.batches).toBe(1);
    // Keep the one-round budget: a real continuation requests completion in a
    // separate batch, after m1 was read and the failed-spec batch has ended.
    const completionResult = await session.sendUserMessage("계속", collect);
    expect(state.batches).toBe(2);
    expect(events.at(-1)).toMatchObject({ name: "complete_work_item", result: {
      ok: false,
      issues: [{ code: "work-item-incomplete" }],
      data: { targetIssues: [{ code: "missing-map-outcome", field: "mapTargets", mapId: "m1", tool: "fill_region" }] },
    } });
    expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("in_progress");
    expect(session.getProposedProject().maps.m1).toEqual(project.maps.m1);
    expect(completionResult.recap?.toolFailures).toBe(1);
    expect(completionResult.recap?.deferredToolCalls ?? 0).toBe(0);
    expect(parseRunRecapPayload(serializeRunRecap(completionResult.recap!))?.toolFailures).toBe(1);
    expect(result.recap!.toolFailures + completionResult.recap!.toolFailures).toBe(2);
    expect(session.getAuditEntries().filter((entry) => entry.kind === "tool" && !entry.ok && !entry.deferred)).toHaveLength(2);
    expect(session.getAuditEntries().filter((entry) => entry.kind === "tool" && entry.deferred)).toHaveLength(5);

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
    const enemy = call("upsert_enemy", { enemy: { id: "enemy_dependency", name: "Dependency", monsterResourceId: "generated-enemy-slime-01" }, appearanceTags: ["slime"] });
    const troop = call("upsert_troop", { troop: { id: "troop_dependency", name: "Dependency troop", enemyIds: ["enemy_dependency"] } });
    const { session, events, collect, requests } = setup([
      [readSlime],
      [call("upsert_enemy", { enemy: { id: "enemy_dependency", name: "Dependency", monsterResourceId: "generated-enemy-slime-01", invalidField: true }, appearanceTags: ["slime"] }), troop, title(1), call("get_project_summary"), enemy, troop],
      [call("get_database_records", { collection: "enemies", ids: ["enemy_dependency"] })],
      [troop],
    ], { references });
    await session.sendUserMessage("적과 트룹을 등록해줘", collect);
    expectSlimeReadDelivered(requests[1], events[0]);
    const afterRead = events.slice(1);
    expect(afterRead[0].result.ok).toBe(false);
    expect(afterRead[0].result.issues?.[0]?.code).toBe("unknown-db-field");
    expectDeferred(afterRead[1], "record-dependency-failed");
    expect(afterRead[2].result.ok).toBe(true);
    expect(afterRead[3].result.ok).toBe(true);
    expect(afterRead[4].result.ok).toBe(true);
    if (references) expectDeferred(afterRead[5], "read-before-write-required");
    else expect(afterRead[5].result.ok).toBe(true);
    expect(events.at(-1)?.result.ok).toBe(true);
    expect(session.getProposedProject().database.troops.find((entry) => entry.id === "troop_dependency")?.enemyIds).toEqual(["enemy_dependency"]);
    expectResponses(session);
  });

  it.each([false, true])("defers new-record dependents transitively without charging their retries (read contract=%s)", async (references) => {
    const enemy = call("upsert_enemy", { enemy: { id: "enemy_deferred", name: "Deferred slime", monsterResourceId: "generated-enemy-slime-01" }, appearanceTags: ["slime"] });
    const troop = call("upsert_troop", { troop: { id: "troop_deferred", name: "Deferred troop", enemyIds: ["enemy_deferred"] } });
    const encounter = call("set_encounter_table", { mapId: "m1", entries: [{ troopId: "troop_deferred", weight: 1 }] });
    const { session, events, collect, requests } = setup([
      // No appearance read yet: the new enemy is unavailable, not an independent troop failure.
      [enemy, troop, troop, troop, troop, troop, encounter, title(1)],
      [readSlime],
      [enemy, call("get_database_records", { collection: "enemies", ids: ["enemy_deferred"] })],
      [troop, call("get_database_records", { collection: "troops", ids: ["troop_deferred"] })],
      [encounter],
    ], { planned: true, references, successTools: ["set_encounter_table"] });
    const result = await session.sendUserMessage("소재를 조회한 다음 적과 트룹, 인카운터를 복구", collect);
    expectDeferred(events[0], "read-before-write-required");
    expect(events[0].result.issues?.[0]?.code).toBe("monster-resource-read-required");
    const troops = events.filter((event) => event.name === "upsert_troop");
    troops.slice(0, 5).forEach((event) => expectDeferred(event, "record-dependency-failed"));
    expect(troops).toHaveLength(6);
    expect(troops[5].result.ok).toBe(true);
    const encounters = events.filter((event) => event.name === "set_encounter_table");
    expect(encounters).toHaveLength(2);
    expectDeferred(encounters[0], "record-dependency-failed");
    expect(encounters[1].result.ok).toBe(true);
    expect(events[7].name).toBe("set_title_screen");
    expect(events[7].result.ok).toBe(true);
    expectSlimeReadDelivered(requests[2], events[8]);
    expect(events.filter((event) => event.name === "upsert_enemy").map((event) => event.result.ok)).toEqual([false, true]);
    expect(session.getProposedProject().maps.m1.encounterTable).toMatchObject([{ troopId: "troop_deferred", weight: 1 }]);
    expect(result.workPlan?.layers[0].items[0].status).toBe("done");
    expect(result.recap).toMatchObject({ toolFailures: 0, deferredToolCalls: 7 });
    expect(session.getAuditEntries().filter((entry) => entry.kind === "tool" && entry.name === "upsert_troop").slice(0, 5))
      .toEqual(Array.from({ length: 5 }, () => expect.objectContaining({ ok: false, deferred: true, issueCodes: ["record-dependency-failed"] })));
    expectResponses(session);
  });

  it.each(["deferred", "failed"] as const)("keeps an existing record available after its update is %s", async (outcome) => {
    const rounds: Call[][] = [];
    const { session, events, collect, project } = setup(rounds, { references: true });
    const existing = project.database.enemies[0];
    const resourceId = existing.monsterResourceId === "generated-enemy-slime-01" ? "generated-enemy-goblin-scout" : "generated-enemy-slime-01";
    rounds.push(
      [call("get_database_records", { collection: "enemies", ids: [existing.id], include: "full" })],
      [call("upsert_enemy", { enemy: { id: existing.id, ...(outcome === "deferred" ? { monsterResourceId: resourceId, transparent: false } : { invalidField: true }) } }),
        call("upsert_troop", { troop: { id: "troop_existing", name: "Existing enemy", enemyIds: [existing.id] } }), title(2)],
    );
    await session.sendUserMessage("기존 적의 수정 실패는 참조를 없애지 않는다", collect);
    expect(events[0].result.ok).toBe(true);
    if (outcome === "deferred") {
      expectDeferred(events[1], "read-before-write-required");
      expect(events[1].result.issues?.[0]?.code).toBe("monster-resource-read-required");
    } else {
      expect(events[1].result.ok).toBe(false);
      expect(events[1].result.issues?.[0]?.code).toBe("unknown-db-field");
    }
    expect(events[2].result.ok).toBe(true);
    expect(events[3].result.ok).toBe(true);
    expect(session.getProposedProject().database.enemies.find((entry) => entry.id === existing.id)).toEqual(existing);
    expect(session.getProposedProject().database.troops.find((entry) => entry.id === "troop_existing")?.enemyIds).toEqual([existing.id]);
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
    const failedEnemy = call("upsert_enemy", { enemy: { id: "enemy_budget", name: "Budget", monsterResourceId: "generated-enemy-slime-01", invalidField: true }, appearanceTags: ["slime"] });
    const enemy = call("upsert_enemy", { enemy: { id: "enemy_budget", name: "Budget", monsterResourceId: "generated-enemy-slime-01" }, appearanceTags: ["slime"] });
    const troop = call("upsert_troop", { troop: { id: "troop_budget", name: "Budget troop", enemyIds: ["enemy_budget"] } });
    const { session, events, collect, requests } = setup([
      [readSlime],
      ...Array.from({ length: 3 }, () => [failedEnemy, troop, troop, troop, troop]),
      [enemy, call("get_database_records", { collection: "enemies", ids: ["enemy_budget"] })],
      [troop],
    ], { planned: true, references: true, successTools: ["upsert_troop"] });
    const result = await session.sendUserMessage("실패한 적 뒤 트룹 호출을 보류하고 복구", collect);
    expectSlimeReadDelivered(requests[1], events[0]);
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
    const authored = structuredClone(store.getCurrent());
    const commit = vi.spyOn(commits, "recordProjectCommit");
    const first = await session.sendUserMessage("주민 명령 수정", collect, undefined, { autonomous: true });
    expect(first.workPlan?.layers[0].items[0].status).toBe("blocked");
    expect(state.batches).toBe(4);
    expect(events.filter((event) => event.name === "place_npc" && event.args.id === "npc_target").map((event) => event.result.issues?.[0]?.code)).toEqual(Array(4).fill("invalid-args"));
    expect(first.stoppedReason).toBe("final");
    expect(first.recap?.ralphContinues).toBe(0);
    expect(first.recap?.process.filter(step => step.kind === "continue")).toHaveLength(3);
    expect(first.appliedCalls ?? []).toEqual([]);
    expect(store.getCurrent()).toEqual(authored);
    expect(getMapEditHistoryEntries()).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
    expectResponses(session);

    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "acceptance-contract", evidence: [] }] });
    // Repair the missing spatial contract in the successful correction batch.
    // Target only this NPC's cell, so unrelated writes cannot satisfy the promise.
    const criteria = [{ kind: "targetChange", target: { mapId: "m1" }, region: { x: 2, y: 2, w: 1, h: 1 } }];
    rounds.push([badNpc(0)], [badNpc(1)], [badNpc(2)], [correctedNpc(1), readMap,
      call("repair_acceptance", { itemId: "acceptance-contract", criteria }),
    ]);
    // Final writer response + independent review require two rounds. A one-round
    // budget can test failure bounds, but cannot admit even a corrected draft.
    session.updateConfig({ ...CONFIG, maxToolCalls: 2 });
    // P2 requires the host's explicit resume action, not arbitrary new prose.
    const second = await session.sendUserMessage("같은 주민 명령을 다시 고쳐줘", collect, undefined, { autonomous: true, goalAction: "resume" });
    expect(second.workPlan?.layers[0].items[0].status).toBe("done");
    expect(state.batches).toBe(9); // Eight tool batches plus the terminal writer response.
    expect(state.reviews).toBe(1);
    expect(second.stoppedReason).toBe("final");
    expect(second.recap?.process.filter(step => step.kind === "continue")).toHaveLength(2);
    expect(events.find((event) => event.name === "repair_acceptance")?.result).toMatchObject({ ok: true, data: { acceptance: { status: "verifying", items: [{ evidence: [{ passed: false }] }] } } });
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ id: "acceptance-contract", evidence: [{ expected: JSON.stringify(criteria[0]), passed: true }] }] });
    expect(second.proposedCalls).toEqual([]);
    // Resume retains previously pending independent writes; none were applied in
    // the blocked first run, so they must be reviewed and delivered once rather than erased.
    expect(first.appliedCalls).toEqual([]);
    expect(second.appliedCalls?.slice(0, -1)).toEqual(first.proposedCalls);
    expect(second.appliedCalls?.at(-1)).toMatchObject({ name: "place_npc", args: { id: "npc_target" } });
    expect(second.appliedCalls?.filter(entry => entry.name === "place_npc" && entry.args.id === "npc_other")).toHaveLength(1);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(store.getCurrent().meta.title).toBe(session.getProposedProject().meta.title);
    expect(store.getCurrent().maps.m1.events.find(event => event.id === "npc_target")?.name).toBe("Corrected 1");
    expect(store.getCurrent().maps.m1.events.find(event => event.id === "npc_other")).toEqual(session.getProposedProject().maps.m1.events.find(event => event.id === "npc_other"));
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
