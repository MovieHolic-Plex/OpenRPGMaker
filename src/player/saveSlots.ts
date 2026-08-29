import { SCHEMA_VERSION, type ActorInitialEquipment, type CharacterFootprint, type Project } from "@/project/types";
import { normalizeCharacterFootprint } from "@/project/footprint";
import {
  clampFriendship,
  GOLD_MAX,
  startSession,
  type AudioCommandState,
  type PictureState,
  type PlaySession,
} from "@/project/session";
import { parseFactionStanceOverrides } from "@/project/factionRuntime";
import { resolveFactionTable } from "@/project/factions";
import { normalizeItemTransitionState } from "@/project/itemTransitions";
import { faceIdForSheetCell } from "@/assets/facesetFaceAssets";
import {
  economyValueOrUndefined,
  normalizeEconomyValue,
  sanitizeEconomyRecord,
  sanitizeShopTradeCounts,
} from "@/project/economyValues";
import { syncMonsterPartyFollowers } from "@/project/followers";
import { normalizeMonsterInstanceBattleState } from "@/project/monsterCollection";
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
  isActorSkillPpRecord,
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
  parseRngState,
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
import { normalizeRoguelikeRunState, type RoguelikeRunState } from "@/project/roguelikeRun";
import {
  normalizeDailyWeatherState,
  parseFarmAnimalStateRecord,
  restoreFarmAnimalStates,
} from "@/project/p1FoundationRecords";
import { applyDailyWeatherForDate } from "@/project/dailyWeather";
import { weatherToRuntimeString } from "@/player/weather/weatherModel";
import {
  parseFarmBuildingPlacementRecord,
  parseHomeDecorationPlacementRecord,
} from "@/player/saveSlotSpatialValidation";
import { restoreSpatialPlacementRecords } from "@/project/spatialPlacementRestore";
import { validProgress, type CollectionProgress } from "@/project/collections";
import { placeableDropItemId, placeableKey, type PlaceableObjectState } from "@/project/placeables";
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
    readonly factionStanceOverrides?: PlaySession["factionStanceOverrides"];
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
    readonly farmBuildingPlacements?: PlaySession["farmBuildingPlacements"];
    readonly homeDecorationPlacements?: PlaySession["homeDecorationPlacements"];
    readonly collections?: PlaySession["collections"];
    readonly museumRewardAppliedIds?: PlaySession["museumRewardAppliedIds"];
    readonly forageLastAdvancedDayKey?: PlaySession["forageLastAdvancedDayKey"];
    readonly monsterInstances?: PlaySession["monsterInstances"];
    readonly monsterParty?: readonly string[];
    readonly monsterBox?: readonly string[];
    readonly actorSkillIds?: PlaySession["actorSkillIds"];
    readonly actorSkillPp?: PlaySession["actorSkillPp"];
    readonly actorBattleCommands?: PlaySession["actorBattleCommands"];
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
    readonly monsterFieldPoisonSteps?: number;
    readonly monsterCareDaily?: PlaySession["monsterCareDaily"];
    readonly equippedToolItemId?: PlaySession["equippedToolItemId"];
    readonly chests?: PlaySession["chests"];
    readonly placeables?: PlaySession["placeables"];
    readonly followers?: PlaySession["followers"];
    readonly followerTrail?: PlaySession["followerTrail"];
    readonly currentMapId: string;
    readonly x: number;
    readonly y: number;
    readonly playerFootprint?: PlaySession["playerFootprint"];
    readonly playerPassRows?: PlaySession["playerPassRows"];
    readonly mapOverrides: PlaySession["mapOverrides"];
    readonly flags: Record<string, boolean>;
    readonly battleResult?: PlaySession["battleResult"];
    readonly audio: AudioCommandState;
    readonly pictures: Record<string, PictureState>;
    readonly actorEquipment?: Record<string, ActorInitialEquipment>;
    readonly actorRows?: Record<string, "front" | "back">;
    readonly actorNames?: Record<string, string>;
    readonly actorNicknames?: PlaySession["actorNicknames"];
    readonly actorFaceResourceIds?: PlaySession["actorFaceResourceIds"];
    readonly actorCharacterResourceIds?: Record<string, string>;
    readonly classOverrides?: Record<string, string>;
    readonly actorParamBonuses?: PlaySession["actorParamBonuses"];
    readonly actorStateIds?: PlaySession["actorStateIds"];
    readonly playTimeSeconds?: number;
    readonly gameTime?: PlaySession["gameTime"];
    readonly rng?: RngState;
    readonly roguelikeRun?: RoguelikeRunState;
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

export type SaveWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

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
  const spatial = restoreSpatialPlacementRecords(project, session, {
    farmBuildingPlacements: parseFarmBuildingPlacementRecord(session.farmBuildingPlacements),
    homeDecorationPlacements: parseHomeDecorationPlacementRecord(session.homeDecorationPlacements),
  });
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
      factionStanceOverrides: session.factionStanceOverrides && Object.keys(session.factionStanceOverrides).length > 0
        ? structuredClone(session.factionStanceOverrides)
        : undefined,
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
      farmBuildingPlacements: structuredClone(spatial.farmBuildingPlacements),
      homeDecorationPlacements: structuredClone(spatial.homeDecorationPlacements),
      collections: sanitizeCollections(session.collections, new Set(project.database.items.map((item) => item.id))),
      museumRewardAppliedIds: sanitizeReceiptIds(session.museumRewardAppliedIds),
      forageLastAdvancedDayKey: parseCalendarDayKey(session.forageLastAdvancedDayKey)
        ? session.forageLastAdvancedDayKey
        : undefined,
      monsterInstances: structuredClone(session.monsterInstances),
      monsterParty: structuredClone(session.monsterParty),
      monsterBox: structuredClone(session.monsterBox),
      actorSkillIds: structuredClone(session.actorSkillIds),
      actorSkillPp: structuredClone(session.actorSkillPp),
      actorBattleCommands: structuredClone(session.actorBattleCommands),
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
      monsterFieldPoisonSteps: session.monsterFieldPoisonSteps,
      monsterCareDaily: structuredClone(session.monsterCareDaily ?? {}),
      equippedToolItemId: session.equippedToolItemId,
      chests: parseChestsRecord(session.chests) ?? {},
      placeables: restorePlaceables(project, session.placeables),
      followers: structuredClone(session.followers),
      followerTrail: structuredClone(session.followerTrail),
      currentMapId: session.currentMapId,
      x: session.x,
      y: session.y,
      // 주인공 몸 크기의 **런타임 오버라이드**만 굽는다. 오버라이드가 없으면 undefined 로 남아
      // 로드 시 저작값(system.playerFootprint)을 다시 읽는다 — 저작값을 고친 프로젝트에
      // 옛 세이브를 붙여도 낡은 크기가 되살아나지 않는다.
      playerFootprint: session.playerFootprint ? structuredClone(session.playerFootprint) : undefined,
      playerPassRows: session.playerPassRows,
      mapOverrides: structuredClone(session.mapOverrides ?? {}),
      flags: structuredClone(session.flags),
      battleResult: session.battleResult,
      audio: structuredClone(session.audio),
      pictures: structuredClone(session.pictures),
      actorEquipment: structuredClone(session.actorEquipment),
      actorRows: structuredClone(session.actorRows),
      actorNames: structuredClone(session.actorNames),
      actorNicknames: structuredClone(session.actorNicknames),
      actorFaceResourceIds: structuredClone(session.actorFaceResourceIds),
      actorCharacterResourceIds: structuredClone(session.actorCharacterResourceIds),
      classOverrides: structuredClone(session.classOverrides),
      actorParamBonuses: structuredClone(session.actorParamBonuses),
      actorStateIds: structuredClone(session.actorStateIds),
      playTimeSeconds: Math.floor(session.playTimeSeconds ?? 0),
      gameTime: structuredClone(normalizeRestorableGameTime(project, session.gameTime)),
      rng: cloneRngState(normalizeRngState(session.rng)),
      roguelikeRun: structuredClone(session.roguelikeRun),
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

// 저장 실패(quota 초과·프라이빗 모드)를 던지면 호출부의 클릭 핸들러가 그대로 끊겨
// 성공도 실패도 표시되지 않았다. 오토세이브(performAutosave)와 같은 계약으로 결과를 돌려준다.
export function saveToSlot(storage: Storage, slot: SaveSlotIndex, snapshot: SaveSnapshot): SaveWriteResult {
  try {
    storage.setItem(saveSlotKey(slot), JSON.stringify(snapshot));
    return { ok: true };
  } catch (error) {
    console.warn("[save] failed to write save slot:", error);
    return { ok: false, message: saveWriteFailureMessage(error) };
  }
}

function saveWriteFailureMessage(error: unknown): string {
  return isQuotaExceededError(error) ? "저장 공간이 부족합니다" : "이 브라우저에 저장할 수 없습니다";
}

function isQuotaExceededError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
  }
  return error instanceof Error && /quota/i.test(`${error.name} ${error.message}`);
}

// 실측 결함: 저장 당시의 맵이 지워진 슬롯을 그대로 적용하면 부팅이 project.maps[id].width 에서
// 터져 배포 플레이어가 "맵·에셋 불러오는 중…" 화면에 영구히 갇혔다. 적용 전에 막는다.
export function snapshotLoadBlocker(project: Project, snapshot: SaveSnapshot): string | null {
  if (!project.maps[snapshot.session.currentMapId]) return "저장 당시의 맵이 이 프로젝트에 없습니다";
  return null;
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
  session.factionStanceOverrides = parseFactionStanceOverrides(
    snapshot.session.factionStanceOverrides,
    resolveFactionTable(project.factions),
  );
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
  const savedDailyWeather = project.system.dailyWeather?.enabled === true
    ? normalizeDailyWeatherState(snapshot.session.dailyWeather)
    : undefined;
  session.dailyWeather = savedDailyWeather;
  session.farmAnimals = restoreFarmAnimalsForProject(project, parseFarmAnimalStateRecord(snapshot.session.farmAnimals));
  if (session.collections !== undefined) {
    session.collections = sanitizeCollections(
      snapshot.session.collections,
      new Set(project.database.items.map((item) => item.id)),
    ) ?? {};
  }
  if (session.museumRewardAppliedIds !== undefined) session.museumRewardAppliedIds = sanitizeReceiptIds(snapshot.session.museumRewardAppliedIds) ?? [];
  if (snapshot.session.monsterInstances) {
    session.monsterInstances = {};
    for (const [instanceId, instance] of Object.entries(snapshot.session.monsterInstances)) {
      session.monsterInstances[instanceId] = normalizeMonsterInstanceBattleState(project, structuredClone(instance));
    }
  }
  if (snapshot.session.monsterParty) session.monsterParty = [...snapshot.session.monsterParty];
  if (snapshot.session.monsterBox) session.monsterBox = [...snapshot.session.monsterBox];
  if (snapshot.session.actorSkillIds) session.actorSkillIds = structuredClone(snapshot.session.actorSkillIds);
  if (snapshot.session.actorSkillPp) session.actorSkillPp = structuredClone(snapshot.session.actorSkillPp);
  if (snapshot.session.actorBattleCommands) session.actorBattleCommands = structuredClone(snapshot.session.actorBattleCommands);
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
  if (typeof snapshot.session.monsterFieldPoisonSteps === "number") {
    session.monsterFieldPoisonSteps = snapshot.session.monsterFieldPoisonSteps;
  }
  if (snapshot.session.monsterCareDaily) {
    session.monsterCareDaily = structuredClone(snapshot.session.monsterCareDaily);
  }
  if (snapshot.session.equippedToolItemId) session.equippedToolItemId = snapshot.session.equippedToolItemId;
  session.chests = parseChestsRecord(snapshot.session.chests) ?? {};
  if (snapshot.session.placeables) session.placeables = restorePlaceables(project, snapshot.session.placeables);
  const spatial = restoreSpatialPlacementRecords(project, session, {
    farmBuildingPlacements: parseFarmBuildingPlacementRecord(snapshot.session.farmBuildingPlacements),
    homeDecorationPlacements: parseHomeDecorationPlacementRecord(snapshot.session.homeDecorationPlacements),
  });
  if (spatial.farmBuildingPlacements !== undefined) session.farmBuildingPlacements = spatial.farmBuildingPlacements;
  if (spatial.homeDecorationPlacements !== undefined) session.homeDecorationPlacements = spatial.homeDecorationPlacements;
  if (snapshot.session.followers) session.followers = structuredClone(snapshot.session.followers);
  if (snapshot.session.followerTrail) session.followerTrail = structuredClone(snapshot.session.followerTrail);
  session.currentMapId = snapshot.session.currentMapId;
  session.x = snapshot.session.x;
  session.y = snapshot.session.y;
  // 오버라이드는 **덮어쓰지 않고 지운다** — 세이브에 없으면 "저작값을 따르라"는 뜻이므로
  // 세션에 남아 있던 이전 오버라이드를 비워야 한다(조건부 대입이면 이전 값이 살아남는다).
  session.playerFootprint = snapshot.session.playerFootprint
    ? structuredClone(snapshot.session.playerFootprint)
    : undefined;
  session.playerPassRows = snapshot.session.playerPassRows;
  session.mapOverrides = structuredClone(snapshot.session.mapOverrides);
  session.flags = structuredClone(snapshot.session.flags);
  session.battleResult = snapshot.session.battleResult;
  session.audio = structuredClone(snapshot.session.audio);
  session.pictures = structuredClone(snapshot.session.pictures);
  if (snapshot.session.actorEquipment) session.actorEquipment = structuredClone(snapshot.session.actorEquipment);
  if (snapshot.session.actorRows) session.actorRows = structuredClone(snapshot.session.actorRows);
  if (snapshot.session.actorNames) session.actorNames = structuredClone(snapshot.session.actorNames);
  if (snapshot.session.actorNicknames) session.actorNicknames = structuredClone(snapshot.session.actorNicknames);
  if (snapshot.session.actorFaceResourceIds) session.actorFaceResourceIds = structuredClone(snapshot.session.actorFaceResourceIds);
  if (snapshot.session.actorCharacterResourceIds) session.actorCharacterResourceIds = structuredClone(snapshot.session.actorCharacterResourceIds);
  if (snapshot.session.classOverrides) session.classOverrides = structuredClone(snapshot.session.classOverrides);
  if (snapshot.session.actorParamBonuses) session.actorParamBonuses = structuredClone(snapshot.session.actorParamBonuses);
  if (snapshot.session.actorStateIds) session.actorStateIds = structuredClone(snapshot.session.actorStateIds);
  if (typeof snapshot.session.playTimeSeconds === "number") session.playTimeSeconds = snapshot.session.playTimeSeconds;
  const restoredGameTime = normalizeRestorableGameTime(project, snapshot.session.gameTime);
  if (restoredGameTime) session.gameTime = restoredGameTime;
  session.forageLastAdvancedDayKey = restoredGameTime
    && snapshot.session.forageLastAdvancedDayKey === calendarDayKey(restoredGameTime)
    ? snapshot.session.forageLastAdvancedDayKey
    : undefined;
  session.dayTransitionLastDayKey = restoredGameTime && isPreviousCalendarDayKey(
    project,
    restoredGameTime,
    snapshot.session.dayTransitionLastDayKey,
  )
    ? snapshot.session.dayTransitionLastDayKey
    : undefined;
  session.rng = normalizeRngState(snapshot.session.rng, session.rng?.seed);
  session.roguelikeRun = normalizeRoguelikeRunState(snapshot.session.roguelikeRun);
  if (snapshot.session.screen) applyScreenState(session, snapshot.session.screen);
  if (snapshot.session.access) {
    const runtime = ensureM2Runtime(session);
    runtime.access = { ...snapshot.session.access };
  }
  if (project.system.dailyWeather?.enabled === true) {
    const weather = session.gameTime
      ? applyDailyWeatherForDate(project, session, session.gameTime)
      : savedDailyWeather;
    session.dailyWeather = weather;
    if (weather) ensureM2Runtime(session).screen.weather = weatherToRuntimeString(weather);
  } else {
    // Authored daily weather and event-command screen weather are independent packages.
    // Disabling the former clears its HUD state but must not erase a saved setWeather effect.
    session.dailyWeather = undefined;
  }
  syncMonsterPartyFollowers(project, session);
  return session;
}

const P2_SESSION_RECORD_LIMIT = 2_000;

function sanitizeCollections(
  value: PlaySession["collections"] | unknown,
  knownItemIds?: ReadonlySet<string>,
): Record<string, CollectionProgress> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, CollectionProgress> = {};
  for (const [rawItemId, raw] of Object.entries(value).slice(0, P2_SESSION_RECORD_LIMIT)) {
    const itemId = rawItemId.trim();
    const progress = validProgress(raw);
    if (!itemId || !progress || (knownItemIds && !knownItemIds.has(itemId))) continue;
    if (!progress.discovered && progress.shippedCount === 0 && progress.caughtCount === 0 && !progress.donated) continue;
    result[itemId] = progress;
  }
  return result;
}

function sanitizeReceiptIds(value: readonly string[] | unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const raw of value.slice(0, P2_SESSION_RECORD_LIMIT)) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && !result.includes(id)) result.push(id);
  }
  return result;
}

function restorePlaceables(project: Project, value: PlaySession["placeables"] | unknown): Record<string, PlaceableObjectState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const result: Record<string, PlaceableObjectState> = {};
  for (const [key, raw] of Object.entries(value).slice(0, P2_SESSION_RECORD_LIMIT)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const candidate = raw as Record<string, any>;
    const mapId = typeof candidate.mapId === "string" ? candidate.mapId.trim() : "";
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const kind = typeof candidate.kind === "string" ? candidate.kind.trim() : "";
    const x = candidate.x;
    const y = candidate.y;
    const map = project.maps[mapId];
    if (!id || !kind || !map || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)
      || x < 0 || y < 0 || x >= map.width || y >= map.height || key !== placeableKey(mapId, x, y)) continue;
    const itemId = typeof candidate.itemId === "string" && itemIds.has(candidate.itemId) ? candidate.itemId : undefined;
    const base: PlaceableObjectState = { id, mapId, x, y, kind, ...(itemId ? { itemId } : {}) };
    const provenance = candidate.forageSpawn;
    if (provenance !== undefined) {
      if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) continue;
      const areaId = typeof provenance.areaId === "string" ? provenance.areaId.trim() : "";
      const entryId = typeof provenance.entryId === "string" ? provenance.entryId.trim() : "";
      const spawnedDayKey = parseCalendarDayKey(provenance.spawnedDayKey) ? provenance.spawnedDayKey as string : "";
      const area = project.system.seasonalForage?.areas.find((entry) => entry.id === areaId && entry.mapId === mapId);
      const entry = area?.entries.find((candidate) => candidate.id === entryId);
      const spawnedDate = parseCalendarDayKey(spawnedDayKey);
      const expectedItemId = entry && spawnedDate ? placeableDropItemId(entry, spawnedDate.season) : undefined;
      const inArea = Boolean(area && x >= area.area.x && y >= area.area.y
        && x < area.area.x + area.area.w && y < area.area.y + area.area.h);
      if (kind !== "forage" || !itemId || !area || !entry || !spawnedDate
        || spawnedDate.day > (resolveTimeSystem(project)?.daysPerSeason ?? 28)
        || itemId !== expectedItemId || !inArea) continue;
      result[key] = { ...base, forageSpawn: { areaId, entryId, spawnedDayKey } };
      continue;
    }
    result[key] = {
      ...base,
      ...(candidate.seasonalDrops && typeof candidate.seasonalDrops === "object" && !Array.isArray(candidate.seasonalDrops)
        ? { seasonalDrops: structuredClone(candidate.seasonalDrops) }
        : {}),
    };
  }
  return result;
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

/** 얼굴은 낱장 파일 한 장(리소스 id 하나)다. 그러나 예전 세이본은 (시트 id, 셀 번호) 짝을
 *  따로 직렬화해 넣었다 — 그 셀 번호를 버리면 오래된 세이본이 전부 칸 0 얼굴로 보이게 된다.
 *  그래서 로드 시에만 짝을 `faceIdForSheetCell` 로 섭어 낱장 id 하나로 바꾼다. 지금 시작하는
 *  세이본은 이 맵을 다시 생산하지 않는다(내보내는 쓸 리소스 id 자신이 이미 낱장이다). */
function parseActorFaceResourceIds(
  session: Record<string, unknown>,
): Record<string, string> | undefined {
  const ids = isStringRecord(session.actorFaceResourceIds) ? session.actorFaceResourceIds : undefined;
  if (!ids) return undefined;
  const legacyCells = isNumberRecord(session.actorFaceIndices) ? session.actorFaceIndices : undefined;
  if (!legacyCells) return ids;
  const mapped: Record<string, string> = {};
  for (const [actorId, resourceId] of Object.entries(ids)) {
    const cell = legacyCells[actorId];
    mapped[actorId] = cell === undefined ? resourceId : faceIdForSheetCell(resourceId, cell);
  }
  return mapped;
}

/**
 * 세이브의 주인공 몸 크기 오버라이드를 읽는다. 모양이 아니면 **undefined** 로 떨어뜨려
 * 저작값(system.playerFootprint)이 이기게 한다 — 손상된 세이브가 1x1 을 강요하면
 * 3x3 로 저작된 주인공이 조용히 작아진 채 벽을 지나간다.
 */
function parsePlayerFootprint(value: unknown): CharacterFootprint | undefined {
  if (!isRecord(value)) return undefined;
  const raw = value as { width?: unknown; height?: unknown };
  if (typeof raw.width !== "number" || typeof raw.height !== "number") return undefined;
  return normalizeCharacterFootprint(raw);
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
  if (session.monsterInstances !== undefined && !isMonsterInstancesRecord(session.monsterInstances)) {
    return { ok: false, message: "Invalid monster instances" };
  }
  if (session.monsterFieldPoisonSteps !== undefined && (
    typeof session.monsterFieldPoisonSteps !== "number"
    || !Number.isInteger(session.monsterFieldPoisonSteps)
    || session.monsterFieldPoisonSteps < 0
    || session.monsterFieldPoisonSteps > 3
  )) {
    return { ok: false, message: "Invalid monster field poison steps" };
  }
  const battleResult = parseBattleResult(session.battleResult);
  if (battleResult === "invalid") return { ok: false, message: "Invalid battle result" };
  const parsedOverrides = parseFactionStanceOverrides(session.factionStanceOverrides);
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
      factionStanceOverrides: Object.keys(parsedOverrides).length > 0 ? parsedOverrides : undefined,
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
      farmBuildingPlacements: parseFarmBuildingPlacementRecord(session.farmBuildingPlacements),
      homeDecorationPlacements: parseHomeDecorationPlacementRecord(session.homeDecorationPlacements),
      collections: sanitizeCollections(session.collections),
      museumRewardAppliedIds: sanitizeReceiptIds(session.museumRewardAppliedIds),
      forageLastAdvancedDayKey: parseCalendarDayKey(session.forageLastAdvancedDayKey)
        ? session.forageLastAdvancedDayKey as string
        : undefined,
      monsterInstances: isMonsterInstancesRecord(session.monsterInstances) ? session.monsterInstances : undefined,
      monsterParty: isStringArray(session.monsterParty) ? session.monsterParty : undefined,
      monsterBox: isStringArray(session.monsterBox) ? session.monsterBox : undefined,
      actorSkillIds: isActorSkillIdsRecord(session.actorSkillIds) ? session.actorSkillIds : undefined,
      actorSkillPp: isActorSkillPpRecord(session.actorSkillPp) ? session.actorSkillPp : undefined,
      actorBattleCommands: isActorSkillIdsRecord(session.actorBattleCommands) ? session.actorBattleCommands : undefined,
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
      monsterFieldPoisonSteps: typeof session.monsterFieldPoisonSteps === "number"
        ? session.monsterFieldPoisonSteps
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
      playerFootprint: parsePlayerFootprint(session.playerFootprint),
      playerPassRows: Number.isSafeInteger(session.playerPassRows) ? session.playerPassRows as number : undefined,
      mapOverrides: parseMapOverrides(session.mapOverrides),
      flags: session.flags,
      battleResult,
      audio: audio.value,
      pictures: parsePictures(session.pictures),
      actorEquipment: isActorEquipmentRecord(session.actorEquipment) ? session.actorEquipment : undefined,
      actorRows: isActorRowsRecord(session.actorRows) ? session.actorRows : undefined,
      actorNames: isStringRecord(session.actorNames) ? session.actorNames : undefined,
      actorNicknames: isStringRecord(session.actorNicknames) ? session.actorNicknames : undefined,
      actorFaceResourceIds: parseActorFaceResourceIds(session),
      actorCharacterResourceIds: isStringRecord(session.actorCharacterResourceIds) ? session.actorCharacterResourceIds : undefined,
      classOverrides: isStringRecord(session.classOverrides) ? session.classOverrides : undefined,
      actorParamBonuses: isActorParamBonusRecord(session.actorParamBonuses) ? session.actorParamBonuses : undefined,
      actorStateIds: isActorStateIdsRecord(session.actorStateIds) ? session.actorStateIds : undefined,
      playTimeSeconds: typeof session.playTimeSeconds === "number" ? Math.floor(session.playTimeSeconds) : undefined,
      gameTime: isGameTime(session.gameTime) ? structuredClone(session.gameTime) : undefined,
      rng: parseRngState(session.rng),
      roguelikeRun: normalizeRoguelikeRunState(session.roguelikeRun),
      screen: parseScreenState(session.screen),
      access: parseAccessState(session.access),
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

function parseAccessState(value: unknown): SaveSnapshot["session"]["access"] {
  if (!isRecord(value)) return undefined;
  const result: NonNullable<SaveSnapshot["session"]["access"]> = {};
  for (const key of ["escape", "menu", "save", "teleportation"] as const) {
    if (typeof value[key] === "boolean") result[key] = value[key];
  }
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
    project.system.farmAnimalBuildings,
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
