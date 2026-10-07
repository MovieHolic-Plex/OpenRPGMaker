// 공용 오브젝트 찍기(stamp_object)와 공용 목록 한 줄 읽기(get_spatial_design 의 공용 id 분기).
// 목록은 sharedDesignCatalog.ts(공용 오브젝트 카탈로그 + 프로젝트 킷). 장소 안 킷은 그 장소 원본을 prepare 에서 불러 온다.
import { isRetiredInteriorTileset, retiredInteriorMessage } from "@/project/retiredInteriorTilesets";
import { regionReferenceScene, preloadRegionReferenceScene, type RegionReferenceScene } from "@/project/regionReferenceImport";
import { installStampAssets, stampPattern, type StampPattern } from "@/project/objectStamp";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import { catalogEntry, resolveObjectAlias, sharedObjectDef, sharedObjects, sharedPlaces } from "./sharedDesignCatalog";
import { rejectSettlementPropOnRoute } from "./routePropPolicy";
import { ToolError, type ToolDefinition } from "./types";

type Layers = "both" | "lower" | "upper";
type Resolved = { name: string; source: TilesetDef; pattern: StampPattern; assets: Project["assets"]["uploaded"]; defaultLayers: Layers; entrances?: StructureKitDef["parts"] };

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
  const def = typeof objectId === "string" ? sharedObjectDef(objectId) : undefined;
  return def?.source.kind === "place-kit" ? preloadRegionReferenceScene(def.source.referenceId).then(() => undefined) : Promise.resolve();
}

function resolveObject(project: Project, requestedId: string): Resolved {
  const objectId = resolveObjectAlias(requestedId);
  const def = sharedObjectDef(objectId);
  if (def) {
    if (def.source.kind === "place-kit") {
      const { referenceId, kitId } = def.source;
      const scene = sceneOf(referenceId);
      const kit = scene.tileset.structureKits?.find(candidate => candidate.id === kitId) ?? fail(`${referenceId} 원본에 킷 ${kitId} 가 없습니다`);
      return { name: def.name, source: scene.tileset, pattern: kitPattern(kit), assets: scene.assets, defaultLayers: def.defaultLayers };
    }
    const source = project.tilesets[def.source.tilesetId] ?? fail(`타일셋 ${def.source.tilesetId} 이 프로젝트에 없습니다`);
    return { name: def.name, source, assets: {}, defaultLayers: def.defaultLayers,
      pattern: { width: def.width, height: def.height, lower: def.lower ?? [], upper: def.upper ?? [] } };
  }
  const prefix = objectId.slice(0, objectId.indexOf(":")), rest = objectId.slice(objectId.indexOf(":") + 1);
  if (prefix === "kit" || prefix === "group") {
    const slash = rest.indexOf("/");
    const tilesetId = rest.slice(0, slash), innerId = rest.slice(slash + 1);
    const source = project.tilesets[tilesetId] ?? fail(`타일셋 ${tilesetId} 이 프로젝트에 없습니다`);
    if (prefix === "kit") {
      const kit = source.structureKits?.find(entry => entry.id === innerId) ?? fail(`${tilesetId} 에 킷 ${innerId} 가 없습니다`);
      return { name: kit.name ?? kit.id, source, pattern: kitPattern(kit), assets: {}, defaultLayers: "both",
        entrances: kit.parts?.filter(part => part.kind === "entrance") };
    }
    const group = source.tileGroups?.find(entry => entry.id === innerId) ?? fail(`${tilesetId} 에 타일 그룹 ${innerId} 이 없습니다`);
    const preview = group.previewMap ?? fail(`타일 그룹 ${innerId} 에는 도안(previewMap)이 없습니다`);
    return { name: group.name, source, pattern: { width: preview.width, height: preview.height, lower: preview.lowerTiles, upper: preview.upperTiles }, assets: {}, defaultLayers: "both" };
  }
  return fail(`공용 오브젝트 id 가 아닙니다: ${requestedId} — list_spatial_designs({kind:'object'}) 의 data.shared.rows[].id 를 쓰세요`);
}

const rowsOf = (pattern: StampPattern, layer: readonly number[]) =>
  Array.from({ length: pattern.height }, (_, y) => layer.slice(y * pattern.width, (y + 1) * pattern.width));

/** get_spatial_design for a shared row: the row, plus cells when the source is loaded (or bundled). */
export function sharedDesignDetail(project: Project, id: string) {
  const place = sharedPlaces().find(entry => entry.id === id);
  if (place) return { summary: `공용 장소 ${place.name}`, data: { shared: true, design: place,
    next: `import_region_reference({id:'${id}'}) 로 새 맵에 넣는다${place.source === "registered" ? " · 칸 배열은 read_region_reference" : ""}` } };
  const def = sharedObjectDef(id);
  const object = def ? catalogEntry(def) : sharedObjects(project).find(entry => entry.id === id);
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
    description: "Stamp one shared object (list_spatial_designs kind:object → data.shared.rows[].id: obj:… from the shared object catalog — leafless trees, volcano peaks, climate terrain pieces, harbor parts, gatehouse, house exteriors, village props — or kit:/group: for this project's other kits) onto a map with its top-left at (x, y). Works without spatial activation. The object keeps its authored cells; when the map's tileset shows other pictures at those numbers the pictures are grafted onto the map's tileset (same tile size only) and renumbered, so place kits such as generated building exteriors, the gatehouse or harbor boats can go onto a forest village map. -1 cells leave the map as it is. layers: both (default for kits/houses), upper (default for harbor parts and volcano peaks — keeps the water/ground below) or lower. obj:house/<form> rows stamp only the exterior; use author_house for doors and interiors. Overflow past the map edge is clipped and reported. Each row carries owner (where it belongs — next to what) and passage; follow owner.",
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
      rejectSettlementPropOnRoute(map, objectId);
      const resolved = resolveObject(project, objectId);
      if (isRetiredInteriorTileset(resolved.source.id, resolved.source)) throw new ToolError(retiredInteriorMessage(resolved.source.id), { code: "retired-interior-tileset" });
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
      // 입구 부위가 있는 킷(특수 건물 등)은 맵 좌표 입구를 돌려준다 — 길을 입구 바로 아래 칸에서 끝내고 이벤트를 입구 칸에 둔다.
      const entrances = (resolved.entrances ?? []).map(part => ({ x: Number(args.x) + part.dx, y: Number(args.y) + part.dy + part.h - 1, note: part.note ?? "" }));
      const entranceText = entrances.length
        ? ` · 입구 ${entrances.map(e => `(${e.x},${e.y})`).join(" ")} — 이벤트는 입구 칸, 길은 입구 바로 아래 칸 ${entrances.map(e => `(${e.x},${e.y + 1})`).join(" ")} 에서 끝낸다`
        : "";
      return { summary: `「${resolved.name}」 → ${map.id} (${result.rect.x},${result.rect.y}) ${result.rect.width}×${result.rect.height} · ${result.cells}칸${entranceText}`,
        data: { objectId, mapId: map.id, layers, ...result, ...(entrances.length ? { entrances } : {}) }, ...(warnings.length ? { warnings } : {}) };
    },
  },
];
