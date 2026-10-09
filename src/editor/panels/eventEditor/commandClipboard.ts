import type { Command } from "@/project/types";

let commandClipboard: Command[] = [];

export function copyEventCommandToClipboard(command: Command): void {
  copyEventCommandsToClipboard([command]);
}

export function readEventCommandClipboard(): Command | null {
  return readEventCommandsClipboard()[0] ?? null;
}

export function hasEventCommandClipboard(): boolean {
  return commandClipboard.length > 0;
}

export function copyEventCommandsToClipboard(commands: readonly Command[]): void {
  commandClipboard = structuredClone([...commands]);
}

export function readEventCommandsClipboard(): Command[] {
  return structuredClone(commandClipboard);
}
