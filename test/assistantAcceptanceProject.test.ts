import { describe, expect, it } from "vitest";
import { parseAcceptanceCriteria, type AcceptanceCriterion } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { parseRequestCoverage } from "@/ai/requestCoverage";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import type { Project } from "@/project/types";
import type { WikiSource, WorldWikiMetadata } from "@/project/world/types";
import { parseProjectWikiPatch, applyProjectWikiPatch } from "@/project/world/wiki";
import { evaluateAcceptanceCriterion } from "@/ai/assistantAcceptanceEvaluation";

function ledgerFor(project: Project, input: unknown) {
  const criteria = parseAcceptanceCriteria(input);
  expect(criteria).not.toBeNull();
  if (!criteria) throw new Error("Criterion parsing failed");
  const ledger = new AssistantAcceptanceLedger("original", "Original request", project);
  ledger.adopt([{ id: "original", title: "Original request", criteria }]);
  return ledger;
}
const title = { kind: "projectTitle", title: "Exact title" };

const policyQuote = "Use contact battles with visible monsters.";
const policyRequest = `${policyQuote} Change only the title.`;
const policyCriterion = { kind: "wikiDeclaration", documentId: "w_combat_preference", combatMode: "contact", sourceQuote: policyQuote };

function wikiFixture() {
  const project = createBlankProject();
  const sources: readonly WikiSource[] = [{ id: "host_source", kind: "user", text: policyRequest, at: 1 }];
  const patch = parseProjectWikiPatch({ upserts: [{
    id: policyCriterion.documentId, type: "guideline", name: "Combat preference", summary: "Stored user preference",
    wiki: { kind: "declaration", basis: "explicit", combatMode: "contact", sourceIds: [sources[0].id] },
  }] }, project, sources);
  const world = project.world ?? { entities: [], relations: [] };
  const applied = applyProjectWikiPatch(world, world, patch, sources);
  expect(applied.conflicts).toEqual([]);
  expect(applied.world.entities).toHaveLength(1);
  expect(applied.world.entities[0]).toMatchObject({
    id: policyCriterion.documentId,
    wiki: { kind: "declaration", basis: "explicit", combatMode: "contact", sources },
  });
  project.world = applied.world;
  return project;
}
function wikiLedger(project: Project, criterion: unknown = policyCriterion, text = policyRequest) {
  const criteria = parseAcceptanceCriteria([criterion]);
  expect(criteria).not.toBeNull();
  if (!criteria) throw new Error("Wiki criterion parsing failed");
  const ledger = new AssistantAcceptanceLedger("wiki-request", text, project);
  ledger.adopt([{ id: "policy", title: "Stored preference", criteria }], project,
    { requestId: "wiki-request", text, scope: null });
  return ledger;
}

describe("sourced wiki declaration acceptance", () => {
  it("checks host-stamped explicit preference without claiming a runtime behavior", () => {
    const project = wikiFixture();
    const ledger = wikiLedger(project);
    expect(ledger.evaluate(project).status).toBe("verified");
    const document = project.world?.entities[0];
    if (!document) throw new Error("Wiki checkpoint did not create the declaration");
    project.world = { entities: [{ ...document, name: "Renamed", summary: "Different display copy", body: "Unrelated prose" }], relations: [] };
    expect(ledger.evaluate(project).status).toBe("verified");
    const draft = structuredClone(project);
    draft.world = { entities: [], relations: [] };
    expect(ledger.evaluate(project, draft).status).toBe("verifying");
    expect(ledger.evaluate(draft).status).not.toBe("verified");
  });

  it.each([
    { documentId: "foreign_document" }, { combatMode: "action" }, { sourceQuote: "Different preference" },
  ])("rejects mismatched declaration targets and values (%j)", mismatch => {
    const project = wikiFixture();
    expect(wikiLedger(project, { ...policyCriterion, ...mismatch }).evaluate(project).status).not.toBe("verified");
  });

  it("requires the original host request, not a source quote found in unrelated text", () => {
    const project = wikiFixture();
    expect(wikiLedger(project, policyCriterion, `Different request. ${policyRequest}`).evaluate(project).status).not.toBe("verified");
    expect(wikiLedger(project, policyCriterion, `${policyRequest} ${policyQuote}`).evaluate(project).status).not.toBe("verified");
    const criteria = parseAcceptanceCriteria([policyCriterion]);
    if (!criteria?.[0]) throw new Error("Wiki criterion parsing failed");
    expect(evaluateAcceptanceCriterion(criteria[0], { project, baseline: project, bindings: new Map(), reviewed: () => false }).passed).toBe(false);
  });

  it.each<Partial<WorldWikiMetadata>>([
    { basis: "inferred" },
    { sources: [{ id: "manual_source", kind: "manual", text: policyRequest, at: 1 }] },
    { sources: [{ id: "other_user", kind: "user", text: `Unrelated prefix. ${policyRequest}`, at: 1 }] },
    { kind: "knowledge", combatMode: undefined },
    { kind: "progress", basis: "observed", combatMode: undefined, sources: [{ id: "application", kind: "application", text: policyRequest, at: 1 }] },
  ])("rejects inferred/manual/foreign/knowledge/progress metadata (%j)", change => {
    const project = wikiFixture();
    const ledger = wikiLedger(project);
    const document = project.world?.entities[0];
    if (!document?.wiki) throw new Error("Wiki checkpoint did not stamp metadata");
    project.world = { entities: [{ ...document, wiki: { ...document.wiki, ...change } }], relations: [] };
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it("rejects duplicate and superseded declaration identities", () => {
    const project = wikiFixture();
    const ledger = wikiLedger(project);
    const document = project.world?.entities[0];
    if (!document?.wiki) throw new Error("Wiki checkpoint did not stamp metadata");
    project.world = { entities: [document, structuredClone(document)], relations: [] };
    expect(ledger.evaluate(project).status).not.toBe("verified");
    project.world = { entities: [document, { ...document, id: "new_preference", wiki: {
      ...document.wiki, combatMode: "action", supersedes: [document.id],
      sources: [{ id: "new_user_source", kind: "user", text: "Use action combat instead.", at: 2 }],
    } }], relations: [] };
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it.each([
    { ...policyCriterion, sourceQuote: "" }, { ...policyCriterion, documentId: "" },
    { ...policyCriterion, combatMode: "invented" }, { ...policyCriterion, passed: true },
    { ...policyCriterion, source: { kind: "user", text: policyRequest } },
  ])("rejects malformed criteria and model-supplied provenance (%j)", criterion => {
    expect(parseAcceptanceCriteria([criterion])).toBeNull();
  });
});

const titleOnly = { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "projectTitle" }] };
function writeTitle(project: Project): Project {
  const context = { project };
  expect(runTool(context, "set_title_screen", { title: title.title }).ok).toBe(true);
  expect(context.project).not.toBe(project);
  expect(context.project.meta.title).toBe(title.title);
  expect(context.project.system.titleScreen?.title).toBe(title.title);
  return context.project;
}

describe("project acceptance parser/evaluator seam", () => {
  it("checks both actual title fields and preservation after the real title tool", () => {
    let project = createBlankProject();
    const ledger = ledgerFor(project, [title, titleOnly]);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    project = writeTitle(project);
    expect(ledger.evaluate(project).status).toBe("verified");
    project.meta.title = "Wrong metadata title";
    expect(ledger.evaluate(project).items[0].evidence.map(e => e.passed)).toEqual([false, true]);
    project = writeTitle(project);
    const titleScreen = project.system.titleScreen;
    if (!titleScreen) throw new Error("Title tool did not create title-screen settings");
    titleScreen.title = "Wrong screen title";
    expect(ledger.evaluate(project).items[0].evidence[0].passed).toBe(false);
    project = writeTitle(project);
    project.meta.author = "Unallowed author";
    ledger.adopt([{ id: "original", title: "Weakened", criteria: parseAcceptanceCriteria([title]) }], project);
    expect(ledger.evaluate(project).items[0].evidence.map(e => e.passed)).toEqual([true, false]);
  });

  it("checks a uniquely targeted added item's exact name/price and preserves the prior title", () => {
    let project = writeTitle(createBlankProject());
    const item = { id: "item_added", name: "Added item", price: 37 };
    const ledger = ledgerFor(project, [
      { kind: "itemValues", itemId: item.id, name: item.name, price: item.price },
      { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "itemAddition", itemId: item.id }] },
    ]);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    const context = { project };
    expect(runTool(context, "upsert_item", { item }).ok).toBe(true);
    expect(context.project).not.toBe(project);
    project = context.project;
    expect(ledger.evaluate(project).status).toBe("verified");
    const good = structuredClone(project);
    const record = project.database.items.find(entry => entry.id === item.id);
    if (!record) throw new Error("Item tool did not add the requested record");
    record.price = 38;
    expect(ledger.evaluate(project).items[0].evidence[0].passed).toBe(false);
    record.price = 37; record.name = "Wrong name";
    expect(ledger.evaluate(project).items[0].evidence[0].passed).toBe(false);
    record.name = item.name; record.id = "foreign_target";
    expect(ledger.evaluate(project).items[0].evidence.map(e => e.passed)).toEqual([false, false]);
    const duplicate = structuredClone(good);
    const duplicateRecord = duplicate.database.items.find(entry => entry.id === item.id);
    if (!duplicateRecord) throw new Error("Accepted snapshot lost the requested item");
    duplicate.database.items.push(structuredClone(duplicateRecord));
    expect(ledger.evaluate(duplicate).items[0].evidence.map(e => e.passed)).toEqual([false, false]);
    const extra = structuredClone(good);
    extra.meta.title = "Unallowed title";
    expect(ledger.evaluate(extra).items[0].evidence[1].passed).toBe(false);
    const changedMap = structuredClone(good);
    changedMap.maps[changedMap.startMapId].name = "Unallowed map";
    expect(ledger.evaluate(changedMap).items[0].evidence[1].passed).toBe(false);
  });

  it("allows only named existing item fields, never a replacement or other record changes", () => {
    const project = createBlankProject();
    const item = project.database.items[0];
    const ledger = ledgerFor(project, [
      { kind: "itemValues", itemId: item.id, price: 37 },
      { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "itemPrice", itemId: item.id }] },
    ]);
    item.price = 37;
    expect(ledger.evaluate(project).status).toBe("verified");
    item.name += " changed";
    expect(ledger.evaluate(project).items[0].evidence[1].passed).toBe(false);
    const invalidAddition = ledgerFor(project, [{ kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "itemAddition", itemId: item.id }] }]);
    expect(invalidAddition.evaluate(project).items[0].evidence[0].passed).toBe(false);
  });

  it("does not certify a draft or reuse a passing value after a later edit", () => {
    const project = writeTitle(createBlankProject());
    const ledger = ledgerFor(project, [title]);
    const draft = structuredClone(project);
    draft.meta.title = "Wrong draft";
    expect(ledger.evaluate(project, draft).status).toBe("verifying");
    expect(ledger.evaluateForReview(draft).status).not.toBe("verified");
    expect(ledger.evaluate(project).status).toBe("verified");
    project.meta.title = "Later edit";
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it("makes wiki exclusion explicit without hiding authored instruction edits", () => {
    const project = createBlankProject();
    const all = ledgerFor(project, [{ kind: "projectPreserve", scope: "project", allowedChanges: [] }]);
    const authored = ledgerFor(project, [{ kind: "projectPreserve", scope: "authored", allowedChanges: [] }]);
    project.world = { entities: [{ id: "policy", type: "guideline", origin: "user", name: "Policy", summary: "Original policy" }], relations: [] };
    expect(all.evaluate(project).status).not.toBe("verified");
    expect(authored.evaluate(project).status).toBe("verified");
    project.aiInstructions = "Unallowed instruction";
    expect(authored.evaluate(project).status).not.toBe("verified");
  });

  it("retains a source-bound unsupported clause beside the supported title check", () => {
    let project = createBlankProject();
    const userText = "Set the title. Use contact battles with visible monsters.";
    const facts = { userText, currentMap: null, selection: null, maps: [], facilityLabels: [], toolNames: [], hasActivePlan: false };
    const requirements = parseRequestCoverage(JSON.stringify({ requirements: [
      { text: "Set the title.", criteria: [title] },
      { text: "Use contact battles with visible monsters.", criteria: [{ kind: "functionalUnresolved", reason: "Contact authoring policy has no semantic evaluator" }] },
    ] }), facts, []);
    expect(requirements.map(entry => entry.text)).toEqual(["Set the title.", "Use contact battles with visible monsters."]);
    project = writeTitle(project);
    const criteria: readonly AcceptanceCriterion[] = requirements.flatMap(entry => entry.criteria);
    const ledger = ledgerFor(project, criteria);
    expect(ledger.evaluate(project).items[0].evidence.map(e => e.passed)).toEqual([true, false]);
    expect(ledger.repair("original", [title])).toBe(false);
  });

  it.each([
    { kind: "projectTitle", title: 3 }, { ...title, passed: true },
    { kind: "itemValues", itemId: "item" }, { kind: "itemValues", itemId: "item", price: -1 },
    { kind: "itemValues", itemId: "item", price: Infinity }, { kind: "itemValues", itemId: "item", price: "37" },
    { kind: "projectPreserve", scope: "project" },
    { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "path", path: "maps" }] },
    { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "itemPrice" }] },
    { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "projectTitle", itemId: "mixed" }] },
  ])("rejects malformed or model-authored evidence fields (%j)", invalid => {
    expect(parseAcceptanceCriteria([title, invalid])).toBeNull();
  });
});
