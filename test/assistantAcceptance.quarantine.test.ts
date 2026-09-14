import { describe, expect, it } from "vitest";
import { parseOrchestratorDecision, workPlanFromSetToolArgs } from "@/ai/workPlan";

const acceptance = [{ id: "size", title: "Map size", criteria: [
  { kind: "mapDimensions", target: { mapId: "map_start" }, width: 20, height: 15 },
] }];
const plan = { goal: "Keep the authored size", acceptance, layers: [
  { title: "Check", items: [{ title: "Check map", instruction: "Inspect the map" }] },
] };

describe("immutable acceptance input", () => {
  it("retains structured promises when the planner authors a plan", () => {
    // Given a planner-authored promise; when parsed; then it is not discarded.
    const parsed = parseOrchestratorDecision(JSON.stringify({ action: "new_plan", ...plan }));
    expect(parsed.decision).toMatchObject({ acceptance });
  });

  it("retains the same contract through the in-loop plan tool", () => {
    // Given the same plan; when set by the generator; then its promises survive.
    expect(workPlanFromSetToolArgs(plan)).toMatchObject({ acceptance });
  });
});


import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { parseAcceptance, parseAcceptanceCriteria, type AcceptanceCriterion } from "@/ai/assistantAcceptance";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import type { GameMap } from "@/project/types";

function setup(criteria: readonly AcceptanceCriterion[]) {
  const project = createBlankProject();
  const ledger = new AssistantAcceptanceLedger("goal", "Original goal", project);
  ledger.adopt([{ id: "promise", title: "Original promise", criteria }]);
  return { project, ledger, map: project.maps[project.startMapId] };
}
const existing = { mapId: createBlankProject().startMapId };
const full = { x: 0, y: 0, w: 20, h: 15 };

function deliver(ledger: AssistantAcceptanceLedger, project: ReturnType<typeof createBlankProject>, region = full) {
  const result = runTool({ project }, "show_map_region", { mapId: project.startMapId, ...region });
  expect(result.ok).toBe(true);
  const receipt = ledger.captureImage(project, result.data);
  if (!receipt) throw new Error("Expected actual image metadata");
  ledger.deliverImages([receipt]);
}

describe("acceptance evaluator", () => {
  it.each([undefined, [], [{ kind: "mapDimensions", target: existing, width: 20, height: 15 }, { kind: "unknown" }],
    [{ kind: "eventCount", target: existing, count: -1 }], [{ kind: "targetChange", target: existing, fingerprint: "forged" }],
    [{ kind: "preserve", target: { ...existing, newMapName: "ambiguous" } }]])("fails the entire malformed criteria array closed (%j)", criteria => {
    // Given malformed boundary data; when parsed; then no valid prefix is retained.
    expect(parseAcceptanceCriteria(criteria)).toBeNull();
  });

  it("keeps a malformed item visible and permits repair only before criteria become valid", () => {
    // Given an item with no usable criteria.
    const { ledger, project } = setup([]);
    ledger.adopt(parseAcceptance([{ id: "repair", title: "Keep this title", criteria: [{ kind: "bad" }] }]) ?? []);
    // When repairing the missing criterion; then a later weakening is refused.
    expect(ledger.repair("repair", [{ kind: "eventCount", target: existing, count: 7 }]).ok).toBe(true);
    expect(ledger.repair("repair", [{ kind: "eventCount", target: existing, count: 0 }]).ok).toBe(false);
    expect(ledger.evaluate(project).items[1]).toMatchObject({ title: "Keep this title", evidence: [{ passed: false }] });
  });

  it("measures exact scoped dimensions/counts, not unrelated maps or events", () => {
    // Given an empty scoped region and a different map with events.
    const { ledger, project, map } = setup([
      { kind: "mapDimensions", target: existing, width: 20, height: 15 },
      { kind: "eventCount", target: existing, region: { x: 0, y: 0, w: 2, h: 2 }, count: 1 },
      { kind: "mapCount", targets: [existing, { mapId: "missing" }], count: 2 },
    ]);
    const event = { id: "outside", x: 10, y: 10, trigger: { kind: "action" } as const, commands: [] };
    map.events.push(event);
    project.maps.other = { ...structuredClone(map), id: "other", events: [event] };
    // When evaluating; then only the dimension criterion passes.
    expect(ledger.evaluate(project).items[0]?.evidence.map(e => e.passed)).toEqual([true, false, false]);
  });

  it("preserves original target baselines through replacement promises and rebasing", () => {
    // Given original target and region preservation contracts.
    const { ledger, project, map } = setup([{ kind: "targetChange", target: existing }, { kind: "preserve", target: existing, region: full }]);
    ledger.adopt([{ id: "promise", title: "Weakened", criteria: [{ kind: "eventCount", target: existing, count: 0 }] }]);
    map.name = "Renamed";
    // When evaluating the changed applied map twice; then the original baseline still proves a change.
    expect(ledger.evaluate(project).status).toBe("verified");
    expect(ledger.evaluate(structuredClone(project))).toMatchObject({ goal: "Original goal", items: [{ title: "Original promise", evidence: [{ passed: true }, { passed: true }] }] });
  });

  it("detects scoped tile-stack changes and does not claim drafts are applied", () => {
    // Given a preserved region and a draft-only stacked tile write.
    const { ledger, project } = setup([{ kind: "preserve", target: existing, region: full }]);
    const draft = structuredClone(project);
    draft.maps[draft.startMapId].upperTileStacks = { 1: [42] };
    // When inspecting draft then applied state; then neither is verified.
    expect(ledger.evaluate(project, draft).items[0]?.status).toBe("verifying");
    expect(ledger.evaluate(draft).items[0]?.evidence[0]?.passed).toBe(false);
  });

  it("binds new-map names only to unique newly authored IDs and never guesses/rebinds", () => {
    // Given a pre-existing map with the requested new name.
    const project = createBlankProject(), original = project.maps[project.startMapId];
    original.name = "New room";
    const ledger = new AssistantAcceptanceLedger("new", "New room", project);
    ledger.adopt([{ id: "room", title: "New map", criteria: [{ kind: "mapDimensions", target: { newMapName: "New room" }, width: 20, height: 15 }] }]);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    const room: GameMap = { ...structuredClone(original), id: "authored" };
    project.maps.authored = room;
    project.maps.duplicate = { ...structuredClone(room), id: "duplicate" };
    expect(ledger.evaluate(project).status).not.toBe("verified");
    delete project.maps.duplicate;
    expect(ledger.evaluate(project).status).toBe("verified");
    delete project.maps.authored;
    project.maps.replacement = { ...room, id: "replacement" };
    // When the bound authored ID disappears; then a name match cannot replace it.
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it("uses conservative exact-cell reachability rather than adjacency-only lint success", () => {
    // Given a target event blocking the destination cell.
    const { ledger, project, map } = setup([{ kind: "reachability", target: existing, from: { x: 0, y: 0 }, to: [{ x: 1, y: 0 }] }]);
    expect(ledger.evaluate(project).status).toBe("verified");
    map.events.push({ id: "solid", x: 1, y: 0, trigger: { kind: "action" }, commands: [] });
    // When evaluating; then reaching only its neighbor is not success.
    expect(ledger.evaluate(project).items[0]?.evidence[0]?.passed).toBe(false);
  });

  it("freezes every published snapshot layer", () => {
    // Given a verified immutable promise; when published; then UI mutation cannot change it.
    const { ledger, project } = setup([{ kind: "preserve", target: existing, region: full }]);
    const value = ledger.evaluate(project);
    expect([value, value.items, value.items[0], value.items[0]?.evidence, value.items[0]?.evidence[0], value.items[0]?.region].every(Object.isFrozen)).toBe(true);
  });
});

describe("image-reviewed evidence", () => {
  it("requires delivered coverage followed by attributed review and invalidates after undo", () => {
    // Given an image promise without render/delivery.
    const { ledger, project, map } = setup([{ kind: "imageReviewed", target: existing }]);
    expect(ledger.review("promise", "I inspected it", project, "pass")).toBe(false);
    deliver(ledger, project);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    expect(ledger.review("promise", "I inspected the delivered map", project, "pass")).toBe(true);
    expect(ledger.evaluate(project).status).toBe("verified");
    const before = structuredClone(project);
    map.name = "Later edit";
    // When an applied change followed by undo occurs; then old receipts cannot revive.
    expect(ledger.evaluate(project).status).not.toBe("verified");
    expect(ledger.evaluate(before).status).not.toBe("verified");
  });

  it("uses actual clipped output and exact union coverage, never requested area or overlap sums", () => {
    // Given a 40x15 map: show_map_region really clips the first request to 24 columns.
    const { ledger, project, map } = setup([{ kind: "imageReviewed", target: existing }]);
    map.width = 40;
    map.lowerTiles = Array(600).fill(0); map.upperTiles = Array(600).fill(-1);
    deliver(ledger, project, { x: 0, y: 0, w: 40, h: 15 });
    deliver(ledger, project, { x: 0, y: 0, w: 24, h: 15 });
    expect(ledger.review("promise", "Partial and overlapping", project, "pass")).toBe(false);
    // When the missing right edge is actually delivered; then full coverage can be reviewed.
    deliver(ledger, project, { x: 24, y: 0, w: 16, h: 15 });
    expect(ledger.review("promise", "Full coverage", project, "pass")).toBe(true);
  });
});


describe("malformed acceptance boundary", () => {
  it.each(["__proto__", "constructor", "toString"])("rejects inherited kind %s without throwing", kind => {
    // Given an adversarial non-own key; when parsed; then the entire array fails closed.
    expect(parseAcceptanceCriteria([{ kind, target: existing }])).toBeNull();
  });

  it("retains valid original promises when a malformed sibling requires repair", () => {
    // Given one valid unmet promise plus a malformed sibling.
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("original", "Keep every promise", project);
    ledger.adopt(parseAcceptance([{ id: "original", title: "Seven events", criteria: [{ kind: "eventCount", target: existing, count: 7 }] }, null]) ?? []);
    // When the malformed sibling is repaired with an easy condition; then it cannot erase the original.
    expect(ledger.repair("acceptance-contract", [{ kind: "eventCount", target: existing, count: 0 }]).ok).toBe(true);
    expect(ledger.evaluate(project)).toMatchObject({ items: [{ id: "original", evidence: [{ passed: false }] }, { id: "acceptance-contract", status: "verified" }] });
  });
});


it("does not count inherited map properties as authored maps", () => {
  // Given an untrusted target ID matching Object.prototype; when evaluated; then no map exists.
  const { ledger, project } = setup([{ kind: "mapCount", targets: [{ mapId: "__proto__" }], count: 1 }]);
  expect(ledger.evaluate(project).items[0]?.evidence[0]?.passed).toBe(false);
});

it("never repairs truncated criterion arrays into a weaker successful prefix", () => {
  // Given a complete first criterion and a truncated second criterion.
  const raw = JSON.stringify({ action: "new_plan", goal: "Two promises", layers: plan.layers }).slice(0, -1)
    + ',"acceptance":[{"id":"both","title":"Both conditions","criteria":[{"kind":"eventCount","target":{"mapId":"map_blank_start"},"count":0},{"kind":"mapDimensions"';
  // When the existing planner truncation recovery runs; then the whole array needs repair.
  const parsed = parseOrchestratorDecision(raw);
  expect(parsed.decision).toMatchObject({ acceptance: [{ id: "both", criteria: null }] });
});
