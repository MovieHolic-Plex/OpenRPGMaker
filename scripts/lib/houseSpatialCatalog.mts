import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { DEFAULT_TILESET_ID } from "../../src/project/defaults/constants";
import { spatialId, checkedDocument } from "../../src/project/spatial/domain";
import type { ObjectDesign, PlaceDesign, SpaceDesign, SpatialDesignBase, SpatialLibrary } from "../../src/project/spatial/types";
import type { Project } from "../../src/project/types";
import { HOUSE_STUDIES, bakeHouseStudy } from "./houseStudyDesigns.mts";
import { HOUSE_HEIGHT_STUDIES } from "./houseHeightStudies.mts";

const INTERIOR = "easyrpg_chipset_interior";
const TAG = "집 연구 20260912";
const id = spatialId;
export const HOUSE_CATALOG_STUDIES = [
  ...HOUSE_STUDIES.map(study => ({ study, floors: ["townhouse", "setback", "inn", "workshop"].includes(study.id) ? 2 : 1 })),
  ...HOUSE_HEIGHT_STUDIES.filter(item => item.floors > 2),
];

/** Keep imported identities stable, including when a gallery writer is rerun. */
export function houseObjectForGraphic(project: Project, tilesetId: string, kitId: string): ObjectDesign | undefined {
  const document = project.spatialAuthoring;
  if (!document) return undefined;
  const sourceKey = JSON.stringify([tilesetId, "", "object", kitId]);
  const mapped = document.legacyImport.mapping.find(entry => entry.sourceKey === sourceKey && entry.target.kind === "object");
  const imported = mapped && document.library.objects[mapped.target.id];
  if (imported?.graphic.tilesetId === tilesetId && imported.graphic.kitId === kitId) return imported;
  return Object.values(document.library.objects).find(object => object.graphic.tilesetId === tilesetId && object.graphic.kitId === kitId);
}

function base(key: string, name: string, tags: string[]): SpatialDesignBase {
  return { id: id(`house-catalog:${key}`), name, revision: 1, tags: [TAG, ...tags], provenance: { origin: "ai", sourceId: "house-studies-20260912" } };
}

/** Pure catalog assembly. Activation and publication belong to the caller. */
export function registerHouseSpatialCatalog(input: Project) {
  const project = structuredClone(input);
  const document = project.spatialAuthoring;
  assert.ok(document, "Activate through the raw remote publication path first");
  const objects = { ...document.library.objects };
  const spaces = { ...document.library.spaces };
  const places = { ...document.library.places };
  const put = <T extends SpatialDesignBase>(records: Record<string, T>, next: T) => {
    const old = records[next.id];
    // Repeat publication must not create another definition or advance unchanged revisions.
    if (old && isDeepStrictEqual({ ...old, revision: 1 }, { ...next, revision: 1 })) return old;
    const saved = { ...next, revision: old ? old.revision + 1 : 1 };
    records[next.id] = saved;
    return saved;
  };
  const furniture = (kitId: string) => {
    const object = houseObjectForGraphic(project, INTERIOR, kitId);
    assert.ok(object, `Missing imported interior object ${kitId}`);
    // The raw section import has no authored event chips; never borrow a facility's interactive instance.
    assert.deepEqual(object.chips, [], `Expected undecorated reusable object ${kitId}`);
    return object.id;
  };
  const slot = (key: string, kitId: string, x: number, y: number) => ({
    id: id(key), objectDesignId: furniture(kitId), quantity: 1, required: true, placement: { mode: "fixed" as const, x, y },
  });
  const port = (key: string, name: string, x: number, y: number) => ({ id: id(key), name, x, y });
  const floorSpecs = [
    { key: "single", name: "주택 거실과 침실", down: false, up: false },
    { key: "ground", name: "주택 1층 거실 · 올라가는 계단", down: false, up: true },
    { key: "middle", name: "주택 중간층 · 위아래 계단", down: true, up: true },
    { key: "top", name: "주택 최상층 침실 · 내려가는 계단", down: true, up: false },
  ];
  for (const spec of floorSpecs) {
    const space: SpaceDesign = {
      ...base(`room:${spec.key}`, spec.name, ["주택", "실내", "층별 공간"]),
      environment: "interior", role: spec.down ? "room" : "entrance", tilesetId: INTERIOR,
      shape: "rect", width: 12, height: 10, floor: "wood", wall: "cream",
      ports: [port(spec.down ? "down" : "entry", spec.down ? "아래층 계단" : "현관", 6, 9),
        ...(spec.up ? [port("up", "위층 계단", 9, 2)] : [])],
      objectSlots: [slot("bed", "bed_v", 2, 4), slot("table", "table_chairs", 6, 5),
        ...(spec.down ? [slot("stairs-down", "stairs_down", 6, 9)] : []),
        ...(spec.up ? [slot("stairs-up", "stairs_small", 9, 2)] : [])],
    };
    put(spaces, space);
  }
  const registered = [];
  for (const { study, floors } of HOUSE_CATALOG_STUDIES) {
    const kit = bakeHouseStudy(study);
    const tileset = project.tilesets[DEFAULT_TILESET_ID]!;
    const existing = tileset.structureKits?.find(value => value.id === kit.id);
    if (existing) assert.deepEqual(existing, kit, `Reviewed exterior ${kit.id} has changed; inspect it before registering`);
    else tileset.structureKits = [...(tileset.structureKits ?? []), kit];
    const current = houseObjectForGraphic(project, DEFAULT_TILESET_ID, kit.id) ?? {
      ...base(`object:${study.id}`, study.name, ["건물 외형"]),
      graphic: { tilesetId: DEFAULT_TILESET_ID, kitId: kit.id }, anchors: [], chips: [],
    };
    const door = study.doors[0];
    assert.ok(door);
    const name = study.stackedCore ? `${study.id.startsWith("inn") ? "갈색" : "회색"} 지붕 ${floors}층집` : study.name;
    const object = put(objects, { ...current, name: `${name} · 건물 외형`,
      tags: [TAG, "건물 외형", "주택", `${floors}층`],
      anchors: study.doors.map((point, index) => port(`door-${index + 1}`, "문 앞", point.x, point.y + 1)), chips: [],
    });
    const width = kit.width + 4, height = kit.height + 5;
    const yard: SpaceDesign = {
      ...base(`yard:${study.id}`, `${name} · 마당과 외형`, ["주택", "실외", "마당", `${floors}층`]),
      environment: "outdoor", tilesetId: DEFAULT_TILESET_ID, shape: "rect", width, height, floor: "ground", wall: "none",
      floorAreas: [{ kind: "rect", x: 2 + door.x, y: 3 + door.y, width: 1, height: height - (3 + door.y), material: "path" }],
      objectSlots: [{ id: id("exterior"), objectDesignId: object.id, quantity: 1, required: true, placement: { mode: "fixed", x: 2, y: 2 } }],
      ports: [port("street", "마당 진입", 2 + door.x, height - 1), port("door", "현관 앞", 2 + door.x, 3 + door.y)],
    };
    put(spaces, yard);
    const children: PlaceDesign["children"] = [
      { id: id("yard"), source: { kind: "space", id: yard.id }, x: 0, y: 0, level: 0 },
      ...Array.from({ length: floors }, (_, index) => {
        const key = floors === 1 ? "single" : index === 0 ? "ground" : index === floors - 1 ? "top" : "middle";
        return { id: id(`floor-${index + 1}`), source: { kind: "space" as const, id: id(`house-catalog:room:${key}`) }, x: 0, y: 0, level: index + 1 };
      }),
    ];
    const place: PlaceDesign = {
      ...base(`place:${study.id}`, `${name} · 주택`, ["주택", "마당 포함", "출입 연결", `${floors}층`]),
      kind: "facility", layout: "manual", children,
      ports: [port("entrance", "마당 입구", 2 + door.x, height - 1)],
      connections: [
        { id: id("front-door"), from: { childId: id("yard"), portId: id("door") }, to: { childId: id("floor-1"), portId: id("entry") }, bidirectional: true },
        ...Array.from({ length: floors - 1 }, (_, index) => ({ id: id(`stairs-${index + 1}`),
          from: { childId: id(`floor-${index + 1}`), portId: id("up") },
          to: { childId: id(`floor-${index + 2}`), portId: id("down") }, bidirectional: true })),
      ],
    };
    put(places, place);
    registered.push({ studyId: study.id, kitId: kit.id, objectId: object.id, yardId: yard.id, placeId: place.id, floors });
  }
  const library: SpatialLibrary = { ...document.library, objects, spaces, places };
  project.spatialAuthoring = checkedDocument({ ...document, library }, project);
  return { project, registered };
}
