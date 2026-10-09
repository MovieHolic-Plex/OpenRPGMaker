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
    if (events === 0 && inbound === 0) {
      // 시드 빈 맵은 조수가 시작 위치만 새 맵으로 옮기면 남는다. 플레이 경로가 아니라 막힘으로 세지 않는다
      // (2026-09-24 갤러리 r5: 엔딩은 출구 인형에 막혔는데 빈 시드 맵이 막힘 1건으로 같이 올랐다).
      const seedLeftBehind = map.id === "map_blank_start" && project.startMapId !== map.id;
      findings.push({
        severity: seedLeftBehind ? "warning" : "blocker",
        code: "orphan-empty-map",
        message: seedLeftBehind
          ? `시작 맵을 옮긴 뒤 남은 빈 시드 맵 ${map.name}(${map.id}) ${map.width}×${map.height} 입니다. 플레이에는 쓰이지 않습니다.`
          : `${map.name}(${map.id}) ${map.width}×${map.height} 은 이벤트도 들어오는 문도 없는 빈 껍데기 맵입니다 — 기획의 장소가 실제로는 만들어지지 않았을 수 있습니다.`,
        where,
      });
    } else if (!graph.reachable.has(map.id)) {
      findings.push({ severity: events > 0 ? "blocker" : "warning", code: "unreachable-map", message: `${map.name}(${map.id}) 은 시작 맵에서 문으로 갈 수 없습니다${inbound > 0 ? " (들어오는 문은 모두 못 가는 맵에 있습니다)" : ""}.`, where });
    }
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
