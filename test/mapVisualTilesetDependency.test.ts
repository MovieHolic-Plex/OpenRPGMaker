import { describe, expect, it } from "vitest";
import { requiresVisualReview, tilesetVisualContent } from "@/ai/mapVisualEvidence";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { createBlankProject } from "@/project/defaults";
import type { Project, TileGraft } from "@/project/types";

function withSecondMap(project: Project): { readonly usedId: string; readonly unusedId: string } {
  const start = project.maps[project.startMapId];
  const usedId = start.tilesetId;
  const unusedId = "unused-tileset";
  project.tilesets[unusedId] = { ...structuredClone(project.tilesets[usedId]), id: unusedId, name: "Unused" };
  project.maps.second = { ...structuredClone(start), id: "second", name: "Second", tilesetId: usedId };
  return { usedId, unusedId };
}

describe("tileset visual render dependencies", () => {
  it("requires fresh coverage when a used tileset atlas geometry changes", () => {
    const after = createBlankProject();
    const { usedId } = withSecondMap(after);
    const before = structuredClone(after);
    after.tilesets[usedId].tilesPerRow += 1;
    expect(requiresVisualReview(before, after, after.startMapId)).toBe(true);
    expect(requiresVisualReview(before, after, "second")).toBe(true);
  });

  it("ignores unreferenced tileset render edits for maps that do not use them", () => {
    const after = createBlankProject();
    const { unusedId } = withSecondMap(after);
    const before = structuredClone(after);
    after.tilesets[unusedId].tilesPerRow += 1;
    after.tilesets[unusedId].tileSize += 1;
    after.tilesets[unusedId].image = { type: "bundled", id: "other-chipset" };
    expect(requiresVisualReview(before, after, after.startMapId)).toBe(false);
    expect(requiresVisualReview(before, after, "second")).toBe(false);
  });

  it("treats tileset name and passability as nonvisual metadata", () => {
    const after = createBlankProject();
    const tilesetId = after.maps[after.startMapId].tilesetId;
    const before = structuredClone(after);
    after.tilesets[tilesetId].name = "Renamed atlas";
    after.tilesets[tilesetId].passability = after.tilesets[tilesetId].passability.map(() => "solid");
    after.tilesets[tilesetId].priority = after.tilesets[tilesetId].priority.map(() => "upper");
    after.tilesets[tilesetId].terrain = after.tilesets[tilesetId].terrain.map(() => 9);
    expect(requiresVisualReview(before, after, after.startMapId)).toBe(false);
    expect(tilesetVisualContent(before.tilesets[tilesetId])).toEqual(tilesetVisualContent(after.tilesets[tilesetId]));
  });

  it("classifies image, grafts, and uploaded bytes as visual while leaving map objects untouched", () => {
    const after = createBlankProject();
    const tilesetId = after.maps[after.startMapId].tilesetId;
    const before = structuredClone(after);
    const graft: TileGraft = { targetTile: 0, sourceChipset: "ChipSet1", sourceTile: 1 };
    after.tilesets[tilesetId].tileGrafts = [graft];
    expect(requiresVisualReview(before, after, after.startMapId)).toBe(true);
    after.tilesets[tilesetId].tileGrafts = [];
    after.tilesets[tilesetId].image = { type: "uploaded", id: "atlas-upload" };
    after.assets.uploaded["atlas-upload"] = {
      id: "atlas-upload", name: "Atlas", kind: "tileset", dataUrl: "data:image/png;base64,AA==", meta: {},
    };
    expect(requiresVisualReview(before, after, after.startMapId)).toBe(true);
    const withBytes = structuredClone(after);
    after.assets.uploaded["atlas-upload"].dataUrl = "data:image/png;base64,BB==";
    expect(requiresVisualReview(withBytes, after, after.startMapId)).toBe(true);
    expect(JSON.stringify(before.maps)).toBe(JSON.stringify(after.maps));
  });

  it("keeps stale image receipts retired after a used tileset render change, and accepts a fresh capture", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const evidence = new AssistantImageEvidence();
    const stale = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height });
    if (!stale) throw new Error("missing stale receipt");
    evidence.deliver([stale]);
    expect(evidence.current(project)).toEqual([stale]);
    project.tilesets[map.tilesetId].tilesPerRow += 1;
    expect(evidence.current(project)).toEqual([]);
    const fresh = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height });
    if (!fresh) throw new Error("missing fresh receipt");
    evidence.deliver([fresh]);
    expect(evidence.current(project)).toEqual([fresh]);
    expect(fresh.fingerprint).not.toBe(stale.fingerprint);
  });
});
