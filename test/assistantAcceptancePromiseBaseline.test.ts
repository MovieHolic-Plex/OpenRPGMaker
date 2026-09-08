import { describe, expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import type { AcceptanceCriterion, AcceptancePromise } from "@/ai/assistantAcceptance";
import { createBlankProject } from "@/project/defaults";
import type { GameMap } from "@/project/types";

const target = { mapId: "created-in-a" };
const region = { x: 0, y: 0, w: 2, h: 2 };
const preserve: AcceptanceCriterion = { kind: "preserve", target, region };
const promise: AcceptancePromise = { id: "keep", title: "Keep original", criteria: [preserve] };

function requestB() {
  const project = createBlankProject();
  const ledger = new AssistantAcceptanceLedger("conversation", "Original goal", project);
  const map: GameMap = { ...structuredClone(project.maps[project.startMapId]), id: target.mapId, name: "Created in A",
    lowerTileStacks: { 0: [2, 3] }, upperTileStacks: { 1: [4, 5] },
    events: [{ id: "protected-event", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "text", body: "Original" }] }],
  };
  project.maps[map.id] = map;
  return { project, map, ledger };
}

const mutations: readonly { readonly label: string; readonly change: (map: GameMap) => void }[] = [
  { label: "lower tile", change: map => { map.lowerTiles[0] = 42; } },
  { label: "upper tile", change: map => { map.upperTiles[1] = 42; } },
  { label: "lower sparse stack", change: map => { map.lowerTileStacks = { 0: [2, 42] }; } },
  { label: "upper sparse stack", change: map => { map.upperTileStacks = { 1: [4, 42] }; } },
  { label: "removed sparse stack", change: map => { delete map.upperTileStacks; } },
  { label: "event commands", change: map => { for (const event of map.events) event.commands = [{ kind: "text", body: "Changed" }]; } },
  { label: "event moved outside region", change: map => { for (const event of map.events) event.x = 3; } },
  { label: "tileset metadata", change: map => { map.tilesetId = "different-tileset"; } },
  { label: "tile size metadata", change: map => { map.tileSize += 1; } },
];

describe("immutable baselines for newly adopted promises", () => {
  it.each(mutations)("detects protected $label changes in B", ({ change }) => {
    // Given a new B promise protecting a map that did not exist at conversation start.
    const { project, map, ledger } = requestB();
    ledger.adopt([promise], project);
    expect(ledger.evaluate(project).status).toBe("verified");
    // When the caller mutates the very project supplied as the baseline.
    change(map);
    // Then the ledger retains the immutable before-content, not the caller's alias.
    expect(ledger.evaluate(project).items[0]?.evidence[0]?.passed).toBe(false);
  });

  it("protects whole-map metadata while region promises permit unrelated changes", () => {
    // Given both whole-map and region preservation promises.
    const { project, map, ledger } = requestB();
    ledger.adopt([promise, { id: "whole", title: "Whole map", criteria: [{ kind: "preserve", target }] }], project);
    expect(ledger.evaluate(project).status).toBe("verified");
    // When metadata and content outside the protected region change.
    map.name = "B rename";
    map.bgm = { mode: "none" };
    map.lowerTiles[map.width * 3 + 3] = 42;
    map.events.push({ id: "outside", x: 3, y: 3, trigger: { kind: "action" }, commands: [] });
    // Then the whole-map promise fails without broadening the region promise.
    expect(ledger.evaluate(project).items.map(item => item.evidence[0]?.passed)).toEqual([true, false]);
  });

  it("keeps first criteria and baselines through duplicate IDs, repair and later adoption", () => {
    // Given a B promise and a malformed sibling whose baseline is already captured.
    const { project, map, ledger } = requestB();
    ledger.adopt([promise, { id: "repair", title: "Repair original", criteria: null }], project);
    map.lowerTiles[0] = 42;
    // When a later plan duplicates IDs, adds a new promise and repairs the missing criteria.
    ledger.adopt([
      { ...promise, title: "Weakened", criteria: [{ kind: "eventCount", target, count: 1 }] },
      { id: "repair", title: "Replaced", criteria: [preserve] },
      { id: "later", title: "Later request", criteria: [preserve] },
      { id: "later", title: "Duplicate within batch", criteria: [{ kind: "eventCount", target, count: 99 }] },
    ], project);
    expect(ledger.repair("repair", [preserve]).ok).toBe(true);
    expect(ledger.repair("keep", [{ kind: "eventCount", target, count: 1 }]).ok).toBe(false);
    ledger.stop(); ledger.resume();
    // Then only the genuinely new promise uses the later snapshot.
    expect(ledger.evaluate(project).items).toMatchObject([
      { id: "keep", title: "Keep original", evidence: [{ passed: false }] },
      { id: "repair", title: "Repair original", evidence: [{ passed: false }] },
      { id: "later", title: "Later request", status: "verified" },
    ]);
  });

  it("cannot resolve an older ambiguous name using a later promise's narrower baseline", () => {
    // Given A promised a new name but two newly created IDs made its binding ambiguous.
    const { project, map, ledger } = requestB();
    const criteria: readonly AcceptanceCriterion[] = [{ kind: "mapDimensions", target: { newMapName: map.name }, width: 20, height: 15 }];
    ledger.adopt([{ id: "a", title: "A", criteria }]);
    project.maps.duplicate = { ...structuredClone(map), id: "duplicate" };
    expect(ledger.evaluate(project).items[0]?.mapId).toBeUndefined();
    // When B adopts the same name and adds a map unique only relative to B's snapshot.
    ledger.adopt([{ id: "b", title: "B", criteria }], project);
    project.maps.third = { ...structuredClone(map), id: "third" };
    // Then B cannot guess a binding that would silently resolve A's ambiguous promise.
    expect(ledger.evaluate(project).items.map(item => item.evidence[0]?.passed)).toEqual([false, false]);
  });

  it("excludes B's existing maps from new-map binding and never rebinds a unique match", () => {
    // Given an A-created map with the name B requests for a genuinely new map.
    const { project, map, ledger } = requestB();
    ledger.adopt([{ id: "new", title: "New map", criteria: [
      { kind: "mapDimensions", target: { newMapName: map.name }, width: 20, height: 15 },
    ] }], project);
    expect(ledger.evaluate(project).items[0]?.mapId).toBeUndefined();
    project.maps.first = { ...structuredClone(map), id: "first" };
    project.maps.second = { ...structuredClone(map), id: "second" };
    expect(ledger.evaluate(project).items[0]?.mapId).toBeUndefined();
    delete project.maps.second;
    expect(ledger.evaluate(project).items[0]).toMatchObject({ status: "verified", mapId: "first" });
    // When a later same-name replacement appears after the bound ID disappears.
    delete project.maps.first;
    project.maps.replacement = { ...structuredClone(map), id: "replacement" };
    // Then the original unique binding cannot be transferred to the replacement.
    expect(ledger.evaluate(project).items[0]).toMatchObject({ evidence: [{ passed: false }] });
  });
});
