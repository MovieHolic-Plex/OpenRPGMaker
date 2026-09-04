// editor/tools/queryTools.ts
// 읽기 툴: get_project_summary / get_map_region / find_events / find_switch_usage
//         / list_resources / run_lint / check_reachability.
// 읽기 툴은 project를 변형하지 않는다(runner가 read 모드로 처리).

import { queryNpcGraphics } from "@/assets/charsetQuery";
import { searchResources, type ResourceSearchKind } from "@/assets/resourceSearch";
import { isPassable } from "@/project/collision";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import { checkReachability, type Point as ReachPoint } from "@/project/lint/reachability";
import { questDefId } from "@/project/quest/questDef";
import { supabaseProjectConfig } from "@/project/supabaseProjectConfig";
import {
  confidenceScore,
  normalizePalettePresetId,
  paletteRolesForTile,
  tileCategoriesForTile,
  tileMetaLocked,
  tileMetaOrigin,
} from "@/project/tilesetPalette";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { findLayoutRegions, rankRegionsByCenter } from "@/project/mapLayoutPlan";
import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { COORD_SCHEMA } from "./schemaShapes";

/** 호수/강 등 물 지형(레거시 WATER 상수 + 타일 그림판/오토타일). */
export function isMapWaterTile(tile: number): boolean {
  return tile === TILE.WATER || isWaterChipsetTile(tile) || isLakeAutotileTile(tile);
}

// 커맨드 트리를 재귀 순회(fork/choices/loop 분기 포함).
function walkCommands(commands: readonly Command[], visit: (command: Command) => void): void {
  for (const command of commands) {
    visit(command);
    if (command.kind === "choices") {
      for (const option of command.options) walkCommands(option.branch, visit);
      if (command.cancelBranch) walkCommands(command.cancelBranch, visit);
    } else if (command.kind === "fork") {
      walkCommands(command.then, visit);
      if (command.else) walkCommands(command.else, visit);
    } else if (command.kind === "loop") {
      walkCommands(command.body, visit);
    }
  }
}

function eventPages(event: GameEvent): EventPage[] {
  return event.pages ?? [];
}

function conditionReferencesSwitch(condition: Condition | undefined, switchId: string): boolean {
  return condition?.kind === "switch" && condition.switchId === switchId;
}

const getProjectSummary: ToolDefinition = {
  name: "get_project_summary",
  description: "제목/맵 목록(크기·이벤트 수)/DB 카운트/스위치·변수/시작점 요약을 반환한다.",
  mode: "read",
  parameters: { type: "object", properties: {} },
  run(project): ToolExecResult {
    const maps = Object.values(project.maps).map((map) => ({
      id: map.id,
      name: map.name,
      width: map.width,
      height: map.height,
      events: map.events.length,
    }));
    const namedSwitches = project.switches.filter((entry) => entry.name !== "");
    const namedVariables = project.variables.filter((entry) => entry.name !== "");
    const data = {
      title: project.meta.title,
      startMapId: project.startMapId,
      startPos: project.startPos,
      maps,
      db: {
        items: project.database.items.length,
        enemies: project.database.enemies.length,
        troops: project.database.troops.length,
        actors: project.database.actors.length,
        equipment: project.database.equipment.length,
        skills: project.database.skills.length,
      },
      switches: namedSwitches.map((entry) => ({ id: entry.id, name: entry.name })),
      variables: namedVariables.map((entry) => ({ id: entry.id, name: entry.name })),
    };
    return { summary: `프로젝트 '${project.meta.title}' — 맵 ${maps.length}개, 아이템 ${data.db.items}, 트룹 ${data.db.troops}`, data };
  },
};

// 타일을 시맨틱 문자로 변환.
function semanticChar(project: Project, map: GameMap, x: number, y: number, hasEvent: boolean): string {
  if (hasEvent) return "E";
  const i = y * map.width + x;
  const lower = map.lowerTiles[i] ?? TILE.EMPTY;
  const upper = map.upperTiles[i] ?? TILE.EMPTY;
  // 호수 오토타일·타일 그림판 물 — TILE.WATER(120)만 보면 호수를 못 찾는다.
  if (isMapWaterTile(lower) || isMapWaterTile(upper)) return "~";
  if (upper === TILE.TREE || lower === TILE.TREE) return "T";
  if (lower === TILE.WALL) return "#";
  return isPassable(project, map, x, y) ? "." : "#";
}

/** 영역 안 물 타일(~) 바운딩 박스. 없으면 null. */
export function waterBoundsInMap(
  map: GameMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { readonly cellCount: number; readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let cellCount = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * map.width + x;
      const lower = map.lowerTiles[i] ?? TILE.EMPTY;
      const upper = map.upperTiles[i] ?? TILE.EMPTY;
      if (!isMapWaterTile(lower) && !isMapWaterTile(upper)) continue;
      cellCount += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (cellCount === 0) return null;
  return { cellCount, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const getMapRegion: ToolDefinition = {
  name: "get_map_region",
  description:
    "맵 영역을 시맨틱 문자 그리드(#=벽/통행불가, .=통행가능, ~=물/호수, T=나무, E=이벤트)로 반환한다. " +
    "data.water에 물 칸 수·바운딩 박스가 포함된다(호수 찾기용). 전체 맵(52×52)을 한 번에 부르지 말고 뷰포트/관심 영역(권장 ≤24×24)부터 조회하라.",
  mode: "read",
  invalidArgsExample: { mapId: "map_1", x: 0, y: 0, w: 10, h: 8 },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
    },
    required: ["mapId", "x", "y", "w", "h"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const x0 = Math.max(0, args.x as number);
    const y0 = Math.max(0, args.y as number);
    const x1 = Math.min(map.width, x0 + (args.w as number));
    const y1 = Math.min(map.height, y0 + (args.h as number));
    const eventAt = new Map<string, GameEvent>();
    for (const event of map.events) eventAt.set(`${event.x},${event.y}`, event);
    const rows: string[] = [];
    for (let y = y0; y < y1; y += 1) {
      let row = "";
      for (let x = x0; x < x1; x += 1) {
        row += semanticChar(project, map, x, y, eventAt.has(`${x},${y}`));
      }
      rows.push(row);
    }
    const events = map.events
      .filter((event) => event.x >= x0 && event.x < x1 && event.y >= y0 && event.y < y1)
      .map((event) => {
        const catalog = eventCatalogFields(event);
        return {
          id: event.id,
          x: event.x,
          y: event.y,
          name: catalog.name,
          pages: catalog.pageCount,
          conditionKinds: catalog.conditionKinds,
          ...(catalog.characterId ? { characterId: catalog.characterId } : {}),
        };
      });
    const water = waterBoundsInMap(map, x0, y0, x1, y1);
    const area = Math.max(1, (x1 - x0) * (y1 - y0));
    const large = area > 24 * 24;
    const warnings: string[] = [];
    if (large) {
      warnings.push(
        `영역 ${x1 - x0}×${y1 - y0}이 큼 — 다음엔 뷰포트 근처(≤24×24)로 좁혀 조회하세요. 호수는 data.water.bounds를 쓰세요.`,
      );
    }
    const waterSummary = water
      ? `물 ${water.cellCount}칸 bounds=(${water.x},${water.y}) ${water.w}×${water.h}`
      : "물 0칸";
    return {
      summary: `${map.name}(${map.id}) 영역 (${x0},${y0})~(${x1},${y1}) — 이벤트 ${events.length}개, ${waterSummary}`,
      data: {
        // 읽은 맵 id 를 결과에 되돌려준다 — 수정 요청에서 모델이 "무엇을 읽었는지"와 "무엇에 쓸지"를
        // 다른 맵으로 잘못 잇는 사고를 줄인다(2026-08-29 modify 진단 근본원인 15).
        mapId: map.id,
        mapName: map.name,
        grid: rows,
        legend: { "#": "통행 불가/벽", ".": "통행 가능", "~": "물/호수", T: "나무", E: "이벤트" },
        events,
        water: water
          ? { cellCount: water.cellCount, bounds: { x: water.x, y: water.y, w: water.w, h: water.h } }
          : { cellCount: 0, bounds: null },
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const findEvents: ToolDefinition = {
  name: "find_events",
  description:
    "이벤트를 이름/id/대사/커맨드 종류/스위치 참조로 검색한다. 각 매치는 페이지 수·조건 kind·characterId 를 포함하므로, 새 NPC를 놓을 때 풍부한 예를 고른 뒤 get_event 로 템플릿을 읽어라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      nameContains: { type: "string" },
      commandKind: { type: "string" },
      referencesSwitch: { type: "string" },
    },
  },
  run(project, args): ToolExecResult {
    const mapId = args.mapId as string | undefined;
    const nameContains = args.nameContains as string | undefined;
    const commandKind = args.commandKind as string | undefined;
    const referencesSwitch = args.referencesSwitch as string | undefined;
    const maps = mapId ? [requireMap(project, mapId)] : Object.values(project.maps);
    const matches: Array<{
      mapId: string;
      eventId: string;
      x: number;
      y: number;
      name: string;
      pageCount: number;
      conditionKinds: string[];
      characterId?: string;
    }> = [];
    for (const map of maps) {
      for (const event of map.events) {
        const pages = eventPages(event);
        const nameHit = !nameContains || eventSearchText(event).includes(nameContains);
        let commandHit = !commandKind;
        let switchHit = !referencesSwitch;
        for (const page of pages) {
          walkCommands(page.commands, (command) => {
            if (commandKind && command.kind === commandKind) commandHit = true;
            if (referencesSwitch) {
              if (command.kind === "setSwitch" && command.switchId === referencesSwitch) switchHit = true;
              if (command.kind === "fork" && conditionReferencesSwitch(command.condition, referencesSwitch)) switchHit = true;
            }
          });
          if (referencesSwitch && page.conditions.some((c) => conditionReferencesSwitch(c, referencesSwitch))) switchHit = true;
        }
        if (nameHit && commandHit && switchHit) {
          matches.push({
            mapId: map.id,
            eventId: event.id,
            x: event.x,
            y: event.y,
            ...eventCatalogFields(event),
          });
        }
      }
    }
    return { summary: `이벤트 ${matches.length}개 검색됨`, data: { matches } };
  },
};

function eventSearchText(event: GameEvent): string {
  const parts = [event.id, event.characterId ?? ""];
  for (const page of eventPages(event)) {
    parts.push(page.name);
    walkCommands(page.commands, (command) => {
      if (command.kind === "text") {
        if (command.body) parts.push(command.body);
        if (command.speaker) parts.push(command.speaker);
      }
    });
  }
  return parts.join("\n");
}

function eventCatalogFields(event: GameEvent): {
  name: string;
  pageCount: number;
  conditionKinds: string[];
  characterId?: string;
} {
  const pages = eventPages(event);
  const conditionKinds = [...new Set(pages.flatMap((page) => page.conditions.map((condition) => condition.kind)))];
  return {
    name: pages[0]?.name || event.id,
    pageCount: pages.length,
    conditionKinds,
    ...(event.characterId ? { characterId: event.characterId } : {}),
  };
}

// 이벤트 전체 내용 조회 — 수정(upsert_event) 전에 현재 페이지/커맨드를 읽는 용도.
// find_events는 위치만 주므로, 내용을 모른 채 덮어써 대사가 사라지는 사고를 막는다.
const getEvent: ToolDefinition = {
  name: "get_event",
  description: "이벤트의 전체 정의(위치/그래픽/페이지/커맨드)를 반환한다. upsert_event로 수정하기 전에 반드시 현재 내용을 이걸로 읽어라. 새 NPC를 놓을 때도 find_events 가 고른 풍부한 예를 템플릿으로 읽을 때 사용한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string" },
    },
    required: ["mapId", "eventId"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const eventId = args.eventId as string;
    const event = map.events.find((entry) => entry.id === eventId);
    if (!event) {
      const known = map.events.slice(0, 10).map((entry) => entry.id).join(", ") || "(없음)";
      throw new ToolError(`이벤트를 찾을 수 없습니다: ${eventId} (이 맵의 이벤트: ${known})`, { code: "event-not-found", mapId: map.id });
    }
    const pages = event.pages ?? [];
    return {
      summary: `이벤트 '${event.id}' (${event.x},${event.y}) — 페이지 ${pages.length}개`,
      data: { event },
    };
  },
};

const findSwitchUsage: ToolDefinition = {
  name: "find_switch_usage",
  description: "스위치의 전 맵 이벤트/커먼이벤트/트룹 전투이벤트 역참조를 찾는다.",
  mode: "read",
  parameters: { type: "object", properties: { switchId: { type: "string" } }, required: ["switchId"] },
  run(project, args): ToolExecResult {
    const switchId = args.switchId as string;
    const usages: Array<{ scope: string; id: string; kind: string }> = [];
    const scan = (scope: string, id: string, commands: readonly Command[], conditions: readonly Condition[] = []): void => {
      for (const condition of conditions) {
        if (conditionReferencesSwitch(condition, switchId)) usages.push({ scope, id, kind: "condition" });
      }
      walkCommands(commands, (command) => {
        if (command.kind === "setSwitch" && command.switchId === switchId) usages.push({ scope, id, kind: "setSwitch" });
        if (command.kind === "fork" && conditionReferencesSwitch(command.condition, switchId)) usages.push({ scope, id, kind: "fork" });
      });
    };
    for (const map of Object.values(project.maps)) {
      for (const event of map.events) {
        for (const page of eventPages(event)) scan(`map:${map.id}`, `${event.id}/${page.id}`, page.commands, page.conditions);
        scan(`map:${map.id}`, event.id, event.commands);
      }
    }
    for (const common of project.commonEvents) scan("commonEvent", common.id, common.commands);
    for (const troop of project.database.troops) {
      for (const page of troop.battleEventPages ?? []) scan(`troop:${troop.id}`, page.id ?? "page", page.commands ?? []);
    }
    return { summary: `스위치 '${switchId}' 사용처 ${usages.length}건`, data: { usages } };
  },
};

const RESOURCE_KINDS: readonly ResourceSearchKind[] = ["tile", "charset", "monster", "backdrop", "bgm", "se"];

const listNpcGraphics: ToolDefinition = {
  name: "list_npc_graphics",
  description: "NPC/캐릭터셋 그래픽 후보를 조회한다. query는 자유 질의 가능(예: 할머니, old woman, 노인 남성, 기사). 상위 20개를 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "선택 검색어. 생략하면 기본 NPC 후보를 반환한다." },
    },
  },
  run(project, args): ToolExecResult {
    const query = typeof args.query === "string" ? args.query : undefined;
    const matches = queryNpcGraphics(query, 20, project.charsetLabels).map((match) => ({
      textureKey: match.entry.textureKey,
      characterIndex: match.entry.characterIndex,
      label: match.entry.label,
      gender: match.entry.gender,
      age: match.entry.age,
      tags: match.entry.tags,
    }));
    const label = query && query.trim().length > 0 ? `"${query}"` : "기본";
    return { summary: `NPC 그래픽 ${matches.length}개 조회(${label})`, data: { matches } };
  },
};

const listResources: ToolDefinition = {
  name: "list_resources",
  description: "리소스를 시맨틱 검색한다(resourceSearch 위임). kind: tile/charset/monster/backdrop/bgm/se.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: RESOURCE_KINDS as unknown as string[] },
      query: { type: "string" },
    },
    required: ["kind", "query"],
  },
  run(project, args): ToolExecResult {
    const kind = args.kind as ResourceSearchKind;
    if (!RESOURCE_KINDS.includes(kind)) throw new ToolError(`알 수 없는 리소스 종류: ${kind}`, { code: "invalid-kind" });
    // 타일 검색은 프로젝트에 기록된 사용자 메타데이터(맵 인터뷰 결과)를 겹쳐 검색한다.
    const matches = searchResources(kind, args.query as string, {
      tileset: project.tilesets[DEFAULT_TILESET_ID],
      charsetLabels: project.charsetLabels,
    }).slice(0, 20);
    return { summary: `리소스 ${matches.length}개 검색됨("${args.query}", ${kind})`, data: { matches } };
  },
};

const queryTiles: ToolDefinition = {
  name: "query_tiles",
  description: "타일셋의 타일 상세를 role/category/presetId로 조회한다. 프리셋이 있으면 배치 전에 개별 tile id 대신 presetId+paletteRole 후보를 확인하라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 시작 맵의 타일셋" },
      role: { type: "string", description: "palette role 또는 tileMeta.role" },
      category: { type: "string", description: "tileMeta category/role 또는 tileGroup role" },
      presetId: { type: "string", description: "pp_ 프리셋 id(prefix 생략 가능)" },
      limit: { type: "integer", description: "반환 개수 제한(기본 50, 최대 200)" },
    },
  },
  run(project, args): ToolExecResult {
    const tilesetId = typeof args.tilesetId === "string" ? args.tilesetId : project.maps[project.startMapId]?.tilesetId ?? DEFAULT_TILESET_ID;
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { code: "tileset-not-found" });
    const presetId = typeof args.presetId === "string" && args.presetId.trim().length > 0 ? normalizePalettePresetId(args.presetId) : undefined;
    const preset = presetId ? (tileset.palettePresets ?? []).find((entry) => entry.id === presetId) : undefined;
    if (presetId && !preset) throw new ToolError(`프리셋을 찾을 수 없습니다: ${presetId}`, { code: "palette-preset-not-found" });
    const role = typeof args.role === "string" && args.role.trim().length > 0 ? args.role.trim() : undefined;
    const category = typeof args.category === "string" && args.category.trim().length > 0 ? args.category.trim() : undefined;
    const limit = typeof args.limit === "number" ? Math.max(1, Math.min(200, Math.floor(args.limit))) : 50;
    const presetTileIds = preset ? new Set(preset.slots.flatMap((slot) => slot.tileIds)) : null;
    const tiles = [];
    for (let tile = 0; tile < tileset.count; tile += 1) {
      if (presetTileIds && !presetTileIds.has(tile)) continue;
      const meta = tileset.tileMeta?.[tile];
      const paletteRoles = paletteRolesForTile(tileset, tile, presetId);
      const categories = tileCategoriesForTile(tileset, tile);
      if (role && meta?.role !== role && !(paletteRoles as readonly string[]).includes(role)) continue;
      if (category && !categories.includes(category)) continue;
      if (!meta && paletteRoles.length === 0 && categories.length === 0 && !presetTileIds) continue;
      tiles.push({
        tile,
        label: meta?.label ?? "",
        description: meta?.description ?? "",
        role: meta?.role,
        paletteRoles,
        categories,
        passage: tile >= 0 && tile < tileset.count ? passageMarkForTile(tileset, tile) : "x",
        passable: tile >= 0 && tile < tileset.count ? passageMarkForTile(tileset, tile) !== "x" : false,
        confidence: meta?.confidence,
        confidenceScore: confidenceScore(meta?.confidence),
        origin: tileMetaOrigin(meta),
        locked: tileMetaLocked(meta),
      });
      if (tiles.length >= limit) break;
    }
    return {
      summary: `타일 ${tiles.length}개 조회(${tilesetId}${presetId ? `, ${presetId}` : ""})`,
      data: { tilesetId, presetId, tiles, total: tileset.count },
    };
  },
};

function toReachSpecs(value: unknown): Array<{ mapId: string; from: ReachPoint; targets: ReachPoint[] }> {
  if (!Array.isArray(value)) return [];
  return value as Array<{ mapId: string; from: ReachPoint; targets: ReachPoint[] }>;
}

const runLint: ToolDefinition = {
  name: "run_lint",
  description: "projectLint, 타일셋 팔레트 lint를 실행해 무결성 issue 목록(error/warning/info)을 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      reachability: {
        type: "array",
        description: "[{mapId,from,targets}]",
        items: {
          type: "object",
          properties: {
            mapId: { type: "string" },
            from: COORD_SCHEMA,
            targets: { type: "array", items: COORD_SCHEMA },
          },
          required: ["mapId", "from", "targets"],
        },
      },
    },
  },
  run(project, args): ToolExecResult {
    const issues: LintIssue[] = [
      ...projectLint(project, { reachability: toReachSpecs(args.reachability) }),
      ...lintTilesetPalettes(project),
    ];
    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    const infos = issues.filter((issue) => issue.severity === "info").length;
    return { summary: `lint: error ${errors}건 / warning ${warnings}건 / info ${infos}건`, data: { counts: { errors, infos, warnings }, issues } };
  },
};

const checkReachabilityTool: ToolDefinition = {
  name: "check_reachability",
  description: "지정 맵에서 from 지점으로부터 targets 각각에 인접 도달 가능한지 검사한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      from: COORD_SCHEMA,
      targets: { type: "array", description: "[{x,y}...]", items: COORD_SCHEMA },
    },
    required: ["mapId", "from", "targets"],
  },
  run(project, args): ToolExecResult {
    const mapId = args.mapId as string;
    if (!project.maps[mapId]) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    const result = checkReachability(project, mapId, args.from as ReachPoint, args.targets as ReachPoint[]);
    return {
      summary: `도달성: ${result.reachable ? "전부 도달 가능" : `${result.unreachable.length}개 도달 불가`}`,
      data: { reachable: result.reachable, unreachable: result.unreachable },
    };
  },
};

const findLayoutRegionsTool: ToolDefinition = {
  name: "find_layout_regions",
  description:
    "맵의 설계 bbox 영역(layoutPlan.regions)을 질의로 검색한다. 한국어/영문 부분일치(상점·시장·장터→market, 집→house, 파란→blue, 가운데/중앙→중심 영역).  상점/가게/집 철거·수정 전에 이 툴로 영역 rect 를 얻는다 — 비전으로 좌표를 추측하지 말 것." +
    "query에 '가운데'/'중앙'이 있으면 맵 중앙에 가까운 순으로 정렬한다. 영역 bbox를 특정하거나 시공 좌표를 추론할 때 쓴다. " +
    "주의: 이 도구는 마을 빌더의 설계 기록(layoutPlan.regions)만 본다 — stamp_structure_kit/팔레트로 찍은 구조물 배치(map.structurePlacements)는 보이지 않는다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      query: { type: "string", description: "검색어 (예: 가운데 상점, 파란 집)" },
    },
    required: ["mapId", "query"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const query = typeof args.query === "string" ? args.query : "";
    if (!map.layoutPlan) {
      return { summary: `${map.name} 맵에 layoutPlan이 없어 검색 영역이 없습니다.`, data: { regions: [] } };
    }
    let regions = findLayoutRegions(map, query);
    // 중앙 쿼리(가운데/중앙)는 맵 중앙에 가까운 영역부터 정렬해 bbox 특정을 돕는다.
    if (query.includes("가운데") || query.includes("중앙")) {
      regions = rankRegionsByCenter(map, regions);
    }
    const regionData = regions.map((r) => ({
      id: r.id,
      role: r.role,
      label: r.label,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      kitId: r.kitId,
      tags: r.tags,
    }));
    const first = regions[0];
    const firstDesc = first
      ? `${first.role} '${first.label}' @(${first.x},${first.y}) ${first.w}×${first.h}`
      : "일치 없음";
    return {
      summary: `영역 ${regions.length}개 검색됨(${map.name}) — ${firstDesc}`,
      data: { regions: regionData },
    };
  },
};

const listProjectCommits: ToolDefinition = {
  name: "list_project_commits",
  description: "Supabase project_commits의 최근 변경 이력을 반환한다. 브라우저 PostgREST 연결에서만 지원된다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "가져올 최근 커밋 수(기본 20, 최대 100)" },
    },
  },
  run(_project, args): ToolExecResult {
    if (typeof window === "undefined" || typeof XMLHttpRequest === "undefined") {
      throw new ToolError("list_project_commits는 브라우저 PostgREST 환경에서만 지원됩니다.", { code: "browser-only" });
    }
    const config = supabaseProjectConfig();
    if (!config) throw new ToolError("Supabase 설정이 없어 커밋 이력을 조회할 수 없습니다.", { code: "supabase-not-configured" });
    const requestedLimit = typeof args.limit === "number" ? args.limit : 20;
    const limit = Math.max(1, Math.min(100, Math.floor(requestedLimit)));
    const commits = listProjectCommitsSync(config.url, config.anonKey, config.projectId, limit);
    return { summary: `최근 커밋 ${commits.length}건`, data: { commits } };
  },
};

// DB/프로젝트 컬렉션별 {id, name} 목록. LLM이 기존 id를 확인하지 않고 추측해
// 참조 오류를 내는 문제(evals 실패 패턴)를 막는 조회 툴이다.
// 2026-08-23 실측: `elements`/`monsterSpecies` 가 목록에 없어서 모델이 `speciesId:"element_fire"`,
// `elementRates:{element_fire:...}` 처럼 id 를 발명했고 무결성 검증에서 거부된 뒤
// "속성 id 를 조회할 기능이 없다"며 작업 3건을 건너뛰었다. 참조 대상은 반드시 조회 가능해야 한다.
const DB_COLLECTIONS = [
  "actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states",
  "battleAnimations", "switches", "variables", "commonEvents", "quests", "maps",
  "elements", "monsterSpecies", "lifeSkills", "farmAnimalSpecies", "crops",
] as const;
type DbCollection = (typeof DB_COLLECTIONS)[number];

function collectionRecords(project: Project, collection: DbCollection): readonly Record<string, unknown>[] {
  const named = (list: readonly Record<string, unknown>[]): readonly Record<string, unknown>[] => list;
  switch (collection) {
    case "switches": return named(project.switches as unknown as Record<string, unknown>[]);
    case "variables": return named(project.variables as unknown as Record<string, unknown>[]);
    case "commonEvents": return named(project.commonEvents as unknown as Record<string, unknown>[]);
    case "quests": return (project.quests ?? []).map((quest) => ({ id: questDefId(quest), name: quest.title }));
    case "maps": return Object.values(project.maps).map((map) => ({ id: map.id, name: map.name }));
    default: return named((project.database[collection] ?? []) as unknown as Record<string, unknown>[]);
  }
}

function collectionEntries(project: Project, collection: DbCollection): { id: string; name: string }[] {
  return collectionRecords(project, collection).map((entry) => ({
    id: String(entry.id ?? ""),
    name: String(entry.name ?? ""),
  }));
}

const getDatabaseRecords: ToolDefinition = {
  name: "get_database_records",
  description: "컬렉션 레코드를 반환한다. 기본은 {id, name}. include=full 이면 전체 필드(적 stats 등). collection: actors/classes/skills/items/equipment/enemies/troops/states/battleAnimations/switches/variables/commonEvents/quests/maps/elements/monsterSpecies/lifeSkills/farmAnimalSpecies/crops.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      collection: { type: "string", enum: DB_COLLECTIONS as unknown as string[] },
      include: { type: "string", enum: ["ids", "full"] },
    },
    required: ["collection"],
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const collection = args.collection as DbCollection;
    if (!DB_COLLECTIONS.includes(collection)) {
      throw new ToolError(`알 수 없는 컬렉션: ${String(args.collection)}`, { code: "invalid-collection" });
    }
    const records = args.include === "full"
      ? collectionRecords(project, collection)
      : collectionEntries(project, collection);
    return { summary: `${collection} ${records.length}건`, data: { records } };
  },
};

export const QUERY_TOOLS: readonly ToolDefinition[] = [
  getProjectSummary,
  getMapRegion,
  findEvents,
  getEvent,
  findSwitchUsage,
  listNpcGraphics,
  listResources,
  queryTiles,
  getDatabaseRecords,
  runLint,
  checkReachabilityTool,
  listProjectCommits,
  findLayoutRegionsTool,
];

function listProjectCommitsSync(url: string, anonKey: string, projectId: string, limit: number): readonly Record<string, unknown>[] {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    limit: String(limit),
    order: "created_at.desc",
    select: "commit_id,message,summary,review_status,author_id,author_label,author_kind,agent_name,created_at",
  });
  const request = new XMLHttpRequest();
  request.open("GET", `${url}/rest/v1/project_commits?${query.toString()}`, false);
  request.setRequestHeader("apikey", anonKey);
  request.setRequestHeader("Authorization", `Bearer ${anonKey}`);
  request.setRequestHeader("Accept", "application/json");
  request.setRequestHeader("Accept-Profile", "rpg_zzu");
  request.send();
  if (request.status < 200 || request.status >= 300) {
    throw new ToolError(request.responseText || `커밋 이력 조회 실패(${request.status})`, { code: "supabase-read-failed" });
  }
  const parsed: unknown = JSON.parse(request.responseText || "[]");
  if (!Array.isArray(parsed)) throw new ToolError("커밋 이력 응답이 배열이 아닙니다.", { code: "invalid-response" });
  return parsed.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && !Array.isArray(entry));
}
