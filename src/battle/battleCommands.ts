import type { ClassBattleCommand, ClassBattleCommandKind, Project, SkillId } from "@/project/types";

export type RuntimeBattleCommandKind = "attack" | "skill" | "item" | "defend" | "escape" | "switch";

export interface RuntimeBattleCommand {
  readonly id: string;
  readonly name: string;
  readonly kind: RuntimeBattleCommandKind;
  readonly skillSubsetName?: string;
  readonly skillId?: SkillId;
}

export const DEFAULT_RUNTIME_BATTLE_COMMANDS: readonly RuntimeBattleCommand[] = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "스킬", kind: "skill" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
];

export function battleCommandsForActor(
  project: Project,
  actorRecordId: string | undefined,
  options: { readonly includeSwitch?: boolean; readonly forceSwitchOnly?: boolean; readonly classId?: string } = {}
): readonly RuntimeBattleCommand[] {
  if (options.forceSwitchOnly) return [switchCommand()];
  const actor = actorRecordId ? project.database.actors.find((record) => record.id === actorRecordId) : undefined;
  const klass = actor ? project.database.classes.find((record) => record.id === (options.classId ?? actor.classId)) : undefined;
  const source = klass?.battleCommands ?? [];
  const commands = source
    .map((command) => resolveClassBattleCommand(project, command))
    .filter((command): command is RuntimeBattleCommand => command !== undefined)
    .filter((command) => options.includeSwitch || command.kind !== "switch");
  const base = commands.length > 0 ? commands : DEFAULT_RUNTIME_BATTLE_COMMANDS;
  if (!options.includeSwitch || base.some((command) => command.kind === "switch")) return base;
  return [...base, switchCommand()];
}

function resolveClassBattleCommand(project: Project, command: ClassBattleCommand): RuntimeBattleCommand | undefined {
  const global = project.database.battleCommands?.find((record) => record.id === command.id);
  const kind = runtimeKind(command.kind, global?.kind);
  if (!kind) return undefined;
  return {
    id: command.id,
    name: command.name || global?.name || fallbackCommandName(kind),
    kind,
    skillSubsetName: command.skillSubsetName ?? global?.skillSubsetName,
    skillId: command.skillId ?? global?.skillId,
  };
}

function runtimeKind(kind: ClassBattleCommandKind, fallback: ClassBattleCommandKind | undefined): RuntimeBattleCommandKind | undefined {
  const normalized = normalizeKind(kind);
  if (normalized) return normalized;
  return fallback ? normalizeKind(fallback) : undefined;
}

function normalizeKind(kind: ClassBattleCommandKind): RuntimeBattleCommandKind | undefined {
  switch (kind) {
    case "attack":
    case "skill":
    case "item":
    case "escape":
      return kind;
    case "switch":
      return "switch";
    case "skillSubset":
      return "skill";
    case "defend":
    case "guard":
      return "defend";
    case "event":
      return "switch";
  }
}

function fallbackCommandName(kind: RuntimeBattleCommandKind): string {
  switch (kind) {
    case "attack":
      return "공격";
    case "skill":
      return "스킬";
    case "item":
      return "아이템";
    case "defend":
      return "방어";
    case "escape":
      return "도주";
    case "switch":
      return "교체";
  }
}

function switchCommand(): RuntimeBattleCommand {
  return { id: "cmd_switch", name: "교체", kind: "switch" };
}
