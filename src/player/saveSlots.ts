import { normalizeBattleReports, type BattleReport } from "@/project/battleReports";
import { isNeutralScreenFilter, normalizeScreenFilter } from "@/project/eventCommands/screenFilter";
import { LifeReconciliationError, parseLifeState, preserveUnresolvedLifeSource, reconcileLifeState } from "@/project/lifeRecovery";
import { isLocalSaveSourceKey, isSaveIdentity, publicationSaveKey, requireSaveIdentity, saveIdentity, saveIdentityBlocker, saveScopeBlocker, type SaveIdentity } from "./savePublication";
import { legacyExportSaveNamespace } from "./exportSaveNamespacePrefix";
import { PublicationError } from "../project/publication";
export { setSavePublication } from "./savePublication";
import { isDetectionEncounterCompletions } from '@/project/npcBehavior';
import { hasEquipmentSlot } from "@/project/equipmentSlots";
import { isHorrorState } from "@/project/horrorState";
import { isPromotionLineage } from '@/project/growth/requirements';
import { isGrowthProgress } from "@/project/growth/validation";
import { refreshGrowthVitals } from '@/project/growth/vitals';
import type { ActorInitialEquipment, CharacterFootprint, Project } from "@/project/types";
import { normalizeGalleryUnlocks } from "@/project/gallery";
import { currentChapterLabel } from "@/project/newGamePlus";
import { normalizeRelationships } from "@/project/relationshipState";
import { normalizeCharacterFootprint } from "@/project/footprint";
import {
  clampFriendship,
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
  sanitizeShopHaggleState,
  sanitizeShopShelf,
  sanitizeShopTradeCounts,
} from "@/project/economyValues";
import { syncMonsterPartyFollowers, syncPartyFollowers } from "@/project/followers";
import { normalizeMonsterInstanceBattleState } from "@/project/monsterCollection";
import type { ActorVitals } from "@/project/sessionVitals";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { SYSTEM_AUDIO_SLOTS, systemAudioOverrideKey } from "@/player/systemAudioSlots";
import {
  advanceGameDays,
  calendarDayKey,
  normalizeGameTime,
  resolveTimeSystem,
  type GameTime,
  type Season,
} from "@/project/gameTime";
import {
  isSystemAudioOverrides,
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
  isGameTime,
  isFarmPlotDate,
  isFarmPlotsRecord,
  isMonsterInstancesRecord,
  isNestedNumberRecord,
  isNumberRecord,
  isPictureRecord,
  isRecord,
  isRuntimeCameraState,
  isRuntimeEventLocationRecord,
  isRuntimeFollowerArray,
  isRuntimeFollowerTrail,
  isRuntimeNpcScheduleStateRecord,
  isRuntimeNpcTravelStateRecord,
  isLocationOccupancyRecord,
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
import { absoluteGameMinutes, syncMakersToGameTime } from "@/project/makers";
import { normalizeLightingState } from "@/project/lightingRules";
import { levelForXp, xpForLevel } from "@/project/skillModel";
import { cloneRngState, normalizeRngState, type RngState } from "@/util/rng";
import { normalizeRoguelikeRunState, type RoguelikeRunState } from "@/project/roguelikeRun";
import {
  normalizeDailyWeatherState,
} from "@/project/p1FoundationRecords";
import { applyDailyWeatherForDate } from "@/project/dailyWeather";
import { weatherToRuntimeString } from "@/player/weather/weatherModel";
import { validProgress, type CollectionProgress } from "@/project/collections";
import { placeableDropItemId, placeableKey, type PlaceableObjectState } from "@/project/placeables";
import { parseVehicleSessionState } from "@/project/vehicles";
export {
  createSystemShellState,
  reduceSystemShell,
  type SystemShellAction,
  type SystemShellScreen,
  type SystemShellState,
} from "@/player/systemShellState";

export const SAVE_SCHEMA_VERSION = 5;
export const SAVE_SLOT_COUNT = 3;
const SAVE_SLOT_PREFIX = "oprn:save-slot:v5:";
let saveSlotStorageNamespace: string | null = null;

export type SaveSlotIndex = 1 | 2 | 3;

/** 스냅샷 출처. 생략(구 세이브)은 수동 저장과 동일하게 취급한다. */
export type SaveOrigin = "manual" | "auto";
/** 오토세이브를 일으킨 트리거. 수동 저장에는 없다. */
export type AutosaveTrigger = "transfer" | "battleVictory";

export type SaveSnapshot = {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION | 6;
  readonly identity?: SaveIdentity;
  readonly projectTitle: string;
  readonly savedAt: string;
  readonly mapName?: string;
  readonly partyLevel?: number;
  /** 저장 당시 장(시대) 이름. system.chapter 가 없거나 이름표 없는 값이면 생략. */
  readonly chapterLabel?: string;
  readonly playTimeSeconds?: number;
  /** Optional metadata shared by supported Save4 and Save5 snapshots. */
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
    readonly shopMerchantGold?: PlaySession["shopMerchantGold"];
    readonly shopHaggleState?: PlaySession["shopHaggleState"];
    readonly shopReputation?: PlaySession["shopReputation"];
    readonly shopShelf?: PlaySession["shopShelf"];
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
    readonly lifeRecovery?: PlaySession["lifeRecovery"];
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
    readonly actorTechPoints?: Record<string, number>;
    readonly actorLevels?: Record<string, number>;
    readonly actorVitals?: Record<string, ActorVitals>;
    readonly horror?: PlaySession["horror"];
    readonly detectionEncounterCompletions?: PlaySession["detectionEncounterCompletions"];
    readonly eventLocations?: PlaySession["eventLocations"];
    readonly erasedEventIds?: readonly string[];
    /** 구역 드나듦 트리거의 점유 기록. 없으면 불러온 뒤 기준선만 심긴다(셡 세이부 호환). */
    readonly occupiedLocationIds?: PlaySession["occupiedLocationIds"];
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
    readonly relationships?: PlaySession["relationships"];
    readonly galleryUnlocks?: PlaySession["galleryUnlocks"];
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
    readonly vehicle?: PlaySession["vehicle"];
    readonly currentMapId: string;
    readonly x: number;
    readonly y: number;
    readonly playerFootprint?: PlaySession["playerFootprint"];
    readonly playerPassRows?: PlaySession["playerPassRows"];
    readonly mapOverrides: PlaySession["mapOverrides"];
    readonly flags: Record<string, boolean>;
    readonly battleResult?: PlaySession["battleResult"];
    readonly audio: AudioCommandState;
    readonly systemAudioOverrides?: PlaySession["systemAudioOverrides"];
    readonly pictures: Record<string, PictureState>;
    readonly actorEquipment?: Record<string, ActorInitialEquipment>;
    readonly battleReports?: BattleReport[];
    readonly actorRows?: Record<string, "front" | "back">;
    readonly actorNames?: Record<string, string>;
    readonly actorNicknames?: PlaySession["actorNicknames"];
    readonly actorFaceResourceIds?: PlaySession["actorFaceResourceIds"];
    readonly actorCharacterResourceIds?: Record<string, string>;
    readonly growthProgress?: PlaySession["growthProgress"];
    readonly promotionLineage?: PlaySession["promotionLineage"];
    readonly classOverrides?: Record<string, string>;
    readonly actorParamBonuses?: PlaySession["actorParamBonuses"];
    readonly actorStateIds?: PlaySession["actorStateIds"];
    readonly stringVariables?: Record<string, string>;
    readonly playerFacing?: PlaySession["playerFacing"];
    readonly stepCount?: number;
    readonly stateStepCounts?: Record<string, Record<string, number>>;
    readonly highScores?: Record<string, number>;
    readonly teleportPoints?: PlaySession["teleportPoints"];
    readonly playTimeSeconds?: number;
    readonly gameTime?: PlaySession["gameTime"];
    readonly rng?: RngState;
    readonly roguelikeRun?: RoguelikeRunState;
    readonly difficultyId?: string;
    readonly retiredMonsterInstanceSeq?: number;
    readonly partySets?: PlaySession["partySets"];
    readonly activePartySetId?: string;
    readonly actorSkillLoadouts?: PlaySession["actorSkillLoadouts"];
    // 화면 색조/날씨/숨김 상태(m2Runtime.screen 의 지속형 효과). 세이브 복원 대상.
    readonly screen?: SaveScreenState;
    // Change Save Access 등 접근 플래그(m2Runtime.access). 세이브 복원 대상.
    readonly access?: Partial<Record<"escape" | "menu" | "save" | "teleportation", boolean>>;
    readonly systemAudio?: Record<string, string>;
  };
};

export type SaveScreenState = {
  readonly tint?: string;
  readonly weather?: string;
  readonly hidden?: boolean;
  readonly tintDurationMs?: number;
  /** Tint Screen 색 필터(채도·흑백·세피아). 없으면 필터 없음. */
  readonly filter?: { readonly saturation: number; readonly grayscale: number; readonly sepia: number };
};

export type SaveWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export type SaveSlotReadResult =
  | { readonly kind: "empty"; readonly slot: SaveSlotIndex }
  | { readonly kind: "corrupt"; readonly slot: SaveSlotIndex; readonly message: string }
  | { readonly kind: "present"; readonly slot: SaveSlotIndex; readonly snapshot: SaveSnapshot };

export function saveSlotKey(slot: SaveSlotIndex): string {
  const pinned = publicationSaveKey(slot);
  if (pinned) return pinned;
  if (saveSlotStorageNamespace) return `${saveSlotStorageNamespace}:save-slot:v5:${slot}`;
  return `${SAVE_SLOT_PREFIX}${slot}`;
}

/** 전용 오토세이브 키 — 수동 3슬롯(SaveSlotIndex)과 완전히 분리된 별도 칸. */
export function autosaveKey(): string {
  const pinned = publicationSaveKey("auto");
  if (pinned) return pinned;
  if (saveSlotStorageNamespace) return `${saveSlotStorageNamespace}:save-slot:v5:auto`;
  return `${SAVE_SLOT_PREFIX}auto`;
}

export type AutosaveReadResult =
  | { readonly kind: "empty" }
  | { readonly kind: "corrupt"; readonly message: string }
  | { readonly kind: "present"; readonly snapshot: SaveSnapshot };

function legacySaveKey(slot: SaveSlotIndex | "auto"): string {
  return `${saveSlotStorageNamespace ?? "oprn"}:save-slot:${slot}`;
}

/** 클리어 기록(강하게 다시 하기) 키 — 세이브와 같은 게임별 네임스페이스를 쓴다. */
export function clearRecordKey(): string {
  const pinned = publicationSaveKey("auto");
  if (pinned) return pinned.replace(/:save-slot:v6:auto$/u, ":clear-record:v1");
  return `${saveSlotStorageNamespace ?? "oprn"}:clear-record:v1`;
}

export function writeAutosave(storage: Storage, snapshot: SaveSnapshot): void {
  if (saveScopeBlocker(snapshot.identity)) throw new PublicationError("save-incompatible");
  storage.setItem(autosaveKey(), JSON.stringify(snapshot));
}

export function readAutosave(storage: Storage): AutosaveReadResult {
  const text = storage.getItem(autosaveKey()) ?? (publicationSaveKey("auto") ? null : storage.getItem(legacySaveKey("auto")));
  if (text === null) return { kind: "empty" };
  let value: unknown;
  try {
    value = parseUniqueSaveJson(text);
  } catch (error) {
    return { kind: "corrupt", message: error instanceof Error ? error.message : "Invalid save data" };
  }
  const parsed = parseSnapshotValue(value);
  if (!parsed.ok) return { kind: "corrupt", message: parsed.message };
  const blocker = saveScopeBlocker(parsed.snapshot.identity);
  if (blocker) return { kind: "corrupt", message: blocker };
  return { kind: "present", snapshot: parsed.snapshot };
}

export function setSaveSlotStorageNamespace(namespace: string | null): void {
  saveSlotStorageNamespace = namespace?.trim() || null;
}

/** 한 네임스페이스 아래에 있을 수 있는 세이브 키 접미사 전부 — 수동 3슬롯·오토세이브의 v5 키와 그 이전(v4) 키. */
const NAMESPACED_SAVE_KEY_SUFFIXES: readonly string[] = [
  ...([1, 2, 3] as const).flatMap((slot) => [`:save-slot:v5:${slot}`, `:save-slot:${slot}`]),
  ":save-slot:v5:auto",
  ":save-slot:auto",
];

/**
 * 2026-09 제품명 스윕 전(`rpgzzu-export:<id>`)에 저장된 세이브를 새 네임스페이스(`oprn-export:<id>`)로 **복사**한다.
 * 플레이어 브라우저의 localStorage 는 우리가 마이그레이션해 줄 수 없는 저장소 밖 상태라 첫 부팅에서 입양한다.
 *
 * - 새 네임스페이스에 키가 하나라도 있으면 아무것도 하지 않는다(이미 새 이름으로 플레이 중인 사람의 세이브를 덮지 않는다).
 * - 이 게임의 고정된 키 8개만 본다. localStorage 를 훑지 않는다 — 커뮤니티에서는 다른 리스팅의 저장소를 건드리면 안 된다.
 * - 옛 키는 지우지 않는다(이전 릴리스 플레이어로 돌아가도 세이브가 있어야 한다).
 * - 대응하는 옛 접두사가 없는 네임스페이스(호스트가 주입한 임의 값)는 건드리지 않는다.
 * 반환값은 복사한 키 수.
 */
export function adoptLegacyExportSaves(storage: Storage, namespace: string): number {
  const legacyNamespace = legacyExportSaveNamespace(namespace);
  if (!legacyNamespace) return 0;
  if (NAMESPACED_SAVE_KEY_SUFFIXES.some((suffix) => storage.getItem(`${namespace}${suffix}`) !== null)) return 0;
  let copied = 0;
  for (const suffix of NAMESPACED_SAVE_KEY_SUFFIXES) {
    const value = storage.getItem(`${legacyNamespace}${suffix}`);
    if (value === null) continue;
    storage.setItem(`${namespace}${suffix}`, value);
    copied += 1;
  }
  return copied;
}

export function createSaveSnapshot(project: Project, input: PlaySession): SaveSnapshot {
  const session = prepareLifeSnapshot(project, input);
  const normalizedItems = normalizeItemTransitionState(session, project.database.items);
  const bundleReceiptIds = normalizedBundleReceiptIds(session.completedBundleIds, session.bundleRewardAppliedIds);
  return {
    schemaVersion: project.meta.publication ? 6 : SAVE_SCHEMA_VERSION,
    ...(project.meta.publication ? { identity: saveIdentity(project.meta.publication) } : {}),
    projectTitle: project.meta.title,
    savedAt: new Date().toISOString(),
    mapName: project.maps[session.currentMapId]?.name ?? "",
    partyLevel: leadPartyLevel(project, session),
    ...(() => {
      const chapterLabel = currentChapterLabel(project, session);
      return chapterLabel ? { chapterLabel } : {};
    })(),
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
      shopMerchantGold: sanitizeEconomyRecord(session.shopMerchantGold),
      shopHaggleState: sanitizeShopHaggleState(session.shopHaggleState),
      shopReputation: sanitizeEconomyRecord(session.shopReputation),
      shopShelf: sanitizeShopShelf(session.shopShelf),
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
      makerInstances: structuredClone(session.makerInstances ?? {}),
      lifeRecovery: structuredClone(session.lifeRecovery),
      dailyWeather: project.system.dailyWeather?.enabled === true
        ? structuredClone(normalizeDailyWeatherState(session.dailyWeather))
        : undefined,
      farmAnimals: structuredClone(session.farmAnimals),
      farmBuildingPlacements: structuredClone(session.farmBuildingPlacements),
      homeDecorationPlacements: structuredClone(session.homeDecorationPlacements),
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
      ...(session.actorTechPoints && Object.keys(session.actorTechPoints).length > 0 ? { actorTechPoints: structuredClone(session.actorTechPoints) } : {}),
      actorLevels: structuredClone(session.actorLevels),
      actorVitals: structuredClone(session.actorVitals),
      horror: session.horror ? structuredClone(session.horror) : undefined,
      detectionEncounterCompletions: structuredClone(session.detectionEncounterCompletions),
      eventLocations: structuredClone(session.eventLocations),
      erasedEventIds: structuredClone(session.erasedEventIds),
      occupiedLocationIds: structuredClone(session.occupiedLocationIds),
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
      relationships: structuredClone(session.relationships ?? {}),
      galleryUnlocks: normalizeGalleryUnlocks(session.galleryUnlocks),
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
      ...(session.vehicle ? { vehicle: structuredClone(session.vehicle) } : {}),
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
      systemAudioOverrides: structuredClone(session.systemAudioOverrides),
      pictures: structuredClone(session.pictures),
      actorEquipment: structuredClone(session.actorEquipment),
      battleReports: normalizeBattleReports(session.battleReports),
      actorRows: structuredClone(session.actorRows),
      actorNames: structuredClone(session.actorNames),
      actorNicknames: structuredClone(session.actorNicknames),
      actorFaceResourceIds: structuredClone(session.actorFaceResourceIds),
      actorCharacterResourceIds: structuredClone(session.actorCharacterResourceIds),
      growthProgress: structuredClone(session.growthProgress),
      promotionLineage: structuredClone(session.promotionLineage),
      classOverrides: structuredClone(session.classOverrides),
      actorParamBonuses: structuredClone(session.actorParamBonuses),
      actorStateIds: structuredClone(session.actorStateIds),
      ...(session.stringVariables && Object.keys(session.stringVariables).length > 0 ? { stringVariables: { ...session.stringVariables } } : {}),
      ...(session.playerFacing ? { playerFacing: session.playerFacing } : {}),
      ...(session.stepCount ? { stepCount: Math.floor(session.stepCount) } : {}),
      ...(session.stateStepCounts && Object.keys(session.stateStepCounts).length > 0 ? { stateStepCounts: structuredClone(session.stateStepCounts) } : {}),
      ...(session.highScores && Object.keys(session.highScores).length > 0 ? { highScores: { ...session.highScores } } : {}),
      ...(session.teleportPoints && session.teleportPoints.length > 0 ? { teleportPoints: structuredClone(session.teleportPoints) } : {}),
      playTimeSeconds: Math.floor(session.playTimeSeconds ?? 0),
      gameTime: structuredClone(normalizeRestorableGameTime(project, session.gameTime)),
      rng: cloneRngState(normalizeRngState(session.rng)),
      roguelikeRun: structuredClone(session.roguelikeRun),
      ...(session.difficultyId ? { difficultyId: session.difficultyId } : {}),
      ...(session.retiredMonsterInstanceSeq ? { retiredMonsterInstanceSeq: session.retiredMonsterInstanceSeq } : {}),
      ...(session.partySets && Object.keys(session.partySets).length > 0 ? { partySets: structuredClone(session.partySets) } : {}),
      ...(session.activePartySetId ? { activePartySetId: session.activePartySetId } : {}),
      ...(session.actorSkillLoadouts && Object.keys(session.actorSkillLoadouts).length > 0 ? { actorSkillLoadouts: structuredClone(session.actorSkillLoadouts) } : {}),
      screen: pickScreenState(session),
      systemAudio: parseSystemAudioState(session.m2Runtime?.system),
      access: session.m2Runtime?.access && Object.keys(session.m2Runtime.access).length > 0 ? { ...session.m2Runtime.access } : undefined,
    },
  };
}

// 지속형 화면 효과(색조/날씨/숨김)만 추려 세이브에 담는다. 값이 전혀 없으면 생략.
function pickScreenState(session: PlaySession): SaveScreenState | undefined {
  const screen = session.m2Runtime?.screen;
  if (!screen) return undefined;
  const { tint, weather, hidden, tintDurationMs, filter } = screen;
  if (tint === undefined && weather === undefined && hidden === undefined && tintDurationMs === undefined && filter === undefined) {
    return undefined;
  }
  return { tint, weather, hidden, tintDurationMs, ...(filter ? { filter: { ...filter } } : {}) };
}

// 저장 실패(quota 초과·프라이빗 모드)를 던지면 호출부의 클릭 핸들러가 그대로 끊겨
// 성공도 실패도 표시되지 않았다. 오토세이브(performAutosave)와 같은 계약으로 결과를 돌려준다.
export function saveToSlot(storage: Storage, slot: SaveSlotIndex, snapshot: SaveSnapshot): SaveWriteResult {
  const blocker = saveScopeBlocker(snapshot.identity);
  if (blocker) return { ok: false, message: blocker };
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
  const identityBlocker = saveScopeBlocker(snapshot.identity) ?? saveIdentityBlocker(project.meta.publication, snapshot.identity);
  if (identityBlocker) return identityBlocker;
  if (!project.maps[snapshot.session.currentMapId]) return "저장 당시의 맵이 이 프로젝트에 없습니다";
  for (const equipment of Object.values(snapshot.session.actorEquipment ?? {})) {
    if (Object.keys(equipment).some((slot) => !hasEquipmentSlot(project, slot))) return "저장 당시의 장비 부위가 이 프로젝트에 없습니다";
  }
  return null;
}

export function readSaveSlot(storage: Storage, slot: SaveSlotIndex): SaveSlotReadResult {
  const text = storage.getItem(saveSlotKey(slot)) ?? (publicationSaveKey(slot) ? null : storage.getItem(legacySaveKey(slot)));
  if (text === null) return { kind: "empty", slot };
  let value: unknown;
  try {
    value = parseUniqueSaveJson(text);
  } catch (error) {
    return {
      kind: "corrupt",
      slot,
      message: error instanceof Error ? error.message : "Invalid save data",
    };
  }
  const parsed = parseSaveSnapshot(value, slot);
  const blocker = parsed.kind === "present" ? saveScopeBlocker(parsed.snapshot.identity) : null;
  return blocker ? { kind: "corrupt", slot, message: blocker } : parsed;
}

/** 가장 최근 저장 — 수동 슬롯과 자동 저장 중 savedAt 이 가장 늦은 것. 없으면 undefined. */
export type LatestSave =
  | { readonly source: "autosave"; readonly snapshot: SaveSnapshot }
  | { readonly source: "slot"; readonly slot: SaveSlotIndex; readonly snapshot: SaveSnapshot };

export function readLatestSave(storage: Storage): LatestSave | undefined {
  const candidates: LatestSave[] = [];
  for (const result of listSaveSlots(storage)) {
    if (result.kind === "present") candidates.push({ source: "slot", slot: result.slot, snapshot: result.snapshot });
  }
  const auto = readAutosave(storage);
  if (auto.kind === "present") candidates.push({ source: "autosave", snapshot: auto.snapshot });
  let latest: LatestSave | undefined;
  for (const candidate of candidates) {
    if (!latest || Date.parse(candidate.snapshot.savedAt) > Date.parse(latest.snapshot.savedAt)) latest = candidate;
  }
  return latest;
}

/**
 * 「시작하면 바로 이어하기」가 불러올 저장 — 켜져 있고, 가장 최근 저장이 이 프로젝트에서 불러올 수 있을 때만.
 * 그 밖에는 undefined(타이틀을 보여 준다).
 */
export function latestResumableSave(project: Project, storage: Storage): LatestSave | undefined {
  if (project.system.titleScreen?.resumeOnLaunch !== true) return undefined;
  const latest = readLatestSave(storage);
  if (!latest || snapshotLoadBlocker(project, latest.snapshot) !== null) return undefined;
  return latest;
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

export function applySaveSnapshot(project: Project, input: SaveSnapshot): PlaySession {
  requireSaveIdentity(project.meta.publication, input.identity);
  const parsed = parseSnapshotValue(input);
  if (!parsed.ok) throw new LifeReconciliationError("snapshot", "session", parsed.message);
  const snapshot = { ...input, session: { ...input.session, ...parseLifeState(input.session) } };
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
  session.shopMerchantGold = sanitizeEconomyRecord(snapshot.session.shopMerchantGold);
  session.shopHaggleState = sanitizeShopHaggleState(snapshot.session.shopHaggleState);
  session.shopReputation = sanitizeEconomyRecord(snapshot.session.shopReputation);
  session.shopShelf = sanitizeShopShelf(snapshot.session.shopShelf);
  if (typeof snapshot.session.energy === "number") session.energy = snapshot.session.energy;
  const shippingEnabled = project.system.shipping?.enabled === true;
  session.shippingQueue = structuredClone(snapshot.session.shippingQueue ?? {});
  session.shippingLastSettledDayKey = shippingEnabled ? snapshot.session.shippingLastSettledDayKey : undefined;
  session.shippingHistory = shippingEnabled
    ? structuredClone((snapshot.session.shippingHistory ?? []).slice(-shippingHistoryLimit(project)))
    : [];
  session.bundleContributions = structuredClone(snapshot.session.bundleContributions ?? {});
  const bundleReceiptIds = normalizedBundleReceiptIds(
    snapshot.session.completedBundleIds,
    snapshot.session.bundleRewardAppliedIds,
  );
  session.completedBundleIds = bundleReceiptIds;
  session.bundleRewardAppliedIds = [...bundleReceiptIds];
  session.unlockedRegionIds = uniqueStrings(snapshot.session.unlockedRegionIds);
  session.unlockedRecipeIds = uniqueStrings(snapshot.session.unlockedRecipeIds);
  session.makerInstances = structuredClone(snapshot.session.makerInstances ?? {});
  session.lifeRecovery = structuredClone(snapshot.session.lifeRecovery);
  const savedDailyWeather = project.system.dailyWeather?.enabled === true
    ? normalizeDailyWeatherState(snapshot.session.dailyWeather)
    : undefined;
  session.dailyWeather = savedDailyWeather;
  if (snapshot.session.farmAnimals !== undefined) session.farmAnimals = structuredClone(snapshot.session.farmAnimals);
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
  if (snapshot.session.actorTechPoints) session.actorTechPoints = structuredClone(snapshot.session.actorTechPoints);
  if (snapshot.session.actorLevels) session.actorLevels = structuredClone(snapshot.session.actorLevels);
  if (snapshot.session.actorVitals) session.actorVitals = structuredClone(snapshot.session.actorVitals);
  if (snapshot.session.horror) session.horror = structuredClone(snapshot.session.horror);
  session.detectionEncounterCompletions = structuredClone(snapshot.session.detectionEncounterCompletions);
  if (snapshot.session.eventLocations) session.eventLocations = structuredClone(snapshot.session.eventLocations);
  if (snapshot.session.erasedEventIds) session.erasedEventIds = [...snapshot.session.erasedEventIds];
  // 없으면 **지우지 않고 그대로 둔다**: 재생 직전의 기록이 남아 있는 편이,
  // 불러오기 뒤 PlayScene 이 기준선을 다시 심는 경로와 같이 동작하며 안전하다.
  if (snapshot.session.occupiedLocationIds) session.occupiedLocationIds = structuredClone(snapshot.session.occupiedLocationIds);
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
  session.relationships = normalizeRelationships(snapshot.session.relationships) ?? {};
  const galleryUnlocks = normalizeGalleryUnlocks(snapshot.session.galleryUnlocks);
  if (galleryUnlocks) session.galleryUnlocks = galleryUnlocks;
  else delete session.galleryUnlocks;
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
  if (snapshot.session.placeables) session.placeables = structuredClone(snapshot.session.placeables);
  if (snapshot.session.farmBuildingPlacements !== undefined) session.farmBuildingPlacements = structuredClone(snapshot.session.farmBuildingPlacements);
  if (snapshot.session.homeDecorationPlacements !== undefined) session.homeDecorationPlacements = structuredClone(snapshot.session.homeDecorationPlacements);
  if (snapshot.session.followers) session.followers = structuredClone(snapshot.session.followers);
  if (snapshot.session.followerTrail) session.followerTrail = structuredClone(snapshot.session.followerTrail);
  // 세이브에 없으면 걷는 상태다 — 이전 세션의 탑승을 끌고 오지 않는다.
  if (snapshot.session.vehicle) session.vehicle = structuredClone(snapshot.session.vehicle);
  else delete session.vehicle;
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
  session.systemAudioOverrides = structuredClone(snapshot.session.systemAudioOverrides);
  session.pictures = structuredClone(snapshot.session.pictures);
  if (snapshot.session.actorEquipment) session.actorEquipment = structuredClone(snapshot.session.actorEquipment);
  session.battleReports = normalizeBattleReports(snapshot.session.battleReports);
  if (snapshot.session.actorRows) session.actorRows = structuredClone(snapshot.session.actorRows);
  if (snapshot.session.actorNames) session.actorNames = structuredClone(snapshot.session.actorNames);
  if (snapshot.session.actorNicknames) session.actorNicknames = structuredClone(snapshot.session.actorNicknames);
  if (snapshot.session.actorFaceResourceIds) session.actorFaceResourceIds = structuredClone(snapshot.session.actorFaceResourceIds);
  if (snapshot.session.actorCharacterResourceIds) session.actorCharacterResourceIds = structuredClone(snapshot.session.actorCharacterResourceIds);
  if (snapshot.session.growthProgress) session.growthProgress = structuredClone(snapshot.session.growthProgress);
  if (snapshot.session.promotionLineage) session.promotionLineage = structuredClone(snapshot.session.promotionLineage);
  if (snapshot.session.classOverrides) session.classOverrides = structuredClone(snapshot.session.classOverrides);
  if (snapshot.session.actorParamBonuses) session.actorParamBonuses = structuredClone(snapshot.session.actorParamBonuses);
  // Authored curves/nodes may have changed since saving. Keep the historical
  // investment ledger, but project current maxima only after every bonus restores.
  for (const actor of project.database.actors) refreshGrowthVitals(project, session, actor.id);
  if (snapshot.session.actorStateIds) session.actorStateIds = structuredClone(snapshot.session.actorStateIds);
  if (snapshot.session.stringVariables) session.stringVariables = { ...snapshot.session.stringVariables };
  if (snapshot.session.playerFacing) session.playerFacing = snapshot.session.playerFacing;
  if (typeof snapshot.session.stepCount === "number") session.stepCount = snapshot.session.stepCount;
  if (snapshot.session.stateStepCounts) session.stateStepCounts = structuredClone(snapshot.session.stateStepCounts);
  if (snapshot.session.highScores) session.highScores = { ...snapshot.session.highScores };
  if (snapshot.session.teleportPoints) session.teleportPoints = structuredClone(snapshot.session.teleportPoints);
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
  // 난이도 없는 옛 세이브는 새 세션 기본값(startSession 이 심은 값)을 그대로 쓴다.
  if (snapshot.session.difficultyId) session.difficultyId = snapshot.session.difficultyId;
  if (snapshot.session.retiredMonsterInstanceSeq) session.retiredMonsterInstanceSeq = snapshot.session.retiredMonsterInstanceSeq;
  else delete session.retiredMonsterInstanceSeq;
  if (snapshot.session.partySets) session.partySets = structuredClone(snapshot.session.partySets);
  else delete session.partySets;
  if (snapshot.session.activePartySetId) session.activePartySetId = snapshot.session.activePartySetId;
  else delete session.activePartySetId;
  if (snapshot.session.actorSkillLoadouts) session.actorSkillLoadouts = structuredClone(snapshot.session.actorSkillLoadouts);
  else delete session.actorSkillLoadouts;
  if (snapshot.session.screen) applyScreenState(session, snapshot.session.screen);
  if (snapshot.session.systemAudio) Object.assign(ensureM2Runtime(session).system, snapshot.session.systemAudio);
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
  // Cancellation is evaluated using the saved date in each job's original clock, before normalizing to the new calendar.
  const savedTime = session.gameTime;
  if (snapshot.session.gameTime) session.gameTime = structuredClone(snapshot.session.gameTime);
  const reconciled = prepareLifeSnapshot(project, session);
  reconciled.gameTime = savedTime;
  if (reconciled.gameTime) {
    const makers = syncMakersToGameTime(project, reconciled);
    if (!makers.ok && makers.reason !== "disabled") throw new LifeReconciliationError("makerInstances", makers.instanceId ?? "makers", makers.reason);
  }
  syncMonsterPartyFollowers(project, reconciled);
  syncPartyFollowers(project, reconciled);
  return reconciled;
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
  const fields = new Set(["id", "mapId", "x", "y", "kind", "itemId", "seasonalDrops", "forageSpawn"]);
  for (const [key, raw] of Object.entries(value).slice(0, P2_SESSION_RECORD_LIMIT)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    // A recognizable prefix is not proof that opaque legacy job/payment fields can be discarded.
    // Leave the entire source for prepareLifeSnapshot to quarantine without inferred payouts.
    if (Object.keys(raw).some((field) => !fields.has(field))) continue;
    const candidate = raw as Record<string, any>;
    const mapId = typeof candidate.mapId === "string" ? candidate.mapId.trim() : "";
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const kind = typeof candidate.kind === "string" ? candidate.kind.trim() : "";
    const x = candidate.x;
    const y = candidate.y;
    const map = project.maps[mapId];
    if (!id || !kind || !map || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)
      || x < 0 || y < 0 || x >= map.width || y >= map.height || key !== placeableKey(mapId, x, y)) continue;
    if (candidate.itemId !== undefined && (typeof candidate.itemId !== "string" || !itemIds.has(candidate.itemId))) continue;
    const itemId = typeof candidate.itemId === "string" ? candidate.itemId : undefined;
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
  if (screen.filter !== undefined) runtime.screen.filter = { ...screen.filter };
}

function parseSaveSnapshot(value: unknown, slot: SaveSlotIndex): SaveSlotReadResult {
  const parsed = parseSnapshotValue(value);
  if (!parsed.ok) return corrupt(slot, parsed.message);
  return { kind: "present", slot, snapshot: parsed.snapshot };
}

type ParsedSnapshotResult =
  | { readonly ok: true; readonly snapshot: SaveSnapshot }
  | { readonly ok: false; readonly message: string };

// Save4 migrates in memory; Save5 is intentionally unreadable by the previous reader.
function parseSnapshotValue(value: unknown): ParsedSnapshotResult {
  if (!isRecord(value)) return { ok: false, message: "Save slot is not an object" };
  if (value.schemaVersion !== 4 && value.schemaVersion !== 5 && value.schemaVersion !== 6) return { ok: false, message: "Unsupported save schema" };
  if (value.schemaVersion === 6 ? !isSaveIdentity(value.identity) : value.identity !== undefined) return { ok: false, message: "Unsupported save schema" };
  if (typeof value.projectTitle !== "string") return { ok: false, message: "Missing project title" };
  if (typeof value.savedAt !== "string") return { ok: false, message: "Missing saved time" };
  if (!isRecord(value.session)) return { ok: false, message: "Missing session" };
  const parsed = parseSessionRecord(value.session);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  return {
    ok: true,
    snapshot: {
      schemaVersion: value.schemaVersion === 6 ? 6 : SAVE_SCHEMA_VERSION,
      ...(isSaveIdentity(value.identity) ? { identity: value.identity } : {}),
      projectTitle: value.projectTitle,
      savedAt: value.savedAt,
      mapName: typeof value.mapName === "string" ? value.mapName : undefined,
      partyLevel: typeof value.partyLevel === "number" ? Math.floor(value.partyLevel) : undefined,
      ...(typeof value.chapterLabel === "string" && value.chapterLabel ? { chapterLabel: value.chapterLabel } : {}),
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

/** Explicit copy only: never enumerates storage and never rewrites the source. */
export function importSaveCopy(options: {
  readonly project: Project;
  readonly storage: Storage;
  readonly sourceKey: string;
  readonly slot: SaveSlotIndex;
  readonly adoptLegacy?: boolean;
}): void {
  const { project, storage, sourceKey, slot } = options;
  const publication = project.meta.publication;
  if (!publication) throw new PublicationError("save-incompatible");
  if (!isLocalSaveSourceKey(sourceKey, publication, options.adoptLegacy === true)) throw new PublicationError("save-incompatible");
  const target = publicationSaveKey(slot, publication);
  if (!target || sourceKey === target || storage.getItem(target) !== null) throw new PublicationError("save-incompatible");
  const raw = storage.getItem(sourceKey);
  if (raw === null) throw new PublicationError("save-incompatible");
  const parsed = parseSnapshotValue(parseUniqueSaveJson(raw));
  if (!parsed.ok) throw new PublicationError("save-incompatible");
  const source = parsed.snapshot;
  const adopted = !source.identity && options.adoptLegacy === true
    ? { ...source, schemaVersion: 6 as const, identity: saveIdentity(publication) } : source;
  if (snapshotLoadBlocker(project, adopted)) throw new PublicationError("save-incompatible");
  const restored = applySaveSnapshot(project, adopted);
  const copy = createSaveSnapshot(project, restored);
  storage.setItem(target, JSON.stringify(copy));
}

/** Only call with bytes from a file the PLAYER selected, never uploader metadata or discovered storage. */
export function importSelectedSaveFileCopy(options: {
  readonly project: Project;
  readonly storage: Storage;
  readonly text: string;
  readonly slot: SaveSlotIndex;
}): void {
  const { project, storage, text, slot } = options;
  const publication = project.meta.publication;
  if (!publication) throw new PublicationError("save-incompatible");
  const target = publicationSaveKey(slot, publication);
  if (!target || storage.getItem(target) !== null) throw new PublicationError("save-incompatible");
  const parsed = parseSnapshotValue(parseUniqueSaveJson(text));
  if (!parsed.ok || !parsed.snapshot.identity || saveIdentityBlocker(publication, parsed.snapshot.identity)) throw new PublicationError("save-incompatible");
  // Explicit file selection permits scope transfer, not game/lineage incompatibility.
  const adopted = { ...parsed.snapshot, identity: saveIdentity(publication) };
  if (snapshotLoadBlocker(project, adopted)) throw new PublicationError("save-incompatible");
  const copy = createSaveSnapshot(project, applySaveSnapshot(project, adopted));
  storage.setItem(target, JSON.stringify(copy));
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
  if (session.growthProgress !== undefined && !isGrowthProgress(session.growthProgress)) return { ok: false, message: 'Invalid growth progress' };
  if (session.promotionLineage !== undefined && !isPromotionLineage(session.promotionLineage)) return { ok: false, message: 'Invalid promotion lineage' };
  let life: ReturnType<typeof parseLifeState>;
  try {
    life = parseLifeState(session);
    assertSavedMakerClock(session.gameTime, life.makerInstances);
  }
  catch (error) {
    if (!(error instanceof LifeReconciliationError)) throw error;
    return { ok: false, message: error.message };
  }
  if (session.detectionEncounterCompletions !== undefined && !isDetectionEncounterCompletions(session.detectionEncounterCompletions)) {
    return { ok: false, message: "Invalid detection completion state" };
  }
  if (session.horror !== undefined && !isHorrorState(session.horror)) {
    return { ok: false, message: "Invalid pursuit state" };
  }
  if (session.actorEquipment !== undefined && !isActorEquipmentRecord(session.actorEquipment)) {
    return { ok: false, message: "Invalid actor equipment" };
  }
  if (!isBooleanRecord(session.switches)) return { ok: false, message: "Invalid switches" };
  if (!isNumberRecord(session.variables)) return { ok: false, message: "Invalid variables" };
  if (!isNumberRecord(session.timers)) return { ok: false, message: "Invalid timers" };
  if (typeof session.currentMapId !== "string") return { ok: false, message: "Invalid map" };
  if (typeof session.x !== "number") return { ok: false, message: "Invalid x" };
  if (typeof session.y !== "number") return { ok: false, message: "Invalid y" };
  if (!isRecord(session.mapOverrides)) return { ok: false, message: "Invalid map overrides" };
  if (!isBooleanRecord(session.flags)) return { ok: false, message: "Invalid flags" };
  if (!isRecord(session.audio)) return { ok: false, message: "Invalid audio" };
  if (session.systemAudioOverrides !== undefined && !isSystemAudioOverrides(session.systemAudioOverrides)) {
    return { ok: false, message: "Invalid system audio overrides" };
  }
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
      shopMerchantGold: sanitizeEconomyRecord(session.shopMerchantGold),
      shopHaggleState: sanitizeShopHaggleState(session.shopHaggleState),
      shopReputation: sanitizeEconomyRecord(session.shopReputation),
      shopShelf: sanitizeShopShelf(session.shopShelf),
      energy: nonNegativeIntegerOrUndefined(session.energy),
      shippingQueue: life.shippingQueue,
      shippingLastSettledDayKey: typeof session.shippingLastSettledDayKey === "string" && session.shippingLastSettledDayKey.trim()
        ? session.shippingLastSettledDayKey
        : undefined,
      dayTransitionLastDayKey: parseCalendarDayKey(session.dayTransitionLastDayKey)
        ? session.dayTransitionLastDayKey as string
        : undefined,
      shippingHistory: isShippingSettlementArray(session.shippingHistory) ? session.shippingHistory : undefined,
      bundleContributions: life.bundleContributions,
      completedBundleIds: isStringArray(session.completedBundleIds) ? [...session.completedBundleIds] : undefined,
      bundleRewardAppliedIds: isStringArray(session.bundleRewardAppliedIds) ? [...session.bundleRewardAppliedIds] : undefined,
      unlockedRegionIds: isStringArray(session.unlockedRegionIds) ? [...session.unlockedRegionIds] : undefined,
      unlockedRecipeIds: isStringArray(session.unlockedRecipeIds) ? [...session.unlockedRecipeIds] : undefined,
      makerInstances: life.makerInstances,
      lifeRecovery: life.lifeRecovery,
      dailyWeather: normalizeDailyWeatherState(session.dailyWeather),
      farmAnimals: life.farmAnimals,
      farmBuildingPlacements: life.farmBuildingPlacements,
      homeDecorationPlacements: life.homeDecorationPlacements,
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
      actorTechPoints: isNumberRecord(session.actorTechPoints) ? session.actorTechPoints : undefined,
      actorLevels: isNumberRecord(session.actorLevels) ? session.actorLevels : undefined,
      actorVitals: isActorVitalsRecord(session.actorVitals) ? session.actorVitals : undefined,
      horror: isHorrorState(session.horror) ? session.horror : undefined,
      detectionEncounterCompletions: session.detectionEncounterCompletions,
      eventLocations: isRuntimeEventLocationRecord(session.eventLocations) ? session.eventLocations : undefined,
      erasedEventIds: isStringArray(session.erasedEventIds) ? session.erasedEventIds : undefined,
      occupiedLocationIds: isLocationOccupancyRecord(session.occupiedLocationIds) ? session.occupiedLocationIds : undefined,
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
      relationships: normalizeRelationships(session.relationships),
      galleryUnlocks: normalizeGalleryUnlocks(session.galleryUnlocks),
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
      vehicle: parseVehicleSessionState(session.vehicle),
      currentMapId: session.currentMapId,
      x: session.x,
      y: session.y,
      playerFootprint: parsePlayerFootprint(session.playerFootprint),
      playerPassRows: Number.isSafeInteger(session.playerPassRows) ? session.playerPassRows as number : undefined,
      mapOverrides: parseMapOverrides(session.mapOverrides),
      flags: session.flags,
      battleResult,
      audio: audio.value,
      systemAudioOverrides: session.systemAudioOverrides,
      pictures: parsePictures(session.pictures),
      actorEquipment: isActorEquipmentRecord(session.actorEquipment) ? session.actorEquipment : undefined,
      battleReports: normalizeBattleReports(session.battleReports),
      actorRows: isActorRowsRecord(session.actorRows) ? session.actorRows : undefined,
      actorNames: isStringRecord(session.actorNames) ? session.actorNames : undefined,
      actorNicknames: isStringRecord(session.actorNicknames) ? session.actorNicknames : undefined,
      actorFaceResourceIds: parseActorFaceResourceIds(session),
      actorCharacterResourceIds: isStringRecord(session.actorCharacterResourceIds) ? session.actorCharacterResourceIds : undefined,
      growthProgress: isGrowthProgress(session.growthProgress) ? session.growthProgress : undefined,
      promotionLineage: isPromotionLineage(session.promotionLineage) ? session.promotionLineage : undefined,
      classOverrides: isStringRecord(session.classOverrides) ? session.classOverrides : undefined,
      actorParamBonuses: isActorParamBonusRecord(session.actorParamBonuses) ? session.actorParamBonuses : undefined,
      actorStateIds: isActorStateIdsRecord(session.actorStateIds) ? session.actorStateIds : undefined,
      stringVariables: isStringRecord(session.stringVariables) ? session.stringVariables : undefined,
      playerFacing: session.playerFacing === "up" || session.playerFacing === "down" || session.playerFacing === "left" || session.playerFacing === "right" ? session.playerFacing : undefined,
      stateStepCounts: isNestedNumberRecord(session.stateStepCounts) ? session.stateStepCounts : undefined,
      highScores: isNumberRecord(session.highScores) ? session.highScores : undefined,
      teleportPoints: Array.isArray(session.teleportPoints)
        ? session.teleportPoints.filter((p): p is NonNullable<PlaySession["teleportPoints"]>[number] =>
          !!p && typeof p === "object" && typeof (p as { mapId?: unknown }).mapId === "string"
          && Number.isFinite((p as { x?: unknown }).x) && Number.isFinite((p as { y?: unknown }).y))
        : undefined,
      stepCount: typeof session.stepCount === "number" && Number.isFinite(session.stepCount) && session.stepCount >= 0 ? Math.floor(session.stepCount) : undefined,
      playTimeSeconds: typeof session.playTimeSeconds === "number" ? Math.floor(session.playTimeSeconds) : undefined,
      gameTime: isGameTime(session.gameTime) ? structuredClone(session.gameTime) : undefined,
      rng: parseRngState(session.rng),
      roguelikeRun: normalizeRoguelikeRunState(session.roguelikeRun),
      difficultyId: typeof session.difficultyId === "string" && session.difficultyId.trim() ? session.difficultyId : undefined,
      retiredMonsterInstanceSeq: typeof session.retiredMonsterInstanceSeq === "number" && Number.isSafeInteger(session.retiredMonsterInstanceSeq) && session.retiredMonsterInstanceSeq > 0 ? session.retiredMonsterInstanceSeq : undefined,
      partySets: parsePartySets(session.partySets),
      activePartySetId: typeof session.activePartySetId === "string" && session.activePartySetId ? session.activePartySetId : undefined,
      actorSkillLoadouts: isActorSkillIdsRecord(session.actorSkillLoadouts) ? session.actorSkillLoadouts : undefined,
      screen: parseScreenState(session.screen),
      systemAudio: parseSystemAudioState(session.systemAudio),
      access: parseAccessState(session.access),
    },
  };
}

/** 파티 묶음 — 모양이 틀린 줄만 버린다(한 줄 때문에 세이브 전체를 거절하지 않는다). */
function parsePartySets(value: unknown): PlaySession["partySets"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const sets: NonNullable<PlaySession["partySets"]> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as { actorIds?: unknown; mapId?: unknown; x?: unknown; y?: unknown };
    if (!isStringArray(entry.actorIds) || typeof entry.mapId !== "string" || typeof entry.x !== "number" || typeof entry.y !== "number") continue;
    sets[id] = { actorIds: [...entry.actorIds], mapId: entry.mapId, x: Math.trunc(entry.x), y: Math.trunc(entry.y) };
  }
  return Object.keys(sets).length > 0 ? sets : undefined;
}

function parseItemUseCharges(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const charges: Record<string, number> = Object.create(null);
  for (const [itemId, charge] of Object.entries(value)) {
    if (typeof charge === "number" && Number.isFinite(charge)) charges[itemId] = charge;
  }
  return charges;
}

// 저장된 화면 상태를 방어적으로 파싱(모든 필드 선택). 유효 필드가 없으면 undefined.
function parseScreenState(value: unknown): SaveScreenState | undefined {
  if (!isRecord(value)) return undefined;
  const result: { tint?: string; weather?: string; hidden?: boolean; tintDurationMs?: number; filter?: SaveScreenState["filter"] } = {};
  if (typeof value.tint === "string") result.tint = value.tint;
  if (typeof value.weather === "string") result.weather = value.weather;
  if (typeof value.hidden === "boolean") result.hidden = value.hidden;
  if (typeof value.tintDurationMs === "number") result.tintDurationMs = value.tintDurationMs;
  if (isRecord(value.filter)) {
    const filter = normalizeScreenFilter(value.filter);
    if (!isNeutralScreenFilter(filter)) result.filter = filter;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseSystemAudioState(value: unknown): SaveSnapshot["session"]["systemAudio"] {
  if (!isRecord(value)) return undefined;
  const result: Record<string, string> = {};
  for (const slot of SYSTEM_AUDIO_SLOTS) {
    const key = systemAudioOverrideKey(slot);
    if (typeof value[key] === "string") result[key] = value[key];
  }
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

function normalizedBundleReceiptIds(
  completed: readonly string[] | undefined,
  rewardApplied: readonly string[] | undefined,
): string[] {
  return uniqueStrings([...(completed ?? []), ...(rewardApplied ?? [])]);
}

function corrupt(slot: SaveSlotIndex, message: string): SaveSlotReadResult {
  return { kind: "corrupt", slot, message };
}

/** A malformed saved clock must not be dropped while retaining jobs that depend on it. */
function assertSavedMakerClock(time: unknown, instances: PlaySession["makerInstances"]): void {
  if (time === undefined) return; // Legacy omitted clocks retain the initial-time fallback.
  for (const [id, job] of Object.entries(instances ?? {})) {
    if (job.status === "idle") continue;
    if (!isGameTime(time) || !time) throw new LifeReconciliationError("makerInstances", id, "invalid-time");
    if (!job.contract) continue;
    try {
      absoluteGameMinutes(time, { enabled: true, ...job.contract.timeBasis });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new LifeReconciliationError("makerInstances", id, "invalid-time");
    }
  }
}

/** Restore persistent occupancy first, retaining rejected placeable originals before spatial reconciliation. */
function prepareLifeSnapshot(project: Project, input: PlaySession): PlaySession {
  const draft = { ...structuredClone(input), ...parseLifeState(input) };
  assertSavedMakerClock(input.gameTime, draft.makerInstances);
  const placeables = restorePlaceables(project, draft.placeables);
  for (const [sourceId, original] of Object.entries(draft.placeables ?? {})) {
    if (!Object.hasOwn(placeables, sourceId)) preserveUnresolvedLifeSource(draft, { sourceKind: "placeables", sourceId, reason: "incompatible-placeable" }, original);
  }
  draft.placeables = placeables;
  return reconcileLifeState(project, draft);
}


/** JSON.parse overwrites duplicate keys before a reviver can see them. Reject ambiguous ownership first. */
function parseUniqueSaveJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const objects: (Set<string> | null)[] = [];
  const tokens = /"(?:\\.|[^"\\])*"|[{}\[\]]/g;
  for (const match of text.matchAll(tokens)) {
    const token = match[0];
    if (token === "{") { objects.push(new Set()); continue; }
    if (token === "[") { objects.push(null); continue; }
    if (token === "}" || token === "]") { objects.pop(); continue; }
    let next = match.index + token.length;
    while (/\s/.test(text[next] ?? "") && next < text.length) next++;
    if (text[next] !== ":") continue;
    const keys = objects[objects.length - 1];
    const key: unknown = JSON.parse(token);
    if (!keys || typeof key !== "string") continue;
    if (keys.has(key)) throw new LifeReconciliationError("snapshot", key, "duplicate-key");
    keys.add(key);
  }
  return value;
}
