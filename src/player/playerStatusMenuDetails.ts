import type { SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
import { canEquip } from "@/player/playerEquipmentRules";
import { resolveActorName } from "@/project/sessionActorCommands";
import type { PlaySession } from "@/project/session";
import type {
  ActorInitialEquipment,
  ActorRecord,
  EquipmentStatBonuses,
  EquipmentRecord,
  Project,
  SkillRecord,
} from "@/project/types";
import type { StatusMenuDetail, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";
import { buildQuestLog, questStateLabel } from "@/player/questLog";

export type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";

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
  switch (options.selectedCommand) {
    case "items": return itemDetail(options);
    case "skills": return skillDetail(options);
    case "equipment": return equipmentDetail(options);
    case "save": return saveDetail(options);
    case "load": return loadDetail(options.slots, options.onLoadSlot);
    case "status": return statusDetail(options.project, options.session);
    case "row": return rowDetail(options);
    case "formation": return formationDetail(options);
    case "quests": return questsDetail(options.project, options.session);
    case "wait": return waitDetail(options.waitModeEnabled);
    case "to-title": return { title: "타이틀", entries: [], hint: "타이틀 화면으로 돌아갑니다." };
    default: return assertNever(options.selectedCommand);
  }
}

function itemDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  if (options.targetItemId) {
    const item = project.database.items.find((record) => record.id === options.targetItemId);
    if (!item) return { title: "대상 선택", entries: [], emptyLabel: "아이템을 찾을 수 없습니다" };
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
    value: `${inventory.get(item.id) ?? 0}개`,
    description: item.description,
    testId: `status-menu-item-${item.id}`,
    onActivate: (item.scope === "ally" || item.scope === "allAllies") && options.onSelectItemTarget
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
      const equipped = EQUIPMENT_SLOTS.map((slot) => equipmentName(equipmentById, actorEquipment(session, actor.id)[slot.id]));
      return {
        label: actor.name,
        value: equipped.join(" / "),
        testId: `status-menu-equipment-actor-${actor.id}`,
        onActivate: options.onSelectEquipmentActor ? () => options.onSelectEquipmentActor?.(actor.id) : undefined,
      };
    });
    return { title: "장비", entries, emptyLabel: "장비를 볼 파티원이 없습니다" };
  }

  const actor = project.database.actors.find((record) => record.id === options.equipmentActorId);
  if (!actor) return { title: "장비", entries: [], emptyLabel: "파티원을 찾을 수 없습니다" };
  if (!options.equipmentSlotId) {
    const entries = EQUIPMENT_SLOTS.map((slot) => ({
      label: slot.label,
      value: equipmentName(equipmentById, actorEquipment(session, actor.id)[slot.id]),
      testId: `status-menu-equipment-slot-${slot.id}`,
      onActivate: options.onSelectEquipmentSlot ? () => options.onSelectEquipmentSlot?.(actor.id, slot.id) : undefined,
    }));
    return { title: `장비: ${resolveActorName(session, actor)}`, entries, hint: "바꿀 부위를 선택하세요." };
  }

  const currentEquipmentId = actorEquipment(session, actor.id)[options.equipmentSlotId];
  const choices = project.database.equipment.filter((equipment) => {
    return equipment.slot === options.equipmentSlotId
      && (session.inventory[equipment.id] ?? 0) > 0
      && canEquip(project, actor, equipment);
  });
  const currentStats = equipmentStats(project, currentEquipmentId);
  const unequipEntry = currentEquipmentId
    ? [{
        label: "해제",
        value: equipmentName(equipmentById, currentEquipmentId),
        description: `현재 장비를 벗습니다 / ${statDiffLine(zeroStats(), currentStats)}`,
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
        value: `소지 ${session.inventory[equipment.id] ?? 0}개`,
        description: `${equipment.description || "장비"} / ${statDiffLine(equipment.statBonuses, currentStats)}`,
        testId: `status-menu-equipment-item-${equipment.id}`,
        onActivate: options.onEquipItem ? () => options.onEquipItem?.(actor.id, equipment.id) : undefined,
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
    const className = project.database.classes.find((record) => record.id === actor.classId)?.name ?? "직업 없음";
    const level = actorLevel(session, actor);
    return {
      label: actor.name,
      value: `${className} L${level}`,
      description: vitals
        ? `HP ${vitals.hp}/${vitals.maxHp} / MP ${vitals.mp}/${vitals.maxMp} / 정상`
        : "HP 0/0 / MP 0/0 / 정상",
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
  return { title: "열", entries, emptyLabel: "열을 바꿀 파티원이 없습니다" };
}

function formationDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const actors = partyActors(options.project, options.session);
  const selectedIndex = actors.findIndex((actor) => actor.id === options.formationActorId);
  const entries = actors.map((actor, index) => ({
    label: `${index + 1}. ${actor.name}`,
    value: options.project.database.classes.find((record) => record.id === actor.classId)?.name ?? "직업 없음",
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

function waitDetail(waitModeEnabled: boolean): StatusMenuDetail {
  return {
    title: "대기",
    entries: [{
      label: "현재 설정",
      value: waitModeEnabled ? "ON" : "OFF",
      description: waitModeEnabled ? "대기 방식을 ON으로 사용 중입니다." : "대기 방식을 OFF로 전환했습니다.",
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
  const classRecord = project.database.classes.find((record) => record.id === actor.classId);
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

function actorEquipment(session: PlaySession, actorId: string): ActorInitialEquipment {
  return session.actorEquipment[actorId] ?? {};
}

function equipmentStats(project: Project, equipmentId: string | undefined): EquipmentStatBonuses {
  return project.database.equipment.find((record) => record.id === equipmentId)?.statBonuses ?? zeroStats();
}

function equipmentName(equipmentById: ReadonlyMap<string, EquipmentRecord>, equipmentId: string | undefined): string {
  if (!equipmentId) return "없음";
  return equipmentById.get(equipmentId)?.name ?? "없음";
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
