import type { SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
import { canEquip, effectiveActorEquipment, equipmentSlotAccepts } from "@/project/equipmentRules";
import { resolveActorName } from "@/project/sessionActorCommands";
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import type { StatusMenuStatDelta } from "@/player/playerStatusMenuDetailTypes";
import { effectiveActorClassId } from "@/project/sessionClass";
import type { PlaySession } from "@/project/session";
import type {
  ActorInitialEquipment,
  ActorRecord,
  EquipmentStatBonuses,
  EquipmentRecord,
  ItemRecord,
  Project,
  SkillRecord,
} from "@/project/types";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";
import { buildQuestLog, questStateLabel } from "@/player/questLog";
import { MONSTER_PARTY_MAX, monsterCurrentHp, monsterDisplayName, monsterMaxHp } from "@/project/monsterCollection";
import { listFriendshipEntries } from "@/project/friendship";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import {
  isStatusMenuGroupEntryId,
  listStatusMenuGroupCommandIds,
  statusMenuCommandLabel,
  statusMenuGroupEntryLabel,
  type StatusMenuCommandId,
  type StatusMenuGroupEntryId,
} from "@/player/playerStatusMenuModel";

export type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions, StatusMenuStatDelta } from "@/player/playerStatusMenuDetailTypes";

const EQUIPMENT_SLOTS = [
  { id: "weapon", label: "무기" },
  { id: "shield", label: "방패" },
  { id: "armor", label: "갑옷" },
  { id: "helmet", label: "투구" },
  { id: "accessory", label: "장식품" },
] as const satisfies readonly { readonly id: keyof ActorInitialEquipment; readonly label: string }[];

const STAT_LABELS = [
  ["attack", "공격"],
  ["defense", "방어"],
  ["mind", "정신"],
  ["agility", "민첩"],
] as const satisfies readonly (readonly [keyof EquipmentStatBonuses, string])[];

export function createStatusMenuDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  // 접힌 그룹(기록/시스템)은 레일에 항목 하나만 남기고 실제 명령은 여기 작업 영역에서 고른다.
  if (isStatusMenuGroupEntryId(options.selectedCommand)) return groupDetail(options, options.selectedCommand);
  switch (options.selectedCommand) {
    case "items": return itemDetail(options);
    case "skills": return skillDetail(options);
    case "equipment": return equipmentDetail(options);
    case "monsters": return monsterDetail(options);
    case "save": return saveDetail(options);
    case "load": return loadDetail(options.slots, options.onLoadSlot);
    case "status": return statusDetail(options.project, options.session);
    case "row": return rowDetail(options);
    case "formation": return formationDetail(options);
    case "quests": return questsDetail(options.project, options.session);
    case "relationships": return relationshipsDetail(options.project, options.session);
    case "life-ledger": return createLifeLedgerDetail({
      project: options.project,
      session: options.session,
      tab: options.lifeLedgerTab,
      onSelectTab: options.onSelectLifeLedgerTab,
      onMutation: options.onLifeLedgerMutation,
    });
    case "wait": return waitDetail(options.waitModeEnabled);
    case "to-title": return toTitleDetail(options);
    default: return assertNever(options.selectedCommand);
  }
}

function groupDetail(options: StatusMenuDetailOptions, entryId: StatusMenuGroupEntryId): StatusMenuDetail {
  const commandIds = listStatusMenuGroupCommandIds(entryId, options.project, options.session);
  const entries = commandIds.map((commandId) => ({
    label: statusMenuCommandLabel(commandId, options.waitModeEnabled),
    value: "",
    description: commandId === "to-title" ? "미저장 진행 삭제" : GROUP_COMMAND_DESCRIPTIONS[commandId],
    testId: `status-menu-group-command-${commandId}`,
    onActivate: options.onCommand ? () => options.onCommand?.(commandId) : undefined,
    destructive: commandId === "to-title",
  }));
  return {
    title: statusMenuGroupEntryLabel(entryId).replace(" ▸", ""),
    entries,
    emptyLabel: "항목이 없습니다",
  };
}

const GROUP_COMMAND_DESCRIPTIONS: Partial<Record<StatusMenuCommandId, string>> = {
  quests: "받은 의뢰와 진행 상황을 봅니다.",
  relationships: "동료·주민과의 관계를 봅니다.",
  "life-ledger": "출하·꾸러미·생활 기술·가공 설비·수집 도감·박물관 기록을 관리합니다.",
  save: "현재 진행을 슬롯에 저장합니다.",
  load: "저장한 진행을 불러옵니다.",
  wait: "전투 중 명령 입력 시 시간을 멈출지 정합니다.",
  "to-title": "타이틀 화면으로 돌아갑니다. 저장하지 않은 진행은 사라집니다.",
};

function toTitleDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  return {
    title: "타이틀로 돌아가기",
    entries: options.confirmToTitle ? [{
      label: "진행을 버리고 타이틀로",
      value: "확인",
      description: "저장하지 않은 진행은 사라집니다.",
      testId: "status-menu-confirm-to-title",
      onActivate: options.onCommand ? () => options.onCommand?.("to-title") : undefined,
      destructive: true,
    }] : [],
    emptyLabel: "타이틀 복귀 확인을 준비하지 못했습니다.",
    hint: "한 번 더 선택해야 타이틀 화면으로 돌아갑니다.",
  };
}

function itemDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  if (options.targetItemId) {
    const item = project.database.items.find((record) => record.id === options.targetItemId);
    if (!item) return { title: "대상 선택", entries: [], emptyLabel: "아이템을 찾을 수 없습니다" };
    const careProfile = item.careProfile;
    if (careProfile) {
      return {
        title: `대상 선택: ${item.name}`,
        entries: session.monsterParty.flatMap((instanceId) => {
          const instance = session.monsterInstances[instanceId];
          if (!instance) return [];
          return [{
            label: monsterDisplayName(project, instance),
            value: `Lv.${instance.level}  친밀도 ${instance.friendship}`,
            testId: `status-menu-monster-${instanceId}`,
            onActivate: options.onUseItem ? () => options.onUseItem?.(item.id, undefined, instanceId) : undefined,
          }];
        }),
        emptyLabel: "대상이 없습니다",
        hint: "사용할 대상을 선택하세요.",
      };
    }
    return {
      title: `대상 선택: ${item.name}`,
      entries: partyActors(project, session).map((actor) => {
        const vitals = session.actorVitals[actor.id];
        const eligible = itemTargetEligibility(item, session, actor.id);
        return {
          label: actor.name,
          value: vitals ? `HP ${vitals.hp}/${vitals.maxHp}  MP ${vitals.mp}/${vitals.maxMp}` : "HP 0/0  MP 0/0",
          testId: `status-menu-item-target-${actor.id}`,
          onActivate: options.onUseItem && eligible ? () => options.onUseItem?.(item.id, actor.id) : undefined,
          disabled: !eligible,
        };
      }),
      emptyLabel: "대상이 없습니다",
      hint: itemTargetHint(item),
    };
  }

  const inventory = new Map(Object.entries(session.inventory).filter(([, count]) => count > 0));
  const entries = project.database.items.filter((item) => inventory.has(item.id)).map((item) => ({
    label: item.name,
    icon: itemEntryIcon(item),
    value: `${inventory.get(item.id) ?? 0}개`,
    description: item.description,
    testId: `status-menu-item-${item.id}`,
    onActivate: (item.scope === "ally" || item.scope === "allAllies" || Boolean(item.careProfile)) && options.onSelectItemTarget
      ? () => options.onSelectItemTarget?.(item.id)
      : options.onUseItem ? () => options.onUseItem?.(item.id) : undefined,
  }));
  return { title: "아이템", entries, emptyLabel: "아이템이 없습니다" };
}

function skillDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  if (options.skillActorId) {
    const actor = partyActors(project, session).find((record) => record.id === options.skillActorId);
    if (!actor) return { title: "스킬", entries: [], emptyLabel: "파티원을 찾을 수 없습니다" };
    const skills = learnedSkills(project, session, actor);
    return {
      title: `스킬: ${actor.name}`,
      entries: skills.map((skill) => ({
        label: skill.name,
        icon: skillEntryIcon(project, skill),
        value: `MP ${skill.mpCost.flat}`,
        description: `${skill.description || skillKindLabel(skill)} / 위력 ${skill.power} / 성공 ${skill.successRate}%`,
        testId: `status-menu-skill-${actor.id}-${skill.id}`,
        onActivate: options.onSelectSkill ? () => options.onSelectSkill?.(skill.id) : undefined,
      })),
      emptyLabel: "사용할 수 있는 스킬이 없습니다",
      hint: options.selectedSkillId ? "선택한 스킬 정보를 확인했습니다." : "스킬을 선택하면 설명을 확인합니다.",
    };
  }

  const entries = partyActors(project, session).map((actor) => {
    const skills = learnedSkills(project, session, actor);
    return {
      label: actor.name,
      value: skills.length > 0 ? skills.map((skill) => skill.name).join(", ") : "스킬 없음",
      description: actor.nickname || "스킬 목록을 봅니다",
      testId: `status-menu-skill-actor-${actor.id}`,
      onActivate: options.onSelectSkillActor ? () => options.onSelectSkillActor?.(actor.id) : undefined,
    };
  });
  return { title: "스킬", entries, emptyLabel: "스킬을 볼 파티원이 없습니다", hint: "파티원을 선택하세요." };
}

function equipmentDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  const equipmentById = new Map(project.database.equipment.map((item) => [item.id, item]));
  if (!options.equipmentActorId) {
    const entries = partyActors(project, session).map((actor) => {
      const worn = actorEquipment(project, session, actor);
      // 5개 부위를 " / " 로 이어 한 줄에 넣으면 좁은 패널에서 통째로 줄바꿈되어
      // 슬래시만 늘어선 정체불명의 덩어리가 된다(실측: "청동 검 / 참나무 방패 / ...").
      // 값은 무기 하나만 짧게 보이고, 나머지는 부위 이름을 붙여 설명 줄로 내린다.
      // 부위 전체를 설명 줄에 늘어놓아도 -webkit-line-clamp:2 에 걸려 잘린다.
      // 이 패널의 역할은 "누구 장비를 볼지" 고르는 것이므로 무기만 보이고,
      // 부위별 목록은 선택 후 화면(슬롯당 한 줄)에서 제대로 보여준다.
      const weaponSlot = EQUIPMENT_SLOTS[0];
      return {
        label: actor.name,
        value: equipmentName(equipmentById, worn[weaponSlot.id]),
        icon: equipmentEntryIcon(equipmentById.get(worn[weaponSlot.id] ?? "")),
        testId: `status-menu-equipment-actor-${actor.id}`,
        onActivate: options.onSelectEquipmentActor ? () => options.onSelectEquipmentActor?.(actor.id) : undefined,
      };
    });
    return { title: "장비", entries, emptyLabel: "장비를 볼 파티원이 없습니다", hint: "파티원을 선택하세요." };
  }

  const actor = project.database.actors.find((record) => record.id === options.equipmentActorId);
  if (!actor) return { title: "장비", entries: [], emptyLabel: "파티원을 찾을 수 없습니다" };
  if (!options.equipmentSlotId) {
    const worn = actorEquipment(project, session, actor);
    const entries = EQUIPMENT_SLOTS.map((slot) => ({
      label: slot.label,
      value: equipmentName(equipmentById, worn[slot.id]),
      icon: equipmentEntryIcon(equipmentById.get(worn[slot.id] ?? "")),
      testId: `status-menu-equipment-slot-${slot.id}`,
      onActivate: options.onSelectEquipmentSlot ? () => options.onSelectEquipmentSlot?.(actor.id, slot.id) : undefined,
    }));
    return { title: `장비: ${resolveActorName(session, actor)}`, entries, hint: "바꿀 부위를 선택하세요." };
  }

  const currentEquipmentId = actorEquipment(project, session, actor)[options.equipmentSlotId];
  const classId = effectiveActorClassId(project, session, actor.id);
  const choices = project.database.equipment.filter((equipment) => {
    return equipmentSlotAccepts(project, actor, options.equipmentSlotId as keyof ActorInitialEquipment, equipment, classId)
      && (session.inventory[equipment.id] ?? 0) > 0
      && canEquip(project, actor, equipment, classId);
  });
  const currentStats = equipmentStats(project, currentEquipmentId);
  const unequipEntry = currentEquipmentId
    ? [{
        label: "해제",
        value: equipmentName(equipmentById, currentEquipmentId),
        icon: equipmentEntryIcon(equipmentById.get(currentEquipmentId ?? "")),
        description: `현재 장비를 벗습니다 / ${statDiffLine(zeroStats(), currentStats)}`,
        statDelta: equipmentStatDelta(options, actor, options.equipmentSlotId as keyof ActorInitialEquipment, undefined),
        testId: "status-menu-equipment-item-none",
        onActivate: options.onUnequipItem ? () => options.onUnequipItem?.(actor.id, options.equipmentSlotId as keyof ActorInitialEquipment) : undefined,
      }]
    : [];
  return {
    title: `${actor.name}: ${slotLabel(options.equipmentSlotId)}`,
    entries: [
      ...unequipEntry,
      ...choices.map((equipment) => ({
        label: equipment.name,
        icon: equipmentEntryIcon(equipment),
        value: `소지 ${session.inventory[equipment.id] ?? 0}개`,
        description: equipmentDetailLine(equipment, currentStats),
        statDelta: equipmentStatDelta(options, actor, options.equipmentSlotId as keyof ActorInitialEquipment, equipment.id),
        testId: `status-menu-equipment-item-${equipment.id}`,
        onActivate: options.onEquipItem ? () => options.onEquipItem?.(actor.id, options.equipmentSlotId as keyof ActorInitialEquipment, equipment.id) : undefined,
      })),
    ],
    emptyLabel: "장비할 수 있는 소지품이 없습니다",
    hint: "후보 이동 시 현재 장비 대비 능력치 증감을 표시합니다.",
  };
}

function saveDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  return {
    title: "저장",
    entries: options.slots.map((slot) => ({
      label: `${slot.slot}번 저장`,
      ...saveSlotEntryParts(slot, options.confirmSaveSlot === slot.slot),
      testId: `save-slot-${slot.slot}`,
      onActivate: options.onSaveSlot && options.saveEnabled !== false ? () => options.onSaveSlot?.(slot.slot) : undefined,
      disabled: options.saveEnabled === false,
    })),
    hint: options.saveEnabled === false
      ? "지금은 저장할 수 없습니다."
      : options.confirmSaveSlot
        ? "이미 저장된 칸입니다. 같은 슬롯을 다시 선택하면 덮어씁니다."
        : "저장할 슬롯을 선택하세요.",
  };
}

function loadDetail(slots: readonly SaveSlotReadResult[], onLoadSlot: ((slot: SaveSlotIndex) => void) | undefined): StatusMenuDetail {
  return {
    title: "로드",
    entries: slots.map((slot) => ({
      label: `${slot.slot}번 저장`,
      ...saveSlotEntryParts(slot, false),
      testId: `load-slot-${slot.slot}`,
      onActivate: onLoadSlot && slot.kind === "present" ? () => onLoadSlot(slot.slot) : undefined,
      disabled: slot.kind !== "present",
    })),
    hint: "불러올 저장 칸을 선택하세요.",
  };
}

function statusDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const entries = partyActors(project, session).map((actor) => {
    const vitals = session.actorVitals[actor.id];
    const className = classNameFor(project, session, actor);
    const level = actorLevel(session, actor);
    return {
      label: actor.name,
      value: `${className} L${level}`,
      // 구분자를 "/" 로 쓰면 HP 510/514 의 분수 슬래시와 뒤섞여 어디까지가 한 항목인지
      // 읽히지 않는다. 가운뎃점으로 갈라 분수 슬래시만 슬래시로 남긴다.
      description: vitals
        ? `HP ${vitals.hp}/${vitals.maxHp} · MP ${vitals.mp}/${vitals.maxMp} · 정상`
        : "HP 0/0 · MP 0/0 · 정상",
    };
  });
  return { title: "상태", entries, emptyLabel: "상태를 볼 파티원이 없습니다" };
}

function rowDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const entries = partyActors(options.project, options.session).map((actor) => ({
    label: actor.name,
    value: (options.session.actorRows[actor.id] ?? "front") === "front" ? "전열" : "후열",
    description: "선택하면 전열/후열을 전환합니다",
    testId: `status-menu-row-${actor.id}`,
    onActivate: options.onToggleRow ? () => options.onToggleRow?.(actor.id) : undefined,
  }));
  return { title: "열 바꾸기", entries, emptyLabel: "열을 바꿀 파티원이 없습니다" };
}

function formationDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const actors = partyActors(options.project, options.session);
  const selectedIndex = actors.findIndex((actor) => actor.id === options.formationActorId);
  const entries = actors.map((actor, index) => ({
    label: `${index + 1}. ${actor.name}`,
    value: classNameFor(options.project, options.session, actor),
    description: formationDescription(index, selectedIndex),
    testId: `status-menu-formation-actor-${actor.id}`,
    onActivate: formationActivate(options, actor.id, index, selectedIndex),
  }));
  return {
    title: "진형",
    entries,
    emptyLabel: "순서를 바꿀 파티원이 없습니다",
    hint: selectedIndex >= 0
      ? `${actors[selectedIndex]?.name ?? "선택한 파티원"}을 이동할 위치를 선택하세요.`
      : "먼저 이동할 파티원을 선택하세요.",
  };
}

function monsterDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const view = options.monsterView ?? "party";
  const ids = view === "party" ? options.session.monsterParty : options.session.monsterBox;
  const target = view === "party" ? "box" : "party";
  const entries = [
    {
      label: view === "party" ? "보관함 보기" : "파티 보기",
      value: view === "party" ? `${options.session.monsterBox.length}마리` : `${options.session.monsterParty.length}/${MONSTER_PARTY_MAX}`,
      description: "선택하면 목록을 전환합니다",
      testId: "status-menu-monster-toggle",
      onActivate: options.onToggleMonsterView,
    },
    ...ids.flatMap((instanceId) => {
      const instance = options.session.monsterInstances[instanceId];
      if (!instance) return [];
      const maxHp = monsterMaxHp(options.project, instance);
      const hp = monsterCurrentHp(options.project, instance);
      return [
        {
          label: monsterDisplayName(options.project, instance),
          value: `Lv.${instance.level}  HP ${hp}/${maxHp}`,
          description: view === "party" ? "선택하면 보관함으로 이동합니다" : "선택하면 파티로 이동합니다",
          testId: `status-menu-monster-${instanceId}`,
          onActivate: options.onMoveMonster ? () => options.onMoveMonster?.(instanceId, target) : undefined,
          disabled: target === "party" && options.session.monsterParty.length >= MONSTER_PARTY_MAX,
        },
        ...(instance.pendingSkillIds ?? []).flatMap((pendingSkillId) => {
          const pending = options.project.database.skills.find((skill) => skill.id === pendingSkillId);
          return [
            ...(instance.skillIds ?? []).map((replacedSkillId) => {
              const replaced = options.project.database.skills.find((skill) => skill.id === replacedSkillId);
              return {
                label: `${replaced?.name ?? replacedSkillId} → ${pending?.name ?? pendingSkillId}`,
                value: "기술 교체",
                description: "기존 기술을 잊고 새 기술을 배웁니다",
                testId: `status-menu-monster-skill-replace-${instanceId}-${pendingSkillId}-${replacedSkillId}`,
                onActivate: options.onReplacePendingMonsterSkill
                  ? () => options.onReplacePendingMonsterSkill?.(instanceId, pendingSkillId, replacedSkillId)
                  : undefined,
              };
            }),
            {
              label: `${pending?.name ?? pendingSkillId} 포기`,
              value: "배우지 않음",
              description: "대기 중인 새 기술을 포기합니다",
              testId: `status-menu-monster-skill-reject-${instanceId}-${pendingSkillId}`,
              onActivate: options.onRejectPendingMonsterSkill
                ? () => options.onRejectPendingMonsterSkill?.(instanceId, pendingSkillId)
                : undefined,
            },
          ];
        }),
      ];
    }),
  ];
  return {
    title: view === "party" ? "몬스터: 파티" : "몬스터: 보관함",
    entries,
    emptyLabel: "몬스터가 없습니다",
    hint: view === "party" ? `파티 ${options.session.monsterParty.length}/${MONSTER_PARTY_MAX}` : `보관함 ${options.session.monsterBox.length}마리`,
  };
}

function questsDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const quests = buildQuestLog(project, session);
  return {
    title: "임무",
    entries: quests.flatMap((quest) => [
      {
        label: quest.title,
        value: quest.summary,
        description: "임무 요약",
        testId: `status-menu-quest-${quest.key}`,
      },
      {
        label: "진행",
        value: `${questStateLabel(quest.state)} (${quest.completedSteps}/${quest.totalSteps})`,
        description: "완료한 단계 / 전체 단계",
        testId: `status-menu-quest-state-${quest.key}`,
      },
      ...quest.steps.map((step) => ({
        label: `${step.index + 1}. ${step.done ? "완료" : "진행"}`,
        value: step.label,
        description: step.done ? "완료됨" : "대기 중",
        testId: `status-menu-quest-step-${quest.key}-${step.index}`,
      })),
    ]),
    emptyLabel: "등록된 임무가 없습니다",
    hint: "선택하면 임무 진행 상황을 봅니다.",
  };
}

function relationshipsDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const entries = listFriendshipEntries(session.friendship, undefined, undefined, project).map((entry) => ({
    label: entry.displayName ?? entry.key,
    value: entry.secondary,
    description: entry.label,
    testId: `status-menu-relationship-${entry.key}`,
  }));
  return {
    title: "관계",
    entries,
    emptyLabel: "알려진 관계가 없습니다.",
    hint: "호감이 기록된 관계만 표시됩니다.",
  };
}

function waitDetail(waitModeEnabled: boolean): StatusMenuDetail {
  return {
    title: "전투 대기",
    entries: [{
      label: "현재 설정",
      value: waitModeEnabled ? "ON" : "OFF",
      // 무엇에 영향을 주는지 안 적혀 있어서 켜도 끄도 뭐가 달라지는지 알 수 없었다.
      // 상세 패널이 좁아 3줄에서 잘린다 — 턴제 전투 전제는 제목("전투 대기")이 이미 말해준다.
      description: waitModeEnabled
        ? "명령 입력 중 시간이 멈춥니다."
        : "명령 입력 중에도 시간이 흐릅니다.",
    }],
  };
}

function partyActors(project: Project, session: PlaySession): readonly ActorRecord[] {
  const actorsById = new Map(project.database.actors.map((actor) => [actor.id, actor]));
  return session.partyActorIds.flatMap((actorId): ActorRecord[] => {
    const actor = actorsById.get(actorId);
    if (!actor) return [];
    const name = resolveActorName(session, actor);
    return [name === actor.name ? actor : { ...actor, name }];
  });
}

function learnedSkills(project: Project, session: PlaySession, actor: ActorRecord): readonly SkillRecord[] {
  const skillIds = new Set<string>();
  const classRecord = project.database.classes.find((record) => record.id === effectiveActorClassId(project, session, actor.id));
  const level = actorLevel(session, actor);
  for (const learned of classRecord?.learnedSkills ?? []) if (learned.level <= level) skillIds.add(learned.skillId);
  for (const learned of actor.learnedSkills) if (learned.level <= level) skillIds.add(learned.skillId);
  for (const skillId of session.actorSkillIds[actor.id] ?? []) skillIds.add(skillId);
  return project.database.skills.filter((skill) => skillIds.has(skill.id));
}

function itemTargetEligibility(item: Project["database"]["items"][number], session: PlaySession, actorId: string): boolean {
  const vitals = session.actorVitals[actorId];
  if (!vitals) return false;
  const dead = vitals.hp <= 0;
  if (item.onlyEffectiveOnDeadActors) return dead && hasRecoveryEffect(item);
  if (dead) return false;
  const hp = recoveryAmount(item.hpRecovery, vitals.maxHp);
  const mp = recoveryAmount(item.mpRecovery, vitals.maxMp);
  return (hp > 0 && vitals.hp < vitals.maxHp) || (mp > 0 && vitals.mp < vitals.maxMp);
}

function itemTargetHint(item: Project["database"]["items"][number]): string {
  if (item.scope === "allAllies") return "전체 효과는 사용 가능한 파티원에게만 적용됩니다.";
  if (item.onlyEffectiveOnDeadActors) return "전투불능 대상에게만 사용할 수 있습니다.";
  return "HP/MP가 이미 가득 찬 대상이나 전투불능 대상은 선택할 수 없습니다.";
}

function hasRecoveryEffect(item: Project["database"]["items"][number]): boolean {
  return item.hpRecovery.flat > 0 ||
    item.hpRecovery.percentMax > 0 ||
    item.mpRecovery.flat > 0 ||
    item.mpRecovery.percentMax > 0;
}

function recoveryAmount(recovery: Project["database"]["items"][number]["hpRecovery"], maxValue: number): number {
  return Math.max(0, Math.floor(maxValue * recovery.percentMax / 100) + recovery.flat);
}

function actorLevel(session: PlaySession, actor: ActorRecord): number {
  return session.actorLevels[actor.id] ?? actor.initialLevel;
}

function classNameFor(project: Project, session: PlaySession, actor: ActorRecord): string {
  const classId = effectiveActorClassId(project, session, actor.id);
  return project.database.classes.find((record) => record.id === classId)?.name ?? "직업 없음";
}

function actorEquipment(project: Project, session: PlaySession, actor: ActorRecord): ActorInitialEquipment {
  return effectiveActorEquipment(project, actor, session.actorEquipment[actor.id], effectiveActorClassId(project, session, actor.id));
}

function equipmentStats(project: Project, equipmentId: string | undefined): EquipmentStatBonuses {
  return project.database.equipment.find((record) => record.id === equipmentId)?.statBonuses ?? zeroStats();
}

function equipmentName(equipmentById: ReadonlyMap<string, EquipmentRecord>, equipmentId: string | undefined): string {
  if (!equipmentId) return "없음";
  return equipmentById.get(equipmentId)?.name ?? "없음";
}

// 데이터베이스가 이미 저작해 둔 아이콘을 목록 행에 그린다 — 에디터의
// databaseRecordThumbnails 와 같은 해석 우선순위(iconResourceId → imageResourceId)를 쓴다.
// 이전에는 iconResourceId 가 src/player 어디에서도 읽히지 않아 목록이 전부 글자만 났다.
function itemEntryIcon(item: ItemRecord): NonNullable<StatusMenuDetailEntry["icon"]> {
  return {
    resourceId: item.iconResourceId ?? item.imageResourceId,
    alt: item.name,
    testId: `status-menu-entry-icon-item-${item.id}`,
  };
}

function equipmentEntryIcon(equipment: EquipmentRecord | undefined): NonNullable<StatusMenuDetailEntry["icon"]> | undefined {
  if (!equipment) return undefined;
  return {
    resourceId: equipment.iconResourceId ?? equipment.imageResourceId,
    alt: equipment.name,
    testId: `status-menu-entry-icon-equipment-${equipment.id}`,
  };
}

// SkillRecord 는 icon/image 필드가 없다. 유일한 그래픽 경로는 animationId 가
// 가리키는 battleAnimations 레코드의 resourceId 다(에디톰도 그렇게 잡는다).
function skillEntryIcon(project: Project, skill: SkillRecord): NonNullable<StatusMenuDetailEntry["icon"]> {
  const animation = skill.animationId
    ? project.database.battleAnimations.find((entry) => entry.id === skill.animationId)
    : undefined;
  return {
    resourceId: animation?.resourceId,
    alt: skill.name,
    testId: `status-menu-entry-icon-skill-${skill.id}`,
  };
}

function slotLabel(slotId: keyof ActorInitialEquipment): string {
  return EQUIPMENT_SLOTS.find((slot) => slot.id === slotId)?.label ?? "장비";
}

// 메타가 길면 value(우측 1줄)가 아니라 description(전폭 2줄) 행으로 내려 라벨과 겹치지 않게 한다.
function saveSlotEntryParts(
  slot: SaveSlotReadResult,
  confirmingOverwrite: boolean
): { value: string; description?: string } {
  switch (slot.kind) {
    case "empty": return { value: "비어 있음" };
    case "corrupt": return { value: "손상됨" };
    case "present": {
      const parts = [slot.snapshot.projectTitle];
      if (typeof slot.snapshot.partyLevel === "number") parts.push(`L${slot.snapshot.partyLevel}`);
      if (slot.snapshot.mapName) parts.push(slot.snapshot.mapName);
      if (typeof slot.snapshot.playTimeSeconds === "number") parts.push(formatPlayTime(slot.snapshot.playTimeSeconds));
      return {
        value: confirmingOverwrite ? "덮어쓰기 확인" : "저장됨",
        description: parts.join(" / "),
      };
    }
    default: return assertNever(slot);
  }
}

function formationActivate(
  options: StatusMenuDetailOptions,
  actorId: string,
  index: number,
  selectedIndex: number
): (() => void) | undefined {
  if (selectedIndex >= 0 && index !== selectedIndex && options.formationActorId && options.onMoveFormationActor) {
    return () => options.onMoveFormationActor?.(options.formationActorId as string, index);
  }
  return options.onSelectFormationActor ? () => options.onSelectFormationActor?.(actorId) : undefined;
}

function formationDescription(index: number, selectedIndex: number): string {
  if (selectedIndex < 0) return "선택";
  if (index === selectedIndex) return "이동 중";
  return index < selectedIndex ? "위로 이동" : "아래로 이동";
}

function skillKindLabel(skill: SkillRecord): string {
  switch (skill.effect.kind) {
    case "damage": return "공격";
    case "healing": return "회복";
    case "support": return "보조";
    case "switch": return "스위치";
    default: return assertNever(skill.effect);
  }
}

function statDiffLine(next: EquipmentStatBonuses, current: EquipmentStatBonuses): string {
  return STAT_LABELS.map(([key, label]) => `${label} ${signed(next[key] - current[key])}`).join(" / ");
}

/** 기본 능력치(레벨 곡선) + 전 부위 장비 보너스 합계. 한 부위만 후보로 갈아끼워 비교한다.
    장비 보너스 증감만 보여주면 "방어 +7" 이 큰 건지 작은 건지 판단할 기준이 없다. */
function actorStatTotal(
  options: StatusMenuDetailOptions,
  actor: ActorRecord,
  statKey: keyof EquipmentStatBonuses,
  slotId: keyof ActorInitialEquipment,
  candidateId: string | undefined
): number {
  const { project, session } = options;
  const level = session.actorLevels[actor.id] ?? actor.initialLevel;
  const curves = normalizeActorRecord(actor).parameterCurves;
  const worn: ActorInitialEquipment = { ...actorEquipment(project, session, actor), [slotId]: candidateId };
  return EQUIPMENT_SLOTS.reduce(
    (total, slot) => total + equipmentStats(project, worn[slot.id])[statKey],
    parameterValueAtLevel(curves[statKey], level)
  );
}

function equipmentStatDelta(
  options: StatusMenuDetailOptions,
  actor: ActorRecord,
  slotId: keyof ActorInitialEquipment,
  candidateId: string | undefined
): readonly StatusMenuStatDelta[] {
  const currentId = actorEquipment(options.project, options.session, actor)[slotId];
  return STAT_LABELS.map(([key, label]) => ({
    label,
    current: actorStatTotal(options, actor, key, slotId, currentId),
    next: actorStatTotal(options, actor, key, slotId, candidateId),
  }));
}

function equipmentDetailLine(equipment: EquipmentRecord, currentStats: EquipmentStatBonuses): string {
  return [
    equipment.description || "장비",
    statDiffLine(equipment.statBonuses, currentStats),
    ...equipmentEffectLabels(equipment),
  ].join(" / ");
}

function equipmentEffectLabels(equipment: EquipmentRecord): string[] {
  const labels: string[] = [];
  if (equipment.effectFlags.doubleAttack) labels.push("더블어택");
  if (equipment.elementalDefenseIds.length > 0) labels.push(`속성 방어 ${equipment.elementalDefenseIds.length}`);
  if (equipment.stateDefenseIds.length > 0 && equipment.stateDefenseMode === "resist") labels.push(`상태 방어 ${equipment.stateResistanceChance}%`);
  return labels;
}

function zeroStats(): EquipmentStatBonuses {
  return { attack: 0, defense: 0, mind: 0, agility: 0 };
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatPlayTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu detail: ${String(value)}`);
}
