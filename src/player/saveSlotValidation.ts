import type { ActorInitialEquipment, ActorParameterKey } from "@/project/types";
import type { AudioCommandState, PictureState, PlaySession } from "@/project/session";
import type { ActorVitals } from "@/project/sessionVitals";
import type {
  RuntimeCameraSessionState,
  RuntimeCameraTarget,
  RuntimeEventLocation,
  RuntimeNpcTravelState,
  RuntimeRemovedEventIds,
  RuntimeSpawnedEventState,
} from "@/player/types";
import { RNG_STREAMS, type RngState } from "@/util/rng";

export function isActorEquipmentRecord(value: unknown): value is Record<string, ActorInitialEquipment> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((equipment) => {
    if (!isRecord(equipment)) return false;
    return ["weapon", "shield", "armor", "helmet", "accessory"].every((slot) => {
      const item = equipment[slot];
      return item === undefined || typeof item === "string";
    });
  });
}

export function isActorRowsRecord(value: unknown): value is Record<string, "front" | "back"> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((row) => row === "front" || row === "back");
}

export function isActorVitalsRecord(value: unknown): value is Record<string, ActorVitals> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((vitals) => {
    if (!isRecord(vitals)) return false;
    return (
      typeof vitals.hp === "number" &&
      typeof vitals.mp === "number" &&
      typeof vitals.maxHp === "number" &&
      typeof vitals.maxMp === "number"
    );
  });
}

export function isActorSkillIdsRecord(value: unknown): value is PlaySession["actorSkillIds"] {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isStringArray);
}

export function isActorParamBonusRecord(value: unknown): value is Record<string, Partial<Record<ActorParameterKey, number>>> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((bonuses) => {
    if (!isRecord(bonuses)) return false;
    return Object.values(bonuses).every((amount) => typeof amount === "number" && Number.isFinite(amount));
  });
}

export function isActorStateIdsRecord(value: unknown): value is Record<string, string[]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((states) => Array.isArray(states) && states.every((stateId) => typeof stateId === "string"));
}

export function isRngState(value: unknown): value is RngState {
  if (!isRecord(value)) return false;
  if (typeof value.seed !== "number" || !Number.isFinite(value.seed)) return false;
  if (!isRecord(value.streams)) return false;
  const streams = value.streams;
  return RNG_STREAMS.every((stream) => {
    const state = streams[stream];
    return isRecord(state) &&
      typeof state.seed === "number" &&
      Number.isFinite(state.seed) &&
      typeof state.state === "number" &&
      Number.isFinite(state.state);
  });
}

export function isRuntimeEventLocationRecord(value: unknown): value is Record<string, RuntimeEventLocation> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((location) => {
    if (!isRecord(location)) return false;
    const direction = location.direction;
    return (
      typeof location.mapId === "string" &&
      typeof location.x === "number" &&
      typeof location.y === "number" &&
      (direction === undefined || direction === "left" || direction === "right" || direction === "up" || direction === "down")
    );
  });
}

export function isRuntimeCameraState(value: unknown): value is RuntimeCameraSessionState {
  if (!isRecord(value)) return false;
  if (value.mode !== "follow" && value.mode !== "fixed") return false;
  if (!isRuntimeCameraTarget(value.target)) return false;
  return (
    optionalFiniteNumber(value.offsetX) &&
    optionalFiniteNumber(value.offsetY) &&
    optionalFiniteNumber(value.zoom)
  );
}

function isRuntimeCameraTarget(value: unknown): value is RuntimeCameraTarget {
  if (!isRecord(value)) return false;
  if (value.kind === "player") return true;
  if (value.kind === "event") return typeof value.eventId === "string";
  if (value.kind === "position") return typeof value.x === "number" && typeof value.y === "number";
  return false;
}

export function isRuntimeSpawnedEventRecord(value: unknown): value is Record<string, RuntimeSpawnedEventState> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((spawn) => {
    if (!isRecord(spawn)) return false;
    const direction = spawn.direction;
    return (
      typeof spawn.templateMapId === "string" &&
      typeof spawn.templateEventId === "string" &&
      typeof spawn.mapId === "string" &&
      typeof spawn.x === "number" &&
      typeof spawn.y === "number" &&
      (direction === undefined || direction === "left" || direction === "right" || direction === "up" || direction === "down")
    );
  });
}

export function isRuntimeRemovedEventIds(value: unknown): value is RuntimeRemovedEventIds {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isStringArray);
}

export function isRuntimeNpcTravelStateRecord(value: unknown): value is Record<string, RuntimeNpcTravelState> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((state) =>
    isRecord(state) && typeof state.destinationIndex === "number"
  );
}

export function isRuntimeFollowerArray(value: unknown): value is PlaySession["followers"] {
  if (!Array.isArray(value)) return false;
  return value.every((follower) => {
    if (!isRecord(follower)) return false;
    if (follower.eventId !== undefined && typeof follower.eventId !== "string") return false;
    if (typeof follower.name !== "string") return false;
    if (!isRecord(follower.graphic)) return false;
    const graphic = follower.graphic;
    if (graphic.transparent !== undefined && typeof graphic.transparent !== "boolean") return false;
    if (graphic.direction !== undefined && !isDirection(graphic.direction)) return false;
    if (graphic.pattern !== undefined && typeof graphic.pattern !== "number" && typeof graphic.pattern !== "string") return false;
    if (graphic.sprite !== undefined) {
      if (!isRecord(graphic.sprite)) return false;
      if (graphic.sprite.type !== "bundled" && graphic.sprite.type !== "uploaded") return false;
      if (typeof graphic.sprite.id !== "string") return false;
    }
    return true;
  });
}

export function isRuntimeFollowerTrail(value: unknown): value is PlaySession["followerTrail"] {
  if (!Array.isArray(value)) return false;
  return value.every((point) => {
    if (!isRecord(point)) return false;
    return (
      typeof point.x === "number" &&
      typeof point.y === "number" &&
      (point.direction === undefined || isDirection(point.direction))
    );
  });
}

export function parseMapOverrides(value: Record<string, unknown>): PlaySession["mapOverrides"] {
  const parsed: PlaySession["mapOverrides"] = {};
  for (const [mapId, layers] of Object.entries(value)) {
    if (!isRecord(layers)) continue;
    const lower = isNumberRecord(layers.lower) ? layers.lower : {};
    const upper = isNumberRecord(layers.upper) ? layers.upper : {};
    parsed[mapId] = { lower, upper };
  }
  return parsed;
}

export type ParsedAudioState =
  | { readonly ok: true; readonly value: AudioCommandState }
  | { readonly ok: false; readonly message: string };

export function parseAudioState(value: Record<string, unknown>): ParsedAudioState {
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

export function parsePictures(value: Record<string, PictureState>): Record<string, PictureState> {
  const pictures: Record<string, PictureState> = {};
  for (const [pictureId, picture] of Object.entries(value)) {
    pictures[pictureId] = picture;
  }
  return pictures;
}

export function isPictureRecord(value: unknown): value is Record<string, PictureState> {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "boolean");
}

// 셀프 스위치: eventId → (key "A".."D" → bool). 값은 Partial 이므로 일부 키만 있을 수 있다.
export function isSelfSwitchesRecord(
  value: unknown
): value is Record<string, Partial<Record<string, boolean>>> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => {
    if (!isRecord(entry)) return false;
    return Object.values(entry).every((item) => typeof item === "boolean");
  });
}

export function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "number");
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function optionalFiniteNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isDirection(value: unknown): value is "down" | "left" | "right" | "up" {
  return value === "down" || value === "left" || value === "right" || value === "up";
}

type ParsedAudioTrack =
  | { readonly ok: true; readonly value: AudioCommandState["bgm"] }
  | { readonly ok: false };

function parseAudioTrack(value: unknown): ParsedAudioTrack {
  if (value === undefined) return { ok: true, value: undefined };
  if (!isRecord(value)) return { ok: false };
  if (typeof value.resourceId !== "string") return { ok: false };
  if (typeof value.loop !== "boolean") return { ok: false };
  return { ok: true, value: { resourceId: value.resourceId, loop: value.loop } };
}
