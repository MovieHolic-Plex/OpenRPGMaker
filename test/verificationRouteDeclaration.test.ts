// 2026-09-17: 수용 원장 해체 — acceptance 의 reachability 기준 소유권(criterion 참조 재사용·중복 없는 소유권·기준 계획 교체) 테스트는 삭제.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { unboundCriterionCheck } from "./fixtures/verificationOwnership";

const reach = "check_reachability";
type Call = { name: string; args: Record<string, unknown> };

afterEach(() => vi.unstubAllGlobals());

function routeSession() {
  // Only the model response is scripted; adoption, dispatch, route execution
  // and work-item completion use their normal code paths.
  const network = vi.fn(() => { throw new Error("Network is forbidden in route declaration tests"); });
  vi.stubGlobal("fetch", network);
  const project = createBlankProject();
  const mapId = project.startMapId;
  const original = { mapId, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }] };
  const later = { mapId, from: { x: 4, y: 6 }, targets: [{ x: 10, y: 9 }] };
  // 2026-09-17: 수용 원장이 사라져 acceptance 의 reachability 기준에서 파생되던 check_reachability 소유권은 없다.
  // 요구는 항목이 직접 선언한 verificationChecks 로만 생긴다. 채택되지 않은 promise 를 가리키는 criterion 참조는
  // 여전히 스펙 미지정(pending-specification) 요구로 남는다(fixtures/verificationOwnership.unboundCriterionCheck).
  const plan = (verificationChecks?: unknown[]) => ({
    goal: "Verify retained routes",
    layers: [{ title: "QA", items: [{ id: "same-id", title: "Route", instruction: "Verify the declared routes",
      successTools: [reach], mapTargets: [mapId], verificationChecks }] }],
  });
  const events: SessionEvent[] = [];
  let pending: Call[] = [];
  let sequence = 0;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
      const calls = pending;
      pending = [];
      return calls.length ? { message: { role: "assistant", content: null, tool_calls: calls.map(call => ({
        id: `route-${++sequence}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
    },
  });
  const run = async (calls: Call[]) => {
    pending = calls;
    const firstEvent = events.length;
    const result = await session.sendUserMessage("Continue route verification.", event => events.push(event));
    expect(pending).toEqual([]);
    expect(network).not.toHaveBeenCalled();
    return { result, events: events.slice(firstEvent) };
  };
  const adopt = (checks?: unknown[]): Call => ({ name: "set_work_plan", args: plan(checks) });
  const declare = (args = original, checkId?: string) => ({ tool: reach, args, ...(checkId ? { checkId } : {}) });
  const probe = (args = original): Call => ({ name: reach, args });
  return { session, original, later, run, adopt, declare, probe };
}

function toolResults(events: SessionEvent[], name: string) {
  return events.filter(event => event.type === "tool_call" && event.name === name)
    .map(event => { if (event.type !== "tool_call") throw new Error("Expected tool call"); return event.result; });
}

const complete: Call = { name: "complete_work_item", args: {} };

describe("normal session exact route declaration adoption", () => {
  it("requires fresh proof after late adoption and retains that scope across skip and reused scheduling IDs", async () => {
    const f = routeSession();
    await f.run([f.adopt([f.declare()]), f.probe(), f.probe(f.later)]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(original).toMatchObject({ args: f.original, status: "passed" });
    const late = await f.run([f.adopt([f.declare(f.later)]), f.probe(), complete]);
    expect(toolResults(late.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    const retained = f.session.getVerificationSnapshot().requirements;
    expect(retained).toHaveLength(2);
    expect(retained[0]).toEqual(original);
    // The pre-adoption pass of `later` is not borrowed as proof.
    expect(retained[1]).toMatchObject({ args: f.later, status: "unverified" });
    await f.run([{ name: "skip_work_item", args: {} }, f.adopt([f.declare(f.original, original.checkId)]), f.probe()]);
    expect(f.session.getVerificationSnapshot().requirements).toEqual(retained);
    const fresh = await f.run([f.probe(f.later), complete]);
    expect(toolResults(fresh.events, "complete_work_item").map(result => result.ok)).toEqual([true]);
    expect(f.session.getVerificationSnapshot().requirements.map(check => check.status)).toEqual(["passed", "passed"]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });

  it("does not treat a conflicting retained checkId as a successfully adopted replacement scope", async () => {
    const f = routeSession();
    await f.run([f.adopt([f.declare(f.later)]), f.probe(), f.probe(f.later)]);
    const retained = f.session.getVerificationSnapshot().requirements[0]!;
    expect(retained).toMatchObject({ args: f.later, status: "passed" });
    const before = { plan: f.session.getWorkPlan(), verification: f.session.getVerificationSnapshot() };
    const candidate = f.adopt([f.declare(f.original, retained.checkId)]);
    candidate.args.goal = "Rejected replacement";
    const turn = await f.run([candidate]);
    const rejection = toolResults(turn.events, "set_work_plan")[0]!;
    expect(rejection.ok).toBe(false);
    expect(rejection.data).toMatchObject({ conflicts: [{ itemId: "same-id", declarationIndex: 0, checkId: retained.checkId, reason: expect.any(String) }] });
    expect(rejection.data).toMatchObject(before);
    expect(f.session.getVerificationSnapshot()).toEqual(before.verification);
    expect(f.session.getVerificationSnapshot().requirements.some(check => check.status === "pending-specification")).toBe(false);
    expect(f.session.getWorkPlan()?.goal).toBe(before.plan?.goal);
    const fresh = await f.run([f.probe(f.later), complete]);
    expect(toolResults(fresh.events, "complete_work_item").map(result => result.ok)).toEqual([true]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });

  it("retains a late-specified check's distinct ownership even when its args match a passed declaration", async () => {
    const f = routeSession();
    await f.run([f.adopt([f.declare(), unboundCriterionCheck(reach)]), f.probe()]);
    const [original, pending] = f.session.getVerificationSnapshot().requirements;
    expect(original?.status).toBe("passed");
    expect(pending?.status).toBe("pending-specification");
    const turn = await f.run([f.adopt([f.declare(f.original, pending!.checkId)]),
      { name: "correct_verification", args: { checkId: original!.checkId, args: f.original } }, complete]);
    expect(toolResults(turn.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    expect(f.session.getVerificationSnapshot().requirements).toHaveLength(2);
    expect(f.session.getVerificationSnapshot().requirements[1]).toMatchObject({
      checkId: pending!.checkId, ownerId: pending!.ownerId, args: f.original, status: "unverified",
    });
    const fresh = await f.run([{ name: "correct_verification", args: { checkId: pending!.checkId, args: f.original } }, complete]);
    expect(toolResults(fresh.events, "complete_work_item").map(result => result.ok)).toEqual([true]);
    expect(f.session.getVerificationSnapshot().requirements.map(check => check.status)).toEqual(["passed", "passed"]);
  });

  it("leaves an unresolved criterion reference pending instead of substituting a same-tool passed declaration", async () => {
    const f = routeSession();
    const turn = await f.run([f.adopt([f.declare(), unboundCriterionCheck(reach)]), f.probe(), complete]);
    expect(toolResults(turn.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    expect(f.session.getVerificationSnapshot().requirements.map(check => check.status)).toEqual(["passed", "pending-specification"]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("done");
  });
});
