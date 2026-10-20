// ObjectSpec v1 — tile-gen·스토어·에디터가 같이 읽는 기물 설명서. 검사, 공방 옛 태그 이주, 공방 굽기, 팩 목록.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { OBJECT_SPEC_SCHEMA, objectSpecPassage, validateObjectSpec, type ObjectSpecV1 } from "@/project/objectSpec";
import { migrateLegacyWorkshopKit, objectSpecOfKit, specFromLegacyWorkshopTags } from "@/project/objectSpecKits";
import { bakeWorkshopObject, workshopHandObjects, workshopObjectId, type WorkshopObjectInput } from "@/project/workshopTiles";
import { packObjects } from "@/assetStore/pack";
import { STORE_PACK_SCHEMA, validateManifest, type StorePackManifest } from "@/assetStore/format";
import type { SectionStructureKitDef, TilesetDef } from "@/project/types";

const ID = "atlas_biome_interior";

const well = (over: Partial<ObjectSpecV1> = {}): ObjectSpecV1 => ({
  schema: OBJECT_SPEC_SCHEMA, id: "stone-well", name: "돌 우물", category: "prop", tags: ["우물"], tileSize: 16,
  size: { w: 2, h: 2 }, view: { footRows: 1, risePx: 0 }, layer: "upper",
  placement: { anchor: "outdoor", use: ["decor"] }, provenance: { aiGenerated: true, tool: "tile-gen/0.1.0" }, ...over,
});

const shelf = (over: Partial<WorkshopObjectInput> = {}): WorkshopObjectInput => ({
  objectId: workshopObjectId("new:약초 선반"), title: "약초 선반", description: "말린 약초", kind: "floor",
  columns: 2, rows: 2, footRows: 1, risePx: 16, use: ["search"], gridHash: "h1",
  asset: { id: "workshop_test", dataUrl: "data:image/png;base64,AA", width: 480, height: 16 },
  cells: [{ sourceTile: 0, dx: 0, dy: 0 }, { sourceTile: 1, dx: 1, dy: 0 }, { sourceTile: 2, dx: 0, dy: 1 }, { sourceTile: 3, dx: 1, dy: 1 }],
  ...over,
});

describe("ObjectSpec v1 검사", () => {
  it("올바른 설명서를 받고, 크기와 통행 줄이 어긋나면 거절한다", () => {
    expect(validateObjectSpec(well()).ok).toBe(true);
    expect(validateObjectSpec(well({ passage: ["**", "XX"] })).ok).toBe(true);
    expect(validateObjectSpec(well({ passage: ["**"] })).ok).toBe(false);
    expect(validateObjectSpec(well({ view: { footRows: 3, risePx: 0 } })).ok).toBe(false);
    expect(validateObjectSpec({ ...well(), schema: "x" }).ok).toBe(false);
    expect(validateObjectSpec({ ...well(), provenance: {} }).ok).toBe(false);
    expect(validateObjectSpec(well({ id: "workshop:돌-우물" })).ok).toBe(true);
    expect(validateObjectSpec(well({ id: "has space" })).ok).toBe(false);
  });

  it("통행이 없으면 발밑 줄에서 유도한다", () => {
    expect(objectSpecPassage(well())).toEqual(["**", "XX"]);
    expect(objectSpecPassage(well({ placement: { anchor: "flat" } }))).toEqual(["..", ".."]);
  });
});

describe("공방 옛 태그 → 설명서", () => {
  const legacy = (): SectionStructureKitDef => ({
    id: "workshop:선반", kind: "section", name: "선반", width: 2, height: 2,
    rows: [{ tiles: [-1, -1], upperTiles: [10, 11] }, { tiles: [-1, -1], upperTiles: [12, 13] }],
    ai: { description: "책 선반", placementRules: "바닥에 둔다.", tags: ["tall", "workshop", "hand:wall", "foot:1", "rise:12", "grid:abc", "use:storage"] },
    learnedFrom: "workshop",
  });

  it("옛 태그를 정식 칸으로 읽고, 이주하면 인코딩 태그를 뺀다", () => {
    const kit = legacy();
    const spec = specFromLegacyWorkshopTags(kit, 16)!;
    expect(spec.placement.anchor).toBe("wall");
    expect(spec.view).toEqual({ footRows: 1, risePx: 12 });
    expect(spec.placement.use).toEqual(["storage"]);
    expect(spec.art?.gridHash).toBe("abc");
    expect(spec.tags).toEqual(["tall", "workshop"]);
    expect(validateObjectSpec(spec).ok).toBe(true);
    expect(migrateLegacyWorkshopKit(kit, 16)).toBe(true);
    expect(kit.spec?.placement.anchor).toBe("wall");
    expect(kit.ai?.tags).toEqual(["tall", "workshop"]);
    expect(objectSpecOfKit(kit)?.view.risePx).toBe(12);
  });

  it("공방이 아닌 킷의 use: 태그는 건드리지 않는다", () => {
    const kit = { ...legacy(), learnedFrom: "user-paint" as const, ai: { description: "", placementRules: "", tags: ["use:sit"] } };
    expect(migrateLegacyWorkshopKit(kit, 16)).toBe(false);
    expect(kit.ai.tags).toEqual(["use:sit"]);
  });
});

describe("공방 굽기는 설명서를 쓴다", () => {
  it("새 킷은 spec 을 갖고 옛 인코딩 태그가 없으며, 방 짓기 사양으로 같은 값이 나온다", () => {
    const p = createBlankProject();
    const kit = bakeWorkshopObject(p, ID, shelf({ review: { pick: { by: "human", at: "2026-10-20T00:00:00Z" } } }));
    expect(kit.spec?.schema).toBe(OBJECT_SPEC_SCHEMA);
    expect(validateObjectSpec(kit.spec).ok).toBe(true);
    expect(kit.spec?.view).toEqual({ footRows: 1, risePx: 16 });
    expect(kit.spec?.passage).toEqual(["**", "XX"]);
    expect(kit.spec?.art?.gridHash).toBe("h1");
    expect(kit.spec?.review?.pick?.by).toBe("human");
    expect(kit.ai?.tags?.some((tag) => /^(hand|foot|rise|grid|use):/.test(tag))).toBe(false);
    const hand = workshopHandObjects(p.tilesets[ID])[kit.id]!;
    expect(hand).toMatchObject({ kind: "floor", h: 1, up: 16, use: ["search"] });
    // 같은 격자 해시면 다시 늘리지 않는다(해시는 spec.art.gridHash 에서 읽는다)
    const count = p.tilesets[ID]!.count;
    bakeWorkshopObject(p, ID, shelf());
    expect(p.tilesets[ID]!.count).toBe(count);
  });
});

describe("스토어 팩 content.objects", () => {
  const tileset = (kits: SectionStructureKitDef[]): TilesetDef => ({
    id: "ts_a", name: "우물", kind: "custom", image: { type: "uploaded", id: "a_1" }, tileSize: 16, tilesPerRow: 2, count: 4,
    passability: Array.from({ length: 4 }, () => ({ up: true, down: true, left: true, right: true })),
    priority: ["upper", "upper", "upper", "upper"], terrain: [0, 0, 0, 0], structureKits: kits,
  });
  const kit = (spec?: ObjectSpecV1): SectionStructureKitDef => ({
    id: "stone-well", kind: "section", name: "돌 우물", width: 2, height: 2,
    rows: [{ tiles: [-1, -1], upperTiles: [0, 1] }, { tiles: [-1, -1], upperTiles: [2, 3] }], learnedFrom: "pack-preset", ...(spec ? { spec } : {}),
  });
  const sha = "a".repeat(64);
  const manifest = (objects: unknown): StorePackManifest => ({
    schema: STORE_PACK_SCHEMA, title: "우물", summary: "", description: "", tags: [], kind: "tileset", license: "CC0", aiGenerated: true, credits: "tile-gen",
    content: { assets: { a_1: { id: "a_1", name: "우물", kind: "chipset", blob: sha, mime: "image/png", meta: { width: 32, height: 32 } } }, tilesets: { ts_a: tileset([kit(well())]) }, objects } as StorePackManifest["content"],
    previews: [sha], blobs: [{ sha256: sha, mime: "image/png", bytes: 10 }],
  });

  it("설명서가 있는 킷만 목록이 된다", () => {
    expect(packObjects({ ts_a: tileset([kit(well()), kit()]) })).toEqual([{ tileset: "ts_a", kit: "stone-well", spec: well() }]);
  });

  it("매니페스트 검사: 맞는 목록은 받고, 없는 킷·틀린 설명서·id 불일치는 거절한다", () => {
    expect(validateManifest(manifest([{ tileset: "ts_a", kit: "stone-well", spec: well() }])).ok).toBe(true);
    expect(validateManifest(manifest(undefined)).ok).toBe(true);
    expect(validateManifest(manifest([{ tileset: "ts_a", kit: "nope", spec: well({ id: "nope" }) }])).ok).toBe(false);
    expect(validateManifest(manifest([{ tileset: "ts_x", kit: "stone-well", spec: well() }])).ok).toBe(false);
    expect(validateManifest(manifest([{ tileset: "ts_a", kit: "stone-well", spec: { ...well(), size: { w: 0, h: 2 } } }])).ok).toBe(false);
    expect(validateManifest(manifest([{ tileset: "ts_a", kit: "stone-well", spec: well({ id: "other" }) }])).ok).toBe(false);
  });
});
