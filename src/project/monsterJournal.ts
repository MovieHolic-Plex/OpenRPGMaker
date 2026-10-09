import type { BattleBattlerSnapshot } from '@/battle/types';
import type { PlaySession } from '@/project/session';
import type { Project } from '@/project/types';

/** Mirrors the optional authored system config; no new save fields are needed. */
export type MonsterCampaignDefinition = {
  id: string;
  name: string;
  speciesIds: string[];
  speciesNotes: Record<string, string>;
  badges: { id: string; name: string; switchId: string; cityMapId: string }[];
  locations: { mapId: string; name: string; x: number; y: number; kind: 'town' | 'route' | 'dungeon' | 'league' }[];
  objectives: { id: string; title: string; switchId: string; requiresSwitchId?: string }[];
};

export function monsterCampaign(project: Project): MonsterCampaignDefinition | undefined {
  return (project.system as Project['system'] & { monsterCampaign?: MonsterCampaignDefinition }).monsterCampaign;
}

export function recordMonsterSeen(project: Project, session: PlaySession, speciesId: string): void {
  if (!monsterCampaign(project)?.speciesIds.includes(speciesId)) return;
  session.switches[`mx_seen_${speciesId}`] = true;
}

export function recordMonsterCaught(project: Project, session: PlaySession, speciesId: string): void {
  if (!monsterCampaign(project)?.speciesIds.includes(speciesId)) return;
  recordMonsterSeen(project, session, speciesId);
  session.switches[`mx_caught_${speciesId}`] = true;
}

/** Legacy ownership is promoted to permanent receipts before an instance changes or disappears. */
export function reconcileMonsterJournal(project: Project, session: PlaySession): void {
  if (!monsterCampaign(project)) return;
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
  if (!monsterCampaign(project)) return;
  for (const enemy of enemies) {
    const record = project.database.enemies.find((entry) => entry.id === enemy.recordId);
    const speciesId = enemy.speciesId ?? record?.speciesId
      ?? project.database.monsterSpecies?.find((entry) => entry.id === enemy.recordId)?.id;
    if (speciesId) recordMonsterSeen(project, session, speciesId);
  }
}
