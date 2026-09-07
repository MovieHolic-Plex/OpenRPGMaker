import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAcceptance, parseAcceptanceCriteria, type AcceptanceCriterion } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { hasUnresolvedWriteConstraint } from "@/ai/assistantRequestContract";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import * as evaluation from "@/ai/assistantAcceptanceEvaluation";
import * as volume from "@/ai/volumeContract";
import { createBlankProject } from "@/project/defaults";

afterEach(() => vi.restoreAllMocks());
const anchor = (raw: string, quote = raw) => ({ start: raw.indexOf(quote), end: raw.indexOf(quote) + quote.length, quote });
const title = (value: string): AcceptanceCriterion => ({ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value });
const titleEntry = (raw: string, value: string, quote = raw) => ({ source: [anchor(raw, quote)], criteria: [title(value)], bindings: [
  { source: anchor(raw, JSON.stringify(value)), role: "value", criterionIndex: 0, fieldPath: ["value"] },
] });

describe("canonical authored source integration", () => {
  it("I1-authored-value-enters-existing-parser-ledger-and-host-withdrawal", () => {
    const project = createBlankProject();
    const criteria = [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Requested title" }];
    const promises = parseAcceptance([{ id: "title", title: "Title", criteria }]);
    const ledger = new AssistantAcceptanceLedger("goal", "Set title", project);
    ledger.adopt(promises ?? []);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    const draft = structuredClone(project);
    draft.meta.title = "Requested title";
    expect(ledger.evaluate(project, draft).status).toBe("verifying");
    expect(ledger.evaluate(draft).status).toBe("verified");
    const failed = ledger.evaluate(project);
    expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "title", reason: "Host removed title" })).toBe(true);
    expect(ledger.evaluate(project)).toMatchObject({ status: "verified", items: [{ id: "title", evidence: [{ passed: false }], withdrawal: { source: "user" } }] });
    expect(failed.items[0]?.withdrawal).toBeUndefined();
  });

  it.each(["before", "after"] as const)("I2-source-ID-is-required-despite-%s-planner-collision-and-repair", order => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    const raw = 'Set title to "Requested"; preserve the item';
    const weaken = () => ledger.adopt([{ id: "r:source:0", title: "Optional", required: false, criteria: [title(project.meta.title)] }]);
    if (order === "before") weaken();
    const scope = { mapId: project.startMapId, region: { x: 1, y: 2, width: 3, height: 4 } };
    ledger.startRequest("r", raw, project, true, scope);
    if (order === "after") weaken();
    expect(ledger.repair("r:source:0", [title(project.meta.title)])).toBe(false);
    ledger.adoptRequestRequirements("r", { entries: [titleEntry(raw, "Requested", 'Set title to "Requested"')] });
    const history = ledger.evaluate(project);
    expect(history.items).toHaveLength(2);
    expect(history.items[0]).toMatchObject({ id: "r:source:0", required: true, source: { requestId: "r", text: raw, scope }, coverage: "declared", evidence: [{ passed: false }] });
    scope.region.x = 9;
    expect(history.items[0]?.source?.scope?.region.x).toBe(1);
    project.meta.title = "Requested";
    ledger.adopt([{ id: "extra", title: "Optional sibling", required: false, criteria: [title("Unmet optional")] }]);
    expect(ledger.evaluate(project).status).toBe("blocked");
    expect(ledger.withdraw({ acceptanceId: "wrong", requirementId: "r:source:1", reason: "Stale" })).toBe(false);
    expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "r:source:1", reason: "Remove only preservation" })).toBe(true);
    expect(ledger.evaluate(project)).toMatchObject({ status: "verified", items: [
      { id: "r:source:0", required: true, status: "verified" },
      { id: "r:source:1", required: true, status: "blocked", coverage: "uncovered", withdrawal: { source: "user" } },
      { id: "extra", required: false, status: "working", evidence: [{ passed: false }] },
    ] });
    expect(history.items[1]?.withdrawal).toBeUndefined();
    expect(hasUnresolvedWriteConstraint(ledger.getRequests())).toBe(false);
    expect([history, history.items, history.items[0], history.items[0]?.source, history.items[0]?.sourceSpan, history.items[0]?.evidence].every(Object.isFrozen)).toBe(true);
  });

  it.each([false, true])("I3-withdrawal-freezes-source-history-before-late-extraction-declared=%s", declared => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    const raw = 'Set title to "Requested"';
    const payload = { entries: [titleEntry(raw, "Requested")] };
    ledger.startRequest("r", raw, project);
    if (declared) ledger.adoptRequestRequirements("r", payload);
    const before = ledger.evaluate(project);
    expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "r:source:0", reason: "Host removed it" })).toBe(true);
    ledger.adoptRequestRequirements("r", payload);
    ledger.startRequest("r", "Changed source", project);
    ledger.adopt([{ id: "r:source:0", title: "Replacement", criteria: [title("Requested")] }]);
    expect(ledger.repair("r:source:0", [title("Requested")])).toBe(false);
    project.meta.title = "Requested";
    const after = ledger.evaluate(project);
    expect(after.status).toBe("verified");
    expect(after.items[0]?.status).toBe(before.items[0]?.status);
    expect(after.items[0]?.evidence).toEqual(before.items[0]?.evidence);
    expect(after.items[0]?.coverage).toBe(declared ? "declared" : "uncovered");
    expect(ledger.getRequests()[0]).toMatchObject({ rawInstruction: raw, units: [{ withdrawal: { requirementId: "r:source:0" } }] });
    expect(before.items[0]?.withdrawal).toBeUndefined();
  });

  it("I4-exact-field-amendment-retires-only-named-authority-and-keeps-failing-history", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    const first = 'Set title to "Original"';
    ledger.startRequest("r1", first, project);
    ledger.adoptRequestRequirements("r1", { entries: [titleEntry(first, "Original")] });
    ledger.adopt([{ id: "sibling", title: "Keep sibling", criteria: [{ kind: "entityPreserve", subject: { kind: "project" }, path: ["system"] }] }]);
    const history = ledger.evaluate(project);
    const raw = 'Change title to "Corrected" instead';
    const payload = { entries: [titleEntry(raw, "Corrected")], amendments: [{ obligationId: "r1:source:0", source: anchor(raw) }] };
    ledger.startRequest("r2", raw, project);
    ledger.adoptRequestRequirements("r2", payload);
    project.meta.title = "Corrected";
    expect(ledger.evaluate(project).status).not.toBe("verified");
    ledger.adoptUserAmendments("r2", payload);
    const result = ledger.evaluate(project);
    expect(result.status).toBe("verified");
    expect(result.items[0]).toMatchObject({ id: "r1:source:0", status: "working", evidence: [{ passed: false }], supersession: { requestId: "r2", requirementId: "r2:source:0", source: anchor(raw) } });
    expect(result.items[1]).toMatchObject({ id: "sibling", status: "verified" });
    expect(history.items[0]?.supersession).toBeUndefined();
    ledger.adoptRequestRequirements("r1", { entries: [titleEntry(first, "Original")] });
    expect(ledger.getRequests()[0]?.units[0]).toMatchObject({ supersededBy: "r2", criteria: [title("Original")], archivedEvidence: [{ passed: false }] });
    expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "r2:source:0", reason: "Remove replacement too" })).toBe(true);
    project.meta.title = "Neither";
    expect(ledger.evaluate(project).status).toBe("verified");
    expect(ledger.getRequests()[0]?.units[0]?.supersededBy).toBe("r2");
    expect(Object.isFrozen(result.items[0]?.supersession?.source)).toBe(true);
  });

  it.each(["wrong-field", "wrong-id", "ambiguous", "unresolved", "no-correction", "forged-anchor"] as const)("I5-unproven-amendment-%s-does-not-retire-original", scenario => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    const first = 'Set title to "Original"';
    ledger.startRequest("r1", first, project);
    if (scenario !== "unresolved") ledger.adoptRequestRequirements("r1", { entries: [titleEntry(first, "Original")] });
    if (scenario === "ambiguous") {
      ledger.startRequest("duplicate", first, project);
      ledger.adoptRequestRequirements("duplicate", { entries: [titleEntry(first, "Original")] });
    }
    const raw = scenario === "no-correction" ? 'Set title to "Corrected"' : 'Change title to "Corrected" instead';
    ledger.startRequest("r2", raw, project);
    const entry = titleEntry(raw, "Corrected");
    ledger.adoptRequestRequirements("r2", { entries: [{ ...entry, criteria: scenario === "wrong-field"
      ? [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "description"], value: "Corrected" }] : entry.criteria }] });
    ledger.adoptUserAmendments("r2", { amendments: [{ obligationId: scenario === "wrong-id" ? "absent" : "r1:source:0",
      source: scenario === "forged-anchor" ? { ...anchor(raw), quote: "FORGED" } : anchor(raw) }] });
    expect(ledger.getRequests()[0]?.units[0]?.supersededBy).toBeUndefined();
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it("I6-source-bindings-are-owned-copies-and-answer-sources-grant-no-authoring", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    const raw = 'Set title to "Requested"';
    const payload = { entries: [titleEntry(raw, "Requested")] };
    ledger.startRequest("answer", "Why?", project, false);
    ledger.startRequest("r", raw, project);
    ledger.adoptRequestRequirements("r", payload);
    const captured = ledger.getRequests();
    payload.entries[0]!.bindings[0]!.source.quote = "FORGED";
    expect(ledger.getRequests()[1]?.units[0]?.bindings).toEqual(captured[1]?.units[0]?.bindings);
    expect(ledger.getRequests()[1]?.units[0]?.bindings?.[0]?.source.quote).toBe('"Requested"');
    expect(ledger.evaluate(project).items.map(item => item.id)).toEqual(["r:source:0"]);
  });

  it.each(["pass", "wrong-args", "advisory", "stale", "draft"] as const)("I7-source-tool-verdict-keeps-main-exact-evidence-contract-%s", scenario => {
    const applied = createBlankProject();
    const draft = scenario === "draft" ? structuredClone(applied) : applied;
    if (scenario === "draft") draft.meta.title = "Unapplied";
    const ledger = new AssistantAcceptanceLedger("goal", "Verify", applied);
    const raw = "Verify the route";
    const args = { mapId: applied.startMapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    ledger.startRequest("r", raw, applied);
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], bindings: [], criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }] });
    const evidence = new ToolVerificationEvidence();
    evidence.observe("check_reachability", scenario === "wrong-args" ? { ...args, targets: [{ x: 2, y: 0 }] } : args,
      { ok: true, data: { reachable: true } }, scenario === "advisory" ? "advisory" : "explicit");
    if (scenario === "stale") evidence.invalidateAfterWrite();
    const result = ledger.evaluate(applied, draft, evidence);
    expect(result.status === "verified").toBe(scenario === "pass");
    expect(result.items[0]?.status).toBe(scenario === "draft" ? "verifying" : scenario === "pass" ? "verified" : "working");
    if (scenario === "pass") expect(ledger.evaluate(applied, applied, evidence, ["Required domain check failed"]).status).toBe("blocked");
  });

  it("I8-source-and-planner-verdicts-share-one-full-project-comparison", () => {
    const applied = createBlankProject(), draft = structuredClone(applied);
    draft.meta.title = "Unapplied";
    const ledger = new AssistantAcceptanceLedger("goal", "Verify", applied);
    const raw = "Verify lint; verify again";
    ledger.startRequest("r", raw, applied);
    ledger.adoptRequestRequirements("r", { entries: ["Verify lint", "verify again"].map(quote => ({ source: [anchor(raw, quote)], bindings: [], criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] })) });
    ledger.adopt([{ id: "planner", title: "Lint", criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }]);
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, { ok: true, data: { counts: { errors: 0 } } });
    const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
    expect(ledger.evaluate(applied, draft, evidence).items.map(item => item.status)).toEqual(["verifying", "verifying", "verifying"]);
    expect(fingerprints.mock.calls.filter(([value]) => value === applied || value === draft)).toHaveLength(2);
  });

  it("I9-volume-is-additive-baselined-applied-and-host-addressable", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Volumes", project);
    const bar = { authoredMaps: 0, multiPageNpcs: 0, shops: 1, quests: 0 };
    ledger.startRequest("r1", "Add a shop", project);
    // Source and supplemental volume have explicit separate IDs, not an inferred semantic alias.
    expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "r1:source:0", reason: "Keep only the supported volume" })).toBe(true);
    project.maps[project.startMapId]!.events.push({ id: "shop-one", x: 0, y: 0, trigger: { kind: "action" }, commands: [{ kind: "shop", itemIds: [project.database.items[0]!.id] }] });
    ledger.requireVolume("r1", bar, project); // Late adoption must use startRequest's pre-write baseline.
    expect(ledger.evaluate(project).status).toBe("verified");
    ledger.requireVolume("r2", bar, project);
    ledger.requireVolume("r2", { ...bar, shops: 0 }, project);
    const draft = structuredClone(project);
    draft.maps[draft.startMapId]!.events.push({ id: "shop-two", x: 1, y: 0, trigger: { kind: "action" }, commands: [{ kind: "shop", itemIds: [project.database.items[0]!.id] }] });
    expect(ledger.evaluate(project, draft).status).not.toBe("verified");
    const measure = vi.spyOn(volume, "measureVolume");
    expect(ledger.evaluate(draft).status).toBe("verified");
    expect(measure).toHaveBeenCalledTimes(1);
    const failed = ledger.evaluate(project);
    expect(ledger.getVolumeGaps(project)).toHaveLength(1);
    expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "r2:volume", reason: "Remove second shop only" })).toBe(true);
    ledger.requireVolume("r2", { ...bar, shops: 3 }, project);
    expect(ledger.repair("r2:volume", [title(project.meta.title)])).toBe(false);
    expect(ledger.evaluate(draft).items.find(item => item.id === "r2:volume")?.evidence).toEqual(failed.items.find(item => item.id === "r2:volume")?.evidence);
    expect(ledger.getVolumeGaps(project)).toEqual([]);
    project.maps[project.startMapId]!.events = [];
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it.each([
    { kind: "project", mapId: "map" }, { kind: "database", collection: "items" },
    { kind: "event", mapId: "map", eventId: "event", id: "extra" }, { kind: "asset", category: "binary", id: "asset" },
  ])("I10-mixed-or-missing-subject-fields-fail-closed-%j", subject => {
    expect(parseAcceptanceCriteria([{ kind: "entityPreserve", subject }])).toBeNull();
  });
  it.each([{ all: false }, { all: true, ids: ["id"] }, { names: ["duplicate", "duplicate"] }, { ids: [] }])("I10-invalid-selector-fails-closed-%j", selector => {
    expect(parseAcceptanceCriteria([{ kind: "entityCount", collection: { kind: "database", collection: "items" }, selector, comparison: "eq", basis: "current", count: 0 }])).toBeNull();
  });
  it("I10-ambiguous-names-and-duplicate-identities-never-satisfy-counts", () => {
    const project = createBlankProject();
    const item = project.database.items[0]!;
    const ledger = new AssistantAcceptanceLedger("goal", "Count", project);
    ledger.adopt([{ id: "count", title: "Count", criteria: [{ kind: "entityCount", collection: { kind: "database", collection: "items" }, selector: { names: [item.name] }, comparison: "eq", basis: "current", count: 2 }] }]);
    project.database.items.push({ ...item, id: "distinct" });
    expect(ledger.evaluate(project).status).not.toBe("verified");
    project.database.items[project.database.items.length - 1]!.id = item.id;
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });
});
