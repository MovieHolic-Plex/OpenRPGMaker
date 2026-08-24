import type { ActorInitialEquipment, ActorParameterKey, LightSource, LightingState } from "@/project/types";
import { GOLD_MAX, type AudioCommandState, type PictureState, type PlaySession } from "@/project/session";
import type { ActorVitals } from "@/project/sessionVitals";
import { isSeason, MAX_DAYS_PER_SEASON } from "@/project/gameTime";
import type { RuntimeCameraSessionState,
RuntimeCameraTarget,
RuntimeEventLocation,
RuntimeNpcScheduleState,
RuntimeNpcTravelState,
RuntimeRemovedEventIds,
RuntimeSpawnedEventState, } from "@/project/sessionRuntimeTypes"
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

// 오토세이브 메타(optional enum) 가드 — 스냅샷 최상위 savedBy / autosaveTrigger.
export function isSaveOrigin(value: unknown): value is "manual" | "auto" {
  return value === "manual" || value === "auto";
}

export function isAutosaveTrigger(value: unknown): value is "transfer" | "battleVictory" {
  return value === "transfer" || value === "battleVictory";
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

export function isActorSkillPpRecord(value: unknown): value is NonNullable<PlaySession["actorSkillPp"]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((skillPp) =>
    isRecord(skillPp)
    && Object.values(skillPp).every((pp) => typeof pp === "number" && Number.isFinite(pp) && pp >= 0),
  );
}

export function isLifeSkillsRecord(value: unknown): value is NonNullable<PlaySession["lifeSkills"]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((skill) =>
    isRecord(skill) &&
    typeof skill.xp === "number" && Number.isFinite(skill.xp) &&
    typeof skill.level === "number" && Number.isFinite(skill.level)
  );
}

export function isShopTradeCountsRecord(value: unknown): value is NonNullable<PlaySession["shopTradeCounts"]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((counts) =>
    isRecord(counts) &&
    typeof counts.sold === "number" && Number.isFinite(counts.sold) &&
    typeof counts.bought === "number" && Number.isFinite(counts.bought)
  );
}

export function isShopPawnTicketsRecord(value: unknown): value is NonNullable<PlaySession["shopPawnTickets"]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((ticket) =>
    isRecord(ticket) &&
    typeof ticket.itemId === "string" &&
    typeof ticket.pawnPrice === "number" && Number.isFinite(ticket.pawnPrice) &&
    typeof ticket.dueDayKey === "string"
  );
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

export function isLifeSkillsRecord(value: unknown): value is NonNullable<PlaySession["lifeSkills"]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((progress) => {
    if (!isRecord(progress)) return false;
    return isNonNegativeInteger(progress.xp) && isPositiveInteger(progress.level);
  });
}

export function isShopTradeCountsRecord(value: unknown): value is NonNullable<PlaySession["shopTradeCounts"]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((counts) => {
    if (!isRecord(counts)) return false;
    return isNonNegativeInteger(counts.sold) && isNonNegativeInteger(counts.bought);
  });
}

export function isShopPawnTicketsRecord(value: unknown): value is NonNullable<PlaySession["shopPawnTickets"]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((ticket) => {
    if (!isRecord(ticket)) return false;
    return typeof ticket.itemId === "string" &&
      typeof ticket.dueDayKey === "string" &&
      isNonNegativeInteger(ticket.pawnPrice);
  });
}

export function isNonNegativeIntegerRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isNonNegativeInteger);
}

export function parsePositiveIntegerRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const parsed: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (count === 0) continue;
    if (!key.trim() || !isPositiveInteger(count) || count > GOLD_MAX) return undefined;
    parsed[key] = count;
  }
  return parsed;
}

export function isNestedNonNegativeIntegerRecord(value: unknown): value is Record<string, Record<string, number>> {
  return isRecord(value) && Object.values(value).every(isNonNegativeIntegerRecord);
}

export function isShippingSettlementArray(value: unknown): value is NonNullable<PlaySession["shippingHistory"]> {
  if (!Array.isArray(value)) return false;
  return value.every((settlement) => {
    if (!isRecord(settlement) || typeof settlement.dayKey !== "string" || !settlement.dayKey.trim()) return false;
    if (!isNonNegativeInteger(settlement.total) || settlement.total > GOLD_MAX ||
      !isNonNegativeInteger(settlement.credited) || settlement.credited > settlement.total) return false;
    if (!Array.isArray(settlement.entries)) return false;
    let expectedTotal = 0;
    const entriesAreValid = settlement.entries.every((entry) => {
      if (!isRecord(entry) || typeof entry.itemId !== "string" || !entry.itemId.trim()) return false;
      if (!isPositiveInteger(entry.count) || entry.count > GOLD_MAX ||
        !isNonNegativeInteger(entry.unitPrice) || entry.unitPrice > GOLD_MAX ||
        !isNonNegativeInteger(entry.subtotal) || entry.subtotal > GOLD_MAX) return false;
      const expectedSubtotal = Math.min(GOLD_MAX, entry.count * entry.unitPrice);
      if (entry.subtotal !== expectedSubtotal) return false;
      expectedTotal = Math.min(GOLD_MAX, expectedTotal + expectedSubtotal);
      return true;
    });
    return entriesAreValid && settlement.total === expectedTotal;
  });
}

export function isMakerInstancesRecord(value: unknown): value is NonNullable<PlaySession["makerInstances"]> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([instanceId, instance]) => {
    if (!isRecord(instance) || instance.instanceId !== instanceId || typeof instance.makerId !== "string") return false;
    if (instance.status !== "idle" && instance.status !== "processing" && instance.status !== "ready") return false;
    if (instance.status === "idle") return instance.startedAtMinute === undefined && instance.readyAtMinute === undefined;
    return isNonNegativeInteger(instance.startedAtMinute) &&
      isNonNegativeInteger(instance.readyAtMinute) &&
      instance.readyAtMinute >= instance.startedAtMinute;
  });
}

export function isMonsterInstancesRecord(value: unknown): value is PlaySession["monsterInstances"] {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([instanceId, instance]) => {
    if (!isRecord(instance)) return false;
    if (instance.instanceId !== instanceId || typeof instance.speciesId !== "string") return false;
    if (instance.nickname !== undefined && typeof instance.nickname !== "string") return false;
    if (typeof instance.level !== "number" || !Number.isFinite(instance.level)) return false;
    if (typeof instance.exp !== "number" || !Number.isFinite(instance.exp)) return false;
    if (instance.currentHp !== undefined && (typeof instance.currentHp !== "number" || !Number.isFinite(instance.currentHp))) return false;
    if (instance.skillIds !== undefined && !isStringArray(instance.skillIds)) return false;
    if (instance.stateIds !== undefined && !isStringArray(instance.stateIds)) return false;
    if (instance.stateTurns !== undefined && !isNonNegativeIntegerRecord(instance.stateTurns)) return false;
    if (instance.skillPp !== undefined && !isNonNegativeIntegerRecord(instance.skillPp)) return false;
    if (instance.pendingSkillIds !== undefined && !isStringArray(instance.pendingSkillIds)) return false;
    if (typeof instance.friendship !== "number" || !Number.isFinite(instance.friendship)) return false;
    if (!isMonsterCaughtAt(instance.caughtAt)) return false;
    return instance.ivs === undefined || isMonsterIvs(instance.ivs);
  });
}

function isNonNegativeIntegerRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((amount) =>
    typeof amount === "number" && Number.isInteger(amount) && amount >= 0
  );
}

export function isFarmPlotsRecord(value: unknown): value is PlaySession["farmPlots"] {
  if (!isRecord(value)) return false;
  return Object.values(value).every((plots) => {
    if (!isRecord(plots)) return false;
    return Object.entries(plots).every(([key, plot]) => isFarmPlotKey(key) && isFarmPlotState(plot));
  });
}

function isMonsterIvs(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ["hp", "atk", "def", "spd"].every((key) => {
    const amount = value[key];
    return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && amount <= 15;
  });
}

function isMonsterCaughtAt(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.mapId === "string" && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
}

function isFarmPlotKey(value: string): boolean {
  const parts = value.split(",");
  if (parts.length !== 2) return false;
  return parts.every((part) => Number.isInteger(Number(part)));
}

function isFarmPlotState(value: unknown): value is NonNullable<PlaySession["farmPlots"]>[string][string] {
  if (!isRecord(value)) return false;
  if (typeof value.tilled !== "boolean" || typeof value.watered !== "boolean") return false;
  if (value.cropId !== undefined && typeof value.cropId !== "string") return false;
  if (value.stage !== undefined && !isFiniteInteger(value.stage)) return false;
  if (value.growthDays !== undefined && !isFiniteInteger(value.growthDays)) return false;
  if (value.dead !== undefined && typeof value.dead !== "boolean") return false;
  if (value.plantedDay !== undefined && !isFarmPlotDate(value.plantedDay)) return false;
  return true;
}

export function isFarmPlotDate(value: unknown): value is NonNullable<PlaySession["farmPlotsAdvancedThrough"]> {
  if (!isRecord(value)) return false;
  return isFiniteInteger(value.day) && isSeason(value.season) && isFiniteInteger(value.year);
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
  return Object.values(value).every(isRuntimeEventLocation);
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

export function isLightingState(value: unknown): value is LightingState {
  if (!isRecord(value)) return false;
  if (typeof value.ambient !== "number" || !Number.isFinite(value.ambient)) return false;
  if (value.color !== undefined && typeof value.color !== "string") return false;
  if (!Array.isArray(value.sources)) return false;
  return value.sources.every(isLightSource);
}

export function isGameTime(value: unknown): value is PlaySession["gameTime"] {
  if (!isRecord(value)) return false;
  return isFiniteInteger(value.minute) && value.minute >= 0 && value.minute <= 59 &&
    isFiniteInteger(value.hour) && value.hour >= 0 && value.hour <= 48 &&
    isFiniteInteger(value.day) && value.day >= 1 && value.day <= MAX_DAYS_PER_SEASON &&
    isSeason(value.season) && isFiniteInteger(value.year) && value.year >= 1;
}

function isLightSource(value: unknown): value is LightSource {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (!isLightAnchor(value.at)) return false;
  if (typeof value.radius !== "number" || !Number.isFinite(value.radius)) return false;
  if (value.intensity !== undefined && (typeof value.intensity !== "number" || !Number.isFinite(value.intensity))) return false;
  if (value.color !== undefined && typeof value.color !== "string") return false;
  if (value.flicker !== undefined && typeof value.flicker !== "boolean") return false;
  return true;
}

function isLightAnchor(value: unknown): value is LightSource["at"] {
  if (value === "player") return true;
  if (!isRecord(value)) return false;
  if (typeof value.eventId === "string") return true;
  return typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
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

export function isRuntimeNpcScheduleStateRecord(value: unknown): value is Record<string, RuntimeNpcScheduleState> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((state) => {
    if (!isRecord(state)) return false;
    if (state.routeKey !== undefined && typeof state.routeKey !== "string") return false;
    return state.exitTarget === undefined || isRuntimeEventLocation(state.exitTarget);
  });
}

function isRuntimeEventLocation(value: unknown): value is RuntimeEventLocation {
  if (!isRecord(value)) return false;
  const direction = value.direction;
  return (
    typeof value.mapId === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    (direction === undefined || isDirection(direction))
  );
}

export function isRuntimeFollowerArray(value: unknown): value is PlaySession["followers"] {
  if (!Array.isArray(value)) return false;
  return value.every((follower) => {
    if (!isRecord(follower)) return false;
    if (follower.eventId !== undefined && typeof follower.eventId !== "string") return false;
    if (follower.id !== undefined && typeof follower.id !== "string") return false;
    if (typeof follower.name !== "string") return false;
    if (follower.kind !== undefined && follower.kind !== "actor" && follower.kind !== "monster") return false;
    if (follower.monsterInstanceId !== undefined && typeof follower.monsterInstanceId !== "string") return false;
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

export function isNestedNumberRecord(value: unknown): value is Record<string, Record<string, number>> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => isNumberRecord(item));
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

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteInteger(value) && value >= 1;
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
