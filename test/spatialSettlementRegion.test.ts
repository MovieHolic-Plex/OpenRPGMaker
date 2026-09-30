import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence, SpatialCompileError } from "@/editor/spatial/compileSpatialOccurrence";
// 정주지 스탬프는 등록 훅 경유 — builder 모듈 로드가 bindSettlementVillageBuild를 실행한다.
import "@/editor/tools/village/builder";
import { deserialize, serialize } from "@/project/io";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { checkedDocument, own, spatialId } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import type { RegionDesign, SpatialRoute } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

const REGION_ID = spatialId("settlement-region");
const PRESET_ID = "test-preset";

function settlementRegion(overrides: Partial<RegionDesign> = {}): RegionDesign {
  return {
    id: REGION_ID,
    name: "Settlement region",
    revision: 1,
    tags: ["settlement"],
    provenance: { origin: "user" },
    terrain: { tilesetId: COMBINED_TOWN_TILESET_ID, width: 48, height: 40, floor: "ground", areas: [] },
    places: [],
    ports: [{ id: spatialId("entry"), name: "Entry", x: 24, y: 39 }],
    routes: [],
    settlement: { presetId: PRESET_ID, seed: 7 },
    ...overrides,
  };
}

function settlementFixture(region: RegionDesign = settlementRegion()): Project {
  const project = placeCompilerFixture(7);
  const source = fixtureDocument(project);
  const document = checkedDocument({
    ...source,
    occurrences: {},
    rootOccurrenceIds: [],
    connections: [],
    library: { ...source.library, regions: { [region.id]: region } },
  }, project);
  project.villagePresets = [{ id: PRESET_ID, name: "시험 마을", houseCount: 2 }];
  project.spatialAuthoring = instantiateSpatialDesign(document, project, {
    source: { kind: "region", id: region.id },
    rootId: geographyRoot,
    x: 0,
    y: 0,
    level: 0,
    seed: 7,
    generatorVersion: "settlement-region-test",
  });
  return project;
}

function settlementMap(project: Project) {
  const id = `spatial-geography:${geographyRoot.length}:${geographyRoot}`;
  return own(project.maps, id);
}

describe("settlement region compile", () => {
  it("stamps the preset village onto the region map", () => {
    const compiled = compileSpatialOccurrence(settlementFixture(), { occurrenceId: geographyRoot });
    const map = settlementMap(compiled);
    expect(map.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
    // 마을 시공 흔적 — 지붕/벽 상부 타일과 NPC 이벤트가 생긴다.
    expect(map.upperTiles.some((tile) => tile !== TILE.EMPTY)).toBe(true);
    expect(map.events.some((event) => event.id.startsWith("ev_village_"))).toBe(true);
    const occurrence = own(compiled.spatialAuthoring!.occurrences, geographyRoot);
    expect(occurrence.bindings[0]?.mapId).toBe(map.id);
  });

  it("is idempotent — recompile strips prior village events before stamping", () => {
    const first = compileSpatialOccurrence(settlementFixture(), { occurrenceId: geographyRoot });
    const second = compileSpatialOccurrence(first, { occurrenceId: geographyRoot });
    const a = settlementMap(first);
    const b = settlementMap(second);
    expect(b.events).toEqual(a.events);
    expect(b.lowerTiles).toEqual(a.lowerTiles);
    expect(b.upperTiles).toEqual(a.upperTiles);
  });

  it("round-trips the settlement field through project io", () => {
    const project = settlementFixture();
    const restored = deserialize(serialize(project));
    const region = restored.spatialAuthoring?.library.regions[REGION_ID];
    expect(region?.settlement).toEqual({ presetId: PRESET_ID, seed: 7 });
  });

  it("rejects routes on a settlement region — the village builder paints roads", () => {
    const route: SpatialRoute = {
      id: spatialId("road"),
      from: { childId: null, portId: spatialId("entry") },
      to: { childId: null, portId: spatialId("entry") },
      bidirectional: true,
      points: [{ x: 4, y: 39 }, { x: 24, y: 39 }],
    };
    const region = settlementRegion({ routes: [route] });
    expect(() => compileSpatialOccurrence(settlementFixture(region), { occurrenceId: geographyRoot }))
      .toThrowError(SpatialCompileError);
  });

  it("rejects a world-chipset terrain for a settlement region", () => {
    const region = settlementRegion({
      terrain: { tilesetId: "easyrpg_chipset_world", width: 48, height: 40, floor: "ground", areas: [] },
    });
    expect(() => compileSpatialOccurrence(settlementFixture(region), { occurrenceId: geographyRoot }))
      .toThrowError(SpatialCompileError);
  });
});
