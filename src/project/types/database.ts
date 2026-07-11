import type {
  ActorId,
  BattleAnimationId,
  BattlerAnimationId,
  ClassId,
  CropId,
  EnemyId,
  EquipmentId,
  ItemId,
  MonsterSpeciesId,
  SkillId,
  StateId,
  TroopId,
} from "./base";
import type { Command, Condition } from "./events";
import type { Season, TimeSystemConfig } from "../gameTime";

export interface ActorRecord {
  id: ActorId;
  name: string;
  nickname: string;
  classId: ClassId;
  initialLevel: number;
  maxLevel: number;
  faceResourceId?: string;
  /** Optional faceset cell index (0..15). Omitted means 0 for legacy projects. */
  faceIndex?: number;
  characterResourceId?: string;
  /** Optional charset character index (0..7). Omitted means 0 for legacy projects. */
  characterIndex?: number;
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

export interface ActorInitialEquipment {
  weapon?: EquipmentId;
  shield?: EquipmentId;
  armor?: EquipmentId;
  helmet?: EquipmentId;
  accessory?: EquipmentId;
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
  kind: DatabaseElementKind;
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
  scope: "self" | "ally" | "enemy" | "allEnemies";
  power: number;
  animationId?: BattleAnimationId;
  description: string;
  type: "normal" | "teleport" | "escape" | "switch";
  mpCost: SkillMpCost;
  successRate: number;
  variance: number;
  hitRate: number;
  effect: SkillEffect;
  // 속성 ID. DatabaseElementRecord.id 와 매칭. 없으면 비속성(상성 배율 1.0).
  elementId?: string;
  // 상태이상 부여/해제 효과. 명중 시(데미지 효과) 또는 즉시(서포트/힐) 적용.
  // 각 항목의 chance(0~100)로 부여 확률을 굴리고, operation 으로 부여/해제를 결정한다.
  stateEffects?: DatabaseStateEffect[];
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
}

export interface ItemCaptureProfile {
  multiplier: number;
}

export type FarmTool = "hoe" | "wateringCan";

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
  slot: "weapon" | "shield" | "armor" | "helmet" | "accessory";
  price: number;
  skillId?: SkillId;
  description: string;
  statBonuses: EquipmentStatBonuses;
  equippableActorIds: ActorId[];
  equippableClassIds: ClassId[];
  cursed: boolean;
  twoHanded: boolean;
  usableAsItemSkillId?: SkillId;
  attackElementIds: string[];
  stateInflictIds: StateId[];
  stateInflictionChance: number;
  effectFlags: ItemEquipmentEffectFlags;
  elementalDefenseIds: string[];
  stateDefenseIds: StateId[];
  stateDefenseMode: "resist" | "inflict";
  stateResistanceChance: number;
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
  graphicHue: number;
  transparent: boolean;
  flying: boolean;
  criticalHit: EnemyCritical;
  attackOptions: EnemyOptions;
  skillIds: SkillId[];
  stats: EnemyStats;
  rewards: EnemyRewards;
  actions: EnemyActionPattern[];
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
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
}

export interface EnemyCritical {
  enabled: boolean;
  oneIn: number;
}

export interface EnemyOptions {
  normalAttacksMiss: boolean;
}

export type EnemyActionCondition = { kind: "always" } | { kind: "turn"; start: number; interval: number };

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
  previewBackgroundResourceId?: string;
  battleFlow?: BattleFlow;
  activeSlots?: number;
  battleEventPages: BattleEventPageRecord[];
}

export interface StateRecord {
  id: StateId;
  name: string;
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
  hpDamagePercentPerTurn?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
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
}

export type BattleAnimationScope = "singleTarget" | "allTargets" | "screen";

export type BattleAnimationPosition = "head" | "center" | "feet" | "screen";

export interface BattleAnimationSheet {
  frameWidth: number;
  frameHeight: number;
  columns: number;
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

export interface BattlerAnimationRecord {
  id: BattlerAnimationId;
  name: string;
  resourceId?: string;
  poses: BattlerAnimationPose[];
}

export type BattlerAnimationPoseKind = "idle" | "ready" | "attack" | "defend" | "damage" | "victory" | "dead";

export interface BattlerAnimationPose {
  pose: BattlerAnimationPoseKind;
  frames: BattlerAnimationPoseFrame[];
}

export interface BattlerAnimationPoseFrame {
  pattern: number;
  durationMs: number;
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

export interface ProjectDatabaseRecords extends DatabaseRecords {
  elements?: DatabaseElementRecord[];
  terrains?: DatabaseTerrainRecord[];
  battleCommands?: DatabaseBattleCommandRecord[];
  battlerAnimations?: BattlerAnimationRecord[];
  monsterSpecies?: MonsterSpeciesRecord[];
  crops?: CropRecord[];
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
}

export interface TitleScreenSettings {
  title: string;
  backgroundResourceId?: string;
  layout: TitleScreenLayout;
  menuLabels: TitleScreenMenuLabels;
}

export interface SystemRecords {
  startActorIds: ActorId[];
  titleResourceId?: string;
  systemResourceId?: string;
  battleSystemResourceId?: string;
  battleBgmResourceId?: string;
  initialTroopId?: TroopId;
  battleFlow?: BattleFlow;
  activeSlots?: number;
  rewardPolicy?: RewardPolicy;
  titleScreen?: TitleScreenSettings;
  monsterCollection?: boolean;
  // 전투를 몬스터 파티로 진행(옵션 A). monsterCollection(포획 게이트)과 별개 축이다.
  monsterBattleParty?: boolean;
  giftSystem?: boolean;
  typeChart?: TypeChartRecord;
  timeSystem?: TimeSystemConfig;
}

export interface RewardPolicy {
  participationOnly?: boolean;
  levelGapPenalty?: boolean;
}
