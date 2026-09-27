// 스킬 장착(로드아웃) — ActorRecord.loadoutSlots 가 있는 배우는 전투에서 장착한 스킬만 쓴다.
//
// 배운 스킬 목록(전투 battler.skillIds, 메뉴 learnedSkills)은 그대로 두고, 장착은 그 부분 집합이다.
// 장착 목록은 session.actorSkillLoadouts[actorId]. 배우에 loadoutSlots 가 없으면 이 파일은 아무것도 거르지 않는다.
import type { ActorId, ActorRecord, Project, SkillId } from "@/project/types";

export const LOADOUT_SLOTS_MAX = 12;

type LoadoutSession = { actorSkillLoadouts?: Record<ActorId, SkillId[]> };
type ReadonlyLoadouts = Readonly<Record<string, readonly SkillId[]>> | undefined;

export function normalizeLoadoutSlots(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const slots = Math.trunc(value);
  if (slots < 1) return undefined;
  return Math.min(LOADOUT_SLOTS_MAX, slots);
}

export function actorLoadoutSlots(actor: Pick<ActorRecord, "loadoutSlots"> | undefined): number | undefined {
  return normalizeLoadoutSlots(actor?.loadoutSlots);
}

/**
 * 배운 스킬 중 전투에서 쓸 수 있는 것. 장착 칸이 없는 배우는 배운 스킬 전부.
 * 장착 칸이 있는 배우는 장착 목록 ∩ 배운 스킬(칸 수까지). 아직 장착한 적이 없으면 배운 순서 앞에서부터 칸 수만큼.
 */
export function equippedBattleSkillIds(
  actor: Pick<ActorRecord, "loadoutSlots"> | undefined,
  learned: readonly SkillId[],
  loadout: readonly SkillId[] | undefined,
): SkillId[] {
  const slots = actorLoadoutSlots(actor);
  if (slots === undefined) return [...learned];
  if (loadout === undefined) return learned.slice(0, slots);
  const known = new Set(learned);
  return loadout.filter((skillId, index) => known.has(skillId) && loadout.indexOf(skillId) === index).slice(0, slots);
}

/**
 * 배운 스킬을 데이터베이스 스킬 순서로 줄 세운다 — 메뉴(learnedSkills)와 전투가 «아직 장착 안 함» 기본 칸을
 * 같은 순서로 채우게 한다.
 */
export function sortByDatabaseSkillOrder(project: Pick<Project, "database">, skillIds: readonly SkillId[]): SkillId[] {
  const order = new Map(project.database.skills.map((skill, index) => [skill.id, index]));
  return [...skillIds].sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
}

/** 전투 battler 목록에 장착 필터를 입힌다(배우 battler 만; recordId 로 배우를 찾는다). */
export function applySkillLoadoutsToBattlers(
  project: Pick<Project, "database">,
  battlers: { recordId: string; skillIds?: SkillId[] }[],
  loadouts: ReadonlyLoadouts,
): void {
  for (const battler of battlers) {
    const actor = project.database.actors.find((record) => record.id === battler.recordId);
    if (actorLoadoutSlots(actor) === undefined || !battler.skillIds) continue;
    battler.skillIds = equippedBattleSkillIds(actor, sortByDatabaseSkillOrder(project, battler.skillIds), loadouts?.[battler.recordId]);
  }
}

export type LoadoutToggleResult =
  | { readonly ok: true; readonly equipped: boolean; readonly loadout: SkillId[] }
  | { readonly ok: false; readonly reason: "noLoadout" | "notLearned" | "full" };

/** 메뉴 장착 토글. 장착돼 있으면 빼고, 아니면 빈 칸이 있을 때 넣는다. */
export function toggleSkillLoadout(
  session: LoadoutSession,
  actor: Pick<ActorRecord, "id" | "loadoutSlots">,
  learned: readonly SkillId[],
  skillId: SkillId,
): LoadoutToggleResult {
  const slots = actorLoadoutSlots(actor);
  if (slots === undefined) return { ok: false, reason: "noLoadout" };
  if (!learned.includes(skillId)) return { ok: false, reason: "notLearned" };
  const current = equippedBattleSkillIds(actor, learned, session.actorSkillLoadouts?.[actor.id]);
  if (current.includes(skillId)) {
    const loadout = current.filter((id) => id !== skillId);
    session.actorSkillLoadouts = { ...(session.actorSkillLoadouts ?? {}), [actor.id]: loadout };
    return { ok: true, equipped: false, loadout };
  }
  if (current.length >= slots) return { ok: false, reason: "full" };
  const loadout = [...current, skillId];
  session.actorSkillLoadouts = { ...(session.actorSkillLoadouts ?? {}), [actor.id]: loadout };
  return { ok: true, equipped: true, loadout };
}
