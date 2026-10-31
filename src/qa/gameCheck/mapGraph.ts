// 맵 연결 그래프 — 시작 맵에서 문(transfer 명령)·맵 연결(mapConnections)로 갈 수 있는 맵을 센다.
// 못 가는 맵, 연결도 이벤트도 없는 빈 껍데기 맵, 없는 맵·맵 밖·통행 불가 칸으로 가는 문을 찾는다.

import { isPassableLanding, inBounds } from "@/project/collision";
import type { Project } from "@/project/types";
import { allPages, visitPageCommands } from "./walk";
import type { CommandWhere, Finding, MapSummary } from "./types";

export interface MapEdge {
  readonly from: string | null;
  readonly to: string;
  readonly x: number;
  readonly y: number;
  readonly where: CommandWhere;
  readonly via: "transfer" | "connection";
}

export interface MapGraph {
  readonly edges: readonly MapEdge[];
  readonly reachable: ReadonlySet<string>;
  readonly inbound: ReadonlyMap<string, number>;
}

export function buildMapGraph(project: Project): MapGraph {
  const edges: MapEdge[] = [];
  for (const page of allPages(project)) {
    visitPageCommands(page, ({ command, where }) => {
      if (command.kind !== "transfer" || typeof command.mapId !== "string") return;
      edges.push({ from: page.map?.id ?? null, to: command.mapId, x: Number(command.x), y: Number(command.y), where, via: "transfer" });
    });
  }
  for (const connection of project.mapConnections ?? []) {
    if (!connection.playerEnabled) continue;
    const where = { mapId: connection.from.mapId, path: `mapConnections.${connection.id}` };
    edges.push({ from: connection.from.mapId, to: connection.to.mapId, x: connection.to.x, y: connection.to.y, where, via: "connection" });
    edges.push({ from: connection.to.mapId, to: connection.from.mapId, x: connection.from.x, y: connection.from.y, where, via: "connection" });
  }
  const reachable = new Set<string>();
  const queue = project.maps[project.startMapId] ? [project.startMapId] : [];
  // 공통 이벤트의 문은 어디서든 부를 수 있다고 본다(호출 경로까지는 추적하지 않는다).
  const anywhere = edges.filter((edge) => edge.from === null).map((edge) => edge.to);
  let anywhereAdded = false;
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of edges) if (edge.from === id && project.maps[edge.to] && !reachable.has(edge.to)) queue.push(edge.to);
    if (!anywhereAdded) { anywhereAdded = true; queue.push(...anywhere.filter((to) => project.maps[to])); }
  }
  const inbound = new Map<string, number>();
  for (const edge of edges) if (edge.from !== edge.to) inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1);
  return { edges, reachable, inbound };
}

export function checkMapGraph(project: Project, graph: MapGraph): Finding[] {
  const findings: Finding[] = [];
  const start = project.maps[project.startMapId];
  if (!start) {
    findings.push({ severity: "blocker", code: "start-map-missing", message: `시작 맵 ${project.startMapId} 이 프로젝트에 없습니다.` });
  } else if (!inBounds(start, project.startPos.x, project.startPos.y) || !isPassableLanding(project, start, project.startPos.x, project.startPos.y)) {
    findings.push({ severity: "blocker", code: "start-position-blocked", message: `시작 위치 (${project.startPos.x},${project.startPos.y}) 가 맵 밖이거나 통행할 수 없는 칸입니다.`, where: { mapId: start.id, mapName: start.name, x: project.startPos.x, y: project.startPos.y } });
  }
  for (const edge of graph.edges) {
    if (edge.via !== "transfer") continue;
    const target = project.maps[edge.to];
    if (!target) {
      findings.push({ severity: "blocker", code: "transfer-missing-map", message: `없는 맵 \`${edge.to}\` 으로 가는 장소 이동입니다.`, where: edge.where });
      continue;
    }
    if (!Number.isInteger(edge.x) || !Number.isInteger(edge.y) || !inBounds(target, edge.x, edge.y)) {
      findings.push({ severity: "blocker", code: "transfer-out-of-bounds", message: `${target.name}(${target.id}) ${target.width}×${target.height} 밖의 좌표 (${edge.x},${edge.y}) 로 이동합니다.`, where: edge.where });
      continue;
    }
    if (!isPassableLanding(project, target, edge.x, edge.y)) {
      findings.push({ severity: "blocker", code: "transfer-impassable", message: `${target.name}(${target.id}) 의 도착 칸 (${edge.x},${edge.y}) 은 통행할 수 없어 도착 후 움직일 수 없습니다.`, where: edge.where });
    }
  }
  for (const map of Object.values(project.maps)) {
    if (map.id === project.startMapId) continue;
    const events = map.events?.length ?? 0;
    const inbound = graph.inbound.get(map.id) ?? 0;
    const where = { mapId: map.id, mapName: map.name };
    // 시드 시작 맵(map_blank_start)은 조수가 새 마을을 짓고 시작 위치·문을 옮기면 남는다(remove_map 은 맵 소실 확인에 막힌다).
    // 플레이 경로에서 빠진 옛 시드 맵은 이벤트가 남아 있어도 unreachable-map 막힘으로 세지 않는다(r3-ff1: 막힘 안내 때문에 다시 문을 이어 붙여 초록 어촌이 노출됨).
    const seedLeftBehind = map.id === "map_blank_start" && project.startMapId !== map.id;
    if (events === 0 && inbound === 0) {
      findings.push({
        severity: seedLeftBehind ? "warning" : "blocker",
        code: "orphan-empty-map",
        message: seedLeftBehind
          ? `시작 맵을 옮긴 뒤 남은 빈 시드 맵 ${map.name}(${map.id}) ${map.width}×${map.height} 입니다. 플레이에는 쓰이지 않습니다. 쓸 곳이 없으면 remove_map 으로 지웁니다.`
          : `${map.name}(${map.id}) ${map.width}×${map.height} 은 이벤트도 들어오는 문도 없는 빈 껍데기 맵입니다 — 기획의 장소가 실제로는 만들어지지 않았을 수 있습니다. 고치기: 장소를 짓는 도구(author_beodeul_town·author_dungeon·build_hand_interior_room 등)로 채우고 create_transfer_pair 로 잇거나, 쓰지 않으면 remove_map.`,
        where,
      });
    } else if (!graph.reachable.has(map.id) && !seedLeftBehind) {
      findings.push({ severity: events > 0 ? "blocker" : "warning", code: "unreachable-map", message: `${map.name}(${map.id}) 은 시작 맵에서 문으로 갈 수 없습니다${inbound > 0 ? " (들어오는 문은 모두 못 가는 맵에 있습니다)" : ""}. 고치기: create_transfer_pair({a:{mapId:<시작 맵에서 닿는 맵>,x,y}, b:{mapId:"${map.id}",x,y}}) — 시대 사이면 create_time_gate.`, where });
    }
  }
  return findings;
}

/** 이 밝기 이상이면 「어두운 조명」 — 시대 변형 LOOKS 의 past 0.3 · ruin 0.52 가 여기 든다. */
const DARK_AMBIENT = 0.3;
const NO_LIGHTING = "none";

/**
 * defaultLighting 이 없는 맵은 들어오기 전 맵의 조명을 이어 받는다(lightingRules.applyMapDefaultLighting).
 * 어두운 맵과 밝은 맵 양쪽에서 들어올 수 있으면 같은 장소가 길마다 달라 보인다 — jrpg-loop-4 R6: 폐허(ambient 0.52)에서
 * 시작하는 ff2 는 붕괴 전 왕도·여관·가도까지 잿빛 갈색으로 덮여 「시대가 달라진 마을이 다 똑같다」가 되풀이됐다.
 */
export function checkLightingLeak(project: Project, graph: MapGraph): Finding[] {
  const lightingKey = (id: string): string | undefined => {
    const lighting = project.maps[id]?.defaultLighting;
    return lighting ? `${lighting.ambient}|${lighting.color ?? ""}` : undefined;
  };
  const entering = new Map<string, Set<string>>();
  if (project.maps[project.startMapId]) entering.set(project.startMapId, new Set([NO_LIGHTING]));
  for (let changed = true; changed;) {
    changed = false;
    for (const edge of graph.edges) {
      if (edge.from === null || edge.from === edge.to || !project.maps[edge.to]) continue;
      const own = lightingKey(edge.from);
      const leaving = own !== undefined ? [own] : [...(entering.get(edge.from) ?? [])];
      const target = entering.get(edge.to) ?? new Set<string>();
      for (const key of leaving) if (!target.has(key)) { target.add(key); changed = true; }
      entering.set(edge.to, target);
    }
  }
  const findings: Finding[] = [];
  for (const map of Object.values(project.maps)) {
    const keys = entering.get(map.id);
    if (map.defaultLighting || !keys || keys.size < 2) continue;
    const dark = [...keys].filter((key) => key !== NO_LIGHTING && Number(key.split("|")[0]) >= DARK_AMBIENT);
    if (dark.length === 0) continue;
    const darkSources = [...new Set(graph.edges.filter((edge) => edge.to === map.id && edge.from !== null && edge.from !== map.id)
      .filter((edge) => { const own = lightingKey(edge.from!); return own !== undefined && dark.includes(own); })
      .map((edge) => project.maps[edge.from!]?.name ?? edge.from!))];
    findings.push({
      severity: "warning",
      code: "map-lighting-leak",
      message: `${map.name}(${map.id}) 은 조명(defaultLighting)이 없어 들어오기 전 맵의 조명을 이어 받습니다 — ${darkSources.length > 0 ? `${darkSources.join("·")} 에서` : "어두운 맵을 거쳐"} 들어오면 어둡고 다른 길로 오면 밝아 같은 장소가 길마다 달라 보입니다. 고치기: set_lighting_volume({mapId:"${map.id}", ambient:0}) 로 이 맵의 조명을 고정하세요.`,
      where: { mapId: map.id, mapName: map.name },
    });
  }
  return findings;
}

/**
 * 이벤트 setLighting 으로 어둡게 한 맵(「그날 밤」)이 기본 조명(defaultLighting)을 밝게 박아 두면, 문을 드나드는 순간
 * applyMapDefaultLighting 이 박힌 값으로 되돌려 밤이 풀린다 — 해원(조선 검안 데모) 밤 우물에서 주막에 들렀다 나오니 대낮이었다.
 * map-lighting-leak 의 「조명을 고정하라」 처방을 따른 맵에서 특히 생긴다. 들어오는 문이 있는 맵만 본다(다시 들어올 수 없으면 무해).
 */
export function checkStoryLightingReset(project: Project, graph: MapGraph): Finding[] {
  const findings: Finding[] = [];
  const reported = new Set<string>();
  for (const page of allPages(project)) {
    const map = page.map;
    if (!map) continue;
    visitPageCommands(page, ({ command, where }) => {
      if (command.kind !== "setLighting" || reported.has(map.id)) return;
      const ambient = Number(command.ambient);
      const pinned = map.defaultLighting;
      if (!(ambient >= DARK_AMBIENT) || !pinned || pinned.ambient >= DARK_AMBIENT) return;
      const reentry = graph.edges.some((edge) => edge.to === map.id && edge.from !== null && edge.from !== map.id);
      if (!reentry) return;
      reported.add(map.id);
      findings.push({
        severity: "warning",
        code: "story-lighting-reset",
        message: `${map.name}(${map.id}) 은 이벤트에서 setLighting(ambient ${ambient})으로 어두워지지만 기본 조명(ambient ${pinned.ambient})이 박혀 있어, 문으로 나갔다 들어오면 곧바로 그 밝기로 돌아갑니다(밤이 풀림). 고치기: set_lighting_volume({mapId:"${map.id}", inherit:true}) 로 기본 조명을 지우고, 밤이 끝날 때 이벤트에서 setLighting(ambient 0)으로 되돌리세요.`,
        where,
      });
    });
  }
  return findings;
}

/** 이보다 큰 광원 반경(칸)은 픽셀로 잘못 쓴 값으로 본다 — 해원 밤 장면에서 손등불 72·우물 40 이 화면 전체를 밝혀 밤이 보이지 않았다. */
const HUGE_LIGHT_RADIUS_TILES = 24;

/** 광원 반경은 칸 단위다. 픽셀처럼 큰 값이면 어둠 막 전체가 뚫려 setLighting·기본 조명의 밤이 안 보인다. */
export function checkHugeLightRadius(project: Project): Finding[] {
  const findings: Finding[] = [];
  const flag = (radius: unknown, id: unknown, where: CommandWhere) => {
    const r = Number(radius);
    if (!(r > HUGE_LIGHT_RADIUS_TILES)) return;
    findings.push({
      severity: "warning",
      code: "light-radius-huge",
      message: `광원 ${String(id ?? "?")} 반경이 ${r}칸입니다 — 반경은 픽셀이 아니라 칸 단위라 화면 전체가 밝아져 어둠(밤·암전)이 보이지 않습니다. 손등불은 3~4, 방 하나는 6~8칸으로 줄이세요.`,
      where,
    });
  };
  for (const map of Object.values(project.maps)) {
    for (const source of map.defaultLighting?.sources ?? []) flag(source.radius, source.id, { mapId: map.id, mapName: map.name });
  }
  for (const page of allPages(project)) {
    visitPageCommands(page, ({ command, where }) => {
      if (command.kind !== "addLight") return;
      const source = command.source as { radius?: unknown; id?: unknown } | undefined;
      flag(source?.radius, source?.id, where);
    });
  }
  return findings;
}

export function summarizeMaps(project: Project, graph: MapGraph): MapSummary[] {
  return Object.values(project.maps).map((map) => ({
    id: map.id, name: map.name, width: map.width, height: map.height, events: map.events?.length ?? 0,
    tilesetId: map.tilesetId, reachable: graph.reachable.has(map.id), inbound: graph.inbound.get(map.id) ?? 0,
    ...(map.climate ? { climate: map.climate.mode === "fixed" ? `${map.climate.weather}` : map.climate.mode } : {}),
  }));
}
