import { BEODEUL_OBJECT_IMAGE_ASSETS, BEODEUL_OBJECT_KIT_PREFIX, BEODEUL_OBJECT_PACK_TAG, BEODEUL_OBJECT_TILE_SIZE, BEODEUL_PLACEABLE_OBJECTS, beodeulObjectSetRole } from "@/assets/beodeulPlaceableObjects";
import { jsonEqual } from "@/util/structuralJson";
import { translateTiles } from "../objectStamp";
import { OBJECT_SPEC_SCHEMA, type ObjectSpecCategory } from "../objectSpec";
import { directionalPassageFromPreset } from "../tilesetPassage";
import type { SectionStructureKitDef, TileGroupRole, TilesetDef } from "../types";

const specCategories = {
  prop: "prop", indoor: "furniture", nature: "nature", structure: "building",
} as const satisfies Record<(typeof BEODEUL_PLACEABLE_OBJECTS)[number]["category"], ObjectSpecCategory>;

type PlaceableCatalog = "current" | "pre-ingest";

// The compact saves from before this ingest still reference the first 129 objects and the 2×2 crate.
const preIngestObjects = BEODEUL_PLACEABLE_OBJECTS.slice(0, 129).map(object => object.id !== "crate_stack" ? object : {
  ...object, sourceFile: "crate_stack_v3.png", widthPx: 32, widthTiles: 2,
  footprint: ["**", "XX"], tags: ["harbor", "market", "창고"],
});

function sourceKits(target: TilesetDef, catalog: PlaceableCatalog) {
  const passability: TilesetDef["passability"] = [];
  const priority: TilesetDef["priority"] = [];
  const tileMeta: NonNullable<TilesetDef["tileMeta"]> = [];
  const tileGrafts: NonNullable<TilesetDef["tileGrafts"]> = [];
  const objects = catalog === "pre-ingest" ? preIngestObjects : BEODEUL_PLACEABLE_OBJECTS;
  const kits = objects.map((object, index): SectionStructureKitDef => {
    const { widthTiles: width, heightTiles: height, footprint, set, growthAxis, surface } = object;
    const id = BEODEUL_OBJECT_KIT_PREFIX + object.id;
    const description = object.nameKo;
    const tags = [BEODEUL_OBJECT_PACK_TAG, ...object.tags];
    const repeat = growthAxis ? "repeat" : "fixed";
    const role: TileGroupRole = (set && beodeulObjectSetRole(set.id))
      ?? (object.category === "structure" ? "building" : "prop");
    const placementRules = surface === "water" ? "물 위에 놓는다."
      : surface === "wall" ? "벽면에 붙인다." : "바닥에 놓고 길과 출입구를 비워 둔다.";
    const rows = footprint.map((row, dy) => ({
      tiles: Array<number>(width).fill(-1),
      upperTiles: Array.from(row, (mark, dx) => {
        if (mark === " ") return -1;
        const slot = tileGrafts.length;
        const rule = directionalPassageFromPreset(mark === "X" ? "blocked" : mark === "*" ? "star" : "open");
        passability.push(rule.passability);
        priority.push(rule.priority);
        tileMeta.push({
          label: `${object.nameKo} (${dx},${dy})`, description, tags,
          role, defaultLayer: "upper", repeatability: repeat, source: "bundled-default",
          passage: mark === "X" ? "solid" : mark === "*" ? "star" : "passable",
        });
        tileGrafts.push({ targetTile: slot, sourceChipset: BEODEUL_OBJECT_IMAGE_ASSETS[index]!.textureKey, sourceTile: dy * width + dx });
        return slot;
      }),
    }));
    const footRows = footprint.filter(row => row.includes("X")).length;
    const kind = surface === "wall" ? "wallmount" : footprint.every(row => !/[X*]/u.test(row)) ? "decal"
      : footRows > 0 && footRows < height ? "tall" : "prop";
    return {
      id, name: object.nameKo, kind: "section", width, height, tileSize: BEODEUL_OBJECT_TILE_SIZE,
      learnedFrom: "pack-preset", rows,
      ai: {
        role, repeatability: repeat, ...(growthAxis ? { growthAxis } : {}),
        layerHome: "upper", tags: [...tags, kind], description, placementRules,
      },
      spec: {
        schema: OBJECT_SPEC_SCHEMA, id, name: object.nameKo, summary: description,
        category: specCategories[object.category], tags,
        tileSize: BEODEUL_OBJECT_TILE_SIZE, size: { w: width, h: height },
        view: { footRows, risePx: (height - footRows) * BEODEUL_OBJECT_TILE_SIZE },
        layer: "upper", passage: [...footprint],
        placement: {
          anchor: surface === "wall" ? "hang" : kind === "decal" ? "flat" : object.category === "indoor" ? "floor" : "outdoor",
          rule: placementRules, repeat,
        },
        provenance: { aiGenerated: true, tool: "ChatGPT dots" },
      },
    };
  });
  // A virtual sheet used only for translation. Every populated slot resolves through its PNG graft.
  const source: TilesetDef = {
    id: "beodeul-placeable-objects", name: BEODEUL_OBJECT_PACK_TAG, image: target.image,
    tileSize: BEODEUL_OBJECT_TILE_SIZE, tilesPerRow: target.tilesPerRow, count: tileGrafts.length,
    passability, priority, tileMeta, tileGrafts, terrain: Array<number>(tileGrafts.length).fill(0),
  };
  return { source, kits };
}

/** The 2-column crate used source frames 2 and 3 for its bottom row. Keep their painted slots. */
export function upgradeBeodeulCrateStackGrafts(tileset: TilesetDef): boolean {
  const grafts = tileset.tileGrafts;
  if (!grafts?.some(graft => graft.sourceChipset === "tex_beodeul_object_crate_stack")) return false;
  const legacyKit = tileset.structureKits?.find(kit => kit.id === BEODEUL_OBJECT_KIT_PREFIX + "crate_stack");
  const legacyRow = legacyKit?.kind === "section" && legacyKit.width === 2 ? legacyKit.rows[1]?.upperTiles : undefined;
  let changed = false;
  for (const [index, graft] of grafts.entries()) {
    if (graft.sourceChipset !== "tex_beodeul_object_crate_stack" || (graft.sourceTile !== 2 && graft.sourceTile !== 3)) continue;
    const column = graft.sourceTile - 2;
    // Cross-tileset stamps carry the source tile label even when they do not carry the kit.
    if (legacyRow?.[column] !== graft.targetTile && tileset.tileMeta?.[graft.targetTile]?.label !== `나무 상자 더미 (${column},1)`) continue;
    grafts[index] = { ...graft, sourceTile: graft.sourceTile + 1 };
    changed = true;
  }
  return changed;
}

/** Add the bundled kits using the existing graft path, preserving the numbers on maps already painted. */
export function ensureBeodeulPlaceableObjects(tileset: TilesetDef, catalog: PlaceableCatalog = "current"): boolean {
  if (tileset.tileSize !== BEODEUL_OBJECT_TILE_SIZE) return false;
  const { source, kits } = sourceKits(tileset, catalog);
  const { map, slotsAdded } = translateTiles(source, tileset, source.passability.keys());
  const registered = tileset.structureKits ??= [];
  const indexes = new Map(registered.map((kit, index) => [kit.id, index]));
  let changed = slotsAdded > 0;
  const meta = tileset.tileMeta ??= [];
  // Saved projects can have the same source pictures at different graft slots.
  for (const [from, to] of map) {
    if (tileset.priority[to] !== source.priority[from] || !jsonEqual(tileset.passability[to], source.passability[from])) {
      tileset.priority[to] = source.priority[from]!;
      tileset.passability[to] = source.passability[from]!;
      changed = true;
    }
    if (!meta[to]?.userLocked && meta[to]?.origin !== "user" && !jsonEqual(meta[to], source.tileMeta![from])) {
      meta[to] = source.tileMeta![from]!;
      changed = true;
    }
  }
  for (const kit of kits) {
    for (const row of kit.rows) row.upperTiles = row.upperTiles!.map(tile => tile < 0 ? tile : map.get(tile)!);
    const index = indexes.get(kit.id);
    if (index === undefined) {
      registered.push(kit);
      changed = true;
    } else if (!jsonEqual(registered[index], kit)) {
      registered[index] = kit;
      changed = true;
    }
  }
  return changed;
}
