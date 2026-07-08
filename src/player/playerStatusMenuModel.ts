import { defaultActorFaceResourceId } from "@/project/actorModel";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export const STATUS_MENU_COMMAND_IDS = [
  "items",
  "skills",
  "equipment",
  "monsters",
  "save",
  "load",
  "status",
  "row",
  "formation",
  "quests",
  "wait",
  "to-title",
] as const;

export type StatusMenuCommandId = (typeof STATUS_MENU_COMMAND_IDS)[number];

export type StatusMenuCommand = {
  readonly id: StatusMenuCommandId;
  readonly label: string;
};

export type PlayerStatusMenuPartyRow = {
  readonly actorId: string;
  readonly name: string;
  readonly levelLabel: string;
  readonly condition: string;
  readonly faceResourceId?: string;
  readonly hpLabel: string;
  readonly mpLabel: string;
};

export type PlayerStatusMenuSnapshot = {
  readonly commands: readonly StatusMenuCommand[];
  readonly commandLabels: readonly string[];
  readonly partyRows: readonly PlayerStatusMenuPartyRow[];
  readonly goldLabel: string;
  readonly timeLabel: string;
  readonly emptyPartyLabel: string | null;
};

export type StatusMenuSnapshotOptions = {
  readonly elapsedMs?: number;
  readonly waitModeEnabled?: boolean;
};

export function createPlayerStatusMenuSnapshot(
  project: Project,
  session: PlaySession,
  options: StatusMenuSnapshotOptions = {}
): PlayerStatusMenuSnapshot {
  const actorsById = new Map(project.database.actors.map((actor) => [actor.id, actor]));
  const hpTerm = project.meta.terms.hp ?? "HP";
  const mpTerm = project.meta.terms.mp ?? "MP";
  const partyRows = session.partyActorIds.flatMap((actorId): PlayerStatusMenuPartyRow[] => {
    const actor = actorsById.get(actorId);
    if (!actor) return [];
    const vitals = session.actorVitals[actorId];
    const level = session.actorLevels[actorId] ?? actor.initialLevel;
    return [{
      actorId,
      name: actor.name,
      levelLabel: `L${level}`,
      condition: "정상",
      faceResourceId: actor.faceResourceId ?? defaultActorFaceResourceId(actor),
      hpLabel: vitals ? `${hpTerm} ${vitals.hp}/${vitals.maxHp}` : `${hpTerm} 0/0`,
      mpLabel: vitals ? `${mpTerm} ${vitals.mp}/${vitals.maxMp}` : `${mpTerm} 0/0`,
    }];
  });
  const commands = STATUS_MENU_COMMAND_IDS.map((id) => ({
    id,
    label: statusMenuCommandLabel(id, options.waitModeEnabled ?? true),
  }));

  return {
    commands,
    commandLabels: commands.map((command) => command.label),
    partyRows,
    goldLabel: `돈 ${session.gold}${project.meta.terms.gold || "G"}`,
    timeLabel: formatElapsedTime(options.elapsedMs ?? 0),
    emptyPartyLabel: partyRows.length === 0 ? "파티원이 없습니다" : null,
  };
}

export function statusMenuCommandLabel(commandId: StatusMenuCommandId, waitModeEnabled: boolean): string {
  switch (commandId) {
    case "items": return "아이템";
    case "skills": return "스킬";
    case "equipment": return "장비";
    case "monsters": return "몬스터";
    case "save": return "저장";
    case "load": return "로드";
    case "status": return "상태";
    case "row": return "열";
    case "formation": return "진형";
    case "quests": return "임무";
    case "wait": return waitModeEnabled ? "대기 ON" : "대기 OFF";
    case "to-title": return "타이틀";
    default: return assertNever(commandId);
  }
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu command: ${String(value)}`);
}
