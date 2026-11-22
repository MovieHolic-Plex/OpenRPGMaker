import { z } from "zod";
import catalog from "../../public/assets/beodeul-objects/catalog.json";
import manifest from "../../public/assets/beodeul-objects/manifest.json";

export const BEODEUL_OBJECT_TILE_SIZE = 16;
export const BEODEUL_OBJECT_KIT_PREFIX = "bd-object:";
export const BEODEUL_OBJECT_PACK_TAG = "버들항 기본 기물";

const key = z.string().regex(/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/u);
const koreanLabel = z.string().regex(/[가-힣]/u);
const size = z.number().int().positive();
const groupSchema = z.strictObject({ id: key, labelKo: koreanLabel, order: z.number().int().nonnegative() });
const manifestSchema = z.strictObject({
  groups: z.array(groupSchema).min(1),
  sets: z.array(z.strictObject({
    id: key,
    role: z.enum(["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"]),
    requiredPieces: z.array(key).min(1),
  })),
});
const objectSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u),
  nameKo: koreanLabel,
  category: z.enum(["prop", "indoor", "nature", "structure"]),
  group: key,
  sourceFile: z.string().regex(/^[a-z][a-z0-9_]*\.png$/u),
  widthPx: size,
  heightPx: size,
  widthTiles: size,
  heightTiles: size,
  footprint: z.array(z.string().regex(/^[X.* ]+$/u)).min(1),
  tags: z.array(z.string().trim().min(1)).min(1),
  set: z.strictObject({ id: key, piece: key }).optional(),
  growthAxis: z.enum(["horizontal", "vertical", "both"]).optional(),
  surface: z.enum(["water", "wall"]).optional(),
});
const catalogSchema = z.array(objectSchema).min(1);

export type BeodeulPlaceableObject = Readonly<z.infer<typeof objectSchema>>;
export type BeodeulObjectGroup = Readonly<z.infer<typeof groupSchema>>;

/** Validate metadata and cross-references when loading the bundled catalog. */
export function parseBeodeulObjectCatalog(catalogInput: unknown, manifestInput: unknown) {
  const objects = catalogSchema.parse(catalogInput);
  const { groups, sets } = manifestSchema.parse(manifestInput);
  const groupIds = new Set(groups.map(group => group.id));
  if (groupIds.size !== groups.length) throw new Error("Duplicate Beodeul object group id");
  const setsById = new Map(sets.map(set => [set.id, set]));
  if (setsById.size !== sets.length) throw new Error("Duplicate Beodeul object set id");

  const ids = new Set<string>();
  const piecesBySet = new Map(sets.map(set => [set.id, new Set<string>()]));
  for (const object of objects) {
    const { id, group, sourceFile, widthPx, heightPx, widthTiles, heightTiles, footprint, set } = object;
    if (ids.has(id)) throw new Error(`Duplicate Beodeul object id: ${id}`);
    ids.add(id);
    if (!groupIds.has(group)) throw new Error(`${id}: unknown Beodeul object group ${group}`);
    if (/_(?:[rv]\d+|hq\d*)$/u.test(id) || sourceFile.replace(/(?:_(?:[rv]\d+|hq\d*))?\.png$/u, "") !== id) {
      throw new Error(`${id}: sourceFile must match the base object id`);
    }
    if (widthTiles !== Math.ceil(widthPx / BEODEUL_OBJECT_TILE_SIZE) || heightTiles !== Math.ceil(heightPx / BEODEUL_OBJECT_TILE_SIZE)) {
      throw new Error(`${id}: tile size does not match declared pixel dimensions`);
    }
    if (footprint.length !== heightTiles || footprint.some(row => row.length !== widthTiles) || !footprint.some(row => /[X.*]/u.test(row))) {
      throw new Error(`${id}: footprint must match the grid and contain an occupied cell`);
    }
    if (set) {
      const pieces = piecesBySet.get(set.id);
      if (!pieces) throw new Error(`${id}: unknown Beodeul object set ${set.id}`);
      if (object.category !== "structure") throw new Error(`${id}: set pieces must use category structure`);
      if (pieces.has(set.piece)) throw new Error(`${id}: duplicate piece ${set.id}/${set.piece}`);
      pieces.add(set.piece);
    }
  }
  for (const { id, requiredPieces } of sets) {
    if (new Set(requiredPieces).size !== requiredPieces.length) throw new Error(`${id}: duplicate required set piece`);
    const pieces = piecesBySet.get(id)!;
    const missing = requiredPieces.filter(piece => !pieces.has(piece));
    if (missing.length) throw new Error(`${id}: missing required set pieces: ${missing.join(", ")}`);
  }
  return { objects, groups: groups.sort((a, b) => a.order - b.order), setsById };
}

const loaded = parseBeodeulObjectCatalog(catalog, manifest);
export const BEODEUL_PLACEABLE_OBJECTS: readonly BeodeulPlaceableObject[] = loaded.objects;
export const BEODEUL_OBJECT_GROUPS: readonly BeodeulObjectGroup[] = loaded.groups;
const byGroupId = new Map(BEODEUL_OBJECT_GROUPS.map(group => [group.id, group]));
const textureKey = (id: string) => `tex_beodeul_object_${id}`;
const byTexture = new Map(BEODEUL_PLACEABLE_OBJECTS.map(object => [textureKey(object.id), object]));
const byKitId = new Map(BEODEUL_PLACEABLE_OBJECTS.map(object => [BEODEUL_OBJECT_KIT_PREFIX + object.id, object]));

export const BEODEUL_OBJECT_IMAGE_ASSETS = BEODEUL_PLACEABLE_OBJECTS.map(object => ({
  textureKey: textureKey(object.id),
  path: `assets/beodeul-objects/${object.id}.png`,
  name: object.nameKo,
}));

export function beodeulPlaceableObjectForTexture(key: string): BeodeulPlaceableObject | undefined {
  return byTexture.get(key);
}

export function beodeulPlaceableObjectForKit(id: string): BeodeulPlaceableObject | undefined {
  return byKitId.get(id);
}

export function beodeulObjectGroup(id: string): BeodeulObjectGroup | undefined {
  return byGroupId.get(id);
}

export function beodeulObjectSetRole(setId: string) {
  return loaded.setsById.get(setId)?.role;
}
