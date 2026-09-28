import { defaultActorFaceResourceId, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import type { PlaySession } from "@/project/session";
import { resolveActorName, resolveActorFaceResourceId } from "@/project/sessionActorCommands";
import { effectiveActorClassId } from "@/project/sessionClass";
import { isGalleryEnabled, galleryMenuLabel, listGalleryUnlocks } from "@/project/gallery";
import { currentChapterLabel } from "@/project/newGamePlus";
import { isGiftSystemEnabled } from "@/project/friendship";
import { resolveTerms } from "@/project/terms";
import type { Project } from "@/project/types";
import { hasLifeLedgerData } from "@/player/lifeLedger";
import { menuSkinFor } from "@/player/menuSkins/registry";
import { buildQuestLog } from "@/player/questLog";
import type { SaveSlotReadResult } from "@/player/saveSlots";
import type { MenuSkinRailStyle } from "@/player/menuSkins/types";

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
  "battle-reports",
  "quests",
  "relationships",
  "gallery",
  "life-ledger",
  "options",
  "wait",
  "to-title",
] as const;

export type StatusMenuCommandId = (typeof STATUS_MENU_COMMAND_IDS)[number];

/** 레일 그룹 — 명령을 평면 나열하면 "아이템"과 "타이틀"이 같은 위계로 읽힌다. */
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
  { id: "record", label: "기록", commandIds: ["battle-reports", "quests", "relationships", "gallery", "life-ledger"] },
  // to-title 은 진행 손실 위험이 있는 파괴적 액션이므로 항상 마지막.
  { id: "system", label: "시스템", commandIds: ["save", "load", "wait", "options", "to-title"] },
];

/** 되돌릴 수 없는(또는 진행을 잃는) 명령 — 레일에서 시각적으로 분리한다. */
export const STATUS_MENU_DESTRUCTIVE_COMMAND_IDS: readonly StatusMenuCommandId[] = ["to-title"];

/** 레일에 남는 "그룹 열기" 항목. 실제 기능이 아니라 해당 그룹의 명령 목록을 작업 영역에 띄운다.
    2열 레이아웃(좌: 레일+파티 / 우: 작업 영역)에서 좌측 가용 높이는 약 175px 인데
    명령 12개(11px 하한 = 132px) + 파티 4명 + 구분선이 이미 넘친다. 뒤쪽 두 그룹만 접어도
    레일 9개(117px) + 파티(71px) = 191px 로 여전히 넘쳐 파티 4번째가 잘렸다(실측).
    행동 3개만 펼치면 레일 75px + 파티 71px = 146px 로 여유가 생긴다. */
export const STATUS_MENU_GROUP_ENTRY_IDS = ["party-menu", "record-menu", "system-menu"] as const;
export type StatusMenuGroupEntryId = (typeof STATUS_MENU_GROUP_ENTRY_IDS)[number];

/** 레일이 실제로 그리는 항목 = 펼친 명령 + 접힌 그룹 열기 항목. */
export type StatusMenuRailId = StatusMenuCommandId | StatusMenuGroupEntryId;

/** 접어 둘 그룹 — 레일에는 그룹 열기 항목 하나만 남고, 실제 명령은 작업 영역에서 고른다. */
const COLLAPSED_GROUPS: readonly {
  readonly entryId: StatusMenuGroupEntryId;
  readonly groupId: StatusMenuCommandGroupId;
  readonly label: string;
}[] = [
  { entryId: "party-menu", groupId: "party", label: "파티 ▸" },
  { entryId: "record-menu", groupId: "record", label: "기록 ▸" },
  { entryId: "system-menu", groupId: "system", label: "시스템 ▸" },
];

export function isStatusMenuGroupEntryId(value: StatusMenuRailId): value is StatusMenuGroupEntryId {
  return (STATUS_MENU_GROUP_ENTRY_IDS as readonly string[]).includes(value);
}

export function statusMenuGroupEntryLabel(entryId: StatusMenuGroupEntryId): string {
  const group = COLLAPSED_GROUPS.find((candidate) => candidate.entryId === entryId);
  if (!group) throw new Error(`Unknown status menu group entry: ${entryId}`);
  return group.label;
}

/** 레일 구성은 스킨이 정한다 — collapsed(접힌 6항목) / flat(평탄 최대 10항목). */
export function statusMenuRailStyle(project: Project): MenuSkinRailStyle {
  return menuSkinFor(project).railStyle;
}

/** 평탄 레일 — 행동 3 + 파티 4 + 기록(하나면 그대로, 둘 이상이면 「기록 ▸」) + 저장 + 「시스템 ▸」(로드·대기·타이틀).
    최대 10항목. 컬러 아이콘 스킨은 레일에서 파티 패널을 빼서 높이가 남으므로 그룹을 펼 수 있다.
    저장은 자주 쓰는 명령이라 시스템 트레이 밖으로 꺼내고, 진행 손실 위험이 있는 타이틀은 여전히 트레이 안에 둔다. */
function flatRailIds(visible: readonly StatusMenuCommandId[]): StatusMenuRailId[] {
  const recordCount = visible.filter((id) => commandGroupIdOf(id) === "record").length;
  const out: StatusMenuRailId[] = [];
  for (const id of visible) {
    const group = commandGroupIdOf(id);
    if (group === "action" || group === "party") out.push(id);
    else if (group === "record") {
      if (recordCount === 1) out.push(id);
      else if (!out.includes("record-menu")) out.push("record-menu");
    } else if (id === "save") out.push(id);
    else if (!out.includes("system-menu")) out.push("system-menu");
  }
  return out;
}

/** 그룹 열기 항목이 담는 실제 명령들(숨김 규칙 적용 후). */
export function listStatusMenuGroupCommandIds(
  entryId: StatusMenuGroupEntryId,
  project: Project,
  session: PlaySession
): StatusMenuCommandId[] {
  const group = COLLAPSED_GROUPS.find((candidate) => candidate.entryId === entryId);
  if (!group) throw new Error(`Unknown status menu group entry: ${entryId}`);
  const visible = new Set(listStatusMenuCommandIds(project, session));
  const flat = statusMenuRailStyle(project) === "flat";
  return STATUS_MENU_COMMAND_GROUPS
    .filter((candidate) => candidate.id === group.groupId)
    .flatMap((candidate) => candidate.commandIds)
    // 평탄 레일은 저장을 레일에 직접 두므로 시스템 트레이에서는 뺀다.
    .filter((id) => visible.has(id) && !(flat && id === "save"));
}

/** 접힌 명령을 실행 중일 때 레일에서 강조할 항목. 펼친 명령은 자기 자신.
    project·session 을 주면 스킨의 레일 구성(평탄/접힘)을 따르고, 없으면 접힌 규칙으로 답한다. */
export function statusMenuRailIdForCommand(
  commandId: StatusMenuRailId,
  project?: Project,
  session?: PlaySession,
): StatusMenuRailId {
  if (isStatusMenuGroupEntryId(commandId)) return commandId;
  const groupId = commandGroupIdOf(commandId);
  if (project && session && statusMenuRailStyle(project) === "flat") {
    if (listStatusMenuRailIds(project, session).includes(commandId)) return commandId;
    return groupId === "record" ? "record-menu" : groupId === "system" ? "system-menu" : commandId;
  }
  const collapsed = COLLAPSED_GROUPS.find((candidate) => candidate.groupId === groupId);
  return collapsed ? collapsed.entryId : commandId;
}

/** 레일 순서 = 화면 순서 = ↑↓ 이동 순서. */
export function listStatusMenuRailIds(project: Project, session: PlaySession): StatusMenuRailId[] {
  if (statusMenuRailStyle(project) === "flat") return flatRailIds(listStatusMenuCommandIds(project, session));
  const collapsedGroupIds = new Set(COLLAPSED_GROUPS.map((group) => group.groupId));
  const expanded = listStatusMenuCommandIds(project, session)
    .filter((id) => !collapsedGroupIds.has(commandGroupIdOf(id)));
  const entries = COLLAPSED_GROUPS
    .filter((group) => listStatusMenuGroupCommandIds(group.entryId, project, session).length > 0)
    .map((group) => group.entryId);
  return [...expanded, ...entries];
}

export function statusMenuRailLabel(railId: StatusMenuRailId, waitModeEnabled: boolean, project?: Project): string {
  return isStatusMenuGroupEntryId(railId)
    ? statusMenuGroupEntryLabel(railId)
    : statusMenuCommandLabel(railId, waitModeEnabled, project);
}

export function statusMenuCommandGroupLabel(groupId: StatusMenuCommandGroupId): string {
  const group = STATUS_MENU_COMMAND_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`Unknown status menu command group: ${groupId}`);
  return group.label;
}

export type StatusMenuCommand = {
  /** 펼친 명령이면 명령 id, 접힌 그룹이면 그룹 열기 id. */
  readonly id: StatusMenuRailId;
  readonly label: string;
  readonly groupId: StatusMenuCommandGroupId;
  /** 그룹의 첫 항목 — 렌더러가 이 앞에 그룹 라벨/구분선을 넣는다. */
  readonly groupStart: boolean;
  readonly destructive: boolean;
  /** 접힌 그룹 열기 항목인가. 렌더러가 ▸ 표식과 testid 를 다르게 준다. */
  readonly opensGroup: boolean;
};

export type PlayerStatusMenuPartyRow = {
  readonly actorId: string;
  readonly name: string;
  readonly levelLabel: string;
  /** 직업 이름과 숫자 레벨 — 파티 개요(첫 화면)가 "전사 · Lv 12" 로 쓴다. */
  readonly className: string;
  readonly level: number;
  readonly condition: string;
  /** 얼굴 낱장 파일 한 장의 리소스 id. 렌더러는 이 이미지를 통째로 그린다. */
  readonly faceResourceId?: string;
  readonly hpLabel: string;
  readonly mpLabel: string;
  /** 접두사 없는 수치. 2×2 파티 셀(52px)에는 `HP 514/514` 가 안 들어간다 —
      어느 쪽인지는 게이지 색(HP 초록/MP 파랑)이 알려주고, 전체 문자열은 aria-label 이 담는다. */
  readonly hpValueLabel: string;
  readonly mpValueLabel: string;
  /** 0~1. 숫자만으로는 파티 4명 상태를 한눈에 못 읽어 게이지를 함께 그린다. */
  readonly hpRatio: number;
  readonly mpRatio: number;
  /** 게이지 임계 — safe(>50%) / warn(>25%) / crit(<=25%). */
  readonly hpLevel: PartyVitalLevel;
  /** 세션에 걸린 상태이상 이름(필드에서도 남는 것). 없으면 빈 배열 — 화면은 「정상」 으로 쓴다. */
  readonly stateNames: readonly string[];
  /** 다음 레벨까지 남은 경험치와 이번 레벨 구간 진행률(0~1). 최대 레벨이면 undefined. */
  readonly nextLevel?: { readonly remaining: number; readonly ratio: number };
};

export type PartyVitalLevel = "crit" | "safe" | "warn";

export type PlayerStatusMenuSnapshot = {
  readonly commands: readonly StatusMenuCommand[];
  readonly commandLabels: readonly string[];
  readonly partyRows: readonly PlayerStatusMenuPartyRow[];
  readonly goldLabel: string;
  readonly timeLabel: string;
  /** system.chapter 가 있고 현재 값에 이름표가 있을 때만. */
  readonly chapterLabel?: string;
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
    if (id === "gallery") return isGalleryEnabled(project);
    if (id === "life-ledger") return hasLifeLedgerData(project, session);
    if (id === "save") return !saveDisabled;
    return true;
  });
}

function collapsedGroupIdOf(entryId: StatusMenuGroupEntryId): StatusMenuCommandGroupId {
  const group = COLLAPSED_GROUPS.find((candidate) => candidate.entryId === entryId);
  if (!group) throw new Error(`Unknown status menu group entry: ${entryId}`);
  return group.groupId;
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
  const classesById = new Map(project.database.classes.map((record) => [record.id, record]));
  const terms = resolveTerms(project);
  const hpTerm = terms.hp;
  const mpTerm = terms.mp;
  const partyRows = session.partyActorIds.flatMap((actorId): PlayerStatusMenuPartyRow[] => {
    const actor = actorsById.get(actorId);
    if (!actor) return [];
    const vitals = session.actorVitals[actorId];
    const level = session.actorLevels[actorId] ?? actor.initialLevel;
    const hpRatio = vitalRatio(vitals?.hp, vitals?.maxHp);
    const classId = effectiveActorClassId(project, session, actorId);
    const normalized = normalizeActorRecord(actor);
    const exp = session.actorExperience?.[actorId] ?? totalExpForLevel(normalized.expCurve, level);
    const levelBase = totalExpForLevel(normalized.expCurve, level);
    const levelNext = totalExpForLevel(normalized.expCurve, level + 1);
    const nextLevel = level < normalized.maxLevel && levelNext > levelBase
      ? { remaining: Math.max(0, levelNext - exp), ratio: vitalRatio(exp - levelBase, levelNext - levelBase) }
      : undefined;
    const stateNames = (session.actorStateIds?.[actorId] ?? [])
      .map((stateId) => project.database.states.find((state) => state.id === stateId)?.name)
      .filter((name): name is string => Boolean(name));
    return [{
      actorId,
      name: resolveActorName(session, actor),
      levelLabel: `L${level}`,
      className: (classId ? classesById.get(classId)?.name : undefined) ?? "직업 없음",
      level,
      condition: "정상",
      faceResourceId: resolveActorFaceResourceId(session, actor, project) ?? defaultActorFaceResourceId(actor),
      hpLabel: vitals ? `${hpTerm} ${vitals.hp}/${vitals.maxHp}` : `${hpTerm} 0/0`,
      mpLabel: vitals ? `${mpTerm} ${vitals.mp}/${vitals.maxMp}` : `${mpTerm} 0/0`,
      hpValueLabel: vitals ? `${vitals.hp}/${vitals.maxHp}` : "0/0",
      mpValueLabel: vitals ? `${vitals.mp}/${vitals.maxMp}` : "0/0",
      hpRatio,
      mpRatio: vitalRatio(vitals?.mp, vitals?.maxMp),
      hpLevel: partyVitalLevel(hpRatio),
      stateNames,
      ...(nextLevel ? { nextLevel } : {}),
    }];
  });
  const seenGroups = new Set<StatusMenuCommandGroupId>();
  const commands = listStatusMenuRailIds(project, session).map((id): StatusMenuCommand => {
    const opensGroup = isStatusMenuGroupEntryId(id);
    const groupId = opensGroup ? collapsedGroupIdOf(id) : commandGroupIdOf(id);
    // 접힌 그룹 열기 항목은 그 자체가 그룹을 대표하므로 별도 그룹 라벨을 앞세우지 않는다.
    const groupStart = !opensGroup && !seenGroups.has(groupId);
    seenGroups.add(groupId);
    return {
      id,
      label: statusMenuRailLabel(id, options.waitModeEnabled ?? true, project),
      groupId,
      groupStart,
      destructive: !opensGroup && STATUS_MENU_DESTRUCTIVE_COMMAND_IDS.includes(id),
      opensGroup,
    };
  });

  return {
    commands,
    commandLabels: commands.map((command) => command.label),
    partyRows,
    goldLabel: `${terms.goldPrefix}${session.gold}${terms.gold}`,
    timeLabel: formatElapsedTime(options.elapsedMs ?? 0),
    chapterLabel: currentChapterLabel(project, session),
    emptyPartyLabel: partyRows.length === 0 ? "파티원이 없습니다" : null,
  };
}

export function statusMenuCommandLabel(commandId: StatusMenuCommandId, waitModeEnabled: boolean, project?: Project): string {
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
    case "battle-reports": return "전투 기록";
    case "quests": return "임무";
    case "relationships": return "관계";
    case "gallery": return galleryMenuLabel(project);
    case "life-ledger": return "생활 장부";
    // 레일 폭(60px)이 좁아 "전투 대기 ON" 은 말줄임으로 잘리고, 레일을 넓히면
    // 오른쪽 상세 패널이 좁아져 값이 잘린다. 라벨은 짧게 두고 무엇이 대기하는지는
    // 상세 패널 제목("전투 대기")과 설명이 알려준다.
    case "options": return "설정";
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

/**
 * 허브 타일의 한 줄 요약 — 타일을 열지 않아도 "몇 종·몇 명·무엇이 들었는지" 가 읽히게 한다.
 * 빈 문자열은 요약 없음(타일이 라벨만 보인다).
 */
export function statusMenuCommandSummary(
  id: StatusMenuRailId,
  project: Project,
  session: PlaySession,
  slots: readonly SaveSlotReadResult[],
  waitModeEnabled = true,
): string {
  const party = session.partyActorIds.length;
  switch (id) {
    case "items":
      return `${Object.values(session.inventory).filter((count) => (count ?? 0) > 0).length}종`;
    case "skills":
    case "equipment":
    case "status":
    case "row":
    case "formation":
      return `${party}명`;
    case "monsters":
      return `${session.monsterParty.length}마리`;
    case "battle-reports":
      return `${session.battleReports?.length ?? 0}전투`;
    case "quests":
      return `${buildQuestLog(project, session).length}건`;
    case "save":
    case "load":
      return `${slots.filter((slot) => slot.kind === "present").length}/${Math.max(slots.length, 1)}칸`;
    case "options":
    case "wait":
    case "to-title":
    case "relationships":
    case "life-ledger":
      return "";
    case "gallery":
      return `${listGalleryUnlocks(session).length}장`;
    case "party-menu": {
      const crit = createPlayerStatusMenuSnapshot(project, session).partyRows.filter((row) => row.hpLevel === "crit").length;
      return crit > 0 ? `위험 ${crit} · ${party}명` : `${party}명 양호`;
    }
    case "record-menu":
    case "system-menu":
      return listStatusMenuGroupCommandIds(id, project, session)
        .map((commandId) => statusMenuCommandLabel(commandId, waitModeEnabled, project))
        .join(" · ");
  }
}
