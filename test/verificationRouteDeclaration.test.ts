import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

const reach = "check_reachability";
type Call = { name: string; args: Record<string, unknown> };

afterEach(() => vi.unstubAllGlobals());

function routeSession() {
  // Only the model response is scripted; adoption, dispatch, route execution,
  // work-item completion and terminal acceptance use their normal code paths.
  const network = vi.fn(() => { throw new Error("Network is forbidden in route declaration tests"); });
  vi.stubGlobal("fetch", network);
  const project = createBlankProject();
  const mapId = project.startMapId;
  const original = { mapId, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }] };
  const later = { mapId, from: { x: 4, y: 6 }, targets: [{ x: 10, y: 9 }] };
  const reference = { tool: reach, criterion: { promiseId: "original-route", criterionIndex: 0 } };
  const plan = (verificationChecks?: unknown[]) => ({
    goal: "Verify retained routes",
    acceptance: [{ id: "original-route", title: "Original route", criteria: [
      { kind: "reachability", target: { mapId }, from: original.from, to: original.targets },
    ] }],
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
  const probe = (args = original): Call => ({ name: reach, args });
  return { session, original, later, reference, run, adopt, probe };
}

function toolResults(events: SessionEvent[], name: string) {
  return events.filter(event => event.type === "tool_call" && event.name === name)
    .map(event => { if (event.type !== "tool_call") throw new Error("Expected tool call"); return event.result; });
}

const complete: Call = { name: "complete_work_item", args: {} };

describe("normal session exact route declaration adoption", () => {
  it("retains a later same-map declaration after replacing a passed criterion plan", async () => {
    const f = routeSession();
    await f.run([f.adopt(), f.probe(), complete]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(original).toMatchObject({ args: f.original, status: "passed", criterion: f.reference.criterion });
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");

    const replacement = await f.run([f.adopt([{ tool: reach, args: f.later }]), f.probe(), complete]);
    expect(toolResults(replacement.events, "set_work_plan").map(result => result.ok)).toEqual([true]);
    const checks = f.session.getVerificationSnapshot().requirements;
    expect(checks).toHaveLength(2);
    expect(checks.find(check => check.checkId === original.checkId)).toEqual(original);
    expect(checks.find(check => check.checkId !== original.checkId)).toMatchObject({ args: f.later, status: "unverified" });
    expect(toolResults(replacement.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("done");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(replacement.events.some(event => event.type === "acceptance" && event.snapshot?.status === "blocked")).toBe(true);

    const fresh = await f.run([f.probe(f.later), complete]);
    expect(toolResults(fresh.events, "complete_work_item").map(result => result.ok)).toEqual([true]);
    expect(f.session.getVerificationSnapshot().requirements.map(check => check.status)).toEqual(["passed", "passed"]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(["reference", "exact-args", "mixed"])("reuses exact criterion ownership without duplicate requirements for %s", async variant => {
    const f = routeSession();
    await f.run([f.adopt(), f.probe()]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    // Key order is not scope; array order and point values remain exact.
    const exact = { tool: reach, args: { targets: [{ y: 8, x: 5 }], from: { y: 12, x: 10 }, mapId: f.original.mapId } };
    const checks = variant === "reference" ? [f.reference] : variant === "exact-args" ? [exact] : [f.reference, exact];
    const replacement = await f.run([f.adopt(checks), f.probe(), complete]);
    expect(toolResults(replacement.events, "set_work_plan").map(result => result.ok)).toEqual([true]);
    expect(toolResults(replacement.events, "complete_work_item").map(result => result.ok)).toEqual([true]);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it("does not let an exact criterion reference conceal another explicit declaration", async () => {
    const f = routeSession();
    const turn = await f.run([f.adopt([f.reference, { tool: reach, args: f.later }]), f.probe(), complete]);
    expect(toolResults(turn.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    expect(f.session.getVerificationSnapshot().requirements.map(check => ({ args: check.args, status: check.status }))).toEqual([
      { args: f.original, status: "passed" }, { args: f.later, status: "unverified" },
    ]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });

  it("requires fresh proof after late adoption and retains that scope across skip and reused scheduling IDs", async () => {
    const f = routeSession();
    await f.run([f.adopt(), f.probe(), f.probe(f.later)]);
    const late = await f.run([f.adopt([{ tool: reach, args: f.later }]), f.probe(), complete]);
    expect(toolResults(late.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    const retained = f.session.getVerificationSnapshot().requirements;
    expect(retained).toHaveLength(2);
    expect(retained[1]).toMatchObject({ args: f.later, status: "unverified" });
    await f.run([{ name: "skip_work_item", args: {} }, f.adopt([f.reference]), f.probe()]);
    expect(f.session.getVerificationSnapshot().requirements).toEqual(retained);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await f.run([f.probe(f.later), complete]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it("does not treat a conflicting retained checkId as a successfully adopted replacement scope", async () => {
    const f = routeSession();
    await f.run([f.adopt([{ tool: reach, args: f.later }]), f.probe(), f.probe(f.later)]);
    const retained = f.session.getVerificationSnapshot().requirements.find(check => !check.criterion)!;
    const turn = await f.run([f.adopt([{ tool: reach, args: f.original, checkId: retained.checkId }]), f.probe(f.later), complete]);
    expect(toolResults(turn.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    expect(f.session.getVerificationSnapshot().requirements.find(check => check.checkId === retained.checkId)).toEqual(retained);
    expect(f.session.getVerificationSnapshot().requirements.at(-1)?.status).toBe("pending-specification");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });

  it("retains a late-specified check's distinct ownership even when its args match a passed criterion", async () => {
    const f = routeSession();
    await f.run([f.adopt([{ tool: reach, criterion: { promiseId: "not-adopted", criterionIndex: 0 } }]), f.probe()]);
    const [original, pending] = f.session.getVerificationSnapshot().requirements;
    expect(pending?.status).toBe("pending-specification");
    const turn = await f.run([f.adopt([{ tool: reach, checkId: pending!.checkId, args: f.original }]),
      { name: "correct_verification", args: { checkId: original!.checkId, args: f.original } }, complete]);
    expect(toolResults(turn.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    expect(f.session.getVerificationSnapshot().requirements).toHaveLength(2);
    expect(f.session.getVerificationSnapshot().requirements[1]).toMatchObject({
      checkId: pending!.checkId, ownerId: pending!.ownerId, args: f.original, status: "unverified",
    });
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await f.run([{ name: "correct_verification", args: { checkId: pending!.checkId, args: f.original } }, complete]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it("leaves an unresolved criterion reference pending instead of substituting a same-tool criterion", async () => {
    const f = routeSession();
    const turn = await f.run([f.adopt([{ tool: reach, criterion: { promiseId: "not-adopted", criterionIndex: 0 } }]), f.probe(), complete]);
    expect(toolResults(turn.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    expect(f.session.getVerificationSnapshot().requirements.map(check => check.status)).toEqual(["passed", "pending-specification"]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });
});
