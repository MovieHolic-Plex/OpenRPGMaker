// editor/tools/queryTools.ts
// 읽기 툴: get_project_summary / get_map_region / find_events / find_switch_usage
//         / list_resources / run_lint / check_reachability.
// 읽기 툴은 project를 변형하지 않는다(runner가 read 모드로 처리).

import { searchResources, type ResourceSearchKind } from "@/assets/resourceSearch";
import { isPassable } from "@/project/collision";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import { checkReachability, type Point as ReachPoint } from "@/project/lint/reachability";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

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
  const lower = map.lowerTiles[i];
  const upper = map.upperTiles[i];
  if (upper === TILE.WATER || lower === TILE.WATER) return "~";
  if (upper === TILE.TREE || lower === TILE.TREE) return "T";
  if (lower === TILE.WALL) return "#";
  return isPassable(project, map, x, y) ? "." : "#";
}

const getMapRegion: ToolDefinition = {
  name: "get_map_region",
  description: "맵 영역을 시맨틱 문자 그리드(#=벽/통행불가, .=통행가능, ~=물, T=나무, E=이벤트)로 반환한다.",
  mode: "read",
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
      .map((event) => ({ id: event.id, x: event.x, y: event.y, pages: (event.pages ?? []).length }));
    return {
      summary: `${map.name} 영역 (${x0},${y0})~(${x1},${y1}) — 이벤트 ${events.length}개`,
      data: { grid: rows, legend: { "#": "통행 불가/벽", ".": "통행 가능", "~": "물", T: "나무", E: "이벤트" }, events },
    };
  },
};

const findEvents: ToolDefinition = {
  name: "find_events",
  description: "이벤트를 이름/커맨드 종류/스위치 참조로 검색한다.",
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
    const matches: Array<{ mapId: string; eventId: string; x: number; y: number }> = [];
    for (const map of maps) {
      for (const event of map.events) {
        const pages = eventPages(event);
        const nameHit = !nameContains || pages.some((page) => page.name.includes(nameContains));
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
        if (nameHit && commandHit && switchHit) matches.push({ mapId: map.id, eventId: event.id, x: event.x, y: event.y });
      }
    }
    return { summary: `이벤트 ${matches.length}개 검색됨`, data: { matches } };
  },
};

// 이벤트 전체 내용 조회 — 수정(upsert_event) 전에 현재 페이지/커맨드를 읽는 용도.
// find_events는 위치만 주므로, 내용을 모른 채 덮어써 대사가 사라지는 사고를 막는다.
const getEvent: ToolDefinition = {
  name: "get_event",
  description: "이벤트의 전체 정의(위치/그래픽/페이지/커맨드)를 반환한다. upsert_event로 수정하기 전에 반드시 현재 내용을 이걸로 읽어라.",
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

const RESOURCE_KINDS: readonly ResourceSearchKind[] = ["tile", "charset", "backdrop", "bgm", "se"];

const listResources: ToolDefinition = {
  name: "list_resources",
  description: "리소스를 시맨틱 검색한다(resourceSearch 위임). kind: tile/charset/backdrop/bgm/se.",
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
    const matches = searchResources(kind, args.query as string, { tileset: project.tilesets[DEFAULT_TILESET_ID] }).slice(0, 20);
    return { summary: `리소스 ${matches.length}개 검색됨("${args.query}", ${kind})`, data: { matches } };
  },
};

function toReachSpecs(value: unknown): Array<{ mapId: string; from: ReachPoint; targets: ReachPoint[] }> {
  if (!Array.isArray(value)) return [];
  return value as Array<{ mapId: string; from: ReachPoint; targets: ReachPoint[] }>;
}

const runLint: ToolDefinition = {
  name: "run_lint",
  description: "projectLint를 실행해 무결성 issue 목록을 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { reachability: { type: "array", description: "[{mapId,from,targets}]", items: { type: "object" } } },
  },
  run(project, args): ToolExecResult {
    const issues: LintIssue[] = projectLint(project, { reachability: toReachSpecs(args.reachability) });
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
      from: { type: "object", description: "{x,y}" },
      targets: { type: "array", description: "[{x,y}...]", items: { type: "object" } },
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

// DB/프로젝트 컬렉션별 {id, name} 목록. LLM이 기존 id를 확인하지 않고 추측해
// 참조 오류를 내는 문제(evals 실패 패턴)를 막는 조회 툴이다.
const DB_COLLECTIONS = [
  "actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states",
  "battleAnimations", "switches", "variables", "commonEvents", "quests", "maps",
] as const;
type DbCollection = (typeof DB_COLLECTIONS)[number];

function collectionEntries(project: Project, collection: DbCollection): { id: string; name: string }[] {
  const named = (list: readonly { id: string; name?: string }[]): { id: string; name: string }[] =>
    list.map((entry) => ({ id: entry.id, name: entry.name ?? "" }));
  switch (collection) {
    case "switches": return named(project.switches);
    case "variables": return named(project.variables);
    case "commonEvents": return named(project.commonEvents);
    case "quests": return (project.quests ?? []).map((quest) => ({ id: quest.key, name: quest.title }));
    case "maps": return Object.values(project.maps).map((map) => ({ id: map.id, name: map.name }));
    default: return named(project.database[collection] ?? []);
  }
}

const getDatabaseRecords: ToolDefinition = {
  name: "get_database_records",
  description: "컬렉션의 {id, name} 목록을 반환한다. 레코드를 참조/수정하기 전에 실제 id를 확인하는 용도. collection: actors/classes/skills/items/equipment/enemies/troops/states/battleAnimations/switches/variables/commonEvents/quests/maps.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { collection: { type: "string", enum: DB_COLLECTIONS as unknown as string[] } },
    required: ["collection"],
  },
  run(project, args): ToolExecResult {
    const collection = args.collection as DbCollection;
    if (!DB_COLLECTIONS.includes(collection)) {
      throw new ToolError(`알 수 없는 컬렉션: ${String(args.collection)}`, { code: "invalid-collection" });
    }
    const records = collectionEntries(project, collection);
    return { summary: `${collection} ${records.length}건`, data: { records } };
  },
};

export const QUERY_TOOLS: readonly ToolDefinition[] = [
  getProjectSummary,
  getMapRegion,
  findEvents,
  getEvent,
  findSwitchUsage,
  listResources,
  getDatabaseRecords,
  runLint,
  checkReachabilityTool,
];
