import { describe, expect, it } from "vitest";
import { createRequestSource, extractRequestCoverage, hasUnresolvedWriteConstraint } from "@/ai/assistantRequestContract";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const anchor = (raw: string, quote = raw) => ({ start: raw.indexOf(quote), end: raw.indexOf(quote) + quote.length, quote });
const title = (value: string) => ({ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value });
const entry = (raw: string, quote = raw) => ({ source: [anchor(raw, quote)], criteria: [title("Kept")], bindings: quote.includes('"Kept"') ? [{ source: anchor(raw, '"Kept"'), role: "value", criterionIndex: 0, fieldPath: ["value"] }] : [] });

describe("request source boundary", () => {
  it("B1-quoted-new-map-target-binds-with-exact-dimensions-and-applied-proof", () => {
    const project = createBlankProject();
    const raw = 'Create map "New Hall" at 20x15';
    const ledger = new AssistantAcceptanceLedger("goal", raw, project);
    ledger.startRequest("r", raw, project);
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: [
      { kind: "mapDimensions", target: { newMapName: "New Hall" }, width: 20, height: 15 },
    ], bindings: [
      { source: anchor(raw, '"New Hall"'), role: "value", criterionIndex: 0, fieldPath: ["target", "newMapName"] },
      { source: anchor(raw, "20"), role: "width", criterionIndex: 0, fieldPath: ["width"] },
      { source: anchor(raw, "15"), role: "height", criterionIndex: 0, fieldPath: ["height"] },
    ] }] });
    expect(ledger.getRequests()[0]?.units[0]?.coverage).toBe("declared");
    expect(ledger.evaluate(project).status).not.toBe("verified");
    const draft = structuredClone(project);
    draft.maps.hall = { ...structuredClone(project.maps[project.startMapId]!), id: "hall", name: "New Hall" };
    expect(ledger.evaluate(project, draft).status).toBe("verifying");
    expect(ledger.evaluate(draft).status).toBe("verified");
  });
  it("B2-quoted-and-numeric-verifier-args-bind-with-real-exact-evidence-and-draft-veto", () => {
    const project = createBlankProject();
    const raw = `Check route on "${project.startMapId}" from 0,1 to 2,3`;
    const args = { mapId: project.startMapId, from: { x: 0, y: 1 }, targets: [{ x: 2, y: 3 }] };
    const ledger = new AssistantAcceptanceLedger("goal", raw, project);
    ledger.startRequest("r", raw, project);
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: [
      { kind: "toolVerdict", tool: "check_reachability", args },
    ], bindings: [
      { source: anchor(raw, JSON.stringify(args.mapId)), role: "value", criterionIndex: 0, fieldPath: ["args", "mapId"] },
      ...["0", "1", "2", "3"].map((quote, index) => ({ source: anchor(raw, quote), role: "value", criterionIndex: 0,
        fieldPath: index < 2 ? ["args", "from", index === 0 ? "x" : "y"] : ["args", "targets", "0", index === 2 ? "x" : "y"],
      })),
    ] }] });
    expect(ledger.getRequests()[0]?.units[0]?.coverage).toBe("declared");
    const result = runTool({ project }, "check_reachability", args);
    expect(result).toMatchObject({ ok: true, data: { reachable: true } });
    const evidence = new ToolVerificationEvidence();
    expect(ledger.evaluate(project, project, evidence).status).not.toBe("verified");
    const otherArgs = { ...args, targets: [{ x: 3, y: 3 }] };
    evidence.observe("check_reachability", otherArgs, runTool({ project }, "check_reachability", otherArgs));
    expect(ledger.evaluate(project, project, evidence).status).not.toBe("verified");
    evidence.observe("check_reachability", args, result);
    expect(ledger.evaluate(project, project, evidence).status).toBe("verified");
    const draft = structuredClone(project); draft.meta.title = "Unapplied";
    expect(ledger.evaluate(project, draft, evidence).status).toBe("verifying");
    evidence.invalidateAfterWrite();
    expect(ledger.evaluate(project, project, evidence).status).not.toBe("verified");
  });
  it.each([
    { criterion: { kind: "mapDimensions", target: { mapId: "map" }, width: 20, height: 15 }, fieldPath: ["target", "mapId"], value: "map" },
    { criterion: { kind: "mapCount", targets: [{ mapId: "map" }], count: 1 }, fieldPath: ["targets", "0", "mapId"], value: "map" },
    { criterion: { kind: "mapCount", targets: [{ newMapName: "Hall" }], count: 1 }, fieldPath: ["targets", "0", "newMapName"], value: "Hall" },
    { criterion: { kind: "entityPreserve", subject: { kind: "database", collection: "items", id: "item" } }, fieldPath: ["subject", "id"], value: "item" },
    { criterion: { kind: "entityPreserve", subject: { kind: "event", mapId: "map", eventId: "npc" } }, fieldPath: ["subject", "mapId"], value: "map" },
    { criterion: { kind: "entityPreserve", subject: { kind: "event", mapId: "map", eventId: "npc" } }, fieldPath: ["subject", "eventId"], value: "npc" },
    { criterion: { kind: "entityPreserve", subject: { kind: "asset", category: "sprites", id: "hero" } }, fieldPath: ["subject", "id"], value: "hero" },
    { criterion: { kind: "membershipPreserve", collection: { kind: "events", mapId: "map" }, selector: { all: true } }, fieldPath: ["collection", "mapId"], value: "map" },
    { criterion: { kind: "membershipPreserve", collection: { kind: "events", mapId: "map" }, selector: { ids: ["npc"] } }, fieldPath: ["selector", "ids", "0"], value: "npc" },
    { criterion: { kind: "membershipPreserve", collection: { kind: "events", mapId: "map" }, selector: { names: ["First", "Guide"] } }, fieldPath: ["selector", "names", "1"], value: "Guide" },
  ])("B3-explicit-identity-field-$fieldPath", ({ criterion, fieldPath, value }) => {
    const raw = `Inspect ${JSON.stringify(value)}`;
    const bindings = [{ source: anchor(raw, JSON.stringify(value)), role: "value", criterionIndex: 0, fieldPath }];
    const units = extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [criterion], bindings }] });
    expect(units[0]).toMatchObject({ coverage: "declared", criteria: [criterion], bindings });
  });
  it.each([
    { criterion: title("Kept"), fieldPath: ["kind"], value: "valueEquals" },
    { criterion: title("Kept"), fieldPath: ["path", "0"], value: "meta" },
    { criterion: title("Kept"), fieldPath: ["subject", "kind"], value: "project" },
    { criterion: { kind: "entityCount", collection: { kind: "database", collection: "items" }, selector: { all: true }, comparison: "eq", count: 0, basis: "current" }, fieldPath: ["comparison"], value: "eq" },
    { criterion: { kind: "entityCount", collection: { kind: "database", collection: "items" }, selector: { all: true }, comparison: "eq", count: 0, basis: "current" }, fieldPath: ["basis"], value: "current" },
    { criterion: { kind: "membershipPreserve", collection: { kind: "database", collection: "items" }, selector: { all: true } }, fieldPath: ["collection", "collection"], value: "items" },
    { criterion: { kind: "membershipPreserve", collection: { kind: "assets", category: "uploaded" }, selector: { all: true } }, fieldPath: ["collection", "category"], value: "uploaded" },
    { criterion: { kind: "membershipPreserve", collection: { kind: "events", mapId: "map" }, selector: { all: true } }, fieldPath: ["selector", "all"], value: true },
    { criterion: { kind: "toolVerdict", tool: "check_reachability", args: { mapId: "map", from: { x: 0, y: 1 }, targets: [{ x: 2, y: 3 }] } }, fieldPath: ["tool"], value: "check_reachability" },
    { criterion: { kind: "toolVerdict", tool: "check_reachability", args: { mapId: "map", from: { x: 0, y: 1 }, targets: [{ x: 2, y: 3 }], invented: "Hall" } }, fieldPath: ["args", "invented"], value: "Hall" },
    { criterion: { kind: "toolVerdict", tool: "check_reachability", args: { mapId: "map", from: { x: 0, y: 1 }, targets: [{ x: 2, y: 3 }], reason: "Hall" } }, fieldPath: ["args", "reason"], value: "Hall" },
    { criterion: { kind: "toolVerdict", tool: "check_reachability", args: { mapId: "map", from: { x: 0, y: 1, ignored: "Hall" }, targets: [{ x: 2, y: 3 }] } }, fieldPath: ["args", "from", "ignored"], value: "Hall" },
  ])("B4-metadata-or-undeclared-field-is-not-source-coverage-$fieldPath", ({ criterion, fieldPath, value }) => {
    const raw = `Inspect ${JSON.stringify(value)}`;
    const units = extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [criterion], bindings: [
      { source: anchor(raw, JSON.stringify(value)), role: "value", criterionIndex: 0, fieldPath },
    ] }] });
    expect(units[0]?.coverage).toBe("unsupported");
  });
  it.each([true, false, null])("B5-scalar-value-exact-match-%j", value => {
    const raw = `Inspect value ${JSON.stringify(value)}`;
    const criterion = { kind: "valueEquals", subject: { kind: "project" }, path: ["system", "monsterCollection"], value };
    const bindings = [{ source: anchor(raw, JSON.stringify(value)), role: "value", criterionIndex: 0, fieldPath: ["value"] }];
    expect(extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [criterion], bindings }] })[0]?.coverage).toBe("declared");
    expect(extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [{ ...criterion, value: value === true ? false : true }], bindings }] })[0]?.coverage).toBe("unsupported");
  });
  it.each([false, true])("B6-independent-quoted-targets-cannot-alias-one-field-duplicate=%s", duplicate => {
    const raw = 'Inspect "Hall", "Hall"';
    const criterion = { kind: "mapDimensions", target: { newMapName: "Hall" }, width: 20, height: 15 };
    const second = raw.lastIndexOf('"Hall"');
    const units = extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: duplicate ? [criterion, structuredClone(criterion)] : [criterion], bindings: [
      { source: anchor(raw, '"Hall"'), role: "value", criterionIndex: 0, fieldPath: ["target", "newMapName"] },
      { source: { start: second, end: second + 6, quote: '"Hall"' }, role: "value", criterionIndex: duplicate ? 1 : 0, fieldPath: ["target", "newMapName"] },
    ] }] });
    expect(units[0]?.coverage).toBe("unsupported");
  });
  it.each([
    { raw: 'Inspect "Other"', fieldPath: ["args", "mapId"] },
    { raw: 'Inspect "2"', fieldPath: ["args", "targets", "0", "x"] },
    { raw: "Inspect 2", fieldPath: ["args", "targets", "00", "x"] },
    { raw: "Inspect 1", fieldPath: ["args", "targets", "length"] },
    { raw: "Inspect 0", fieldPath: ["args", "targets", "0", "constructor"] },
  ])("B7-verifier-scalar-mismatch-or-unsafe-path-$fieldPath", ({ raw, fieldPath }) => {
    const criterion = { kind: "toolVerdict", tool: "check_reachability", args: { mapId: "map", from: { x: 0, y: 1 }, targets: [{ x: 2, y: 3 }] } };
    const units = extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [criterion], bindings: [
      { source: anchor(raw, raw.slice("Inspect ".length)), role: "value", criterionIndex: 0, fieldPath },
    ] }] });
    expect(units[0]?.coverage).toBe("unsupported");
  });
  it.each([
    ['Set volume to 0.5.', ['Set volume to 0.5']],
    ["Don't change the map. Keep the NPC's name.", ["Don't change the map", "Keep the NPC's name"]],
    ['Set title to "He said \\"Hi.\\"".', ['Set title to "He said \\"Hi.\\""']],
  ] as const)("C2-source-lexical-integrity %s", (raw, expected) => {
    const source = createRequestSource("r", raw);
    expect(source.units.map(unit => unit.source.quote)).toEqual(expected);
    expect(source.units.every(unit => raw.slice(unit.source.start, unit.source.end) === unit.source.quote)).toBe(true);
  });
  it("C2-quoted-value-binding-required", () => {
    const raw = 'Set title to "Kept"';
    for (const bindings of [[], [{ source: anchor(raw, '"Kept"'), role: "value", criterionIndex: 0, fieldPath: ["value"] }]]) {
      expect(extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [title("Wrong")], bindings }] })[0]?.coverage).not.toBe("declared");
    }
  });
  it("C2-preservation-cannot-cover-a-quantity", () => {
    const raw = "Create 7 events without changing existing data";
    expect(extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [{ kind: "entityPreserve", subject: { kind: "project" } }], bindings: [{ source: anchor(raw), role: "preserve", criterionIndex: 0, fieldPath: [] }] }] })[0]?.coverage).not.toBe("declared");
  });
  it("C2-numbered-list-markers-are-structural", () => {
    const raw = '1. Set title to "Kept".\n2. Create 7 events.';
    const source = createRequestSource("r", raw);
    expect(source.units.map(unit => unit.source.quote)).toEqual(['Set title to "Kept"', "Create 7 events"]);
    expect(source.units.every(unit => raw.slice(unit.source.start, unit.source.end) === unit.source.quote)).toBe(true);
  });
  it("C2-quantity-cannot-become-a-string-value", () => {
    const raw = "Create 7 events";
    expect(extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [title("7")], bindings: [{ source: anchor(raw, "7"), role: "value", criterionIndex: 0, fieldPath: ["value"] }] }] })[0]?.coverage).not.toBe("declared");
  });
  it("C2-numeric-value-binding", () => {
    const raw = "Set width to 22";
    expect(extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["system", "playResolution", "width"], value: 22 }], bindings: [{ source: anchor(raw, "22"), role: "value", criterionIndex: 0, fieldPath: ["value"] }] }] })[0]?.coverage).toBe("declared");
  });
  it("C2-source-before-direct: retains exact raw source independent of a plan", () => {
    const raw = '  Set title to "Kept".\n';
    const source = createRequestSource("r1", raw);
    expect(source.rawInstruction).toBe(raw);
    expect(source.units.map(unit => raw.slice(unit.source.start, unit.source.end))).toEqual(['Set title to "Kept"']);
    expect(extractRequestCoverage(source, { entries: [entry(raw, 'Set title to "Kept"')] })[0]?.coverage).toBe("declared");
  });
  it("C2-uncovered-tail: one broad quote cannot cover separate clauses", () => {
    const raw = 'Set title to "Kept"; make it beautiful';
    const source = createRequestSource("r1", raw);
    const broad = extractRequestCoverage(source, { entries: [entry(raw)] });
    expect(broad.every(unit => unit.coverage !== "declared")).toBe(true);
    const partial = extractRequestCoverage(source, { entries: [entry(raw, 'Set title to "Kept"')] });
    expect(partial.map(unit => unit.coverage)).toEqual(["declared", "uncovered"]);
    expect(partial[1]?.source.quote).toBe("make it beautiful");
  });
  it("C2-quantity-prohibition: rejects lowered quantities and dropped preservation", () => {
    const raw = 'Create 7 events; preserve the item';
    const source = createRequestSource("r1", raw);
    const criteria = [{ kind: "eventCount", target: { mapId: "map_blank_start" }, count: 1 }];
    const coverage = extractRequestCoverage(source, { entries: [
      { source: [anchor(raw, "Create 7 events")], criteria, bindings: [{ source: anchor(raw, "7"), role: "count", criterionIndex: 0, fieldPath: ["count"] }] },
      entry(raw, "preserve the item"),
    ] });
    expect(coverage.every(unit => unit.coverage !== "declared")).toBe(true);
  });
  it("C2-malformed-extraction: malformed anchors and truncated payload retain all source", () => {
    const raw = 'Set title to "Kept"';
    const source = createRequestSource("r1", raw);
    for (const payload of [undefined, '{"entries":[', { entries: [{ ...entry(raw), source: [{ start: 0, end: raw.length, quote: "forged" }] }] }]) {
      expect(extractRequestCoverage(source, payload)).toMatchObject([{ source: anchor(raw), coverage: "uncovered", criteria: null }]);
    }
  });
  it.each(["missing", "broad", "aliased"] as const)("H1-independent-prohibitions-%s", bindingKind => {
    const raw = "Preserve the title, do not change the database";
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", raw, project);
    ledger.startRequest("r", raw, project);
    const binding = (quote: string) => ({ source: anchor(raw, quote), role: "preserve", criterionIndex: 0, fieldPath: [] });
    const bindings = bindingKind === "broad" ? [binding(raw)] : [binding("Preserve"), ...(bindingKind === "aliased" ? [binding("not")] : [])];
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: [
      { kind: "entityPreserve", subject: { kind: "project" }, path: ["meta", "title"] },
    ], bindings }] });
    const applied = structuredClone(project);
    applied.database.items[0]!.name += " changed";
    expect(applied.meta.title).toBe(project.meta.title);
    expect(applied.database.items[0]!.name).not.toBe(project.database.items[0]!.name);
    expect.soft(ledger.evaluate(applied).status).not.toBe("verified");
    expect.soft(hasUnresolvedWriteConstraint(ledger.getRequests())).toBe(true);
    expect.soft(ledger.getRequests()[0]?.units[0]?.coverage).not.toBe("declared");
    expect(ledger.getRequests()[0]?.rawInstruction).toBe(raw);
  });
  it("H1-independent-preservations-recover-against-original-baseline", () => {
    const raw = "Preserve the title, do not change the item";
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", raw, project);
    ledger.startRequest("r", raw, project);
    const titleCriterion = { kind: "entityPreserve", subject: { kind: "project" }, path: ["meta", "title"] };
    const titleBinding = { source: anchor(raw, "Preserve"), role: "preserve", criterionIndex: 0, fieldPath: [] };
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: [titleCriterion], bindings: [titleBinding] }] });
    const applied = structuredClone(project);
    applied.database.items[0]!.name += " changed before repair";
    ledger.startRequest("r", raw, applied);
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: [titleCriterion,
      { kind: "entityPreserve", subject: { kind: "database", collection: "items", id: project.database.items[0]!.id } },
    ], bindings: [titleBinding, { source: anchor(raw, "not"), role: "prohibit", criterionIndex: 1, fieldPath: [] }] }] });
    expect(ledger.getRequests()[0]?.units[0]?.coverage).toBe("declared");
    expect(hasUnresolvedWriteConstraint(ledger.getRequests())).toBe(false);
    expect(ledger.evaluate(applied).status).not.toBe("verified");
    expect(ledger.evaluate(project).status).toBe("verified");
  });
  it.each([false, true])("H1-distinct-quantities-cannot-alias-one-field-duplicate-criterion=%s", duplicateCriterion => {
    const raw = "Create 7 items, 7 enemies";
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", raw, project);
    ledger.startRequest("r", raw, project);
    const criterion = { kind: "entityCount", collection: { kind: "database", collection: "items" }, selector: { all: true }, comparison: "eq", count: 7, basis: "requestDelta" };
    const second = raw.lastIndexOf("7");
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: duplicateCriterion ? [criterion, structuredClone(criterion)] : [criterion], bindings: [
      { source: anchor(raw, "7"), role: "count", criterionIndex: 0, fieldPath: ["count"] },
      { source: { start: second, end: second + 1, quote: "7" }, role: "count", criterionIndex: duplicateCriterion ? 1 : 0, fieldPath: ["count"] },
    ] }] });
    const applied = structuredClone(project);
    for (let i = 0; i < 7; i++) applied.database.items.push({ ...project.database.items[0]!, id: `h1-item-${i}` });
    expect(applied.database.items.length - project.database.items.length).toBe(7);
    expect(applied.database.enemies).toEqual(project.database.enemies);
    expect.soft(ledger.evaluate(applied).status).not.toBe("verified");
    expect.soft(ledger.getRequests()[0]?.units[0]?.coverage).not.toBe("declared");
  });
  it("H1-repeated-quantities-distinct-collections-verify-independently", () => {
    const raw = "Create 7 items, 7 enemies";
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", raw, project);
    ledger.startRequest("r", raw, project);
    const second = raw.lastIndexOf("7");
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: ["items", "enemies"].map(collection => ({
      kind: "entityCount", collection: { kind: "database", collection }, selector: { all: true }, comparison: "eq", count: 7, basis: "requestDelta",
    })), bindings: [
      { source: anchor(raw, "7"), role: "count", criterionIndex: 0, fieldPath: ["count"] },
      { source: { start: second, end: second + 1, quote: "7" }, role: "count", criterionIndex: 1, fieldPath: ["count"] },
    ] }] });
    expect(ledger.getRequests()[0]?.units[0]?.coverage).toBe("declared");
    const applied = structuredClone(project);
    for (let i = 0; i < 7; i++) applied.database.items.push({ ...project.database.items[0]!, id: `h1-item-${i}` });
    expect(ledger.evaluate(applied).status).not.toBe("verified");
    for (let i = 0; i < 7; i++) applied.database.enemies.push({ ...project.database.enemies[0]!, id: `h1-enemy-${i}` });
    expect(ledger.evaluate(applied).status).toBe("verified");
  });
  it("H1-repeated-quantities-distinct-fields-of-one-criterion", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const raw = `Set map dimensions to ${map.width} by ${map.width}`;
    const second = raw.lastIndexOf(String(map.width));
    const units = extractRequestCoverage(createRequestSource("r", raw), { entries: [{ source: [anchor(raw)], criteria: [
      { kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.width },
    ], bindings: [
      { source: anchor(raw, String(map.width)), role: "width", criterionIndex: 0, fieldPath: ["width"] },
      { source: { start: second, end: second + String(map.width).length, quote: String(map.width) }, role: "height", criterionIndex: 0, fieldPath: ["height"] },
    ] }] });
    expect(units[0]?.coverage).toBe("declared");
  });
  it.each(["No Signal", "Don't stop", 'No 7; keep \\"8\\"', "\u{1f4e1} No Signal"])("H4-quoted-authored-value-is-not-a-write-prohibition-%s", value => {
    const literal = JSON.stringify(value);
    const raw = `Set title to ${literal}`;
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", raw, project);
    ledger.startRequest("r", raw, project);
    expect.soft(hasUnresolvedWriteConstraint(ledger.getRequests())).toBe(false);
    ledger.adoptRequestRequirements("r", { entries: [{ source: [anchor(raw)], criteria: [title(value)], bindings: [
      { source: anchor(raw, literal), role: "value", criterionIndex: 0, fieldPath: ["value"] },
    ] }] });
    const request = ledger.getRequests()[0]!;
    expect.soft(request.units[0]?.coverage).toBe("declared");
    expect.soft(request.units[0]?.criteria).toEqual([title(value)]);
    expect.soft(hasUnresolvedWriteConstraint(ledger.getRequests())).toBe(false);
    expect(request.rawInstruction).toBe(raw);
    expect(request.units.every(unit => raw.slice(unit.source.start, unit.source.end) === unit.source.quote)).toBe(true);
    const draft = structuredClone(project); draft.meta.title = value;
    expect(ledger.evaluate(project, draft).status).not.toBe("verified");
    expect.soft(ledger.evaluate(draft).status).toBe("verified");
  });
  it("H4-real-prohibition-outside-literal-stays-unresolved", () => {
    const raw = 'Set title to "No Signal", do not change the database';
    const source = createRequestSource("r", raw);
    const units = extractRequestCoverage(source, { entries: [{ source: [anchor(raw)], criteria: [title("No Signal")], bindings: [
      { source: anchor(raw, '"No Signal"'), role: "value", criterionIndex: 0, fieldPath: ["value"] },
    ] }] });
    expect(units[0]?.coverage).not.toBe("declared");
    expect(hasUnresolvedWriteConstraint([{ ...source, units }])).toBe(true);
  });
  it("H1-new-request-preservation-keeps-its-own-baseline", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", "request baselines", project);
    const first = 'Set title to "Kept"';
    ledger.startRequest("r1", first, project);
    ledger.adoptRequestRequirements("r1", { entries: [entry(first)] });
    project.meta.title = "Kept";
    const second = "Preserve the title";
    ledger.startRequest("r2", second, project);
    ledger.adoptRequestRequirements("r2", { entries: [{ source: [anchor(second)], criteria: [
      { kind: "entityPreserve", subject: { kind: "project" }, path: ["meta", "title"] },
    ], bindings: [{ source: anchor(second, "Preserve"), role: "preserve", criterionIndex: 0, fieldPath: [] }] }] });
    expect(ledger.evaluate(project).status).toBe("verified");
    project.meta.title = "Changed";
    expect(ledger.evaluate(project).items.every(item => item.evidence.some(proof => !proof.passed))).toBe(true);
  });
  it("H4-literal-correction-requires-explicit-user-amendment", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", "amendments", project);
    const first = 'Set title to "Kept"';
    ledger.startRequest("r1", first, project);
    ledger.adoptRequestRequirements("r1", { entries: [entry(first)] });
    project.meta.title = "Kept";
    expect(ledger.evaluate(project).status).toBe("verified");
    const obligationId = ledger.getRequests()[0]!.units[0]!.id;
    const second = 'Change title to "No Signal" instead';
    const payload = { entries: [{ source: [anchor(second)], criteria: [title("No Signal")], bindings: [
      { source: anchor(second, '"No Signal"'), role: "value", criterionIndex: 0, fieldPath: ["value"] },
    ] }], amendments: [{ obligationId, source: anchor(second) }] };
    ledger.startRequest("r2", second, project);
    ledger.adoptRequestRequirements("r2", payload);
    project.meta.title = "No Signal";
    expect(ledger.evaluate(project).status).not.toBe("verified");
    expect(ledger.getRequests()[0]?.units[0]?.supersededBy).toBeUndefined();
    ledger.adoptUserAmendments("r2", payload);
    expect(ledger.getRequests()[0]?.units[0]).toMatchObject({ supersededBy: "r2", source: anchor(first) });
    expect(ledger.evaluate(project).status).toBe("verified");
  });
  it("C2-monotone-replan: request rows cannot be repaired or overwritten by plan IDs", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", "goal", project);
    const raw = 'Set title to "Kept"';
    ledger.startRequest("r1", raw, project);
    ledger.adoptRequestRequirements("r1", { entries: [entry(raw)] });
    const id = ledger.getRequests()[0]!.units[0]!.id;
    ledger.adopt([{ id, title: "weak", criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: project.meta.title }] }]);
    expect(ledger.repair(id, [title(project.meta.title)])).toBe(false);
    ledger.adoptRequestRequirements("r1", { entries: [{ ...entry(raw), criteria: [title(project.meta.title)] }] });
    expect(ledger.evaluate(project).status).not.toBe("verified");
    project.meta.title = "Kept";
    expect(ledger.evaluate(project).status).toBe("verified");
    expect(ledger.getRequests()[0]?.rawInstruction).toBe(raw);
  });
});
