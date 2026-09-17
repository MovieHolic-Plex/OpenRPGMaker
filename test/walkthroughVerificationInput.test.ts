import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { parseVerificationChecks, ToolVerificationEvidence, verificationInput } from "@/ai/toolVerificationEvidence";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision, workPlanFromSetToolArgs } from "@/ai/workPlan";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { validateWalkthroughScenario, type WalkthroughStep } from "@/testing/walkthroughRunner";
import { verificationEvent } from "./fixtures/verificationOwnership";
import { fixedDeclarer } from "./intentFixture";

const tool = "play_walkthrough";
const malformed = { scenario: [{ do: "interact" }] };
const valid = { scenario: [{ do: "interact", eventId: "reward" }, { expect: "gold", value: 20 }], seed: 17 };

function fixture() {
  const project = createBlankProject();
  project.session.gold = 0;
  project.maps[project.startMapId]!.events = [verificationEvent("reward", 2, 2, [{ kind: "changeGold", op: "+=", amount: 20 }])];
  return project;
}

// 2026-09-17: 수용 원장이 사라져 plan 의 acceptance 배열은 무시된다. 검증 계약은 항목의 verificationChecks 만 담는다.
function plan(_project: ReturnType<typeof fixture>, args: Record<string, unknown>, checkId?: string) {
  return { goal: "Check the reward", layers: [{ title: "QA", items: [{ id: "reward-check", title: "Reward", instruction: "Check reward", successTools: [tool],
    verificationChecks: [{ tool, args, ...(checkId ? { checkId } : {}) }],
  }] }] };
}

const validSteps: WalkthroughStep[] = [
  { do: "moveTo", mapId: "map_blank_start", x: 1, y: 1 },
  { do: "interact", eventId: "reward" },
  { do: "interact", x: 2, y: 2 },
  { do: "interact", eventId: "reward", x: 2, y: 2 },
  { do: "choose", index: 0 },
  { do: "battle", expect: "victory" },
  { do: "battle", expect: "defeat" },
  { expect: "switch", switchId: "switch" },
  { expect: "switch", switchId: "switch", value: false },
  { expect: "item", itemId: "item" },
  { expect: "item", itemId: "item", present: false, count: 0 },
  { expect: "variable", variableId: "variable", value: 0 },
  { expect: "variable", variableId: "variable", op: ">=", value: -1.5 },
  { expect: "mapId", mapId: "map_blank_start" },
  { expect: "gold", value: 0 },
  { expect: "gold", op: "=", value: 0 },
  { expect: "gold", op: ">=", value: 0 },
  { expect: "gold", op: "<=", value: 0 },
  { expect: "gold", op: ">", value: -1 },
  { expect: "gold", op: "<", value: 1 },
  { expect: "ended" },
];

const invalidScenarios: unknown[] = [
  [], [{}], malformed.scenario,
  [{ do: "interact", eventId: " " }],
  [{ do: "interact", x: 2 }],
  [{ do: "interact", eventId: "reward", y: 2 }],
  [{ do: "moveTo", x: 1, y: 1 }],
  [{ do: "moveTo", mapId: "map_blank_start", x: 1.5, y: 1 }],
  [{ do: "choose" }],
  [{ do: "choose", index: -1 }],
  [{ do: "choose", index: 0, mapId: "map_blank_start" }],
  [{ do: "battle" }],
  [{ do: "battle", expect: "ended" }],
  [{ expect: "switch" }],
  [{ expect: "switch", switchId: "switch", value: 1 }],
  [{ expect: "item" }],
  [{ expect: "item", itemId: "item", count: -1 }],
  [{ expect: "variable", value: 0 }],
  [{ expect: "variable", variableId: "variable" }],
  [{ expect: "variable", variableId: "variable", op: "!=", value: 0 }],
  [{ expect: "mapId" }],
  [{ expect: "gold" }],
  [{ expect: "gold", value: "20" }],
  [{ expect: "ended", value: true }],
  [{ do: "unknown" }],
  [{ expect: "unknown" }],
  [valid.scenario[0], { do: "interact" }],
];

describe("walkthrough verification uses the native structured boundary", () => {
  it.each(validSteps)("preserves valid native step %j and its real artifact verdict", step => {
    const args = { scenario: [step], seed: 17 };
    expect(validateWalkthroughScenario(args.scenario).ok).toBe(true);
    expect(verificationInput(tool, args)).toEqual(args);
    expect(parseVerificationChecks([{ tool, args }])).toEqual([{ tool, args }]);
    const result = runTool({ project: fixture() }, tool, args);
    expect(result.ok).toBe(true);
    const evidence = new ToolVerificationEvidence();
    evidence.observe(tool, args, result);
    const passed = (result.data as { ok: boolean }).ok;
    expect(evidence.snapshot().attempts[0]?.status).toBe(passed ? "passed" : "negative");
    expect(evidence.snapshot().findings).toHaveLength(passed ? 0 : 1);
  });

  it.each(invalidScenarios.map(scenario => ({ scenario })))("rejects malformed native scenario %j before adopting or judging artifacts", args => {
    expect(validateWalkthroughScenario(args.scenario).ok).toBe(false);
    const result = runTool({ project: fixture() }, tool, args);
    expect(result).toMatchObject({ ok: true, data: { ok: false, stepsRun: 0 } });
    expect(verificationInput(tool, args)).toBeNull();
    expect(parseVerificationChecks([{ tool, args }])).toBeUndefined();
    const evidence = new ToolVerificationEvidence();
    evidence.adopt({ checkId: "pending", ownerId: "owner", name: tool, args: null });
    evidence.observe(tool, args, result, "explicit", "owner");
    expect(evidence.snapshot()).toMatchObject({ requirements: [{ status: "pending-specification", args: null }],
      findings: [], attempts: [{ name: tool, args, result, status: "unsuccessful", ownerId: "owner" }] });
    expect(evidence.passed(tool, ["pending"])).toBe(false);
  });

  it.each([malformed, valid])("applies the same validation in both plan parsing paths (%j)", args => {
    const input = plan(fixture(), args);
    const parsed = parseOrchestratorDecision(JSON.stringify({ action: "new_plan", ...input }));
    if (!parsed.decision || parsed.decision.action !== "new_plan") throw new Error("Plan parsing failed");
    const expected = args === malformed ? undefined : [{ tool, args }];
    expect(workPlanFromSetToolArgs(input)?.layers[0]?.items[0]?.verificationChecks).toEqual(expected);
    expect(workPlanFromOrchestratorDecision(parsed.decision).layers[0]?.items[0]?.verificationChecks).toEqual(expected);
  });

  it("revokes owned proof on malformed invocation without creating or clearing artifact findings", () => {
    const project = fixture();
    const evidence = new ToolVerificationEvidence();
    evidence.adopt({ checkId: "reward", ownerId: "owner", name: tool, args: valid });
    evidence.observe(tool, valid, runTool({ project }, tool, valid), "explicit", "owner");
    expect(evidence.snapshot().requirements[0]?.status).toBe("passed");
    const negative = { scenario: [{ expect: "gold", value: 20 }] };
    evidence.observe(tool, negative, runTool({ project }, tool, negative));
    const finding = evidence.snapshot().findings[0];
    expect(finding).toBeDefined();
    evidence.observe(tool, malformed, runTool({ project }, tool, malformed), "explicit", "owner");
    expect(evidence.snapshot().requirements[0]?.status).toBe("unverified");
    expect(evidence.snapshot().attempts.at(-1)?.status).toBe("unsuccessful");
    expect(evidence.snapshot().findings).toEqual([finding]);
    expect(evidence.correction("reward", malformed)).toBeNull();
    evidence.observe(tool, valid, runTool({ project }, tool, valid), "explicit", "owner");
    expect(evidence.snapshot().requirements[0]?.status).toBe("passed");
    expect(evidence.snapshot().findings).toEqual([finding]);
    project.session.gold = 20;
    evidence.invalidateAfterWrite();
    evidence.observe(tool, negative, runTool({ project }, tool, negative));
    expect(evidence.snapshot().findings).toEqual([]);
    expect(evidence.snapshot().requirements[0]?.status).toBe("stale");
  });
});

type Call = { name: string; args: Record<string, unknown> };

describe("normal AssistantSession walkthrough declaration and terminal boundaries", () => {
  it.each([false, true])("bad then valid passing walkthrough cannot poison findings (initial declaration malformed=%s)", async invalidDeclaration => {
    const project = fixture();
    const originalProject = structuredClone(project);
    const snapshots: ReturnType<AssistantSession["getVerificationSnapshot"]>[] = [];
    const events: SessionEvent[] = [];
    let cursor = 0;
    const calls: Array<(session: AssistantSession) => Call> = [
      () => ({ name: "set_work_plan", args: plan(project, invalidDeclaration ? malformed : valid) }),
      () => ({ name: tool, args: malformed }),
      () => ({ name: "complete_work_item", args: {} }),
      () => ({ name: tool, args: valid }),
      ...(invalidDeclaration ? [
        (session: AssistantSession) => ({ name: "set_work_plan", args: plan(project, valid, session.getVerificationSnapshot().requirements[0]!.checkId) }),
        () => ({ name: "complete_work_item", args: {} }),
        () => ({ name: tool, args: valid }),
      ] : []),
      () => ({ name: "complete_work_item", args: {} }),
    ];
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      chat: async (): Promise<ChatResult> => {
        snapshots.push(session.getVerificationSnapshot());
        const call = calls[cursor++]?.(session);
        return call ? { message: { role: "assistant", content: null, tool_calls: [{ id: `walkthrough-${cursor}`, type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.args) } }] }, finishReason: "tool_calls" }
          : { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
      },
    });
    const result = await session.sendUserMessage("Inspect the reward walkthrough.", event => events.push(event));
    expect(result.stoppedReason, result.error).toBe("final");
    const afterBad = snapshots.find(snapshot => snapshot.attempts.length === 1)!;
    expect(afterBad).toMatchObject({ findings: [], attempts: [{ name: tool, args: malformed, status: "unsuccessful" }],
      requirements: [{ status: invalidDeclaration ? "pending-specification" : "unverified" }] });
    const firstRequirement = afterBad.requirements[0]!;
    if (invalidDeclaration) {
      expect(snapshots.some(snapshot => snapshot.attempts.length === 2 && snapshot.requirements[0]?.status === "pending-specification")).toBe(true);
      expect(snapshots.some(snapshot => snapshot.attempts.length === 2 && snapshot.requirements[0]?.status === "unverified")).toBe(true);
    }
    expect(events.filter(event => event.type === "tool_call" && event.name === "complete_work_item")
      .map(event => event.type === "tool_call" && event.result.ok)).toEqual(invalidDeclaration ? [false, false, true] : [false, true]);
    expect(events.filter(event => event.type === "tool_call" && event.name === tool)
      .map(event => event.type === "tool_call" && event.result)).toEqual(expect.arrayContaining([
        expect.objectContaining({ ok: true, data: expect.objectContaining({ ok: false, stepsRun: 0 }) }),
        expect.objectContaining({ ok: true, data: expect.objectContaining({ ok: true, stepsRun: 2, finalState: expect.objectContaining({ gold: 20 }) }) }),
      ]));
    expect(session.getVerificationSnapshot()).toMatchObject({ requirements: [{ checkId: firstRequirement.checkId,
      ownerId: firstRequirement.ownerId, args: valid, status: "passed" }], findings: [] });
    expect(session.getVerificationSnapshot().requirements).toHaveLength(1);
    // Layer and completion advisories each execute lint plus the successful
    // scenario. Keep those real attempts in the audit rather than mocking them.
    expect(session.getVerificationSnapshot().attempts.map(({ name, args, status }) => ({ name, args, status }))).toEqual([
      { name: tool, args: malformed, status: "unsuccessful" },
      { name: tool, args: valid, status: "passed" },
      ...(invalidDeclaration ? [{ name: tool, args: valid, status: "passed" }] : []),
      { name: "run_lint", args: {}, status: "passed" },
      { name: tool, args: { scenario: valid.scenario }, status: "passed" },
      { name: "run_lint", args: {}, status: "passed" },
      { name: tool, args: { scenario: valid.scenario }, status: "passed" },
    ]);
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(session.getProposedProject()).toEqual(originalProject);
  });
});
