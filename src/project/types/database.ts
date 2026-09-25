import type {
  ActorId,
  BattleAnimationId,
  CharacterFootprint,
  ClassId,
  CropId,
  Dir,
  EnemyId,
  EquipmentId,
  ItemId,
  MapId,
  MonsterSpeciesId,
  SkillId,
  StateId,
  TroopId,
} from "./base";
import type { Command, Condition, EventPageGraphic, WeatherKind } from "./events";
import type { Season, TimePhase, TimeSystemConfig } from "../gameTime";
import type { GenrePackId } from "../genrePackId";
import type { CinematicSequence, GameOverSettings } from "../cinematicSettings";

export interface CharacterAppearanceRecord {
  id: string;
  name: string;
  description: string;
  charset?: { resourceId: string; characterIndex: number };
  face?: { resourceId: string };
  bust?: { resourceId: string };
}

export interface ActorRecord {
  id: ActorId;
  name: string;
  nickname: string;
  classId: ClassId;
  initialLevel: number;
  maxLevel: number;
  /** 낱장 얼굴 리소스 id(예: easyrpg-faceset-actor1-07). 시트+칸 짝은 v4 마이그레이션이 없앴다. */
  faceResourceId?: string;
  characterResourceId?: string;
  /** Optional charset character index (0..7). Omitted means 0 for legacy projects. */
  characterIndex?: number;
  appearanceId?: string;
  characterTransparent: boolean;
  battleCharacterResourceId?: string;
  critical: ActorCritical;
  parameterCurves: ActorParameterCurves;
  expCurve: ActorExperienceCurve;
  initialEquipment: ActorInitialEquipment;
  unarmedAnimationId?: BattleAnimationId;
  options: ActorOptions;
  learnedSkills: ActorLearnedSkill[];
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
}

export type ActorRateGrade = "A" | "B" | "C" | "D" | "E";

export type ActorParameterKey = "maxHp" | "maxMp" | "attack" | "defense" | "mind" | "agility";

export type ActorParameterCurves = Record<ActorParameterKey, number[]>;

export interface ActorCritical {
  enabled: boolean;
  chanceDenominator: number;
}

export interface ActorExperienceCurve {
  base: number;
  extra: number;
  acceleration: number;
}

/** Slot IDs reference the project catalog, including the five legacy built-ins. */
export type ActorInitialEquipment = Partial<Record<string, EquipmentId>>;

export interface EquipmentSlotRecord {
  id: string;
  label: string;
}

export interface ActorOptions {
  dualWield: boolean;
  autoBattle: boolean;
  fixedEquipment: boolean;
  mightyGuard: boolean;
}

export interface ActorLearnedSkill {
  level: number;
  skillId: SkillId;
}

export interface ClassRecord {
  id: ClassId;
  name: string;
  options: ClassOptions;
  animationId?: BattleAnimationId;
  skillIds: SkillId[];
  battleCommands: ClassBattleCommand[];
  learnedSkills: ActorLearnedSkill[];
  promotions?: ClassPromotion[];
  equipmentPermissions: ClassEquipmentPermissions;
  parameterCurves: ActorParameterCurves;
  expCurve: ActorExperienceCurve;
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
}

export interface ClassPromotion {
  toClassId: ClassId;
  requires: ClassPromotionRequirement;
}

export interface ClassPromotionRequirement {
  requiredSkillIds?: SkillId[];
  requiredNodes?: import('../growth/types').NodeRankRequirement[];
  requiredTreePoints?: { treeId: string; points: number }[];
  level?: number;
  switchId?: string;
  itemId?: ItemId;
  variableId?: string;
  atLeast?: number;
}

export interface ClassOptions {
  dualWield: boolean;
  autoBattle: boolean;
  fixedEquipment: boolean;
  mightyGuard: boolean;
}

export type BattleFlow = "gauge" | "strict";

/** 전투 화면 UI 스킨 — @/battle/skins/registry 의 11-스킨 union + legacy 별칭 2종.
 *  "rm2003" 은 정면 전투 스킨의 옛 id(2026-09-03 개명 전) 이고 "classic" 은 그보다 앞선 별칭이다.
 *  둘 다 resolveSkinId 가 rm2000 으로 매핑한다 — 저장된 프로젝트가 깨지지 않게 타입에는 남긴다. */
export type BattleUiStyle =
  | "pokemon" | "rm2000" | "octopath" | "chrono"
  | "bravely" | "dragonquest" | "ff" | "mother" | "goldensun" | "mv" | "vxace"
  | "rm2003" // 측면 전투(2026-09-03 되살림 — 그 전 몇 시간은 rm2000 의 옛 id 였다)
  | "classic"; // legacy alias, remapped by resolveSkinId → rm2000

/** ESC(X) 게임 메뉴 스킨 — @/player/menuSkins/registry 의 id union. 프로젝트 파일에 저장되므로
 *  id 를 함부로 바꾸지 않는다. 미설정·미지값은 resolveMenuSkinId 가 workbench 로 푼다. */
export type MenuUiStyle = "field-list" | "workbench" | "party-first" | "party-first-warm" | "hub" | "sheet" | "classic" | "journal" | "ribbon" | "retro-2000" | "retro-2003" | "classic-xp" | "classic-vx";

/** 전투 아군측 배틀러 소스 — actors: 파티 액터가 직접 싸움(기본),
 *  monsters: 잡은 파티 몬스터가 필드에 나서 싸움(포켓몬식). */
export type BattleParty = "actors" | "monsters";

export type ClassBattleCommandKind = "attack" | "skill" | "skillSubset" | "defend" | "guard" | "item" | "capture" | "escape" | "switch" | "event";

export interface ClassBattleCommand {
  id: string;
  name: string;
  kind: ClassBattleCommandKind;
  skillSubsetName?: string;
  skillId?: SkillId;
}

export type DatabaseElementKind = "physical" | "magical";

export interface DatabaseElementRecord {
  id: string;
  name: string;
  /** 속성 종류. "magical" 인 경우 데미지 감소를 mind(마법 방어력) 로 라우팅 (B2 wiring).
   *  physical 이면 defense(물리 방어력) 사용. runtime.elementMultiplierFor / isMagicalElement /
   *  predictSkillDamage 가 소비한다. */
  kind: DatabaseElementKind;
  /** @reserved 미사용. 등급 라벨은 A–E 하드코딩으로 동작하며, 편집 UI 도 없음(B3).
   *  스키마 호환을 위해 유지·정규화만 수행. */
  rateLabels: ActorRateGrade[];
  damageMultipliers: Record<ActorRateGrade, number>;
}

export type DatabaseTerrainCharacterDisplay = "normal" | "transparent";

export interface DatabaseTerrainVehiclePassage {
  boat: boolean;
  ship: boolean;
  airshipLand: boolean;
}

export interface DatabaseTerrainRecord {
  id: string;
  name: string;
  damage: number;
  encounterRatePercent: number;
  battleBackgroundResourceId?: string;
  footstepSoundResourceId?: string;
  characterDisplay: DatabaseTerrainCharacterDisplay;
  vehiclePassage: DatabaseTerrainVehiclePassage;
}

export interface DatabaseBattleCommandRecord {
  id: string;
  name: string;
  kind: ClassBattleCommandKind;
  skillSubsetName?: string;
  skillId?: SkillId;
}

export interface ClassEquipmentPermissions {
  actorIds: ActorId[];
  classIds: ClassId[];
  equipmentIds: EquipmentId[];
}

export interface SkillRecord {
  id: SkillId;
  name: string;
  scope: "self" | "ally" | "allAllies" | "enemy" | "allEnemies";
  power: number;
  animationId?: BattleAnimationId;
  description: string;
  type: "normal" | "teleport" | "escape" | "switch";
  mpCost: SkillMpCost;
  successRate: number;
  variance: number;
  hitRate: number;
  /** Optional authored base damage. Arithmetic only; invalid formulas use the legacy formula. */
  damageFormula?: string;
  criticalRate?: number;
  criticalMultiplier?: number;
  /** Number of subsequent full battle rounds during which this skill is unavailable. */
  cooldownTurns?: number;
  /** Ordered damage/healing multipliers, one per hit. Omitted means one hit. */
  hitSequence?: number[];
  effect: SkillEffect;
  // 속성 ID. DatabaseElementRecord.id 와 매칭. 없으면 비속성(상성 배율 1.0).
  elementId?: string;
  // 상태이상 부여/해제 효과. 명중 시(데미지 효과) 또는 즉시(서포트/힐) 적용.
  // 각 항목의 chance(0~100)로 부여 확률을 굴리고, operation 으로 부여/해제를 결정한다.
  stateEffects?: DatabaseStateEffect[];
  /** Gen1 move PP cap. Omitted for legacy projects that have not opted into per-move PP yet. */
  maxPp?: number;
  /** Gen1's high-critical move class. Omission is the legacy-compatible normal class. */
  gen1CriticalRate?: "normal" | "high";
  /**
   * 기술 우선도(-7~+7, 기본 0). strict 턴제에서 속도보다 먼저 비교한다 — 퀵어택(+1)류.
   * 이름이 movePriority 인 이유: EnemyActionPattern.priority(적 AI 행동 선택 가중치),
   * StateRecord.priority(상태 표시 우선순위)와 전혀 다른 개념이라 혼동을 차단한다.
   */
  movePriority?: number;
  /** 실시간 액션 전투에서 캐스트 가능한 액션 스킬. 생략 시 턴제 전용. */
  actionSkill?: ActionSkillProfile;
}

export interface SkillMpCost {
  flat: number;
  percentMax: number;
}

export type SkillEffect =
  | { kind: "damage"; statistic: "attack" | "mind"; affects: "hp" | "mp" }
  | { kind: "healing"; statistic: "mind"; affects: "hp" | "mp" }
  | { kind: "support" }
  | { kind: "switch"; switchId?: string };

export interface ActionWeaponProfile {
  /** 스윙 부채꼴 reach. 생략 시 시스템 기본(1). */
  swingRange?: number;
  /** 스윙 쿨다운. 생략 시 시스템 기본. */
  swingCooldownMs?: number;
  /** 스윙 데미지 가산. 생략 시 0. */
  swingDamageBonus?: number;
}

export interface ActionSkillProfile {
  kind: "projectile" | "melee" | "dash" | "trap";
  /** Milliseconds between casts (default 350). */
  cooldownMs?: number;
  /** Trap lifetime, milliseconds (default 5000, maximum 30000). */
  durationMs?: number;
  /** Bounded field enemy effect, independent of turn-based state records. */
  fieldStatus?: { kind: "poison" | "slow"; durationMs: number };
  damage: number;
  range: number;
  speedTilesPerSec?: number;
  /** 발사 시 인벤토리에서 소비하는 탄약 아이템. 부족하면 캐스트가 불발한다. mpCost와 병용 가능(둘 다 필요). */
  itemCost?: { itemId: ItemId; amount: number };
}

export interface ItemRecord {
  id: ItemId;
  name: string;
  imageResourceId?: string;
  iconResourceId?: string;
  scope: ItemScope;
  price: number;
  skillId?: SkillId;
  description: string;
  type: ItemType;
  occasion: "always" | "battle" | "field" | "never";
  consumable: boolean;
  animationId?: BattleAnimationId;
  stateEffects: DatabaseStateEffect[];
  consumptionLimit: ItemConsumptionLimit;
  usableActorIds: ActorId[];
  usableClassIds: ClassId[];
  healStateIds: StateId[];
  hpRecovery: SkillMpCost;
  mpRecovery: SkillMpCost;
  onlyUsableInMenu: boolean;
  onlyEffectiveOnDeadActors: boolean;
  learnedSkillId?: SkillId;
  activateSkillId?: SkillId;
  usageMessage: "normal" | "skill";
  switchId?: string;
  occasionField: boolean;
  occasionBattle: boolean;
  seedParameterBonuses: EquipmentStatBonuses;
  equipmentProfile: ItemEquipmentProfile;
  farmTool?: FarmTool;
  captureProfile?: ItemCaptureProfile;
  careProfile?: ItemCareProfile;
}

export interface ItemCaptureProfile {
  multiplier: number;
  /** Optional Gen1 capture algorithm class; multiplier remains the compatibility contract. */
  ballClass?: "poke" | "great" | "ultra" | "master";
}

export interface ItemCareProfile {
  kind: "feed" | "toy";
  friendshipDelta: number;
  expDelta?: number;
}

export type FarmTool = "hoe" | "wateringCan" | "axe" | "pickaxe";

export type ItemScope = "none" | "ally" | "allAllies" | "enemy";
export type ItemType =
  | "normalGoods"
  | "weapon"
  | "shield"
  | "body"
  | "head"
  | "accessory"
  | "medicine"
  | "book"
  | "seed"
  | "special"
  | "switch";
export type ItemConsumptionLimit = "noLimit" | 1 | 2 | 3 | 4 | 5;

export interface ItemEquipmentProfile {
  statBonuses: EquipmentStatBonuses;
  equippableActorIds: ActorId[];
  equippableClassIds: ClassId[];
  twoHanded: boolean;
  mpCost: number;
  accuracy: number;
  criticalRate: number;
  attackElementIds: string[];
  stateInflictIds: StateId[];
  stateInflictionChance: number;
  effectFlags: ItemEquipmentEffectFlags;
  elementalDefenseIds: string[];
  stateDefenseIds: StateId[];
  stateDefenseMode: "resist" | "inflict";
  stateResistanceChance: number;
}

export interface ItemEquipmentEffectFlags {
  preemptive: boolean;
  doubleAttack: boolean;
  attackAll: boolean;
  ignoreDodge: boolean;
  preventCriticalHits: boolean;
  increasePhysicalDodge: boolean;
  halfMpCost: boolean;
  negateTerrainDamage: boolean;
  fixedEquipment: boolean;
}

export interface EquipmentRecord {
  id: EquipmentId;
  name: string;
  imageResourceId?: string;
  iconResourceId?: string;
  slot: string;
  price: number;
  skillId?: SkillId;
  description: string;
  statBonuses: EquipmentStatBonuses;
  equippableActorIds: ActorId[];
  equippableClassIds: ClassId[];
  cursed: boolean;
  twoHanded: boolean;
  /** 일반 공격 명중률에 곱하는 0~100% 장비 보정. */
  accuracy: number;
  /** 액터/적 기본 치명타율에 더하는 0~100%p 장비 보정. */
  criticalRate: number;
  usableAsItemSkillId?: SkillId;
  attackElementIds: string[];
  stateInflictIds: StateId[];
  stateInflictionChance: number;
  effectFlags: ItemEquipmentEffectFlags;
  elementalDefenseIds: string[];
  stateDefenseIds: StateId[];
  stateDefenseMode: "resist" | "inflict";
  stateResistanceChance: number;
  /** 실시간 액션 전투에서 이 무기를 들었을 때의 스윙 프로필. */
  actionWeapon?: ActionWeaponProfile;
}

export interface EquipmentStatBonuses {
  attack: number;
  defense: number;
  mind: number;
  agility: number;
}

export interface DatabaseStateEffect {
  stateId: StateId;
  chance: number;
  operation: "add" | "remove";
}

export interface EnemyRecord {
  id: EnemyId;
  name: string;
  speciesId?: MonsterSpeciesId;
  level?: number;
  monsterResourceId?: string;
  /** 전투 이미지 표시 크기(10~300%, 정수). 생략 시 기존 크기 100%. */
  battleScalePercent?: number;
  graphicHue: number;
  transparent: boolean;
  flying: boolean;
  criticalHit: EnemyCritical;
  attackOptions: EnemyOptions;
  skillIds: SkillId[];
  stats: EnemyStats;
  rewards: EnemyRewards;
  actions: EnemyActionPattern[];
  /** 실시간 액션 전투용 필드 프로필. 생략 시 턴제 전용 적. */
  actionProfile?: EnemyActionProfile;
  /** 소속 진영 id(project.factions.defs). 생략 시 예약 진영 enemy — 기존 프로젝트와 동일하게 플레이어만 적대한다. */
  factionId?: string;
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
}

export interface EnemyActionAttack {
  kind: "melee" | "projectile" | "dash";
  /** 선딜 — 텔레그래프(적 점멸 + 위협 칸 표시) 시간. */
  windupMs: number;
  /** 후딜 — 공격 후 플레이어 반격 창. */
  recoverMs: number;
  damage: number;
  /** melee: 부채꼴 reach / projectile: 최대 비행 타일 / dash: 최대 돌진 타일. */
  range: number;
  /** 재공격 쿨다운. 기본 1200ms. */
  cooldownMs?: number;
  /** 투사체 속도(타일/초). 기본 6. */
  projectileSpeedTilesPerSec?: number;
}

export interface EnemyActionProfile {
  /** 접촉 데미지. 생략 시 attack/2 기반 폴림. */
  contactDamage?: number;
  /** 추격 이동 간격(ms). 생략 시 이동 타입 기본. */
  moveIntervalMs?: number;
  /** 어그로(추격 시작) 거리. 생략 시 스폰 정의/기본값. */
  aggroRange?: number;
  /** 넉백 저항 0..1. 기본 0. */
  knockbackResist?: number;
  /** 선딜/후딜이 있는 능동 공격. 생략 시 접촉만. */
  attack?: EnemyActionAttack;
}

export interface EnemyStats {
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  mind: number;
  agility: number;
}

export interface MonsterSpeciesGraphic {
  monsterResourceId?: string;
  /** Optional true rear-view battle sprite; front graphic remains the fallback. */
  backResourceId?: string;
  /** Optional overworld CharSet texture key (e.g. tex_easyrpg_charset_monster1). */
  fieldCharsetId?: string;
  /** Optional full overworld graphic override; wins over fieldCharsetId when present. */
  fieldGraphic?: EventPageGraphic;
  graphicHue: number;
  transparent: boolean;
  flying: boolean;
}

export interface MonsterSpeciesRecord {
  id: MonsterSpeciesId;
  name: string;
  graphic: MonsterSpeciesGraphic;
  types?: string[];
  baseStats: EnemyStats;
  expCurve?: ActorExperienceCurve;
  captureRate: number;
  skillsByLevel?: ActorLearnedSkill[];
  evolutions?: MonsterEvolutionRecord[];
}

export interface CropStageRecord {
  days: number;
}

export interface CropGraphicStage {
  resourceId?: string;
  frame?: string | number;
  label?: string;
}

export interface CropRegrowRecord {
  days: number;
}

export interface CropRecord {
  id: CropId;
  name: string;
  seedItemId: ItemId;
  harvestItemId: ItemId;
  harvestCount: number;
  stages: CropStageRecord[];
  seasons: Season[];
  regrow?: CropRegrowRecord;
  graphicStages?: CropGraphicStage[];
}

export interface MonsterEvolutionRecord {
  toSpeciesId: MonsterSpeciesId;
  requires: MonsterEvolutionRequirement;
}

export interface MonsterEvolutionRequirement {
  level?: number;
  itemId?: ItemId;
  friendshipAtLeast?: number;
}

export interface TypeChartRecord {
  types: string[];
  multipliers: Record<string, Record<string, number>>;
}

export interface EnemyRewards {
  exp: number;
  gold: number;
  dropItemId?: ItemId;
  dropRatePercent: number;
  /** When present, replaces the legacy single drop (including an explicitly empty list). */
  drops?: { itemId: ItemId; ratePercent: number; quantity: number; condition: EnemyActionCondition }[];
}

export interface EnemyCritical {
  enabled: boolean;
  oneIn: number;
}

export interface EnemyOptions {
  normalAttacksMiss: boolean;
}

export type EnemyActionCondition = { kind: "always" } | { kind: "turn"; start: number; interval: number }
  | { kind: "hp" | "mp"; minPercent: number; maxPercent: number }
  | { kind: "status"; stateId: string; present: boolean }
  | { kind: "allies"; min: number; max: number }
  | { kind: "switch"; switchId: string; value: boolean };

export interface EnemyActionSwitchEffect {
  enabled: boolean;
  switchId?: string;
}

export interface EnemyActionPattern {
  skillId: SkillId;
  priority: number;
  condition: EnemyActionCondition;
  switchOnAfterAction: EnemyActionSwitchEffect;
  switchOffAfterAction: EnemyActionSwitchEffect;
}

export interface TroopMemberRecord {
  enemyId: EnemyId;
  x: number;
  y: number;
  hidden?: boolean;
}

export type BattleEventSpan = "battle" | "turn" | "moment";

export type BattleEventCondition =
  | Condition
  | { kind: "turn"; start: number; interval: number }
  | { kind: "onRound"; round: number }
  | { kind: "everyRound"; start?: number; interval?: number }
  | { kind: "enemyHp"; enemyId: EnemyId; minPercent: number; maxPercent: number }
  | { kind: "enemyHpBelow"; enemyId?: EnemyId; percent: number }
  | { kind: "actorHp"; actorId: ActorId; minPercent: number; maxPercent: number }
  | { kind: "enemyTurn"; enemyId: EnemyId; turn: number }
  | { kind: "actorTurn"; actorId: ActorId; turn: number }
  | { kind: "actorCommand"; actorId: ActorId; commandId: string };

export interface BattleEventPageRecord {
  id: string;
  name: string;
  conditions: BattleEventCondition[];
  span: BattleEventSpan;
  runOnce?: boolean;
  commands: Command[];
}

export interface TroopRecord {
  id: TroopId;
  name: string;
  enemyIds: EnemyId[];
  members?: TroopMemberRecord[];
  autoAlign: boolean;
  uncapturable?: boolean;
  /** Distinguishes trainer battles from wild encounters without guessing from troop ids. */
  trainerBattle?: boolean;
  previewBackgroundResourceId?: string;
  battleFlow?: BattleFlow;
  activeSlots?: number;
  battleEventPages: BattleEventPageRecord[];
}

export interface StateRecord {
  id: StateId;
  name: string;
  /** Gen1 persistent major status semantics, independent of authored state id/name. */
  gen1MajorStatus?: "poison" | "burn" | "sleep" | "freeze" | "paralysis";
  // RM2K3 상태(State) 편집 가능 필드 — 사용자가 DB 탭에서 재정의한 값.
  // 값을 설정하지 않으면 ontology 기본값(stateOntologyFor)이 사용된다.
  removalCondition?: string;
  restriction?: string;
  priority?: number;
  accuracyModifier?: number;
  animationIndex?: number;
  recoverNaturallyFromTurn?: number;
  recoverNaturallyChance?: number;
  recoverWhenHitChance?: number;
  hpReleaseTurn?: number;
  hpReleaseStep?: number;
  mpReleaseTurn?: number;
  mpReleaseStep?: number;
  specialFlags?: readonly string[];
  lockedParameters?: readonly string[];
  runtimeEffects?: StateRuntimeEffects;
}

export interface StateRuntimeEffects {
  restrictsAction?: boolean;
  blocksSkillUse?: boolean;
  hpDamagePercentPerTurn?: number;
  hpHealPercentPerTurn?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  agilityMultiplier?: number;
  removeOnBattleEnd?: boolean;
}

export interface BattleAnimationRecord {
  id: BattleAnimationId;
  name: string;
  resourceId?: string;
  sheet?: BattleAnimationSheet;
  scope?: BattleAnimationScope;
  position?: BattleAnimationPosition;
  large?: boolean;
  frames?: BattleAnimationFrame[];
  timings?: BattleAnimationTiming[];
  /**
   * 이어서 재생할 애니메이션(연출 합성, 2026-09-03). 본 애니메이션이 `startFrame` 에 닿으면 같은 앵커에
   * 겹쳐 시작한다 — 착탄 뒤의 연기·불티·잔광처럼 "한 컷" 에 담기지 않는 잔향을 둘째 레코드가 맡는다.
   * 전체 길이는 본체와 후속의 끝 중 늦은 쪽이고, 시퀀서가 그만큼 recover 비트를 늘린다.
   */
  followUps?: BattleAnimationFollowUp[];
}

export interface BattleAnimationFollowUp {
  animationId: BattleAnimationId;
  /** 본 애니메이션의 몇 번째 프레임(0 기준)에서 시작하는가. */
  startFrame: number;
}

export type BattleAnimationScope = "singleTarget" | "allTargets" | "screen";

export type BattleAnimationPosition = "head" | "center" | "feet" | "screen";

export interface BattleAnimationSheet {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /**
   * 시트 1px 이 전투 무대(640×480 논리 해상도)에서 차지하는 논리 px.
   * 없으면 2 — 320×240 시대 RM 자산(EasyRPG RTP·Scarloxy 96px 시트)의 값이다.
   * 번들 고해상도 이펙트(384px 프레임)는 0.5 로 같은 192 논리 px 를 차지한다.
   * 셀 오프셋(`BattleAnimationCell.x/y`)은 이 값과 무관하게 항상 RM px 다.
   */
  assetScale?: number;
}

export interface BattleAnimationFrame {
  cells: BattleAnimationCell[];
}

export interface BattleAnimationCell {
  pattern: number;
  x: number;
  y: number;
  zoom: number;
  opacity: number;
  visible: boolean;
  tone?: BattleAnimationTone;
}

export interface BattleAnimationTone {
  red: number;
  green: number;
  blue: number;
  gray: number;
}

export interface BattleAnimationTiming {
  frameIndex: number;
  soundResourceId?: string;
  flash?: BattleAnimationFlash;
  screenShake?: BattleAnimationScreenShake;
}

export interface BattleAnimationFlash {
  target: "target" | "screen";
  color: BattleAnimationTone;
  durationFrames: number;
}

export interface BattleAnimationScreenShake {
  power: number;
  speed: number;
  durationFrames: number;
}

export interface DatabaseRecords {
  actors: ActorRecord[];
  classes: ClassRecord[];
  skills: SkillRecord[];
  items: ItemRecord[];
  equipment: EquipmentRecord[];
  enemies: EnemyRecord[];
  troops: TroopRecord[];
  states: StateRecord[];
  battleAnimations: BattleAnimationRecord[];
}

/** 라이프스킬 종류 — 스타듀밸리 5스킬 차용. */
export type LifeSkillType = "farming" | "mining" | "foraging" | "fishing" | "combat";

/** 레벨업 보상 — 스위치 ON 또는 제작 레시피 해금. */
export interface LifeSkillLevelUpReward {
  readonly level: number;
  readonly switchId?: string;
  readonly recipeId?: string;
}

/** 생활 스킬 레코드 — 농사/채광/채집/나씨/전투 XP 레벨링. */
export interface LifeSkillRecord {
  readonly id: string;
  readonly name: string;
  readonly skillType: LifeSkillType;
  readonly maxLevel: number;
  readonly levelUpRewards: readonly LifeSkillLevelUpReward[];
}

/** One weighted authored outcome for a season's deterministic daily weather table. */
export interface DailyWeatherRule {
  readonly kind: WeatherKind;
  readonly weight: number;
  readonly intensity?: number;
}

/** Optional life-sim weather package. Forecasts are derived, never persisted as authored rows. */
export interface DailyWeatherConfig {
  readonly enabled: boolean;
  readonly forecastDays?: number;
  readonly seasons: Partial<Record<Season, readonly DailyWeatherRule[]>>;
}

/** Authored animal kind. Runtime ownership/progress lives in PlaySession.farmAnimals. */
export interface FarmAnimalSpeciesRecord {
  readonly id: string;
  readonly name: string;
  readonly graphic?: EventPageGraphic;
  readonly feedItemId: ItemId;
  readonly productItemId: ItemId;
  readonly productCount: number;
  readonly productEveryDays: number;
  readonly petFriendship: number;
}

/** A placed animal home definition, deliberately narrower than future general farm buildings. */
export interface FarmAnimalBuildingDefinition {
  readonly id: string;
  readonly name: string;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly capacity: number;
  readonly allowedSpeciesIds: readonly string[];
}

export interface FishSpeciesRecord {
  readonly id: string;
  readonly name: string;
  readonly itemId: ItemId;
  readonly skillXp?: number;
}

export interface FishingCatchRule {
  readonly fishId: string;
  readonly weight: number;
  readonly seasons?: readonly Season[];
  readonly timePhases?: readonly TimePhase[];
  readonly weatherKinds?: readonly WeatherKind[];
  readonly minSkillLevel?: number;
}

export interface FishingSpotDefinition {
  readonly id: string;
  readonly name?: string;
  readonly mapId: MapId;
  readonly area: import("./project").Rect;
  readonly catches: readonly FishingCatchRule[];
}

export interface FishingSystemConfig {
  readonly enabled: boolean;
  readonly energyCost?: number;
  readonly spots: readonly FishingSpotDefinition[];
}

export interface ForageEntryDefinition {
  readonly id: string;
  readonly weight: number;
  readonly itemId?: ItemId;
  readonly seasonalDrops?: Partial<Record<Season, ItemId>>;
}

export interface ForageAreaDefinition {
  readonly id: string;
  readonly name?: string;
  readonly mapId: MapId;
  readonly area: import("./project").Rect;
  readonly dailySpawnCount: number;
  readonly maxActive: number;
  readonly spawnEveryDays?: number;
  readonly despawnAfterDays: number;
  readonly entries: readonly ForageEntryDefinition[];
}

export interface SeasonalForageConfig {
  readonly enabled: boolean;
  readonly areas: readonly ForageAreaDefinition[];
}

export interface CollectionSystemConfig {
  readonly enabled: boolean;
  readonly trackedItemIds?: readonly ItemId[];
}

export interface MuseumRewardDefinition {
  readonly id: string;
  readonly name?: string;
  readonly minDonations?: number;
  readonly requiredItemIds?: readonly ItemId[];
  readonly reward?: BundleRewardDefinition;
}

export interface MuseumSystemConfig {
  readonly enabled: boolean;
  readonly eligibleItemIds: readonly ItemId[];
  readonly rewards: readonly MuseumRewardDefinition[];
}

export interface SpatialFootprint {
  readonly width: number;
  readonly height: number;
}

export interface SpatialPlacementCost {
  readonly gold?: number;
  readonly items?: ItemAmount[];
}

export interface FarmBuildingLevelDefinition {
  readonly level: number;
  readonly name?: string;
  readonly footprint: SpatialFootprint;
  /** Generic facility slots, never P1 farm-animal housing capacity. */
  readonly capacity: number;
  /** Explicit per-instance animal slots when animalHousing is enabled; 0..9999. */
  readonly animalCapacity?: number;
  /** Level 1 builds the structure; later levels upgrade into that level. */
  readonly cost?: SpatialPlacementCost;
  readonly graphicResourceId: string;
  readonly orientationGraphicResourceIds?: Partial<Record<Dir, string>>;
}

/** General farm structure catalog, deliberately independent from farmAnimalBuildings. */
export interface FarmBuildingTypeRecord {
  readonly id: string;
  readonly name: string;
  readonly levels: FarmBuildingLevelDefinition[];
  readonly animalHousing?: { readonly allowedSpeciesIds: string[] };
  /** Omitted/empty permits every map. */
  readonly allowedMapIds?: MapId[];
}

export interface HomeDecorationTypeRecord {
  readonly id: string;
  readonly name: string;
  readonly placementItemId: ItemId;
  readonly footprint: SpatialFootprint;
  readonly blocksMovement: boolean;
  readonly allowedOrientations: Dir[];
  readonly graphicResourceId: string;
  readonly orientationGraphicResourceIds?: Partial<Record<Dir, string>>;
  /** Omitted/empty permits every map. */
  readonly allowedMapIds?: MapId[];
}

export interface ProjectDatabaseRecords extends DatabaseRecords {
  characterAppearances?: CharacterAppearanceRecord[];
  /** Optional additive catalog; built-in slots always remain available. */
  equipmentSlots?: EquipmentSlotRecord[];
  elements?: DatabaseElementRecord[];
  terrains?: DatabaseTerrainRecord[];
  battleCommands?: DatabaseBattleCommandRecord[];
  monsterSpecies?: MonsterSpeciesRecord[];
  crops?: CropRecord[];
  lifeSkills?: LifeSkillRecord[];
  farmAnimalSpecies?: FarmAnimalSpeciesRecord[];
  fishSpecies?: FishSpeciesRecord[];
  farmBuildingTypes?: FarmBuildingTypeRecord[];
  homeDecorationTypes?: HomeDecorationTypeRecord[];
}

export interface TitleScreenLayout {
  titleX: number;
  titleY: number;
  menuX: number;
  menuY: number;
}

export interface TitleScreenMenuLabels {
  newGame: string;
  continueGame: string;
  quit: string;
  /** 오토세이브 "이어하기" 라벨. 생략 시 런타임 기본 라벨("이어하기"). */
  resume?: string;
}
export interface TitleScreenMenuVisibility {
  newGame: boolean;
  continueGame: boolean;
  quit: boolean;
  /** 오토세이브 "이어하기" 표시 여부. 생략은 true(!== false 패턴) — 구 JSON 전후방 호환. */
  resume?: boolean;
}

export interface TitleScreenSounds {
  cursorSeResourceId?: string;
  confirmSeResourceId?: string;
  cancelSeResourceId?: string;
}

export type TitleScreenTitleMode = "text" | "graphic" | "both";

export interface TitleScreenGraphic {
  mode: TitleScreenTitleMode;
  resourceId?: string;
  x: number;
  y: number;
}

/** 배경 위에 얹는 무한 스크롤 레이어(최대 4장). additive optional — 구 JSON 은 필드 자체가 없다. */
export interface TitleBackgroundLayer {
  resourceId: string;
  /** 초당 스크롤 px(320×240 논리 좌표계). 음수 = 반대 방향. 생략/0 = 정지. */
  scrollXPerSec?: number;
  scrollYPerSec?: number;
  /** 스크롤 속도 배율(깊이감). 생략 = 1. */
  parallax?: number;
  /** 0..1. 생략 = 1(불투명). */
  opacity?: number;
}

export type TitleParticlePreset = "snow" | "rain" | "fireflies";

export interface TitleParticleSettings {
  preset: TitleParticlePreset;
  /** 밀도 0..100. 생략 시 런타임 기본 50. */
  density?: number;
}

export type TitleIntroLogoAnimation = "none" | "fadeIn" | "riseIn";
export type TitleIntroMenuAnimation = "none" | "fadeIn" | "slideUp";

/** 로고/메뉴 등장 연출. 로고·메뉴가 모두 없으면(none 포함) normalize 가 필드를 통째로 생략한다. */
export interface TitleIntroSettings {
  logo?: TitleIntroLogoAnimation;
  menu?: TitleIntroMenuAnimation;
  /** 첫 등장 전 지연 ms (0..10000). */
  delayMs?: number;
  /** 메뉴 항목 간 시차 ms (0..2000). */
  staggerMs?: number;
}

/**
 * 배경 그림 맞춤. 생략 = 레거시 "stretch"(100% 100% 로 늘림) — 구 JSON 은 필드가 없고 화면도 그대로다.
 * cover = 비율 유지로 화면을 채우고 넘치는 쪽을 자른다, contain = 비율 유지로 전부 보인다.
 */
export type TitleBackgroundFit = "cover" | "contain" | "stretch";
/** 생략 = 레거시 "pixelated". 그려 넣은 키아트는 "smooth" 여야 계단이 안 생긴다. */
export type TitleBackgroundRendering = "smooth" | "pixelated";

/** 그림 좌표계(0..1, 좌상단 원점) 한 점. 빛 근원은 그림 밖(-0.5..1.5)에 둘 수 있다. */
export type TitleEffectPoint = [number, number];

/**
 * 그림 위 영역 효과. 좌표는 모두 **배경 그림** 기준 정규 좌표라 화면 비율·맞춤이 바뀌어도 제자리에 남는다.
 * - godRays: source → toward 방향의 빛내림(spread = 부채꼴 폭)
 * - motes:   빛 속을 떠다니는 먼지 입자(source/toward 부채꼴 또는 region 안, count 개)
 * - glint:   line(칼날 등) 위를 periodSec 마다 훑는 반사광
 * - water:   region 안의 물결 일렁임 + 반짝임
 * - mist:    region 안을 흐르는 안개
 * - dapple:  region 안의 나뭇잎 그림자 흔들림
 * - glow:    source 둘레의 깜빡이는 불빛(횃불·창문), spread = 반경
 * - camera:  화면 전체의 느린 호흡 줌(intensity = 폭)
 */
export type TitleEffectKind = "godRays" | "motes" | "glint" | "water" | "mist" | "dapple" | "glow" | "camera";

export interface TitleEffect {
  kind: TitleEffectKind;
  /** false 만 저장한다(끔). 생략 = 켬. */
  enabled?: boolean;
  /** 0..2, 생략 = 1. */
  intensity?: number;
  /** 0..4, 생략 = 1. */
  speed?: number;
  /** "#rrggbb". 생략 = 종류별 기본색. */
  color?: string;
  source?: TitleEffectPoint;
  toward?: TitleEffectPoint;
  /** 0.02..1 — godRays/motes 부채꼴 폭, glow 반경. */
  spread?: number;
  line?: [TitleEffectPoint, TitleEffectPoint];
  /** glint 주기 초(1..60). */
  periodSec?: number;
  /** 3..8 점 다각형. */
  region?: TitleEffectPoint[];
  /** motes 개수(0..96). */
  count?: number;
}

export type TitleLogoStyle = "plain" | "metal" | "gold" | "stone" | "glow";
/** 생략 = "window"(윈도스킨 창). "plain" = 창 없이 글자만, 선택 항목이 빛난다. */
export type TitleMenuStyle = "window" | "plain";

export interface TitleScreenSettings {
  title: string;
  backgroundResourceId?: string;
  /** 생략 = stretch(레거시). */
  backgroundFit?: TitleBackgroundFit;
  /** 생략 = pixelated(레거시). */
  backgroundRendering?: TitleBackgroundRendering;
  /** 그림 영역 효과(최대 12). 빈/무효면 normalize 가 필드를 생략한다. */
  effects?: TitleEffect[];
  /** 글자 로고 질감. 생략 = 레거시 편집 글꼴. 지정하면 기본 문구("A NEW ADVENTURE")를 숨긴다. */
  logoStyle?: TitleLogoStyle;
  /** 로고 아래 부제(최대 60자). */
  logoSubtitle?: string;
  menuStyle?: TitleMenuStyle;
  /** Optional title-screen BGM (music resource id). Empty/undefined = silent. */
  musicResourceId?: string;
  layout: TitleScreenLayout;
  menuLabels: TitleScreenMenuLabels;
  /** Required after normalize; missing fields default true, newGame always true. */
  menuVisibility: TitleScreenMenuVisibility;
  sounds?: TitleScreenSounds;
  /** Omitted when text-only with no logo resource (legacy compact JSON). */
  titleGraphic?: TitleScreenGraphic;
  /** Default true after normalize. */
  showInputHint?: boolean;
  /** 배경 스크롤 레이어(최대 4). 빈/무효면 normalize 가 필드를 생략한다(레거시 JSON byte-stable). */
  backgroundLayers?: TitleBackgroundLayer[];
  /** 타이틀 파티클. 무효 preset 이면 normalize 가 필드를 생략한다. */
  particles?: TitleParticleSettings;
  /** 로고/메뉴 등장 연출. 유효한 연출이 하나도 없으면 normalize 가 필드를 생략한다. */
  intro?: TitleIntroSettings;
}

/** Project-authored logical viewport used by the map runtime and its DOM stage. */
export interface PlayResolution {
  width: number;
  height: number;
}

export interface EnergySystemConfig {
  /** Maximum energy available to a fully-rested player. */
  readonly max: number;
  /** New-session energy. Omitted means max. */
  readonly initial?: number;
  /** Day/sleep restore amount. Omitted means a full restore. */
  readonly restorePerDay?: number;
}

export interface ShippingSystemConfig {
  readonly enabled: boolean;
  /** Number of immutable settlement summaries retained in a save. */
  readonly historyLimit?: number;
  /** Omitted means every item with a resolvable sell price is accepted. */
  readonly allowedItemIds?: ItemId[];
}

export interface ItemAmount {
  readonly itemId: ItemId;
  readonly count: number;
}

export interface BundleRewardDefinition {
  readonly gold?: number;
  readonly itemRewards?: ItemAmount[];
  readonly switchId?: string;
  readonly worldUnlockIds?: string[];
  readonly recipeIds?: string[];
}

export interface BundleDefinition {
  readonly id: string;
  readonly name?: string;
  readonly requirements: ItemAmount[];
  readonly reward?: BundleRewardDefinition;
}

export interface WorldUnlockDefinition {
  readonly id: string;
  readonly name?: string;
  /** Optional switch mirrored on when this region is unlocked. */
  readonly switchId?: string;
}

export interface MakerDefinition {
  readonly id: string;
  readonly name?: string;
  readonly inputs: ItemAmount[];
  readonly outputs: ItemAmount[];
  /** Processing duration on a monotonic absolute game-minute clock. */
  readonly durationMinutes: number;
}

export interface SystemRecords {
  startActorIds: ActorId[];
  /** Omitted means the legacy 320x240 viewport. */
  playResolution?: PlayResolution;
  /**
   * 프로젝트 기본 카메라 배율. 생략하면 1(클래식).
   *
   * 왜 system 인가: 줌은 원래 연출 상태(session.camera.zoom, 이벤트 명령 m2-201)로만
   * 존재했다. 그래서 고해상도 배경(1920x1080)을 1:1 로 쓰려면 맵마다 auto 이벤트를 심어
   * 줌을 걸어야 했고, 새 맵에서는 1 로 돌아갔다. 기본값은 프로젝트가 정하고 연출은 그 위에
   * 일시적으로 덮어쓰는 것이 맞다.
   *
   * playResolution 과의 관계: 해상도는 픽셀 밀도이고 시야는 배율이 정한다.
   * 1440x1080 + 4.5 면 20x15 타일(320x240 과 동일 시야)에 배경이 1:1 로 맞는다.
   */
  cameraZoom?: number;
  /**
   * 주인공의 **몸 크기**(타일, 발밑 앵커). 생략하면 1x1 — 기존 프로젝트와 동작이 같다.
   * 이벤트의 `EventPage.footprint` 와 같은 규약이다(2차 스펙 §9).
   */
  playerFootprint?: CharacterFootprint;
  /**
   * 몸 사각 **하단 몇 행**이 지형·이벤트에 막히는가. 생략하면 몸 높이 전체(= 통행 사각 === 몸 사각).
   * 3x3 주인공에 1 이면 발밑 한 줄만 막혀 상체가 벽을 스치며 지나갈 수 있다.
   */
  playerPassRows?: number;
  titleResourceId?: string;
  systemResourceId?: string;
  battleSystemResourceId?: string;
  battleBgmResourceId?: string;
  /** 맵이 BGM 을 지정하지 않았을 때(mode=parent 상속 실패 포함) 쓰는 프로젝트 기본 BGM. */
  defaultBgmResourceId?: string;
  /** 승리 시 한 번 재생하는 팡파레(ME). 비우면 런타임 합성 팡파레. */
  battleVictoryMeResourceId?: string;
  /** 패배 시 효과음. 비우면 기본 붕괴음. */
  battleDefeatSeResourceId?: string;
  /** 도주 시 효과음. 비우면 기본 도주음. */
  battleEscapeSeResourceId?: string;
  initialTroopId?: TroopId;
  battleFlow?: BattleFlow;
  battleUiStyle?: BattleUiStyle;
  /** ESC(X) 게임 메뉴 디자인. 생략 = workbench(작업대, 지금 화면). */
  menuUiStyle?: MenuUiStyle;
  /** 대화창 스타일(project/dialogueStyles.ts). 생략 = glass(지금까지의 유리 창). */
  dialogueStyle?: import("@/project/dialogueStyles").DialogueStyleId;
  /** 대화창 글꼴 — 에디터 UI 글꼴과 따로 간다. 생략 = 스타일이 정한 글꼴. */
  dialogueFont?: import("@/project/fontRegistry").FontFamilyId;
  /** 프로젝트 기본 말 빠르기 배율(0.5~2). 생략 = 1. 화자 빠르기와 곱한다. */
  dialogueSpeed?: number;
  /** false 면 구두점 뒤에 쉬지 않는다. 생략 = 쉰다. */
  dialoguePunctuationPause?: boolean;
  fieldHud?: import("../fieldHud").FieldHudConfig;
  /** Project-wide, scoped battle menu CSS; absent preserves the selected skin. */
  battleCommandCss?: string;
  battleParty?: BattleParty;
  /** 전투 규칙 엔진 선택. "rm2k3"(기본/생략) 또는 "gen1"(포켓몬 레드 스타일).
   *  생략 시 기존 RM2k3 전투 규칙이 100% 유지된다. CSS·UI 게이팅은 body[data-battle-model] 속성으로 한다. */
  battleModel?: "rm2k3" | "gen1";
  activeSlots?: number;
  rewardPolicy?: RewardPolicy;
  titleScreen?: TitleScreenSettings;
  /** Opt-in pre-map new-game sequence. Disabled sequences retain their authored content. */
  opening?: CinematicSequence;
  /** Optional game-over sequence and terminal-menu presentation. */
  gameOver?: GameOverSettings;
  gameOvers?: import("../cinematicSettings").GameOverDefinition[];
  defaultGameOverId?: string;
  monsterCollection?: boolean;
  // 전투를 몬스터 파티로 진행(옵션 A). monsterCollection(포획 게이트)과 별개 축이다.
  monsterBattleParty?: boolean;
  giftSystem?: boolean;
  /**
   * 갤러리. enabled 가 아니면 메뉴에 나오지 않는다.
   * label 을 비우면 메뉴 이름은 「갤러리」. 다른 낱말을 적어 두면 그 이름으로 보인다.
   */
  gallery?: {
    readonly enabled: boolean;
    readonly label?: string;
  };
  typeChart?: TypeChartRecord;
  timeSystem?: TimeSystemConfig;
  /** Opt-in 실시간 액션 전투 패키지. 생략 시 필드 스폰 접촉은 기존 턴제 전투로 라우팅된다. */
  actionCombat?: SystemActionCombat;
  /** Opt-in tool→world rules. Empty/absent → legacy farm hoe/can only. */
  toolActions?: import("@/project/toolActions").ToolActionRule[];
  /** Opt-in craft recipes. */
  craftRecipes?: import("@/project/craftRecipes").CraftRecipe[];
  /** Opt-in item upgrade rows. */
  itemUpgrades?: import("@/project/upgrades").ItemUpgradeRule[];
  /** Opt-in sell price overrides. */
  sellPrices?: import("@/project/upgrades").SellPriceEntry[];
  /** Opt-in life-sim energy pool. */
  energy?: EnergySystemConfig;
  /** Opt-in shipping queue and nightly settlement policy. */
  shipping?: ShippingSystemConfig;
  /** Community-style contribution definitions. */
  bundles?: BundleDefinition[];
  /** Stable world/region unlock definitions referenced by bundle rewards. */
  worldUnlocks?: WorldUnlockDefinition[];
  /** Timed input/output processing definitions. */
  makers?: MakerDefinition[];
  /** Optional authored daily weather tables. Runtime selection is owned by the day transition. */
  dailyWeather?: DailyWeatherConfig;
  /** Placed animal homes for the P1 farm-animal loop. */
  farmAnimalBuildings?: FarmAnimalBuildingDefinition[];
  /** Deterministic fishing availability and weighted catch definitions. */
  fishing?: FishingSystemConfig;
  /** Deterministic daily forage spawn policy. */
  seasonalForage?: SeasonalForageConfig;
  /** Opt-in unified item discovery/shipping/catch/donation journal. */
  collections?: CollectionSystemConfig;
  /** Exact-once museum donation and reward definitions. */
  museum?: MuseumSystemConfig;
  /** Out-of-battle party monster care (walk ticks + feed/toy items). */
  monsterCare?: MonsterCareConfig;
  /** 필드에서 플레이어를 따라오는 동료(액터)의 전역 규칙. 생략 시 간격 1칸·인원 무제한. */
  companions?: CompanionConfig;
  /** Opt-in life skill leveling system (farming/mining/foraging/fishing/combat). */
  skillSystem?: { enabled: boolean };
  /** 자자가 골람 역할별 글꼴. 생략·기본값은 저장하지 않으며 tokens.css 기본 토큰이 그대로 산다. */
  fonts?: import("@/project/fontRegistry").SystemFontConfig;
  /** 저자가 선언한 장르. lint 가 이 선언 대비 옵트인 정합성을 검사한다. 미설정이면 장르 검사 없음. */
  genre?: GenrePackId;
  /** AI 마을 생성의 물·숲·길 수치와 낱말 규칙. 생략하면 내장 기본값(예전 하드코딩과 동일 동작). */
  worldGen?: import("@/project/worldGenRules").WorldGenRules;
}

export interface ActionCombatHudConfig {
  /** 플레이어 HP 하트 바. 생략 시 true. */
  hearts?: boolean;
  /** 스태미나 바 **표시** 토글. 생략 시 false. 소모 규칙 자체는 액션 맵에서 항상 켜진다. */
  stamina?: boolean;
  /** 몬스터 철력 바. "damaged"(기본)=피해입은 개척만, "always"=항상, "never"=숨김. */
  enemyHpBars?: "always" | "damaged" | "never";
}

export interface SystemActionCombat {
  enabled: boolean;
  /** 플레이어 피격 무적시간. 기본 800ms. */
  playerIframesMs?: number;
  /** 공격 스윙 쿨다운. 기본 350ms. */
  swingCooldownMs?: number;
  /** 플레이어 스윙 데미지 가산. 기본 0. */
  swingDamageBonus?: number;
  /** true면 액션 전투 맵에서 대각 이동을 끄고 4방향 그리드 이동만 허용(클식 서바이벌 호러 감각). */
  fourWayMovement?: boolean;
  /** 회피(대시) 1회 스태미나 비용. 기본 25. 0이면 공짜 회피. */
  dodgeStaminaCost?: number;
  /** 회피 성공 시 열리는 무적 창. 기본 300ms. */
  dodgeIframesMs?: number;
  /** 홀드 가드 중 피해 감소율(%). 기본 50, 최대 90 — 완전 방어는 없다. */
  guardDamageReductionPercent?: number;
  /** 가드 유지 초당 스태미나 소모. 기본 20. 0이면 공짜 가드. */
  guardStaminaDrainPerSec?: number;
  hud?: ActionCombatHudConfig;
}

/**
 * 동료 추종 규칙. 추종은 경로탐색이 아니라 플레이어 이동 궤적(followerTrail) 재생이므로,
 * 간격은 "몇 번째 궤적 점을 쓰는가"로 표현된다. 궤적 길이가 유한(MAX_FOLLOWER_TRAIL_POINTS)해서
 * `gap * maxCompanions` 가 그 길이를 넘으면 뒷 동료가 플레이어 위에 겹친다 — 저작 시점에 거부한다.
 */
export interface CompanionConfig {
  /** 동시에 따라올 수 있는 액터 동료 수 상한. 생략 시 무제한. 몬스터 열차는 monsterParty 가 지배하므로 세지 않는다. */
  maxCompanions?: number;
  /** 동료 사이 간격(칸). 1 = 바로 뒤, 4 = 4칸씩 벌어져 따라온다. 생략·1 이면 기존 동작과 동일. */
  gap?: number;
  /** 상한 초과 시 정책. "reject"(기본) = 새 동료를 붙이지 않음, "replaceOldest" = 가장 먼저 붙은 동료를 밀어냄. */
  overflow?: "reject" | "replaceOldest";
  /**
   * 대형. "line"(기본) = 궤적을 따라 일렬. "beside" = 플레이어 사방 인접 칸에 붙어 다닌다
   * (인접 칸이 4개뿐이라 앞 4명만 옆에 서고 나머지는 일렬로 떨어진다. gap 은 무시된다).
   */
  formation?: "line" | "beside";
  /** true 면 맵 이동 시 액터 동료를 해제한다. 생략 시 유지(기존 동작). */
  clearOnTransfer?: boolean;
}

export interface MonsterCareConfig {
  /** Player steps between walk care ticks. Default 50. */
  stepsPerTick: number;
  /** Friendship granted to each party monster per walk tick. Default 1. */
  walkFriendship: number;
  /** EXP granted to each party monster per walk tick. Default 1. */
  walkExp: number;
  /** Max friendship points granted by walk ticks per calendar day. Default 30. */
  dailyCareCap: number;
}

export interface RewardPolicy {
  participationOnly?: boolean;
  levelGapPenalty?: boolean;
}
