import source from "@/assets/joseonFolkloreData.json";
import assets from "@/assets/joseonFolkloreAssets.json";
import {
  normalizeClassRecord, normalizeSkillRecord, normalizeItemRecord,
  normalizeEquipmentRecord, normalizeEnemyRecord, normalizeTroopRecord,
  normalizeStateRecord,
} from "@/project/databaseRecordModel";
import type { Project, ProjectDatabaseRecords } from "@/project/types";

export const JOSEON_FOLKLORE_PACK_ID = "joseon-folklore";
export const JOSEON_FOLKLORE_COLLECTIONS = [
  "classes", "skills", "items", "equipment", "enemies", "troops", "states", "elements",
] as const;
type PackCollection = typeof JOSEON_FOLKLORE_COLLECTIONS[number];
export type ContentPackInstallResult = { added: number; preserved: number; counts: Record<PackCollection, number> };

/** Fresh copies: a project's authoring never changes the bundled source. */
export function createJoseonFolkloreRecords(): Pick<ProjectDatabaseRecords, PackCollection> {
  const raw = structuredClone(source) as unknown as Pick<ProjectDatabaseRecords, PackCollection>;
  return {
    classes: raw.classes.map(normalizeClassRecord),
    skills: raw.skills.map(normalizeSkillRecord),
    items: raw.items.map(normalizeItemRecord),
    equipment: raw.equipment.map(normalizeEquipmentRecord),
    enemies: raw.enemies.map(normalizeEnemyRecord),
    troops: raw.troops.map(normalizeTroopRecord),
    states: raw.states.map(normalizeStateRecord),
    elements: raw.elements,
  };
}

export function joseonFolklorePackStatus(project: Project) {
  const records = createJoseonFolkloreRecords();
  let total = 0, installed = 0;
  for (const collection of JOSEON_FOLKLORE_COLLECTIONS) {
    const present = new Set(project.database[collection].map(record => record.id));
    total += records[collection].length;
    installed += records[collection].filter(record => present.has(record.id)).length;
  }
  return { total, installed, complete: total > 0 && installed === total };
}

/** Explicit installation only. Existing IDs keep the author's values on every reapplication. */
export function applyJoseonFolklorePack(project: Project): ContentPackInstallResult {
  const records = createJoseonFolkloreRecords();
  const result: ContentPackInstallResult = { added: 0, preserved: 0, counts: {} as Record<PackCollection, number> };
  for (const collection of JOSEON_FOLKLORE_COLLECTIONS) {
    const target = project.database[collection] as { id: string }[];
    const present = new Set(target.map(record => record.id));
    result.counts[collection] = 0;
    for (const record of records[collection]) {
      if (present.has(record.id)) { result.preserved++; continue; }
      target.push(record); present.add(record.id);
      result.counts[collection]++; result.added++;
    }
  }
  const iconLabels = new Map([...records.items, ...records.equipment].filter(record => record.iconResourceId).map(record => [record.iconResourceId, record.name]));
  const enemyLabels = new Map(records.enemies.map(record => [record.monsterResourceId, record.name]));
  for (const icon of assets.icons) {
    if ('skillId' in icon) iconLabels.set(icon.resourceId, records.skills.find(skill => skill.id === icon.skillId)?.name ?? "조선 설화 기술");
  }
  const profileIds = new Set(project.resourceProfiles.map(profile => profile.assetId));
  for (const icon of assets.icons as { resourceId: string; path: string }[]) {
    if (profileIds.has(icon.resourceId)) continue;
    project.resourceProfiles.push({ kind: "picture", name: `${iconLabels.get(icon.resourceId) ?? "조선 설화"} 아이콘`, assetId: icon.resourceId, imageWidth: 32, imageHeight: 32 });
    profileIds.add(icon.resourceId);
  }
  for (const sheet of assets.sheets as { resourceId: string; path: string; cell: number }[]) {
    if (profileIds.has(sheet.resourceId)) continue;
    project.resourceProfiles.push({ kind: "monster", name: enemyLabels.get(sheet.resourceId) ?? "조선 설화 몬스터", assetId: sheet.resourceId, imageWidth: sheet.cell, imageHeight: sheet.cell });
    profileIds.add(sheet.resourceId);
  }
  return result;
}
