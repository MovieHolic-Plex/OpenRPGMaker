import { once } from "node:events";
import { MessageChannel } from "node:worker_threads";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import type { AcceptancePromise } from "@/ai/assistantAcceptance";
import { createBlankProject } from "@/project/defaults";
import { runTool, type ToolResult } from "@/editor/tools";
import { fixedDeclarer } from "./intentFixture";
import { verificationEvent } from "./fixtures/verificationOwnership";

type Call = { name: string; args: Record<string, unknown> };
type Path = "tool" | "planner";
const paths: Path[] = ["tool", "planner"];
const scopes = ["check_reachability", "run_lint", "run_scene_test", "play_walkthrough", "simulate_battle", "verify_quest", "evaluate_game_quality"];
afterEach(() => vi.unstubAllGlobals());

// **모듈 스코프에 둔다.** @vitest/spy 의 `mocks` Set 은 한 번 담은 spy 를 파일이 끝날 때까지
// 놓지 않는다(추가만 있고 제거가 없다 — clear/reset/restoreAllMocks 도 Set 을 비우지 않는다).
// 이 구현을 fixture() 안에서 만들면 클로저가 fixture 스코프(session·project·스냅샷 전체)를
// 잡고, spy 가 살아 있는 동안 테스트마다 세션이 하나씩 누적된다 — 2026-09-11 실측으로
// 6 테스트 후 세션 6개가 강제 GC 뒤에도 살아남아(queryObjects) 테스트당 약 55MB,
// 파일 전체에서 V8 워커 상한 4GB 를 넘겨 "Ineffective mark-compacts" OOM 이 났다.
function refuseNetwork(): never {
  throw new Error("Offline session must not access network");
}

async function offlineResponse(response: ChatResult): Promise<ChatResult> {
  // Real async model transport, without network or timing waits. A fully
  // synchronous scripted model can starve Vitest's IPC during this large matrix.
  const { port1, port2 } = new MessageChannel();
  const received = once(port2, "message", { signal: AbortSignal.timeout(5000) });
  try {
    port1.postMessage(response);
    const [delivered] = await received;
    return delivered as ChatResult;
  } finally {
    port1.close();
    port2.close();
  }
}

function fixture(name = "check_reachability") {
  const network = vi.fn(refuseNetwork);
  vi.stubGlobal("fetch", network);
  const project = createBlankProject();
  const mapId = project.startMapId;
  const foreign = "foreign-map";
  const route = { mapId, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }] };
  const other = { ...route, from: { x: 4, y: 6 } };
  const context = { project };
  if (name === "verify_quest" || name === "run_scene_test") {
    project.switches.push({ id: "sw_atomic", name: "Atomic" });
    project.session.switches.sw_atomic = false;
    project.startPos = { x: 5, y: 4 };
    project.maps[mapId]!.events.push(verificationEvent("atomic_npc", 5, 5, [{ kind: "setSwitch", switchId: "sw_atomic", value: true }]));
    if (name === "verify_quest") expect(runTool(context, "define_quest", { id: "atomic-quest", title: "Quest", nodes: [{ id: "talk", description: "Talk",
      completesWhen: { kind: "switch", switchId: "sw_atomic", value: true } }], edges: [] }).ok).toBe(true);
  }
  const inputs: Record<string, Record<string, unknown>> = {
    check_reachability: route, run_lint: {}, evaluate_game_quality: {}, verify_quest: { questId: "atomic-quest" },
    simulate_battle: { troopId: project.database.troops[0]!.id, heroLevel: 1, n: 1, seed: 42 },
    play_walkthrough: { scenario: [{ expect: "mapId", mapId }], seed: 42 },
    run_scene_test: { mapId, start: { x: 10, y: 12 }, steps: [{ kind: "expect", mapId }] },
    run_action_combat_test: { mapId },
  };
  const args = inputs[name]!;
  const changes: Record<string, Record<string, unknown>> = {
    check_reachability: other, run_lint: { reachability: [route] }, evaluate_game_quality: { reachability: [route] },
    verify_quest: { questId: "other-quest" }, simulate_battle: { ...inputs.simulate_battle, seed: 43 },
    play_walkthrough: { ...inputs.play_walkthrough, seed: 43 },
    run_scene_test: { ...inputs.run_scene_test, start: { x: 4, y: 6 } }, run_action_combat_test: { mapId: foreign },
  };
  const check = (input = args, checkId?: string) => ({ tool: name, args: input,
    ...(name === "run_scene_test" ? { interactionTargets: [] } : {}), ...(checkId ? { checkId } : {}) });
  const item = (checks?: unknown[], targets: string[] | undefined = [mapId]) => ({ id: "retained-item", title: "Inspect", instruction: "Inspect",
    successTools: [name], mapTargets: targets, verificationChecks: checks });
  const plan = (checks?: unknown[]) => ({ goal: "Original plan", acceptance: [{ id: "preserve", title: "Preserve",
    criteria: [{ kind: "preserve", target: { mapId } }] }] as AcceptancePromise[], layers: [{ title: "QA", items: [item(checks)] }] });
  let calls: Call[] = [];
  let planner: Record<string, unknown> | undefined;
  let sequence = 0;
  let capture = false;
  const events: SessionEvent[] = [];
  let before: ReturnType<typeof snapshots> | undefined;
  let boundary: ReturnType<typeof snapshots> | undefined;
  let result: ToolResult | undefined;
  const session = new AssistantSession(context.project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) {
        const decision = planner;
        planner = undefined;
        if (decision && capture) before = snapshots();
        return offlineResponse({ message: { role: "assistant", content: JSON.stringify(decision ?? { action: "resume" }) }, finishReason: "stop" });
      }
      const batch = calls;
      calls = [];
      if (batch.some(call => call.name === "set_work_plan") && capture) before = snapshots();
      return offlineResponse(batch.length ? { message: { role: "assistant", content: null, tool_calls: batch.map(call => ({ id: `atomic-${++sequence}`,
        type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" }
        : { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" });
    },
  });
  function snapshots() { return { plan: session.getWorkPlan(), acceptance: session.getAcceptanceSnapshot(), verification: session.getVerificationSnapshot() }; }
  async function send(batch: Call[]) {
    calls = batch;
    await session.sendUserMessage("Inspect the declared verification contract.", event => {
      events.push(event);
      if (!capture) return;
      if (event.type === "tool_call" && event.name === "set_work_plan") { result = event.result; boundary = snapshots(); }
      if (event.type === "status" && event.text.startsWith("{")) {
        const parsed = JSON.parse(event.text) as ToolResult;
        if (parsed.ok === false && parsed.data) { result = parsed; boundary = snapshots(); }
      }
      if (event.type === "work_plan" && !boundary) boundary = snapshots();
    });
    expect(calls).toEqual([]);
    expect(planner).toBeUndefined();
    expect(network).not.toHaveBeenCalled();
  }
  async function replace(path: Path, candidate: Record<string, unknown>): Promise<{
    before: ReturnType<typeof snapshots>; boundary: ReturnType<typeof snapshots>; result?: ToolResult;
  }> {
    before = undefined; boundary = undefined; result = undefined; capture = true;
    if (path === "planner") planner = { action: "replan", ...candidate };
    await send(path === "tool" ? [{ name: "set_work_plan", args: candidate }] : []);
    capture = false;
    return { before: before!, boundary: boundary!, result };
  }
  const candidate = (checks: unknown[]) => {
    const next = plan(checks);
    next.goal = "Candidate replacement";
    next.acceptance.push({ id: "candidate-only", title: "Candidate promise", criteria: [{ kind: "preserve", target: { mapId } }] });
    return next;
  };
  const probe = (input = args): Call => ({ name, args: input });
  async function setup(status: "passed" | "unverified" | "stale" = "unverified", checks: unknown[] | null = [check()]) {
    await send([{ name: "set_work_plan", args: plan(checks ?? undefined) }, ...(status === "unverified" ? [] : [probe()])]);
    if (status === "stale") {
      const edited = session.getProposedProject();
      edited.session.gold = (edited.session.gold ?? 0) + 1;
      expect(session.syncBaselineFromStoreIfClean(edited)).toBe(true);
    }
    const original = session.getVerificationSnapshot().requirements.find(requirement => requirement.name === name)!;
    expect(original.status).toBe(checks ? status : "pending-specification");
    return original;
  }
  return { session, mapId, foreign, route, other, name, args, changed: changes[name]!, check, item, plan, candidate, probe, send, replace, setup };
}

function rejected(turn: Awaited<ReturnType<ReturnType<typeof fixture>["replace"]>>, checkId?: string) {
  expect(turn.result?.ok).toBe(false);
  // Planner rejection travels over JSON; undefined object fields have no wire representation.
  expect(turn.result?.data).toMatchObject({ ...JSON.parse(JSON.stringify(turn.before)), conflicts: expect.arrayContaining([
    expect.objectContaining({ itemId: expect.any(String), declarationIndex: expect.any(Number),
      ...(checkId ? { checkId } : {}), reason: expect.any(String) }),
  ]) });
  expect(turn.boundary).toEqual(turn.before);
  expect(turn.boundary.acceptance?.items.some(item => item.id === "candidate-only")).toBe(false);
}

describe.each(paths)("atomic verification adoption via %s", path => {
  it.each(scopes.flatMap(name => (["passed", "unverified", "stale"] as const).map(status => ({ name, status }))))(
    "$name rejects changed specified args while $status", async ({ name, status }) => {
      const f = fixture(name);
      const original = await f.setup(status);
      rejected(await f.replace(path, f.candidate([f.check(f.changed, original.checkId)])), original.checkId);
    });

  it.each(["passed", "unverified", "stale"] as const)("rejects criterion-reference replacement while %s", async status => {
    const f = fixture();
    const initial = f.plan([f.check()]);
    const routePromise = { id: "other-route", title: "Other", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.other.from, to: f.other.targets }] };
    await f.send([{ name: "set_work_plan", args: { ...initial, acceptance: [...initial.acceptance, routePromise] } },
      ...(status === "unverified" ? [] : [f.probe(), f.probe(f.other)])]);
    if (status === "stale") { const edited = f.session.getProposedProject(); edited.session.gold = (edited.session.gold ?? 0) + 1; f.session.syncBaselineFromStoreIfClean(edited); }
    const original = f.session.getVerificationSnapshot().requirements.find(check => !check.criterion)!;
    expect(original.status).toBe(status);
    rejected(await f.replace(path, f.candidate([{ tool: f.name, checkId: original.checkId, criterion: { promiseId: "other-route", criterionIndex: 0 } }])), original.checkId);
  });

  it.each(["check_reachability", "run_lint", "run_scene_test", "run_action_combat_test"])("%s exact reuse preserves ownership and proof", async name => {
    const f = fixture(name);
    const original = await f.setup(name === "run_action_combat_test" ? "unverified" : "passed");
    const turn = await f.replace(path, f.plan([f.check(f.args, original.checkId)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot()).toEqual(turn.before.verification);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original]);
  });

  it.each(["check_reachability", "run_lint"])("%s distinct scope needs fresh proof and invalid mixed candidates add nothing", async name => {
    const f = fixture(name);
    const original = await f.setup("passed");
    await f.send([f.probe(f.changed)]);
    rejected(await f.replace(path, f.candidate([f.check(f.changed), f.check(f.changed, original.checkId)])), original.checkId);
    const turn = await f.replace(path, f.plan([f.check(f.changed)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original, expect.objectContaining({ args: f.changed, status: "unverified" })]);
    await f.send([f.probe(f.changed), { name: "complete_work_item", args: {} }]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(["same-item", "later-layer", "criterion"])("rejects contradictory pending resolutions across %s before either applies", async variant => {
    const f = fixture();
    const pending = await f.setup("unverified", null);
    const checks: unknown[] = [f.check(f.args, pending.checkId), f.check(f.changed, pending.checkId)];
    const candidate = f.candidate(checks);
    if (variant === "later-layer") {
      candidate.layers[0]!.items[0]!.verificationChecks = [checks[0]];
      candidate.layers.push({ title: "Later", items: [{ ...f.item([checks[1]]), id: "later-item" }] });
    }
    if (variant === "criterion") {
      checks[1] = { tool: f.name, checkId: pending.checkId, criterion: { promiseId: "new-route", criterionIndex: 0 } };
      candidate.acceptance.push({ id: "new-route", title: "New", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.other.from, to: f.other.targets }] });
    }
    rejected(await f.replace(path, candidate), pending.checkId);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([pending]);
  });

  it.each(["omitted", "changed", "wrong-tool", "malformed-args", "malformed-sibling", "unknown-id", "not-required"])("raw retained ID cannot bypass preflight via %s", async variant => {
    const f = fixture("run_lint");
    const pending = await f.setup("unverified", null);
    const candidate = f.candidate([f.check(f.args, pending.checkId)]);
    const item = candidate.layers[0]!.items[0]!;
    if (variant === "omitted") Reflect.deleteProperty(item, "mapTargets");
    if (variant === "changed") item.mapTargets = [f.foreign];
    if (variant === "wrong-tool") { item.verificationChecks = [{ tool: "check_reachability", args: f.route, checkId: pending.checkId }]; item.successTools = ["check_reachability"]; }
    if (variant === "malformed-args") item.verificationChecks = [{ tool: f.name, args: { reachability: "invalid" }, checkId: pending.checkId }];
    if (variant === "malformed-sibling") item.verificationChecks = [f.check(f.args, pending.checkId), { tool: f.name, args: { reachability: "invalid" } }];
    if (variant === "unknown-id") item.verificationChecks = [f.check(f.args, "unknown-retained-id")];
    if (variant === "not-required") item.successTools = ["get_project_summary"];
    rejected(await f.replace(path, candidate), variant === "unknown-id" ? "unknown-retained-id" : variant === "malformed-sibling" ? undefined : pending.checkId);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([pending]);
  });

  it("a resolved new sibling cannot conceal an unresolved declaration", async () => {
    const f = fixture();
    await f.setup();
    const turn = await f.replace(path, f.plan([f.check(f.changed), { tool: f.name, criterion: { promiseId: "missing", criterionIndex: 0 } }]));
    if (turn.result?.ok === false) rejected(turn);
    else {
      expect(f.session.getVerificationSnapshot().requirements.filter(check => check.args === null)).toHaveLength(1);
      expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    }
  });

  it("compatible repeated pending resolution preserves ID, owner and targets but needs fresh execution", async () => {
    const f = fixture();
    const pending = await f.setup("unverified", null);
    await f.send([f.probe()]);
    const turn = await f.replace(path, f.plan([f.check(f.args, pending.checkId), f.check(f.args, pending.checkId)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([expect.objectContaining({ checkId: pending.checkId,
      ownerId: pending.ownerId, mapTargets: pending.mapTargets, args: f.args, status: "unverified" })]);
    await f.send([f.probe(), { name: "complete_work_item", args: {} }]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(["omitted", "changed"])("specified retained targets cannot be %s at any proof status", async variant => {
    for (const name of ["check_reachability", "run_lint"]) for (const status of ["passed", "unverified", "stale"] as const) {
      const f = fixture(name);
      const original = await f.setup(status);
      const candidate = f.candidate([f.check(f.args, original.checkId)]);
      const item = candidate.layers[0]!.items[0]!;
      if (variant === "omitted") Reflect.deleteProperty(item, "mapTargets");
      else item.mapTargets = [f.foreign];
      rejected(await f.replace(path, candidate), original.checkId);
    }
  }, 30000);

  it.each(["reference", "exact-args"])("exact %s reuses an accepted criterion without losing independent declarations", async variant => {
    const f = fixture();
    const plan = f.plan();
    plan.acceptance.push({ id: "route", title: "Route", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.route.from, to: f.route.targets }] });
    await f.send([{ name: "set_work_plan", args: plan }, f.probe()]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(original).toMatchObject({ status: "passed", criterion: { promiseId: "route", criterionIndex: 0 } });
    const declaration = variant === "reference" ? { tool: f.name, criterion: original.criterion } : f.check();
    const turn = await f.replace(path, f.plan([declaration]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot()).toEqual(turn.before.verification);
    await f.replace(path, f.plan([declaration, f.check(f.changed)]));
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original, expect.objectContaining({ args: f.changed, status: "unverified" })]);
  });

  it("rejection preserves an existing negative finding and its exact proof history", async () => {
    const f = fixture();
    const original = await f.setup("passed");
    await f.send([{ name: "run_scene_test", args: { mapId: f.mapId, start: { x: 1, y: 1 }, steps: [{ kind: "expect", mapId: f.foreign }] } }]);
    expect(f.session.getVerificationSnapshot().findings).toHaveLength(1);
    rejected(await f.replace(path, f.candidate([f.check(f.changed), f.check(f.changed, original.checkId)])), original.checkId);
  });

  it("exact stale scene reuse retains its original initial-state ownership", async () => {
    const f = fixture("run_scene_test");
    const original = await f.setup("stale");
    expect(original.initialState).toBeDefined();
    const turn = await f.replace(path, f.plan([f.check(f.args, original.checkId)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot()).toEqual(turn.before.verification);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original]);
  });

  it("pending criterion-reference resolution retains owner and needs new exact execution", async () => {
    const f = fixture();
    const pending = await f.setup("unverified", null);
    await f.send([f.probe()]);
    const candidate = f.plan([{ tool: f.name, checkId: pending.checkId, criterion: { promiseId: "new-route", criterionIndex: 0 } }]);
    candidate.acceptance.push({ id: "new-route", title: "New", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.route.from, to: f.route.targets }] });
    const turn = await f.replace(path, candidate);
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot().requirements.find(check => check.checkId === pending.checkId)).toMatchObject({
      ownerId: pending.ownerId, mapTargets: pending.mapTargets, args: f.args, status: "unverified", criterion: { promiseId: "new-route", criterionIndex: 0 },
    });
    await f.send([f.probe(), { name: "complete_work_item", args: {} }]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(["invalid-id", "discarded-item", "alias-array"])("raw declaration preflight survives %s normalization", async variant => {
    const f = fixture();
    const original = await f.setup();
    const candidate = f.candidate([f.check(f.changed, original.checkId)]);
    if (variant === "invalid-id") candidate.layers[0]!.items[0]!.verificationChecks = [{ ...f.check(f.changed), checkId: 123 }];
    if (variant === "discarded-item") {
      candidate.layers[0]!.items[0]!.instruction = "";
      candidate.layers[0]!.items.push({ ...f.item([f.check()]), id: "valid-item" });
    }
    if (variant === "alias-array") {
      const layer = candidate.layers[0]!;
      Reflect.set(layer, "steps", layer.items);
      Reflect.deleteProperty(layer, "items");
    }
    rejected(await f.replace(path, candidate), variant === "invalid-id" ? undefined : original.checkId);
  });

  it("a malformed new scope cannot silently reuse an unrelated accepted criterion", async () => {
    const f = fixture();
    const plan = f.plan();
    plan.acceptance.push({ id: "route", title: "Route", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.route.from, to: f.route.targets }] });
    await f.send([{ name: "set_work_plan", args: plan }, f.probe()]);
    const turn = await f.replace(path, f.plan([{ tool: f.name, args: { mapId: f.mapId } }]));
    if (turn.result?.ok === false) rejected(turn);
    else {
      expect(f.session.getVerificationSnapshot().requirements.filter(check => check.args === null)).toHaveLength(1);
      expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    }
  });

  it("scene interaction ownership is immutable even with identical executable args", async () => {
    const f = fixture("run_scene_test");
    const args = { mapId: f.mapId, start: { x: 5, y: 4 }, steps: [{ kind: "interact", eventId: "atomic_npc" }] };
    const check = { tool: f.name, args, interactionTargets: [{ stepIndex: 0, mapId: f.mapId, eventId: "atomic_npc" }] };
    await f.send([{ name: "set_work_plan", args: f.plan([check]) }, f.probe(args)]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(original.status).toBe("passed");
    rejected(await f.replace(path, f.candidate([{ ...check, checkId: original.checkId,
      interactionTargets: [{ stepIndex: 0, mapId: f.foreign, eventId: "atomic_npc" }] }])), original.checkId);
  });
});
