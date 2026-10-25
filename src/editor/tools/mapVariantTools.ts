// editor/tools/mapVariantTools.ts
// derive_map_variant — 「같은 지리의 다른 시대」. 맵 하나를 복제해 시대별 변형을 만들고, 복제본마다 시대별 덮어쓰기를 적용한다.
//
// 복제 자체는 duplicate_map 과 같은 경로(cloneMapIntoProject)다 — 같은 맵 안 이벤트 참조(moveEvent·callMapEvent·
// showAnimation …)는 복제본 id 로 다시 이어진다(2026-10-15 CT 감사에서 끊긴 채 복제되던 버그를 같이 고쳤다).
// 이 도구가 더하는 것: ① 시간문 쌍 재결합 — 복제본의 시간문은 원본 파트너를 가리키므로 떼어 내고 `gates` 로 새로 잇는다.
// ② 시대별 타일 덮어쓰기(tileRemap·tileOverrides)와 이벤트 제거 ③ 변형이 어긋난 뒤 영역만 다시 맞추는 resync
// ④ 문 → 실내 맵의 돌아오는 문이 원본 마을로 가는 것을 relinkDoors 로 변형 마을로 돌린다.
// 시대 개념(era id)을 맵 데이터에 새로 넣지 않는다 — era 는 이름 접미와 결과 보고용 라벨이다.

import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { MAP_TOOLS, cloneMapIntoProject } from "./mapTools";
import { applyVariantLook, KEEP_INTACT_SIDES, parseKeepIntact, resolveVariantLook, VARIANT_LOOKS, type VariantLookReport } from "./mapVariantLook";
import { TIME_GATE_TOOLS } from "./timeGateTools";
import { requireMap } from "./mapHelpers";
import { COORD_SCHEMA, RECT_SCHEMA } from "./schemaShapes";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { assertMapIdAvailable } from "./mapHelpers";

const VARIANT_KEYS = ["id", "name", "era", "look", "keepIntact", "tilesetId", "tileRemap", "tileOverrides", "removeEvents"] as const;
const OVERRIDE_KEYS = ["layer", "rect", "cells", "tile"] as const;
const REMAP_KEYS = ["from", "to"] as const;
const RESYNC_KEYS = ["variantId", "sourceMapId", "rects", "layers", "tileRemap", "tileOverrides"] as const;
const GATE_KEYS = ["a", "b", "name", "effect", "unlockWhen", "lockedMessage", "lockSide", "graphic"] as const;

function rejectUnknownKeys(value: unknown, allowed: readonly string[], path: string, hints: Readonly<Record<string, string>> = {}): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ToolError(`${path} 는 객체여야 합니다.`, { code: "invalid-args" });
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  const detail = unknown.map((key) => hints[key] ? `${key}→${hints[key]}` : key).join(", ");
  throw new ToolError(`${path} 에 알 수 없는 키: ${detail} — 허용: ${allowed.join(", ")}. 모르는 키는 저장되지 않고 사라져 시대 변형이 의도와 달라진다.`, { code: "invalid-args" });
}

const VARIANT_HINTS: Readonly<Record<string, string>> = {
  mapId: "id", newId: "id", title: "name", label: "era", tile_overrides: "tileOverrides", overrides: "tileOverrides", remap: "tileRemap",
  removeEvent: "removeEvents", deleteEvents: "removeEvents", tileset: "tilesetId", paint: "tileOverrides",
  keep: "keepIntact", keepBuilding: "keepIntact", intact: "keepIntact", survivor: "keepIntact",
};

type Rect = { x: number; y: number; w: number; h: number };
type TileRemapEntry = { from: number | number[]; to: number };
type TileOverride = { layer: string | number; rect?: Rect; cells?: { x: number; y: number }[]; tile: number };

function isTimeGateEvent(event: GameEvent): boolean {
  return (event.pages ?? []).some((page) => {
    const commands = page.commands ?? [];
    const transferAt = commands.findIndex((command) => command.kind === "transfer" && command.fade === "white");
    return transferAt >= 0 && commands.slice(0, transferAt).some((command) => command.kind === "m2Command");
  });
}

function transfersOf(event: GameEvent): Extract<Command, { kind: "transfer" }>[] {
  const found: Extract<Command, { kind: "transfer" }>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.kind === "transfer") found.push(record as Extract<Command, { kind: "transfer" }>);
    Object.values(record).forEach(visit);
  };
  visit(event.pages ?? []);
  visit(event.commands ?? []);
  return found;
}

/**
 * 조명 없는 맵은 들어오기 전 맵의 조명을 이어 받는다(lightingRules.applyMapDefaultLighting). 변형에 시대 조명(폐허 0.52 등)을
 * 입히면 원본 마을과 그 문 너머 맵들이 시대 조명을 이어 받아 원래 시대도 잿빛이 된다 — jrpg-loop-4 R6 ff2(폐허 시작)에서
 * 붕괴 전 왕도까지 갈색으로 덮였다. 원본·변형과 그 문이 가는 맵 중 조명 없는 맵에 밝은 조명(ambient 0)을 박는다.
 */
function pinNeutralLighting(draft: Project, source: GameMap, variantIds: readonly string[]): string[] {
  const lit = variantIds.some((id) => draft.maps[id]?.defaultLighting);
  if (!lit) return [];
  const targets = new Set<string>([source.id, ...variantIds]);
  for (const id of [source.id, ...variantIds]) {
    for (const event of draft.maps[id]?.events ?? []) for (const transfer of transfersOf(event)) targets.add(transfer.mapId);
  }
  const pinned: string[] = [];
  for (const id of targets) {
    const map = draft.maps[id];
    if (!map || map.defaultLighting) continue;
    map.defaultLighting = { ambient: 0, sources: [] };
    pinned.push(id);
  }
  return pinned;
}

function remapTiles(map: GameMap, remap: readonly TileRemapEntry[]): number {
  if (remap.length === 0) return 0;
  const table = new Map<number, number>();
  for (const entry of remap) for (const from of Array.isArray(entry.from) ? entry.from : [entry.from]) table.set(from, entry.to);
  let changed = 0;
  const apply = (tiles: number[] | undefined): void => {
    if (!tiles) return;
    for (let index = 0; index < tiles.length; index += 1) {
      const next = table.get(tiles[index]!);
      if (next !== undefined) { tiles[index] = next; changed += 1; }
    }
  };
  apply(map.lowerTiles);
  apply(map.upperTiles);
  apply(map.lowerOverlayTiles);
  apply(map.upperOverlayTiles);
  return changed;
}

function applyTileOverrides(draft: Project, mapId: string, overrides: readonly TileOverride[], label: string): { cells: number; warnings: string[] } {
  const paint = MAP_TOOLS.find((tool) => tool.name === "paint_tiles");
  if (!paint) throw new ToolError("paint_tiles 도구를 찾지 못했습니다.", { code: "map-variant-paint-missing" });
  let cells = 0;
  const warnings: string[] = [];
  overrides.forEach((override, index) => {
    rejectUnknownKeys(override, OVERRIDE_KEYS, `${label}.tileOverrides[${index}]`, { tileId: "tile", x: "rect:{x,y,w,h}", at: "rect 또는 cells" });
    if (!override.rect === !override.cells) {
      throw new ToolError(`${label}.tileOverrides[${index}] 는 rect({x,y,w,h}) 와 cells([{x,y}]) 중 정확히 하나가 필요합니다.`, { code: "invalid-args" });
    }
    if (override.rect) rejectUnknownKeys(override.rect, ["x", "y", "w", "h"], `${label}.tileOverrides[${index}].rect`);
    const args: Record<string, unknown> = override.rect
      ? { mapId, layer: String(override.layer), mode: "rect", tile: override.tile, from: { x: override.rect.x, y: override.rect.y }, to: { x: override.rect.x + override.rect.w - 1, y: override.rect.y + override.rect.h - 1 } }
      : { mapId, layer: String(override.layer), mode: "cells", tile: override.tile, cells: override.cells };
    const result = paint.run(draft, args);
    cells += (result.data as { tilesTouched?: number } | undefined)?.tilesTouched ?? 0;
    for (const warning of result.warnings ?? []) warnings.push(`${label}.tileOverrides[${index}]: ${warning}`);
  });
  return { cells, warnings };
}

function resolveSourceEvent(source: GameMap, ref: string): GameEvent | undefined {
  return source.events.find((event) => event.id === ref) ?? source.events.find((event) => event.name === ref);
}

type VariantReport = {
  mapId: string; name: string; era?: string;
  eventIdMap: Record<string, string>;
  removedEvents: string[];
  removedTimeGates: { sourceEventId: string; name?: string; x: number; y: number; leadsTo: string[] }[];
  relinkedDoors: { variantEventId: string; interiorMapId: string; clonedFrom: string }[];
  tilesRemapped: number; tilesOverridden: number;
  look?: VariantLookReport;
};

function relinkDoors(draft: Project, source: GameMap, variant: GameMap, report: VariantReport, warnings: string[]): void {
  for (const event of variant.events) {
    if (isTimeGateEvent(event)) continue;
    for (const transfer of transfersOf(event)) {
      const targetId = transfer.mapId;
      if (targetId === variant.id || targetId === source.id) continue;
      const target = draft.maps[targetId];
      if (!target) continue;
      const returns = target.events.some((candidate) => transfersOf(candidate).some((back) => back.mapId === source.id));
      if (!returns) continue;
      const cloneId = `${variant.id}__${targetId}`;
      let clone = draft.maps[cloneId];
      if (!clone) {
        clone = cloneMapIntoProject(draft, target, cloneId, `${target.name} (${variant.name})`).copy;
        for (const inner of clone.events) for (const back of transfersOf(inner)) if (back.mapId === source.id) back.mapId = variant.id;
      }
      transfer.mapId = cloneId;
      report.relinkedDoors.push({ variantEventId: event.id, interiorMapId: cloneId, clonedFrom: targetId });
    }
  }
  const stray = variant.events.filter((event) => !isTimeGateEvent(event)).flatMap((event) => transfersOf(event).map((transfer) => ({ event, transfer })))
    .filter(({ transfer }) => transfer.mapId !== variant.id && draft.maps[transfer.mapId]?.events.some((candidate) => transfersOf(candidate).some((back) => back.mapId === source.id)));
  for (const { event, transfer } of stray) warnings.push(`이벤트 ${event.id} 의 문이 ${transfer.mapId} 로 가는데 그 맵의 돌아오는 문은 원본 ${source.id} 로 갑니다.`);
}

function createVariant(draft: Project, source: GameMap, raw: Record<string, unknown>, options: { timeGates: "drop" | "keep"; relink: boolean }, warnings: string[]): VariantReport {
  rejectUnknownKeys(raw, VARIANT_KEYS, `variants[${String(raw.id ?? "?")}]`, VARIANT_HINTS);
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) throw new ToolError("variants[].id(새 맵 id)가 필요합니다.", { code: "invalid-args" });
  assertMapIdAvailable(draft, id);
  const era = typeof raw.era === "string" && raw.era.trim() ? raw.era.trim() : undefined;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : `${source.name} (${era ?? id})`;
  const { copy, eventIdMap } = cloneMapIntoProject(draft, source, id, name);
  const report: VariantReport = {
    mapId: id, name, ...(era ? { era } : {}),
    eventIdMap: Object.fromEntries(eventIdMap), removedEvents: [], removedTimeGates: [], relinkedDoors: [], tilesRemapped: 0, tilesOverridden: 0,
  };
  const label = `variants[${id}]`;

  if (typeof raw.tilesetId === "string" && raw.tilesetId !== source.tilesetId) {
    if (!draft.tilesets[raw.tilesetId]) throw new ToolError(`variants[${id}].tilesetId '${raw.tilesetId}' 가 프로젝트에 없습니다.`, { code: "invalid-args" });
    copy.tilesetId = raw.tilesetId;
    if (!Array.isArray(raw.tileRemap) || raw.tileRemap.length === 0) {
      warnings.push(`${label}: 칩셋을 ${source.tilesetId} → ${raw.tilesetId} 로 바꿨는데 tileRemap 이 없어 타일 번호가 그대로입니다 — 번호는 칩셋마다 다르니 tileRemap([{from,to}]) 이나 tileOverrides 로 다시 칠하세요(tile_query 로 번호 확인).`);
    }
  }
  if (raw.tileRemap !== undefined) {
    if (!Array.isArray(raw.tileRemap)) throw new ToolError(`${label}.tileRemap 은 [{from,to}] 배열이어야 합니다.`, { code: "invalid-args" });
    (raw.tileRemap as unknown[]).forEach((entry, index) => rejectUnknownKeys(entry, REMAP_KEYS, `${label}.tileRemap[${index}]`));
    report.tilesRemapped = remapTiles(copy, raw.tileRemap as TileRemapEntry[]);
  }

  // 시간문은 복제본 안에서 원본 파트너를 가리킨다 — 기본은 떼어 내고 gates 로 새로 잇게 한다.
  if (options.timeGates === "drop") {
    const removedIds = new Set<string>();
    for (const sourceEvent of source.events) {
      if (!isTimeGateEvent(sourceEvent)) continue;
      const variantEventId = eventIdMap.get(sourceEvent.id)!;
      removedIds.add(variantEventId);
      report.removedTimeGates.push({ sourceEventId: sourceEvent.id, ...(sourceEvent.name ? { name: sourceEvent.name } : {}), x: sourceEvent.x, y: sourceEvent.y, leadsTo: [...new Set(transfersOf(sourceEvent).map((transfer) => transfer.mapId))] });
      delete report.eventIdMap[sourceEvent.id];
    }
    copy.events = copy.events.filter((event) => !removedIds.has(event.id));
  } else if (report.removedTimeGates.length === 0 && source.events.some(isTimeGateEvent)) {
    warnings.push(`${label}: 시간문을 그대로 복제했습니다(timeGates:'keep') — 복제본 문이 원본 파트너 맵으로 갑니다. 이 시대를 잇는 문은 gates 로 새로 만드세요.`);
  }

  if (Array.isArray(raw.removeEvents)) {
    for (const ref of raw.removeEvents as unknown[]) {
      const sourceEvent = typeof ref === "string" ? resolveSourceEvent(source, ref) : undefined;
      if (!sourceEvent) throw new ToolError(`${label}.removeEvents: 원본 맵 ${source.id} 에 이벤트 '${String(ref)}' 가 없습니다(id 또는 이름). find_events 로 확인하세요.`, { code: "event-not-found" });
      const variantEventId = eventIdMap.get(sourceEvent.id)!;
      const before = copy.events.length;
      copy.events = copy.events.filter((event) => event.id !== variantEventId);
      if (copy.events.length < before) {
        report.removedEvents.push(sourceEvent.id);
        delete report.eventIdMap[sourceEvent.id];
      }
    }
  }
  if (options.relink) relinkDoors(draft, source, copy, report, warnings);

  // 시대 겉모습 프리셋(조명·안개·건물 철거·폐허 소품) — 조수가 준 tileRemap·tileOverrides 가 이 뒤에 적용돼 항상 이긴다.
  const look = resolveVariantLook({ look: raw.look, era: raw.era, name: raw.name, id });
  if (look !== null && typeof look === "object") throw new ToolError(`${label}: ${look.error}`, { code: "invalid-args" });
  const keepIntact = parseKeepIntact(raw.keepIntact);
  if (keepIntact !== undefined && typeof keepIntact === "object" && "error" in keepIntact) throw new ToolError(`${label}: ${keepIntact.error}`, { code: "invalid-args" });
  if (look !== null) report.look = applyVariantLook(draft, copy, look, warnings, label, keepIntact === undefined ? {} : { keepIntact });
  else if (keepIntact !== undefined) warnings.push(`${label}: look 이 없어(none 이거나 era·name 낱말로 못 골라) 철거가 없으므로 keepIntact 는 쓰이지 않았습니다.`);

  if (raw.tileOverrides !== undefined) {
    if (!Array.isArray(raw.tileOverrides)) throw new ToolError(`${label}.tileOverrides 는 배열이어야 합니다.`, { code: "invalid-args" });
    const applied = applyTileOverrides(draft, id, raw.tileOverrides as TileOverride[], label);
    report.tilesOverridden = applied.cells;
    warnings.push(...applied.warnings);
  }
  return report;
}

function resync(draft: Project, raw: Record<string, unknown>, defaultSourceId: string | undefined, warnings: string[]): { variantId: string; sourceMapId: string; copiedCells: number; overriddenCells: number } {
  rejectUnknownKeys(raw, RESYNC_KEYS, "resync", { variant: "variantId", mapId: "variantId", source: "sourceMapId", rect: "rects", regions: "rects", region: "rects" });
  const variantId = typeof raw.variantId === "string" ? raw.variantId : "";
  const sourceId = typeof raw.sourceMapId === "string" ? raw.sourceMapId : defaultSourceId;
  if (!variantId || !sourceId) throw new ToolError("resync 에는 variantId 와 sourceMapId(또는 최상위 sourceMapId)가 필요합니다.", { code: "invalid-args" });
  requireMap(draft, variantId);
  requireMap(draft, sourceId);
  if (!Array.isArray(raw.rects) || raw.rects.length === 0) throw new ToolError("resync.rects 는 다시 맞출 영역 [{x,y,w,h}] 배열이어야 합니다(맵 전체를 덮으려면 {x:0,y:0,w,h}).", { code: "invalid-args" });
  const copy = MAP_TOOLS.find((tool) => tool.name === "copy_map_region");
  if (!copy) throw new ToolError("copy_map_region 도구를 찾지 못했습니다.", { code: "map-variant-copy-missing" });
  let copiedCells = 0;
  (raw.rects as Rect[]).forEach((rect, index) => {
    rejectUnknownKeys(rect, ["x", "y", "w", "h"], `resync.rects[${index}]`);
    const result = copy.run(draft, {
      from: { mapId: sourceId, ...rect }, to: { mapId: variantId, x: rect.x, y: rect.y },
      layers: typeof raw.layers === "string" ? raw.layers : "all", overExisting: "clear",
    });
    copiedCells += rect.w * rect.h;
    for (const warning of result.warnings ?? []) warnings.push(`resync.rects[${index}]: ${warning}`);
  });
  // 영역을 원본으로 덮으면 그 안의 시대별 덮어쓰기가 사라진다 — 같은 호출에서 다시 적용할 수 있게 한다.
  let tilesRemapped = 0;
  if (Array.isArray(raw.tileRemap)) tilesRemapped = remapTiles(draft.maps[variantId]!, raw.tileRemap as TileRemapEntry[]);
  let overriddenCells = tilesRemapped;
  if (Array.isArray(raw.tileOverrides)) {
    const applied = applyTileOverrides(draft, variantId, raw.tileOverrides as TileOverride[], `resync[${variantId}]`);
    overriddenCells += applied.cells;
    warnings.push(...applied.warnings);
  }
  return { variantId, sourceMapId: sourceId, copiedCells, overriddenCells };
}

const deriveMapVariant: ToolDefinition = {
  name: "derive_map_variant",
  description:
    "「같은 지리의 다른 시대」를 만든다 — 맵 하나를 복제해 시대별 변형 맵을 한 번에 만든다(현대 마을 → 중세 마을 → 미래 마을, 같은 길·같은 건물 자리). "
    + "{sourceMapId, variants:[{id, name?, era?, tilesetId?, look?:ruin|past|future|burned|none, keepIntact?:north|south|east|west|center|\"x,y\", tileRemap?:[{from,to}], tileOverrides?:[{layer,rect|cells,tile}], removeEvents?:[원본 이벤트 id 또는 이름]}], gates?:[create_time_gate 인자…], relinkDoors?, timeGates?} "
    + "복제 규칙: 이벤트 id 는 새로 매겨지고 이벤트끼리의 참조(moveEvent·callMapEvent·showAnimation 등)는 복제본 id 로 다시 이어진다. 결과 data.variants[].eventIdMap 이 원본 id → 변형 id 표라서 이후 patch_event_page·upsert_event 로 변형 이벤트를 고칠 때 쓴다. "
    + "시간문(create_time_gate 가 만든 문)은 복제본에서 원본 파트너를 가리키므로 기본(timeGates:'drop')으로 떼어 내고, 같은 호출의 gates 로 변형끼리 새로 잇는다(gates 의 a/b mapId 에 방금 만든 변형 id 를 쓴다). 'keep' 은 그대로 복제. "
    + "relinkDoors:true 는 집·상점 문이 가는 실내 맵(돌아오는 문이 원본 마을로 가는 것)을 변형 이름으로 복제해 변형 마을로 다시 잇는다. "
    + "시대 겉모습(눈으로 구별되는 변형): 변형마다 look 프리셋이 자동으로 걸린다 — ruin(붕괴·폐허: 어둡고 짙은 안개 + 건물 약 60% 철거 + 돌무더기·부러진 기둥), past(과거: 호박색 햇살 + 건물 일부 철거 + 모닥불·돌탑), future(미래: 청색 조명 + 건물 일부 철거 + 오벨리스크·혼천의), burned(불탄 마을: 집 자리·길은 그대로, 집마다 잿빛 바닥·숯 기둥·내려앉은 서까래·숯더미·불씨로 바꾸고 집터 둘레 풀·나무만 그을림 — 불탄 민가·화재 뒤 마을은 ruin 이 아니라 이것). keepIntact 는 철거에서 건물 한 채를 뺀다(north 북쪽 끝·south·east·west·center 가운데, 또는 \"x,y\" 그 칸의/가장 가까운 건물 — 그 집 문은 남는다, 결과 look.keptIntact). look 을 생략하면 era·name·id 낱말(과거·고대·미래·붕괴·폐허·불탄 …)로 고르고 해당이 없으면 안 건다; \"none\" 으로 끈다. 새 그림 없이 칩셋에 이미 있는 조각만 쓴다(건물 배치 기록이 있는 마을 맵에서만 철거, 아니면 조명·안개만). 결과 data.variants[].look 에 철거·배치 수가 나온다. 그래도 같은 지형으로 보이면 tileRemap·tileOverrides 로 더 바꾼다. "
    + "시대 차이는 tileRemap(전 층 일괄 치환: 기와지붕→폐허 지붕)·tileOverrides(영역·셀 칠하기, layer 1|2|3|4 또는 lower|upper)·removeEvents 로 준다. 칩셋을 바꾸는 변형(tilesetId)은 타일 번호가 칩셋마다 달라 tileRemap 이나 다시 칠하기가 반드시 필요하다. "
    + "변형이 어긋난 뒤 원본 지리를 다시 맞출 때는 resync:{variantId, rects:[{x,y,w,h}], layers?, tileRemap?, tileOverrides?} — 영역을 원본에서 다시 복사하고(copy_map_region) 시대별 덮어쓰기를 다시 적용한다(영역 안 이벤트는 건드리지 않는다). "
    + "알 수 없는 키는 거절한다. 결과 뒤 check_reachability 로 시대별 통행을 확인하고 get_map_region/show_map_region 으로 원본 해상도 그림을 눈으로 확인한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      sourceMapId: { type: "string", description: "복제할 기준 맵(시대의 지리 원본)" },
      variants: {
        type: "array",
        description: "만들 변형들. 각 {id(새 맵 id), name?, era?(라벨: 이름 접미), tilesetId?, tileRemap?, tileOverrides?, removeEvents?}",
        items: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" }, era: { type: "string" }, tilesetId: { type: "string" },
            look: { type: "string", enum: [...VARIANT_LOOKS, "none"], description: "시대 겉모습 프리셋. 생략하면 era·name·id 낱말로 자동 선택, none 이면 끔. burned = 불탄 마을(집 자리·길 유지)" },
            keepIntact: { type: "string", description: `철거하지 않고 멀쩡히 남길 건물 한 채: ${KEEP_INTACT_SIDES.join("|")}(방위 끝 건물·가운데 건물) 또는 "x,y"(그 칸을 덮거나 가장 가까운 건물)` },
            tileRemap: { type: "array", items: { type: "object", properties: { from: { type: "integer" }, to: { type: "integer" } }, required: ["from", "to"] } },
            tileOverrides: {
              type: "array",
              items: { type: "object", properties: { layer: { type: "string" }, rect: RECT_SCHEMA, cells: { type: "array", items: COORD_SCHEMA }, tile: { type: "integer" } }, required: ["layer", "tile"] },
            },
            removeEvents: { type: "array", items: { type: "string" } },
          },
          required: ["id"],
        },
      },
      timeGates: { type: "string", enum: ["drop", "keep"], description: "복제본의 시간문. drop(기본)=떼어 내고 gates 로 새로 잇기, keep=그대로 복제" },
      relinkDoors: { type: "boolean", description: "집 문이 가는 실내 맵을 변형용으로 복제해 변형 마을과 잇는다(기본 false)" },
      gates: { type: "array", description: "변형을 잇는 시간문. 각 항목은 create_time_gate 인자({a,b,name?,effect?,unlockWhen?,lockedMessage?,lockSide?,graphic?})", items: { type: "object", properties: { a: { type: "object" }, b: { type: "object" } }, required: ["a", "b"], additionalProperties: true } },
      resync: {
        type: "object",
        description: "이미 만든 변형의 영역을 원본 지리로 다시 맞춘다: {variantId, sourceMapId?, rects:[{x,y,w,h}], layers?(all|lower|upper), tileRemap?, tileOverrides?}",
        properties: { variantId: { type: "string" }, rects: { type: "array", items: RECT_SCHEMA } },
        additionalProperties: true,
      },
    },
    required: [],
    additionalProperties: false,
  },
  invalidArgsExample: {
    sourceMapId: "map_present",
    variants: [{ id: "map_medieval", era: "중세", tileOverrides: [{ layer: 1, rect: { x: 4, y: 4, w: 3, h: 2 }, tile: 737 }], removeEvents: ["가로등"] }],
    gates: [{ a: { mapId: "map_present", x: 10, y: 4 }, b: { mapId: "map_medieval", x: 10, y: 4 }, name: "시간의 문", effect: "swirl" }],
  },
  run(draft, args): ToolExecResult {
    const variantsRaw = args.variants;
    const resyncRaw = args.resync;
    if (variantsRaw === undefined && resyncRaw === undefined) {
      throw new ToolError("variants(새 변형 목록) 또는 resync(기존 변형 영역 재동기) 중 하나는 있어야 합니다.", { code: "invalid-args" });
    }
    if (variantsRaw !== undefined && !Array.isArray(variantsRaw)) throw new ToolError("variants 는 배열이어야 합니다.", { code: "invalid-args" });
    const sourceId = typeof args.sourceMapId === "string" ? args.sourceMapId : undefined;
    if (Array.isArray(variantsRaw) && variantsRaw.length > 0 && !sourceId) throw new ToolError("variants 를 만들려면 sourceMapId(기준 맵)가 필요합니다.", { code: "invalid-args" });
    const warnings: string[] = [];
    const options = { timeGates: (args.timeGates === "keep" ? "keep" : "drop") as "drop" | "keep", relink: args.relinkDoors === true };
    const reports: VariantReport[] = [];
    if (Array.isArray(variantsRaw) && variantsRaw.length > 0) {
      const source = requireMap(draft, sourceId!);
      const ids = variantsRaw.map((entry) => (entry && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined));
      if (new Set(ids).size !== ids.length) throw new ToolError("variants[].id 가 겹칩니다.", { code: "invalid-args" });
      for (const raw of variantsRaw) reports.push(createVariant(draft, source, raw as Record<string, unknown>, options, warnings));
    }
    const synced = resyncRaw === undefined ? undefined : resync(draft, resyncRaw as Record<string, unknown>, sourceId, warnings);

    const createdGates: unknown[] = [];
    if (args.gates !== undefined) {
      if (!Array.isArray(args.gates)) throw new ToolError("gates 는 create_time_gate 인자 배열이어야 합니다.", { code: "invalid-args" });
      const gateTool = TIME_GATE_TOOLS[0]!;
      (args.gates as unknown[]).forEach((gate, index) => {
        rejectUnknownKeys(gate, GATE_KEYS, `gates[${index}]`);
        const result = gateTool.run(draft, gate as Record<string, unknown>);
        createdGates.push(result.data);
        for (const warning of result.warnings ?? []) warnings.push(`gates[${index}]: ${warning}`);
      });
    }
    const pinnedLighting = reports.length > 0 ? pinNeutralLighting(draft, requireMap(draft, sourceId!), reports.map((report) => report.mapId)) : [];
    const dropped = reports.flatMap((report) => report.removedTimeGates.map((gate) => `${report.mapId}:${gate.name ?? gate.sourceEventId}(${gate.x},${gate.y})→${gate.leadsTo.join("/")}`));
    if (dropped.length > 0 && createdGates.length === 0) {
      warnings.push(`원본의 시간문 ${dropped.length}개를 변형에서 떼어 냈습니다(${dropped.join(", ")}) — 변형들을 잇으려면 create_time_gate 또는 gates 로 새 문을 만드세요(원본 문 자리를 쓰면 같은 위치에 놓입니다).`);
    }
    const parts = [
      reports.length ? `변형 ${reports.length}개 생성(${reports.map((report) => report.mapId).join(", ")})` : "",
      synced ? `${synced.variantId} 영역 ${synced.copiedCells}칸을 ${synced.sourceMapId} 에서 재동기` : "",
      createdGates.length ? `시간문 ${createdGates.length}쌍` : "",
      pinnedLighting.length ? `시대 조명이 새지 않게 ${pinnedLighting.join(", ")} 조명을 밝게 고정` : "",
    ].filter(Boolean);
    return {
      summary: `${parts.join(" · ")} — 이벤트 id 표는 data.variants[].eventIdMap. check_reachability 와 원본 해상도 그림으로 시대별 통행·외형을 확인하세요.`,
      data: { sourceMapId: sourceId, variants: reports, ...(synced ? { resync: synced } : {}), gates: createdGates, ...(pinnedLighting.length ? { pinnedLighting } : {}) },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

export const MAP_VARIANT_TOOLS: readonly ToolDefinition[] = [deriveMapVariant];
