import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type AssistantSessionOptions } from "@/ai/assistantSession";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
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

function setup(rounds: Call[][], options: { planned?: boolean; maxToolCalls?: number; references?: boolean; successTools?: string[]; outcome?: string } = {}) {
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
  const requests: ChatRequest[] = [];
  const chat: AssistantSessionOptions["chat"] = async (_config, request): Promise<ChatResult> => {
    if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify(state.planners++ === 0 ? { action: "new_plan", ...plan } : { action: "resume" }) }, finishReason: "stop" };
    requests.push(request);
    const batch = rounds[state.batches++];
    if (!batch) return { message: { role: "assistant", content: "작업을 확인했습니다." }, finishReason: "stop" };
    return { message: { role: "assistant", content: null, tool_calls: batch.map((c, i) => ({ id: `batch_${state.batches}_${i}`, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) }, finishReason: "tool_calls" };
  };
  const session = new AssistantSession(ctx.project, {
    config: { ...CONFIG, maxToolCalls: options.maxToolCalls ?? CONFIG.maxToolCalls }, chat,
    declareIntent: async facts => fixedDeclarer({ mode: "modify", needsPlan: options.planned ?? false,
      ...(options.outcome ? { requestRequirements: { entries: [{ source: [{ start: 0, end: facts.userText.length, quote: facts.userText }],
        criteria: [{ kind: "valueEquals", subject: { kind: "event", mapId: "m1", eventId: "npc_target" }, path: ["name"], value: options.outcome }],
        bindings: [{ source: { start: facts.userText.indexOf('"'), end: facts.userText.length, quote: JSON.stringify(options.outcome) }, role: "value", criterionIndex: 0, fieldPath: ["value"] }],
      }] } } : {}), ...(options.references ? { readBeforeWrite: { project: false, collections: [], references: true } } : {}),
    })(facts),
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
  expect(JSON.parse(response!.content as string)).toMatchObject({ ok: true, data: event.result.data });
}

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
    const { session, events, collect, state } = setup(rounds, { planned: true, references: true, maxToolCalls: 1, outcome: "Corrected 4" });
    const result = await session.sendUserMessage('Set NPC name to "Corrected 4"', collect, undefined, { autonomous: true });
    expect(result.execution?.state).toBe("verified-local");
    expect(state.batches).toBe(6);
    events.slice(0, 4).forEach((event) => expectDeferred(event, "read-before-write-required"));
    expect(events.find(event => event.name === "place_npc" && event.result.ok)).toBeDefined();
    expect(result.recap).toMatchObject({ toolFailures: 0, deferredToolCalls: 4 });
    expect(store.getCurrent().maps.m1.events.find(event => event.id === "npc_target")?.name).toBe("Corrected 4");
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

  it.each(["npc-name", "map-name"] as const)("H2-cosmetic-%s-does-not-rearm-invalid-command", async cosmetic => {
    const invalid = badNpc(0);
    const retry = cosmetic === "npc-name" ? call("place_npc", { ...invalid.args, name: "Cosmetic rename" }) : invalid;
    const rounds = [
      ...Array.from({ length: 4 }, () => [invalid]),
      [...(cosmetic === "map-name" ? [call("set_map_properties", { mapId: "m1", name: "Unrelated map rename" })] : []), retry],
      [correctedNpc(9), readMap],
    ];
    const { session, events, collect, state } = setup(rounds, { planned: true, maxToolCalls: 1, outcome: "Corrected 9" });
    const controller = new AbortController();
    const result = await session.sendUserMessage('Set NPC name to "Corrected 9"', event => {
      collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && state.batches > rounds.length) controller.abort();
    }, controller.signal, { autonomous: true });
    const attempts = events.filter(event => event.name === "place_npc");
    expect(attempts).toHaveLength(6);
    attempts.slice(0, 4).forEach(event => expect(event.result).toMatchObject({ ok: false, issues: [{ code: "invalid-args" }] }));
    expectDeferred(attempts[4], "tool-retry-exhausted");
    expect(attempts[5].result.ok).toBe(true);
    expect(result.execution?.state).toBe("verified-local");
    const applied = store.getCurrent().maps.m1;
    expect(applied.events.find(event => event.id === "npc_target")).toMatchObject({ name: "Corrected 9", pages: [
      { commands: expect.arrayContaining([expect.objectContaining({ kind: "changeItem", itemId: "item_potion", amount: 1 })]) },
      expect.anything(),
    ] });
    if (cosmetic === "map-name") {
      expect(events.find(event => event.name === "set_map_properties")?.result.ok).toBe(true);
      expect(applied.name).toBe("Unrelated map rename");
    }
    expect(result.recap).toMatchObject({ toolFailures: 4, deferredToolCalls: 1 });
    expectResponses(session);
  });

  it("H2-identical-arguments-rearm-only-after-relevant-read", async () => {
    const write = correctedNpc(9);
    const rounds = [
      ...Array.from({ length: 4 }, () => [write]),
      [call("get_project_summary")],
      [write],
      [call("get_database_records", { collection: "items", ids: ["item_potion"] })],
      [write, readMap],
    ];
    const { session, events, collect, state } = setup(rounds, { planned: true, references: true, maxToolCalls: 1, outcome: "Corrected 9" });
    const controller = new AbortController();
    const result = await session.sendUserMessage('Set NPC name to "Corrected 9"', event => {
      collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && state.batches > rounds.length) controller.abort();
    }, controller.signal, { autonomous: true });
    const attempts = events.filter(event => event.name === "place_npc");
    expect(attempts).toHaveLength(6);
    attempts.slice(0, 4).forEach(event => expectDeferred(event, "read-before-write-required"));
    expectDeferred(attempts[4], "tool-retry-exhausted");
    expect(attempts[5].args).toEqual(attempts[0].args);
    expect(attempts[5].result.ok).toBe(true);
    expect(result.execution?.state).toBe("verified-local");
    expect(store.getCurrent().maps.m1.events.find(event => event.id === "npc_target")?.name).toBe("Corrected 9");
    expectResponses(session);
  });

  it("H2-identical-arguments-rearm-after-actual-spec-prerequisite", async () => {
    const write = call("place_npc", { ...npc().args, id: "npc_spec_target", x: 4, y: 4 });
    const rounds = [
      ...Array.from({ length: 4 }, () => [write]),
      [spec()],
      [write, correctedNpc(9), readMap],
    ];
    const { session, events, collect, state } = setup(rounds, { planned: true, maxToolCalls: 1, outcome: "Corrected 9" });
    const controller = new AbortController();
    const result = await session.sendUserMessage('Set NPC name to "Corrected 9"', event => {
      collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && state.batches > rounds.length) controller.abort();
    }, controller.signal, { autonomous: true });
    const attempts = events.filter(event => event.name === "place_npc" && event.args.id === "npc_spec_target");
    expect(attempts).toHaveLength(5);
    attempts.slice(0, 4).forEach(event => expect(event.result).toMatchObject({ ok: false, issues: [{ code: "spec-gate" }] }));
    expect(events.find(event => event.name === "set_build_spec")?.result.ok).toBe(true);
    expect(attempts[4].args).toEqual(attempts[0].args);
    expect(attempts[4].result.ok).toBe(true);
    expect(result.execution?.state).toBe("verified-local");
    expect(store.getCurrent().maps.m1.events.some(event => event.id === "npc_spec_target")).toBe(true);
    expectResponses(session);
  });

  it("H2-distinct-target-and-meaningful-name-corrections-remain-executable", async () => {
    const invalid = call("place_npc", { ...npc().args, name: {} });
    const rounds = [
      ...Array.from({ length: 4 }, () => [invalid]),
      [call("place_npc", { ...invalid.args, id: "npc_other", x: 8 })],
      [correctedNpc(9), readMap],
    ];
    const { session, events, collect, state } = setup(rounds, { planned: true, maxToolCalls: 1, outcome: "Corrected 9" });
    const controller = new AbortController();
    const result = await session.sendUserMessage('Set NPC name to "Corrected 9"', event => {
      collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && state.batches > rounds.length) controller.abort();
    }, controller.signal, { autonomous: true });
    const attempts = events.filter(event => event.name === "place_npc");
    expect(attempts).toHaveLength(6);
    attempts.slice(0, 5).forEach(event => expect(event.result).toMatchObject({ ok: false, issues: [{ code: "invalid-args" }] }));
    expect(attempts[4].args.id).toBe("npc_other");
    expect(attempts[5].result.ok).toBe(true);
    expect(result.execution?.state).toBe("verified-local");
    expect(store.getCurrent().maps.m1.events.find(event => event.id === "npc_target")?.name).toBe("Corrected 9");
    expectResponses(session);
  });

  it("C4 unchanged candidate stays excluded across unrelated writes and continuation; a valid correction succeeds", async () => {
    const rounds = Array.from({ length: 5 }, (_, i) => [badNpc(0), title(i), call("place_npc", { ...npc(GOOD_PAGES, "npc_other").args, name: `Independent NPC ${i}` })]);
    const { session, events, collect } = setup(rounds, { planned: true, maxToolCalls: 1, outcome: "Corrected 1" });
    const controller = new AbortController();
    const first = await session.sendUserMessage('Set NPC name to "Corrected 1"', event => {
      collect(event);
      if (event.type === "tool_call" && event.name === "place_npc" && event.args.id === "npc_target"
        && events.filter(entry => entry.name === "place_npc" && entry.args.id === "npc_target").length === 5) controller.abort();
    }, controller.signal, { autonomous: true });
    expect(first.execution?.state).toBe("aborted");
    const failed = events.filter(event => event.name === "place_npc" && event.args.id === "npc_target");
    expect(failed).toHaveLength(5);
    expectDeferred(failed[4], "tool-retry-exhausted");
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    rounds.push([correctedNpc(1), readMap]);
    const second = await session.sendUserMessage("continue", collect, undefined, { autonomous: true, goalAction: "resume" });
    expect(second.execution?.state).toBe("verified-local");
    expect(store.getCurrent().maps.m1.events.find(event => event.id === "npc_target")?.name).toBe("Corrected 1");
    expect(session.getHarnessSnapshot().requests).toHaveLength(1);
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
    const { session, events, collect } = setup([[...Array.from({ length: 6 }, () => badNpc(0)), title(1)]], { planned: true, maxToolCalls: 1 });
    const result = await session.sendUserMessage("주민 명령 수정", collect);
    expect(result.workPlan?.layers[0].items[0].status).toBe("blocked");
    events.slice(4, 6).forEach((event) => expectDeferred(event, "tool-retry-exhausted"));
    expect(events[6].result.ok).toBe(true);
    expect(result.recap).toMatchObject({ toolFailures: 4, deferredToolCalls: 2 });
    expectResponses(session);
  });
});
