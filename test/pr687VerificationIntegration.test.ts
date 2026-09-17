import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { unboundCriterionCheck, verificationEvent, verificationJourney } from "./fixtures/verificationOwnership";
import { offlineChatResponse } from "./fixtures/offlineChatResponse";
import { imageDeliveryForRequest } from "./independentReviewFixture";
import { getTool } from "@/editor/tools";
import type { SceneStep } from "@/testing/sceneTestRunner";

type Call = { name: string; args: Record<string, unknown> };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function rig(maxToolCalls = 4, project = createBlankProject()) {
  const network = vi.fn(() => { throw new Error("Offline integration regression attempted network"); });
  vi.stubGlobal("fetch", network);
  const mapId = project.startMapId;
  const args = { mapId, start: { x: 10, y: 12 }, steps: [{ kind: "expect", mapId }] };
  let batches: Call[][] = [];
  let sequence = 0;
  const events: SessionEvent[] = [];
  let modelRequests = 0;
  let before: ReturnType<typeof snapshot> | undefined;
  let after: ReturnType<typeof snapshot> | undefined;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
    renderImages: async () => [{ label: "Current map", dataUrl: "data:image/png;base64,AA==" }],
    chat: async (_config, request): Promise<ChatResult> => {
      // 2026-09-17: 검수 모델은 호출되지 않는다. 제안이 있는 final 의 assistantText 는 결정적 검사 요약이다.
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
      modelRequests++;
      const calls = batches.shift() ?? [];
      if (calls.some(call => call.name === "skip_work_item")) before = snapshot();
      const imageDelivery = imageDeliveryForRequest(request);
      return offlineChatResponse(calls.length ? { imageDelivery, message: { role: "assistant", content: null, tool_calls: calls.map(call => ({
        id: `integration-${++sequence}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" } : { imageDelivery, message: { role: "assistant", content: "FINAL_SENTINEL" }, finishReason: "stop" });
    },
  });
  function snapshot() { return { plan: session.getWorkPlan(), acceptance: session.getAcceptanceSnapshot(), verification: session.getVerificationSnapshot() }; }
  const plan = (declared = true): Call => ({ name: "set_work_plan", args: { goal: "Integration checks",
    acceptance: [{ id: "preserve", title: "Map", criteria: [{ kind: "preserve", target: { mapId } }] }],
    layers: [{ title: "Checks", items: [{ id: "verify", title: "Verify", instruction: "Check the declared scene then inspect project",
      successTools: ["run_scene_test", "get_project_summary"], mapTargets: [mapId],
      // declared=false 는 스펙 미지정 요구를 만든다. 선언을 아예 비우면 더 이상 요구가 생기지
      // 않으므로(하네스가 해소 불가능한 요구를 만들지 않는다) 남아 있는 경로로 만든다.
      verificationChecks: declared ? [{ tool: "run_scene_test", args, interactionTargets: [] }] : [unboundCriterionCheck("run_scene_test")] },
    { id: "optional", title: "Optional", instruction: "Optional inspection" }] }],
  } });
  async function send(...next: Call[][]) {
    batches = next;
    const result = await session.sendUserMessage("Inspect the retained checks.", event => {
      events.push(event);
      if (event.type === "tool_call" && event.name === "skip_work_item") after = snapshot();
    });
    expect(network).not.toHaveBeenCalled();
    return result;
  }
  return { session, args, events, plan, send, snapshot, requests: () => modelRequests, boundary: () => ({ before, after }) };
}

const probe = (args: Record<string, unknown>): Call => ({ name: "run_scene_test", args });
const DETERMINISTIC_PASS = "결정적 검사 통과";
const skip: Call = { name: "skip_work_item", args: { itemId: "verify" } };

describe("PR687 adjudicated verification scheduling through normal dispatch", () => {
  it.each(["unadopted", "adopted", "negative"])("dummy removal retains only authoritative obligations: %s", async kind => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events.push(verificationEvent("dummy", 6, 4, []));
    const f = rig(8, project);
    const args = { mapId, start: { x: 6, y: 3 }, steps: [{ kind: "interact", eventId: "dummy" },
      { kind: "expect", mapId, ...(kind === "negative" ? { goldDelta: 1 } : {}) }] };
    const declare: Call = { name: "set_work_plan", args: { goal: "Dummy check", layers: [{ title: "Checks", items: [{ id: "verify",
      title: "Verify", instruction: "Inspect", successTools: ["run_scene_test", "get_project_summary"], mapTargets: [mapId],
      verificationChecks: [{ tool: "run_scene_test", args, interactionTargets: [{ stepIndex: 0, mapId, eventId: "dummy" }] }] }] }] } };
    const result = await f.send([...(kind === "adopted" ? [declare] : []), probe(args), { name: "remove_event", args: { mapId, eventId: "dummy" } },
      { name: "show_map_region", args: { mapId, x: 0, y: 0, w: project.maps[mapId]!.width, h: project.maps[mapId]!.height } }]);
    expect(f.session.getProposedProject().maps[mapId]!.events.some(event => event.id === "dummy")).toBe(false);
    expect(f.snapshot().verification.findings).toHaveLength(kind === "negative" ? 1 : 0);
    expect(f.snapshot().verification.requirements).toHaveLength(kind === "adopted" ? 1 : 0);
    if (kind === "adopted") expect(f.snapshot().verification.requirements[0]?.status).toBe("stale");
    // 모델의 마지막 말이 본문이고 결정적 검사 결과는 뒤에 한 줄로 붙는다.
    expect(result.assistantText.includes(DETERMINISTIC_PASS)).toBe(kind === "unadopted");
    expect(f.requests()).toBeLessThanOrEqual(5);
  });

  it("facing-only correction clears its finding but not a distinct checkpoint assertion", async () => {
    const journey = verificationJourney();
    const f = rig(8, journey.project);
    const second = { ...journey.wire180, steps: [...journey.wire180.steps, { kind: "expect", goldDelta: 1 }] };
    await f.send([probe({ ...journey.wire180 }), probe(second)]);
    const findings = f.snapshot().verification.findings;
    expect(findings).toHaveLength(2);
    await f.send([{ name: "correct_verification", args: { checkId: findings[0]!.checkId, args: journey.wire181 } }]);
    expect(f.snapshot().verification.findings).toEqual([findings[1]]);
    expect(f.events.filter(event => event.type === "tool_call" && event.name === "correct_verification")).toMatchObject([{ result: { ok: true } }]);
    expect(f.session.getRunOutcome()?.execution).toBe("blocked");
  });

  it.each(["set", "move", "walk", "start", "state", "choice", "checkpoint", "reward", "repeat"])("rejects changed %s through normal correction dispatch", async variant => {
    const journey = verificationJourney();
    const f = rig(8, journey.project);
    const setup: SceneStep[] = [{ kind: "set", x: 4, y: 6 }, { kind: "walk", to: { x: 4, y: 6 } }];
    const original = { ...journey.wire180, steps: [...setup, ...journey.wire180.steps] };
    await f.send([probe(original)]);
    const finding = f.snapshot().verification.findings[0]!;
    expect(finding).toBeDefined();
    const corrected = { ...journey.wire181, start: { ...journey.wire181.start }, steps: [...setup, ...journey.wire181.steps] };
    if (["set", "move", "walk"].includes(variant)) corrected.steps = corrected.steps.filter(step => step.kind !== variant);
    if (variant === "start") corrected.start.x++;
    if (variant === "state") corrected.steps.unshift({ kind: "set", gold: 100 });
    if (variant === "choice") corrected.steps.push({ kind: "choose", index: 0 });
    if (variant === "checkpoint") corrected.steps = corrected.steps.filter(step => step.kind !== "snapshotRewards");
    if (variant === "reward") corrected.steps = corrected.steps.map(step => step.kind === "expect" && step.goldDelta === 20 ? { ...step, goldDelta: { atLeast: 1 } } : step);
    if (variant === "repeat") corrected.steps.splice(-3);
    const result = await f.send([{ name: "correct_verification", args: { checkId: finding.checkId, args: corrected } }]);
    expect(f.events.filter(event => event.type === "tool_call" && event.name === "correct_verification")).toMatchObject([{ result: { ok: false } }]);
    expect(f.snapshot().verification.findings).toEqual([finding]);
    expect(result.runOutcome?.execution).toBe("blocked");
  });

  it.each(["malformed", "execution", "no-target", "missing-target"])("classifies %s without waiving a required scope", async kind => {
    const f = rig(8);
    await f.send([f.plan()]);
    const required = f.snapshot().verification.requirements[0]!;
    const args = kind === "malformed" ? { ...f.args, steps: [{ kind: "face", text: "up" }] }
      : kind === "no-target" ? { ...f.args, steps: [{ kind: "interact" }] }
      : kind === "missing-target" ? { ...f.args, steps: [{ kind: "interact", eventId: "missing" }] } : f.args;
    if (kind === "execution") vi.spyOn(getTool("run_scene_test")!, "run").mockImplementationOnce(() => { throw new Error("Injected executor failure"); });
    const result = await f.send([probe(args)]);
    expect(f.snapshot().verification.requirements[0]).toEqual(required);
    expect(f.snapshot().verification.findings).toHaveLength(kind === "missing-target" ? 1 : 0);
    expect(f.snapshot().verification.attempts.at(-1)?.status).toBe(kind === "missing-target" ? "negative" : kind === "no-target" ? "setup-failure" : "unsuccessful");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(result.runOutcome?.execution).toBe("blocked");
  });

  it("optional criterion authority does not turn ordinary optional scheduling into required verification", async () => {
    const f = rig();
    await f.send([{ name: "set_work_plan", args: { goal: "Optional route",
      requirements: [{ id: "optional-route", title: "Optional route", required: false,
        criteria: [{ kind: "reachability", target: { mapId: f.args.mapId }, from: { x: 10, y: 12 }, to: [{ x: 5, y: 8 }] }] }],
      layers: [{ title: "Optional", items: [{ id: "optional", title: "Inspect", instruction: "Optional inspection", requirementIds: ["optional-route"] }] }],
    } }, { name: "skip_work_item", args: { itemId: "optional" } }]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("skipped");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(f.snapshot().verification.findings).toEqual([]);
  });

  it("canonical tool verdict binds before execution and late adoption cannot reuse an exploratory pass", async () => {
    const f = rig();
    await f.send([probe(f.args)]);
    expect(f.snapshot().verification.requirements).toEqual([]);
    const declaration: Call = { name: "set_work_plan", args: { goal: "Canonical scene",
      requirements: [{ id: "canonical", title: "Scene", criteria: [{ kind: "toolVerdict", tool: "run_scene_test", args: f.args }] }],
      layers: [{ title: "Checks", items: [{ id: "canonical-item", title: "Inspect", instruction: "Inspect" }] }],
    } };
    await f.send([declaration]);
    const original = f.snapshot().verification.requirements.find(requirement => requirement.acceptedCriterion?.kind === "toolVerdict");
    expect(original).toMatchObject({ args: f.args, status: "unverified" });
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await f.send([probe(f.args)]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    const protectedProject = f.session.getProposedProject();
    const edited = structuredClone(protectedProject);
    edited.session.gold = 99;
    expect(f.session.syncBaselineFromStoreIfClean(edited)).toBe(true);
    await f.send([probe({ ...f.args, start: { x: 4, y: 6 } })]);
    expect(f.snapshot().verification.requirements.find(requirement => requirement.checkId === original!.checkId)?.status).toBe("stale");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await f.send([probe(f.args)]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(f.session.getVerificationSnapshot().requirements[0]?.initialState).toEqual(original!.initialState);
    expect(f.session.syncBaselineFromStoreIfClean(protectedProject)).toBe(true);
    await f.send([probe(f.args)]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it("normal final repair is bounded by authoritative findings without an acceptance declaration", async () => {
    const f = rig(8);
    const failed = { ...f.args, steps: [{ kind: "expect", goldDelta: 1 }] };
    const result = await f.send([probe(failed)], [], [{ name: "get_project_summary", args: {} }]);
    expect(f.events.filter(event => event.type === "tool_call" && event.name === "get_project_summary")).toHaveLength(1);
    expect(f.snapshot().verification.findings).toHaveLength(1);
    expect(f.requests()).toBeLessThanOrEqual(6);
    expect(result.assistantText).not.toBe("FINAL_SENTINEL");
    expect(result.runOutcome?.execution).toBe("blocked");
  });

  it("budget-terminal assessment retains the finding without exceeding execution budget", async () => {
    const f = rig(1);
    const result = await f.send([probe({ ...f.args, steps: [{ kind: "expect", goldDelta: 1 }] })]);
    expect(f.events.filter(event => event.type === "tool_call")).toHaveLength(1);
    expect(f.requests()).toBe(1);
    expect(f.snapshot().verification.findings).toHaveLength(1);
    expect(result.completionAssessment?.verification).toHaveLength(1);
    expect(result.runOutcome?.execution).toBe("budget-exhausted");
  });

  it("successful exploratory checks do not become repair obligations after a write", async () => {
    const f = rig(8);
    const result = await f.send([probe(f.args), { name: "set_title_screen", args: { title: "Exploratory control" } }]);
    expect(f.snapshot().verification.requirements).toEqual([]);
    expect(f.snapshot().verification.findings).toEqual([]);
    expect(f.requests()).toBe(2);
    expect(result.assistantText).toBe(`FINAL_SENTINEL\n\n${DETERMINISTIC_PASS} — 변경 맵 0개, lint error 0건.`);
  });
  it.each(["pending-specification", "unverified", "stale", "passed"])("rejects skip atomically with %s proof and retains completion", async status => {
    const f = rig();
    await f.send([f.plan(status !== "pending-specification"), ...(["stale", "passed"].includes(status) ? [probe(f.args)] : [])]);
    if (status === "stale") {
      const edited = f.session.getProposedProject();
      edited.meta.title = "External title edit";
      expect(f.session.syncBaselineFromStoreIfClean(edited)).toBe(true);
    }
    expect(f.snapshot().verification.requirements[0]?.status).toBe(status);
    await f.send([skip]);
    const calls = f.events.filter(event => event.type === "tool_call" && event.name === "skip_work_item");
    expect(calls).toMatchObject([{ result: { ok: false } }]);
    expect(f.boundary().after).toEqual(f.boundary().before);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("skipped");
    if (status !== "passed") expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    if (status === "pending-specification") {
      const pending = f.snapshot().verification.requirements[0]!;
      const declaration = f.plan();
      const layers = declaration.args.layers as { items: { verificationChecks?: { checkId?: string }[] }[] }[];
      layers[0]!.items[0]!.verificationChecks![0]!.checkId = pending.checkId;
      await f.send([declaration]);
      expect(f.snapshot().verification.requirements[0]).toMatchObject({ ownerId: pending.ownerId, status: "unverified" });
    }
    await f.send([probe(f.args), { name: "get_project_summary", args: {} }, { name: "complete_work_item", args: { itemId: "verify" } }]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    await f.send([{ name: "skip_work_item", args: { itemId: "optional" } }]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[1]?.status).toBe("skipped");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });
});
