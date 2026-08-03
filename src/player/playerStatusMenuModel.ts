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

/** 레일 그룹 — 13개 명령을 평면 나열하면 "아이템"과 "타이틀"이 같은 위계로 읽힌다. */
export const STATUS_MENU_COMMAND_GROUP_IDS = ["action", "party", "record", "system"] as const;
export type StatusMenuCommandGroupId = (typeof STATUS_MENU_COMMAND_GROUP_IDS)[number];

/** 그룹별 명령 순서. 커서 이동은 listStatusMenuCommandIds 의 배열 순서를 그대로 따르므로
    이 순서가 곧 화면 순서이자 ↑↓ 순서가 된다. */
const STATUS_MENU_COMMAND_GROUPS: readonly {
  readonly id: StatusMenuCommandGroupId;
  readonly label: string;
  readonly commandIds: readonly StatusMenuCommandId[];
}[] = [
  { id: "action", label: "행동", commandIds: ["items", "skills", "equipment"] },
  { id: "party", label: "파티", commandIds: ["status", "row", "formation", "monsters"] },
  { id: "record", label: "기록", commandIds: ["quests", "relationships"] },
  // to-title 은 진행 손실 위험이 있는 파괴적 액션이므로 항상 마지막.
  { id: "system", label: "시스템", commandIds: ["save", "load", "wait", "to-title"] },
];

/** 되돌릴 수 없는(또는 진행을 잃는) 명령 — 레일에서 시각적으로 분리한다. */
export const STATUS_MENU_DESTRUCTIVE_COMMAND_IDS: readonly StatusMenuCommandId[] = ["to-title"];

export function statusMenuCommandGroupLabel(groupId: StatusMenuCommandGroupId): string {
  const group = STATUS_MENU_COMMAND_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`Unknown status menu command group: ${groupId}`);
  return group.label;
}

export type StatusMenuCommand = {
  readonly id: StatusMenuCommandId;
  readonly label: string;
  readonly groupId: StatusMenuCommandGroupId;
  /** 그룹의 첫 항목 — 렌더러가 이 앞에 그룹 라벨/구분선을 넣는다. */
  readonly groupStart: boolean;
  readonly destructive: boolean;
};

export type PlayerStatusMenuPartyRow = {
  readonly actorId: string;
  readonly name: string;
  readonly levelLabel: string;
  readonly condition: string;
  readonly faceResourceId?: string;
  readonly hpLabel: string;
  readonly mpLabel: string;
  /** 0~1. 숫자만으로는 파티 4명 상태를 한눈에 못 읽어 게이지를 함께 그린다. */
  readonly hpRatio: number;
  readonly mpRatio: number;
  /** 게이지 임계 — safe(>50%) / warn(>25%) / crit(<=25%). */
  readonly hpLevel: PartyVitalLevel;
};

export type PartyVitalLevel = "crit" | "safe" | "warn";

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
  // 그룹 순서대로 평탄화 — 화면 순서와 ↑↓ 이동 순서를 한 배열이 결정한다.
  return STATUS_MENU_COMMAND_GROUPS.flatMap((group) => group.commandIds).filter((id) => {
    if (id === "relationships") return showRelationships;
    if (id === "save") return !saveDisabled;
    return true;
  });
}

function commandGroupIdOf(commandId: StatusMenuCommandId): StatusMenuCommandGroupId {
  const group = STATUS_MENU_COMMAND_GROUPS.find((candidate) => candidate.commandIds.includes(commandId));
  if (!group) throw new Error(`Status menu command is not assigned to a group: ${commandId}`);
  return group.id;
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
    const hpRatio = vitalRatio(vitals?.hp, vitals?.maxHp);
    return [{
      actorId,
      name: resolveActorName(session, actor),
      levelLabel: `L${level}`,
      condition: "정상",
      faceResourceId: resolveActorFaceResourceId(session, actor) ?? defaultActorFaceResourceId(actor),
      hpLabel: vitals ? `${hpTerm} ${vitals.hp}/${vitals.maxHp}` : `${hpTerm} 0/0`,
      mpLabel: vitals ? `${mpTerm} ${vitals.mp}/${vitals.maxMp}` : `${mpTerm} 0/0`,
      hpRatio,
      mpRatio: vitalRatio(vitals?.mp, vitals?.maxMp),
      hpLevel: partyVitalLevel(hpRatio),
    }];
  });
  const seenGroups = new Set<StatusMenuCommandGroupId>();
  const commands = listStatusMenuCommandIds(project, session).map((id): StatusMenuCommand => {
    const groupId = commandGroupIdOf(id);
    const groupStart = !seenGroups.has(groupId);
    seenGroups.add(groupId);
    return {
      id,
      label: statusMenuCommandLabel(id, options.waitModeEnabled ?? true),
      groupId,
      groupStart,
      destructive: STATUS_MENU_DESTRUCTIVE_COMMAND_IDS.includes(id),
    };
  });

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

/** 0 나눗셈·음수·NaN 을 모두 0~1 로 눌러 게이지 폭 계산이 절대 깨지지 않게 한다. */
function vitalRatio(current: number | undefined, max: number | undefined): number {
  if (!Number.isFinite(current) || !Number.isFinite(max)) return 0;
  const total = max as number;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (current as number) / total));
}

export function partyVitalLevel(ratio: number): PartyVitalLevel {
  if (ratio <= 0.25) return "crit";
  if (ratio <= 0.5) return "warn";
  return "safe";
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
