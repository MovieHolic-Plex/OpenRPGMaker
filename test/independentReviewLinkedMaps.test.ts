import { describe, expect, it } from "vitest";
import { buildIndependentReviewRequest, reviewChanges, reviewMapReferenceRoots, type ReviewInput } from "@/ai/independentReview";
import { extractOriginalContext } from "@/ai/originalContext";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import { independentReviewPayload } from "./independentReviewFixture";

function fixture(size = 4) {
  const project = createBlankProject();
  for (let i = 0; i < 5; i++) project.maps[`map_${i}`] = { ...createBlankMap(`Map ${i}`, size, size), id: `map_${i}` };
  return project;
}
function commands(project: Project, mapId: string, values: Command[]) {
  const map = project.maps[mapId];
  if (!map) throw new Error("Map fixture is incomplete");
  map.events = [{ id: `event_${mapId}`, x: 1, y: 1, trigger: { kind: "action" }, commands: values }];
}
const transfer = (mapId: string, x = 1): Command => ({ kind: "transfer", mapId, x, y: 1 });
function input(before: Project, after: Project): ReviewInput {
  const changes = reviewChanges(before, after);
  const mapReferenceRoots = [before.startMapId, ...reviewMapReferenceRoots(before, after, changes)];
  return { revision: 1, originalRequest: "Edit only the requested authored value", changes,
    before: [extractOriginalContext(before, { snapshotId: "before", currentMapId: before.startMapId, mapReferenceRoots })],
    after: [extractOriginalContext(after, { snapshotId: "after", currentMapId: before.startMapId, mapReferenceRoots })],
    toolResults: [], acceptance: null, requiredProblems: [], images: [] };
}
function expectMaps(review: ReviewInput, mapIds: string[]) {
  for (const side of ["before", "after"] as const) {
    expect.soft(review[side].flatMap(context => context.entries).filter(entry => /^\/maps\/[^/]+$/.test(entry.id))
      .map(entry => entry.id).sort()).toEqual(mapIds.map(id => `/maps/${id}`).sort());
  }
}
function delivered(review: ReviewInput) {
  const payload = independentReviewPayload(buildIndependentReviewRequest(defaultAiConfig(), review));
  if (!payload) throw new Error("Review request was not built");
  expect(payload.changes).toEqual(JSON.parse(JSON.stringify(review.changes)));
  return payload;
}

describe("review of linked maps", () => {
  it.each(["chain", "star"])("renames only the 20x15 target without expanding unchanged %s links to five 256x256 maps", topology => {
    const before = fixture(256);
    expect(before.testPresets ?? []).toEqual([]);
    const ids = [before.startMapId, ...Array.from({ length: 5 }, (_, i) => `map_${i}`)];
    for (const [i, id] of ids.entries()) commands(before, id,
      topology === "star" && i === 0 ? ids.slice(1).map(id => transfer(id)) : [transfer(ids[i + 1] ?? before.startMapId)]);
    const after = structuredClone(before);
    const target = after.maps[before.startMapId];
    if (!target) throw new Error("Target fixture is incomplete");
    expect([target.width, target.height]).toEqual([20, 15]);
    target.name = "Renamed target";
    const review = input(before, after);
    expect(review.changes.map(change => change.path)).toEqual(["/maps/map_blank_start"]);
    expectMaps(review, [before.startMapId]);
    const payload = delivered(review);
    for (const side of ["before", "after"] as const) expect(payload[side][0]?.entries
      .find(entry => entry.id === `/maps/${before.startMapId}/events/event_${before.startMapId}`)?.value)
      .toMatchObject({ event: before.maps[before.startMapId]?.events[0] });
  });

  it.each(["added", "changed"])("scopes an %s world NPC entity independently of unchanged sibling map references", mode => {
    const before = fixture(256);
    before.world = { entities: Array.from({ length: 5 }, (_, i) => ({ id: `npc_${i}`, type: "character", name: `NPC ${i}`,
      summary: "Existing", origin: "user", refs: [{ kind: "map", id: `map_${i}` }] })), relations: [] };
    const after = structuredClone(before);
    after.world = { ...before.world, entities: mode === "added" ? [{ id: "added", type: "character", name: "Added",
      summary: "New", origin: "user", refs: [{ kind: "map", id: before.startMapId }] }, ...before.world.entities]
      : before.world.entities.map(entity => entity.id === "npc_0" ? { ...entity, summary: "Changed" } : entity).reverse() };
    const review = input(before, after);
    expectMaps(review, mode === "added" ? [before.startMapId] : [before.startMapId, "map_0"]);
    expect(delivered(review).changes).toEqual([{ path: "/world", before: before.world, after: after.world }]);
  });

  it.each(["destination", "coordinates", "nested-coordinates", "insert-dialogue", "duplicate-transfer"])("retains just the affected transfer targets for %s edits", mode => {
    const before = fixture();
    const body = [transfer("map_0"), transfer("map_4")];
    commands(before, before.startMapId, mode === "nested-coordinates" ? [{ kind: "loop", body }] : body);
    commands(before, "map_0", [transfer("map_3")]);
    commands(before, "map_1", [transfer("map_2")]);
    const after = structuredClone(before);
    const revised = [transfer(mode === "destination" ? "map_1" : "map_0", 2), transfer("map_4")];
    commands(after, after.startMapId, mode === "nested-coordinates" ? [{ kind: "loop", body: revised }]
      : mode === "insert-dialogue" ? [{ kind: "text", body: "Added dialogue" }, ...body]
      : mode === "duplicate-transfer" ? [...body, transfer("map_0")] : revised);
    const review = input(before, after);
    expectMaps(review, mode === "insert-dialogue" ? [before.startMapId]
      : mode === "destination" ? [before.startMapId, "map_0", "map_1"] : [before.startMapId, "map_0"]);
    delivered(review);
  });

  it("follows changed common-event calls through cycles, but not through unrelated destination map contents", () => {
    const before = fixture();
    before.commonEvents.push({ id: "old_call", name: "Old", trigger: "none", commands: [transfer("map_0")] },
      { id: "new_call", name: "New", trigger: "none", commands: [{ kind: "callCommonEvent", commonEventId: "nested_call" }] },
      { id: "nested_call", name: "Nested", trigger: "none", commands: [transfer("map_1"), { kind: "callCommonEvent", commonEventId: "new_call" }] });
    commands(before, before.startMapId, [{ kind: "callCommonEvent", commonEventId: "old_call" }, transfer("map_4")]);
    commands(before, "map_0", [transfer("map_3")]);
    commands(before, "map_1", [transfer("map_2")]);
    const after = structuredClone(before);
    commands(after, after.startMapId, [{ kind: "callCommonEvent", commonEventId: "new_call" }, transfer("map_4")]);
    const review = input(before, after);
    expectMaps(review, [before.startMapId, "map_0", "map_1"]);
    for (const side of ["before", "after"] as const) {
      const entries = delivered(review)[side].flatMap(context => context.entries);
      for (const id of ["old_call", "new_call", "nested_call"]) expect(entries.filter(entry => entry.id === `/database/commonEvents/${id}`)).toHaveLength(1);
    }
  });

  it("scopes a changed common-event command without following its unchanged sibling commands", () => {
    const before = fixture();
    before.commonEvents.push({ id: "changed_call", name: "Changed", trigger: "none", commands: [transfer("map_0"), transfer("map_4")] });
    commands(before, before.startMapId, [{ kind: "callCommonEvent", commonEventId: "changed_call" }]);
    const after = structuredClone(before);
    const common = after.commonEvents.find(event => event.id === "changed_call");
    if (!common) throw new Error("Common-event fixture is incomplete");
    common.commands = [transfer("map_0", 2), transfer("map_4")];
    const review = input(before, after);
    expectMaps(review, [before.startMapId, "map_0"]);
    delivered(review);
  });
});
