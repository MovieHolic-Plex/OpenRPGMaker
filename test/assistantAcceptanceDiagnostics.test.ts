import { describe, expect, it } from "vitest";
import { ACCEPTANCE_EXAMPLES, missingAcceptance, parseAcceptance, parseAcceptanceCriteriaResult } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import recordedRepairs from "./fixtures/acceptance-round2-repairs.json";

const target = { mapId: createBlankProject().startMapId };

describe("actionable atomic acceptance diagnostics", () => {
  it.each(recordedRepairs)("rejects recorded repair %# without adopting a valid prefix or moving baselines", args => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Recorded repair", project);
    ledger.adopt(missingAcceptance("Original title"));
    ledger.adopt([{ id: "original", title: "Original preservation", criteria: [{ kind: "preserve", target }] }]);
    const before = ledger.evaluate(project);
    const rejected = ledger.repair(args.itemId, args.criteria);
    expect(rejected).toMatchObject({ ok: false, code: "malformed-criteria", issues: [{ criterionIndex: 0, field: "criteria[0].targets", code: "missing-field" }] });
    expect(rejected.issues[0]?.expected.length).toBeGreaterThan(0);
    expect(rejected.issues[0]?.example).toEqual(ACCEPTANCE_EXAMPLES.mapCount);
    expect(ledger.evaluate(project)).toEqual(before);
    const repaired = args.criteria.map(criterion => criterion.kind === "mapCount"
      ? { ...criterion, targets: [target, { mapId: "map_basement" }] } : criterion);
    expect(ledger.repair(args.itemId, repaired)).toMatchObject({ ok: true, code: "repaired" });
    project.maps[target.mapId].name = "Later write";
    expect(ledger.repair("original", [{ kind: "eventCount", target, count: 0 }])).toMatchObject({ ok: false, code: "immutable-valid" });
    expect(ledger.evaluate(project).items[1]).toMatchObject({ title: "Original preservation", evidence: [{ passed: false }] });
    expect(ledger.repair(args.itemId, [])).toMatchObject({ ok: false, code: "immutable-valid" });
  });

  it.each([
    { criterion: { kind: "mapCount", count: 1, targets: [{ ...target, newMapName: "Both" }] }, field: "targets[0]", code: "invalid-selector" },
    { criterion: { kind: "mapDimensions", target, width: 0, height: 15 }, field: "width", code: "invalid-field" },
    { criterion: { kind: "eventCount", target, count: -1 }, field: "count", code: "invalid-field" },
    { criterion: { kind: "preserve", target, evidence: "forged" }, field: "evidence", code: "unknown-field" },
    { criterion: { kind: "imageReviewed", target, region: { x: 0, y: 0, w: 0, h: 1 } }, field: "region", code: "invalid-field" },
    { criterion: { kind: "reachability", target, from: { x: 0, y: 0 }, to: [{ x: -1, y: 0 }] }, field: "to[0]", code: "invalid-field" },
  ])("identifies malformed sibling $field without retaining its valid prefix", ({ criterion, field, code }) => {
    expect(parseAcceptanceCriteriaResult([ACCEPTANCE_EXAMPLES.preserve, criterion])).toMatchObject({ criteria: null,
      issues: [{ criterionIndex: 1, field: `criteria[1].${field}`, code }] });
  });

  it("distinguishes unknown items, malformed criteria, immutable promises and unavailable reviews", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Contract", project);
    ledger.adopt(parseAcceptance([{ id: "bad", title: "Repair", criteria: [{ kind: "bad" }] },
      { id: "image", title: "Review", criteria: [{ kind: "imageReviewed", target }] }]) ?? []);
    expect(ledger.repair("unknown", [])).toMatchObject({ code: "unknown-item", issues: [{ field: "itemId" }] });
    expect(ledger.reviewResult("unknown", "note", project, "pass").code).toBe("unknown-item");
    expect(ledger.reviewResult("bad", "note", project, "pass").code).toBe("malformed-criteria");
    expect(ledger.reviewResult("image", "note", project, "pass")).toMatchObject({ code: "image-review-unavailable",
      issues: [{ criterionIndex: 0, field: "criteria[0]", mapId: target.mapId }] });
    expect(ledger.reviewResult("image", "note", project, undefined)).toMatchObject({ code: "invalid-review", issues: [{ field: "verdict" }] });
    const snapshot = ledger.evaluate(project);
    const issue = snapshot.items[0]?.issues?.[0];
    expect([snapshot.items[0]?.issues, issue, issue?.example].every(Object.isFrozen)).toBe(true);
  });

  it("reports the exact solid target while interaction reachability and an authored approach cell pass", () => {
    const project = createBlankProject(), map = project.maps[target.mapId];
    map.events.push({ id: "sign", x: 1, y: 0, trigger: { kind: "action" }, commands: [] });
    const ledger = new AssistantAcceptanceLedger("goal", "Routes", project);
    ledger.adopt([{ id: "routes", title: "Routes", criteria: [
      { kind: "reachability", target, from: { x: 0, y: 0 }, to: [{ x: 1, y: 0 }] },
      { kind: "reachability", target, from: { x: 0, y: 1 }, to: [{ x: 0, y: 0 }] },
    ] }]);
    expect(runTool({ project }, "check_reachability", { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] })).toMatchObject({ ok: true, data: { reachable: true } });
    expect(ledger.evaluate(project).items[0]?.evidence).toMatchObject([
      { passed: false, issues: [{ criterionIndex: 0, field: "criteria[0].to[0]", code: "cell-event-blocked",
        mapId: target.mapId, cell: { x: 1, y: 0 }, blocker: { kind: "event", eventId: "sign" } }] },
      { passed: true },
    ]);
    expect(map.events[0]?.x).toBe(1);
  });
});
