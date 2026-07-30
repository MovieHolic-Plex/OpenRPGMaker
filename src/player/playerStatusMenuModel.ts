import { defaultActorFaceResourceId } from "@/project/actorModel";
import type { PlaySession } from "@/project/session";
import { resolveActorName, resolveActorFaceResourceId } from "@/project/sessionActorCommands";
import { isGiftSystemEnabled } from "@/project/friendship";
import { resolveTerms } from "@/project/terms";
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
  "relationships",
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
/** O3: hide 관계 rail unless giftSystem or any known friendship keys. */
export function listStatusMenuCommandIds(project: Project, session: PlaySession): StatusMenuCommandId[] {
  const showRelationships =
    isGiftSystemEnabled(project) || Object.keys(session.friendship ?? {}).length > 0;
  // Change Save Access: false면 메뉴의 저장 항목을 숨긴다(세이브 포인트 전용 설계).
  const saveDisabled = session.m2Runtime?.access?.save === false;
  return STATUS_MENU_COMMAND_IDS.filter((id) => {
    if (id === "relationships") return showRelationships;
    if (id === "save") return !saveDisabled;
    return true;
  });
}


export function createPlayerStatusMenuSnapshot(
  project: Project,
  session: PlaySession,
  options: StatusMenuSnapshotOptions = {}
): PlayerStatusMenuSnapshot {
  const actorsById = new Map(project.database.actors.map((actor) => [actor.id, actor]));
  const terms = resolveTerms(project);
  const hpTerm = terms.hp;
  const mpTerm = terms.mp;
  const partyRows = session.partyActorIds.flatMap((actorId): PlayerStatusMenuPartyRow[] => {
    const actor = actorsById.get(actorId);
    if (!actor) return [];
    const vitals = session.actorVitals[actorId];
    const level = session.actorLevels[actorId] ?? actor.initialLevel;
    return [{
      actorId,
      name: resolveActorName(session, actor),
      levelLabel: `L${level}`,
      condition: "정상",
      faceResourceId: resolveActorFaceResourceId(session, actor) ?? defaultActorFaceResourceId(actor),
      hpLabel: vitals ? `${hpTerm} ${vitals.hp}/${vitals.maxHp}` : `${hpTerm} 0/0`,
      mpLabel: vitals ? `${mpTerm} ${vitals.mp}/${vitals.maxMp}` : `${mpTerm} 0/0`,
    }];
  });
  const commands = listStatusMenuCommandIds(project, session).map((id) => ({
    id,
    label: statusMenuCommandLabel(id, options.waitModeEnabled ?? true),
  }));

  return {
    commands,
    commandLabels: commands.map((command) => command.label),
    partyRows,
    goldLabel: `${terms.goldPrefix}${session.gold}${terms.gold}`,
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
    // "열" 한 글자는 "열다"로 읽혀 무슨 기능인지 알 수 없다(전열/후열 교체).
    case "row": return "열 바꾸기";
    case "formation": return "진형";
    case "quests": return "임무";
    case "relationships": return "관계";
    // 레일 폭(60px)이 좁아 "전투 대기 ON" 은 말줄임으로 잘리고, 레일을 넓히면
    // 오른쪽 상세 패널이 좁아져 값이 잘린다. 라벨은 짧게 두고 무엇이 대기하는지는
    // 상세 패널 제목("전투 대기")과 설명이 알려준다.
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
