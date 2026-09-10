import { once } from "node:events";
import { MessageChannel } from "node:worker_threads";
import { afterEach, expect, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import type { AcceptancePromise } from "@/ai/assistantAcceptance";
import { createBlankProject } from "@/project/defaults";
import { runTool, type ToolResult } from "@/editor/tools";
import { fixedDeclarer } from "../intentFixture";
import { verificationEvent } from "../fixtures/verificationOwnership";

type Call = { name: string; args: Record<string, unknown> };
type Path = "tool" | "planner";
export const paths: Path[] = ["tool", "planner"];
export const scopes = ["check_reachability", "run_lint", "run_scene_test", "play_walkthrough", "simulate_battle", "verify_quest", "evaluate_game_quality"];
afterEach(() => vi.unstubAllGlobals());

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

// **모듈 스코프에 둔다.** @vitest/spy 의 `mocks` Set 은 한 번 담은 spy 를 파일이 끝날 때까지
// 놓지 않는다(추가만 있고 제거가 없다 — clear/reset/restoreAllMocks 도 Set 을 비우지 않는다).
// 이 구현을 fixture() 안에서 만들면 클로저가 fixture 스코프(session·project·스냅샷 전체)를
// 잡고, spy 가 살아 있는 동안 테스트마다 세션이 하나씩 누적된다 — 2026-09-11 실측으로
// 6 테스트 후 세션 6개가 강제 GC 뒤에도 살아남아(queryObjects) 파일 전체에서 V8 워커 상한을
// 넘겨 "Ineffective mark-compacts" OOM 이 났다(PR #753).
function refuseNetwork(): never {
  throw new Error("Offline session must not access network");
}

export function fixture(name = "check_reachability") {
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

export function rejected(turn: Awaited<ReturnType<ReturnType<typeof fixture>["replace"]>>, checkId?: string) {
  expect(turn.result?.ok).toBe(false);
  // Planner rejection travels over JSON; undefined object fields have no wire representation.
  expect(turn.result?.data).toMatchObject({ ...JSON.parse(JSON.stringify(turn.before)), conflicts: expect.arrayContaining([
    expect.objectContaining({ itemId: expect.any(String), declarationIndex: expect.any(Number),
      ...(checkId ? { checkId } : {}), reason: expect.any(String) }),
  ]) });
  expect(turn.boundary).toEqual(turn.before);
  expect(turn.boundary.acceptance?.items.some(item => item.id === "candidate-only")).toBe(false);
}
