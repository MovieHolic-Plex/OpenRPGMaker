import type { Command } from "@/project/types";

export type CommandRuntimeSupport = "runtime-full" | "runtime-partial" | "editor-only";

export type CommandRuntimeSupportBadge = {
  readonly support: Exclude<CommandRuntimeSupport, "runtime-full">;
  readonly label: string;
  readonly icon: string;
  readonly tooltip: string;
};

const M2_RUNTIME_FULL_IDS: ReadonlySet<string> = new Set([
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
  "m2-098-change-enemy-hp",
  "m2-201-camera-control",
  "m2-203-spawn-event",
  "m2-204-remove-event",
  "m2-101-enemy-encounter",
  "m2-102-change-battleback",
  "m2-107-force-escape",
  "m2-108-action-times",
]);

const M2_EDITOR_ONLY_IDS: ReadonlySet<string> = new Set([
  "m2-088-comment",
  "m2-099-change-enemy-mp",
  "m2-100-change-enemy-state",
  "m2-103-show-animation",
  "m2-104-battle-events",
  "m2-105-abort-battle",
  "m2-106-call-common-event",
]);

export function commandRuntimeSupport(command: Command): CommandRuntimeSupport {
  if (command.kind !== "m2Command") return "runtime-full";
  return m2CommandRuntimeSupport(command.commandId);
}

export function m2CommandRuntimeSupport(commandId: string): CommandRuntimeSupport {
  if (M2_RUNTIME_FULL_IDS.has(commandId)) return "runtime-full";
  if (M2_EDITOR_ONLY_IDS.has(commandId)) return "editor-only";
  return "runtime-partial";
}

export function catalogRowRuntimeSupport(commandId: string, existingKind: Command["kind"] | undefined): CommandRuntimeSupport {
  if (existingKind) return "runtime-full";
  return m2CommandRuntimeSupport(commandId);
}

export function runtimeSupportBadge(support: CommandRuntimeSupport): CommandRuntimeSupportBadge | null {
  if (support === "runtime-full") return null;
  if (support === "runtime-partial") {
    return {
      support,
      label: "부분 실행",
      icon: "△",
      tooltip: "이 명령은 런타임에서 기록되거나 일부 효과만 실행됩니다.",
    };
  }
  return {
    support,
    label: "에디터 전용",
    icon: "!",
    tooltip: "이 명령은 아직 런타임에서 실행되지 않습니다.",
  };
}
