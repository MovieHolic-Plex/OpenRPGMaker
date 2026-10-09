import type { QuestDef } from "@/project/quest/questDef";
import { QUEST_PRESET_IDS } from '@/project/quest/questPresetIds';
import { validateArgs } from "./jsonSchema";
import { ToolError, type JsonSchema } from "./types";

const string: JsonSchema = { type: "string", minLength: 1 };
const lines: JsonSchema = { type: "array", items: { type: "string" } };

/**
 * 좌표 앵커 (2026-09-12). `locationId` 를 주면 그 구역의 **중심 칸**을 목적지로 쓴다 —
 * 구역을 옮기면 퀘스트 목적지·블로커·게이트도 따라온다. `x`/`y` 는 폴백으로 남긴다
 * (옛 저장본 + 구역이 지워졌을 때). 좌표를 필수에서 빼지 않는 이유: 로케이션이 하나도
 * 없는 맵에서는 좌표가 유일한 길이고, 두 값을 다 받아야 마이그레이션이 없다.
 */
const position = {
  mapId: string,
  x: { type: "integer" },
  y: { type: "integer" },
  locationId: { ...string, description: "같은 맵의 로케이션(구역) ID 또는 이름. 주면 x/y 대신 그 구역 중심 칸을 쓴다." },
} satisfies Record<string, JsonSchema>;
const npc: JsonSchema = {
  type: "object",
  properties: { ...position, name: string, graphicQuery: string, textureKey: string, characterIndex: { type: "integer", minimum: 0 } },
  required: ["mapId", "x", "y", "name"],
};
const eventRef: JsonSchema = {
  type: "object",
  description: '기존 이벤트 {mapId,eventId} 또는 신규 NPC {create:{mapId,x,y,name,graphicQuery?}}. 두 방식 중 하나.',
  properties: { mapId: string, eventId: string, create: npc },
};
const existingEventRef: JsonSchema = { type: 'object', properties: { mapId: string, eventId: string }, required: ['mapId','eventId'], description: '이미 있는 이벤트만 참조. create 형식은 사용하지 않는다.' };
const source: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["pickup", "drop"] }, ...position,
    lookText: { type: "string" }, troopId: string, graphicQuery: string,
  },
  required: ["kind", "mapId", "x", "y"],
  description: "pickup은 조사 수집물, drop은 전투 승리 드롭(troopId 필수). 각 소스는 아이템 1개를 지급한다.",
};
const blocker: JsonSchema = {
  type: "object",
  properties: { ...position, graphicQuery: string, intro: lines, victory: lines },
  required: ["mapId", "x", "y"],
};
const itemList: JsonSchema = { type: 'array', items: { type: 'object', properties: { itemId: string, count: { type: 'integer', minimum: 1 } }, required: ['itemId','count'] } };
const cost: JsonSchema = { type: 'object', properties: { gold: { type: 'integer', minimum: 0 }, items: itemList } };
const effects: JsonSchema = { type: 'object', properties: {
  switches: { type: 'array', items: { type: 'object', properties: { id: string, value: { type: 'boolean' } }, required: ['id','value'] } },
  variables: { type: 'array', items: { type: 'object', properties: { id: string, value: { type: 'number' } }, required: ['id','value'] } },
  actors: { type: 'array', items: string },
} };
const choiceOptions: JsonSchema = { type: 'array', items: { type: 'object', properties: { text: string, lines, completes: { type: 'boolean' }, cost, troopId: string, effects }, required: ['text'] } };
const stepKinds = ['talk','collect','kill','reach','inspect','deliver','choice','escort','craft'];

export const QUEST_DEF_HINT = 'giver={mapId,eventId} 또는 {create:{mapId,x,y,name}}; talk는 target, collect는 itemId/count/sources, kill은 troopId/at, reach는 mapId/x/y가 필요합니다. 예: {kind:"kill",troopId:"실제 부대 ID",at:{mapId:"실제 맵 ID",x:5,y:5}}.';
export const QUEST_DEF_EXAMPLE = {
  def: {
    key: "village_errand", title: "촌장의 부탁", summary: "약초꾼에게 소식을 전해주세요.",
    giver: { create: { mapId: "map_blank_start", x: 5, y: 5, name: "촌장" } },
    steps: [{ kind: "talk", target: { create: { mapId: "map_blank_start", x: 8, y: 5, name: "약초꾼" } }, lines: ["소식을 들었습니다."] }],
    rewards: { gold: 100 },
  },
};
export const QUEST_DEF_SCHEMA: JsonSchema = {
  type: "object",
  description: "이벤트와 진행 플래그를 컴파일하고 단계 정의를 저장한다. 각 kind의 중첩 필수 구조를 지킬 것.",
  properties: {
    key: { ...string, description: "영문/숫자/밑줄 퀘스트 ID" }, title: string, summary: { type: "string" },
    presetId: { type: 'string', enum: [...QUEST_PRESET_IDS], description: '선택한 프리셋 ID와 목표 구조를 정확히 맞춘다. custom은 blueprint 배열 필요.' },
    blueprint: { type: 'array', items: { type: 'string', enum: stepKinds } },
    order: { type: 'string', enum: ['sequence','any'], description: 'sequence는 앞 단계를 완료해야 다음 목표를 수행할 수 있다. 여러 단계 프리셋은 sequence 필수.' },
    repeatable: { type: 'boolean' }, requiresQuestKeys: { type: 'array', items: string }, onAcceptItems: itemList, effects,
    worldChanges: { type: 'array', items: { type: 'object', properties: { target: existingEventRef, lines, passable: { type: 'boolean' } }, required: ['target','lines'] } },
    dialogue: { type: 'object', description: '이야기와 인물에 맞춘 의뢰인 대사', properties: { accepted: string, declined: string, reminder: string, completed: string, afterComplete: string } },
    giver: eventRef,
    steps: {
      type: "array", description: "1개 이상. talk → target, collect → itemId/count/sources, kill → troopId/at, reach → mapId/x/y.",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: stepKinds },
          label: string, timePhase: { type: 'string', enum: ['morning','day','evening','night'] },
          gives: itemList, prompt: string, options: choiceOptions, recipeId: string,
          destination: blocker,
          target: eventRef, lines, itemId: string, count: { type: "integer", minimum: 1 },
          sources: { type: "array", items: source }, troopId: string, at: blocker, ...position,
        },
        required: ["kind"],
      },
    },
    rewards: {
      type: "object",
      properties: {
        gold: { type: "integer", minimum: 0 },
        items: { type: "array", items: {
          type: "object", properties: { itemId: string, count: { type: "integer", minimum: 1 } }, required: ["itemId", "count"],
        } },
      },
    },
    gates: { type: "array", items: {
      type: "object",
      properties: { ...position, requiresStep: { type: "integer", minimum: 0, description: "0부터 시작하는 단계 인덱스" }, lockedText: { type: "string" } },
      required: ["mapId", "x", "y", "requiresStep", "lockedText"],
    } },
  },
  required: ["key", "title", "summary", "giver", "steps"],
};

/** Provider-safe key union; required fields depend on the actual variant. */
const graphCondition: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["switch", "variable", "storyFlag"] },
    switchId: string, variableId: string, storyFlagId: string, flagId: string,
    op: { type: "string", enum: ["==", ">=", "<=", ">", "<", "!="] },
    value: { description: "switch에는 boolean(생략 true), variable에는 number(필수), storyFlag는 등록된 종류에 따라 boolean 또는 number." },
  },
  required: ["kind"],
};
export const QUEST_GRAPH_CONDITION_SCHEMA: JsonSchema = {
  type: "object",
  description: 'switch:{kind:"switch",switchId,value:true}; variable:{kind:"variable",variableId,op:">=",value:1}; storyFlag:{kind:"storyFlag",flagId,value:true}. 모두 충족은 {all:[조건,...]}. 지원 kind는 이 3종뿐.',
  properties: { ...graphCondition.properties, all: { type: "array", items: graphCondition } },
};
export const QUEST_GRAPH_HINT = 'completesWhen은 {kind:"switch",switchId,value:true}, {kind:"variable",variableId,op:">=",value:1}, {kind:"storyFlag",flagId,value:true} 또는 {all:[이 조건들]}입니다. gold/item/selfSwitch 및 {kind:"all",conditions:...}는 지원하지 않습니다. 아이템 획득·전투 결과는 이벤트에서 등록된 switch/variable을 기록하고 그 조건을 참조하세요.';

function invalid(path: string, message: string): never {
  throw new ToolError(`${path}: ${message} — ${QUEST_DEF_HINT}`, { code: "quest-def" });
}

/** The common runner only checks the top level. Validate nested data before the compiler touches a draft. */
function assertShape(value: unknown, schema: JsonSchema, path: string): void {
  const errors = validateArgs({ type: "object", properties: { [path]: schema }, required: [path] }, { [path]: value });
  if (errors.length > 0) invalid(path, errors[0]);
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) invalid(path, `${schema.minimum} 이상이어야 합니다.`);
  if (schema.type === "object") {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) invalid(`${path}.${key}`, "필수 인자가 누락되었습니다.");
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (record[key] !== undefined) assertShape(record[key], child, `${path}.${key}`);
    }
  }
  if (schema.type === "array" && schema.items) {
    (value as unknown[]).forEach((entry, index) => assertShape(entry, schema.items!, `${path}[${index}]`));
  }
}

function assertEventRef(value: unknown, path: string): void {
  assertShape(value, eventRef, path);
  const record = value as Record<string, unknown>;
  if (record.create !== undefined) {
    if (record.eventId !== undefined || record.mapId !== undefined) invalid(path, "create와 mapId/eventId를 함께 지정하지 마세요.");
  } else {
    assertShape(value, { ...eventRef, required: ["mapId", "eventId"] }, path);
  }
}

export function parseQuestDef(raw: unknown): QuestDef {
  // Validate each step by kind below. The generic coordinate normalizer may synthesize
  // an `at` object for flat reach/talk input because the provider schema is a key union.
  const stepKind = QUEST_DEF_SCHEMA.properties!.steps.items!.properties!.kind;
  assertShape(raw, {
    ...QUEST_DEF_SCHEMA,
    properties: { ...QUEST_DEF_SCHEMA.properties, steps: {
      type: "array", items: { type: "object", properties: { kind: stepKind }, required: ["kind"] },
    } },
  }, "def");
  const def = raw as QuestDef;
  assertEventRef(def.giver, "def.giver");
  if (def.steps.length === 0) invalid("def.steps", "최소 1개 단계가 필요합니다.");
  def.steps.forEach((step, index) => {
    const path = `def.steps[${index}]`;
    const common = QUEST_DEF_SCHEMA.properties!.steps.items!;
    assertShape(step, { ...common, properties: { kind: common.properties!.kind, label: string, timePhase: common.properties!.timePhase } }, path);
    if (['talk','deliver','choice','escort'].includes(step.kind)) assertEventRef((step as { target: unknown }).target, `${path}.target`);
    if (step.kind === "talk") {
      assertEventRef(step.target, `${path}.target`);
      if (step.lines !== undefined) assertShape(step.lines, lines, `${path}.lines`);
    }
    if (step.kind === "collect") {
      assertShape(step.itemId, string, `${path}.itemId`);
      assertShape(step.count, { type: "integer", minimum: 1 }, `${path}.count`);
      assertShape(step.sources, { type: "array", items: source }, `${path}.sources`);
      if (step.sources.length === 0) invalid(`${path}.sources`, "최소 1개 수집원이 필요합니다.");
      step.sources.forEach((entry, sourceIndex) => {
        if (entry.kind === "drop") assertShape(entry.troopId, string, `${path}.sources[${sourceIndex}].troopId`);
      });
    }
    if (step.kind === "kill") {
      assertShape(step.troopId, string, `${path}.troopId`);
      assertShape(step.at, blocker, `${path}.at`);
    }
    if (step.kind === "reach") assertShape(step, { type: "object", properties: position, required: ["mapId", "x", "y"] }, path);
    if (step.kind === 'inspect') { assertShape(step.at, blocker, `${path}.at`); assertShape(step.lines, lines, `${path}.lines`); }
    if (step.kind === 'craft') { assertShape(step.at, blocker, `${path}.at`); assertShape(step.recipeId, string, `${path}.recipeId`); }
    if (step.kind === 'deliver') { assertShape(step.itemId, string, `${path}.itemId`); assertShape(step.count, { type: 'integer', minimum: 1 }, `${path}.count`); if (step.gives !== undefined) assertShape(step.gives, itemList, `${path}.gives`); }
    if (step.kind === 'choice') { assertShape(step.prompt, string, `${path}.prompt`); assertShape(step.options, choiceOptions, `${path}.options`); }
    if (step.kind === 'escort') assertShape(step.destination, blocker, `${path}.destination`);
    if ('lines' in step && step.lines !== undefined) assertShape(step.lines, lines, `${path}.lines`);
  });
  for (const [index, change] of (def.worldChanges ?? []).entries()) {
    assertShape(change.target, existingEventRef, `def.worldChanges[${index}].target`);
    assertEventRef(change.target, `def.worldChanges[${index}].target`);
  }
  return def;
}
