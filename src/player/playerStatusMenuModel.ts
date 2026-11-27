import { monsterPartyEntries, usesMonsterParty } from "@/player/playerMonsterPartyModel";
import { FIELD_MENU_COMMANDS, fieldMenu } from '@/project/fieldMenu';
import { defaultActorFaceResourceId, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import type { PlaySession } from "@/project/session";
import { resolveActorName, resolveActorFaceResourceId } from "@/project/sessionActorCommands";
import { effectiveActorClassId } from "@/project/sessionClass";
import { DEFAULT_GALLERY_LABEL, isGalleryEnabled, galleryMenuLabel, listGalleryUnlocks } from "@/project/gallery";
import { monsterCampaign, monsterJournalEntry, monsterDexSpeciesIds } from "@/project/monsterJournal";
import { currentChapterLabel } from "@/project/newGamePlus";
import { DEFAULT_FRIENDSHIP_MAX, isGiftSystemEnabled, listFriendshipEntries } from "@/project/friendship";
import { friendshipDisplayMax, socialLoopSummary } from "@/project/socialLoop";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { gameHasCombat, gameUsesMoney } from "@/project/combatPresence";
import { hasPartyBonds } from "@/project/partyBonds";
import { backlogEnabled, normalizeBacklog, resolveDialogueSystem } from "@/project/dialogueSystem";
import { dialogueUiText } from "@/player/dialogueUiStrings";
import { vnGalleryLabel, vnUiText, type VnUiKey } from "@/player/vnExtrasStrings";
import { galleryRows, listEndingRows, listGallerySlots, resolveVnExtras, vnExtrasLanguage } from "@/project/vnExtras";
import { resolveTerms } from "@/project/terms";
import type { ActorRecord, Project } from "@/project/types";
import { hasLifeLedgerData } from "@/player/lifeLedger";
import { menuSkinFor } from "@/player/menuSkins/registry";
import { actorFieldStateNames } from "@/player/actorFieldStates";
import { buildQuestLog } from "@/player/questLog";
import type { SaveSlotReadResult } from "@/player/saveSlots";
import type { MenuSkinRailStyle } from "@/player/menuSkins/types";
import { BESTIARY_DEFAULT_TITLE, bestiaryEntryKnown, bestiaryTitle, resolveBestiary } from "@/project/bestiary";
import { STORY_JOURNAL_DEFAULT_TITLE, storyJournal } from "@/project/storyJournal";
import { resolveRestMenu } from "@/project/restMenu";
import { formatGameClock } from "@/project/gameTime";
import { runtimeUiLocale, runtimeUiText, type RuntimeUiKey } from "@/player/runtimeUiStrings";

export const STATUS_MENU_COMMAND_IDS = FIELD_MENU_COMMANDS;


export type StatusMenuCommandId = (typeof STATUS_MENU_COMMAND_IDS)[number];

/** 레일 그룹 — 명령을 평면 나열하면 "아이템"과 "타이틀"이 같은 위계로 읽힌다. */
export const STATUS_MENU_COMMAND_GROUP_IDS = ["action", "party", "record", "system"] as const;
export type StatusMenuCommandGroupId = (typeof STATUS_MENU_COMMAND_GROUP_IDS)[number];

/** 그룹별 명령 순서. 커서 이동은 listStatusMenuCommandIds 의 배열 순서를 그대로 따르므로
    이 순서가 곧 화면 순서이자 ↑↓ 순서가 된다. */
const STATUS_MENU_COMMAND_GROUPS: readonly {
  readonly id: StatusMenuCommandGroupId;
  readonly labelKey: RuntimeUiKey;
  readonly commandIds: readonly StatusMenuCommandId[];
}[] = [
  { id: "action", labelKey: "menu.group.action", commandIds: ["items", "skills", "equipment"] },
  { id: "party", labelKey: "menu.group.party", commandIds: ["status", "row", "formation", "monsters"] },
  { id: "record", labelKey: "menu.group.record", commandIds: ["monster-dex", "region-map", "campaign-progress", "trainer-card", "battle-reports", "bestiary", "quests", "journal", "relationships", "gallery", "endings", "life-ledger", "backlog"] },
  // to-title 은 진행 손실 위험이 있는 파괴적 액션이므로 항상 마지막.
  { id: "system", labelKey: "menu.group.system", commandIds: ["save", "load", "rest", "wait", "options", "to-title"] },
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
  readonly labelKey: RuntimeUiKey;
}[] = [
  { entryId: "party-menu", groupId: "party", labelKey: "menu.collapsed.party" },
  { entryId: "record-menu", groupId: "record", labelKey: "menu.collapsed.record" },
  { entryId: "system-menu", groupId: "system", labelKey: "menu.collapsed.system" },
];

export function isStatusMenuGroupEntryId(value: StatusMenuRailId): value is StatusMenuGroupEntryId {
  return (STATUS_MENU_GROUP_ENTRY_IDS as readonly string[]).includes(value);
}

export function statusMenuGroupEntryLabel(entryId: StatusMenuGroupEntryId, project?: Project): string {
  const group = COLLAPSED_GROUPS.find((candidate) => candidate.entryId === entryId);
  if (!group) throw new Error(`Unknown status menu group entry: ${entryId}`);
  return runtimeUiText(project, group.labelKey);
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
  if (project && fieldMenu(project)) return commandId;
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
  if (fieldMenu(project)) return listStatusMenuCommandIds(project, session);
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
    ? statusMenuGroupEntryLabel(railId, project)
    : statusMenuCommandLabel(railId, waitModeEnabled, project);
}

export function statusMenuCommandGroupLabel(groupId: StatusMenuCommandGroupId, project?: Project): string {
  const group = STATUS_MENU_COMMAND_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`Unknown status menu command group: ${groupId}`);
  return runtimeUiText(project, group.labelKey);
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
  readonly monsterInstanceId?: string;
  readonly resourceLabel?: "PP";
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

/** 관계 중심(연애) 게임의 메뉴 첫 화면 — 전투 수치 대신 호감 높은 순 몇 사람과 오늘 남은 시간. */
export type RelationshipMenuRow = {
  readonly key: string;
  readonly name: string;
  /** 하트 다섯 칸 글자(♥♥♡♡♡). */
  readonly hearts: string;
  readonly value: number;
  readonly tierLabel?: string;
  /** 저작한 한 줄 소개(project.characters[key].note). */
  readonly note?: string;
};
export type RelationshipMenuOverview = {
  readonly leadName: string;
  readonly timeLine?: string;
  readonly rows: readonly RelationshipMenuRow[];
};

export type PlayerStatusMenuSnapshot = {
  /** 관계 중심 게임이면 있다 — 있으면 렌더러는 HP/MP/EX 대신 이것을 그린다. */
  readonly relationship?: RelationshipMenuOverview;
  /** 전투가 없는 게임(공포·이야기·추리)이면 있다 — 렌더러는 직업·Lv·HP·MP·EX 대신 주인공 이름만 그린다(J88). */
  readonly story?: { readonly leadName: string };
  /** 돈 칸을 보일지 — 돈을 쓰지 않는 게임(상점·여관·돈 바꾸기·전투 보상 없음)이면 「0G」 를 두지 않는다(J88). */
  readonly showGold?: boolean;
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
  readonly waitModeEnabled?: boolean;
};
/** 몬스터 항목에 볼 것이 있나 — 몬스터 수집·몬스터 파티 게임이거나, 지금 데리고 있거나 맡겨 둔 몬스터가 있다(포획 구슬로 잡은 뒤부터 나타난다). */
function monsterMenuHasContent(project: Project, session: PlaySession): boolean {
  return usesMonsterParty(project) || project.system.monsterCollection === true || Boolean(monsterCampaign(project))
    || (session.monsterParty?.length ?? 0) > 0 || (session.monsterBox?.length ?? 0) > 0;
}

/** O3: hide 관계 rail unless giftSystem, any known friendship keys, or party bonds (system.partyBonds). */
export function listStatusMenuCommandIds(project: Project, session: PlaySession): StatusMenuCommandId[] {
  const showRelationships =
    isGiftSystemEnabled(project) || Object.keys(session.friendship ?? {}).length > 0 || hasPartyBonds(project);
  const relationship = usesRelationshipMenu(project);
  // Change Save Access: false면 메뉴의 저장 항목을 숨긴다(세이브 포인트 전용 설계).
  // system.saveAccess "savePoints": 세이브 포인트(openSaveMenu)에서만 저장 — 메뉴 항목은 없다.
  const saveDisabled = session.m2Runtime?.access?.save === false || project.system.saveAccess === "savePoints";
  // 그룹 순서대로 평탄화 — 화면 순서와 ↑↓ 이동 순서를 한 배열이 결정한다.
  const authored = fieldMenu(project);
  return (authored ? authored.entries.map(row => row.command) : STATUS_MENU_COMMAND_GROUPS.flatMap((group) => group.commandIds)).filter((id) => {
    if (id === 'trainer-card') return Boolean(authored);
    if (id === "monster-dex") {
      // 도감을 받는 이벤트가 있는 게임은 받기 전에는 항목 자체를 숨긴다(스위치가 정의되지 않은 게임은 그대로).
      const gated = project.switches.some((sw) => sw.id === "mx_pokedex_received") && !session.switches["mx_pokedex_received"];
      return !gated && monsterDexSpeciesIds(project).length > 0;
    }
    if (id === "region-map" || id === "campaign-progress") return Boolean(monsterCampaign(project));
    if (usesMonsterParty(project) && (id === "equipment" || id === "row" || id === "formation")) return false;
    // 기본 메뉴는 이 게임에 쓸 데가 있는 명령만 싣는다(저작한 메뉴는 작가가 고른 그대로다).
    // 왜(2026-11-13 확인 빌드 r3b): 주인공 혼자인 턴제 게임의 ESC 메뉴에 「열 바꾸기 · 진형 · 몬스터」 가 떴다 — 평탄 레일 스킨에서는 첫 화면에 그대로 보인다.
    if (!authored && (id === "row" || id === "formation")) return session.partyActorIds.length >= 2;
    if (!authored && id === "monsters") return monsterMenuHasContent(project, session);
    // 관계 중심 게임은 호감 기록이 아직 없어도 호감도 항목이 있다 — 비어 있어도 「아직 아무도」 가 보여야 한다. 일정은 퀘스트가 정의된 게임만.
    if (id === "relationships") return showRelationships || relationship;
    if (id === "quests" && relationship) return (project.quests?.length ?? 0) > 0;
    if (id === "gallery") return isGalleryEnabled(project) || vnGalleryVisible(project, session);
    // 엔딩 목록은 연애 기본 구성/저작이 켜고 엔딩 정의가 있는 게임에만 — 그 밖의 메뉴(옛 프로젝트 포함)는 그대로다.
    if (id === "endings") return vnEndingsVisible(project);
    if (id === "life-ledger") return hasLifeLedgerData(project, session);
    // 백로그는 저작된 대사 시스템에서 켠 게임에만 — 그 밖의 메뉴(옛 프로젝트 포함)는 그대로다.
    if (id === "backlog") return backlogEnabled(project);
    // 이야기 일지는 줄이 적힌 뒤에만 — 저작만 해 두면 새 게임 직후 아직 만나지도 않은 인물의 「…의 일지」가 빈 채로 보였다(2026-11-14 QA).
    if (id === "journal") return (session.storyJournal?.length ?? 0) > 0;
    // 괴물 도감은 system.bestiary 를 켠 게임에만(define_bestiary_entry).
    if (id === "bestiary") return Boolean(resolveBestiary(project));
    if (id === "save") return !saveDisabled;
    // 쉬기는 시간 시스템과 system.timeSystem.restMenu 를 켠 게임에만.
    if (id === "rest") return Boolean(resolveRestMenu(project));
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
  const normalCondition = runtimeUiText(project, "menu.condition.normal");
  const noClassLabel = runtimeUiText(project, "menu.class.none");
  const partyRows = usesMonsterParty(project) ? monsterPartyEntries(project, session).map((entry): PlayerStatusMenuPartyRow => {
    const hpRatio = vitalRatio(entry.hp, entry.maxHp);
    return {
      actorId: entry.instance.instanceId, monsterInstanceId: entry.instance.instanceId, resourceLabel: "PP",
      name: entry.name, levelLabel: `L${entry.instance.level}`, level: entry.instance.level, className: entry.typeLabel,
      condition: entry.stateNames.join(" · ") || normalCondition, stateNames: entry.stateNames,
      faceResourceId: entry.species?.graphic.monsterResourceId,
      hpLabel: `HP ${entry.hp}/${entry.maxHp}`, hpValueLabel: `${entry.hp}/${entry.maxHp}`,
      mpLabel: `PP ${entry.pp.before}/${entry.pp.maximum}`, mpValueLabel: `${entry.pp.before}/${entry.pp.maximum}`,
      hpRatio, hpLevel: partyVitalLevel(hpRatio), mpRatio: vitalRatio(entry.pp.before, entry.pp.maximum), nextLevel: entry.nextLevel,
    };
  }) : session.partyActorIds.flatMap((actorId): PlayerStatusMenuPartyRow[] => {
    const actor = actorsById.get(actorId);
    if (!actor) return [];
    const vitals = session.actorVitals[actorId];
    const level = session.actorLevels[actorId] ?? actor.initialLevel;
    const hpRatio = vitalRatio(vitals?.hp, vitals?.maxHp);
    const classId = effectiveActorClassId(project, session, actorId);
    const nextLevel = actorNextLevel(session, actor);
    const stateNames = actorFieldStateNames(project, session, actorId);
    return [{
      actorId,
      name: resolveActorName(session, actor),
      levelLabel: `L${level}`,
      className: (classId ? classesById.get(classId)?.name : undefined) ?? noClassLabel,
      level,
      condition: stateNames.join(" · ") || normalCondition,
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
    const groupStart = !fieldMenu(project) && !opensGroup && !seenGroups.has(groupId);
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

  const relationship = usesRelationshipMenu(project) ? relationshipOverview(project, session, partyRows[0]?.name ?? "") : undefined;
  const story = !relationship && !gameHasCombat(project) ? { leadName: partyRows[0]?.name ?? project.meta.title } : undefined;
  return {
    ...(relationship ? { relationship } : {}),
    ...(story ? { story } : {}),
    showGold: !relationship && (gameUsesMoney(project) || session.gold > 0),
    commands,
    commandLabels: commands.map((command) => command.label),
    partyRows,
    goldLabel: `${terms.goldPrefix}${session.gold}${terms.gold}`,
    // 시계의 정본은 세션의 플레이 시간(초)이다 — 세이브에 실려 오고 필드 틱이 늘린다.
    // 예전에는 부팅 시각 기준 벽시계(performance.now - playStartedAt)로 셌으므로 불러온 판이 0:00 이었다.
    timeLabel: formatPlayClock(session.playTimeSeconds ?? 0),
    chapterLabel: currentChapterLabel(project, session),
    emptyPartyLabel: partyRows.length === 0
      ? runtimeUiText(project, usesMonsterParty(project) ? "menu.emptyMonsterParty" : "menu.emptyParty")
      : null,
  };
}

const RELATIONSHIP_MENU_ROWS = 4;

function relationshipOverview(project: Project, session: PlaySession, leadName: string): RelationshipMenuOverview {
  const max = friendshipDisplayMax(project) ?? DEFAULT_FRIENDSHIP_MAX;
  const rows = listFriendshipEntries(session.friendship, max, undefined, project)
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, RELATIONSHIP_MENU_ROWS)
    .map((entry): RelationshipMenuRow => {
      const filled = Math.max(0, Math.min(5, Math.round((entry.value / Math.max(1, max)) * 5)));
      const note = project.characters?.[entry.key]?.note?.trim();
      return { key: entry.key, name: entry.displayName ?? entry.key, hearts: "♥".repeat(filled) + "♡".repeat(5 - filled), value: entry.value, ...(entry.label ? { tierLabel: entry.label } : {}), ...(note ? { note } : {}) };
    });
  const timeLine = socialLoopSummary(project, session);
  const cleanLeadName = /^(?:주인공|모험가|배우\s*\d+|Hero|Actor\s*\d+)$/iu.test(leadName.trim())
    ? (runtimeUiLocale(project) === "ko" ? "한결" : leadName)
    : leadName;
  return { leadName: cleanLeadName, ...(timeLine ? { timeLine } : {}), rows };
}

/** 연애 기본 ESC 메뉴(저작 없음)의 기본 낱말 — 저작 언어로 번역한다. 저작한 메뉴의 라벨은 작가 글자 그대로 둔다. */
const ROMANCE_DEFAULT_LABEL_KEYS: Partial<Record<StatusMenuCommandId, VnUiKey>> = {
  relationships: "menu.relationships", quests: "menu.quests", items: "menu.items", save: "menu.save", load: "menu.load", options: "menu.options", "to-title": "menu.toTitle",
};

export function statusMenuCommandLabel(commandId: StatusMenuCommandId, waitModeEnabled: boolean, project?: Project): string {
  const authored = project && fieldMenu(project)?.entries.find(row => row.command === commandId);
  const defaultKey = authored && project && !project.meta.oprnFieldMenu && resolveVnExtras(project) ? ROMANCE_DEFAULT_LABEL_KEYS[commandId] : undefined;
  if (defaultKey) return vnUiText(vnExtrasLanguage(project), defaultKey);
  // 저작하지 않은 기본 라벨(연애 기본 메뉴의 「백로그」「갤러리」「엔딩」)은 저작한 언어로 보인다. 저작자가 직접 쓴 라벨은 그대로다.
  const defaultName = authored && project && (
    (commandId === "backlog" && authored.label === "백로그")
    || (resolveVnExtras(project) !== undefined && ((commandId === "gallery" && authored.label === DEFAULT_GALLERY_LABEL) || (commandId === "endings" && authored.label === "엔딩")))
  );
  if (authored && !defaultName) return authored.label;
  const locale = runtimeUiLocale(project);
  switch (commandId) {
    case "trainer-card": return runtimeUiText(project, "menu.cmd.trainerCard");
    case "items": return runtimeUiText(project, "menu.cmd.items");
    case "skills": return runtimeUiText(project, "menu.cmd.skills");
    case "equipment": return runtimeUiText(project, "menu.cmd.equipment");
    case "monsters": return runtimeUiText(project, "menu.cmd.monsters");
    case "monster-dex": return runtimeUiText(project, "menu.cmd.monsterDex");
    case "region-map": return runtimeUiText(project, "menu.cmd.regionMap");
    case "campaign-progress": return runtimeUiText(project, "menu.cmd.campaignProgress");
    case "save": return runtimeUiText(project, "menu.cmd.save");
    case "load": return runtimeUiText(project, "menu.cmd.load");
    case "status": return runtimeUiText(project, "menu.cmd.status");
    // "열" 한 글자는 "열다"로 읽혀 무슨 기능인지 알 수 없다(전열/후열 교체).
    case "row": return runtimeUiText(project, "menu.cmd.row");
    case "formation": return runtimeUiText(project, "menu.cmd.formation");
    case "battle-reports": return runtimeUiText(project, "menu.cmd.battleReports");
    case "bestiary": {
      const title = project ? bestiaryTitle(project) : BESTIARY_DEFAULT_TITLE;
      return locale !== "ko" && title === BESTIARY_DEFAULT_TITLE
        ? runtimeUiText(project, "menu.cmd.bestiary")
        : title;
    }
    case "quests": return runtimeUiText(project, "menu.cmd.quests");
    case "journal": {
      const title = (project && storyJournal(project)?.title) || STORY_JOURNAL_DEFAULT_TITLE;
      return locale !== "ko" && title === STORY_JOURNAL_DEFAULT_TITLE
        ? runtimeUiText(project, "menu.cmd.journal")
        : title;
    }
    case "relationships": return runtimeUiText(project, "menu.cmd.relationships");
    case "gallery": {
      if (project && resolveVnExtras(project)?.gallery.enabled) return vnGalleryLabel(project);
      const label = galleryMenuLabel(project);
      return locale !== "ko" && label === DEFAULT_GALLERY_LABEL
        ? runtimeUiText(project, "menu.cmd.gallery")
        : label;
    }
    case "endings":
      return project?.meta.oprnVnExtras || project?.meta.oprnDialogueSystem
        ? vnUiText(vnExtrasLanguage(project), "menu.endings")
        : runtimeUiText(project, "menu.cmd.endings");
    case "life-ledger": return runtimeUiText(project, "menu.cmd.lifeLedger");
    case "backlog":
      return project?.meta.oprnDialogueSystem
        ? dialogueUiText(resolveDialogueSystem(project), "menu.backlog")
        : runtimeUiText(project, "menu.cmd.backlog");
    // 레일 폭(60px)이 좁아 "전투 대기 ON" 은 말줄임으로 잘리고, 레일을 넓히면
    // 오른쪽 상세 패널이 좁아져 값이 잘린다. 라벨은 짧게 두고 무엇이 대기하는지는
    // 상세 패널 제목("전투 대기")과 설명이 알려준다.
    case "options": return runtimeUiText(project, "menu.cmd.options");
    case "rest": return runtimeUiText(project, "menu.cmd.rest");
    case "wait": return runtimeUiText(project, waitModeEnabled ? "menu.cmd.waitOn" : "menu.cmd.waitOff");
    case "to-title": return runtimeUiText(project, "menu.cmd.toTitle");
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

/** 다음 레벨까지 남은 경험치와 이번 레벨 구간 진행률(0~1). 최대 레벨이면 undefined. 메뉴 첫 화면과 상태 화면이 같은 값을 쓴다. */
export function actorNextLevel(session: PlaySession, actor: ActorRecord): { readonly remaining: number; readonly ratio: number } | undefined {
  const level = session.actorLevels[actor.id] ?? actor.initialLevel;
  const normalized = normalizeActorRecord(actor);
  const levelBase = totalExpForLevel(normalized.expCurve, level);
  // 시작 레벨이 1보다 높거나 레벨을 직접 정한 동료는 누적 EXP 가 0 으로 남는다 — 보상 적립(battleRewardsToSession)과
  // 같은 바닥에서 센다. 안 그러면 Lv14 에서 「다음 7306」(누적 전체)이 나오다 첫 승리 뒤 갑자기 725 로 떨어졌다(fs2 I02).
  const exp = Math.max(session.actorExperience?.[actor.id] ?? 0, levelBase);
  const levelNext = totalExpForLevel(normalized.expCurve, level + 1);
  return level < normalized.maxLevel && levelNext > levelBase
    ? { remaining: Math.max(0, levelNext - exp), ratio: vitalRatio(exp - levelBase, levelNext - levelBase) }
    : undefined;
}

export function partyVitalLevel(ratio: number): PartyVitalLevel {
  if (ratio <= 0.25) return "crit";
  if (ratio <= 0.5) return "warn";
  return "safe";
}

/**
 * 세션 플레이 시간(초)을 상태 메뉴 시계 글자로 — 저장·불러오기 칸과 같은 꼴(한 시간 안은 m:ss, 넘으면 h:mm:ss).
 * 왜(2026-10-29 vm3 terra 추리 판정): 메뉴는 h:mm(「0:00」), 저장 칸은 m:ss(「0:38」)라 같은 38초가 서로 다른 시각처럼 읽혔다.
 */
function formatPlayClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
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
  const monsterParty = usesMonsterParty(project);
  const party = monsterParty ? monsterPartyEntries(project, session).length : session.partyActorIds.length;
  const countLabel = runtimeUiText(project, monsterParty ? "menu.summary.monsters" : "menu.summary.members", party);
  switch (id) {
    case "trainer-card": return project.meta.author || runtimeUiText(project, "menu.summary.trainerRecord");
    case "items":
      return runtimeUiText(project, "menu.summary.itemKinds", Object.values(session.inventory).filter((count) => (count ?? 0) > 0).length);
    case "skills":
    case "equipment":
    case "status":
    case "row":
    case "formation":
      return countLabel;
    case "monsters":
      return runtimeUiText(project, "menu.summary.monsters", session.monsterParty.length);
    case "monster-dex": {
      const ids = monsterDexSpeciesIds(project);
      return runtimeUiText(project, "menu.summary.dexProgress", ids.filter((id) => monsterJournalEntry(session, id).caught).length, ids.length);
    }
    case "region-map": return project.maps[session.currentMapId]?.name ?? "";
    case "campaign-progress": {
      const badges = monsterCampaign(project)?.badges ?? [];
      return runtimeUiText(project, "menu.summary.badges", badges.filter((badge) => session.switches[badge.switchId] === true).length, badges.length);
    }
    case "battle-reports":
      return runtimeUiText(project, "menu.summary.battles", session.battleReports?.length ?? 0);
    case "quests":
      return runtimeUiText(project, "menu.summary.quests", buildQuestLog(project, session).length);
    case "journal":
      return runtimeUiText(project, "menu.summary.journalLines", session.storyJournal?.length ?? 0);
    case "bestiary": {
      const entries = resolveBestiary(project)?.entries ?? [];
      return `${entries.filter((entry) => bestiaryEntryKnown(session, entry)).length}/${entries.length}`;
    }
    case "save":
    case "load":
      return runtimeUiText(project, "menu.summary.slots", slots.filter((slot) => slot.kind === "present").length, Math.max(slots.length, 1));
    case "rest":
      return session.gameTime ? formatGameClock(session.gameTime) : "";
    case "options":
    case "wait":
    case "to-title":
    case "relationships":
    case "life-ledger":
      return "";
    case "gallery": {
      const unlocked = listGalleryUnlocks(session).length;
      // 연애 기본 구성/저작의 갤러리는 전체 칸 수를 알고 있어 「열림/전체」 로 보인다. 그 밖은 옛 표기.
      if (!resolveVnExtras(project)?.gallery.enabled) return runtimeUiText(project, "menu.summary.galleryCount", unlocked);
      const total = galleryRows(listGallerySlots(project), session.galleryUnlocks ?? []).length;
      return vnUiText(vnExtrasLanguage(project), "gallery.progress", Math.min(unlocked, total), total);
    }
    case "endings": {
      const rows = listEndingRows(project, session.clearHistory?.endingIds);
      return vnUiText(vnExtrasLanguage(project), "endings.progress", rows.filter((row) => row.seen).length, rows.length);
    }
    case "backlog":
      return dialogueUiText(resolveDialogueSystem(project), "backlog.count", normalizeBacklog(session.dialogueBacklog)?.length ?? 0);
    case "party-menu": {
      const crit = createPlayerStatusMenuSnapshot(project, session).partyRows.filter((row) => row.hpLevel === "crit").length;
      return crit > 0
        ? runtimeUiText(project, "menu.summary.partyDanger", crit, countLabel)
        : runtimeUiText(project, "menu.summary.partyGood", countLabel);
    }
    case "record-menu":
    case "system-menu":
      return listStatusMenuGroupCommandIds(id, project, session)
        .map((commandId) => statusMenuCommandLabel(commandId, waitModeEnabled, project))
        .join(" · ");
  }
}

/** 연애 기본 구성/저작의 갤러리 항목을 보일 것인가 — 열 CG 칸·열린 그림·본 엔딩 중 하나라도 있어야 한다(빈 항목을 만들지 않는다). */
function vnGalleryVisible(project: Project, session: PlaySession): boolean {
  if (resolveVnExtras(project)?.gallery.enabled !== true) return false;
  if (listGallerySlots(project).length > 0 || (session.galleryUnlocks?.length ?? 0) > 0) return true;
  return listEndingRows(project, session.clearHistory?.endingIds).some((row) => row.seen);
}

function vnEndingsVisible(project: Project): boolean {
  return resolveVnExtras(project)?.endings.enabled === true && (project.endings?.length ?? 0) > 0;
}
