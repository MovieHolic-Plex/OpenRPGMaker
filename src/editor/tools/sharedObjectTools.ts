// 공용 오브젝트 찍기(stamp_object)와 공용 목록 한 줄 읽기(get_spatial_design 의 공용 id 분기).
// 목록은 sharedDesignCatalog.ts(공용 오브젝트 카탈로그 + 프로젝트 킷). 장소 안 킷은 그 장소 원본을 prepare 에서 불러 온다.
import { isPassable } from "@/project/collision";
import { checkKitPlacement, checkReliefPlacement } from "@/project/kitPlacementRules";
import { footprintFromUpper, footprintRefusal } from "@/project/objectFootprint";
import { isRetiredInteriorTileset, retiredInteriorMessage } from "@/project/retiredInteriorTilesets";
import { regionReferenceScene, preloadRegionReferenceScene, type RegionReferenceScene } from "@/project/regionReferenceImport";
import { installStampAssets, stampPattern, type StampPattern } from "@/project/objectStamp";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import { catalogEntry, resolveObjectAlias, sharedObjectDef, sharedObjects, sharedPlaces } from "./sharedDesignCatalog";
import { rejectSettlementPropOnRoute } from "./routePropPolicy";
import { rejectOnSceneStage } from "./sceneStageGuard";
import { ToolError, type ToolDefinition } from "./types";

type Layers = "both" | "lower" | "upper";
type Resolved = { name: string; source: TilesetDef; pattern: StampPattern; assets: Project["assets"]["uploaded"]; defaultLayers: Layers; entrances?: StructureKitDef["parts"]; kit?: StructureKitDef };

/** 서는 소품 킷인가 — 발자국 검사 대상. 건물(입구)·지형·다리·벽 걸이·물 위 부품은 제외(그들은 놓기 규칙·받침 규칙이 본다). */
function isStandingPropKit(kit: StructureKitDef, pattern: StampPattern): boolean {
  if (kit.width > 8 || kit.height > 8) return false;
  if ((kit.parts ?? []).some((part) => part.kind === "entrance")) return false;
  if (pattern.lower.some((tile) => tile >= 0)) return false; // 제 바닥을 가져오는 킷(지형 조각·건물)은 아니다
  if (!pattern.upper.some((tile) => tile >= 0)) return false;
  const role = (kit.ai as { role?: string } | undefined)?.role;
  if (role && role !== "prop") return false;
  const label = `${kit.id} ${kit.name ?? ""} ${(kit.ai?.tags ?? []).join(" ")}`;
  return !/\bbridge\b|다리|wall|벽 걸이|벽걸이|벽면|torch|횃불|banner|현수막|sign-wall|창문|window|door|문짝|boat|나룻배|돛단배|어선|pier|부두|water|물 위|shadow|그림자|decal|wallmount|overhead/iu.test(label);
}

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
  const normalizedId = !objectId.includes(":") && objectId.startsWith("mc-") ? `kit:modern_city/${objectId}` : objectId;
  const prefix = normalizedId.slice(0, normalizedId.indexOf(":")), rest = normalizedId.slice(normalizedId.indexOf(":") + 1);
  if (prefix === "kit" || prefix === "group") {
    const slash = rest.indexOf("/");
    const tilesetId = rest.slice(0, slash), innerId = rest.slice(slash + 1);
    const source = project.tilesets[tilesetId] ?? fail(`타일셋 ${tilesetId} 이 프로젝트에 없습니다`);
    if (prefix === "kit") {
      const kit = source.structureKits?.find(entry => entry.id === innerId) ?? fail(`${tilesetId} 에 킷 ${innerId} 가 없습니다`);
      return { name: kit.name ?? kit.id, source, pattern: kitPattern(kit), assets: {}, defaultLayers: "both",
        entrances: kit.parts?.filter(part => part.kind === "entrance"), kit };
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
    description: "Stamp one shared object (list_spatial_designs kind:object → data.shared.rows[].id: obj:… from the shared object catalog — leafless trees, volcano peaks, climate terrain pieces, harbor parts, gatehouse, house exteriors, village props — or kit:/group: for this project's other kits) onto a map with its top-left at (x, y). Works without spatial activation. The object keeps its authored cells; when the map's tileset shows other pictures at those numbers the pictures are grafted onto the map's tileset (same tile size only) and renumbered, so place kits such as generated building exteriors, the gatehouse or harbor boats can go onto a forest village map. -1 cells leave the map as it is. layers: both (default for kits/houses), upper (default for harbor parts and volcano peaks — keeps the water/ground below) or lower. obj:house/<form> rows stamp only the exterior; use author_house for doors and interiors. Overflow past the map edge is clipped and reported. Each row carries owner (where it belongs — next to what) and passage; follow owner. On maps with height steps (relief) the drawn cells must sit on one level, off ramp/stair cells, and not right north of higher ground (it hides the bottom row); a rejection names the levels and a nearby top-left on each level. Ground paint, shadows and bridges are exempt. A standing prop kit (kit:…, no ground cells) is refused when its feet (blocking cells, or its bottom row) land on a wall, ceiling, roof, void, water or a blocked structure, or when any drawn cell overlaps another object; the refusal names the nearest free floor top-left — retry there.",
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
      rejectOnSceneStage(map, { x: Number(args.x), y: Number(args.y), w: resolved.pattern.width, h: resolved.pattern.height }, "stamp_object");
      if (isRetiredInteriorTileset(resolved.source.id, resolved.source)) throw new ToolError(retiredInteriorMessage(resolved.source.id), { code: "retired-interior-tileset" });
      const layers = (args.layers as Layers | undefined) ?? resolved.defaultLayers;
      const blank = new Array(resolved.pattern.width * resolved.pattern.height).fill(-1);
      const pattern: StampPattern = { ...resolved.pattern,
        lower: layers === "upper" ? blank : resolved.pattern.lower, upper: layers === "lower" ? blank : resolved.pattern.upper };
      // 놓기 규칙(물레방아는 물가에 걸쳐, 배는 물 위에, 건물은 뭍에 …) — 어기면 찍지 않는다(project/kitPlacementRules.ts).
      const kitDef = "kit" in resolved ? resolved.kit : undefined;
      const mapTileset = project.tilesets[map.tilesetId];
      if (kitDef && mapTileset) {
        const broken = checkKitPlacement(map, mapTileset, kitDef.id, kitDef, Number(args.x), Number(args.y));
        if (broken) throw new ToolError(broken, { code: "kit-placement-rule", mapId: map.id });
      }
      // 발자국(project/objectFootprint.ts, 2026-10-21): 소품 킷(kit: 서는 물건, 8×8 이하, 아래층 그림 없음)의 발이 벽·천장·허공·물 위거나
      // 다른 물체와 겹치면 거부하고 가까운 빈 바닥을 알려 준다. 실측: 2×4 혼천의를 서재 두 방 사이 벽·천장 위에 찍었다(objectgen VQA FAIL).
      const footprintChecked = !!kitDef && isStandingPropKit(kitDef, pattern) && layers !== "lower";
      if (footprintChecked) {
        const cells = footprintFromUpper(pattern.width, pattern.height, pattern.upper, resolved.source);
        const refusal = footprintRefusal(project, map, cells, Number(args.x), Number(args.y), `「${resolved.name}」(${objectId}) ${pattern.width}×${pattern.height}`);
        if (refusal) throw new ToolError(refusal.message, { code: refusal.code, mapId: map.id, ...(refusal.suggestion ? refusal.suggestion.at : {}) });
      }
      // 높이 단(map.relief): 그림은 한 단 위에만, 경사로 칸 금지, 남쪽 높은 칸이 아랫줄을 덮지 않게. relief 없는 맵은 그대로.
      const reliefBroken = checkReliefPlacement(map, resolved.source, objectId, resolved.name, pattern, Number(args.x), Number(args.y));
      if (reliefBroken) throw new ToolError(reliefBroken, { code: "relief-placement-rule", mapId: map.id });
      installStampAssets(project, resolved.assets);
      let result;
      try { result = stampPattern(project, map, resolved.source, pattern, Number(args.x), Number(args.y)); }
      catch (error) { return fail(error instanceof Error ? error.message : String(error)); }
      let startNote: string | null = null;
      if (project.startMapId === map.id && project.startPos && !isPassable(project, map, project.startPos.x, project.startPos.y)) {
        const s = project.startPos;
        outer: for (let r = 1; r < Math.max(map.width, map.height); r++) {
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const nx = s.x + dx, ny = s.y + dy;
            if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || !isPassable(project, map, nx, ny)) continue;
            project.startPos = { ...s, x: nx, y: ny };
            startNote = `시작 위치 (${s.x},${s.y}) 가 기물에 덮여 가장 가까운 통행 칸 (${nx},${ny}) 로 옮겼다`;
            break outer;
          }
        }
      }
      const warnings = [
        ...(startNote ? [startNote] : []),
        ...(result.clipped ? [`맵 밖으로 나간 칸은 뺐다 — 찍힌 범위 ${JSON.stringify(result.rect)}`] : []),
        // 2026-10-07 적대적 검토: 모델이 꽃 상자를 가로수 수관 위에 찍어 소품이 나무 잎에 얹혀 보였다. 덮인 칸을 되돌려 알린다.
        // 발자국 검사를 통과한 소품이 덮은 위층 칸은 바닥 덧그림(접지 그림자·노면 표시)뿐이다 — 물체 겹침이 아니다.
        ...(result.coveredUpper.length && footprintChecked ? [`바닥 덧그림(그림자·노면 표시) ${result.coveredUpper.length}칸 위에 세웠다 — 그 칸의 덧그림은 소품 그림으로 바뀌었다`] : []),
        ...(result.coveredUpper.length && !footprintChecked ? [`이미 다른 위층 그림(나무 수관·지붕 등)이 있던 ${result.coveredUpper.length}칸을 덮었다 — ${result.coveredUpper.slice(0, 6).map(c => `(${c.x},${c.y})`).join(" ")}. 소품이 그 위에 얹혀 보이면 빈 풀밭·바닥 칸으로 옮겨 다시 찍는다`] : []),
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
