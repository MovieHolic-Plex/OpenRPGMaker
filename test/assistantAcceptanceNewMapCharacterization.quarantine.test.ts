// Captured round5 promise through the parser, ledger and actual session boundary.
import { afterEach, describe, expect, it, vi } from "vitest";
import captured from "./fixtures/acceptance-round5-new-map.json";
import { parseAcceptance, parseAcceptanceCriteriaResult, type AcceptanceCriterion } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { parseOrchestratorDecision, workPlanFromSetToolArgs } from "@/ai/workPlan";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import * as applyStore from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";

afterEach(() => vi.restoreAllMocks());
const capturedName = captured.planPromise.criteria[5]?.target?.newMapName;
if (typeof capturedName !== "string") throw new Error("Captured new-map selector missing");
const nameTarget = { newMapName: capturedName };
const literalTarget = { mapId: "map_basement" };
const work = { goal: "Offline new-map characterization", layers: [{ title: "Build", items: [{ title: "Build", instruction: "Create the requested map" }] }] };
function createCellar(project: ReturnType<typeof createBlankProject>, id = literalTarget.mapId) {
  project.maps[id] = { ...structuredClone(project.maps[project.startMapId]), id, name: nameTarget.newMapName,
    width: 12, height: 10, lowerTiles: Array<number>(120).fill(0), upperTiles: Array<number>(120).fill(-1), events: [] };
}
function adopted(criteria: readonly AcceptanceCriterion[]) {
  const project = createBlankProject();
  const ledger = new AssistantAcceptanceLedger("probe", "Probe", project);
  ledger.adopt([{ id: "p", title: "Probe", criteria }]);
  return { project, ledger };
}

describe("round5 new-map acceptance characterization", () => {
  it("accepts the captured promise through both plan parsers and the initial repair", () => {
    const args = { ...work, acceptance: [captured.planPromise] };
    const parsed = parseAcceptanceCriteriaResult(captured.acceptedRepair.criteria);
    expect(parsed.issues).toEqual([]);
    expect(parsed.criteria).toEqual(captured.planPromise.criteria);
    expect(workPlanFromSetToolArgs(args)?.acceptance?.[0].criteria).toEqual(parsed.criteria);
    expect(parseOrchestratorDecision(JSON.stringify({ action: "new_plan", ...args })).decision).toMatchObject({ acceptance: [{ criteria: parsed.criteria }] });
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("probe", "Probe", project);
    ledger.adopt(parseAcceptance([{ id: captured.acceptedRepair.itemId, title: "Original request" }])!);
    expect(ledger.repair(captured.acceptedRepair.itemId, captured.acceptedRepair.criteria)).toMatchObject({ ok: true, code: "repaired" });
    createCellar(project);
    const village = project.maps[project.startMapId];
    village.name = "Changed village";
    village.events = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, x: i, y: 0, trigger: { kind: "action" as const }, commands: [] }));
    expect(ledger.evaluate(project).items[0].evidence.map(entry => entry.passed)).toEqual([true, true, true, true, true, true]);
    expect(ledger.repair(captured.rejectedRepair.itemId, captured.rejectedRepair.criteria)).toMatchObject({ ok: false, code: "immutable-valid" });
    const before = ledger.evaluate(project).items[0].evidence.map(entry => entry.expected);
    project.maps.map_basement.lowerTiles[0] = 42;
    ledger.adopt(parseAcceptance([captured.planPromise])!, project);
    ledger.stop(); ledger.resume();
    expect(ledger.evaluate(project).items[0].evidence.map(entry => entry.expected)).toEqual(before);
    expect(ledger.evaluate(project).items[0].evidence.map(entry => entry.passed)).toEqual([true, true, true, true, true, true]);
  });

  it.each([
    { kind: "preserve", target: nameTarget },
    { kind: "preserve", target: literalTarget },
    { kind: "targetChange", target: literalTarget },
  ] as const)("rejects unsupported original $kind/$target atomically at adoption and repair", unsupported => {
    const project = createBlankProject(), target = { mapId: project.startMapId };
    const ledger = new AssistantAcceptanceLedger("probe", "Probe", project);
    const criteria = [{ kind: "eventCount" as const, target, count: 0 }, unsupported];
    expect(parseAcceptanceCriteriaResult(criteria).issues).toEqual([]);
    ledger.adopt([{ id: "p", title: "Original title", criteria }, { id: "valid", title: "Keep", criteria: [{ kind: "preserve", target }] }]);
    const issue = { criterionIndex: 1, field: "criteria[1].target", code: "unsupported-original-target" };
    expect(ledger.evaluate(project).items).toMatchObject([
      { id: "p", status: "blocked", evidence: [], issues: [issue] }, { id: "valid", status: "verified" },
    ]);
    createCellar(project);
    const before = ledger.evaluate(project);
    expect(ledger.repair("p", criteria)).toMatchObject({ ok: false, code: "malformed-criteria", issues: [issue] });
    expect(ledger.evaluate(project)).toEqual(before);
    expect(ledger.repair("p", [{ ...unsupported, region: { x: 0, y: 0, w: 2, h: 2 } }])).toMatchObject({
      ok: false, code: "malformed-criteria", issues: [{ ...issue, criterionIndex: 0, field: "criteria[0].target" }],
    });
    // Duplicate IDs cannot replace the captured title/baseline; only the repair tool can fill criteria.
    ledger.adopt([{ id: "p", title: "Replaced", criteria: [{ kind: "preserve", target: literalTarget }] }], project);
    expect(ledger.evaluate(project)).toEqual(before);
    expect(ledger.repair("p", [{ kind: "targetChange", target: nameTarget }])).toMatchObject({ ok: true, code: "repaired" });
    expect(ledger.evaluate(project).status).toBe("verified");
    expect(ledger.repair("p", criteria).code).toBe("immutable-valid");
    project.maps[project.startMapId].name = "Changed after original baseline";
    expect(ledger.evaluate(project).items[1].evidence[0].passed).toBe(false);
  });

  it.each([
    { region: undefined, passes: true },
    { region: { x: 0, y: 0, w: 12, h: 10 }, passes: true },
    { region: { x: 0, y: 0, w: 13, h: 10 }, passes: false },
  ])("credits only applied creation in valid scope $region", ({ region, passes }) => {
    const { project, ledger } = adopted([{ kind: "targetChange", target: nameTarget, ...(region ? { region } : {}) }]);
    expect(ledger.evaluate(project).items[0].evidence[0].passed).toBe(false);
    const draft = structuredClone(project);
    createCellar(draft);
    expect(ledger.evaluate(project, draft).items[0]).toMatchObject({ status: "verifying", mapId: literalTarget.mapId, evidence: [{ passed: false }] });
    expect(ledger.evaluate(draft).items[0].evidence[0].passed).toBe(passes);
    expect(ledger.evaluate(project).items[0].evidence[0].passed).toBe(false);
  });

  it("distinguishes missing selector syntax from a well-formed nonexistent literal ID", () => {
    for (const target of [undefined, {}, { mapId: "" }]) {
      const parsed = parseAcceptanceCriteriaResult([{ kind: "targetChange", ...(target ? { target } : {}) }]);
      expect(parsed.criteria).toBeNull();
      expect(parsed.issues[0]).toMatchObject({ field: "criteria[0].target", code: target ? "invalid-selector" : "missing-field" });
    }
    expect(parseAcceptanceCriteriaResult([{ kind: "targetChange", target: literalTarget }]).issues).toEqual([]);
  });

  it("retains existing-map change/preservation baselines across mutation and undo", () => {
    const target = { mapId: createBlankProject().startMapId };
    const { project, ledger } = adopted([{ kind: "targetChange", target }, { kind: "preserve", target }]);
    const original = structuredClone(project);
    expect(ledger.evaluate(project).items[0].evidence.map(entry => entry.passed)).toEqual([false, true]);
    project.maps[target.mapId].lowerTiles[0] = 42;
    expect(ledger.evaluate(project).items[0].evidence.map(entry => entry.passed)).toEqual([true, false]);
    expect(ledger.evaluate(original).items[0].evidence.map(entry => entry.passed)).toEqual([false, true]);
  });

  it("requires a unique new ID and retains its binding across draft, rename and replacement", () => {
    const project = createBlankProject();
    project.maps[project.startMapId].name = nameTarget.newMapName;
    const ledger = new AssistantAcceptanceLedger("probe", "Probe", project);
    ledger.adopt([{ id: "p", title: "Probe", criteria: [{ kind: "mapDimensions", target: nameTarget, width: 12, height: 10 }, { kind: "targetChange", target: nameTarget }] }]);
    expect(ledger.evaluate(project).items[0].mapId).toBeUndefined();
    const draft = structuredClone(project);
    createCellar(draft); createCellar(draft, "duplicate");
    expect(ledger.evaluate(project, draft).items[0].mapId).toBeUndefined();
    delete draft.maps.duplicate;
    expect(ledger.evaluate(project, draft).items[0]).toMatchObject({ status: "verifying", mapId: literalTarget.mapId, evidence: [{ passed: false }, { passed: false }] });
    expect(ledger.evaluate(draft).items[0].evidence.map(entry => entry.passed)).toEqual([true, true]);
    draft.maps.map_basement.name = "Renamed after binding";
    expect(ledger.evaluate(draft).items[0].mapId).toBe(literalTarget.mapId);
    delete draft.maps.map_basement;
    createCellar(draft, "replacement");
    expect(ledger.evaluate(draft).items[0].mapId).toBeUndefined();
    expect(ledger.evaluate(draft).items[0].evidence.map(entry => entry.passed)).toEqual([false, false]);
  });

  it("can preserve or modify a previously bound name in a later request baseline", () => {
    const { project, ledger } = adopted([{ kind: "mapDimensions", target: nameTarget, width: 12, height: 10 }]);
    createCellar(project);
    expect(ledger.evaluate(project).status).toBe("verified");
    for (const [id, kind] of [["keep", "preserve"], ["change", "targetChange"]] as const) {
      ledger.adopt([{ id, title: id, criteria: [{ kind, target: nameTarget }] }], project);
    }
    expect(ledger.evaluate(project).items.slice(1).map(item => item.evidence[0].passed)).toEqual([true, false]);
    project.maps.map_basement.lowerTiles[0] = 42;
    expect(ledger.evaluate(project).items.slice(1).map(item => item.evidence[0].passed)).toEqual([false, true]);
  });

  it.each(["repair", "plan"] as const)("verifies the captured promise after %s admission and real applied creation", async admission => {
    // Only provider/intent and external persistence are replaced. No remote calls.
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(false);
    vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async applied => ({
      ok: true, applied, commit: { commitId: null, persisted: false, reviewStatus: "approved", summary: "offline probe", toolNames: [], recordedAt: "2026-09-06T00:00:00.000Z" },
    }));
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden in offline characterization"));
    type Call = { name: string; args: Record<string, unknown> };
    const batches: Call[][] = [
      [{ name: "set_work_plan", args: { ...work, ...(admission === "plan" ? { acceptance: [captured.planPromise] } : {}) } }],
      ...(admission === "repair" ? [[{ name: "repair_acceptance", args: captured.acceptedRepair }]] : []),
      [{ name: "create_map", args: { id: literalTarget.mapId, name: nameTarget.newMapName, width: 12, height: 10 } }, { name: "set_map_properties", args: { mapId: "map_blank_start", name: "Changed village" } }],
      [{ name: "skip_work_item", args: {} }],
      [{ name: "repair_acceptance", args: captured.rejectedRepair }],
    ];
    let calls = 0;
    const project = createBlankProject();
    // Minimal unrelated event-count precondition; this fixture is never saved.
    project.maps[project.startMapId].events = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, x: i, y: 0, trigger: { kind: "action" }, commands: [] }));
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 16 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: project.startMapId }),
      chat: async (): Promise<ChatResult> => {
        const batch = batches[calls++];
        return batch ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({ id: `c${calls}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" }
          : { message: { role: "assistant", content: "SCRIPTED_SUCCESS" }, finishReason: "stop" };
      },
    });
    const result = await session.sendUserMessage("Create the requested map", event => events.push(event), undefined, { autonomous: true });
    expect(events.find(event => event.type === "tool_call" && event.name === "create_map")).toMatchObject({ result: { ok: true } });
    expect(session.baselineProject.maps.map_basement).toMatchObject({ width: 12, height: 10 });
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ evidence: [{ passed: true }, { passed: true }, { passed: true }, { passed: true }, { passed: true }, { passed: true }] }] });
    const repairs = events.filter(event => event.type === "tool_call" && event.name === "repair_acceptance");
    expect(repairs.at(-1)).toMatchObject({ result: { ok: false, data: { code: "immutable-valid" } } });
    if (admission === "repair") expect(repairs[0]).toMatchObject({ result: { ok: true, data: { code: "repaired" } } });
    expect(result.stoppedReason).toBe("final");
    expect(calls).toBeLessThan(20);
    expect(fetch).not.toHaveBeenCalled();
    session.clearWorkPlan();
    session.refreshAcceptance(session.baselineProject);
    expect(session.getAcceptanceSnapshot()?.items[0].evidence[5].passed).toBe(true);
  });

  it("returns unsupported-target diagnostics from the real session adoption and repair handlers", async () => {
    const project = createBlankProject();
    const unsupported = { kind: "preserve", target: nameTarget };
    const events: SessionEvent[] = [];
    let calls = 0;
    const batches = [
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "bad", title: "Original", criteria: [unsupported] }] } }],
      [{ name: "repair_acceptance", args: { itemId: "bad", criteria: [unsupported] } }],
      [{ name: "repair_acceptance", args: { itemId: "bad", criteria: [{ kind: "preserve", target: { mapId: project.startMapId } }] } }],
      [{ name: "skip_work_item", args: {} }],
    ];
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 10 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: project.startMapId }),
      chat: async (): Promise<ChatResult> => {
        const batch = batches[calls++];
        return batch ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({ id: `c${calls}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" }
          : { message: { role: "assistant", content: "SCRIPTED_SUCCESS" }, finishReason: "stop" };
      },
    });
    await session.sendUserMessage("Preserve the requested map", event => events.push(event));
    const issue = { criterionIndex: 0, field: "criteria[0].target", code: "unsupported-original-target" };
    expect(events.find(event => event.type === "tool_call" && event.name === "set_work_plan")).toMatchObject({
      result: { data: { acceptance: { items: [{ status: "blocked", evidence: [], issues: [issue] }] } } },
    });
    expect(events.filter(event => event.type === "tool_call" && event.name === "repair_acceptance")).toMatchObject([
      { result: { ok: false, data: { code: "malformed-criteria", issues: [issue] } } },
      { result: { ok: true, data: { code: "repaired" } } },
    ]);
    expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

});
