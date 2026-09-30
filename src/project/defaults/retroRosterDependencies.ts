import type { ProjectDatabaseRecords } from "../types";

type DependencyKind = "actors" | "classes" | "skills" | "equipment" | "states" | "battleAnimations" | "elements";
export type RetroRosterDatabase = Pick<ProjectDatabaseRecords, DependencyKind>;
type CompleteRosterDatabase = Required<RetroRosterDatabase>;
type AddedRecord = { [K in DependencyKind]: { kind: K; record: CompleteRosterDatabase[K][number] } }[DependencyKind];

/** Follow only newly appended bundled rows. Existing author rows remain untouched, even at a bundled id. */
export function appendRetroRosterDependencies(
  database: RetroRosterDatabase,
  bundled: CompleteRosterDatabase,
  added: AddedRecord[],
): boolean {
  database.elements ??= [];
  const db = database as CompleteRosterDatabase;
  const kinds: DependencyKind[] = ["actors", "classes", "skills", "equipment", "states", "battleAnimations", "elements"];
  const existing = new Map(kinds.map((kind) => [kind, new Set(db[kind].map((row) => row.id))]));
  let changed = false;
  function ensure<K extends DependencyKind>(kind: K, id: string | undefined): void {
    // Death is an engine sentinel, accepted by project references without a DB row.
    if (kind === "states" && id === "state_death") return;
    if (!id || existing.get(kind)!.has(id)) return;
    const record = bundled[kind].find((row) => row.id === id);
    if (!record) throw new Error(`Bundled retro roster dependency missing: ${kind}.${id}`);
    // Both arrays use the same kind; TypeScript loses that correlation on indexed unions.
    (db[kind] as typeof record[]).push(record);
    existing.get(kind)!.add(id);
    added.push({ kind, record } as AddedRecord);
    changed = true;
  }
  function rates(record: { stateRates?: Record<string, unknown>; elementRates?: Record<string, unknown> }): void {
    for (const id of Object.keys(record.stateRates ?? {})) ensure("states", id);
    for (const id of Object.keys(record.elementRates ?? {})) ensure("elements", id);
  }
  // The queue grows as dependencies are appended; cycles terminate at the existing-id sets.
  for (let index = 0; index < added.length; index += 1) {
    const entry = added[index]!;
    switch (entry.kind) {
      case "actors": {
        const row = entry.record;
        ensure("classes", row.classId);
        ensure("battleAnimations", row.unarmedAnimationId);
        for (const id of Object.values(row.initialEquipment)) ensure("equipment", id);
        for (const learned of row.learnedSkills) ensure("skills", learned.skillId);
        rates(row);
        break;
      }
      case "classes": {
        const row = entry.record;
        ensure("battleAnimations", row.animationId);
        for (const id of row.skillIds) ensure("skills", id);
        for (const learned of row.learnedSkills) ensure("skills", learned.skillId);
        for (const command of row.battleCommands) ensure("skills", command.skillId);
        for (const id of row.equipmentPermissions.equipmentIds) ensure("equipment", id);
        for (const id of row.equipmentPermissions.actorIds) ensure("actors", id);
        for (const id of row.equipmentPermissions.classIds) ensure("classes", id);
        for (const promotion of row.promotions ?? []) {
          ensure("classes", promotion.toClassId);
          for (const id of promotion.requires.requiredSkillIds ?? []) ensure("skills", id);
        }
        rates(row);
        break;
      }
      case "skills": {
        const row = entry.record;
        ensure("battleAnimations", row.animationId);
        ensure("elements", row.elementId);
        for (const effect of row.stateEffects ?? []) ensure("states", effect.stateId);
        for (const id of row.comboActorIds ?? []) ensure("actors", id);
        break;
      }
      case "equipment": {
        const row = entry.record;
        ensure("skills", row.skillId);
        ensure("skills", row.usableAsItemSkillId);
        ensure("skills", row.grantsCommand?.skillId);
        for (const id of row.grantsSkillIds ?? []) ensure("skills", id);
        for (const id of row.equippableActorIds) ensure("actors", id);
        for (const id of row.equippableClassIds) ensure("classes", id);
        for (const id of [...row.stateInflictIds, ...row.stateDefenseIds]) ensure("states", id);
        for (const id of [...row.attackElementIds, ...row.elementalDefenseIds]) ensure("elements", id);
        break;
      }
      case "states":
        rates({ elementRates: entry.record.runtimeEffects?.elementRates });
        break;
      case "battleAnimations":
        for (const followUp of entry.record.followUps ?? []) ensure("battleAnimations", followUp.animationId);
        break;
    }
  }
  return changed;
}
