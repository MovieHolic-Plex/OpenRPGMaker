import type { Command } from "@/project/types";

let commandClipboard: Command | null = null;

export function copyEventCommandToClipboard(command: Command): void {
  commandClipboard = structuredClone(command);
}

export function readEventCommandClipboard(): Command | null {
  return commandClipboard ? structuredClone(commandClipboard) : null;
}

export function hasEventCommandClipboard(): boolean {
  return commandClipboard !== null;
}
