import { SCHEMA_VERSION, type ActorInitialEquipment, type Project } from "@/project/types";
import {
  startSession,
  type AudioCommandState,
  type PictureState,
  type PlaySession,
} from "@/project/session";
import type { ActorVitals } from "@/project/sessionVitals";
import {
  isActorEquipmentRecord,
  isActorRowsRecord,
  isActorSkillIdsRecord,
  isActorVitalsRecord,
  isBooleanRecord,
  isNumberRecord,
  isPictureRecord,
  isRecord,
  isRuntimeEventLocationRecord,
  isRuntimeNpcTravelStateRecord,
  isSelfSwitchesRecord,
  isStringArray,
  parseAudioState,
  parseMapOverrides,
  parsePictures,
} from "@/player/saveSlotValidation";
export {
  createSystemShellState,
  reduceSystemShell,
  type SystemShellAction,
  type SystemShellScreen,
  type SystemShellState,
} from "@/player/systemShellState";

export const SAVE_SLOT_COUNT = 3;
const SAVE_SLOT_PREFIX = "rpg-zzu:save-slot:";

export type SaveSlotIndex = 1 | 2 | 3;

export type SaveSnapshot = {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly projectTitle: string;
  readonly savedAt: string;
  readonly mapName?: string;
  readonly playTimeSeconds?: number;
  readonly session: {
    readonly switches: Record<string, boolean>;
    readonly selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
    readonly variables: Record<string, number>;
    readonly timers: Record<string, number>;
    readonly gold: number;
    readonly inventory?: Record<string, number>;
    readonly partyActorIds?: readonly string[];
    readonly actorSkillIds?: PlaySession["actorSkillIds"];
    readonly actorExperience?: Record<string, number>;
    readonly actorLevels?: Record<string, number>;
    readonly actorVitals?: Record<string, ActorVitals>;
    readonly eventLocations?: PlaySession["eventLocations"];
    readonly npcTravelStates?: PlaySession["npcTravelStates"];
    readonly currentMapId: string;
    readonly x: number;
    readonly y: number;
    readonly mapOverrides: PlaySession["mapOverrides"];
    readonly flags: Record<string, boolean>;
    readonly battleResult?: PlaySession["battleResult"];
    readonly audio: AudioCommandState;
    readonly pictures: Record<string, PictureState>;
    readonly actorEquipment?: Record<string, ActorInitialEquipment>;
    readonly actorRows?: Record<string, "front" | "back">;
    readonly playTimeSeconds?: number;
  };
};

export type SaveSlotReadResult =
  | { readonly kind: "empty"; readonly slot: SaveSlotIndex }
  | { readonly kind: "corrupt"; readonly slot: SaveSlotIndex; readonly message: string }
  | { readonly kind: "present"; readonly slot: SaveSlotIndex; readonly snapshot: SaveSnapshot };

export function saveSlotKey(slot: SaveSlotIndex): string {
  return `${SAVE_SLOT_PREFIX}${slot}`;
}

export function createSaveSnapshot(project: Project, session: PlaySession): SaveSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    projectTitle: project.meta.title,
    savedAt: new Date().toISOString(),
    mapName: project.maps[session.currentMapId]?.name ?? "",
    playTimeSeconds: Math.floor(session.playTimeSeconds ?? 0),
    session: {
      switches: structuredClone(session.switches),
      selfSwitches: structuredClone(session.selfSwitches),
      variables: structuredClone(session.variables),
      timers: structuredClone(session.timers),
      gold: session.gold,
      inventory: structuredClone(session.inventory),
      partyActorIds: structuredClone(session.partyActorIds),
      actorSkillIds: structuredClone(session.actorSkillIds),
      actorExperience: structuredClone(session.actorExperience),
      actorLevels: structuredClone(session.actorLevels),
      actorVitals: structuredClone(session.actorVitals),
      eventLocations: structuredClone(session.eventLocations),
      npcTravelStates: structuredClone(session.npcTravelStates),
      currentMapId: session.currentMapId,
      x: session.x,
      y: session.y,
      mapOverrides: structuredClone(session.mapOverrides),
      flags: structuredClone(session.flags),
      battleResult: session.battleResult,
      audio: structuredClone(session.audio),
      pictures: structuredClone(session.pictures),
      actorEquipment: structuredClone(session.actorEquipment),
      actorRows: structuredClone(session.actorRows),
      playTimeSeconds: Math.floor(session.playTimeSeconds ?? 0),
    },
  };
}

export function saveToSlot(storage: Storage, slot: SaveSlotIndex, snapshot: SaveSnapshot): void {
  storage.setItem(saveSlotKey(slot), JSON.stringify(snapshot));
}

export function readSaveSlot(storage: Storage, slot: SaveSlotIndex): SaveSlotReadResult {
  const text = storage.getItem(saveSlotKey(slot));
  if (!text) return { kind: "empty", slot };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return {
      kind: "corrupt",
      slot,
      message: error instanceof Error ? error.message : "Invalid save data",
    };
  }
  return parseSaveSnapshot(value, slot);
}

export function listSaveSlots(storage: Storage): readonly SaveSlotReadResult[] {
  return [readSaveSlot(storage, 1), readSaveSlot(storage, 2), readSaveSlot(storage, 3)];
}

export function getSaveSlotStatus(
  slots: readonly SaveSlotReadResult[],
  slot: SaveSlotIndex
): SaveSlotReadResult {
  return slots.find((item) => item.slot === slot) ?? { kind: "empty", slot };
}

export function applySaveSnapshot(project: Project, snapshot: SaveSnapshot): PlaySession {
  const session = startSession(project);
  session.switches = structuredClone(snapshot.session.switches);
  session.selfSwitches = structuredClone(snapshot.session.selfSwitches ?? {});
  session.variables = structuredClone(snapshot.session.variables);
  session.timers = structuredClone(snapshot.session.timers);
  session.gold = snapshot.session.gold;
  if (snapshot.session.inventory) session.inventory = structuredClone(snapshot.session.inventory);
  if (snapshot.session.partyActorIds) session.partyActorIds = [...snapshot.session.partyActorIds];
  if (snapshot.session.actorSkillIds) session.actorSkillIds = structuredClone(snapshot.session.actorSkillIds);
  if (snapshot.session.actorExperience) session.actorExperience = structuredClone(snapshot.session.actorExperience);
  if (snapshot.session.actorLevels) session.actorLevels = structuredClone(snapshot.session.actorLevels);
  if (snapshot.session.actorVitals) session.actorVitals = structuredClone(snapshot.session.actorVitals);
  if (snapshot.session.eventLocations) session.eventLocations = structuredClone(snapshot.session.eventLocations);
  if (snapshot.session.npcTravelStates) session.npcTravelStates = structuredClone(snapshot.session.npcTravelStates);
  session.currentMapId = snapshot.session.currentMapId;
  session.x = snapshot.session.x;
  session.y = snapshot.session.y;
  session.mapOverrides = structuredClone(snapshot.session.mapOverrides);
  session.flags = structuredClone(snapshot.session.flags);
  session.battleResult = snapshot.session.battleResult;
  session.audio = structuredClone(snapshot.session.audio);
  session.pictures = structuredClone(snapshot.session.pictures);
  if (snapshot.session.actorEquipment) session.actorEquipment = structuredClone(snapshot.session.actorEquipment);
  if (snapshot.session.actorRows) session.actorRows = structuredClone(snapshot.session.actorRows);
  if (typeof snapshot.session.playTimeSeconds === "number") session.playTimeSeconds = snapshot.session.playTimeSeconds;
  return session;
}

function parseSaveSnapshot(value: unknown, slot: SaveSlotIndex): SaveSlotReadResult {
  if (!isRecord(value)) return corrupt(slot, "Save slot is not an object");
  if (value.schemaVersion !== SCHEMA_VERSION) return corrupt(slot, "Unsupported save schema");
  if (typeof value.projectTitle !== "string") return corrupt(slot, "Missing project title");
  if (typeof value.savedAt !== "string") return corrupt(slot, "Missing saved time");
  if (!isRecord(value.session)) return corrupt(slot, "Missing session");
  const parsed = parseSessionRecord(value.session);
  if (!parsed.ok) return corrupt(slot, parsed.message);
  return {
    kind: "present",
    slot,
    snapshot: {
      schemaVersion: SCHEMA_VERSION,
      projectTitle: value.projectTitle,
      savedAt: value.savedAt,
      mapName: typeof value.mapName === "string" ? value.mapName : undefined,
      playTimeSeconds: typeof value.playTimeSeconds === "number" ? Math.floor(value.playTimeSeconds) : undefined,
      session: parsed.session,
    },
  };
}

type ParsedSessionResult =
  | { readonly ok: true; readonly session: SaveSnapshot["session"] }
  | { readonly ok: false; readonly message: string };

function parseSessionRecord(session: Record<string, unknown>): ParsedSessionResult {
  if (!isBooleanRecord(session.switches)) return { ok: false, message: "Invalid switches" };
  if (!isNumberRecord(session.variables)) return { ok: false, message: "Invalid variables" };
  if (!isNumberRecord(session.timers)) return { ok: false, message: "Invalid timers" };
  if (typeof session.gold !== "number" || !Number.isFinite(session.gold)) return { ok: false, message: "Invalid gold" };
  if (typeof session.currentMapId !== "string") return { ok: false, message: "Invalid map" };
  if (typeof session.x !== "number") return { ok: false, message: "Invalid x" };
  if (typeof session.y !== "number") return { ok: false, message: "Invalid y" };
  if (!isRecord(session.mapOverrides)) return { ok: false, message: "Invalid map overrides" };
  if (!isBooleanRecord(session.flags)) return { ok: false, message: "Invalid flags" };
  if (!isRecord(session.audio)) return { ok: false, message: "Invalid audio" };
  if (!isPictureRecord(session.pictures)) return { ok: false, message: "Invalid pictures" };
  const battleResult = parseBattleResult(session.battleResult);
  if (battleResult === "invalid") return { ok: false, message: "Invalid battle result" };
  const audio = parseAudioState(session.audio);
  if (!audio.ok) return { ok: false, message: audio.message };
  return {
    ok: true,
    session: {
      switches: session.switches,
      selfSwitches: isSelfSwitchesRecord(session.selfSwitches) ? session.selfSwitches : undefined,
      variables: session.variables,
      timers: session.timers,
      gold: session.gold,
      inventory: isNumberRecord(session.inventory) ? session.inventory : undefined,
      partyActorIds: isStringArray(session.partyActorIds) ? session.partyActorIds : undefined,
      actorSkillIds: isActorSkillIdsRecord(session.actorSkillIds) ? session.actorSkillIds : undefined,
      actorExperience: isNumberRecord(session.actorExperience) ? session.actorExperience : undefined,
      actorLevels: isNumberRecord(session.actorLevels) ? session.actorLevels : undefined,
      actorVitals: isActorVitalsRecord(session.actorVitals) ? session.actorVitals : undefined,
      eventLocations: isRuntimeEventLocationRecord(session.eventLocations) ? session.eventLocations : undefined,
      npcTravelStates: isRuntimeNpcTravelStateRecord(session.npcTravelStates) ? session.npcTravelStates : undefined,
      currentMapId: session.currentMapId,
      x: session.x,
      y: session.y,
      mapOverrides: parseMapOverrides(session.mapOverrides),
      flags: session.flags,
      battleResult,
      audio: audio.value,
      pictures: parsePictures(session.pictures),
      actorEquipment: isActorEquipmentRecord(session.actorEquipment) ? session.actorEquipment : undefined,
      actorRows: isActorRowsRecord(session.actorRows) ? session.actorRows : undefined,
      playTimeSeconds: typeof session.playTimeSeconds === "number" ? Math.floor(session.playTimeSeconds) : undefined,
    },
  };
}

function parseBattleResult(value: unknown): PlaySession["battleResult"] | "invalid" {
  if (value === undefined) return undefined;
  if (value === "victory" || value === "defeat" || value === "escape") return value;
  return "invalid";
}

function corrupt(slot: SaveSlotIndex, message: string): SaveSlotReadResult {
  return { kind: "corrupt", slot, message };
}
