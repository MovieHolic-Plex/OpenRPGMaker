import { describe, expect, it } from "vitest";
import { bindInteriorConceptPlan } from "@/editor/interiorConceptPlan";
import type { InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { ToolError } from "@/editor/tools/types";
import { own, spatialId } from "@/project/spatial/domain";
import { convertLegacySpatialSnapshot, legacySpatialId } from "@/project/spatial/legacyImport";
import { preparedProject } from "./support/authorHouseFacadeFixture";

const atlas = "easyrpg_chipset_interior";
const mappedId = legacySpatialId([atlas, "house", "place", "bedroom"]);
const nativeId = spatialId("independent-native-bedroom");

function convertedDefaults() {
  const legacy = preparedProject();
  return { ...legacy, spatialAuthoring: convertLegacySpatialSnapshot(JSON.stringify(legacy)).raw.spatialAuthoring };
}

function roomPlan(theme: string): InteriorRoomPlan {
  return { mapId: "decision-room", name: "Room", seed: 59, width: 16, height: 14, theme, tilesetId: atlas,
    wings: [], rooms: [{ id: "room", theme, x: 3, y: 4, w: 9, h: 6 }], door: { x: 7, y: 9 } };
}

describe.each(["user", "ai", "builtin"] as const)("default shorthand with native origin=%s", origin => {
  it.each([
    { name: "bedroom", tags: ["bedroom"] },
    { name: "bedroom", tags: [] },
    { name: "Independent Room", tags: ["bedroom"] },
  ])("rejects ambiguity when the native matches $name / $tags", alias => {
    // Given: faithful decision-probes.mts:49-76 default fixture; native inserted first.
    const project = convertedDefaults();
    const document = project.spatialAuthoring;
    const native = { ...own(document.library.spaces, mappedId), ...alias, id: nativeId, provenance: { origin } };
    project.spatialAuthoring = { ...document, library: { ...document.library,
      spaces: { [native.id]: native, ...document.library.spaces } } };
    const before = JSON.stringify(project);
    // When: observe the actual binder's selected source or typed rejection.
    let bound: InteriorRoomPlan | undefined;
    let code: string | undefined;
    try { bound = bindInteriorConceptPlan(roomPlan("bedroom"), project); }
    catch (error) { if (!(error instanceof ToolError)) throw error; code = error.code; }
    // Then: no source may win genuine ambiguity; lookup remains read-only.
    expect({ code, selectedId: bound?.concept?.rooms.room?.placeId }).toEqual({ code: "spatial-ambiguous", selectedId: undefined });
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each([nativeId, mappedId])("honors exact ID %s when default and native aliases collide", id => {
    // Given
    const project = convertedDefaults();
    const document = project.spatialAuthoring;
    const native = { ...own(document.library.spaces, mappedId), id: nativeId,
      name: "bedroom", tags: ["bedroom"], provenance: { origin } };
    project.spatialAuthoring = { ...document, library: { ...document.library,
      spaces: { [native.id]: native, ...document.library.spaces } } };
    // When
    const bound = bindInteriorConceptPlan(roomPlan(id), project);
    // Then
    expect(bound.concept?.rooms.room?.placeId).toBe(id);
  });

  it("deduplicates identity when the preferred source also has native provenance and matching name/tag", () => {
    // Given: an edited original satisfies receipt preference and native name/tag selection.
    const project = convertedDefaults();
    const document = project.spatialAuthoring;
    const source = { ...own(document.library.spaces, mappedId), name: "bedroom", tags: ["bedroom"], provenance: { origin } };
    project.spatialAuthoring = { ...document, library: { ...document.library,
      spaces: { ...document.library.spaces, [source.id]: source } } };
    // When
    const bound = bindInteriorConceptPlan(roomPlan("bedroom"), project);
    // Then: one canonical ID is not an ambiguity merely because two selection rules match.
    expect(bound.concept?.rooms.room?.placeId).toBe(mappedId);
  });

  it("keeps shorthand when a same-atlas native has no matching name or tag", () => {
    // Given
    const project = convertedDefaults();
    const document = project.spatialAuthoring;
    const native = { ...own(document.library.spaces, mappedId), id: nativeId,
      name: "Independent Room", tags: [], provenance: { origin } };
    project.spatialAuthoring = { ...document, library: { ...document.library,
      spaces: { [native.id]: native, ...document.library.spaces } } };
    // When
    const bound = bindInteriorConceptPlan(roomPlan("bedroom"), project);
    // Then
    expect(bound.concept?.rooms.room?.placeId).toBe(mappedId);
  });
});
