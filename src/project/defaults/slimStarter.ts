import type { Project } from "../types";
import { createBlankProject } from "./blankProject";

/**
 * 「슬림 스타터」 — 빈 프로젝트가 처음부터 데모 데이터(주인공 136명·스킬 1243개·아이템 1000여 개·
 * 데모 스위치 15개)를 들고 태어나지 않게 한다 (2026-10-21 UI/UX VQA F14/F15).
 *
 * `createBlankProject()` 자체는 건드리지 않는다 — 테스트·헤드리스 도구·데모·장르 프리셋이 전체 기본 DB 에 의존한다.
 * 사용자가 직접 보는 「빈 프로젝트」 경로만 이 함수를 쓴다.
 *
 * 표식 `flags.slimStarter` 가 있으면 로드 때 돌아가는 수렴기(`ensureRetroRosterRecords`)가 로스터를 다시 채우지 않는다.
 */
export const SLIM_STARTER_FLAG = "slimStarter";

export function isSlimStarterProject(project: { flags?: Record<string, unknown> } | null | undefined): boolean {
  return project?.flags?.[SLIM_STARTER_FLAG] === true;
}

const KEEP_SKILL_IDS: readonly string[] = ["skill_attack", "skill_focus", "skill_sword_slash"];
const KEEP_ITEM_IDS: readonly string[] = ["item_potion", "item_ether", "item_antidote", "item_wake_herb", "item_old_key"];
const KEEP_ITEM_SKILL_IDS: readonly string[] = ["skill_item_potion", "skill_item_ether", "skill_item_antidote", "skill_item_wake"];
const KEEP_STATE_IDS: readonly string[] = [
  "state_poison", "state_sleep", "state_paralysis", "state_attack_up", "state_defense_up", "state_regen",
];

/** 장비가 들고 있는 상태 참조(저항·부여 등)에서 걷어 낸 상태 id 를 지운다. */
function pruneStateRefs(record: Record<string, unknown>, keepStates: ReadonlySet<string>): void {
  for (const [key, value] of Object.entries(record)) {
    if (/state/i.test(key) && Array.isArray(value)) {
      record[key] = value.filter((entry) => typeof entry !== "string" || keepStates.has(entry));
    }
  }
}

export function slimStarterProject(project: Project): Project {
  const db = project.database;
  const heroId = project.system.startActorIds[0];
  const hero = db.actors.find((actor) => actor.id === heroId) ?? db.actors[0];
  if (!hero) return project;
  const heroClass = db.classes.find((record) => record.id === hero.classId);

  db.actors = [hero];
  db.classes = heroClass ? [heroClass] : [];
  if (heroClass) {
    heroClass.skillIds = heroClass.skillIds.filter((id) => KEEP_SKILL_IDS.includes(id));
    heroClass.learnedSkills = heroClass.learnedSkills.filter((entry) => KEEP_SKILL_IDS.includes(entry.skillId));
  }
  const equipped = new Set(Object.values(hero.initialEquipment ?? {}).filter((id): id is string => typeof id === "string"));
  const keepSkills = new Set<string>([...KEEP_SKILL_IDS, ...KEEP_ITEM_SKILL_IDS]);
  db.equipment = db.equipment.filter((record) => equipped.has(record.id));
  db.skills = db.skills.filter((record) => keepSkills.has(record.id));
  db.items = db.items.filter((record) => KEEP_ITEM_IDS.includes(record.id) && !record.switchId);
  db.states = db.states.filter((record) => KEEP_STATE_IDS.includes(record.id));
  const keepStates = new Set(db.states.map((record) => record.id));
  for (const record of db.equipment) {
    record.equippableActorIds = record.equippableActorIds.filter((id) => id === hero.id);
    record.equippableClassIds = record.equippableClassIds.filter((id) => id === heroClass?.id);
    pruneStateRefs(record as unknown as Record<string, unknown>, keepStates);
  }
  if (heroClass?.equipmentPermissions) {
    const permissions = heroClass.equipmentPermissions;
    permissions.equipmentIds = permissions.equipmentIds.filter((id) => equipped.has(id));
    permissions.actorIds = permissions.actorIds.filter((id) => id === hero.id);
    permissions.classIds = permissions.classIds.filter((id) => id === heroClass.id);
  }

  const troop = db.troops.find((record) => record.id === project.system.initialTroopId) ?? db.troops[0];
  db.troops = troop ? [troop] : [];
  const enemyIds = new Set(troop?.enemyIds ?? []);
  db.enemies = db.enemies.filter((record) => enemyIds.has(record.id));
  for (const record of db.enemies) {
    record.skillIds = record.skillIds.filter((id) => keepSkills.has(id));
    record.actions = (record.actions ?? []).filter((action) => keepSkills.has(action.skillId));
  }
  const speciesIds = new Set(db.enemies.map((record) => (record as { speciesId?: string }).speciesId).filter(Boolean));
  db.monsterSpecies = (db.monsterSpecies ?? []).filter((record) => speciesIds.has(record.id));
  for (const record of db.monsterSpecies) {
    record.skillsByLevel = (record.skillsByLevel ?? []).filter((entry) => keepSkills.has(entry.skillId));
    record.evolutions = [];
  }

  // 데모 스위치(아이템이 켜는 기동석 등)를 걷어 내고 빈 슬롯만 남긴다.
  const removed = new Set(project.switches.filter((entry) => entry.name).map((entry) => entry.id));
  project.switches = project.switches.filter((entry) => !removed.has(entry.id));
  for (const id of removed) delete project.session.switches[id];
  project.session.inventory = {};
  project.flags = { ...project.flags, [SLIM_STARTER_FLAG]: true };
  return project;
}

/** 사용자가 만드는 「빈 프로젝트」. 전체 기본 DB 가 필요하면 `createBlankProject()` 를 쓴다. */
export function createStarterBlankProject(): Project {
  return slimStarterProject(createBlankProject());
}
