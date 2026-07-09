import type { Command } from "@/project/types";

export type CommandRuntimeSupport = "runtime-full" | "runtime-partial" | "editor-only";

export type M2CommandCatalogEntry = {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly label: string;
  readonly existingKind?: Command["kind"];
  readonly runtimeSupport: CommandRuntimeSupport;
};

const RUNTIME_FULL_IDS = new Set([
  "m2-014-change-parameters",
  "m2-019-change-state",
  "m2-021-damage-processing",
  "m2-024-change-actor-graphic",
  "m2-046-tint-screen",
  "m2-047-flash-screen",
  "m2-048-shake-screen",
  "m2-049-scroll-map",
  "m2-050-set-weather-effects",
  "m2-052-move-picture",
  "m2-058-wait-for-all-movement",
  "m2-091-change-actor-class",
  "m2-098-change-enemy-hp",
  "m2-101-enemy-encounter",
  "m2-102-change-battleback",
  "m2-107-force-escape",
  "m2-108-action-times",
  "m2-201-camera-control",
  "m2-203-spawn-event",
  "m2-204-remove-event",
]);

const EDITOR_ONLY_IDS = new Set([
  "m2-088-comment",
  "m2-099-change-enemy-mp",
  "m2-100-change-enemy-state",
  "m2-103-show-animation",
  "m2-104-battle-events",
  "m2-105-abort-battle",
  "m2-106-call-common-event",
]);

const TITLE_BY_ID: Readonly<Record<string, string>> = {
  "m2-002-display-text-settings": "Display Text Settings",
  "m2-014-change-parameters": "Change Parameters",
  "m2-019-change-state": "Change State",
  "m2-021-damage-processing": "Damage Processing",
  "m2-022-change-actor-name": "Change Actor Name",
  "m2-023-change-actor-nickname": "Change Actor Nickname",
  "m2-024-change-actor-graphic": "Change Actor Graphic",
  "m2-025-change-actor-faceset": "Change Actor Faceset",
  "m2-044-hide-screen": "Hide Screen",
  "m2-045-show-screen": "Show Screen",
  "m2-046-tint-screen": "Tint Screen",
  "m2-047-flash-screen": "Flash Screen",
  "m2-048-shake-screen": "Shake Screen",
  "m2-049-scroll-map": "Scroll Map",
  "m2-050-set-weather-effects": "Set Weather Effects",
  "m2-052-move-picture": "Move Picture",
  "m2-058-wait-for-all-movement": "Wait for All Movement",
  "m2-059-stop-all-movement": "Stop All Movement",
  "m2-063-memorize-current-bgm": "Memorize Current BGM",
  "m2-064-play-memorized-bgm": "Play Memorized BGM",
  "m2-073-teleportation-on-off": "Teleportation On/Off",
  "m2-075-change-escape-access": "Change Escape Access",
  "m2-076-open-save-menu": "Open Save Menu",
  "m2-077-change-save-access": "Change Save Access",
  "m2-078-open-menu-screen": "Open Menu Screen",
  "m2-079-change-menu-access": "Change Menu Access",
  "m2-085-end-event-processing": "End Event Processing",
  "m2-086-erase-event": "Erase Event",
  "m2-088-comment": "Comment",
  "m2-091-change-actor-class": "Change Actor Class",
  "m2-092-change-battle-commands": "Change Battle Commands",
  "m2-094-exit-game": "Exit Game",
  "m2-095-toggle-atb-wait-mode": "Toggle ATB Wait Mode",
  "m2-096-toggle-fullscreen-mode": "Toggle Fullscreen Mode",
  "m2-097-open-video-options": "Open Video Options",
  "m2-098-change-enemy-hp": "Change Enemy HP",
  "m2-099-change-enemy-mp": "Change Enemy MP",
  "m2-100-change-enemy-state": "Change Enemy State",
  "m2-101-enemy-encounter": "Enemy Encounter",
  "m2-102-change-battleback": "Change Battleback",
  "m2-103-show-animation": "Show Animation",
  "m2-104-battle-events": "Battle Events",
  "m2-105-abort-battle": "Abort Battle",
  "m2-106-call-common-event": "Call Common Event",
  "m2-107-force-escape": "Force Escape",
  "m2-108-action-times": "Action Times +",
  "m2-201-camera-control": "Camera Control",
  "m2-202-screen-effect": "Screen Effect",
  "m2-203-spawn-event": "Spawn Event",
  "m2-204-remove-event": "Remove Event",
  "m2-206-wait-until": "Wait Until",
  "m2-209-advanced-dialogue": "Advanced Dialogue",
  "m2-210-sound-layer": "Sound Layer",
  "m2-213-checkpoint-save": "Checkpoint Save",
};

const EXISTING_KIND_BY_ID: Readonly<Record<string, Command["kind"]>> = {
  "m2-002-display-text-settings": "displayTextSettings",
};

export function m2CommandById(commandId: string): M2CommandCatalogEntry | undefined {
  const index = indexFromId(commandId);
  if (index === null) return undefined;
  const title = TITLE_BY_ID[commandId] ?? titleFromId(commandId);
  return {
    id: commandId,
    index,
    title,
    label: title,
    existingKind: EXISTING_KIND_BY_ID[commandId],
    runtimeSupport: runtimeSupport(commandId),
  };
}

function runtimeSupport(commandId: string): CommandRuntimeSupport {
  if (RUNTIME_FULL_IDS.has(commandId)) return "runtime-full";
  if (EDITOR_ONLY_IDS.has(commandId)) return "editor-only";
  return "runtime-partial";
}

function indexFromId(commandId: string): number | null {
  const match = /^m2-(\d{3})-/u.exec(commandId);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) ? index : null;
}

function titleFromId(commandId: string): string {
  const slug = commandId.replace(/^m2-\d{3}-/u, "");
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/\bBgm\b/gu, "BGM")
    .replace(/\bSe\b/gu, "SE")
    .replace(/\bHp\b/gu, "HP")
    .replace(/\bMp\b/gu, "MP")
    .replace(/\bExp\b/gu, "EXP")
    .replace(/\bAtb\b/gu, "ATB")
    .replace(/\bId\b/gu, "ID")
    .replace(/\bUi\b/gu, "UI");
}
