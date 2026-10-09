// project/quest/questDef.ts
// 퀘스트 선언적 DSL(handoff §5-1). "무엇을"만 선언하고 "어떻게"(스위치/변수/이벤트 배선)는
// questCompiler가 결정적으로 컴파일한다. 스키마 v3에 optional 필드 `quests?: QuestDef[]`로 보존된다.

import type { Condition, ItemId, MapId, TroopId } from "@/project/types";
import type { TimePhase } from '@/project/gameTime';
import type { QuestPresetId } from './questPresetIds';

// 기존 이벤트 참조.
export interface EventRef {
  readonly mapId: MapId;
  readonly eventId: string;
}

// 기버/대화 대상 NPC를 새로 생성할 때의 스펙(place_npc와 동형).
export interface QuestNpcSpec {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly name: string;
  // 그래픽: 시맨틱 검색(query) 또는 명시 지정.
  readonly graphicQuery?: string;
  readonly textureKey?: string;
  readonly characterIndex?: number;
}

// 수집물(맵에 놓인 조사형 습득 이벤트).
export interface PickupSpec {
  readonly kind: "pickup";
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly lookText?: string; // 습득 전 조사 문구
  /**
   * 같은 맵의 구역 이름. 있으면 **중심 칸**을 목적지로 쓴다 — 구역을 옮기면 퀘스트도 따라온다.
   * `x`/`y` 는 그대로 남는다(옛 저장본 + 구역이 지워졌을 때의 폴백).
   */
  readonly locationId?: string;
}

// 전투 드롭(블로커 처치 보상으로 아이템 지급).
export interface DropSpec {
  readonly kind: "drop";
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly troopId: TroopId;
  /** 같은 맵의 구역 이름. 있으면 중심 칸에 선다. `x`/`y` 는 폴백으로 남는다. */
  readonly locationId?: string;
  readonly graphicQuery?: string;
}

export type CollectSource = PickupSpec | DropSpec;
export type QuestPoint = Omit<PickupSpec, 'kind'>;

// 전투 블로커 배치 스펙.
export interface BlockerSpec {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  /** 같은 맵의 구역 이름. 있으면 중심 칸에 선다. `x`/`y` 는 폴백으로 남는다. */
  readonly locationId?: string;
  readonly graphicQuery?: string;
  readonly intro?: readonly string[];
  readonly victory?: readonly string[];
}

export interface QuestEffects {
  readonly switches?: readonly { readonly id: string; readonly value: boolean }[];
  readonly variables?: readonly { readonly id: string; readonly value: number }[];
  readonly actors?: readonly string[];
}

export interface QuestCost {
  readonly gold?: number;
  readonly items?: readonly { readonly itemId: ItemId; readonly count: number }[];
}

export interface QuestChoiceOption {
  readonly text: string;
  readonly lines?: readonly string[];
  /** False is a retry/hint answer: no cost, effect or progression is applied. */
  readonly completes?: boolean;
  readonly cost?: QuestCost;
  readonly troopId?: TroopId;
  readonly effects?: QuestEffects;
}

export type QuestStep = (
  | { readonly kind: "talk"; readonly target: EventRef | { readonly create: QuestNpcSpec }; readonly lines?: readonly string[] }
  | { readonly kind: "collect"; readonly itemId: ItemId; readonly count: number; readonly sources: readonly CollectSource[] }
  | { readonly kind: "kill"; readonly troopId: TroopId; readonly at: BlockerSpec }

  | {
      readonly kind: "reach";
      readonly mapId: MapId;
      readonly x: number;
      readonly y: number;
      /** 같은 맵의 구역 이름. 있으면 중심 칸이 목적지다. */
      readonly locationId?: string;
    }
  | { readonly kind: 'inspect'; readonly at: QuestPoint; readonly lines: readonly string[] }
  | { readonly kind: 'deliver'; readonly target: EventRef | { readonly create: QuestNpcSpec }; readonly itemId: ItemId; readonly count: number; readonly gives?: QuestReward['items']; readonly lines?: readonly string[] }
  | { readonly kind: 'choice'; readonly target: EventRef | { readonly create: QuestNpcSpec }; readonly prompt: string; readonly options: readonly QuestChoiceOption[] }
  | { readonly kind: 'escort'; readonly target: EventRef | { readonly create: QuestNpcSpec }; readonly destination: { readonly mapId: MapId; readonly x: number; readonly y: number; readonly locationId?: string }; readonly lines?: readonly string[] }
  | { readonly kind: 'craft'; readonly recipeId: string; readonly at: QuestPoint; readonly lines?: readonly string[] }
) & { readonly label?: string; readonly timePhase?: TimePhase };

export type QuestStepKind = QuestStep['kind'];

export interface QuestReward {
  readonly gold?: number;
  readonly items?: readonly { readonly itemId: ItemId; readonly count: number }[];
}

// 진행 단계 게이트(특정 단계 완료 전까지 통행 차단 메시지).
export interface QuestGate {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  /** 같은 맵의 구역 이름. 게이트는 길을 막는 자리라 좁은 구역을 가리키는 편이다. */
  readonly locationId?: string;
  readonly requiresStep: number; // 0-기반 단계 인덱스(이 단계까지 완료돼야 통과)
  readonly lockedText: string;
}

export interface QuestDef {
  readonly presetId?: QuestPresetId;
  /** Custom authoring plan, checked against the compiled step kinds. */
  readonly blueprint?: readonly QuestStepKind[];
  /** Legacy quests keep any order; all new preset plans use sequence. */
  readonly order?: 'sequence' | 'any';
  readonly repeatable?: boolean;
  readonly requiresQuestKeys?: readonly string[];
  readonly onAcceptItems?: QuestReward['items'];
  readonly effects?: QuestEffects;
  /** Deterministic post-report changes to existing NPC/object pages, across maps. */
  readonly worldChanges?: readonly { readonly target: EventRef; readonly lines: readonly string[]; readonly passable?: boolean }[];
  readonly dialogue?: {
    readonly accepted?: string;
    readonly declined?: string;
    readonly reminder?: string;
    readonly completed?: string;
    readonly afterComplete?: string;
  };
  readonly key: string; // 영문/숫자/밑줄
  readonly title: string;
  readonly summary: string;
  readonly giver: EventRef | { readonly create: QuestNpcSpec };
  readonly steps: readonly QuestStep[];
  readonly rewards?: QuestReward;
  readonly gates?: readonly QuestGate[];
}

export type QuestVariableOp = Extract<Condition, { kind: "variable" }>["op"];

export type QuestGraphSwitchCondition =
  | Extract<Condition, { kind: "switch" }>
  | { readonly kind: "switch"; readonly storyFlagId: string; readonly value?: boolean };

export type QuestGraphVariableCondition =
  | Extract<Condition, { kind: "variable" }>
  | { readonly kind: "variable"; readonly storyFlagId: string; readonly op?: QuestVariableOp; readonly value: number };

export interface QuestGraphStoryFlagCondition {
  readonly kind: "storyFlag";
  readonly flagId: string;
  readonly op?: QuestVariableOp;
  readonly value?: boolean | number;
}

export type QuestGraphCondition =
  | QuestGraphSwitchCondition
  | QuestGraphVariableCondition
  | QuestGraphStoryFlagCondition;

export interface QuestGraphConditionAll {
  readonly all: readonly QuestGraphCondition[];
}

export type QuestGraphConditionExpression =
  | QuestGraphCondition
  | QuestGraphConditionAll
  | readonly QuestGraphCondition[];

export interface QuestGraphNode {
  readonly id: string;
  readonly description: string;
  readonly completesWhen: QuestGraphConditionExpression;
  readonly activatesFlags?: readonly string[];
}

export interface QuestGraphEdge {
  readonly from: string;
  readonly to: string;
}

export interface QuestGraphDef {
  readonly kind: "graph";
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly nodes: readonly QuestGraphNode[];
  readonly edges: readonly QuestGraphEdge[];
}

export type AnyQuestDef = QuestDef | QuestGraphDef;

export function isQuestGraphDef(quest: AnyQuestDef | unknown): quest is QuestGraphDef {
  return typeof quest === "object" && quest !== null && !Array.isArray(quest) && (quest as { kind?: unknown }).kind === "graph";
}

export function isStepQuestDef(quest: AnyQuestDef | unknown): quest is QuestDef {
  return typeof quest === "object" && quest !== null && !Array.isArray(quest) && Array.isArray((quest as { steps?: unknown }).steps);
}

export function questDefId(quest: AnyQuestDef): string {
  return isQuestGraphDef(quest) ? quest.id : quest.key;
}

// 컴파일러가 산출하는 스위치/변수 id 규약.
export interface QuestFlagIds {
  readonly started: string; // sw_<key>_started
  readonly done: string; // sw_<key>_done
  readonly progress: string; // var_<key>_progress
  readonly stepSwitches: readonly string[]; // sw_<key>_step<i>
}

export function questFlagIds(key: string, stepCount: number): QuestFlagIds {
  return {
    started: `sw_${key}_started`,
    done: `sw_${key}_done`,
    progress: `var_${key}_progress`,
    stepSwitches: Array.from({ length: stepCount }, (_, index) => `sw_${key}_step${index}`),
  };
}

// key 형식 검증(영문/숫자/밑줄).
export function isValidQuestKey(key: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(key);
}
