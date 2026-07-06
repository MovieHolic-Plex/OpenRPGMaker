import { defaultActorFaceResourceId } from "@/project/actorModel";
import type { PlaySession } from "@/project/session";
import type {
  ActorRecord,
  EquipmentStatBonuses,
  Project,
  SkillRecord,
} from "@/project/types";
import type { SaveSlotReadResult } from "@/player/saveSlots";
import { resolveActorName } from "@/project/sessionActorCommands";
import { EQUIPMENT_SLOTS, STAT_LABELS } from "@/player/playerStatusMenuFunctionTypes";

export function partyActors(project: Project, session: PlaySession): readonly ActorRecord[] {
  const byId = new Map(project.database.actors.map((actor) => [actor.id, actor]));
  return session.partyActorIds.flatMap((id) => {
    const actor = byId.get(id);
    if (!actor) return [];
    // 세션 이름 오버라이드를 반영해 메뉴 표시 이름을 결정한다.
    const name = resolveActorName(session, actor);
    return [name === actor.name ? actor : { ...actor, name }];
  });
}

export function learnedSkills(project: Project, session: PlaySession, actor: ActorRecord): readonly SkillRecord[] {
  const ids = new Set(session.actorSkillIds[actor.id] ?? []);
  const level = actorLevel(session, actor);
  const klass = project.database.classes.find((record) => record.id === actor.classId);
  for (const learned of actor.learnedSkills) if (learned.level <= level) ids.add(learned.skillId);
  for (const learned of klass?.learnedSkills ?? []) if (learned.level <= level) ids.add(learned.skillId);
  return project.database.skills.filter((skill) => ids.has(skill.id));
}

export function actorFace(actor: ActorRecord): string | undefined {
  return actor.faceResourceId ?? defaultActorFaceResourceId(actor);
}

export function actorLevel(session: PlaySession, actor: ActorRecord): number {
  return session.actorLevels[actor.id] ?? actor.initialLevel;
}

export function actorVitals(session: PlaySession, actorId: string): string {
  const v = session.actorVitals[actorId];
  return v ? `HP ${v.hp}/${v.maxHp} / MP ${v.mp}/${v.maxMp}` : "HP 0/0 / MP 0/0";
}

export function className(project: Project, actor: ActorRecord): string {
  return project.database.classes.find((record) => record.id === actor.classId)?.name ?? "직업 없음";
}

export function rowLabel(row: PlaySession["actorRows"][string] | undefined): string {
  return row === "back" ? "후열" : "전열";
}

export function slotStatus(slot: SaveSlotReadResult): string {
  switch (slot.kind) {
    case "empty": return "비어 있음";
    case "corrupt": return "손상됨";
    case "present": {
      const parts = [slot.snapshot.projectTitle];
      if (slot.snapshot.mapName) parts.push(slot.snapshot.mapName);
      if (typeof slot.snapshot.playTimeSeconds === "number") parts.push(formatPlayTime(slot.snapshot.playTimeSeconds));
      return parts.join(" / ");
    }
    default: return assertNever(slot);
  }
}

// 플레이 타임(초)을 "h:mm:ss" 또는 "m:ss" 형태로 포맷.
export function formatPlayTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function equipmentName(project: Project, equipmentId: string | undefined): string {
  return equipmentId ? project.database.equipment.find((record) => record.id === equipmentId)?.name ?? "없음" : "없음";
}

export function equipmentStats(project: Project, equipmentId: string | undefined): EquipmentStatBonuses {
  return project.database.equipment.find((record) => record.id === equipmentId)?.statBonuses ?? zeroStats();
}

export function totalEquipmentStats(project: Project, session: PlaySession, actorId: string): EquipmentStatBonuses {
  const total = zeroStats();
  const equipment = session.actorEquipment[actorId] ?? {};
  for (const [slot] of EQUIPMENT_SLOTS) addStats(total, equipmentStats(project, equipment[slot]));
  return total;
}

export function equipmentSummary(project: Project, session: PlaySession, actorId: string): string {
  const equipment = session.actorEquipment[actorId] ?? {};
  return EQUIPMENT_SLOTS.map(([slot]) => equipmentName(project, equipment[slot])).join(" / ");
}

export function statLine(stats: EquipmentStatBonuses): string {
  return STAT_LABELS.map(([key, label]) => `${label} ${signed(stats[key])}`).join(" / ");
}

export function diffLine(next: EquipmentStatBonuses, current: EquipmentStatBonuses): string {
  return STAT_LABELS.map(([key, label]) => `${label} ${signed(next[key] - current[key])}`).join(" / ");
}

function zeroStats(): EquipmentStatBonuses {
  return { attack: 0, defense: 0, mind: 0, agility: 0 };
}

function addStats(target: EquipmentStatBonuses, source: EquipmentStatBonuses): void {
  target.attack += source.attack;
  target.defense += source.defense;
  target.mind += source.mind;
  target.agility += source.agility;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu data value: ${String(value)}`);
}
