// 공용 오브젝트 찍기(stamp_object)와 공용 목록 한 줄 읽기(get_spatial_design 의 공용 id 분기).
// 목록은 sharedDesignCatalog.ts. 장소 안 킷·장소 조각은 그 장소 원본을 prepare 에서 불러 온다.
import { regionReferenceScene, preloadRegionReferenceScene, type RegionReferenceScene } from "@/project/regionReferenceImport";
import { installStampAssets, stampPattern, type StampPattern } from "@/project/objectStamp";
import { AUTHORED_HOUSE_FORM_DEFS } from "@/project/defaults/authoredHouseFormCatalog";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import { PATTERNS, PLACE_KITS, PLACE_PARTS, sharedObjects, sharedPlaces } from "./sharedDesignCatalog";
import { ToolError, type ToolDefinition } from "./types";

type Layers = "both" | "lower" | "upper";
type Resolved = { name: string; source: TilesetDef; pattern: StampPattern; assets: Project["assets"]["uploaded"]; defaultLayers: Layers };

const fail = (message: string): never => { throw new ToolError(message, { code: "invalid-args" }); };

function kitPattern(kit: StructureKitDef): StampPattern {
  return { width: kit.width, height: kit.height,
    lower: kit.rows.flatMap(row => [...row.tiles]),
    upper: kit.rows.flatMap(row => [...(row.upperTiles ?? new Array(kit.width).fill(-1))]) };
}

function sceneOf(referenceId: string): RegionReferenceScene {
  try { return regionReferenceScene(referenceId); }
  catch (error) { return fail(error instanceof Error ? error.message : String(error)); }
}

/** get_spatial_design / stamp_object prepare: load the place a shared object is cut from. */
export function prepareSharedObject(objectId: unknown): Promise<void> {
  const referenceId = typeof objectId === "string" ? objectReference(objectId) : undefined;
  return referenceId ? preloadRegionReferenceScene(referenceId).then(() => undefined) : Promise.resolve();
}

/** Which place an object id must load before it can be resolved (prepare). */
function objectReference(objectId: string): string | undefined {
  return PLACE_KITS.find(kit => kit.id === objectId)?.referenceId ?? PLACE_PARTS.find(part => part.id === objectId)?.referenceId;
}

function resolveObject(project: Project, objectId: string): Resolved {
  const [prefix, rest = ""] = [objectId.slice(0, objectId.indexOf(":")), objectId.slice(objectId.indexOf(":") + 1)];
  if (prefix === "kit" || prefix === "group") {
    const slash = rest.indexOf("/");
    const tilesetId = rest.slice(0, slash), innerId = rest.slice(slash + 1);
    const source = project.tilesets[tilesetId] ?? fail(`타일셋 ${tilesetId} 이 프로젝트에 없습니다`);
    if (prefix === "kit") {
      const kit = source.structureKits?.find(entry => entry.id === innerId) ?? fail(`${tilesetId} 에 킷 ${innerId} 가 없습니다`);
      return { name: kit.name ?? kit.id, source, pattern: kitPattern(kit), assets: {}, defaultLayers: "both" };
    }
    const group = source.tileGroups?.find(entry => entry.id === innerId) ?? fail(`${tilesetId} 에 타일 그룹 ${innerId} 이 없습니다`);
    const preview = group.previewMap ?? fail(`타일 그룹 ${innerId} 에는 도안(previewMap)이 없습니다`);
    return { name: group.name, source, pattern: { width: preview.width, height: preview.height, lower: preview.lowerTiles, upper: preview.upperTiles }, assets: {}, defaultLayers: "both" };
  }
  if (prefix === "refkit") {
    const entry = PLACE_KITS.find(kit => kit.id === objectId) ?? fail(`공용 목록에 없는 장소 킷: ${objectId}`);
    const scene = sceneOf(entry.referenceId);
    const kit = scene.tileset.structureKits?.find(candidate => candidate.id === entry.kitId) ?? fail(`${entry.referenceId} 원본에 킷 ${entry.kitId} 가 없습니다`);
    return { name: entry.name, source: scene.tileset, pattern: kitPattern(kit), assets: scene.assets, defaultLayers: "both" };
  }
  if (prefix === "part") {
    const part = PLACE_PARTS.find(candidate => candidate.id === objectId) ?? fail(`공용 목록에 없는 장소 조각: ${objectId}`);
    const scene = sceneOf(part.referenceId);
    const { x, y, width, height } = part.rect;
    const lower: number[] = [], upper: number[] = [];
    for (let py = 0; py < height; py += 1) for (let px = 0; px < width; px += 1) {
      const at = (y + py) * scene.map.width + x + px;
      lower.push(scene.map.lowerTiles[at] ?? -1);
      upper.push(scene.map.upperTiles[at] ?? -1);
    }
    return { name: part.name, source: scene.tileset, pattern: { width, height, lower, upper }, assets: scene.assets, defaultLayers: part.layers };
  }
  if (prefix === "pattern") {
    const pattern = PATTERNS.find(candidate => candidate.id === objectId) ?? fail(`공용 목록에 없는 무늬: ${objectId}`);
    const source = project.tilesets[pattern.tilesetId] ?? fail(`타일셋 ${pattern.tilesetId} 이 프로젝트에 없습니다`);
    return { name: pattern.name, source, assets: {}, defaultLayers: pattern.lower ? "both" : "upper",
      pattern: { width: pattern.width, height: pattern.height, upper: pattern.upper, lower: pattern.lower ?? new Array(pattern.upper.length).fill(-1) } };
  }
  if (prefix === "house") {
    const form = AUTHORED_HOUSE_FORM_DEFS.find(candidate => candidate.id === rest) ?? fail(`저작 집 형태가 없습니다: ${rest}`);
    const source = project.tilesets[DEFAULT_TILESET_ID] ?? fail(`타일셋 ${DEFAULT_TILESET_ID} 이 프로젝트에 없습니다`);
    return { name: form.name, source, assets: {}, defaultLayers: "both", pattern: { width: form.w, height: form.h,
      lower: form.rows.flatMap(row => [...row.tiles]), upper: form.rows.flatMap(row => [...(row.upperTiles ?? new Array(form.w).fill(-1))]) } };
  }
  return fail(`공용 오브젝트 id 가 아닙니다: ${objectId} — list_spatial_designs({kind:'object'}) 의 data.shared.rows[].id 를 쓰세요`);
}

const rowsOf = (pattern: StampPattern, layer: readonly number[]) =>
  Array.from({ length: pattern.height }, (_, y) => layer.slice(y * pattern.width, (y + 1) * pattern.width));

/** get_spatial_design for a shared row: the row, plus cells when the source is loaded (or bundled). */
export function sharedDesignDetail(project: Project, id: string) {
  const place = sharedPlaces().find(entry => entry.id === id);
  if (place) return { summary: `공용 장소 ${place.name}`, data: { shared: true, design: place,
    next: `import_region_reference({id:'${id}'}) 로 새 맵에 넣는다${place.source === "registered" ? " · 칸 배열은 read_region_reference" : ""}` } };
  const object = sharedObjects(project).find(entry => entry.id === id);
  if (!object) throw new ToolError(`공용 목록에 없는 id: ${id}`, { code: "invalid-args" });
  let cells: Record<string, unknown> | { pending: string } | undefined;
  try {
    const resolved = resolveObject(project, id);
    cells = { sourceTilesetId: resolved.source.id, width: resolved.pattern.width, height: resolved.pattern.height,
      lowerRows: rowsOf(resolved.pattern, resolved.pattern.lower), upperRows: rowsOf(resolved.pattern, resolved.pattern.upper), defaultLayers: resolved.defaultLayers };
  } catch (error) {
    cells = { pending: error instanceof Error ? error.message : String(error) };
  }
  return { summary: `공용 오브젝트 ${object.name} ${object.width}×${object.height}`, data: { shared: true, design: object, cells,
    next: object.use } };
}

export const SHARED_OBJECT_TOOLS: readonly ToolDefinition[] = [
  { name: "stamp_object", mode: "write", domains: ["map"],
    description: "Stamp one shared object (list_spatial_designs kind:object → data.shared.rows[].id: kit:, group:, refkit:, part:, pattern:, house:) onto a map with its top-left at (x, y). Works without spatial activation. The object keeps its authored cells; when the map's tileset shows other pictures at those numbers the pictures are grafted onto the map's tileset (same tile size only) and renumbered, so place kits such as generated building exteriors, the gatehouse or harbor boats can go onto a forest village map. -1 cells leave the map as it is. layers: both (default for kits/houses), upper (default for harbor parts and volcano peaks — keeps the water/ground below) or lower. house: rows stamp only the exterior; use author_house for doors and interiors. Overflow past the map edge is clipped and reported.",
    parameters: { type: "object", properties: {
      objectId: { type: "string", description: "list_spatial_designs(kind:'object') 의 data.shared.rows[].id" },
      mapId: { type: "string" },
      x: { type: "integer", description: "왼쪽 위 칸 x" }, y: { type: "integer", description: "왼쪽 위 칸 y" },
      layers: { type: "string", enum: ["both", "lower", "upper"], description: "찍을 층. 생략하면 오브젝트 기본값" },
    }, required: ["objectId", "mapId", "x", "y"], additionalProperties: false },
    prepare: args => prepareSharedObject(args.objectId),
    preservesAuthoredRaster: true,
    run(project, args) {
      const objectId = String(args.objectId);
      const map = project.maps[String(args.mapId)] ?? fail(`맵을 찾을 수 없습니다: ${String(args.mapId)}`);
      const resolved = resolveObject(project, objectId);
      const layers = (args.layers as Layers | undefined) ?? resolved.defaultLayers;
      const blank = new Array(resolved.pattern.width * resolved.pattern.height).fill(-1);
      const pattern: StampPattern = { ...resolved.pattern,
        lower: layers === "upper" ? blank : resolved.pattern.lower, upper: layers === "lower" ? blank : resolved.pattern.upper };
      installStampAssets(project, resolved.assets);
      let result;
      try { result = stampPattern(project, map, resolved.source, pattern, Number(args.x), Number(args.y)); }
      catch (error) { return fail(error instanceof Error ? error.message : String(error)); }
      const warnings = [
        ...(result.clipped ? [`맵 밖으로 나간 칸은 뺐다 — 찍힌 범위 ${JSON.stringify(result.rect)}`] : []),
        ...(result.slotsAdded > 0 ? [`${map.tilesetId} 에 그림 ${result.slotsAdded}칸을 이식해 붙였다(${resolved.source.id} 그림)`] : []),
      ];
      return { summary: `「${resolved.name}」 → ${map.id} (${result.rect.x},${result.rect.y}) ${result.rect.width}×${result.rect.height} · ${result.cells}칸`,
        data: { objectId, mapId: map.id, layers, ...result }, ...(warnings.length ? { warnings } : {}) };
    },
  },
];
