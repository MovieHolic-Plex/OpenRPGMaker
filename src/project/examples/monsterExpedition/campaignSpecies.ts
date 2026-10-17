import type { Project } from "@/project/types";
import { monsterSpeciesForEnemy } from "@/project/monsterCollection";
import { EXPEDITION_SPECIES } from "./roster";

/** 게임 어디에서도 쓰지 않는 종(스타터·야생·트레이너·희귀·지급이 아닌 것)을 계통째 덜어 도감을 target 종 이상으로 줄인다.
 * 쓰는 종은 지우지 않는다 — 그래서 실제 도감 수가 target 보다 클 수 있고, 호출자는 실제 수를 약속(plan)으로 싣는다. */
export function pruneUnusedSpecies(project: Project, target: number): { readonly before: number; readonly after: number; readonly removed: readonly string[] } {
  const campaign = project.system.monsterCampaign;
  if (!campaign) return { before: 0, after: 0, removed: [] };
  const before = campaign.speciesIds.length;
  const used = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.kind === "giveMonster" && typeof record.speciesId === "string") used.add(record.speciesId);
    Object.values(record).forEach(visit);
  };
  for (const map of Object.values(project.maps)) for (const event of map.events) visit(event.pages ?? event.commands);
  const troopIds = new Set<string>();
  for (const map of Object.values(project.maps)) {
    for (const entry of map.encounterTable ?? []) troopIds.add(entry.troopId);
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (record.kind === "battleProcessing" && typeof record.troopId === "string") troopIds.add(record.troopId);
      Object.values(record).forEach(walk);
    };
    for (const event of map.events) walk(event.pages ?? event.commands);
  }
  const enemies = new Map(project.database.enemies.map(e => [e.id, e]));
  for (const troop of project.database.troops) if (troopIds.has(troop.id)) for (const member of troop.members ?? []) {
    const species = monsterSpeciesForEnemy(project, enemies.get(member.enemyId));
    if (species) used.add(species.id);
  }
  // 계통 단위: 한 종이라도 쓰이면 그 계통(진화 사슬)은 통째로 남긴다.
  const families = new Map<string, string[]>();
  for (const info of EXPEDITION_SPECIES) {
    if (!campaign.speciesIds.includes(info.id)) continue;
    families.set(info.family, [...(families.get(info.family) ?? []), info.id]);
  }
  const removable = [...families.values()].filter(ids => ids.every(id => !used.has(id))).reverse();
  let count = before;
  const removed: string[] = [];
  for (const ids of removable) {
    if (count - ids.length < target) continue;
    removed.push(...ids);
    count -= ids.length;
  }
  if (!removed.length) return { before, after: before, removed };
  const gone = new Set(removed);
  const art = new Set<string>();
  for (const species of project.database.monsterSpecies ?? []) if (gone.has(species.id)) {
    if (species.graphic.monsterResourceId) art.add(species.graphic.monsterResourceId);
    if (species.graphic.backResourceId) art.add(species.graphic.backResourceId);
  }
  project.database.monsterSpecies = (project.database.monsterSpecies ?? []).filter(s => !gone.has(s.id));
  project.database.enemies = project.database.enemies.filter(e => !(e.speciesId && gone.has(e.speciesId)) && !gone.has(e.id));
  campaign.speciesIds = campaign.speciesIds.filter(id => !gone.has(id));
  for (const id of removed) delete campaign.speciesNotes[id];
  // 다른 곳(남은 종·적·오프닝)이 쓰지 않는 그림만 덜어 낸다.
  const stillUsed = new Set<string>();
  const scan = (value: unknown): void => {
    if (typeof value === "string") { if (art.has(value)) stillUsed.add(value); return; }
    if (Array.isArray(value)) { value.forEach(scan); return; }
    if (value && typeof value === "object") Object.values(value).forEach(scan);
  };
  scan(project.database); scan(project.maps); scan(project.system); scan(project.meta);
  for (const id of art) if (!stillUsed.has(id)) delete project.assets.uploaded[id];
  return { before, after: count, removed };
}
