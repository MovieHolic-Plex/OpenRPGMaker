import { parseQuestDef, QUEST_DEF_SCHEMA } from "@/editor/tools/questToolSchemas";
import type { JsonSchema } from "@/editor/tools/types";
import {
  isQuestGraphDef, questDefId, questFlagIds,
  type AnyQuestDef, type EventRef, type QuestDef, type QuestGraphDef, type QuestReward, type QuestStep,
} from "@/project/quest/questDef";
import { findQuestById, validateQuestGraph } from "@/project/quest/questGraph";
import { questPresetIssue } from "@/project/quest/questPresets";
import { buildQuestTableRows } from "@/project/quest/questTable";
import { validateQuestReferences } from "@/project/quest/questValidation";
import type { Project } from "@/project/types";
import { roJosa } from "@/util/josa";
import { displayText } from "../../target";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "27-quests";

type Args = Record<string, unknown>;

const QUEST_ID = { type: "string", minLength: 1, description: "퀘스트의 현재 이름 또는 식별자. 선택 범위에 한 건만 있으면 생략할 수 있습니다." } satisfies JsonSchema;
const TITLE = { type: "string", minLength: 1, description: "퀘스트에 표시할 이름" } satisfies JsonSchema;
const LABEL = { type: "string", minLength: 1, description: "퀘스트 일지에 표시할 목표 문구" } satisfies JsonSchema;
const STEP_NUMBER = { type: "integer", minimum: 1, description: "첫 목표를 1로 세는 목표 번호" } satisfies JsonSchema;
const SWITCH = { type: "string", minLength: 1, description: "그래프 목표를 완료시키는 기존 스위치의 식별자" } satisfies JsonSchema;
const OBJECTIVE = {
  ...QUEST_DEF_SCHEMA.properties!.steps.items!,
  description: "단계형 퀘스트 정의에 기록할 목표. 대화, 수집, 전투, 도달, 조사, 납품, 선택, 동행, 제작 중 한 종류를 지정하세요.",
} satisfies JsonSchema;
const GOLD = { type: "integer", minimum: 0, maximum: 999999, description: "정의에 기록할 보상 골드. 0은 골드 보상 해제" } satisfies JsonSchema;
const REWARD_ITEMS = {
  ...QUEST_DEF_SCHEMA.properties!.rewards.properties!.items,
  description: "보상 아이템 목록 전체. 빈 목록은 아이템 보상 해제",
} satisfies JsonSchema;

function schema(description: string, properties: Record<string, JsonSchema>, required: string[]): JsonSchema {
  return { type: "object", additionalProperties: false, description, properties, required };
}

function preview(value: unknown, fallback: string): string {
  const safe = typeof value === "string" ? displayText(value.replace(/[{}\[\]「」]/gu, " "), fallback) : fallback;
  const chars = Array.from(safe);
  return chars.length > 32 ? chars.slice(0, 31).join("") + "…" : safe;
}

function requiredText(value: unknown, reason: string): string {
  if (typeof value !== "string" || !value.trim()) throw new PrimitiveError(reason);
  return value.trim();
}

function questFor(ctx: PrimitiveContext, args: Args): AnyQuestDef {
  const { project } = ctx;
  const selector = typeof args.questId === "string" ? args.questId.trim() : "";
  const byId = selector ? findQuestById(project, selector) : undefined;
  if (byId) return byId;
  const candidates = (project.quests ?? []).filter(quest => !selector || quest.title.trim() === selector);
  if (selector && candidates.length === 1) return candidates[0];
  const ids = new Set(questIdsForTarget(ctx));
  const scoped = candidates.filter(quest => ids.has(questDefId(quest)));
  if (scoped.length === 1) return scoped[0];
  if (scoped.length > 1) throw new PrimitiveError("선택한 범위에 퀘스트가 여러 개 있어요. 바꿀 퀘스트를 골라 주세요.");
  throw new PrimitiveError("퀘스트를 찾을 수 없어요.");
}

function questName(ctx: PrimitiveContext, args: Args): string {
  const quest = questFor(ctx, args);
  return preview(quest.title === questDefId(quest) ? undefined : quest.title, "선택한 퀘스트");
}

function hostMap(ctx: PrimitiveContext) {
  const { target, project } = ctx;
  if (target.kind === "dbEntry" || !Object.hasOwn(project.maps, target.mapId)) {
    throw new PrimitiveError("범위 밖: 퀘스트와 연결된 맵이나 이벤트를 선택해 주세요.");
  }
  const map = project.maps[target.mapId];
  if (target.kind === "event" && !map.events.some(event => event.id === target.eventId)) {
    throw new PrimitiveError("범위 밖: 선택한 이벤트를 찾을 수 없어요.");
  }
  return map;
}

function giverRef(quest: QuestDef): EventRef | null {
  if (!quest.giver) return null;
  return "create" in quest.giver
    ? { mapId: quest.giver.create.mapId, eventId: `ev_${quest.key}_giver` }
    : quest.giver;
}

function questIdsForTarget(ctx: PrimitiveContext): string[] {
  const map = hostMap(ctx);
  const eventId = ctx.target.kind === "event" ? ctx.target.eventId : undefined;
  const matches = (ref: { readonly mapId: string | null; readonly eventId: string | null } | null) =>
    ref?.mapId === map.id && (eventId === undefined || ref.eventId === eventId);
  const quests = ctx.project.quests ?? [];
  const graphs = quests.filter(isQuestGraphDef);
  const graphRows = graphs.length ? buildQuestTableRows({ ...ctx.project, quests: graphs }) : [];
  return quests.filter(quest => isQuestGraphDef(quest)
    ? graphRows.some(row => row.id === quest.id && row.candidate === null && matches(row.giver))
    : matches(giverRef(quest))).map(questDefId);
}

function editScope(ctx: PrimitiveContext): ReturnType<SmallTaskPrimitive["scope"]> {
  return { kind: "projectArea", area: "quests", ids: questIdsForTarget(ctx) };
}

function createGiver(ctx: PrimitiveContext, args: Args): EventRef {
  const map = hostMap(ctx);
  const eventId = ctx.target.kind === "event" ? ctx.target.eventId : args.giverEventId;
  if (ctx.target.kind === "event" && args.giverEventId !== undefined && args.giverEventId !== eventId) {
    throw new PrimitiveError("범위 밖: 선택한 이벤트에만 퀘스트를 등록할 수 있어요.");
  }
  if (!map.events.some(event => event.id === eventId)) {
    throw new PrimitiveError("범위 밖: 선택한 맵에서 의뢰를 기록할 이벤트를 골라 주세요.");
  }
  return { mapId: map.id, eventId: eventId as string };
}

function nextQuestKey(project: Project): string {
  const used = new Set((project.quests ?? []).map(questDefId));
  const switches = new Set(project.switches.map(entry => entry.id));
  for (const flagId of Object.keys(project.flags)) switches.add(flagId);
  const variables = new Set(project.variables.map(entry => entry.id));
  let index = 1;
  while (true) {
    const key = `quest_${index++}`;
    const flags = questFlagIds(key, 12);
    if (!used.has(key) && !variables.has(flags.progress)
      && ![flags.started, flags.done, ...flags.stepSwitches].some(id => switches.has(id))) return key;
  }
}

function replaceQuest(project: Project, current: AnyQuestDef, updated: AnyQuestDef): Project {
  return { ...project, quests: (project.quests ?? []).map(quest => quest === current ? updated : quest) };
}

function parseStepDef(raw: QuestDef): QuestDef {
  try {
    return parseQuestDef(raw);
  } catch {
    throw new PrimitiveError("퀘스트 목표에 필요한 값과 입력 형식을 확인해 주세요.");
  }
}

function validateStepDef(project: Project, def: QuestDef, previous?: QuestDef): QuestDef {
  const withoutPrevious = previous ? { ...project, quests: project.quests?.filter(quest => quest !== previous) } : project;
  try {
    validateQuestReferences(withoutPrevious, def);
  } catch {
    throw new PrimitiveError("퀘스트의 연결 대상과 목표 수량을 확인해 주세요.");
  }
  // The compiler normally creates choice effects. A definition-only edit refers to existing flags.
  for (const step of def.steps) {
    if (step.kind !== "choice" || previous?.steps.includes(step)) continue;
    for (const option of step.options) {
      if (option.effects?.switches?.some(flag => !project.switches.some(entry => entry.id === flag.id))
        || option.effects?.variables?.some(flag => !project.variables.some(entry => entry.id === flag.id))) {
        throw new PrimitiveError("선택 결과에 쓸 스위치나 변수를 찾을 수 없어요.");
      }
    }
  }
  if (questPresetIssue(project, def)) throw new PrimitiveError("기존 퀘스트 틀에 맞는 목표를 입력해 주세요.");
  return def;
}

function validateGraph(project: Project, quest: QuestGraphDef): QuestGraphDef {
  if (validateQuestGraph(project, quest).some(issue => issue.severity === "error")) {
    throw new PrimitiveError("퀘스트 목표의 완료 조건과 연결을 확인해 주세요.");
  }
  return quest;
}

function switchCondition(args: Args) {
  return { kind: "switch" as const, switchId: requiredText(args.switchId, "목표를 완료할 스위치를 골라 주세요."), value: true };
}

function stepIndex(args: Args, length: number): number {
  const step = args.step as number;
  if (!Number.isSafeInteger(step) || step < 1 || step > length) throw new PrimitiveError("해당 번호의 목표를 찾을 수 없어요.");
  return step - 1;
}

function withSteps(quest: QuestDef, steps: readonly QuestStep[]): QuestDef {
  return { ...quest, steps, ...(quest.blueprint ? { blueprint: steps.map(step => step.kind) } : {}) };
}

function appendObjective(project: Project, quest: AnyQuestDef, args: Args): AnyQuestDef {
  if (isQuestGraphDef(quest)) {
    if (args.objective !== undefined) throw new PrimitiveError("그래프 목표에는 문구와 완료 스위치를 입력해 주세요.");
    const used = new Set(quest.nodes.map(node => node.id));
    let number = 1;
    while (used.has(`step_${number}`)) number++;
    const node = {
      id: `step_${number}`,
      description: requiredText(args.label, "추가할 목표 문구를 입력해 주세요."),
      completesWhen: switchCondition(args),
    };
    const last = quest.nodes.at(-1);
    return validateGraph(project, {
      ...quest, nodes: [...quest.nodes, node],
      edges: last ? [...quest.edges, { from: last.id, to: node.id }] : quest.edges,
    });
  }
  if (args.objective === undefined || args.switchId !== undefined || args.label !== undefined) {
    throw new PrimitiveError("단계형 퀘스트에 추가할 목표를 입력해 주세요.");
  }
  const updated = parseStepDef(withSteps(quest, [...quest.steps, structuredClone(args.objective) as QuestStep]));
  return validateStepDef(project, updated, quest);
}

function updateObjective(project: Project, quest: AnyQuestDef, args: Args): AnyQuestDef {
  if (isQuestGraphDef(quest)) {
    if (args.objective !== undefined || (args.label === undefined && args.switchId === undefined)) {
      throw new PrimitiveError("그래프 목표에서 바꿀 문구나 완료 스위치를 입력해 주세요.");
    }
    const index = stepIndex(args, quest.nodes.length);
    const nodes = quest.nodes.map((node, i) => i === index ? {
      ...node,
      ...(args.label !== undefined ? { description: requiredText(args.label, "목표 문구를 입력해 주세요.") } : {}),
      ...(args.switchId !== undefined ? { completesWhen: switchCondition(args) } : {}),
    } : node);
    const updated = { ...quest, nodes };
    return args.switchId === undefined ? updated : validateGraph(project, updated);
  }
  const index = stepIndex(args, quest.steps.length);
  if (args.switchId !== undefined || (args.objective === undefined) === (args.label === undefined)) {
    throw new PrimitiveError("바꿀 목표나 목표 문구 중 하나를 입력해 주세요.");
  }
  if (args.label !== undefined) {
    const label = requiredText(args.label, "목표 문구를 입력해 주세요.");
    return { ...quest, steps: quest.steps.map((step, i) => i === index ? { ...step, label } : step) };
  }
  const updated = parseStepDef(withSteps(quest, quest.steps.map((step, i) =>
    i === index ? structuredClone(args.objective) as QuestStep : step)));
  return validateStepDef(project, updated, quest);
}

function removeObjective(project: Project, quest: AnyQuestDef, args: Args): AnyQuestDef {
  if (isQuestGraphDef(quest)) {
    const index = stepIndex(args, quest.nodes.length);
    const id = quest.nodes[index].id;
    return validateGraph(project, {
      ...quest,
      nodes: quest.nodes.filter(node => node.id !== id),
      edges: quest.edges.filter(edge => edge.from !== id && edge.to !== id),
    });
  }
  const index = stepIndex(args, quest.steps.length);
  if (quest.steps.length === 1) throw new PrimitiveError("퀘스트에는 목표가 하나 이상 있어야 해요.");
  if (quest.gates?.some(gate => gate.requiresStep === index)) throw new PrimitiveError("통로를 여는 목표는 삭제할 수 없어요.");
  const flags = questFlagIds(quest.key, quest.steps.length);
  const laterFlags = new Set(flags.stepSwitches.slice(index + 1));
  if (project.switches.some(flag => laterFlags.has(flag.id))) {
    throw new PrimitiveError("범위 밖: 뒤 목표의 진행 스위치도 옮겨야 해서 이 목표를 지울 수 없어요.");
  }
  const steps = quest.steps.filter((_, i) => i !== index);
  const updated = {
    ...withSteps(quest, steps),
    ...(quest.gates ? { gates: quest.gates.map(gate => gate.requiresStep > index ? { ...gate, requiresStep: gate.requiresStep - 1 } : gate) } : {}),
  };
  return validateStepDef(project, updated, quest);
}

function setReward(project: Project, quest: AnyQuestDef, args: Args): QuestDef {
  if (isQuestGraphDef(quest)) {
    throw new PrimitiveError("범위 밖: 그래프 퀘스트 보상은 이벤트에서 지급해요.");
  }
  if (args.gold === undefined && args.items === undefined) throw new PrimitiveError("바꿀 보상을 입력해 주세요.");
  const rewards: QuestReward = {
    ...quest.rewards,
    ...(args.gold !== undefined ? { gold: args.gold as number } : {}),
    ...(args.items !== undefined ? { items: structuredClone(args.items) as QuestReward["items"] } : {}),
  };
  return validateStepDef(project, parseStepDef({ ...quest, rewards }), quest);
}

function primitive(id: string, title: string, spec: Pick<SmallTaskPrimitive, "args" | "describe" | "apply">
  & Partial<Pick<SmallTaskPrimitive, "scope" | "hidden">>): SmallTaskPrimitive {
  return { id, unit: UNIT, title, covers: { tools: [id] }, targets: ["map", "event"], scope: editScope, ...spec };
}

const objectiveFields = { label: LABEL, switchId: SWITCH, objective: OBJECTIVE };

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  primitive("quest.create", "퀘스트 정의 등록", {
    args: schema("선택한 이벤트를 의뢰인으로 기록하고 첫 목표를 등록합니다.", {
      title: TITLE,
      summary: { type: "string", description: "퀘스트 일지에 표시할 짧은 설명" },
      giverEventId: { type: "string", description: "맵을 선택했을 때 그 맵에 이미 있는 의뢰 이벤트의 식별자" },
      objective: OBJECTIVE,
    }, ["title", "objective"]),
    scope(ctx) {
      hostMap(ctx);
      return { kind: "projectArea", area: "quests", ids: [], create: 1 };
    },
    describe(_ctx, args) {
      return `「${preview(args.title, "새 퀘스트")}」 퀘스트 정의를 등록합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = validateStepDef(project, parseStepDef({
        key: nextQuestKey(project),
        title: requiredText(args.title, "퀘스트 이름을 입력해 주세요."),
        summary: typeof args.summary === "string" ? args.summary.trim() : "",
        giver: createGiver(ctx, args),
        steps: [structuredClone(args.objective) as QuestStep],
        order: "sequence",
      }));
      return { ...project, quests: [...(project.quests ?? []), quest] };
    },
  }),
  primitive("quest.rename", "퀘스트 이름 변경", {
    args: schema("퀘스트 일지의 제목을 바꿉니다.", { questId: QUEST_ID, title: TITLE }, ["title"]),
    describe(_ctx, args) {
      const name = preview(args.title, "새 이름");
      return `퀘스트 이름을 「${name}」${roJosa(name)} 바꿉니다.`;
    },
    apply(ctx, args) {
      const quest = questFor(ctx, args);
      return replaceQuest(ctx.project, quest, { ...quest, title: requiredText(args.title, "퀘스트 이름을 입력해 주세요.") });
    },
  }),
  primitive("quest.objective.add", "퀘스트 목표 추가", {
    args: schema("단계형은 목표 하나를 추가하고, 그래프형은 문구와 기존 완료 스위치를 추가합니다.", { questId: QUEST_ID, ...objectiveFields }, []),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 정의에 목표를 하나 추가합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      return replaceQuest(project, quest, appendObjective(project, quest, args));
    },
  }),
  primitive("quest.objective.update", "퀘스트 목표 수정", {
    args: schema("목표 문구를 바꾸거나 단계형 목표를 교체합니다. 그래프에서는 완료 스위치도 바꿀 수 있습니다.", {
      questId: QUEST_ID, step: STEP_NUMBER, ...objectiveFields,
    }, ["step"]),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 정의의 ${args.step}번 목표를 수정합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      return replaceQuest(project, quest, updateObjective(project, quest, args));
    },
  }),
  primitive("quest.objective.remove", "퀘스트 목표 삭제", {
    args: schema("퀘스트 정의에서 번호로 지정한 목표를 지웁니다.", { questId: QUEST_ID, step: STEP_NUMBER }, ["step"]),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 정의의 ${args.step}번 목표를 지웁니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      return replaceQuest(project, quest, removeObjective(project, quest, args));
    },
  }),
  primitive("quest.reward.set", "퀘스트 보상 정의 변경", {
    args: schema("단계형 퀘스트 정의에 골드나 아이템 보상을 기록합니다.", { questId: QUEST_ID, gold: GOLD, items: REWARD_ITEMS }, []),
    describe(ctx, args) {
      const reward = args.gold !== undefined && args.items === undefined ? `보상 골드를 ${args.gold}골드로` : "보상 내역을";
      return `「${questName(ctx, args)}」 정의의 ${reward} 바꿉니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      return replaceQuest(project, quest, setReward(project, quest, args));
    },
  }),
  primitive("quest.remove", "퀘스트 등록 삭제", {
    args: schema("퀘스트 정의를 지워 일지에서 등록을 취소합니다.", { questId: QUEST_ID }, []),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 퀘스트 등록을 삭제합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      const id = questDefId(quest);
      if (project.quests?.some(other => !isQuestGraphDef(other) && other.requiresQuestKeys?.includes(id))
        || project.storyFlags?.some(flag => flag.questId === id)) {
        throw new PrimitiveError("범위 밖: 다른 퀘스트나 이야기 진행 값에서 이 퀘스트를 사용하고 있어요.");
      }
      return { ...project, quests: project.quests?.filter(entry => entry !== quest) };
    },
  }),
  primitive("quest.giver.link", "퀘스트 의뢰인 연결", {
    hidden: true,
    args: schema("기존 퀘스트를 선택한 의뢰 이벤트에 연결합니다.", { questId: QUEST_ID }, ["questId"]),
    describe() {
      return "퀘스트를 선택한 의뢰 이벤트에 연결합니다.";
    },
    apply() {
      throw new PrimitiveError("범위 밖: 의뢰인을 연결하려면 퀘스트와 이벤트를 함께 바꿔야 해요.");
    },
  }),
];
