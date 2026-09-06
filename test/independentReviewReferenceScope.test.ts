import { describe, expect, it } from "vitest";
import { buildIndependentReviewRequest, reviewChanges, reviewMapReferenceRoots } from "@/ai/independentReview";
import { extractOriginalContext, OriginalContextStore } from "@/ai/originalContext";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { independentReviewPayload } from "./independentReviewFixture";

function fixture() {
  const project = createBlankProject();
  const presets = Array.from({ length: 5 }, (_, i) => ({ id: `preset_${i}`, name: `Preset ${i}`,
    startMapId: `map_${i}`, startPos: { x: 1, y: 2 }, gold: 100 + i }));
  project.testPresets = presets;
  for (const preset of presets) project.maps[preset.startMapId] = {
    ...createBlankMap(preset.startMapId, 4, 4), id: preset.startMapId, lowerTileStacks: { 0: [1, 2] },
  };
  return project;
}

function evidence(before: Project, after: Project, currentMapId = "map_blank_start") {
  const changes = reviewChanges(before, after);
  const mapReferenceRoots = [currentMapId, ...reviewMapReferenceRoots(before, after, changes)];
  const payload = independentReviewPayload(buildIndependentReviewRequest(defaultAiConfig(), {
    revision: 1, originalRequest: "Modify authored data", changes,
    before: [extractOriginalContext(before, { snapshotId: "before", currentMapId, mapReferenceRoots })],
    after: [extractOriginalContext(after, { snapshotId: "after", currentMapId, mapReferenceRoots })],
    toolResults: [], acceptance: null, requiredProblems: [], images: [],
  }));
  if (!payload) throw new Error("Review evidence was not delivered");
  return payload;
}

describe("independent review map reference scope", () => {
  it("keeps unchanged authored starts and presets exact without expanding their maps for an unrelated edit", () => {
    const before = fixture();
    before.startMapId = "map_4";
    before.session.homeDecorationPlacements = Array.from({ length: 5 }, (_, i) => ({
      instanceId: `home_${i}`, typeId: "home_type", mapId: `map_${i}`, x: 1, y: 2, orientation: "down",
    }));
    const after = structuredClone(before);
    after.meta.title = "New project title";
    const delivered = evidence(before, after);
    for (const side of ["before", "after"] as const) {
      const entries = delivered[side].flatMap(context => context.entries);
      expect(entries.filter(entry => /^\/maps\/[^/]+$/.test(entry.id)).map(entry => entry.id))
        .toEqual(["/maps/map_blank_start"]);
      expect(entries).toContainEqual({ id: "/session", value: before.session });
      expect(entries).toContainEqual({ id: "/testPresets", value: before.testPresets });
    }
    const writer = new OriginalContextStore(extractOriginalContext(before, { snapshotId: "writer", currentMapId: "map_blank_start" }));
    expect(writer.context.entries.filter(entry => /^\/maps\/[^/]+$/.test(entry.id))).toHaveLength(6);
    expect(writer.read({ snapshotId: "writer", action: "read", entryId: "/maps/map_4/tiles", limit: 24000 }).data)
      .toMatchObject({ text: JSON.stringify(writer.context.entries.find(entry => entry.id === "/maps/map_4/tiles")?.value), nextOffset: null });
  });

  it.each(["retarget", "values", "add", "remove"])("includes complete relevant preset map evidence for %s, not unchanged siblings", mode => {
    const before = fixture();
    const after = structuredClone(before);
    const preset = after.testPresets?.[0];
    if (!preset || !after.testPresets) throw new Error("Preset fixture is incomplete");
    if (mode === "retarget") preset.startMapId = "map_1";
    if (mode === "values") preset.gold = 999;
    if (mode === "add") after.testPresets.push({ id: "added", name: "Added", startMapId: "map_0" });
    if (mode === "remove") after.testPresets.splice(0, 1);
    const delivered = evidence(before, after);
    expect(delivered.changes).toEqual([{ path: "/testPresets", before: before.testPresets, after: after.testPresets }]);
    const mapIds = mode === "retarget" ? ["map_blank_start", "map_0", "map_1"] : ["map_blank_start", "map_0"];
    for (const side of ["before", "after"] as const) {
      const project = side === "before" ? before : after;
      const entries = delivered[side].flatMap(context => context.entries);
      expect(entries.filter(entry => /^\/maps\/[^/]+$/.test(entry.id)).map(entry => entry.id).sort())
        .toEqual(mapIds.map(id => `/maps/${id}`).sort());
      expect(entries).toContainEqual({ id: "/testPresets", value: project.testPresets });
      for (const id of mapIds) {
        const map = project.maps[id];
        if (!map) throw new Error("Expected map is absent");
        expect(entries.find(entry => entry.id === `/maps/${id}/tiles`)?.value)
          .toEqual({ width: map.width, height: map.height, lowerTiles: map.lowerTiles, upperTiles: map.upperTiles,
            lowerTileStacks: map.lowerTileStacks });
      }
    }
  });

  it.each(["startMapId", "startPos", "session", "inherited-preset"])("includes the effective start map for changed %s", mode => {
    const before = fixture();
    before.startMapId = "map_0";
    const after = structuredClone(before);
    if (mode === "startMapId") after.startMapId = "map_1";
    if (mode === "startPos") after.startPos = { x: 2, y: 3 };
    if (mode === "session") after.session.gold = 4321;
    if (mode === "inherited-preset") after.testPresets = [...(after.testPresets ?? []), { id: "inherited", name: "Inherited", gold: 123 }];
    const delivered = evidence(before, after);
    for (const side of ["before", "after"] as const) {
      const entries = delivered[side].flatMap(context => context.entries);
      expect(entries.some(entry => entry.id === "/maps/map_0/tiles")).toBe(true);
      expect(entries.some(entry => entry.id === "/maps/map_1/tiles")).toBe(mode === "startMapId");
      expect(entries.some(entry => entry.id === "/maps/map_4/tiles")).toBe(false);
      expect(entries).toContainEqual({ id: "/session", value: side === "before" ? before.session : after.session });
    }
  });

  it("includes both map targets of changed authored start placements", () => {
    const before = fixture();
    before.session.homeDecorationPlacements = [{ instanceId: "home", typeId: "home_type",
      mapId: "map_0", x: 1, y: 2, orientation: "down" }];
    const after = structuredClone(before);
    after.session.homeDecorationPlacements = [{ ...before.session.homeDecorationPlacements[0],
      instanceId: "home", typeId: "home_type", mapId: "map_1", x: 2, y: 1, orientation: "down" }];
    const delivered = evidence(before, after);
    expect(delivered.changes).toEqual([{ path: "/session", before: before.session, after: after.session }]);
    for (const side of ["before", "after"] as const) {
      expect(delivered[side].flatMap(context => context.entries).filter(entry => /^\/maps\/[^/]+$/.test(entry.id))
        .map(entry => entry.id).sort()).toEqual(["/maps/map_0", "/maps/map_1", "/maps/map_blank_start"]);
    }
  });

  it("preserves writer transitive closure while review stops at the changed preset map", () => {
    const before = fixture();
    const map = before.maps.map_0;
    const linked = before.maps.map_1;
    if (!map || !linked) throw new Error("Map fixture is incomplete");
    map.events = [{ id: "entry", x: 1, y: 1, trigger: { kind: "action" }, commands: [
      { kind: "callCommonEvent", commonEventId: "common_link" },
    ] }];
    before.commonEvents.push({ id: "common_link", name: "Link", trigger: "none", commands: [
      { kind: "transfer", mapId: "map_1", x: 1, y: 1 },
    ] });
    linked.events = [{ id: "return", x: 1, y: 1, trigger: { kind: "action" }, commands: [
      { kind: "transfer", mapId: "map_0", x: 1, y: 1 },
      { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 },
    ] }];
    const after = structuredClone(before);
    const preset = after.testPresets?.[0];
    if (!preset) throw new Error("Preset fixture is incomplete");
    preset.gold = 999;
    const delivered = evidence(before, after);
    for (const side of ["before", "after"] as const) {
      const entries = delivered[side].flatMap(context => context.entries);
      expect(entries.find(entry => entry.id === "/maps/map_0/events/entry")?.value).toMatchObject({ event: map.events[0] });
      expect(entries.find(entry => entry.id === "/maps/map_1/events/return")).toBeUndefined();
      expect(entries.filter(entry => entry.id === "/database/commonEvents/common_link")).toHaveLength(1);
      expect(entries.find(entry => entry.id === "/database/items/item_potion")).toBeUndefined();
      expect(entries.some(entry => entry.id.startsWith("/maps/map_4"))).toBe(false);
      expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
    }
    const writerProject = structuredClone(before);
    writerProject.testPresets = before.testPresets?.slice(0, 1);
    const writer = extractOriginalContext(writerProject, { snapshotId: "writer" });
    expect(writer.entries.find(entry => entry.id === "/maps/map_1/events/return")?.value).toMatchObject({ event: linked.events[0] });
    expect(writer.entries.filter(entry => entry.id === "/database/commonEvents/common_link")).toHaveLength(1);
    expect(writer.entries.find(entry => entry.id === "/database/items/item_potion")?.value)
      .toMatchObject({ records: [before.database.items.find(item => item.id === "item_potion")] });
    expect(writer.entries.some(entry => entry.id.startsWith("/maps/map_4"))).toBe(false);
    expect(new Set(writer.entries.map(entry => entry.id)).size).toBe(writer.entries.length);
  });
});
