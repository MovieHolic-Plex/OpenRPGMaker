import { SCHEMA_VERSION, type ActorInitialEquipment, type Project } from "@/project/types";
import {
  clampFriendship,
  GOLD_MAX,
  startSession,
  type AudioCommandState,
  type PictureState,
  type PlaySession,
} from "@/project/session";
import { normalizeItemTransitionState } from "@/project/itemTransitions";
import {
  economyValueOrUndefined,
  normalizeEconomyValue,
  sanitizeEconomyRecord,
  sanitizeShopTradeCounts,
} from "@/project/economyValues";
import { syncMonsterPartyFollowers } from "@/project/followers";
import type { ActorVitals } from "@/project/sessionVitals";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import {
  advanceGameDays,
  calendarDayKey,
  normalizeGameTime,
  resolveTimeSystem,
  type GameTime,
  type Season,
} from "@/project/gameTime";
import {
  isActorEquipmentRecord,
  isActorParamBonusRecord,
  isActorRowsRecord,
  isStringRecord,
  isActorSkillIdsRecord,
  isActorStateIdsRecord,
  isActorVitalsRecord,
  isBooleanRecord,
  isLightingState,
  isLifeSkillsRecord,
  isMakerInstancesRecord,
  isGameTime,
  isFarmPlotDate,
  isFarmPlotsRecord,
  isMonsterInstancesRecord,
  isNestedNumberRecord,
  isNestedNonNegativeIntegerRecord,
  isNumberRecord,
  isPictureRecord,
  parsePositiveIntegerRecord,
  isRecord,
  isRuntimeCameraState,
  isRuntimeEventLocationRecord,
  isRuntimeFollowerArray,
  isRuntimeFollowerTrail,
  isRuntimeNpcScheduleStateRecord,
  isRuntimeNpcTravelStateRecord,
  isRuntimeRemovedEventIds,
  isRuntimeSpawnedEventRecord,
  isShopPawnTicketsRecord,
  isShippingSettlementArray,
  isRngState,
  isSaveOrigin,
  isAutosaveTrigger,
  isSelfSwitchesRecord,
  isStringArray,
  parseAudioState,
  parseChestsRecord,
  parseMapOverrides,
  parsePictures,
} from "@/player/saveSlotValidation";
import { shippingHistoryLimit } from "@/project/shipping";
import { absoluteGameMinutes } from "@/project/makers";
import { normalizeLightingState } from "@/project/lightingRules";
import { levelForXp, xpForLevel } from "@/project/skillModel";
import { cloneRngState, normalizeRngState, type RngState } from "@/util/rng";
import {
  normalizeDailyWeatherState,
  parseFarmAnimalStateRecord,
  restoreFarmAnimalStates,
} from "@/project/p1FoundationRecords";
export {
  createSystemShellState,
  reduceSystemShell,
  type SystemShellAction,
  type SystemShellScreen,
  type SystemShellState,
} from "@/player/systemShellState";

export const SAVE_SLOT_COUNT = 3;
const SAVE_SLOT_PREFIX = "oprn:save-slot:";
let saveSlotStorageNamespace: string | null = null;

export type SaveSlotIndex = 1 | 2 | 3;

/** 스냅샷 출처. 생략(구 세이브)은 수동 저장과 동일하게 취급한다. */
export type SaveOrigin = "manual" | "auto";
/** 오토세이브를 일으킨 트리거. 수동 저장에는 없다. */
export type AutosaveTrigger = "transfer" | "battleVictory";

export type SaveSnapshot = {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly projectTitle: string;
  readonly savedAt: string;
  readonly mapName?: string;
  readonly partyLevel?: number;
  readonly playTimeSeconds?: number;
  /** optional 확장 — 알려진-필드 픽 파싱이라 구 스냅샷(schemaVersion 3)과 전후방 호환. */
  readonly savedBy?: SaveOrigin;
  readonly autosaveTrigger?: AutosaveTrigger;
  readonly session: {
    readonly switches: Record<string, boolean>;
    readonly selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
    readonly variables: Record<string, number>;
    readonly timers: Record<string, number>;
    readonly gold: number;
    readonly inventory?: Record<string, number>;
    readonly itemUseCharges?: Record<string, number>;
    readonly killedFieldSpawns?: Record<string, Record<string, number>>;
    readonly partyActorIds?: readonly string[];
    readonly shopLoyaltySpend?: PlaySession["shopLoyaltySpend"];
    readonly shopTradeCounts?: PlaySession["shopTradeCounts"];
    readonly shopMileagePoints?: PlaySession["shopMileagePoints"];
    readonly shopPawnTickets?: PlaySession["shopPawnTickets"];
    readonly shopLastRestockDayKey?: PlaySession["shopLastRestockDayKey"];
    readonly energy?: PlaySession["energy"];
    readonly shippingQueue?: PlaySession["shippingQueue"];
    readonly shippingLastSettledDayKey?: PlaySession["shippingLastSettledDayKey"];
    readonly dayTransitionLastDayKey?: PlaySession["dayTransitionLastDayKey"];
    readonly shippingHistory?: PlaySession["shippingHistory"];
    readonly bundleContributions?: PlaySession["bundleContributions"];
    readonly completedBundleIds?: PlaySession["completedBundleIds"];
    readonly bundleRewardAppliedIds?: PlaySession["bundleRewardAppliedIds"];
    readonly unlockedRegionIds?: PlaySession["unlockedRegionIds"];
    readonly unlockedRecipeIds?: PlaySession["unlockedRecipeIds"];
    readonly makerInstances?: PlaySession["makerInstances"];
    readonly dailyWeather?: PlaySession["dailyWeather"];
    readonly farmAnimals?: PlaySession["farmAnimals"];
    readonly monsterInstances?: PlaySession["monsterInstances"];
    readonly monsterParty?: readonly string[];
    readonly monsterBox?: readonly string[];
    readonly actorSkillIds?: PlaySession["actorSkillIds"];
    readonly actorExperience?: Record<string, number>;
    readonly actorLevels?: Record<string, number>;
    readonly actorVitals?: Record<string, ActorVitals>;
    readonly eventLocations?: PlaySession["eventLocations"];
    readonly erasedEventIds?: readonly string[];
    readonly removedEventIds?: PlaySession["removedEventIds"];
    readonly spawnedEvents?: PlaySession["spawnedEvents"];
    readonly camera?: PlaySession["camera"];
    readonly lighting?: PlaySession["lighting"];
    readonly npcTravelStates?: PlaySession["npcTravelStates"];
    readonly npcActivities?: PlaySession["npcActivities"];
    readonly npcScheduleStates?: PlaySession["npcScheduleStates"];
    readonly lifeSkills?: PlaySession["lifeSkills"];
    readonly farmPlots?: PlaySession["farmPlots"];
    readonly farmPlotsAdvancedThrough?: PlaySession["farmPlotsAdvancedThrough"];
    readonly friendship?: PlaySession["friendship"];
    readonly dailyGifts?: PlaySession["dailyGifts"];
    readonly dailyTalks?: PlaySession["dailyTalks"];
    readonly monsterCareSteps?: number;
    readonly monsterCareDaily?: PlaySession["monsterCareDaily"];
    readonly equippedToolItemId?: PlaySession["equippedToolItemId"];
    readonly chests?: PlaySession["chests"];
    readonly placeables?: PlaySession["placeables"];
    readonly followers?: PlaySession["followers"];
    readonly followerTrail?: PlaySession["followerTrail"];
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
    readonly actorNames?: Record<string, string>;
    readonly actorCharacterResourceIds?: Record<string, string>;
    readonly classOverrides?: Record<string, string>;
    readonly actorParamBonuses?: PlaySession["actorParamBonuses"];
    readonly actorStateIds?: PlaySession["actorStateIds"];
    readonly playTimeSeconds?: number;
    readonly gameTime?: PlaySession["gameTime"];
    readonly rng?: RngState;
    // 화면 색조/날씨/숨김 상태(m2Runtime.screen 의 지속형 효과). 세이브 복원 대상.
    readonly screen?: SaveScreenState;
    // Change Save Access 등 접근 플래그(m2Runtime.access). 세이브 복원 대상.
    readonly access?: Partial<Record<"escape" | "menu" | "save" | "teleportation", boolean>>;
  };
};

export type SaveScreenState = {
  readonly tint?: string;
  readonly weather?: string;
  readonly hidden?: boolean;
  readonly tintDurationMs?: number;
};

export type SaveSlotReadResult =
  | { readonly kind: "empty"; readonly slot: SaveSlotIndex }
  | { readonly kind: "corrupt"; readonly slot: SaveSlotIndex; readonly message: string }
  | { readonly kind: "present"; readonly slot: SaveSlotIndex; readonly snapshot: SaveSnapshot };

export function saveSlotKey(slot: SaveSlotIndex): string {
  if (saveSlotStorageNamespace) return `${saveSlotStorageNamespace}:save-slot:${slot}`;
  return `${SAVE_SLOT_PREFIX}${slot}`;
}

/** 전용 오토세이브 키 — 수동 3슬롯(SaveSlotIndex)과 완전히 분리된 별도 칸. */
export function autosaveKey(): string {
  if (saveSlotStorageNamespace) return `${saveSlotStorageNamespace}:save-slot:auto`;
  return `${SAVE_SLOT_PREFIX}auto`;
}

export type AutosaveReadResult =
  | { readonly kind: "empty" }
  | { readonly kind: "corrupt"; readonly message: string }
  | { readonly kind: "present"; readonly snapshot: SaveSnapshot };

export function writeAutosave(storage: Storage, snapshot: SaveSnapshot): void {
  storage.setItem(autosaveKey(), JSON.stringify(snapshot));
}

export function readAutosave(storage: Storage): AutosaveReadResult {
  const text = storage.getItem(autosaveKey());
  if (!text) return { kind: "empty" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { kind: "corrupt", message: error instanceof Error ? error.message : "Invalid save data" };
  }
  const parsed = parseSnapshotValue(value);
  if (!parsed.ok) return { kind: "corrupt", message: parsed.message };
  return { kind: "present", snapshot: parsed.snapshot };
}

export function setSaveSlotStorageNamespace(namespace: string | null): void {
  saveSlotStorageNamespace = namespace?.trim() || null;
}

export function createSaveSnapshot(project: Project, session: PlaySession): SaveSnapshot {
  const normalizedItems = normalizeItemTransitionState(session, project.database.items);
  const bundleReceiptIds = normalizedBundleReceiptIds(project, session.completedBundleIds, session.bundleRewardAppliedIds);
  return {
    schemaVersion: SCHEMA_VERSION,
    projectTitle: project.meta.title,
    savedAt: new Date().toISOString(),
    mapName: project.maps[session.currentMapId]?.name ?? "",
    partyLevel: leadPartyLevel(project, session),
    playTimeSeconds: Math.floor(session.playTimeSeconds ?? 0),
    session: {
      switches: structuredClone(session.switches),
      selfSwitches: structuredClone(session.selfSwitches),
      variables: structuredClone(session.variables),
      timers: structuredClone(session.timers),
      gold: normalizeEconomyValue(session.gold),
      inventory: structuredClone(normalizedItems.inventory),
      itemUseCharges: structuredClone(normalizedItems.itemUseCharges),
      killedFieldSpawns: structuredClone(session.killedFieldSpawns ?? {}),
      partyActorIds: structuredClone(session.partyActorIds),
      shopLoyaltySpend: sanitizeEconomyRecord(session.shopLoyaltySpend),
      shopTradeCounts: sanitizeShopTradeCounts(session.shopTradeCounts),
      shopMileagePoints: economyValueOrUndefined(session.shopMileagePoints),
      shopPawnTickets: structuredClone(session.shopPawnTickets),
      shopLastRestockDayKey: structuredClone(session.shopLastRestockDayKey),
      energy: nonNegativeIntegerOrUndefined(session.energy),
      shippingQueue: structuredClone(session.shippingQueue ?? {}),
      shippingLastSettledDayKey: session.shippingLastSettledDayKey,
      dayTransitionLastDayKey: session.dayTransitionLastDayKey,
      shippingHistory: structuredClone((session.shippingHistory ?? []).slice(-shippingHistoryLimit(project))),
      bundleContributions: structuredClone(session.bundleContributions ?? {}),
      completedBundleIds: bundleReceiptIds,
      bundleRewardAppliedIds: [...bundleReceiptIds],
      unlockedRegionIds: uniqueStrings(session.unlockedRegionIds),
      unlockedRecipeIds: uniqueStrings(session.unlockedRecipeIds),
      makerInstances: structuredClone(restoreMakerInstances(project, session.makerInstances)),
      dailyWeather: project.system.dailyWeather?.enabled === true
        ? structuredClone(normalizeDailyWeatherState(session.dailyWeather))
        : undefined,
      farmAnimals: structuredClone(restoreFarmAnimalsForProject(project, parseFarmAnimalStateRecord(session.farmAnimals))),
      monsterInstances: structuredClone(session.monsterInstances),
      monsterParty: structuredClone(session.monsterParty),
      monsterBox: structuredClone(session.monsterBox),
      actorSkillIds: structuredClone(session.actorSkillIds),
      actorExperience: structuredClone(session.actorExperience),
      actorLevels: structuredClone(session.actorLevels),
      actorVitals: structuredClone(session.actorVitals),
      eventLocations: structuredClone(session.eventLocations),
      erasedEventIds: structuredClone(session.erasedEventIds),
      removedEventIds: structuredClone(session.removedEventIds),
      spawnedEvents: structuredClone(session.spawnedEvents),
      camera: structuredClone(session.camera),
      lighting: structuredClone(normalizeLightingState(session.lighting)),
      npcTravelStates: structuredClone(session.npcTravelStates),
      npcActivities: structuredClone(session.npcActivities ?? {}),
      npcScheduleStates: structuredClone(session.npcScheduleStates ?? {}),
      lifeSkills: structuredClone(restoreLifeSkills(project, session.lifeSkills)),
      farmPlots: structuredClone(session.farmPlots ?? {}),
      farmPlotsAdvancedThrough: structuredClone(session.farmPlotsAdvancedThrough),
      friendship: structuredClone(session.friendship ?? {}),
      dailyGifts: structuredClone(session.dailyGifts ?? {}),
      dailyTalks: structuredClone(session.dailyTalks ?? {}),
      monsterCareSteps: session.monsterCareSteps,
      monsterCareDaily: structuredClone(session.monsterCareDaily ?? {}),
      equippedToolItemId: session.equippedToolItemId,
      chests: parseChestsRecord(session.chests) ?? {},
      placeables: structuredClone(session.placeables ?? {}),
      followers: structuredClone(session.followers),
      followerTrail: structuredClone(session.followerTrail),
      currentMapId: session.currentMapId,
      x: session.x,
      y: session.y,
      mapOverrides: structuredClone(session.mapOverrides ?? {}),
      flags: structuredClone(session.flags),
      battleResult: session.battleResult,
      audio: structuredClone(session.audio),
      pictures: structuredClone(session.pictures),
      actorEquipment: structuredClone(session.actorEquipment),
      actorRows: structuredClone(session.actorRows),
      actorNames: structuredClone(session.actorNames),
      actorCharacterResourceIds: structuredClone(session.actorCharacterResourceIds),
      classOverrides: structuredClone(session.classOverrides),
      actorParamBonuses: structuredClone(session.actorParamBonuses),
      actorStateIds: structuredClone(session.actorStateIds),
      playTimeSeconds: Math.floor(session.playTimeSeconds ?? 0),
      gameTime: structuredClone(normalizeRestorableGameTime(project, session.gameTime)),
      rng: cloneRngState(normalizeRngState(session.rng)),
      screen: pickScreenState(session),
      access: session.m2Runtime?.access && Object.keys(session.m2Runtime.access).length > 0 ? { ...session.m2Runtime.access } : undefined,
    },
  };
}

// 지속형 화면 효과(색조/날씨/숨김)만 추려 세이브에 담는다. 값이 전혀 없으면 생략.
function pickScreenState(session: PlaySession): SaveScreenState | undefined {
  const screen = session.m2Runtime?.screen;
  if (!screen) return undefined;
  const { tint, weather, hidden, tintDurationMs } = screen;
  if (tint === undefined && weather === undefined && hidden === undefined && tintDurationMs === undefined) {
    return undefined;
  }
  return { tint, weather, hidden, tintDurationMs };
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
  session.gold = normalizeEconomyValue(snapshot.session.gold);
  if (snapshot.session.inventory) session.inventory = structuredClone(snapshot.session.inventory);
  const normalizedItems = normalizeItemTransitionState({
    inventory: session.inventory,
    itemUseCharges: snapshot.session.itemUseCharges,
  }, project.database.items);
  session.inventory = normalizedItems.inventory;
  session.itemUseCharges = normalizedItems.itemUseCharges;
  if (snapshot.session.killedFieldSpawns) session.killedFieldSpawns = structuredClone(snapshot.session.killedFieldSpawns);
  if (snapshot.session.partyActorIds) session.partyActorIds = [...snapshot.session.partyActorIds];
  session.shopLoyaltySpend = sanitizeEconomyRecord(snapshot.session.shopLoyaltySpend);
  session.shopTradeCounts = sanitizeShopTradeCounts(snapshot.session.shopTradeCounts);
  session.shopMileagePoints = economyValueOrUndefined(snapshot.session.shopMileagePoints);
  if (snapshot.session.shopPawnTickets) session.shopPawnTickets = structuredClone(snapshot.session.shopPawnTickets);
  if (snapshot.session.shopLastRestockDayKey) session.shopLastRestockDayKey = structuredClone(snapshot.session.shopLastRestockDayKey);
  if (typeof snapshot.session.energy === "number") session.energy = snapshot.session.energy;
  const shippingEnabled = project.system.shipping?.enabled === true;
  session.shippingQueue = shippingEnabled
    ? restoreShippingQueue(project, snapshot.session.shippingQueue)
    : {};
  session.shippingLastSettledDayKey = shippingEnabled ? snapshot.session.shippingLastSettledDayKey : undefined;
  session.shippingHistory = shippingEnabled
    ? structuredClone((snapshot.session.shippingHistory ?? []).slice(-shippingHistoryLimit(project)))
    : [];
  session.bundleContributions = restoreBundleContributions(project, snapshot.session.bundleContributions);
  const bundleReceiptIds = normalizedBundleReceiptIds(
    project,
    snapshot.session.completedBundleIds,
    snapshot.session.bundleRewardAppliedIds,
  );
  session.completedBundleIds = bundleReceiptIds;
  session.bundleRewardAppliedIds = [...bundleReceiptIds];
  session.unlockedRegionIds = filterKnownIds(
    snapshot.session.unlockedRegionIds,
    new Set((project.system.worldUnlocks ?? []).map((unlock) => unlock.id)),
  );
  session.unlockedRecipeIds = filterKnownIds(
    snapshot.session.unlockedRecipeIds,
    new Set((project.system.craftRecipes ?? []).map((recipe) => recipe.id)),
  );
  session.makerInstances = restoreMakerInstances(project, snapshot.session.makerInstances);
  session.dailyWeather = project.system.dailyWeather?.enabled === true
    ? normalizeDailyWeatherState(snapshot.session.dailyWeather)
    : undefined;
  session.farmAnimals = restoreFarmAnimalsForProject(project, parseFarmAnimalStateRecord(snapshot.session.farmAnimals));
  if (snapshot.session.monsterInstances) session.monsterInstances = structuredClone(snapshot.session.monsterInstances);
  if (snapshot.session.monsterParty) session.monsterParty = [...snapshot.session.monsterParty];
  if (snapshot.session.monsterBox) session.monsterBox = [...snapshot.session.monsterBox];
  if (snapshot.session.actorSkillIds) session.actorSkillIds = structuredClone(snapshot.session.actorSkillIds);
  if (snapshot.session.actorExperience) session.actorExperience = structuredClone(snapshot.session.actorExperience);
  if (snapshot.session.actorLevels) session.actorLevels = structuredClone(snapshot.session.actorLevels);
  if (snapshot.session.actorVitals) session.actorVitals = structuredClone(snapshot.session.actorVitals);
  if (snapshot.session.eventLocations) session.eventLocations = structuredClone(snapshot.session.eventLocations);
  if (snapshot.session.erasedEventIds) session.erasedEventIds = [...snapshot.session.erasedEventIds];
  if (snapshot.session.removedEventIds) session.removedEventIds = structuredClone(snapshot.session.removedEventIds);
  if (snapshot.session.spawnedEvents) session.spawnedEvents = structuredClone(snapshot.session.spawnedEvents);
  if (snapshot.session.camera) session.camera = structuredClone(snapshot.session.camera);
  if (snapshot.session.lighting) session.lighting = normalizeLightingState(snapshot.session.lighting);
  if (snapshot.session.npcTravelStates) session.npcTravelStates = structuredClone(snapshot.session.npcTravelStates);
  if (snapshot.session.npcActivities) session.npcActivities = structuredClone(snapshot.session.npcActivities);
  if (snapshot.session.npcScheduleStates) session.npcScheduleStates = structuredClone(snapshot.session.npcScheduleStates);
  session.lifeSkills = restoreLifeSkills(project, snapshot.session.lifeSkills);
  session.farmPlots = structuredClone(snapshot.session.farmPlots ?? {});
  session.farmPlotsAdvancedThrough = normalizeFarmPlotDateForProject(project, snapshot.session.farmPlotsAdvancedThrough);
  session.friendship = normalizeFriendshipRecord(snapshot.session.friendship);
  session.dailyGifts = structuredClone(snapshot.session.dailyGifts ?? {});
  session.dailyTalks = structuredClone(snapshot.session.dailyTalks ?? {});
  if (typeof snapshot.session.monsterCareSteps === "number") {
    session.monsterCareSteps = Math.max(0, Math.trunc(snapshot.session.monsterCareSteps));
  }
  if (snapshot.session.monsterCareDaily) {
    session.monsterCareDaily = structuredClone(snapshot.session.monsterCareDaily);
  }
  if (snapshot.session.equippedToolItemId) session.equippedToolItemId = snapshot.session.equippedToolItemId;
  session.chests = parseChestsRecord(snapshot.session.chests) ?? {};
  if (snapshot.session.placeables) session.placeables = structuredClone(snapshot.session.placeables);
  if (snapshot.session.followers) session.followers = structuredClone(snapshot.session.followers);
  if (snapshot.session.followerTrail) session.followerTrail = structuredClone(snapshot.session.followerTrail);
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
  if (snapshot.session.actorNames) session.actorNames = structuredClone(snapshot.session.actorNames);
  if (snapshot.session.actorCharacterResourceIds) session.actorCharacterResourceIds = structuredClone(snapshot.session.actorCharacterResourceIds);
  if (snapshot.session.classOverrides) session.classOverrides = structuredClone(snapshot.session.classOverrides);
  if (snapshot.session.actorParamBonuses) session.actorParamBonuses = structuredClone(snapshot.session.actorParamBonuses);
  if (snapshot.session.actorStateIds) session.actorStateIds = structuredClone(snapshot.session.actorStateIds);
  if (typeof snapshot.session.playTimeSeconds === "number") session.playTimeSeconds = snapshot.session.playTimeSeconds;
  const restoredGameTime = normalizeRestorableGameTime(project, snapshot.session.gameTime);
  if (restoredGameTime) session.gameTime = restoredGameTime;
  session.dayTransitionLastDayKey = restoredGameTime && isPreviousCalendarDayKey(
    project,
    restoredGameTime,
    snapshot.session.dayTransitionLastDayKey,
  )
    ? snapshot.session.dayTransitionLastDayKey
    : undefined;
  session.rng = normalizeRngState(snapshot.session.rng, session.rng?.seed);
  if (snapshot.session.screen) applyScreenState(session, snapshot.session.screen);
  if (snapshot.session.access) {
    const runtime = ensureM2Runtime(session);
    runtime.access = { ...snapshot.session.access };
  }
  syncMonsterPartyFollowers(project, session);
  return session;
}

// 색조/날씨/숨김 상태를 m2Runtime.screen 에 복원한다.
function applyScreenState(session: PlaySession, screen: SaveScreenState): void {
  const runtime = ensureM2Runtime(session);
  if (screen.tint !== undefined) runtime.screen.tint = screen.tint;
  if (screen.weather !== undefined) runtime.screen.weather = screen.weather;
  if (screen.hidden !== undefined) runtime.screen.hidden = screen.hidden;
  if (screen.tintDurationMs !== undefined) runtime.screen.tintDurationMs = screen.tintDurationMs;
}

function parseSaveSnapshot(value: unknown, slot: SaveSlotIndex): SaveSlotReadResult {
  const parsed = parseSnapshotValue(value);
  if (!parsed.ok) return corrupt(slot, parsed.message);
  return { kind: "present", slot, snapshot: parsed.snapshot };
}

type ParsedSnapshotResult =
  | { readonly ok: true; readonly snapshot: SaveSnapshot }
  | { readonly ok: false; readonly message: string };

// 수동 슬롯/오토세이브 공용 코어 파서 — 알려진 필드만 골라 담아 전후방 호환을 유지한다.
function parseSnapshotValue(value: unknown): ParsedSnapshotResult {
  if (!isRecord(value)) return { ok: false, message: "Save slot is not an object" };
  if (value.schemaVersion !== SCHEMA_VERSION) return { ok: false, message: "Unsupported save schema" };
  if (typeof value.projectTitle !== "string") return { ok: false, message: "Missing project title" };
  if (typeof value.savedAt !== "string") return { ok: false, message: "Missing saved time" };
  if (!isRecord(value.session)) return { ok: false, message: "Missing session" };
  const parsed = parseSessionRecord(value.session);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  return {
    ok: true,
    snapshot: {
      schemaVersion: SCHEMA_VERSION,
      projectTitle: value.projectTitle,
      savedAt: value.savedAt,
      mapName: typeof value.mapName === "string" ? value.mapName : undefined,
      partyLevel: typeof value.partyLevel === "number" ? Math.floor(value.partyLevel) : undefined,
      playTimeSeconds: typeof value.playTimeSeconds === "number" ? Math.floor(value.playTimeSeconds) : undefined,
      savedBy: isSaveOrigin(value.savedBy) ? value.savedBy : undefined,
      autosaveTrigger: isAutosaveTrigger(value.autosaveTrigger) ? value.autosaveTrigger : undefined,
      session: parsed.session,
    },
  };
}

function leadPartyLevel(project: Project, session: PlaySession): number | undefined {
  const actorId = session.partyActorIds[0];
  if (!actorId) return undefined;
  const actor = project.database.actors.find((record) => record.id === actorId);
  return session.actorLevels[actorId] ?? actor?.initialLevel;
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
      selfSwitches: isSelfSwitchesRecord(session.selfSwitches) ? session.selfSwitches : undefined,
      variables: session.variables,
      timers: session.timers,
      gold: normalizeEconomyValue(session.gold),
      inventory: isNumberRecord(session.inventory) ? session.inventory : undefined,
      itemUseCharges: parseItemUseCharges(session.itemUseCharges),
      killedFieldSpawns: isNestedNumberRecord(session.killedFieldSpawns) ? session.killedFieldSpawns : undefined,
      partyActorIds: isStringArray(session.partyActorIds) ? session.partyActorIds : undefined,
      shopLoyaltySpend: sanitizeEconomyRecord(session.shopLoyaltySpend),
      shopTradeCounts: sanitizeShopTradeCounts(session.shopTradeCounts),
      shopMileagePoints: economyValueOrUndefined(session.shopMileagePoints),
      shopPawnTickets: isShopPawnTicketsRecord(session.shopPawnTickets) ? session.shopPawnTickets : undefined,
      shopLastRestockDayKey: isStringRecord(session.shopLastRestockDayKey) ? session.shopLastRestockDayKey : undefined,
      energy: nonNegativeIntegerOrUndefined(session.energy),
      shippingQueue: parsePositiveIntegerRecord(session.shippingQueue),
      shippingLastSettledDayKey: typeof session.shippingLastSettledDayKey === "string" && session.shippingLastSettledDayKey.trim()
        ? session.shippingLastSettledDayKey
        : undefined,
      dayTransitionLastDayKey: parseCalendarDayKey(session.dayTransitionLastDayKey)
        ? session.dayTransitionLastDayKey as string
        : undefined,
      shippingHistory: isShippingSettlementArray(session.shippingHistory) ? session.shippingHistory : undefined,
      bundleContributions: isNestedNonNegativeIntegerRecord(session.bundleContributions) ? session.bundleContributions : undefined,
      completedBundleIds: isStringArray(session.completedBundleIds) ? [...session.completedBundleIds] : undefined,
      bundleRewardAppliedIds: isStringArray(session.bundleRewardAppliedIds) ? [...session.bundleRewardAppliedIds] : undefined,
      unlockedRegionIds: isStringArray(session.unlockedRegionIds) ? [...session.unlockedRegionIds] : undefined,
      unlockedRecipeIds: isStringArray(session.unlockedRecipeIds) ? [...session.unlockedRecipeIds] : undefined,
      makerInstances: isMakerInstancesRecord(session.makerInstances) ? session.makerInstances : undefined,
      dailyWeather: normalizeDailyWeatherState(session.dailyWeather),
      farmAnimals: parseFarmAnimalStateRecord(session.farmAnimals),
      monsterInstances: isMonsterInstancesRecord(session.monsterInstances) ? session.monsterInstances : undefined,
      monsterParty: isStringArray(session.monsterParty) ? session.monsterParty : undefined,
      monsterBox: isStringArray(session.monsterBox) ? session.monsterBox : undefined,
      actorSkillIds: isActorSkillIdsRecord(session.actorSkillIds) ? session.actorSkillIds : undefined,
      actorExperience: isNumberRecord(session.actorExperience) ? session.actorExperience : undefined,
      actorLevels: isNumberRecord(session.actorLevels) ? session.actorLevels : undefined,
      actorVitals: isActorVitalsRecord(session.actorVitals) ? session.actorVitals : undefined,
      eventLocations: isRuntimeEventLocationRecord(session.eventLocations) ? session.eventLocations : undefined,
      erasedEventIds: isStringArray(session.erasedEventIds) ? session.erasedEventIds : undefined,
      removedEventIds: isRuntimeRemovedEventIds(session.removedEventIds) ? session.removedEventIds : undefined,
      spawnedEvents: isRuntimeSpawnedEventRecord(session.spawnedEvents) ? session.spawnedEvents : undefined,
      camera: isRuntimeCameraState(session.camera) ? session.camera : undefined,
      lighting: isLightingState(session.lighting) ? normalizeLightingState(session.lighting) : undefined,
      npcTravelStates: isRuntimeNpcTravelStateRecord(session.npcTravelStates) ? session.npcTravelStates : undefined,
      npcActivities: isStringRecord(session.npcActivities) ? session.npcActivities : undefined,
      npcScheduleStates: isRuntimeNpcScheduleStateRecord(session.npcScheduleStates) ? session.npcScheduleStates : undefined,
      lifeSkills: isLifeSkillsRecord(session.lifeSkills) ? session.lifeSkills : undefined,
      farmPlots: isFarmPlotsRecord(session.farmPlots) ? session.farmPlots : undefined,
      farmPlotsAdvancedThrough: isFarmPlotDate(session.farmPlotsAdvancedThrough) ? session.farmPlotsAdvancedThrough : undefined,
      friendship: isNumberRecord(session.friendship) ? normalizeFriendshipRecord(session.friendship) : undefined,
      dailyGifts: isStringRecord(session.dailyGifts) ? session.dailyGifts : undefined,
      dailyTalks: isStringRecord(session.dailyTalks) ? session.dailyTalks : undefined,
      monsterCareSteps: typeof session.monsterCareSteps === "number" && Number.isFinite(session.monsterCareSteps)
        ? Math.max(0, Math.trunc(session.monsterCareSteps))
        : undefined,
      monsterCareDaily: isNumberRecord(session.monsterCareDaily) ? session.monsterCareDaily : undefined,
      equippedToolItemId: typeof session.equippedToolItemId === "string" ? session.equippedToolItemId : undefined,
      chests: parseChestsRecord(session.chests),
      placeables: session.placeables && typeof session.placeables === "object" ? structuredClone(session.placeables) as Record<string, any> : undefined,
      followers: isRuntimeFollowerArray(session.followers) ? session.followers : undefined,
      followerTrail: isRuntimeFollowerTrail(session.followerTrail) ? session.followerTrail : undefined,
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
      actorNames: isStringRecord(session.actorNames) ? session.actorNames : undefined,
      actorCharacterResourceIds: isStringRecord(session.actorCharacterResourceIds) ? session.actorCharacterResourceIds : undefined,
      classOverrides: isStringRecord(session.classOverrides) ? session.classOverrides : undefined,
      actorParamBonuses: isActorParamBonusRecord(session.actorParamBonuses) ? session.actorParamBonuses : undefined,
      actorStateIds: isActorStateIdsRecord(session.actorStateIds) ? session.actorStateIds : undefined,
      playTimeSeconds: typeof session.playTimeSeconds === "number" ? Math.floor(session.playTimeSeconds) : undefined,
      gameTime: isGameTime(session.gameTime) ? structuredClone(session.gameTime) : undefined,
      rng: isRngState(session.rng) ? session.rng : undefined,
      screen: parseScreenState(session.screen),
    },
  };
}

function parseItemUseCharges(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const charges: Record<string, number> = {};
  for (const [itemId, charge] of Object.entries(value)) {
    if (typeof charge === "number" && Number.isFinite(charge)) charges[itemId] = charge;
  }
  return charges;
}

// 저장된 화면 상태를 방어적으로 파싱(모든 필드 선택). 유효 필드가 없으면 undefined.
function parseScreenState(value: unknown): SaveScreenState | undefined {
  if (!isRecord(value)) return undefined;
  const result: { tint?: string; weather?: string; hidden?: boolean; tintDurationMs?: number } = {};
  if (typeof value.tint === "string") result.tint = value.tint;
  if (typeof value.weather === "string") result.weather = value.weather;
  if (typeof value.hidden === "boolean") result.hidden = value.hidden;
  if (typeof value.tintDurationMs === "number") result.tintDurationMs = value.tintDurationMs;
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseBattleResult(value: unknown): PlaySession["battleResult"] | "invalid" {
  if (value === undefined) return undefined;
  if (value === "victory" || value === "defeat" || value === "escape") return value;
  return "invalid";
}

function normalizeFriendshipRecord(value: Record<string, number> | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [npcKey, amount] of Object.entries(value ?? {})) {
    if (!npcKey.trim()) continue;
    result[npcKey] = clampFriendship(amount);
  }
  return result;
}

function nonNegativeIntegerOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

const CALENDAR_DAY_KEY_PATTERN = /^([1-9]\d*):(spring|summer|fall|winter):([1-9]\d*)$/;

function parseCalendarDayKey(value: unknown): Pick<GameTime, "year" | "season" | "day"> | undefined {
  if (typeof value !== "string") return undefined;
  const match = CALENDAR_DAY_KEY_PATTERN.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const day = Number(match[3]);
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(day)) return undefined;
  return { year, season: match[2] as Season, day };
}

function isPreviousCalendarDayKey(
  project: Project,
  currentTime: GameTime | undefined,
  candidate: string | undefined,
): candidate is string {
  const system = resolveTimeSystem(project);
  const parsed = parseCalendarDayKey(candidate);
  if (!system || !currentTime || !parsed || parsed.day > system.daysPerSeason) return false;
  const previous = {
    ...parsed,
    hour: system.dayStartHour,
    minute: 0,
  } satisfies GameTime;
  return calendarDayKey(advanceGameDays(previous, 1, system).time) === calendarDayKey(currentTime);
}

function normalizeRestorableGameTime(project: Project, value: unknown): GameTime | undefined {
  const normalized = normalizeGameTime(value, project.system.timeSystem);
  if (!normalized) return undefined;
  if (![normalized.year, normalized.day, normalized.hour, normalized.minute].every(Number.isSafeInteger)) {
    return undefined;
  }
  try {
    absoluteGameMinutes(normalized, project.system.timeSystem);
    return normalized;
  } catch {
    return undefined;
  }
}

function uniqueStrings(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).filter((value) => value.trim().length > 0))];
}

function normalizeFarmPlotDateForProject(
  project: Project,
  value: PlaySession["farmPlotsAdvancedThrough"],
): PlaySession["farmPlotsAdvancedThrough"] {
  if (!value) return undefined;
  const normalized = normalizeGameTime(
    { ...value, hour: project.system.timeSystem?.dayStartHour ?? 6, minute: 0 },
    project.system.timeSystem,
  );
  return normalized
    ? { day: normalized.day, season: normalized.season, year: normalized.year }
    : undefined;
}

function restoreShippingQueue(
  project: Project,
  queue: PlaySession["shippingQueue"],
): NonNullable<PlaySession["shippingQueue"]> {
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const allowedIds = project.system.shipping?.allowedItemIds;
  return Object.fromEntries(Object.entries(queue ?? {}).filter(([itemId, count]) =>
    Number.isInteger(count) && count > 0 && count <= GOLD_MAX &&
    itemIds.has(itemId) && (allowedIds === undefined || allowedIds.includes(itemId))));
}

function restoreBundleContributions(
  project: Project,
  contributions: PlaySession["bundleContributions"],
): NonNullable<PlaySession["bundleContributions"]> {
  const restored: NonNullable<PlaySession["bundleContributions"]> = {};
  for (const bundle of project.system.bundles ?? []) {
    const saved = contributions?.[bundle.id];
    if (!saved) continue;
    const requirements = new Map(bundle.requirements.map((entry) => [entry.itemId, entry.count] as const));
    const valid = Object.fromEntries(Object.entries(saved).filter(([itemId, count]) => {
      const required = requirements.get(itemId);
      return required !== undefined && count > 0 && count <= required;
    }));
    if (Object.keys(valid).length > 0) restored[bundle.id] = valid;
  }
  return restored;
}

function restoreMakerInstances(
  project: Project,
  instances: PlaySession["makerInstances"],
): NonNullable<PlaySession["makerInstances"]> {
  const makerIds = new Set((project.system.makers ?? []).map((maker) => maker.id));
  return Object.fromEntries(Object.entries(instances ?? {}).filter(([instanceId, instance]) => {
    if (instance.instanceId !== instanceId || !makerIds.has(instance.makerId)) return false;
    if (instance.status === "idle") {
      return instance.startedAtMinute === undefined && instance.readyAtMinute === undefined;
    }
    return Number.isSafeInteger(instance.startedAtMinute)
      && instance.startedAtMinute! >= 0
      && Number.isSafeInteger(instance.readyAtMinute)
      && instance.readyAtMinute! >= instance.startedAtMinute!;
  }));
}

function restoreLifeSkills(
  project: Project,
  progress: PlaySession["lifeSkills"],
): NonNullable<PlaySession["lifeSkills"]> {
  const restored: NonNullable<PlaySession["lifeSkills"]> = {};
  for (const skill of project.database.lifeSkills ?? []) {
    const saved = progress?.[skill.id];
    if (!saved || !Number.isSafeInteger(saved.xp) || saved.xp < 0) continue;
    const xp = Math.min(saved.xp, xpForLevel(skill.maxLevel));
    restored[skill.id] = { xp, level: levelForXp(xp, skill.maxLevel) };
  }
  return restored;
}

function restoreFarmAnimalsForProject(
  project: Project,
  animals: PlaySession["farmAnimals"],
): PlaySession["farmAnimals"] {
  return restoreFarmAnimalStates(
    project.session.farmAnimals,
    animals,
    new Set((project.database.farmAnimalSpecies ?? []).map((species) => species.id)),
  );
}

function normalizedBundleReceiptIds(
  project: Project,
  completed: readonly string[] | undefined,
  rewardApplied: readonly string[] | undefined,
): string[] {
  const knownIds = new Set((project.system.bundles ?? []).map((bundle) => bundle.id));
  return filterKnownIds([...(completed ?? []), ...(rewardApplied ?? [])], knownIds);
}

function filterKnownIds(values: readonly string[] | undefined, knownIds: ReadonlySet<string>): string[] {
  return uniqueStrings(values).filter((id) => knownIds.has(id));
}

function corrupt(slot: SaveSlotIndex, message: string): SaveSlotReadResult {
  return { kind: "corrupt", slot, message };
}
