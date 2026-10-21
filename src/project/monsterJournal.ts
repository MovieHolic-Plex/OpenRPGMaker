import type { BattleBattlerSnapshot } from '@/battle/types';
import type { PlaySession } from '@/project/session';
import type { Project } from '@/project/types';

/** Mirrors the optional authored system config; no new save fields are needed. */
export type MonsterCampaignDefinition = {
  id: string;
  name: string;
  dexRegisteredText?: string;
  speciesIds: string[];
  speciesNotes: Record<string, string>;
  badges: { id: string; name: string; switchId: string; cityMapId: string; iconResourceId?: string }[];
  locations: { mapId: string; name: string; x: number; y: number; kind: 'town' | 'route' | 'dungeon' | 'league' }[];
  objectives: { id: string; title: string; summary?: string; switchId: string; requiresSwitchId?: string }[];
  obedienceLevelCaps?: import('@/project/types/database').ObedienceLevelCaps;
};

export function monsterCampaign(project: Project): MonsterCampaignDefinition | undefined {
  return (project.system as Project['system'] & { monsterCampaign?: MonsterCampaignDefinition }).monsterCampaign;
}

/**
 * 도감이 다루는 종 id. 원정 정의가 있으면 그 목록, 없으면 수집 게임(system.monsterCollection)일 때만 종 레코드 전부.
 * 둘 다 아니면 빈 목록 — 도감이 없는 장르의 저장 바이트와 메뉴는 그대로다.
 */
export function monsterDexSpeciesIds(project: Project): readonly string[] {
  const campaign = monsterCampaign(project);
  if (campaign) return campaign.speciesIds;
  if (project.system.monsterCollection !== true) return [];
  return (project.database.monsterSpecies ?? []).map((species) => species.id);
}

/** 이 종의 도감 설명: 원정 노트 > 종 레코드 dexNote > 비어 있음. */
export function monsterDexNote(project: Project, speciesId: string): string | undefined {
  const campaignNote = monsterCampaign(project)?.speciesNotes[speciesId];
  if (campaignNote) return campaignNote;
  const note = project.database.monsterSpecies?.find((species) => species.id === speciesId)?.dexNote?.trim();
  return note || undefined;
}

/** 이 종이 야생으로 나오는 맵 이름(조우표 → 무리 → 적 → 종). 도감 「분포」 줄의 근거. */
export function monsterSpeciesHabitats(project: Project, speciesId: string): string[] {
  const troopHasSpecies = new Map<string, boolean>();
  const hasSpecies = (troopId: string): boolean => {
    const cached = troopHasSpecies.get(troopId);
    if (cached !== undefined) return cached;
    const troop = project.database.troops.find((record) => record.id === troopId);
    const enemyIds = troop ? [...(troop.members?.map((member) => member.enemyId) ?? troop.enemyIds)] : [];
    const found = enemyIds.some((enemyId) => {
      const enemy = project.database.enemies.find((record) => record.id === enemyId);
      return (enemy?.speciesId ?? (project.database.monsterSpecies?.some((species) => species.id === enemyId) ? enemyId : undefined)) === speciesId;
    });
    troopHasSpecies.set(troopId, found);
    return found;
  };
  const names: string[] = [];
  for (const map of Object.values(project.maps)) {
    const troopIds = [...(map.encounterTable?.map((entry) => entry.troopId) ?? []), ...(map.encounterTable ? [] : map.troopIds ?? [])];
    if (troopIds.some(hasSpecies) && !names.includes(map.name)) names.push(map.name);
  }
  return names;
}

export function recordMonsterSeen(project: Project, session: PlaySession, speciesId: string): void {
  if (!monsterDexSpeciesIds(project).includes(speciesId)) return;
  session.switches[`mx_seen_${speciesId}`] = true;
}

export function recordMonsterCaught(project: Project, session: PlaySession, speciesId: string): void {
  if (!monsterDexSpeciesIds(project).includes(speciesId)) return;
  recordMonsterSeen(project, session, speciesId);
  session.switches[`mx_caught_${speciesId}`] = true;
}

/** Legacy ownership is promoted to permanent receipts before an instance changes or disappears. */
export function reconcileMonsterJournal(project: Project, session: PlaySession): void {
  if (monsterDexSpeciesIds(project).length === 0) return;
  for (const instance of Object.values(session.monsterInstances ?? {})) {
    recordMonsterCaught(project, session, instance.speciesId);
  }
}

export function monsterJournalEntry(session: PlaySession, speciesId: string): { seen: boolean; caught: boolean } {
  const owned = Object.values(session.monsterInstances ?? {}).some((instance) => instance.speciesId === speciesId);
  const caught = session.switches[`mx_caught_${speciesId}`] === true || owned;
  return { seen: session.switches[`mx_seen_${speciesId}`] === true || caught, caught };
}

/** Snapshot enemies contain only actually revealed battlers, including late troop reinforcements. */
export function recordEncounteredMonsters(project: Project, session: PlaySession, enemies: readonly BattleBattlerSnapshot[]): void {
  if (monsterDexSpeciesIds(project).length === 0) return;
  for (const enemy of enemies) {
    const record = project.database.enemies.find((entry) => entry.id === enemy.recordId);
    const speciesId = enemy.speciesId ?? record?.speciesId
      ?? project.database.monsterSpecies?.find((entry) => entry.id === enemy.recordId)?.id;
    if (speciesId) recordMonsterSeen(project, session, speciesId);
  }
}
