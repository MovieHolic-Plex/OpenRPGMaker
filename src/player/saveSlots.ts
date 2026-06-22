import { SCHEMA_VERSION, type Project } from "@/project/types";
import {
  startSession,
  type AudioCommandState,
  type PictureState,
  type PlaySession,
} from "@/project/session";
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
  readonly session: {
    readonly switches: Record<string, boolean>;
    readonly variables: Record<string, number>;
    readonly timers: Record<string, number>;
    readonly currentMapId: string;
    readonly x: number;
    readonly y: number;
    readonly mapOverrides: PlaySession["mapOverrides"];
    readonly flags: Record<string, boolean>;
    readonly battleResult?: PlaySession["battleResult"];
    readonly audio: AudioCommandState;
    readonly pictures: Record<string, PictureState>;
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
    session: {
      switches: structuredClone(session.switches),
      variables: structuredClone(session.variables),
      timers: structuredClone(session.timers),
      currentMapId: session.currentMapId,
      x: session.x,
      y: session.y,
      mapOverrides: structuredClone(session.mapOverrides),
      flags: structuredClone(session.flags),
      battleResult: session.battleResult,
      audio: structuredClone(session.audio),
      pictures: structuredClone(session.pictures),
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
  session.variables = structuredClone(snapshot.session.variables);
  session.timers = structuredClone(snapshot.session.timers);
  session.currentMapId = snapshot.session.currentMapId;
  session.x = snapshot.session.x;
  session.y = snapshot.session.y;
  session.mapOverrides = structuredClone(snapshot.session.mapOverrides);
  session.flags = structuredClone(snapshot.session.flags);
  session.battleResult = snapshot.session.battleResult;
  session.audio = structuredClone(snapshot.session.audio);
  session.pictures = structuredClone(snapshot.session.pictures);
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
      variables: session.variables,
      timers: session.timers,
      currentMapId: session.currentMapId,
      x: session.x,
      y: session.y,
      mapOverrides: parseMapOverrides(session.mapOverrides),
      flags: session.flags,
      battleResult,
      audio: audio.value,
      pictures: parsePictures(session.pictures),
    },
  };
}

function parseBattleResult(value: unknown): PlaySession["battleResult"] | "invalid" {
  if (value === undefined) return undefined;
  if (value === "victory" || value === "defeat" || value === "escape") return value;
  return "invalid";
}

function parseMapOverrides(value: Record<string, unknown>): PlaySession["mapOverrides"] {
  const parsed: PlaySession["mapOverrides"] = {};
  for (const [mapId, layers] of Object.entries(value)) {
    if (!isRecord(layers)) continue;
    const lower = isNumberRecord(layers.lower) ? layers.lower : {};
    const upper = isNumberRecord(layers.upper) ? layers.upper : {};
    parsed[mapId] = { lower, upper };
  }
  return parsed;
}

type ParsedAudioState =
  | { readonly ok: true; readonly value: AudioCommandState }
  | { readonly ok: false; readonly message: string };

type ParsedAudioTrack =
  | { readonly ok: true; readonly value: AudioCommandState["bgm"] }
  | { readonly ok: false };

function parseAudioState(value: Record<string, unknown>): ParsedAudioState {
  const bgm = parseAudioTrack(value.bgm);
  if (!bgm.ok) return { ok: false, message: "Invalid bgm audio" };
  const bgs = parseAudioTrack(value.bgs);
  if (!bgs.ok) return { ok: false, message: "Invalid bgs audio" };
  const me = parseAudioTrack(value.me);
  if (!me.ok) return { ok: false, message: "Invalid me audio" };
  const se = parseAudioTrack(value.se);
  if (!se.ok) return { ok: false, message: "Invalid se audio" };
  return {
    ok: true,
    value: {
      bgm: bgm.value,
      bgs: bgs.value,
      me: me.value,
      se: se.value,
    },
  };
}

function parseAudioTrack(value: unknown): ParsedAudioTrack {
  if (value === undefined) return { ok: true, value: undefined };
  if (!isRecord(value)) return { ok: false };
  if (typeof value.resourceId !== "string") return { ok: false };
  if (typeof value.loop !== "boolean") return { ok: false };
  return { ok: true, value: { resourceId: value.resourceId, loop: value.loop } };
}

function parsePictures(value: Record<string, PictureState>): Record<string, PictureState> {
  const pictures: Record<string, PictureState> = {};
  for (const [pictureId, picture] of Object.entries(value)) {
    pictures[pictureId] = picture;
  }
  return pictures;
}

function isPictureRecord(value: unknown): value is Record<string, PictureState> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((picture) => {
    if (!isRecord(picture)) return false;
    return (
      typeof picture.pictureId === "string" &&
      typeof picture.resourceId === "string" &&
      typeof picture.x === "number" &&
      typeof picture.y === "number"
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "boolean");
}

function isNumberRecord(value: unknown): value is Record<number, number> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "number");
}

function corrupt(slot: SaveSlotIndex, message: string): SaveSlotReadResult {
  return { kind: "corrupt", slot, message };
}
