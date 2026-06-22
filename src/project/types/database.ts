import type {
  ActorId,
  BattleAnimationId,
  ClassId,
  EnemyId,
  EquipmentId,
  ItemId,
  SkillId,
  StateId,
  TroopId,
} from "./base";
import type { Command, Condition } from "./events";

export interface ActorRecord {
  id: ActorId;
  name: string;
  nickname: string;
  classId: ClassId;
  initialLevel: number;
  maxLevel: number;
  faceResourceId?: string;
  characterResourceId?: string;
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
  skillIds: SkillId[];
  battleCommands: ClassBattleCommand[];
  learnedSkills: ActorLearnedSkill[];
  equipmentPermissions: ClassEquipmentPermissions;
  parameterCurves: ActorParameterCurves;
  expCurve: ActorExperienceCurve;
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
}

export type ClassBattleCommandKind = "attack" | "skill" | "skillSubset" | "defend" | "item" | "escape" | "event";

export interface ClassBattleCommand {
  id: string;
  name: string;
  kind: ClassBattleCommandKind;
  skillSubsetName?: string;
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
  scope: "none" | "ally" | "enemy";
  price: number;
  skillId?: SkillId;
  description: string;
  type: "normal" | "key" | "switch" | "skillBook";
  occasion: "always" | "battle" | "field" | "never";
  consumable: boolean;
  animationId?: BattleAnimationId;
  stateEffects: DatabaseStateEffect[];
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
  stateInflictIds: StateId[];
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
  monsterResourceId?: string;
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

export interface EnemyRewards {
  exp: number;
  gold: number;
  dropItemId?: ItemId;
  dropRatePercent: number;
}

export type EnemyActionCondition = { kind: "always" } | { kind: "turn"; start: number; interval: number };

export interface EnemyActionPattern {
  skillId: SkillId;
  priority: number;
  condition: EnemyActionCondition;
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
  | { kind: "enemyHp"; enemyId: EnemyId; minPercent: number; maxPercent: number }
  | { kind: "actorHp"; actorId: ActorId; minPercent: number; maxPercent: number }
  | { kind: "enemyTurn"; enemyId: EnemyId; turn: number }
  | { kind: "actorTurn"; actorId: ActorId; turn: number }
  | { kind: "actorCommand"; actorId: ActorId; commandId: string };

export interface BattleEventPageRecord {
  id: string;
  name: string;
  conditions: BattleEventCondition[];
  span: BattleEventSpan;
  commands: Command[];
}

export interface TroopRecord {
  id: TroopId;
  name: string;
  enemyIds: EnemyId[];
  members?: TroopMemberRecord[];
  autoAlign: boolean;
  previewBackgroundResourceId?: string;
  battleEventPages: BattleEventPageRecord[];
}

export interface StateRecord {
  id: StateId;
  name: string;
}

export interface BattleAnimationRecord {
  id: BattleAnimationId;
  name: string;
  resourceId?: string;
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

export interface SystemRecords {
  startActorIds: ActorId[];
  titleResourceId?: string;
  systemResourceId?: string;
  battleSystemResourceId?: string;
  initialTroopId?: TroopId;
}
