import type { ClassBattleCommand, ClassBattleCommandKind, Project, SkillId } from "@/project/types";
import { resolveTerms } from "@/project/terms";

export type RuntimeBattleCommandKind = "attack" | "skill" | "item" | "capture" | "defend" | "escape" | "switch" | "commonEvent";

export interface RuntimeBattleCommand {
  readonly id: string;
  readonly name: string;
  readonly kind: RuntimeBattleCommandKind;
  readonly skillSubsetName?: string;
  readonly skillId?: SkillId;
  /** kind "commonEvent" — 고르면 실행할 공통 이벤트. */
  readonly commonEventId?: string;
}

export const DEFAULT_RUNTIME_BATTLE_COMMANDS: readonly RuntimeBattleCommand[] = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "스킬", kind: "skill" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
];

/**
 * 이벤트로 명령을 바꾸기 전 이 배우의 메뉴 id(배우 고유 목록 > 직업 명령). 「전투 명령 변경」의 더하기·빼기는
 * 이 목록 위에서 한다 — 빈 목록에서 시작하면 「더하기」 한 번에 공격·스킬이 모두 사라졌다(2026-10-02).
 */
export function baseBattleCommandIds(project: Project, actorRecordId: string, classId?: string): string[] {
  const actor = project.database.actors.find((record) => record.id === actorRecordId);
  const klass = project.database.classes.find((record) => record.id === (classId ?? actor?.classId));
  const actorIds = actor?.battleCommandIds?.filter((id) =>
    project.database.battleCommands?.some((record) => record.id === id) || klass?.battleCommands.some((entry) => entry.id === id));
  if (actorIds?.length) return [...actorIds];
  return (klass?.battleCommands ?? []).map((command) => command.id);
}

export function battleCommandsForActor(
  project: Project,
  actorRecordId: string | undefined,
  options: {
    readonly includeSwitch?: boolean;
    readonly forceSwitchOnly?: boolean;
    readonly classId?: string;
    readonly overrideCommandIds?: readonly string[];
    /** 장착 장비가 주는 명령(EquipmentRuntimeEffects.grantedCommands). 이동·교체 앞에 붙는다. */
    readonly grantedCommands?: readonly ClassBattleCommand[];
  } = {}
): readonly RuntimeBattleCommand[] {
  if (options.forceSwitchOnly) return [switchCommand()];
  const actor = actorRecordId ? project.database.actors.find((record) => record.id === actorRecordId) : undefined;
  const klass = actor ? project.database.classes.find((record) => record.id === (options.classId ?? actor.classId)) : undefined;
  // 우선순위: 전투 중 이벤트로 바꾼 명령 > 배우 고유 명령(ActorRecord.battleCommandIds, RM2003 배우별 명령) > 직업 명령.
  // 배우 고유 목록은 전역·직업 목록에 있는 id 만 쓴다(지운 명령이 「공격」으로 둔갑하지 않게).
  const actorIds = actor?.battleCommandIds?.length ? baseBattleCommandIds(project, actor.id, klass?.id) : undefined;
  const overrideIds = options.overrideCommandIds?.length ? options.overrideCommandIds : actorIds;
  let source: readonly ClassBattleCommand[] = klass?.battleCommands ?? [];
  if (overrideIds && overrideIds.length > 0) {
    source = overrideIds.map((id) => {
      const global = project.database.battleCommands?.find((record) => record.id === id);
      const fromClass = klass?.battleCommands.find((entry) => entry.id === id);
      return {
        id,
        name: fromClass?.name ?? global?.name ?? id,
        kind: fromClass?.kind ?? global?.kind ?? "attack",
        skillSubsetName: fromClass?.skillSubsetName ?? global?.skillSubsetName,
        skillId: fromClass?.skillId ?? global?.skillId,
        commonEventId: fromClass?.commonEventId ?? global?.commonEventId,
      } satisfies ClassBattleCommand;
    });
  }
  const commands = source
    .map((command) => resolveClassBattleCommand(project, command))
    .filter((command): command is RuntimeBattleCommand => command !== undefined)
    .filter((command) => project.system.monsterCollection === true || command.kind !== "capture")
    .filter((command) => options.includeSwitch || command.kind !== "switch");
  const granted = (options.grantedCommands ?? [])
    .map((command) => resolveClassBattleCommand(project, command))
    .filter((command): command is RuntimeBattleCommand => command !== undefined && command.kind !== "switch" && command.kind !== "capture")
    .filter((command) => !commands.some((existing) => existing.id === command.id));
  const base = withMonsterCaptureCommand(project, [...(commands.length > 0 ? commands : defaultRuntimeBattleCommands(project)), ...granted]);
  if (!options.includeSwitch || base.some((command) => command.kind === "switch")) return base;
  return [...base, switchCommand()];
}

function resolveClassBattleCommand(project: Project, command: ClassBattleCommand): RuntimeBattleCommand | undefined {
  const global = project.database.battleCommands?.find((record) => record.id === command.id);
  const kind = runtimeKind(command.kind, global?.kind);
  if (!kind) return undefined;
  const commonEventId = command.commonEventId ?? global?.commonEventId;
  // 공통 이벤트가 없거나 지워진 「이벤트 연결」 명령은 눌러도 아무 일이 없으므로 메뉴에서 뺀다.
  if (kind === "commonEvent" && !(commonEventId && project.commonEvents.some((entry) => entry.id === commonEventId))) return undefined;
  return {
    id: command.id,
    name: command.name || global?.name || fallbackCommandName(project, kind),
    kind,
    skillSubsetName: command.skillSubsetName ?? global?.skillSubsetName,
    skillId: command.skillId ?? global?.skillId,
    ...(kind === "commonEvent" ? { commonEventId } : {}),
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
    case "capture":
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
    case "commonEvent":
      return "commonEvent";
  }
}

function defaultRuntimeBattleCommands(project: Project): readonly RuntimeBattleCommand[] {
  return DEFAULT_RUNTIME_BATTLE_COMMANDS.map((command) => ({
    ...command,
    name: fallbackCommandName(project, command.kind),
  }));
}

function fallbackCommandName(project: Project, kind: RuntimeBattleCommandKind): string {
  const terms = resolveTerms(project);
  switch (kind) {
    case "attack":
      return terms.attack;
    case "skill":
      return terms.skill;
    case "item":
      return terms.item;
    case "capture":
      return terms.capture;
    case "defend":
      return terms.defend;
    case "escape":
      return terms.escape;
    case "switch":
      return "교체";
    case "commonEvent":
      return "특수";
  }
}

function switchCommand(): RuntimeBattleCommand {
  return { id: "cmd_switch", name: "교체", kind: "switch" };
}

function captureCommand(project: Project): RuntimeBattleCommand {
  return { id: "cmd_capture", name: resolveTerms(project).capture, kind: "capture" };
}

function withMonsterCaptureCommand(project: Project, commands: readonly RuntimeBattleCommand[]): readonly RuntimeBattleCommand[] {
  if (project.system.monsterCollection !== true || commands.some((command) => command.kind === "capture")) return commands;
  return [...commands, captureCommand(project)];
}
