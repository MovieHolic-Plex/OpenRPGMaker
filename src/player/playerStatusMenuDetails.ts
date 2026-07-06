import type { SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
import { canEquip } from "@/player/playerEquipmentRules";
import { resolveActorName } from "@/project/sessionActorCommands";
import type { PlaySession } from "@/project/session";
import type {
  ActorInitialEquipment,
  ActorRecord,
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

export function createStatusMenuDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  switch (options.selectedCommand) {
    case "items": return itemDetail(options);
    case "skills": return skillDetail(options.project, options.session);
    case "equipment": return equipmentDetail(options);
    case "save": return saveDetail(options.slots, options.onSaveSlot);
    case "load": return { title: "로드", entries: [], hint: "저장된 진행 상황을 불러옵니다." };
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
        return {
          label: actor.name,
          value: vitals ? `HP ${vitals.hp}/${vitals.maxHp}` : "HP 0/0",
          description: "사용할 대상을 선택하세요",
          testId: `status-menu-item-target-${actor.id}`,
          onActivate: options.onUseItem ? () => options.onUseItem?.(item.id, actor.id) : undefined,
        };
      }),
      emptyLabel: "대상이 없습니다",
    };
  }

  const inventory = new Map(Object.entries(session.inventory).filter(([, count]) => count > 0));
  const entries = project.database.items.filter((item) => inventory.has(item.id)).map((item) => ({
    label: item.name,
    value: `${inventory.get(item.id) ?? 0}개`,
    description: item.description,
    testId: `status-menu-use-${item.id}`,
    onActivate: item.scope === "ally" && options.onSelectItemTarget
      ? () => options.onSelectItemTarget?.(item.id)
      : options.onUseItem ? () => options.onUseItem?.(item.id) : undefined,
  }));
  return { title: "아이템", entries, emptyLabel: "아이템이 없습니다" };
}

function skillDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const entries = partyActors(project, session).map((actor) => {
    const skills = learnedSkills(project, session, actor);
    return {
      label: actor.name,
      value: skills.length > 0 ? skills.map((skill) => skill.name).join(", ") : "스킬 없음",
      description: actor.nickname,
    };
  });
  return { title: "스킬", entries, emptyLabel: "스킬이 없습니다" };
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

  const choices = project.database.equipment.filter((equipment) => {
    return equipment.slot === options.equipmentSlotId
      && (session.inventory[equipment.id] ?? 0) > 0
      && canEquip(project, actor, equipment);
  });
  return {
    title: `${actor.name}: ${slotLabel(options.equipmentSlotId)}`,
    entries: choices.map((equipment) => ({
      label: equipment.name,
      value: `소지 ${session.inventory[equipment.id] ?? 0}개`,
      description: equipment.description,
      testId: `status-menu-equip-${equipment.id}`,
      onActivate: options.onEquipItem ? () => options.onEquipItem?.(actor.id, equipment.id) : undefined,
    })),
    emptyLabel: "장비할 수 있는 소지품이 없습니다",
    hint: "데이터베이스 착용 가능 설정을 따릅니다.",
  };
}

function saveDetail(slots: readonly SaveSlotReadResult[], onSaveSlot: ((slot: SaveSlotIndex) => void) | undefined): StatusMenuDetail {
  return {
    title: "저장",
    entries: slots.map((slot) => ({
      label: `${slot.slot}번 저장`,
      value: saveSlotStatus(slot),
      testId: `save-slot-${slot.slot}`,
      onActivate: onSaveSlot ? () => onSaveSlot(slot.slot) : undefined,
    })),
    hint: "저장할 슬롯을 선택하세요.",
  };
}

function statusDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const entries = partyActors(project, session).map((actor) => {
    const vitals = session.actorVitals[actor.id];
    const className = project.database.classes.find((record) => record.id === actor.classId)?.name ?? "직업 없음";
    const level = actorLevel(session, actor);
    return {
      label: actor.name,
      value: vitals
        ? `${className} L${level} / HP ${vitals.hp}/${vitals.maxHp} / MP ${vitals.mp}/${vitals.maxMp} / 정상`
        : `${className} L${level} / HP 0/0 / MP 0/0 / 정상`,
    };
  });
  return { title: "상태", entries, emptyLabel: "상태를 볼 파티원이 없습니다" };
}

function rowDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const entries = partyActors(options.project, options.session).map((actor) => ({
    label: actor.name,
    value: (options.session.actorRows[actor.id] ?? "front") === "front" ? "전열" : "후열",
    description: "선택하면 전열/후열을 전환합니다",
    testId: `status-menu-row-toggle-${actor.id}`,
    onActivate: options.onToggleRow ? () => options.onToggleRow?.(actor.id) : undefined,
  }));
  return { title: "열", entries, emptyLabel: "열을 바꿀 파티원이 없습니다" };
}

function formationDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const entries = partyActors(options.project, options.session).map((actor, index) => ({
    label: `${index + 1}. ${actor.name}`,
    value: options.project.database.classes.find((record) => record.id === actor.classId)?.name ?? "Class none",
    description: "Open Formation for the RPG 2003 order-change screen.",
    testId: `status-menu-formation-actor-${actor.id}`,
  }));
  return {
    title: "Formation",
    entries,
    emptyLabel: "No party members to reorder.",
    hint: "Choose Formation to move party members by selecting a member, then the target position.",
  };
}

function questsDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const quests = buildQuestLog(project, session);
  return {
    title: "임무",
    entries: quests.map((quest) => ({
      label: quest.title,
      value: `${questStateLabel(quest.state)} (${quest.completedSteps}/${quest.totalSteps})`,
      description: quest.summary,
      testId: `status-menu-quest-entry-${quest.key}`,
    })),
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

function actorLevel(session: PlaySession, actor: ActorRecord): number {
  return session.actorLevels[actor.id] ?? actor.initialLevel;
}

function actorEquipment(session: PlaySession, actorId: string): ActorInitialEquipment {
  return session.actorEquipment[actorId] ?? {};
}

function equipmentName(equipmentById: ReadonlyMap<string, EquipmentRecord>, equipmentId: string | undefined): string {
  if (!equipmentId) return "없음";
  return equipmentById.get(equipmentId)?.name ?? "없음";
}

function slotLabel(slotId: keyof ActorInitialEquipment): string {
  return EQUIPMENT_SLOTS.find((slot) => slot.id === slotId)?.label ?? "장비";
}

function saveSlotStatus(slot: SaveSlotReadResult): string {
  switch (slot.kind) {
    case "empty": return "비어 있음";
    case "corrupt": return "손상됨";
    case "present": return slot.snapshot.projectTitle;
    default: return assertNever(slot);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu detail: ${String(value)}`);
}
