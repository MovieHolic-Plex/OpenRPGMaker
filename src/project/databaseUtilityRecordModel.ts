import { ACTOR_RATE_GRADES } from "@/project/actorModel";
import { defaultBattleCommandRecords, defaultElementRecords, defaultTerrainRecords } from "@/project/defaults/defaultDatabaseUtilityRecords";
import type {
  ActorRateGrade,
  ClassBattleCommandKind,
  DatabaseBattleCommandRecord,
  DatabaseElementKind,
  DatabaseElementRecord,
  DatabaseTerrainCharacterDisplay,
  DatabaseTerrainRecord,
} from "@/project/types";

export function normalizeElementRecords(records: readonly Partial<DatabaseElementRecord>[] | undefined): DatabaseElementRecord[] {
  const source = records?.length ? records : defaultElementRecords();
  return source
    .filter((record): record is Partial<DatabaseElementRecord> & Pick<DatabaseElementRecord, "id" | "name"> =>
      typeof record.id === "string" && record.id.trim().length > 0 && typeof record.name === "string"
    )
    .map((record) => ({
      id: record.id,
      name: record.name.trim().length > 0 ? record.name : "속성",
      kind: normalizeElementKind(record.kind),
      rateLabels: normalizeRateLabels(record.rateLabels),
      damageMultipliers: normalizeDamageMultipliers(record.damageMultipliers),
    }));
}

export function normalizeTerrainRecords(records: readonly Partial<DatabaseTerrainRecord>[] | undefined): DatabaseTerrainRecord[] {
  const source = records?.length ? records : defaultTerrainRecords();
  return source
    .filter((record): record is Partial<DatabaseTerrainRecord> & Pick<DatabaseTerrainRecord, "id" | "name"> =>
      typeof record.id === "string" && record.id.trim().length > 0 && typeof record.name === "string"
    )
    .map((record) => ({
      id: record.id,
      name: record.name.trim().length > 0 ? record.name : "지형 효과",
      damage: clampInteger(record.damage ?? 0, 0, 9999),
      encounterRatePercent: clampInteger(record.encounterRatePercent ?? 100, 0, 500),
      battleBackgroundResourceId: cleanOptionalId(record.battleBackgroundResourceId),
      footstepSoundResourceId: cleanOptionalId(record.footstepSoundResourceId),
      characterDisplay: normalizeTerrainDisplay(record.characterDisplay),
      vehiclePassage: {
        boat: record.vehiclePassage?.boat ?? false,
        ship: record.vehiclePassage?.ship ?? false,
        airshipLand: record.vehiclePassage?.airshipLand ?? true,
      },
      ...(record.climbable === true ? { climbable: true } : {}),
    }));
}

export function normalizeGlobalBattleCommands(records: readonly Partial<DatabaseBattleCommandRecord>[] | undefined): DatabaseBattleCommandRecord[] {
  const source = records?.length ? records : defaultBattleCommandRecords();
  return source
    .filter((record): record is Partial<DatabaseBattleCommandRecord> & Pick<DatabaseBattleCommandRecord, "id"> =>
      typeof record.id === "string" && record.id.trim().length > 0
    )
    .map((record) => ({
      id: record.id,
      name: typeof record.name === "string" && record.name.trim().length > 0 ? record.name : "명령",
      kind: normalizeBattleCommandKind(record.kind),
      skillSubsetName: cleanOptionalId(record.skillSubsetName),
      skillId: cleanOptionalId(record.skillId),
    }));
}

function normalizeElementKind(kind: DatabaseElementKind | undefined): DatabaseElementKind {
  return kind === "physical" ? "physical" : "magical";
}

function normalizeRateLabels(labels: readonly ActorRateGrade[] | undefined): ActorRateGrade[] {
  if (labels?.length === ACTOR_RATE_GRADES.length && labels.every((label) => ACTOR_RATE_GRADES.includes(label))) {
    return [...labels];
  }
  return [...ACTOR_RATE_GRADES];
}

function normalizeDamageMultipliers(multipliers: Partial<Record<ActorRateGrade, number>> | undefined): Record<ActorRateGrade, number> {
  return {
    A: clampInteger(multipliers?.A ?? 200, -9999, 99999),
    B: clampInteger(multipliers?.B ?? 150, -9999, 99999),
    C: clampInteger(multipliers?.C ?? 100, -9999, 99999),
    D: clampInteger(multipliers?.D ?? 50, -9999, 99999),
    E: clampInteger(multipliers?.E ?? 0, -9999, 99999),
  };
}

function normalizeTerrainDisplay(display: DatabaseTerrainCharacterDisplay | undefined): DatabaseTerrainCharacterDisplay {
  return display === "transparent" ? "transparent" : "normal";
}

function normalizeBattleCommandKind(kind: ClassBattleCommandKind | undefined): ClassBattleCommandKind {
  return kind === "skill" || kind === "skillSubset" || kind === "defend" || kind === "guard" || kind === "item" || kind === "capture" || kind === "escape" || kind === "switch" || kind === "event"
    ? kind
    : "attack";
}

function cleanOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
