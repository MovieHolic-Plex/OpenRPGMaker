import type { Command, GameEvent, MapId, Project } from "@/project/types";

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
    if (command.kind === "fork") {
      walkCommands(command.then, out);
      if (command.else) walkCommands(command.else, out);
    }
    if (command.kind === "loop") walkCommands(command.body, out);
    if (command.kind === "shop" && command.transactionBranch) walkCommands(command.transactionBranch, out);
  }
}
