import type { Command, GameEvent, MapId, Project } from "@/project/types";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";

export type MapLinkStats = {
  readonly outgoingTransfers: number;
  readonly incomingTransfers: number;
  readonly connections: number;
  readonly playLinkCount: number;
};

type LinkIndex = {
  readonly outgoingTransfers: ReadonlyMap<MapId, number>;
  readonly incomingTransfers: ReadonlyMap<MapId, number>;
  readonly connections: ReadonlyMap<MapId, number>;
};

// 맵 목록은 한 번의 렌더에서 같은 프로젝트의 모든 맵에 대해 이 함수를 호출한다.
// 예전에는 호출마다 모든 맵의 이벤트와 모든 transfer 명령을 다시 순회해
// O(맵 수 × 전체 이벤트 수)가 됐다. store는 편집 시 새 Project 객체를 만들므로
// 프로젝트 객체 identity를 캐시 키로 쓰면 편집 후 자동으로 무효화된다.
const indexCache = new WeakMap<Project, LinkIndex>();

export function collectMapLinkStats(project: Project, mapId: MapId): MapLinkStats {
  const index = linkIndexFor(project);
  return {
    outgoingTransfers: index.outgoingTransfers.get(mapId) ?? 0,
    incomingTransfers: index.incomingTransfers.get(mapId) ?? 0,
    connections: index.connections.get(mapId) ?? 0,
    playLinkCount:
      (index.outgoingTransfers.get(mapId) ?? 0)
      + (index.incomingTransfers.get(mapId) ?? 0)
      + (index.connections.get(mapId) ?? 0),
  };
}

function linkIndexFor(project: Project): LinkIndex {
  const cached = indexCache.get(project);
  if (cached) return cached;

  const outgoingTransfers = new Map<MapId, number>();
  const incomingTransfers = new Map<MapId, number>();
  const connections = new Map<MapId, number>();
  for (const map of Object.values(project.maps)) {
    for (const command of mapTransferCommands(map.events)) {
      if (command.mapId === map.id) continue;
      outgoingTransfers.set(map.id, (outgoingTransfers.get(map.id) ?? 0) + 1);
      incomingTransfers.set(command.mapId, (incomingTransfers.get(command.mapId) ?? 0) + 1);
    }
  }
  for (const connection of project.mapConnections ?? []) {
    connections.set(connection.from.mapId, (connections.get(connection.from.mapId) ?? 0) + 1);
    if (connection.to.mapId !== connection.from.mapId) {
      connections.set(connection.to.mapId, (connections.get(connection.to.mapId) ?? 0) + 1);
    }
  }

  const index: LinkIndex = { outgoingTransfers, incomingTransfers, connections };
  indexCache.set(project, index);
  return index;
}

function mapTransferCommands(events: readonly GameEvent[]): Extract<Command, { kind: "transfer" }>[] {
  const out: Extract<Command, { kind: "transfer" }>[] = [];
  for (const event of events) {
    if (event.pages?.length) {
      for (const page of event.pages) walkCommands(page.commands, out);
    } else {
      walkCommands(event.commands, out);
    }
  }
  return out;
}

function walkCommands(commands: readonly Command[], out: Extract<Command, { kind: "transfer" }>[]): void {
  for (const command of commands) {
    if (command.kind === "transfer") out.push(command);
    if (command.kind === "choices") {
      for (const option of command.options) walkCommands(option.branch, out);
      if (command.cancelBranch) walkCommands(command.cancelBranch, out);
    }
    if (command.kind === "presentItem") for (const branch of presentItemBranchLists(command)) walkCommands(branch, out);
    if (command.kind === "fork") {
      walkCommands(command.then, out);
      if (command.else) walkCommands(command.else, out);
    }
    if (command.kind === "loop") walkCommands(command.body, out);
    if (command.kind === "shop" && command.transactionBranch) walkCommands(command.transactionBranch, out);
  }
}

export type MapLinkEdge = {
  readonly from: MapId;
  readonly to: MapId;
  readonly kind: "transfer" | "connection";
  readonly eventId?: string;
  readonly x?: number;
  readonly y?: number;
};

export type MapLinkNode = {
  readonly mapId: MapId;
  readonly outgoing: readonly MapLinkEdge[];
  readonly incoming: readonly MapLinkEdge[];
  readonly isStart: boolean;
  readonly reachableFromStart: boolean;
};

const graphCache = new WeakMap<Project, readonly MapLinkNode[]>();

/**
 * 맵 사이 이동(transfer 이벤트)과 가장자리 연결을 간선으로 모으고, 시작 맵에서 닿는지 너비 우선으로 판정한다.
 * collectMapLinkStats 와 같은 명령 순회(walkCommands)를 쓰므로 두 표면의 「문 N·고립」이 어긋나지 않는다.
 */
export function collectMapLinkGraph(project: Project): readonly MapLinkNode[] {
  const cached = graphCache.get(project);
  if (cached) return cached;
  const edges: MapLinkEdge[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const command of mapTransferCommands([event])) {
        if (command.mapId === map.id || !project.maps[command.mapId]) continue;
        edges.push({ from: map.id, to: command.mapId, kind: "transfer", eventId: event.id, x: event.x, y: event.y });
      }
    }
  }
  for (const { from, to } of project.mapConnections ?? []) {
    if (from.mapId === to.mapId || !project.maps[from.mapId] || !project.maps[to.mapId]) continue;
    edges.push({ from: from.mapId, to: to.mapId, kind: "connection" }, { from: to.mapId, to: from.mapId, kind: "connection" });
  }
  const outgoing = new Map<MapId, MapLinkEdge[]>();
  const incoming = new Map<MapId, MapLinkEdge[]>();
  for (const edge of edges) {
    (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge);
    (incoming.get(edge.to) ?? incoming.set(edge.to, []).get(edge.to)!).push(edge);
  }
  const reachable = new Set<MapId>();
  const start = project.startMapId;
  if (start && project.maps[start]) {
    const queue: MapId[] = [start];
    reachable.add(start);
    for (let head = 0; head < queue.length; head += 1) {
      for (const edge of outgoing.get(queue[head]!) ?? []) {
        if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
      }
    }
  }
  const nodes = Object.keys(project.maps).map((mapId): MapLinkNode => ({
    mapId,
    outgoing: outgoing.get(mapId) ?? [],
    incoming: incoming.get(mapId) ?? [],
    isStart: mapId === start,
    reachableFromStart: reachable.has(mapId),
  }));
  graphCache.set(project, nodes);
  return nodes;
}
