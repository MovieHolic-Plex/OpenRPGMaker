import type { Command, GameEvent, MapId, Project } from "@/project/types";

export type MapLinkStats = {
  readonly outgoingTransfers: number;
  readonly incomingTransfers: number;
  readonly connections: number;
  readonly playLinkCount: number;
};

export function collectMapLinkStats(project: Project, mapId: MapId): MapLinkStats {
  let outgoingTransfers = 0;
  let incomingTransfers = 0;
  for (const map of Object.values(project.maps)) {
    for (const command of mapTransferCommands(map.events)) {
      if (map.id === mapId && command.mapId !== mapId) outgoingTransfers += 1;
      if (map.id !== mapId && command.mapId === mapId) incomingTransfers += 1;
    }
  }
  const connections = (project.mapConnections ?? []).filter(
    (connection) => connection.from.mapId === mapId || connection.to.mapId === mapId,
  ).length;
  return {
    outgoingTransfers,
    incomingTransfers,
    connections,
    playLinkCount: outgoingTransfers + incomingTransfers + connections,
  };
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
