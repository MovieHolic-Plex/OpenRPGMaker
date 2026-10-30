import { normalizeSeCues } from "@/project/seCues";
import { normalizeScheduleRecords } from "./schedule";
import { normalizePartyBonds } from "@/project/partyBonds";
import { normalizeChargeBreak, normalizeFixedDamage, normalizeMultiHit } from "@/project/skillBattleRules";
import { normalizeShinyRate } from "@/project/monsterIdentity";
import { CHARACTER_MOTION_STYLES } from "@/battle/characterMotion";
import { normalizeHeldItemEffect } from "@/battle/heldItems";
import { ESCAPE_GRACE_STEPS_MAX, normalizeRepelSteps } from "@/project/encounterGuard";
import { normalizeBattleGimmick } from "@/battle/battleGimmickRules";
import { normalizeGallerySettings } from "./gallery";
import { normalizeBattleAura } from "@/assets/battleStateAuras";
import { normalizeSkillChoreographyRecords } from "./skillChoreographyRecords";
import { normalizeChapterSettings, normalizeNewGamePlusSettings } from "./newGamePlus";
import { normalizeVehicleConfigs } from "./vehicles";
import { normalizeFieldHud } from "./fieldHud";
import { assertPromotionExtensions } from '@/project/growth/requirements';
import {
  ACTOR_LEVEL_MAX,
  ACTOR_RATE_GRADES,
  DEFAULT_ELEMENT_RATE_LABELS,
  clampLevel,
  normalizeActorRecord,
} from "@/project/actorModel";
import { DEFAULT_BATTLE_SKIN_ID, resolveSkinId, retiredSkinLookWindow } from "@/battle/skins/registry";
import { isPokemonMoveMotion } from "@/battle/pokemonMoveMotion";
import { DEFAULT_BATTLE_HIT_FEEL, isBattleHitFeel } from "@/project/battleHitFeel";
import { normalizeDisplayFilter } from "@/project/displayFilter";
import { normalizePlaySurfaceScale } from "@/project/playSurfaceScaleMode";
import { normalizeTouchControls } from "@/project/touchControls";
import { normalizeBattleLook } from "@/project/battleLook";
import { normalizeBattleFanfare } from "@/project/battleFanfare";
import { normalizeBattleStaging, normalizeComboStaging } from "@/project/battleStaging";
import { DEFAULT_MENU_SKIN_ID, isMenuSkinId } from "@/player/menuSkins/registry";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeActionCombatConfig, normalizeActionSkillProfile, normalizeActionWeaponProfile } from "@/project/actionCombat";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeSystemFontConfig } from "@/project/fontRegistry";
import { DEFAULT_DIALOGUE_STYLE_ID, DIALOGUE_PROJECT_SPEED_LIMITS, isDialogueStyleId, normalizeDialogueFullPortraitSettings } from "@/project/dialogueStyles";
import { isFontFamilyId } from "@/project/fontRegistry";
import { normalizeElementRecords, normalizeGlobalBattleCommands, normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { normalizeTitleOpeningFields } from "@/project/titleEffects";
import { normalizeDifficulties } from "@/project/difficulty";
import { normalizeMonsterFusions } from "@/project/monsterTrade";
import { normalizeTitleScreenVariants } from "@/project/titleVariants";
import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_DAYS_PER_SEASON,
  DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
  MAX_DAYS_PER_SEASON,
  MIN_DAYS_PER_SEASON,
  type TimeSystemConfig,
} from "@/project/gameTime";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { normalizeMonsterBoxNames } from "@/project/monsterBox";
import { isFarmTool, normalizeCropRecord } from "@/project/farmModel";
import { normalizeLifeSkillRecord } from "@/project/skillModel";
import { isGenrePackId } from "@/project/genrePackId";
import { isGenreLockPresetId, type GenreLock } from "@/project/genreLock";
import { normalizePeopleChipLock } from "@/project/peopleChipLock";
import {
  normalizeBundleDefinitions,
  normalizeEnergySystemConfig,
  normalizeMakerDefinitions,
  normalizeShippingSystemConfig,
  normalizeWorldUnlockDefinitions,
} from "@/project/p0SystemRecords";
import {
  normalizeDailyWeatherConfig,
  normalizeFarmAnimalBuildingDefinitions,
  normalizeFarmAnimalSpeciesRecords,
} from "@/project/p1FoundationRecords";
import {
  normalizeCollectionSystem,
  normalizeFishingSystem,
  normalizeFishSpeciesRecords,
  normalizeMuseumSystem,
  normalizeSeasonalForage,
} from "@/project/p2FoundationRecords";
import {
  normalizeFarmBuildingTypes,
  normalizeHomeDecorationTypes,
} from "@/project/spatialPlacements";
import type { ActorExperienceCurve, CompanionConfig, ActorLearnedSkill, ActorParameterCurves, ActorRateGrade, BattleFlow, ClassBattleCommand, ClassPromotion, ClassPromotionRequirement, ClassRecord, CropRecord, DatabaseRecords, DatabaseStateEffect, EquipmentApGrant, EquipmentLevelUpBonus, EquipmentRecord, EquipmentStatBonuses, ItemCaptureProfile, ItemBagPocket, ItemCareProfile, ItemConsumptionLimit, ItemEquipmentEffectFlags, ItemEquipmentProfile, ItemRecord, LifeSkillRecord, MonsterCareConfig, ProjectDatabaseRecords, RewardPolicy, SkillEffect, SkillMpCost, SkillRecord, SkillStatStageEffect, StateRecord, SystemRecords, TitleBackgroundLayer, TitleIntroSettings, TitleParticleSettings, TitlePressStart, TitleRunner, TitleScreenGraphic, TitleScreenMenuVisibility, TitleScreenSettings, TitleScreenSounds, TitleScreenTitleMode, TypeChartRecord } from "@/project/types";
import { normalizeSkillInputSequence } from "@/battle/battleInputSequence";
import { normalizeCaptureCondition } from "@/battle/captureBalls";
import { isStatStageKey, STAT_STAGE_MAX, STAT_STAGE_MIN } from "@/battle/statStages";
import { normalizeSkillWeather } from "@/battle/weather";
import { normalizeCharacterFootprint, normalizePassRows } from "@/project/footprint";
import { keepsExplicitDefaultResolution, normalizePlayResolution } from "@/project/playResolution";
import { normalizeCameraZoom } from "@/project/cameraZoom";
import { normalizeWorldGenRulesForStorage } from "@/project/worldGenRules";
import { normalizeCinematicSequence, normalizeGameOverSettings } from "@/project/cinematicSettings";
import { isTeamSwapCost, normalizeBattleTeams } from "@/project/battleTeamModel";

export { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";

// StateRecord 필드는 ontology(databaseStateOntology)와 병합되는 사용자 재정의 값이므로
// 임의의 클램프를 가하지 않고 입력 값을 보존하되 타입만 정규화한다. 다른 컬렉션과 동일하게
// updateDatabaseRecord / upsert_state 모두 이 함수를 거쳐 단일 정규화 계약을 보장한다.
export function normalizeStateRecord(record: Partial<StateRecord> & Pick<StateRecord, "id" | "name">): StateRecord {
  const optionalNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const optionalString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;
  return {
    id: record.id,
    name: record.name,
    ...(isGen1MajorStatus(record.gen1MajorStatus) ? { gen1MajorStatus: record.gen1MajorStatus } : {}),
    ...(record.volatileStatus === "confusion" ? { volatileStatus: record.volatileStatus } : {}),
    ...(record.removalCondition !== undefined ? { removalCondition: optionalString(record.removalCondition) } : {}),
    ...(typeof record.clearOnBattleEnd === "boolean" ? { clearOnBattleEnd: record.clearOnBattleEnd } : {}),
    ...(record.restriction !== undefined ? { restriction: optionalString(record.restriction) } : {}),
    ...(record.priority !== undefined ? { priority: optionalNumber(record.priority) } : {}),
    ...(record.accuracyModifier !== undefined ? { accuracyModifier: optionalNumber(record.accuracyModifier) } : {}),
    ...(record.animationIndex !== undefined ? { animationIndex: optionalNumber(record.animationIndex) } : {}),
    ...(record.recoverNaturallyFromTurn !== undefined ? { recoverNaturallyFromTurn: optionalNumber(record.recoverNaturallyFromTurn) } : {}),
    ...(record.recoverNaturallyChance !== undefined ? { recoverNaturallyChance: optionalNumber(record.recoverNaturallyChance) } : {}),
    ...(record.recoverWhenHitChance !== undefined ? { recoverWhenHitChance: optionalNumber(record.recoverWhenHitChance) } : {}),
    ...(record.hpReleaseTurn !== undefined ? { hpReleaseTurn: optionalNumber(record.hpReleaseTurn) } : {}),
    ...(record.hpReleaseStep !== undefined ? { hpReleaseStep: optionalNumber(record.hpReleaseStep) } : {}),
    ...(record.mpReleaseTurn !== undefined ? { mpReleaseTurn: optionalNumber(record.mpReleaseTurn) } : {}),
    ...(record.mpReleaseStep !== undefined ? { mpReleaseStep: optionalNumber(record.mpReleaseStep) } : {}),
    ...(record.fieldStepInterval !== undefined ? { fieldStepInterval: optionalNumber(record.fieldStepInterval) } : {}),
    ...(record.releaseAfterSteps !== undefined ? { releaseAfterSteps: optionalNumber(record.releaseAfterSteps) } : {}),
    ...(record.fieldStepCanKill !== undefined ? { fieldStepCanKill: record.fieldStepCanKill === true } : {}),
    ...(record.specialFlags !== undefined ? { specialFlags: cleanIds(record.specialFlags) } : {}),
    ...(record.lockedParameters !== undefined ? { lockedParameters: cleanIds(record.lockedParameters) } : {}),
    ...(record.runtimeEffects !== undefined ? { runtimeEffects: record.runtimeEffects } : {}),
    ...(() => {
      const emotion = normalizeStateEmotion(record.emotion);
      return emotion ? { emotion } : {};
    })(),
    ...(typeof record.disablesEquipSlot === "string" && record.disablesEquipSlot ? { disablesEquipSlot: record.disablesEquipSlot } : {}),
    ...(normalizeBattleAura(record.battleAura) ? { battleAura: normalizeBattleAura(record.battleAura) } : {}),
  };
}

function normalizeStateEmotion(value: unknown): StateRecord["emotion"] {
  if (!value || typeof value !== "object") return undefined;
  const { family, tier } = value as { family?: unknown; tier?: unknown };
  if (typeof family !== "string" || family.trim() === "") return undefined;
  return { family: family.trim(), tier: typeof tier === "number" && Number.isFinite(tier) ? clampInteger(tier, 1, 9) : 1 };
}

type ProjectDatabaseInput = DatabaseRecords & Partial<Pick<ProjectDatabaseRecords,
  "battleCommands" | "elements" | "terrains" | "monsterSpecies" | "crops" | "lifeSkills"
  | "farmAnimalSpecies" | "fishSpecies" | "farmBuildingTypes" | "homeDecorationTypes" | "skillChoreographies" | "schedules"
>>;

/**
 * 아이템 목록을 화이트리스트로 좁히는 쇼케이스 프로젝트가 씨앗·수확물이 사라진 작물 행을
 * 남기면 `validateProjectReferences` 가 하드 실패해 프로젝트가 열리지 않는다. 실측(2026-08-29):
 * 기본 DB 에 작물 4종을 추가했더니 `emberQuest`(items 화이트리스트) 가 dangling 4건으로 깨졌다.
 * 아이템을 잘라내는 쪽은 작물도 같은 기준으로 잘라야 한다.
 */
export function dropCropsWithMissingItems(database: ProjectDatabaseInput): void {
  const crops = database.crops;
  if (!crops || crops.length === 0) return;
  const itemIds = new Set((database.items ?? []).map((item) => item.id));
  database.crops = crops.filter((crop) => itemIds.has(crop.seedItemId) && itemIds.has(crop.harvestItemId));
}

export function normalizeDatabaseRecords(database: ProjectDatabaseInput): ProjectDatabaseRecords {
  return {
    ...database,
    actors: database.actors.map((actor) => normalizeActorRecord(actor)),
    classes: database.classes.map(normalizeClassRecord),
    skills: database.skills.map(normalizeSkillRecord),
    items: database.items.map(normalizeItemRecord),
    equipment: database.equipment.map(normalizeEquipmentRecord),
    enemies: database.enemies.map(normalizeEnemyRecord),
    troops: database.troops.map(normalizeTroopRecord),
    battleAnimations: database.battleAnimations.map(normalizeBattleAnimationRecord),
    elements: normalizeElementRecords(database.elements),
    terrains: normalizeTerrainRecords(database.terrains),
    battleCommands: normalizeGlobalBattleCommands(database.battleCommands),
    monsterSpecies: (database.monsterSpecies ?? []).map(normalizeMonsterSpeciesRecord),
    crops: (database.crops ?? []).map((crop) => normalizeCropRecord(crop as Partial<CropRecord> & Pick<CropRecord, "id" | "name">)),
    lifeSkills: (database.lifeSkills ?? []).map((skill) => normalizeLifeSkillRecord(skill as Partial<LifeSkillRecord> & Pick<LifeSkillRecord, "id" | "name">)),
    ...(database.farmAnimalSpecies !== undefined
      ? { farmAnimalSpecies: normalizeFarmAnimalSpeciesRecords(database.farmAnimalSpecies) ?? [] }
      : {}),
    ...(database.fishSpecies !== undefined
      ? { fishSpecies: normalizeFishSpeciesRecords(database.fishSpecies) ?? [] }
      : {}),
    ...(database.farmBuildingTypes !== undefined
      ? { farmBuildingTypes: normalizeFarmBuildingTypes(database.farmBuildingTypes) ?? [] }
      : {}),
    ...(database.homeDecorationTypes !== undefined
      ? { homeDecorationTypes: normalizeHomeDecorationTypes(database.homeDecorationTypes) ?? [] }
      : {}),
    ...(database.skillChoreographies !== undefined
      ? { skillChoreographies: normalizeSkillChoreographyRecords(database.skillChoreographies) ?? [] }
      : {}),
    ...(database.schedules !== undefined ? { schedules: normalizeScheduleRecords(database.schedules) } : {}),
  };
}

/** Runtime CSS border-image windowskin. EasyRPG System/*.png sheets are not valid 9-slice skins. */
export const DEFAULT_RUNTIME_WINDOW_SKIN_ID = "windowskin-warm";

const EASYRPG_SYSTEM_SHEET_IDS = new Set([
  "easyrpg-system-system",
  "easyrpg-system-system-a",
  "easyrpg-system-system-b",
  "easyrpg-system-system-c",
  "easyrpg-system-royal",
]);

export function normalizeSystemWindowSkinId(value: unknown): string | undefined {
  const id = cleanOptionalId(value);
  if (!id) return undefined;
  // System2 gauge sheets must never be stored as the window skin either.
  if (id.startsWith("easyrpg-system2-")) return DEFAULT_RUNTIME_WINDOW_SKIN_ID;
  if (EASYRPG_SYSTEM_SHEET_IDS.has(id)) return DEFAULT_RUNTIME_WINDOW_SKIN_ID;
  return id;
}

/**
 * 지운 측면 스킨(먹빛·청람·세피아·금갈색·유리)의 창 색을 전투 화면 꾸미기 창으로 옮긴다(2026-10-02).
 * 꾸밈을 손대지 않은 프로젝트(프리셋·창 칸이 없음)에서만 — 꾸밈을 고른 프로젝트는 그 꾸밈 창이 이미 보이고 있었다.
 */
function battleLookWithRetiredSkinWindow(system: { battleUiStyle?: unknown; battleLook?: unknown }): unknown {
  const lookWindow = retiredSkinLookWindow(system.battleUiStyle);
  const look = system.battleLook && typeof system.battleLook === "object" ? system.battleLook as Record<string, unknown> : undefined;
  if (!lookWindow || look?.preset !== undefined || look?.window !== undefined) return system.battleLook;
  return { ...look, window: lookWindow };
}

/** 알 수 없는 preset·모양이 깨진 값은 잠금 없음으로 본다 — 저장 바이트를 지키려고 선택 칸은 있을 때만 쓴다. */
function normalizeGenreLock(value: unknown): GenreLock | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<GenreLock>;
  if (!isGenreLockPresetId(raw.preset)) return undefined;
  const families = Array.isArray(raw.allowedFamilies) ? raw.allowedFamilies.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
  if (!families.length) return undefined;
  const mapIds = Array.isArray(raw.grandfatheredMapIds) ? [...new Set(raw.grandfatheredMapIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))] : [];
  // 허용 캐릭터 칩 계열(2026-10-16) — 없으면 없는 채로 둔다(이전에 켠 잠금은 프리셋 표를 따른다. 저장 바이트 불변).
  const charsetFamilies = Array.isArray(raw.allowedCharsetFamilies) ? [...new Set(raw.allowedCharsetFamilies.filter((id): id is string => typeof id === "string" && id.trim().length > 0))] : [];
  // 허용 얼굴·전투 그림 계열(2026-10-16) — 없으면 없는 채로 둔다(이전에 켠 잠금은 프리셋 표를 따른다. 저장 바이트 불변).
  const strings = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))] : [];
  const faceFamilies = strings(raw.allowedFaceFamilies), battleFamilies = strings(raw.allowedBattleFamilies);
  // 켤 때 이미 허용 밖이던 캐릭터 칩 사용처(2026-10-16) — 없으면 없는 채로 둔다(저장 바이트 불변).
  const charsetPaths = strings(raw.grandfatheredCharsetPaths);
  return {
    preset: raw.preset, mode: raw.mode === "warn" ? "warn" : "enforce", allowedFamilies: [...new Set(families)],
    ...(charsetFamilies.length ? { allowedCharsetFamilies: charsetFamilies } : {}),
    ...(faceFamilies.length ? { allowedFaceFamilies: faceFamilies } : {}), ...(battleFamilies.length ? { allowedBattleFamilies: battleFamilies } : {}),
    ...(mapIds.length ? { grandfatheredMapIds: mapIds } : {}),
    ...(charsetPaths.length ? { grandfatheredCharsetPaths: charsetPaths } : {}),
  };
}

export function normalizeSystemRecords(system: Partial<SystemRecords> & Pick<SystemRecords, "startActorIds">): SystemRecords {
  const titleResourceId = cleanOptionalId(system.titleResourceId);
  const typeChart = normalizeTypeChart(system.typeChart);
  const timeSystem = normalizeTimeSystemConfig(system.timeSystem);
  const actionCombat = normalizeActionCombatConfig(system.actionCombat);
  const playerFootprint = normalizeCharacterFootprint(system.playerFootprint);
  const genreLock = normalizeGenreLock(system.genreLock);
  const peopleChipLock = normalizePeopleChipLock(system.peopleChipLock);
  // 양쪽 전신 대화창이면 생략이 1024×768·3.2배를 뜻하므로 작가가 고른 기본값(320×240·1배)도 값으로 남긴다.
  const keepDefaults = keepsExplicitDefaultResolution(system);
  const playResolution = normalizePlayResolution(system.playResolution, { keepDefault: keepDefaults });
  const cameraZoom = normalizeCameraZoom(system.cameraZoom, { keepDefault: keepDefaults });
  const displayFilter = normalizeDisplayFilter(system.displayFilter);
  const playSurfaceScale = normalizePlaySurfaceScale(system.playSurfaceScale);
  const battleLook = normalizeBattleLook(battleLookWithRetiredSkinWindow(system));
  const fullPortrait = normalizeDialogueFullPortraitSettings(system.dialogueFullPortrait);
  const battleTeams = normalizeBattleTeams(system.battleTeams);
  const companions = normalizeCompanionConfig(system.companions);
  const fonts = normalizeSystemFontConfig(system.fonts);
  const gallery = normalizeGallerySettings(system.gallery);
  const newGamePlus = normalizeNewGamePlusSettings(system.newGamePlus);
  const chapter = normalizeChapterSettings(system.chapter);
  const vehicles = normalizeVehicleConfigs(system.vehicles);
  const limitGauge = normalizeLimitGauge(system.limitGauge);
  const resource2 = normalizeResource2(system.resource2);
  const partyGauge = normalizePartyGauge(system.partyGauge);
  const emotionCycle = normalizeEmotionCycle(system.emotionCycle);
  const monsterCare = normalizeMonsterCare(system.monsterCare);
  const difficulties = normalizeDifficulties(system.difficulties);
  const monsterFusions = normalizeMonsterFusions(system.monsterFusions);
  const battleUiStyle = system.battleUiStyle ? resolveSkinId(system.battleUiStyle) : undefined;
  // 조건부 스프레드를 한 객체에 모으면 조합 타입이 TS2590 으로 죽는다. 키 순서는 예전 리터럴과 같다.
  const records = {} as SystemRecords;
  records.startActorIds = cleanIds(system.startActorIds);
  if (system.fieldHud !== undefined) records.fieldHud = normalizeFieldHud(system.fieldHud);
  if (system.playerFootprint !== undefined) records.playerFootprint = playerFootprint;
  if (system.playerPassRows !== undefined) records.playerPassRows = normalizePassRows(system.playerPassRows, playerFootprint.height);
  if (playResolution) records.playResolution = playResolution;
  // 프로젝트 기본 카메라 배율. 1(클래식)은 생략해 옛 JSON 바이트를 지킨다.
  if (cameraZoom !== undefined) records.cameraZoom = cameraZoom;
  if (isGenrePackId(system.genre)) records.genre = system.genre;
  if (genreLock) records.genreLock = genreLock;
  if (peopleChipLock) records.peopleChipLock = peopleChipLock;
  records.titleResourceId = titleResourceId;
  records.systemResourceId = normalizeSystemWindowSkinId(system.systemResourceId);
  records.battleSystemResourceId = cleanOptionalId(system.battleSystemResourceId);
  records.battleBgmResourceId = cleanOptionalId(system.battleBgmResourceId);
  // 맵이 BGM 을 정하지 않았을 때 쓰는 프로젝트 기본 BGM. 화이트리스트 정규화이므로
  // 여기 없으면 왕복 1회에 사라진다(skillSystem 이 실제로 그렇게 사라진 전례가 위에 있다).
  records.defaultBgmResourceId = cleanOptionalId(system.defaultBgmResourceId);
  records.battleVictoryMeResourceId = cleanOptionalId(system.battleVictoryMeResourceId);
  records.battleDefeatSeResourceId = cleanOptionalId(system.battleDefeatSeResourceId);
  records.battleEscapeSeResourceId = cleanOptionalId(system.battleEscapeSeResourceId);
  // 효과음 자리 표 — 화이트리스트라 여기 없으면 저장 왕복 1회에 사라진다. 비면 저장하지 않는다(옛 JSON 바이트 유지).
  const seCues = normalizeSeCues(system.seCues);
  if (seCues) records.seCues = seCues;
  records.initialTroopId = cleanOptionalId(system.initialTroopId);
  records.battleFlow = normalizeBattleFlow(system.battleFlow);
  // ATB 대기 방식·속도·필드 배경 — 기본(wait·기존 속도·트룹 배경)은 저장하지 않는다(옛 JSON 바이트 유지).
  if (system.atbMode === "active") records.atbMode = "active";
  if (typeof system.atbSpeed === "number" && Number.isFinite(system.atbSpeed)) records.atbSpeed = clampInteger(system.atbSpeed, 1, 8);
  if (system.battleBackdrop === "field") records.battleBackdrop = "field";
  // 롤링 HP 미터(마더식). 기본(끔)과 기본 속도는 저장하지 않는다 — 화이트리스트라 여기 없으면 왕복 1회에 사라진다.
  if (system.battleRollingHp === true) records.battleRollingHp = true;
  if (typeof system.battleRollingHpPerSecond === "number" && Number.isFinite(system.battleRollingHpPerSecond)) {
    records.battleRollingHpPerSecond = clampInteger(system.battleRollingHpPerSecond, 1, 999);
  }
  if (system.battlePresentation === "onField") records.battlePresentation = "onField";
  // 진형 굴림·도주 가산 — 기본(굴림 없음·가산 0)은 저장하지 않는다(옛 JSON 바이트 유지).
  if (system.battleFormationRoll === true) records.battleFormationRoll = true;
  if (system.pointerMovement === true) records.pointerMovement = true;
  const touchControls = normalizeTouchControls(system.touchControls);
  if (touchControls) records.touchControls = touchControls;
  if (typeof system.escapeBonusPercent === "number" && Number.isFinite(system.escapeBonusPercent) && system.escapeBonusPercent !== 0) {
    records.escapeBonusPercent = clampInteger(system.escapeBonusPercent, 0, 100);
  }
  if (system.battleCommandCss?.trim()) records.battleCommandCss = system.battleCommandCss;
  // 기본 스킨(DEFAULT_BATTLE_SKIN_ID = retro2003)만 저장하지 않는다. 그 밖의 명시적 선택은 반드시
  // 보존해야 한다 — 기본이 바뀐 뒤에 명시값을 생략하면 왕복 후 다른 스킨으로 바뀌어버린다
  // (기본이 vxace 였던 시절 실제로 그랬다). 지운 정면 스킨(rm2000·classic 등)과 모르는 값은
  // resolveSkinId 가 기본으로 풀어 여기서 지워진다(2026-10-02).
  if (battleUiStyle && battleUiStyle !== DEFAULT_BATTLE_SKIN_ID) records.battleUiStyle = battleUiStyle;
  // 타격감도 같은 계약 — 기본(impact)과 미등록 값은 저장하지 않고 명시 선택만 남긴다.
  if (isBattleHitFeel(system.battleHitFeel) && system.battleHitFeel !== DEFAULT_BATTLE_HIT_FEEL) records.battleHitFeel = system.battleHitFeel;
  if (displayFilter) records.displayFilter = displayFilter;
  if (playSurfaceScale) records.playSurfaceScale = playSurfaceScale;
  // 전투 화면 꾸미기도 같은 계약 — 프리셋과 같은 칸·미등록 값은 저장하지 않는다(project/battleLook.ts).
  if (battleLook) records.battleLook = battleLook;
  // 결과 팡파레 — 기본(전부 켜기·burst)은 저장하지 않는다(project/battleFanfare.ts).
  const battleFanfare = normalizeBattleFanfare(system.battleFanfare);
  if (battleFanfare) records.battleFanfare = battleFanfare;
  // 전투 연출(적 달려들기·연계기 컷인·화려함·한 줄 도움말) — 기본은 저장하지 않는다(project/battleStaging.ts).
  const battleStaging = normalizeBattleStaging(system.battleStaging);
  if (battleStaging) records.battleStaging = battleStaging;
  // ESC 메뉴 스킨도 같은 계약 — 기본(workbench)과 미등록 값은 저장하지 않고 명시 선택만 남긴다.
  if (isMenuSkinId(system.menuUiStyle) && system.menuUiStyle !== DEFAULT_MENU_SKIN_ID) records.menuUiStyle = system.menuUiStyle;
  // 대화창 스타일도 같은 계약 — 기본(glass)과 미등록 값은 저장하지 않는다.
  if (isDialogueStyleId(system.dialogueStyle) && system.dialogueStyle !== DEFAULT_DIALOGUE_STYLE_ID) records.dialogueStyle = system.dialogueStyle;
  if (isFontFamilyId(system.dialogueFont)) records.dialogueFont = system.dialogueFont;
  if (typeof system.dialogueSpeed === "number" && Number.isFinite(system.dialogueSpeed) && system.dialogueSpeed !== 1) {
    records.dialogueSpeed = Math.round(Math.min(DIALOGUE_PROJECT_SPEED_LIMITS.max, Math.max(DIALOGUE_PROJECT_SPEED_LIMITS.min, system.dialogueSpeed)) * 100) / 100;
  }
  if (system.dialoguePunctuationPause === false) records.dialoguePunctuationPause = false;
  if (typeof system.dialogueKeepActorsVisible === "boolean") records.dialogueKeepActorsVisible = system.dialogueKeepActorsVisible;
  if (fullPortrait) records.dialogueFullPortrait = fullPortrait;
  // 기본(actors)은 저장하지 않고, 명시적 monsters 선택만 보존한다.
  if (system.battleParty === "monsters") records.battleParty = "monsters";
  // 기본(rm2k3)은 저장하지 않고, 명시적 gen1 선택만 보존한다(무효값도 rm2k3로 정규화).
  if (system.battleModel === "gen1") records.battleModel = "gen1";
  records.activeSlots = normalizeOptionalPositiveInteger(system.activeSlots);
  if (battleTeams) records.battleTeams = battleTeams;
  if (isTeamSwapCost(system.teamSwapCost)) records.teamSwapCost = system.teamSwapCost;
  // 동료 규칙도 화이트리스트에 있어야 왕복 1회에 사라지지 않는다(없던 동안 gap·formation·fromParty 가 로드마다 지워졌다).
  if (companions) records.companions = companions;
  records.rewardPolicy = normalizeRewardPolicy(system.rewardPolicy);
  // 능력치 심화(성격·노력치). 켠 축만 저장한다 — 둘 다 꺼지면 필드를 두지 않아 기존 프로젝트의 저장 바이트가 그대로다.
  if (system.monsterStatRules && (system.monsterStatRules.natures === true || system.monsterStatRules.evs === true)) {
    records.monsterStatRules = {
      ...(system.monsterStatRules.natures === true ? { natures: true } : {}),
      ...(system.monsterStatRules.evs === true ? { evs: true } : {}),
    };
  }
  if (typeof system.captureShakesVariableId === "string" && system.captureShakesVariableId.trim()) {
    records.captureShakesVariableId = system.captureShakesVariableId.trim();
  }
  // 생활 스킬 시스템 옵트인 플래그. 화이트리스트 방식 정규화라 여기에 없으면 저장/로드 1회 왕복에
  // 사라진다 — 실제로 누락되어 사용자가 켠 플래그가 영속되지 않았다. 기본(미설정)은 생략 유지.
  if (system.skillSystem !== undefined) records.skillSystem = { enabled: system.skillSystem.enabled === true };
  if (system.monsterCollection !== undefined) records.monsterCollection = system.monsterCollection === true;
  if (system.monsterCampaign) records.monsterCampaign = structuredClone(system.monsterCampaign);
  // 보관함 상자 이름 — 화이트리스트라 여기 없으면 저장/로드 1회 왕복에 사라진다.
  { const boxNames = normalizeMonsterBoxNames(system.monsterBoxNames); if (boxNames) records.monsterBoxNames = boxNames; }
  if (fonts) records.fonts = fonts;
  if (system.monsterBattleParty !== undefined) records.monsterBattleParty = system.monsterBattleParty === true;
  // 도망 뒤 무적 걸음. 생략은 장르 기본(몬스터 파티 4, 그 밖 0)이고, 0 은 «끔»이라 반드시 남긴다.
  // 화이트리스트라 여기 없으면 저장/로드 1회 왕복에 사라지고 몬스터 게임이 다시 4걸음으로 돌아간다.
  if (typeof system.escapeGraceSteps === "number" && Number.isFinite(system.escapeGraceSteps)) {
    records.escapeGraceSteps = clampInteger(system.escapeGraceSteps, 0, ESCAPE_GRACE_STEPS_MAX);
  }
  // 색이 다른 개체 확률 — 화이트리스트라 여기 없으면 저장/로드 1회 왕복에 사라진다.
  { const shinyRate = normalizeShinyRate(system.shinyRate); if (shinyRate !== undefined) records.shinyRate = shinyRate; }
  if (system.giftSystem !== undefined) records.giftSystem = system.giftSystem === true;
  // 연애 하루 루프(옵트인). 화이트리스트라 여기 없으면 저장/로드 1회 왕복에 사라진다(2026-10-16 런타임 QA 실측).
  if (system.socialLoop && typeof system.socialLoop === "object") {
    const { slotsPerDay, dailyFriendshipCap } = system.socialLoop;
    records.socialLoop = {
      ...(typeof slotsPerDay === "number" && Number.isFinite(slotsPerDay) ? { slotsPerDay: Math.trunc(slotsPerDay) } : {}),
      ...(typeof dailyFriendshipCap === "number" && Number.isFinite(dailyFriendshipCap) ? { dailyFriendshipCap: Math.trunc(dailyFriendshipCap) } : {}),
    };
  }
  // 파티원 유대(옵트인) — 화이트리스트라 여기 없으면 저장/로드 1회 왕복에 사라진다.
  { const partyBonds = normalizePartyBonds(system.partyBonds); if (partyBonds) records.partyBonds = partyBonds; }
  if (gallery) records.gallery = gallery;
  if (newGamePlus) records.newGamePlus = newGamePlus;
  if (chapter) records.chapter = chapter;
  if (vehicles) records.vehicles = vehicles;
  if (typeChart) records.typeChart = typeChart;
  if (timeSystem) records.timeSystem = timeSystem;
  if (system.worldGen) records.worldGen = normalizeWorldGenRulesForStorage(system.worldGen);
  // 전투 자원·감정 설정(battleGauges/battleEmotion). 화이트리스트라 여기 없으면 왕복 1회에 사라진다.
  if (limitGauge) records.limitGauge = limitGauge;
  if (resource2) records.resource2 = resource2;
  if (partyGauge) records.partyGauge = partyGauge;
  if (system.weaknessExtraAction === true) records.weaknessExtraAction = true;
  // 자동 전투 끄기·전투 뒤 상태 해제·세이브 포인트 전용(2026-10-25). 화이트리스트 — 빠뜨리면 저장 왕복에 사라진다.
  if (system.allowAutoBattle === false) records.allowAutoBattle = false;
  if (system.clearStatesAfterBattle === true) records.clearStatesAfterBattle = true;
  if (system.saveAccess === "savePoints") records.saveAccess = "savePoints";
  // 필드 안내 끄기 — 화이트리스트라 여기 없으면 저장/로드 1회 왕복에 사라진다.
  if (system.fieldGuides === "off" || system.fieldGuides === "arrows") records.fieldGuides = system.fieldGuides;
  if (emotionCycle) records.emotionCycle = emotionCycle;
  if (actionCombat) records.actionCombat = actionCombat;
  if (Array.isArray(system.toolActions)) records.toolActions = system.toolActions;
  if (Array.isArray(system.craftRecipes)) records.craftRecipes = system.craftRecipes;
  if (Array.isArray(system.itemUpgrades)) records.itemUpgrades = system.itemUpgrades;
  if (Array.isArray(system.sellPrices)) records.sellPrices = system.sellPrices;
  if (system.energy) records.energy = normalizeEnergySystemConfig(system.energy);
  if (system.shipping) records.shipping = normalizeShippingSystemConfig(system.shipping);
  if (Array.isArray(system.bundles)) records.bundles = normalizeBundleDefinitions(system.bundles);
  if (Array.isArray(system.worldUnlocks)) records.worldUnlocks = normalizeWorldUnlockDefinitions(system.worldUnlocks);
  if (Array.isArray(system.makers)) records.makers = normalizeMakerDefinitions(system.makers);
  if (system.dailyWeather) records.dailyWeather = normalizeDailyWeatherConfig(system.dailyWeather);
  if (Array.isArray(system.farmAnimalBuildings)) records.farmAnimalBuildings = normalizeFarmAnimalBuildingDefinitions(system.farmAnimalBuildings);
  if (system.fishing) records.fishing = normalizeFishingSystem(system.fishing);
  if (system.seasonalForage) records.seasonalForage = normalizeSeasonalForage(system.seasonalForage);
  if (system.collections) records.collections = normalizeCollectionSystem(system.collections);
  if (system.museum) records.museum = normalizeMuseumSystem(system.museum);
  if (monsterCare) records.monsterCare = monsterCare;
  if (difficulties) {
    records.difficulties = difficulties;
    const defaultDifficultyId = typeof system.defaultDifficultyId === "string" ? system.defaultDifficultyId.trim() : "";
    if (difficulties.some((row) => row.id === defaultDifficultyId)) records.defaultDifficultyId = defaultDifficultyId;
  }
  if (monsterFusions) records.monsterFusions = monsterFusions;
  records.titleScreen = normalizeTitleScreenSettings(system.titleScreen, titleResourceId);
  if (system.opening !== undefined) records.opening = normalizeCinematicSequence(system.opening);
  if (system.titleIntro !== undefined) records.titleIntro = normalizeCinematicSequence(system.titleIntro);
  if (system.gameOver !== undefined) records.gameOver = normalizeGameOverSettings(system.gameOver);
  if (system.gameOvers !== undefined) {
    records.gameOvers = system.gameOvers.map(row => ({ id: row.id.trim(), name: row.name, settings: normalizeGameOverSettings(row.settings) }));
  }
  if (system.defaultGameOverId !== undefined) records.defaultGameOverId = system.defaultGameOverId.trim();
  return records;
}

export function normalizeTimeSystemConfig(config: Partial<TimeSystemConfig> | undefined): TimeSystemConfig | undefined {
  if (!config) return undefined;
  const enabled = config.enabled === true;
  const dayStartHour = clampInteger(config.dayStartHour ?? DEFAULT_DAY_START_HOUR, 0, 23);
  const rawDayEndHour = clampInteger(config.dayEndHour ?? DEFAULT_DAY_END_HOUR, dayStartHour + 1, 48);
  const dayEndHour = rawDayEndHour <= dayStartHour ? DEFAULT_DAY_END_HOUR : rawDayEndHour;
  const onDayEnd = cleanOptionalId(config.onDayEnd);
  const daysPerSeason = clampInteger(
    typeof config.daysPerSeason === "number" && Number.isFinite(config.daysPerSeason)
      ? config.daysPerSeason
      : DEFAULT_DAYS_PER_SEASON,
    MIN_DAYS_PER_SEASON,
    MAX_DAYS_PER_SEASON
  );
  return {
    enabled,
    minutesPerRealSecond: positiveNumber(config.minutesPerRealSecond, DEFAULT_TIME_MINUTES_PER_REAL_SECOND),
    dayStartHour,
    dayEndHour,
    daysPerSeason,
    forceSleep: config.forceSleep === true,
    ...(onDayEnd ? { onDayEnd } : {}),
  };
}

export function normalizeTypeChart(chart: Partial<TypeChartRecord> | undefined): TypeChartRecord | undefined {
  const types = uniqueCleanIds(chart?.types).slice(0, 32);
  if (types.length === 0) return undefined;
  const multipliers: Record<string, Record<string, number>> = {};
  for (const attacker of types) {
    const source = chart?.multipliers?.[attacker] ?? {};
    const row: Record<string, number> = {};
    for (const defender of types) row[defender] = clampNumber(source[defender] ?? 1, 0, 4);
    multipliers[attacker] = row;
  }
  return { types, multipliers };
}

function normalizeRewardPolicy(policy: Partial<RewardPolicy> | undefined): RewardPolicy | undefined {
  if (!policy || (policy.participationOnly === undefined && policy.levelGapPenalty === undefined && policy.expShare === undefined && policy.expSplitAlive === undefined && policy.trainerPrizePerLevel === undefined)) return undefined;
  const prize = typeof policy.trainerPrizePerLevel === "number" && Number.isFinite(policy.trainerPrizePerLevel) ? Math.max(0, Math.min(9999, Math.trunc(policy.trainerPrizePerLevel))) : 0;
  return {
    participationOnly: policy.participationOnly === true,
    levelGapPenalty: policy.levelGapPenalty === true,
    // 새 칸은 켰을 때만 저장한다 — 안 쓰는 프로젝트의 저장 바이트는 그대로.
    ...(policy.expShare === true ? { expShare: true } : {}),
    ...(policy.expSplitAlive === true ? { expSplitAlive: true } : {}),
    ...(prize > 0 ? { trainerPrizePerLevel: prize } : {}),
  };
}

function normalizeTitleScreenSettings(
  settings: Partial<TitleScreenSettings> | undefined,
  titleResourceId: string | undefined,
): TitleScreenSettings {
  const defaults = defaultTitleScreenSettings();
  const menuVisibility = normalizeTitleScreenMenuVisibility(settings?.menuVisibility);
  const sounds = normalizeTitleScreenSounds(settings?.sounds);
  const layout = {
    titleX: clampInteger(settings?.layout?.titleX ?? defaults.layout.titleX, 0, 320),
    titleY: clampInteger(settings?.layout?.titleY ?? defaults.layout.titleY, 0, 240),
    menuX: clampInteger(settings?.layout?.menuX ?? defaults.layout.menuX, 0, 320),
    menuY: clampInteger(settings?.layout?.menuY ?? defaults.layout.menuY, 0, 240),
  };
  const titleGraphic = normalizeTitleScreenGraphic(settings?.titleGraphic, layout);
  const backgroundLayers = normalizeTitleBackgroundLayers(settings?.backgroundLayers);
  const particles = normalizeTitleParticles(settings?.particles);
  const intro = normalizeTitleIntro(settings?.intro);
  const runners = normalizeTitleRunners(settings?.runners);
  const pressStart = normalizeTitlePressStart(settings?.pressStart);
  return {
    title: textOrDefault(settings?.title, defaults.title),
    backgroundResourceId: cleanOptionalId(settings?.backgroundResourceId) ?? titleResourceId ?? defaults.backgroundResourceId,
    // 타이틀 BGM 은 "생략" 과 "명시적 무음" 을 구분한다.
    //   키 없음  → 기본 곡을 채운다(새 프로젝트가 무음으로 시작하지 않게).
    //   빈 문자열 → 저작자가 무음을 고른 것으로 보고 그대로 비운다.
    // 구분하지 않으면 기본곡이 생긴 순간 무음 타이틀을 **표현할 방법이 사라진다**(실측):
    // cleanOptionalId 가 ""를 undefined 로 바꿔 버려 곧바로 기본곡으로 덮인다.
    musicResourceId: hasExplicitSilence(settings, "musicResourceId")
      ? undefined
      : cleanOptionalId(settings?.musicResourceId) ?? cleanOptionalId(defaults.musicResourceId),
    layout,
    menuLabels: {
      newGame: textOrDefault(settings?.menuLabels?.newGame, defaults.menuLabels.newGame),
      continueGame: textOrDefault(settings?.menuLabels?.continueGame, defaults.menuLabels.continueGame),
      quit: textOrDefault(settings?.menuLabels?.quit, defaults.menuLabels.quit),
      // resume 은 optional 확장 — 저작된 값이 있을 때만 유지해 구 JSON 을 그대로 보존한다.
      ...(typeof settings?.menuLabels?.resume === "string" && settings.menuLabels.resume.trim()
        ? { resume: settings.menuLabels.resume.trim() }
        : {}),
      ...(typeof settings?.menuLabels?.newGamePlus === "string" && settings.menuLabels.newGamePlus.trim()
        ? { newGamePlus: settings.menuLabels.newGamePlus.trim() }
        : {}),
      ...(typeof settings?.menuLabels?.credits === "string" && settings.menuLabels.credits.trim()
        ? { credits: settings.menuLabels.credits.trim().slice(0, 24) }
        : {}),
    },
    menuVisibility,
    ...(sounds ? { sounds } : {}),
    ...(titleGraphic ? { titleGraphic } : {}),
    showInputHint: settings?.showInputHint !== false,
    // 확장 연출 3종은 전부 omit-when-empty — 레거시 JSON 은 필드가 아예 생기지 않는다(byte-stable).
    ...(backgroundLayers ? { backgroundLayers } : {}),
    ...(particles ? { particles } : {}),
    ...(intro ? { intro } : {}),
    ...(runners ? { runners } : {}),
    ...(pressStart ? { pressStart } : {}),
    // 오프닝 확장(맞춤·렌더링·영역 효과·로고/메뉴 스타일)도 omit-when-empty.
    ...normalizeTitleOpeningFields(settings),
    ...(() => {
      const variants = normalizeTitleScreenVariants(settings?.variants);
      return variants ? { variants } : {};
    })(),
    ...(settings?.resumeOnLaunch === true ? { resumeOnLaunch: true } : {}),
  };
}

/** 타이틀 배경 레이어 상한 — 그 이상은 감독 검수가 불가능한 시각 노이즈다. */
export const MAX_TITLE_BACKGROUND_LAYERS = 4;

function normalizeTitleBackgroundLayers(
  layers: readonly Partial<TitleBackgroundLayer>[] | undefined,
): TitleBackgroundLayer[] | undefined {
  if (!Array.isArray(layers) || layers.length === 0) return undefined;
  const normalized: TitleBackgroundLayer[] = [];
  for (const layer of layers) {
    if (normalized.length >= MAX_TITLE_BACKGROUND_LAYERS) break;
    const resourceId = cleanOptionalId(layer?.resourceId);
    if (!resourceId) continue; // 리소스 없는 레이어는 그릴 것이 없다 — 통째로 버린다.
    const scrollXPerSec = normalizeTitleScrollSpeed(layer.scrollXPerSec);
    const scrollYPerSec = normalizeTitleScrollSpeed(layer.scrollYPerSec);
    const parallax = normalizeTitleParallax(layer.parallax);
    const opacity = normalizeTitleLayerOpacity(layer.opacity);
    const cover = layer.fit === "cover";
    normalized.push({
      resourceId,
      ...(cover ? { fit: "cover" as const } : {}),
      ...(scrollXPerSec !== undefined ? { scrollXPerSec } : {}),
      ...(scrollYPerSec !== undefined ? { scrollYPerSec } : {}),
      ...(parallax !== undefined ? { parallax } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
    });
  }
  return normalized.length > 0 ? normalized : undefined;
}

/** 0/무효는 생략(정지와 동일), 유효 값은 -480..480 px/s 로 클램프. */
function normalizeTitleScrollSpeed(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return undefined;
  return clampNumber(value, -480, 480);
}

/** 기본값 1(또는 무효)은 생략, 유효 값은 0..4 클램프. */
function normalizeTitleParallax(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 1) return undefined;
  return clampNumber(value, 0, 4);
}

/** 기본값(불투명, ≥1)과 무효는 생략, 유효 값은 0..1 클램프. */
function normalizeTitleLayerOpacity(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value >= 1) return undefined;
  return clampNumber(value, 0, 1);
}

function normalizeTitleParticles(
  particles: Partial<TitleParticleSettings> | undefined,
): TitleParticleSettings | undefined {
  if (!particles) return undefined;
  const preset = particles.preset;
  // preset enum 가드 — 무효 프리셋은 파티클 설정 전체를 버린다(런타임이 모르는 값을 그리지 않는다).
  if (preset !== "snow" && preset !== "rain" && preset !== "fireflies" && preset !== "stars") return undefined;
  const density =
    typeof particles.density === "number" && Number.isFinite(particles.density)
      ? clampInteger(particles.density, 0, 100)
      : undefined;
  return { preset, ...(density !== undefined ? { density } : {}) };
}

/** 타이틀 달리기 칩 상한. */
export const MAX_TITLE_RUNNERS = 6;

/** 연계기(듀얼·트리플·4인 테크) 참가 배우 최대 수(시전자 포함). 정규화·조수 검증·편집기 칸·전투 연출이 같은 값을 본다. */
export const COMBO_MAX_ACTORS = 4;

export function normalizeTitleRunners(runners: readonly Partial<TitleRunner>[] | undefined): TitleRunner[] | undefined {
  if (!Array.isArray(runners) || runners.length === 0) return undefined;
  const out: TitleRunner[] = [];
  const num = (value: unknown, min: number, max: number, integer = true): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? (integer ? clampInteger(value, min, max) : clampNumber(value, min, max)) : undefined;
  for (const runner of runners) {
    if (out.length >= MAX_TITLE_RUNNERS) break;
    const resourceId = cleanOptionalId(runner?.resourceId);
    const y = num(runner?.y, 0, 240);
    if (!resourceId || y === undefined) continue;
    const characterIndex = num(runner.characterIndex, 0, 7);
    const speed = num(runner.speed, 10, 400, false);
    const scale = num(runner.scale, 1, 3);
    const delayMs = num(runner.delayMs, 0, 60000);
    const everyMs = num(runner.everyMs, 2000, 120000);
    out.push({
      resourceId, y,
      ...(characterIndex ? { characterIndex } : {}),
      ...(runner.direction === "left" ? { direction: "left" as const } : {}),
      ...(speed !== undefined && speed !== 60 ? { speed } : {}),
      ...(scale !== undefined && scale !== 1 ? { scale } : {}),
      ...(delayMs ? { delayMs } : {}),
      ...(everyMs !== undefined && everyMs !== 12000 ? { everyMs } : {}),
      ...(runner.hop === true ? { hop: true } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

export function normalizeTitlePressStart(value: Partial<TitlePressStart> | undefined): TitlePressStart | undefined {
  if (!value || typeof value !== "object") return undefined;
  const text = typeof value.text === "string" ? value.text.trim().slice(0, 24) : "";
  const blinkMs = typeof value.blinkMs === "number" && Number.isFinite(value.blinkMs) ? clampInteger(value.blinkMs, 300, 3000) : undefined;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? clampInteger(value.y, 0, 240) : undefined;
  return { ...(text ? { text } : {}), ...(blinkMs !== undefined && blinkMs !== 1000 ? { blinkMs } : {}), ...(y !== undefined ? { y } : {}) };
}

function normalizeTitleIntro(intro: Partial<TitleIntroSettings> | undefined): TitleIntroSettings | undefined {
  if (!intro) return undefined;
  // "none" 은 생략과 동일(런타임 기본이 무연출)이라 저장하지 않는다.
  const logo = intro.logo === "fadeIn" || intro.logo === "riseIn" ? intro.logo : undefined;
  const menu = intro.menu === "fadeIn" || intro.menu === "slideUp" ? intro.menu : undefined;
  if (!logo && !menu) return undefined; // 연출이 없으면 delay/stagger 도 의미가 없다.
  const delayMs =
    typeof intro.delayMs === "number" && Number.isFinite(intro.delayMs)
      ? clampInteger(intro.delayMs, 0, 10000)
      : undefined;
  const staggerMs =
    typeof intro.staggerMs === "number" && Number.isFinite(intro.staggerMs)
      ? clampInteger(intro.staggerMs, 0, 2000)
      : undefined;
  return {
    ...(logo ? { logo } : {}),
    ...(menu ? { menu } : {}),
    ...(delayMs !== undefined ? { delayMs } : {}),
    ...(staggerMs !== undefined ? { staggerMs } : {}),
  };
}

function normalizeTitleScreenMenuVisibility(
  visibility: Partial<TitleScreenMenuVisibility> | undefined,
): TitleScreenMenuVisibility {
  return {
    newGame: true,
    continueGame: visibility?.continueGame !== false,
    quit: visibility?.quit !== false,
    // resume 생략은 true 로 읽힌다(!== false). 명시된 boolean 만 보존해 구 JSON 을 바꾸지 않는다.
    ...(typeof visibility?.resume === "boolean" ? { resume: visibility.resume } : {}),
  };
}

function normalizeTitleScreenSounds(
  sounds: Partial<TitleScreenSounds> | undefined,
): TitleScreenSounds | undefined {
  if (!sounds) return undefined;
  const cursorSeResourceId = cleanOptionalId(sounds.cursorSeResourceId);
  const confirmSeResourceId = cleanOptionalId(sounds.confirmSeResourceId);
  const cancelSeResourceId = cleanOptionalId(sounds.cancelSeResourceId);
  if (!cursorSeResourceId && !confirmSeResourceId && !cancelSeResourceId) return undefined;
  return {
    ...(cursorSeResourceId ? { cursorSeResourceId } : {}),
    ...(confirmSeResourceId ? { confirmSeResourceId } : {}),
    ...(cancelSeResourceId ? { cancelSeResourceId } : {}),
  };
}

function normalizeTitleScreenGraphic(
  graphic: Partial<TitleScreenGraphic> | undefined,
  layoutDefaults: TitleScreenSettings["layout"],
): TitleScreenGraphic | undefined {
  if (!graphic) return undefined;
  const mode = normalizeTitleScreenTitleMode(graphic.mode);
  const resourceId = cleanOptionalId(graphic.resourceId);
  if (mode === "text" && !resourceId) return undefined;
  return {
    mode,
    ...(resourceId ? { resourceId } : {}),
    x: clampInteger(graphic.x ?? layoutDefaults.titleX, 0, 320),
    y: clampInteger(graphic.y ?? layoutDefaults.titleY, 0, 240),
  };
}

function normalizeTitleScreenTitleMode(mode: unknown): TitleScreenTitleMode {
  if (mode === "graphic" || mode === "both" || mode === "text") return mode;
  return "text";
}

export function normalizeClassRecord(record: Partial<ClassRecord> & Pick<ClassRecord, "id" | "name">): ClassRecord {
  const learnedSkills = normalizeLearnedSkills(record.learnedSkills, record.skillIds);
  return {
    id: record.id,
    name: record.name,
    options: normalizeClassOptions(record.options),
    animationId: cleanOptionalId(record.animationId),
    skillIds: learnedSkills.map((skill) => skill.skillId),
    battleCommands: normalizeBattleCommands(record.battleCommands),
    learnedSkills,
    promotions: normalizePromotions(record.promotions),
    equipmentPermissions: {
      actorIds: cleanIds(record.equipmentPermissions?.actorIds),
      classIds: cleanIds(record.equipmentPermissions?.classIds),
      equipmentIds: cleanIds(record.equipmentPermissions?.equipmentIds),
    },
    parameterCurves: normalizeParameterCurves(record.parameterCurves),
    expCurve: normalizeExpCurve(record.expCurve),
    stateRates: record.stateRates === undefined
      ? { state_death: "C" }
      : normalizeRates(record.stateRates),
    elementRates: defaultElementRates(record.elementRates),
  };
}

function normalizeClassOptions(options: Partial<ClassRecord["options"]> | undefined): ClassRecord["options"] {
  return {
    dualWield: options?.dualWield ?? false,
    autoBattle: options?.autoBattle ?? false,
    fixedEquipment: options?.fixedEquipment ?? false,
    mightyGuard: options?.mightyGuard ?? false,
  };
}

export function normalizeSkillRecord(record: Partial<SkillRecord> & Pick<SkillRecord, "id" | "name">): SkillRecord {
  return {
    id: record.id,
    name: record.name,
    scope: isSkillScope(record.scope) ? record.scope : "enemy",
    power: clampInteger(record.power ?? 10, -9999, 9999),
    animationId: cleanOptionalId(record.animationId),
    description: record.description ?? "",
    type: record.type ?? "normal",
    mpCost: normalizeMpCost(record.mpCost),
    successRate: clampInteger(record.successRate ?? 100, 0, 100),
    variance: clampInteger(record.variance ?? 0, 0, 100),
    hitRate: clampInteger(record.hitRate ?? 100, 0, 100),
    ...(typeof record.damageFormula === "string" && record.damageFormula.trim() && record.damageFormula.length <= 512 ? { damageFormula: record.damageFormula.trim() } : {}),
    ...(Number.isFinite(record.criticalRate) ? { criticalRate: clampInteger(record.criticalRate!, 0, 100) } : {}),
    ...(Number.isFinite(record.criticalMultiplier) ? { criticalMultiplier: Math.max(1, Math.min(10, record.criticalMultiplier!)) } : {}),
    ...(Number.isFinite(record.cooldownTurns) ? { cooldownTurns: clampInteger(record.cooldownTurns!, 0, 99) } : {}),
    ...(record.oncePerBattle === true ? { oncePerBattle: true } : {}),
    ...(typeof record.fieldCommonEventId === "string" && record.fieldCommonEventId.trim() ? { fieldCommonEventId: record.fieldCommonEventId.trim() } : {}),
    ...(record.unforgettable === true ? { unforgettable: true } : {}),
    ...(Number.isFinite(record.hpCostPercent) && record.hpCostPercent! > 0 ? { hpCostPercent: clampInteger(record.hpCostPercent!, 0, 100) } : {}),
    ...(Number.isFinite(record.drainPercent) && record.drainPercent! > 0 ? { drainPercent: clampInteger(record.drainPercent!, 0, 100) } : {}),
    ...(record.weaponAffinity && Number.isFinite(record.weaponAffinity.bonusPercent) && record.weaponAffinity.bonusPercent > 0
      ? { weaponAffinity: {
          bonusPercent: clampInteger(record.weaponAffinity.bonusPercent, 1, 300),
          ...(Array.isArray(record.weaponAffinity.elementIds) && record.weaponAffinity.elementIds.length
            ? { elementIds: record.weaponAffinity.elementIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).slice(0, 8) }
            : {}),
        } }
      : {}),
    ...(() => {
      const exploit = record.exploitStates;
      if (!exploit || !Number.isFinite(exploit.bonusPercent) || exploit.bonusPercent <= 0 || !Array.isArray(exploit.stateIds)) return {};
      const stateIds = uniqueCleanIds(exploit.stateIds.filter((id): id is string => typeof id === "string")).slice(0, 8);
      if (stateIds.length === 0) return {};
      return { exploitStates: { stateIds, bonusPercent: clampInteger(exploit.bonusPercent, 1, 300), ...(exploit.consume === true ? { consume: true as const } : {}) } };
    })(),
    ...(Number.isFinite(record.recoilPercent) && record.recoilPercent! > 0 ? { recoilPercent: clampInteger(record.recoilPercent!, 0, 100) } : {}),
    ...(normalizeFixedDamage(record.fixedDamage) ? { fixedDamage: normalizeFixedDamage(record.fixedDamage) } : {}),
    ...(normalizeMultiHit(record.multiHit) ? { multiHit: normalizeMultiHit(record.multiHit) } : {}),
    ...(Number.isFinite(record.flinchChance) && record.flinchChance! > 0 ? { flinchChance: clampInteger(record.flinchChance!, 0, 100) } : {}),
    ...(Number.isFinite(record.gaugeShift) && record.gaugeShift !== 0 ? { gaugeShift: clampInteger(record.gaugeShift!, -100, 100) } : {}),
    ...(Number.isFinite(record.chargeTurns) && record.chargeTurns! > 0 ? { chargeTurns: clampInteger(record.chargeTurns!, 1, 3) } : {}),
    ...(Number.isFinite(record.chargeTurns) && record.chargeTurns! > 0 && normalizeChargeBreak(record.chargeBreak) ? { chargeBreak: normalizeChargeBreak(record.chargeBreak) } : {}),
    ...(typeof record.summonResourceId === "string" && record.summonResourceId.trim() ? { summonResourceId: record.summonResourceId.trim().slice(0, 96) } : {}),
    ...(typeof record.retroChoreographyId === "string" && record.retroChoreographyId.trim() ? { retroChoreographyId: record.retroChoreographyId.trim().slice(0, 96) } : {}),
    ...(isPokemonMoveMotion(record.moveMotion) ? { moveMotion: record.moveMotion } : {}),
    ...(Array.isArray(record.hitSequence) && record.hitSequence.length ? { hitSequence: record.hitSequence.slice(0, 16).map(value => Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 1) } : {}),
    ...(normalizeBattleGimmick(record.battleGimmick) ? {battleGimmick:normalizeBattleGimmick(record.battleGimmick)} : {}),
    effect: normalizeSkillEffect(record.effect),
    elementId: typeof record.elementId === "string" ? record.elementId : undefined,
    stateEffects: normalizeStateEffects(record.stateEffects),
    ...(() => {
      const statStageEffects = normalizeStatStageEffects(record.statStageEffects);
      return statStageEffects.length ? { statStageEffects } : {};
    })(),
    ...(normalizeSkillWeather(record.weather) ? { weather: normalizeSkillWeather(record.weather) } : {}),
    ...(typeof record.maxPp === "number" && Number.isFinite(record.maxPp) && record.maxPp > 0
      ? { maxPp: clampInteger(record.maxPp, 1, 99) }
      : {}),
    ...(record.gen1CriticalRate === "high" ? { gen1CriticalRate: "high" as const } : {}),
    // 화이트리스트 정규화라 여기 없으면 왕복 1회에 사라진다(위 defaultBgmResourceId 주석 참조).
    ...(typeof record.movePriority === "number" && record.movePriority !== 0
      ? { movePriority: clampInteger(record.movePriority, -7, 7) }
      : {}),
    ...(() => {
      const actionSkill = normalizeActionSkillProfile(record.actionSkill);
      return actionSkill ? { actionSkill } : {};
    })(),
    // 연계기·범위기는 값이 있을 때만 남긴다 — 없는 옆 프로젝트는 바이트 그대로.
    ...(() => {
      const comboActorIds = uniqueCleanIds(record.comboActorIds).slice(0, COMBO_MAX_ACTORS);
      if (comboActorIds.length < 2) return {};
      const comboRequires = Array.isArray(record.comboRequires)
        ? record.comboRequires.flatMap((entry) => {
            const actorId = typeof entry?.actorId === "string" ? entry.actorId.trim() : "";
            const skillId = typeof entry?.skillId === "string" ? entry.skillId.trim() : "";
            return actorId && skillId && comboActorIds.includes(actorId) ? [{ actorId, skillId }] : [];
          })
        : [];
      return {
        comboActorIds,
        ...(comboRequires.length > 0 ? { comboRequires } : {}),
        ...(record.comboCombinedStats === true ? { comboCombinedStats: true as const } : {}),
        ...(typeof record.comboSwitchId === "string" && record.comboSwitchId.trim() ? { comboSwitchId: record.comboSwitchId.trim() } : {}),
        ...(() => {
          const staging = normalizeComboStaging(record.comboStaging);
          return staging ? { comboStaging: staging } : {};
        })(),
        ...(() => {
          const rows = Array.isArray(record.comboMpCosts)
            ? record.comboMpCosts.flatMap((entry) => {
                const actorId = typeof entry?.actorId === "string" ? entry.actorId.trim() : "";
                return actorId && comboActorIds.includes(actorId) && Number.isFinite(entry.mp)
                  ? [{ actorId, mp: clampInteger(entry.mp, 0, 9999) }] : [];
              })
            : [];
          const unique = rows.filter((row, index) => rows.findIndex((other) => other.actorId === row.actorId) === index);
          return unique.length > 0 ? { comboMpCosts: unique } : {};
        })(),
      };
    })(),
    ...(record.area && (record.area.shape === "circle" || record.area.shape === "line")
      && Number.isFinite(record.area.radius) && record.area.radius > 0
      ? { area: { shape: record.area.shape, radius: clampNumber(record.area.radius, 1, 640) } }
      : {}),
    // 전투 자원(battleGauges) — 0/false 는 저장하지 않는다(옛 JSON 바이트 유지).
    ...(typeof record.resource2Cost === "number" && Number.isFinite(record.resource2Cost) && record.resource2Cost > 0
      ? { resource2Cost: clampInteger(record.resource2Cost, 1, 999) }
      : {}),
    ...(record.limitSkill === true ? { limitSkill: true } : {}),
    ...(typeof record.partyGaugeCost === "number" && Number.isFinite(record.partyGaugeCost) && record.partyGaugeCost > 0
      ? { partyGaugeCost: clampInteger(record.partyGaugeCost, 1, 999) }
      : {}),
    ...(record.learnable === true ? { learnable: true } : {}),
    ...(() => {
      const inputSequence = normalizeSkillInputSequence(record.inputSequence);
      return inputSequence ? { inputSequence } : {};
    })(),
  };
}

export function normalizeItemRecord(record: Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">): ItemRecord {
  return {
    id: record.id,
    name: record.name,
    imageResourceId: cleanOptionalId(record.imageResourceId),
    iconResourceId: cleanOptionalId(record.iconResourceId),
    scope: isItemScope(record.scope) ? record.scope : "ally",
    price: clampInteger(record.price ?? 0, 0, 999999),
    skillId: cleanOptionalId(record.skillId),
    description: record.description ?? "",
    // Before item kinds existed, skill-backed items only stored skillId (v3).
    // Infer only an absent kind; an explicitly authored kind must remain authoritative.
    type: record.type === undefined && cleanOptionalId(record.skillId) ? "special" : normalizeItemType(record.type),
    occasion: record.occasion ?? "always",
    consumable: record.consumable ?? true,
    animationId: cleanOptionalId(record.animationId),
    stateEffects: normalizeStateEffects(record.stateEffects),
    consumptionLimit: normalizeConsumptionLimit(record.consumptionLimit),
    usableActorIds: cleanIds(record.usableActorIds),
    usableClassIds: cleanIds(record.usableClassIds),
    healStateIds: cleanIds(record.healStateIds),
    hpRecovery: normalizeRecovery(record.hpRecovery),
    mpRecovery: normalizeRecovery(record.mpRecovery),
    ...(record.ppRecovery && (record.ppRecovery.flat > 0 || record.ppRecovery.percentMax > 0)
      ? { ppRecovery: normalizeRecovery(record.ppRecovery) } : {}),
    onlyUsableInMenu: record.onlyUsableInMenu ?? false,
    onlyEffectiveOnDeadActors: record.onlyEffectiveOnDeadActors ?? false,
    learnedSkillId: cleanOptionalId(record.learnedSkillId),
    activateSkillId: cleanOptionalId(record.activateSkillId),
    usageMessage: record.usageMessage === "skill" ? "skill" : "normal",
    switchId: cleanOptionalId(record.switchId),
    occasionField: record.occasionField ?? (record.occasion === "field" || record.occasion === "always"),
    occasionBattle: record.occasionBattle ?? (record.occasion === "battle" || record.occasion === "always"),
    seedParameterBonuses: normalizeSeedBonuses(record.seedParameterBonuses),
    equipmentProfile: normalizeItemEquipmentProfile(record.equipmentProfile),
    farmTool: isFarmTool(record.farmTool) ? record.farmTool : undefined,
    captureProfile: normalizeCaptureProfile(record.captureProfile),
    careProfile: normalizeCareProfile(record.careProfile),
    ...(normalizeHeldItemEffect(record.heldEffect) ? { heldEffect: normalizeHeldItemEffect(record.heldEffect) } : {}),
    ...(isItemBagPocket(record.pocket) ? { pocket: record.pocket } : {}),
    ...(normalizeRepelSteps(record.repelSteps) !== undefined ? { repelSteps: normalizeRepelSteps(record.repelSteps) } : {}),
    ...(normalizeRepelSteps(record.repelSteps) !== undefined && record.repelBelowLead === true ? { repelBelowLead: true } : {}),
    ...(record.escapeTo === "entrance" ? { escapeTo: "entrance" as const } : {}),
  };
}

const ITEM_BAG_POCKETS: readonly string[] = ["items", "balls", "machines", "held", "key"];
function isItemBagPocket(value: unknown): value is ItemBagPocket {
  return typeof value === "string" && ITEM_BAG_POCKETS.includes(value);
}

export function normalizeEquipmentRecord(record: Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">): EquipmentRecord {
  return {
    ...(record.battleMotionStyle && CHARACTER_MOTION_STYLES.includes(record.battleMotionStyle) ? {battleMotionStyle:record.battleMotionStyle} : {}),
    id: record.id,
    name: record.name,
    imageResourceId: cleanOptionalId(record.imageResourceId),
    iconResourceId: cleanOptionalId(record.iconResourceId),
    slot: record.slot ?? "weapon",
    price: clampInteger(record.price ?? 0, 0, 999999),
    skillId: cleanOptionalId(record.skillId),
    description: record.description ?? "",
    statBonuses: normalizeStatBonuses(record.statBonuses),
    equippableActorIds: cleanIds(record.equippableActorIds),
    equippableClassIds: cleanIds(record.equippableClassIds),
    cursed: record.cursed ?? false,
    twoHanded: record.twoHanded ?? false,
    accuracy: clampInteger(record.accuracy ?? 100, 0, 100),
    criticalRate: clampInteger(record.criticalRate ?? 0, 0, 100),
    usableAsItemSkillId: cleanOptionalId(record.usableAsItemSkillId),
    attackElementIds: cleanIds(record.attackElementIds),
    stateInflictIds: cleanIds(record.stateInflictIds),
    stateInflictionChance: clampInteger(record.stateInflictionChance ?? 100, 0, 100),
    effectFlags: normalizeItemEquipmentEffectFlags(record.effectFlags),
    elementalDefenseIds: cleanIds(record.elementalDefenseIds),
    stateDefenseIds: cleanIds(record.stateDefenseIds),
    stateDefenseMode: record.stateDefenseMode === "inflict" ? "inflict" : "resist",
    stateResistanceChance: clampInteger(record.stateResistanceChance ?? 0, 0, 100),
    ...(record.damageDealtPercent ? { damageDealtPercent: clampInteger(record.damageDealtPercent, -90, 300) } : {}),
    ...(record.damageTakenPercent ? { damageTakenPercent: clampInteger(record.damageTakenPercent, -90, 300) } : {}),
    ...(() => {
      const actionWeapon = normalizeActionWeaponProfile(record.actionWeapon);
      return actionWeapon ? { actionWeapon } : {};
    })(),
    ...(() => {
      const grantsSkillIds = uniqueCleanIds(record.grantsSkillIds);
      return grantsSkillIds.length > 0 ? { grantsSkillIds } : {};
    })(),
    ...(() => {
      const grantsCommand = normalizeGrantedCommand(record.grantsCommand);
      return grantsCommand ? { grantsCommand } : {};
    })(),
    ...(() => {
      const apGrants = normalizeApGrants(record.apGrants);
      return apGrants.length > 0 ? { apGrants } : {};
    })(),
    ...(typeof record.apRate === "number" && Number.isFinite(record.apRate) && Math.round(record.apRate) !== 100 ? { apRate: clampInteger(record.apRate, 1, 1000) } : {}),
    ...(() => {
      const levelUpBonus = normalizeLevelUpBonus(record.levelUpBonus);
      return levelUpBonus ? { levelUpBonus } : {};
    })(),
  };
}

/** 마석 AP 항목: 스킬 id 가 있고 필요 AP 가 양의 정수인 것만, 같은 스킬은 뒤의 것이 이긴다. */
export function normalizeApGrants(grants: readonly Partial<EquipmentApGrant>[] | undefined): EquipmentApGrant[] {
  if (!Array.isArray(grants)) return [];
  const bySkill = new Map<string, number>();
  for (const grant of grants) {
    const skillId = cleanOptionalId(grant?.skillId);
    if (!skillId || typeof grant?.ap !== "number" || !Number.isFinite(grant.ap) || grant.ap <= 0) continue;
    bySkill.set(skillId, clampInteger(grant.ap, 1, 99999));
  }
  return [...bySkill].slice(0, 64).map(([skillId, ap]) => ({ skillId, ap }));
}

export function normalizeLevelUpBonus(bonus: Partial<EquipmentLevelUpBonus> | undefined): EquipmentLevelUpBonus | undefined {
  if (!bonus || typeof bonus !== "object") return undefined;
  const out: EquipmentLevelUpBonus = {};
  for (const key of ["maxHpPercent", "maxMpPercent"] as const) {
    const value = bonus[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) out[key] = clampInteger(value, 1, 100);
  }
  for (const key of ["attack", "defense", "mind", "agility"] as const) {
    const value = bonus[key];
    if (typeof value === "number" && Number.isFinite(value) && value !== 0) out[key] = clampInteger(value, -99, 99);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeGrantedCommand(command: Partial<ClassBattleCommand> | undefined): ClassBattleCommand | undefined {
  if (!command || typeof command !== "object") return undefined;
  const id = cleanOptionalId(command.id);
  if (!id) return undefined;
  const skillId = cleanOptionalId(command.skillId);
  const skillSubsetName = cleanOptionalId(command.skillSubsetName);
  return {
    id,
    name: typeof command.name === "string" ? command.name : "",
    kind: normalizeBattleCommandKind(command.kind),
    ...(skillSubsetName ? { skillSubsetName } : {}),
    ...(skillId ? { skillId } : {}),
  };
}

function normalizePromotions(promotions: readonly Partial<ClassPromotion>[] | undefined): ClassPromotion[] | undefined {
  const normalized = (promotions ?? [])
    .flatMap((promotion): ClassPromotion[] => {
      const toClassId = cleanOptionalId(promotion.toClassId);
      if (!toClassId) return [];
      return [{ toClassId, requires: normalizePromotionRequirement(promotion.requires) }];
    });
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePromotionRequirement(requires: Partial<ClassPromotionRequirement> | undefined): ClassPromotionRequirement {
  assertPromotionExtensions(requires);
  const variableId = cleanOptionalId(requires?.variableId);
  return {
    ...(requires?.requiredSkillIds !== undefined ? { requiredSkillIds: [...requires.requiredSkillIds] } : {}),
    ...(requires?.requiredNodes !== undefined ? { requiredNodes: structuredClone(requires.requiredNodes) } : {}),
    ...(requires?.requiredTreePoints !== undefined ? { requiredTreePoints: structuredClone(requires.requiredTreePoints) } : {}),
    level: typeof requires?.level === "number" ? clampInteger(requires.level, 1, ACTOR_LEVEL_MAX) : undefined,
    switchId: cleanOptionalId(requires?.switchId),
    itemId: cleanOptionalId(requires?.itemId),
    variableId,
    atLeast: variableId && typeof requires?.atLeast === "number" ? clampInteger(requires.atLeast, -999999, 999999) : undefined,
  };
}

function normalizeBattleCommands(commands: readonly Partial<ClassBattleCommand>[] | undefined): ClassBattleCommand[] {
  const source: readonly Partial<ClassBattleCommand>[] = commands?.length ? commands : [];
  return source.map((command, index) => ({
    id: cleanOptionalId(command.id) ?? `cmd_${index + 1}`,
    name: command.name ?? "Command",
    kind: normalizeBattleCommandKind(command.kind),
    skillSubsetName: cleanOptionalId(command.skillSubsetName),
    skillId: cleanOptionalId(command.skillId),
    ...(cleanOptionalId(command.commonEventId) ? { commonEventId: cleanOptionalId(command.commonEventId) } : {}),
  }));
}

function normalizeBattleCommandKind(kind: ClassBattleCommand["kind"] | undefined): ClassBattleCommand["kind"] {
  return kind === "skill" || kind === "skillSubset" || kind === "defend" || kind === "guard" || kind === "item" || kind === "capture" || kind === "escape" || kind === "switch" || kind === "event" || kind === "commonEvent"
    ? kind
    : "attack";
}

function normalizeBattleFlow(value: BattleFlow | undefined): BattleFlow {
  return value === "strict" ? "strict" : "gauge";
}

function normalizeCompanionConfig(value: CompanionConfig | undefined): CompanionConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: CompanionConfig = {};
  if (typeof value.gap === "number" && Number.isFinite(value.gap)) out.gap = Math.trunc(value.gap);
  if (typeof value.maxCompanions === "number" && Number.isFinite(value.maxCompanions)) out.maxCompanions = Math.trunc(value.maxCompanions);
  if (value.overflow === "reject" || value.overflow === "replaceOldest") out.overflow = value.overflow;
  if (value.formation === "line" || value.formation === "beside") out.formation = value.formation;
  if (value.clearOnTransfer === true) out.clearOnTransfer = true;
  if (value.fromParty === true) out.fromParty = true;
  if (value.spreadWhenBlocked === true) out.spreadWhenBlocked = true;
  if (value.fanOutInScenes === true) out.fanOutInScenes = true;
  if (value.display === "scenesOnly") out.display = "scenesOnly";
  if (value.sceneFormation === "abreast") out.sceneFormation = "abreast";
  if (value.monsterFollowers === false) out.monsterFollowers = false;
  if (value.followMode === "spaced" || value.followMode === "breadcrumb") out.followMode = value.followMode;
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeOptionalPositiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.min(99, Math.trunc(value)));
}

function positiveNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function normalizeLearnedSkills(skills: readonly Partial<ActorLearnedSkill>[] | undefined, legacy: readonly string[] = []): ActorLearnedSkill[] {
  const source = skills ?? legacy.map((skillId) => ({ level: 1, skillId }));
  return source
    .filter((skill): skill is ActorLearnedSkill => typeof skill.skillId === "string" && skill.skillId.length > 0)
    .map((skill) => ({ level: clampLevel(skill.level ?? 1), skillId: skill.skillId }))
    .sort((left, right) => left.level - right.level || left.skillId.localeCompare(right.skillId));
}

function normalizeParameterCurves(curves: Partial<ActorParameterCurves> | undefined): ActorParameterCurves {
  return {
    maxHp: normalizeCurve(curves?.maxHp),
    maxMp: normalizeCurve(curves?.maxMp),
    attack: normalizeCurve(curves?.attack),
    defense: normalizeCurve(curves?.defense),
    mind: normalizeCurve(curves?.mind),
    agility: normalizeCurve(curves?.agility),
  };
}

function normalizeCurve(curve: readonly number[] | undefined): number[] {
  if (curve && curve.length >= ACTOR_LEVEL_MAX) return curve.slice(0, ACTOR_LEVEL_MAX).map((value) => clampInteger(value, 1, 99999));
  return Array.from({ length: ACTOR_LEVEL_MAX }, (_, index) => 20 + index * 4);
}

function normalizeExpCurve(curve: Partial<ActorExperienceCurve> | undefined): ActorExperienceCurve {
  return {
    base: clampInteger(curve?.base ?? 1, 0, 999999),
    extra: clampInteger(curve?.extra ?? 677, 0, 999999),
    acceleration: clampInteger(curve?.acceleration ?? 40, 0, 999999),
  };
}

function normalizeMpCost(cost: Partial<SkillMpCost> | undefined): SkillMpCost {
  return { flat: clampInteger(cost?.flat ?? 0, 0, 9999), percentMax: clampInteger(cost?.percentMax ?? 0, 0, 100) };
}

function normalizeRecovery(cost: Partial<SkillMpCost> | undefined): SkillMpCost {
  return { flat: clampInteger(cost?.flat ?? 0, 0, 999), percentMax: clampInteger(cost?.percentMax ?? 0, 0, 100) };
}

function normalizeSkillEffect(effect: SkillEffect | undefined): SkillEffect {
  if (effect?.kind === "randomSkillFrom") return { kind: "randomSkillFrom", skillIds: uniqueCleanIds(effect.skillIds).slice(0, 16) };
  if (effect?.kind === "rage") {
    const enemyIds = uniqueCleanIds(effect.enemyIds ?? []).slice(0, 24);
    return enemyIds.length > 0 ? { kind: "rage", enemyIds } : { kind: "rage" };
  }
  return effect ?? { kind: "damage", statistic: "attack", affects: "hp" };
}

/** 능력치 단계 효과 정규화: 모르는 stat·0 단계는 버린다(툴 쪽이 먼저 거절한다). 최대 4개. */
export function normalizeStatStageEffects(effects: readonly Partial<SkillStatStageEffect>[] | undefined): SkillStatStageEffect[] {
  if (!Array.isArray(effects)) return [];
  return effects
    .filter((effect): effect is Partial<SkillStatStageEffect> & { stat: SkillStatStageEffect["stat"] } => isStatStageKey(effect?.stat))
    .flatMap((effect) => {
      const stages = clampInteger(Number(effect.stages ?? 0), STAT_STAGE_MIN, STAT_STAGE_MAX);
      if (stages === 0) return [];
      const chance = clampInteger(Number(effect.chance ?? 100), 0, 100);
      return [{
        stat: effect.stat,
        stages,
        ...(chance < 100 ? { chance } : {}),
        ...(effect.target === "self" ? { target: "self" as const } : {}),
      }];
    })
    .slice(0, 4);
}

function normalizeStateEffects(effects: readonly Partial<DatabaseStateEffect>[] | undefined): DatabaseStateEffect[] {
  return (effects ?? [])
    .filter((effect): effect is DatabaseStateEffect => typeof effect.stateId === "string" && effect.stateId.length > 0)
    .map((effect) => ({ stateId: effect.stateId, chance: clampInteger(effect.chance ?? 100, 0, 100), operation: effect.operation ?? "add" }));
}

/** 장비 능력치. 음수는 무거운 무기·갑옷의 감점이다 — 0으로 자르면 저장 왕복에 사라진다. */
function normalizeStatBonuses(bonuses: Partial<EquipmentStatBonuses> | undefined): EquipmentStatBonuses {
  return {
    attack: clampInteger(bonuses?.attack ?? 0, -9999, 9999),
    defense: clampInteger(bonuses?.defense ?? 0, -9999, 9999),
    mind: clampInteger(bonuses?.mind ?? 0, -9999, 9999),
    agility: clampInteger(bonuses?.agility ?? 0, -9999, 9999),
  };
}

function normalizeSeedBonuses(bonuses: Partial<EquipmentStatBonuses> | undefined): EquipmentStatBonuses {
  return {
    attack: clampInteger(bonuses?.attack ?? 0, -50, 50),
    defense: clampInteger(bonuses?.defense ?? 0, -50, 50),
    mind: clampInteger(bonuses?.mind ?? 0, -50, 50),
    agility: clampInteger(bonuses?.agility ?? 0, -50, 50),
  };
}

function normalizeCaptureProfile(profile: Partial<ItemCaptureProfile> | undefined): ItemCaptureProfile | undefined {
  if (!profile) return undefined;
  const multiplier = typeof profile.multiplier === "number" && Number.isFinite(profile.multiplier)
    ? Math.max(0.01, Math.min(100, profile.multiplier))
    : 1;
  return {
    multiplier,
    ...(isGen1BallClass(profile.ballClass) ? { ballClass: profile.ballClass } : {}),
    ...(normalizeCaptureCondition(profile.condition) ? { condition: normalizeCaptureCondition(profile.condition) } : {}),
  };
}

function isGen1BallClass(value: unknown): value is NonNullable<ItemCaptureProfile["ballClass"]> {
  return value === "poke" || value === "great" || value === "ultra" || value === "master";
}

function isGen1MajorStatus(value: unknown): value is NonNullable<StateRecord["gen1MajorStatus"]> {
  return value === "poison" || value === "toxic" || value === "burn" || value === "sleep" || value === "freeze" || value === "paralysis";
}

function normalizeCareProfile(profile: Partial<ItemCareProfile> | undefined): ItemCareProfile | undefined {
  if (!profile) return undefined;
  if (profile.kind !== "feed" && profile.kind !== "toy") return undefined;
  const friendshipDelta = typeof profile.friendshipDelta === "number" && Number.isFinite(profile.friendshipDelta)
    ? Math.trunc(profile.friendshipDelta)
    : 0;
  const expDelta = typeof profile.expDelta === "number" && Number.isFinite(profile.expDelta)
    ? Math.max(0, Math.trunc(profile.expDelta))
    : undefined;
  const levelUp = typeof profile.levelUp === "number" && Number.isFinite(profile.levelUp) && profile.levelUp >= 1
    ? Math.min(10, Math.trunc(profile.levelUp))
    : undefined;
  return {
    kind: profile.kind,
    friendshipDelta,
    ...(expDelta !== undefined ? { expDelta } : {}),
    ...(levelUp !== undefined ? { levelUp } : {}),
  };
}

export function normalizeMonsterCare(config: Partial<MonsterCareConfig> | undefined): MonsterCareConfig | undefined {
  if (!config) return undefined;
  const stepsPerTickRaw = typeof config.stepsPerTick === "number" && Number.isFinite(config.stepsPerTick)
    ? Math.trunc(config.stepsPerTick)
    : 50;
  return {
    stepsPerTick: stepsPerTickRaw > 0 ? stepsPerTickRaw : 50,
    walkFriendship: clampInteger(
      typeof config.walkFriendship === "number" && Number.isFinite(config.walkFriendship) ? config.walkFriendship : 1,
      0,
      1000
    ),
    walkExp: clampInteger(
      typeof config.walkExp === "number" && Number.isFinite(config.walkExp) ? config.walkExp : 1,
      0,
      999999
    ),
    dailyCareCap: clampInteger(
      typeof config.dailyCareCap === "number" && Number.isFinite(config.dailyCareCap) ? config.dailyCareCap : 30,
      0,
      999999
    ),
  };
}

function normalizeItemEquipmentProfile(profile: Partial<ItemEquipmentProfile> | undefined): ItemEquipmentProfile {
  return {
    statBonuses: normalizeItemEquipmentBonuses(profile?.statBonuses),
    equippableActorIds: cleanIds(profile?.equippableActorIds),
    equippableClassIds: cleanIds(profile?.equippableClassIds),
    twoHanded: profile?.twoHanded ?? false,
    mpCost: clampInteger(profile?.mpCost ?? 0, 0, 999),
    accuracy: clampInteger(profile?.accuracy ?? 90, 0, 100),
    criticalRate: clampInteger(profile?.criticalRate ?? 0, 0, 100),
    attackElementIds: cleanIds(profile?.attackElementIds),
    stateInflictIds: cleanIds(profile?.stateInflictIds),
    stateInflictionChance: clampInteger(profile?.stateInflictionChance ?? 100, 0, 100),
    effectFlags: normalizeItemEquipmentEffectFlags(profile?.effectFlags),
    elementalDefenseIds: cleanIds(profile?.elementalDefenseIds),
    stateDefenseIds: cleanIds(profile?.stateDefenseIds),
    stateDefenseMode: profile?.stateDefenseMode === "inflict" ? "inflict" : "resist",
    stateResistanceChance: clampInteger(profile?.stateResistanceChance ?? 0, 0, 100),
  };
}

function normalizeItemEquipmentBonuses(bonuses: Partial<EquipmentStatBonuses> | undefined): EquipmentStatBonuses {
  return {
    attack: clampInteger(bonuses?.attack ?? 0, -500, 500),
    defense: clampInteger(bonuses?.defense ?? 0, -500, 500),
    mind: clampInteger(bonuses?.mind ?? 0, -500, 500),
    agility: clampInteger(bonuses?.agility ?? 0, -500, 500),
  };
}

function normalizeItemEquipmentEffectFlags(flags: Partial<ItemEquipmentEffectFlags> | undefined): ItemEquipmentEffectFlags {
  return {
    preemptive: flags?.preemptive ?? false,
    doubleAttack: flags?.doubleAttack ?? false,
    attackAll: flags?.attackAll ?? false,
    ignoreDodge: flags?.ignoreDodge ?? false,
    preventCriticalHits: flags?.preventCriticalHits ?? false,
    increasePhysicalDodge: flags?.increasePhysicalDodge ?? false,
    halfMpCost: flags?.halfMpCost ?? false,
    negateTerrainDamage: flags?.negateTerrainDamage ?? false,
    fixedEquipment: flags?.fixedEquipment ?? false,
    ...(typeof flags?.autoRevive === "number" && Number.isFinite(flags.autoRevive) && flags.autoRevive > 0
      ? { autoRevive: clampInteger(flags.autoRevive, 1, 100) }
      : {}),
  };
}

function defaultElementRates(overrides: Record<string, ActorRateGrade> | undefined): Record<string, ActorRateGrade> {
  const rates: Record<string, ActorRateGrade> = {};
  for (const element of DEFAULT_ELEMENT_RATE_LABELS) rates[element.id] = "C";
  return { ...rates, ...normalizeRates(overrides) };
}

function normalizeRates(rates: Record<string, ActorRateGrade> | undefined): Record<string, ActorRateGrade> {
  const normalized: Record<string, ActorRateGrade> = {};
  for (const [id, grade] of Object.entries(rates ?? {})) normalized[id] = ACTOR_RATE_GRADES.includes(grade) ? grade : "C";
  return normalized;
}

function cleanIds(ids: readonly string[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((id) => id.trim().length > 0))];
}

function uniqueCleanIds(ids: readonly string[] | undefined): string[] {
  return [...new Set((ids ?? []).flatMap((id) => {
    const trimmed = id.trim();
    return trimmed ? [trimmed] : [];
  }))];
}

function cleanOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * 저작자가 이 슬롯을 "빈 값" 으로 명시했는가 — 키가 있고 내용이 공백뿐인 문자열일 때.
 *
 * 기본값이 있는 리소스 슬롯에서 "생략(기본값 원함)" 과 "무음/없음 선택" 을 갈라내는 데 쓴다.
 * 키 자체가 없으면 false — 그건 구 JSON 이거나 신경 쓰지 않은 것이므로 기본값을 채워야 한다.
 */
function hasExplicitSilence<K extends string>(
  settings: Partial<Record<K, unknown>> | undefined,
  key: K,
): boolean {
  if (settings === undefined || !(key in settings)) return false;
  const value = settings[key];
  return typeof value === "string" && value.trim().length === 0;
}

function textOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function isSkillScope(value: unknown): value is SkillRecord["scope"] {
  return value === "self" || value === "ally" || value === "allAllies" || value === "enemy" || value === "allEnemies";
}

function isItemScope(value: unknown): value is ItemRecord["scope"] {
  return value === "none" || value === "ally" || value === "allAllies" || value === "enemy";
}

function normalizeItemType(value: unknown): ItemRecord["type"] {
  if (
    value === "normalGoods" ||
    value === "weapon" ||
    value === "shield" ||
    value === "body" ||
    value === "head" ||
    value === "accessory" ||
    value === "medicine" ||
    value === "book" ||
    value === "seed" ||
    value === "special" ||
    value === "switch"
  ) {
    return value;
  }
  if (value === "key") return "normalGoods";
  if (value === "skillBook") return "book";
  if (value === "normal") return "medicine";
  return "normalGoods";
}

function normalizeConsumptionLimit(value: unknown): ItemConsumptionLimit {
  if (value === "noLimit") return "noLimit";
  const numeric = typeof value === "number" ? value : Number(value);
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5) return numeric;
  return "noLimit";
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function optionalLabel(value: unknown): { label?: string } {
  return typeof value === "string" && value.trim() ? { label: value.trim().slice(0, 16) } : {};
}

function optionalNonNegative(key: string, value: unknown, max: number): Record<string, number> {
  return typeof value === "number" && Number.isFinite(value) ? { [key]: clampNumber(value, 0, max) } : {};
}

function normalizeLimitGauge(value: SystemRecords["limitGauge"]): SystemRecords["limitGauge"] {
  if (!value || typeof value !== "object") return undefined;
  return {
    enabled: value.enabled === true,
    ...optionalLabel(value.label),
    ...optionalNonNegative("takenRate", value.takenRate, 1000),
    ...optionalNonNegative("dealtGain", value.dealtGain, 100),
  };
}

function normalizeResource2(value: SystemRecords["resource2"]): SystemRecords["resource2"] {
  if (!value || typeof value !== "object") return undefined;
  return {
    enabled: value.enabled === true,
    ...optionalLabel(value.label),
    ...(typeof value.max === "number" && Number.isFinite(value.max) ? { max: clampInteger(value.max, 1, 999) } : {}),
    ...optionalNonNegative("start", value.start, 999),
    ...optionalNonNegative("dealtGain", value.dealtGain, 999),
    ...optionalNonNegative("takenGain", value.takenGain, 999),
  };
}

function normalizePartyGauge(value: SystemRecords["partyGauge"]): SystemRecords["partyGauge"] {
  if (!value || typeof value !== "object") return undefined;
  return {
    enabled: value.enabled === true,
    ...optionalLabel(value.label),
    ...(typeof value.max === "number" && Number.isFinite(value.max) ? { max: clampInteger(value.max, 1, 999) } : {}),
    ...optionalNonNegative("gainPerHit", value.gainPerHit, 999),
  };
}

function normalizeEmotionCycle(value: SystemRecords["emotionCycle"]): SystemRecords["emotionCycle"] {
  if (!Array.isArray(value)) return undefined;
  const rules = value.flatMap((rule) => {
    if (!rule || typeof rule !== "object") return [];
    const attackerFamily = typeof rule.attackerFamily === "string" ? rule.attackerFamily.trim() : "";
    const targetFamily = typeof rule.targetFamily === "string" ? rule.targetFamily.trim() : "";
    if (!attackerFamily || !targetFamily || typeof rule.multiplier !== "number" || !Number.isFinite(rule.multiplier)) return [];
    return [{ attackerFamily, targetFamily, multiplier: clampNumber(rule.multiplier, 0, 10) }];
  });
  return rules.length > 0 ? rules : undefined;
}
