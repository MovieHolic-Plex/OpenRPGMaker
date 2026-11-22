import { withOpenEventDrafts } from "@/ai/smallTaskReferences";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { parseQuestDef, QUEST_DEF_SCHEMA } from "@/editor/tools/questToolSchemas";
import type { JsonSchema } from "@/editor/tools/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { locationCenter, resolveLocationAnchorRect } from "@/project/locationAnchors";
import {
  isQuestGraphDef, questDefId, questFlagIds,
  type AnyQuestDef, type EventRef, type QuestDef, type QuestGraphConditionExpression, type QuestGraphDef, type QuestReward, type QuestStep,
} from "@/project/quest/questDef";
import { extractQuestGraphConditions, resolveQuestGraphCondition, selectWriteSite, validateQuestGraph, writeKnownNotToSatisfy } from "@/project/quest/questGraph";
import { questPresetIssue } from "@/project/quest/questPresets";
import { validateQuestReferences } from "@/project/quest/questValidation";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, Project } from "@/project/types";
import { roJosa } from "@/util/josa";
import { jsonEqual } from "@/util/structuralJson";
import { displayText } from "../../target";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "27-quests";

type Args = Record<string, unknown>;

const QUEST_ID = { type: "string", minLength: 1, description: "퀘스트의 현재 이름 또는 식별자. 선택 범위에 한 건만 있으면 생략할 수 있습니다." } satisfies JsonSchema;
const TITLE = { type: "string", minLength: 1, description: "퀘스트에 표시할 이름" } satisfies JsonSchema;
const LABEL = { type: "string", minLength: 1, description: "퀘스트 일지에 표시할 목표 문구" } satisfies JsonSchema;
const STEP_NUMBER = { type: "integer", minimum: 1, description: "첫 목표를 1로 세는 목표 번호" } satisfies JsonSchema;
const SWITCH = { type: "string", minLength: 1, description: "이벤트에서 값을 기록하는 기존 완료 스위치의 식별자" } satisfies JsonSchema;
const stepSchema = QUEST_DEF_SCHEMA.properties!.steps.items!;
const objectiveKeys = {
  talk: ["target", "lines"],
  collect: ["itemId", "count", "sources"],
  kill: ["troopId", "at"],
  reach: ["mapId", "x", "y", "locationId"],
  inspect: ["at", "lines"],
  deliver: ["target", "itemId", "count", "gives", "lines"],
  choice: ["target", "prompt", "options"],
  escort: ["target", "destination", "lines"],
  craft: ["at", "recipeId", "lines"],
} satisfies Record<QuestStep["kind"], string[]>;
const OBJECTIVE: JsonSchema = {
  ...strictInput(stepSchema),
  description: "단계형 퀘스트 정의에 기록할 목표. 대화, 수집, 전투, 도달, 조사, 납품, 선택, 동행, 제작 중 한 종류를 지정하세요.",
  oneOf: Object.entries(objectiveKeys).map(([kind, fields]) => ({
    type: "object",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      ...Object.fromEntries(["label", "timePhase", ...fields].map(key => [key, strictInput(stepSchema.properties![key], key)])),
      kind: { type: "string", enum: [kind] },
    },
  })),
};
const GOLD = { type: "integer", minimum: 0, maximum: 999999, description: "정의에 기록할 보상 골드. 0은 골드 보상 해제" } satisfies JsonSchema;
const REWARD_ITEMS = {
  ...strictInput(QUEST_DEF_SCHEMA.properties!.rewards.properties!.items),
  description: "보상 아이템 목록 전체. 빈 목록은 아이템 보상 해제",
} satisfies JsonSchema;

function strictInput(input: JsonSchema, key?: string): JsonSchema {
  return {
    ...input,
    ...(input.minLength ? { pattern: "\\S" } : {}),
    ...(key === "locationId" ? { description: "해당 맵에 등록된 장소의 식별자. 장소의 중심 칸을 사용합니다." } : {}),
    ...(input.properties ? {
      additionalProperties: false,
      properties: Object.fromEntries(Object.entries(input.properties).map(([name, field]) => [name, strictInput(field, name)])),
    } : {}),
    ...(input.items ? { items: strictInput(input.items) } : {}),
  };
}

function schema(description: string, properties: Record<string, JsonSchema>, required: string[]): JsonSchema {
  return { type: "object", additionalProperties: false, description, properties, required };
}

function preview(value: unknown, fallback: string): string {
  const safe = typeof value === "string" ? displayText(value.replace(/[{}\[\]「」]/gu, " "), fallback) : fallback;
  return safe.length > 32 ? safe.slice(0, 31).replace(/[\uD800-\uDBFF]$/u, "") + "…" : safe;
}

function requiredText(value: unknown, reason: string): string {
  if (typeof value !== "string" || !value.trim()) throw new PrimitiveError(reason);
  return value.trim();
}

function questFor(ctx: PrimitiveContext, args: Args): AnyQuestDef {
  const map = hostMap(ctx);
  const quests = ctx.project.quests ?? [];
  const selector = args.questId === undefined ? undefined : requiredText(args.questId, "바꿀 퀘스트의 이름을 입력해 주세요.");
  const byId = selector === undefined ? [] : quests.filter(quest => questDefId(quest) === selector);
  const candidates = byId.length ? byId : quests.filter(quest => selector === undefined || quest.title.trim() === selector);
  const usage = candidates.some(isQuestGraphDef) ? buildStoryFlagUsageIndex(ctx.project) : undefined;
  const scoped = candidates.filter(quest => {
    const giver = isQuestGraphDef(quest) ? graphGiver(ctx.project, quest, usage!) : giverRef(quest);
    return giver?.mapId === map.id && (ctx.target.kind !== "event" || giver.eventId === ctx.target.eventId);
  });
  if (scoped.length > 1) throw new PrimitiveError("선택한 범위에 퀘스트가 여러 개 있어요. 바꿀 퀘스트를 골라 주세요.");
  if (scoped.length === 1) {
    const id = questDefId(scoped[0]);
    if (quests.filter(quest => questDefId(quest) === id).length !== 1) {
      throw new PrimitiveError("같은 식별자를 쓰는 퀘스트가 여러 개 있어요. 자료집에서 먼저 정리해 주세요.");
    }
    return scoped[0];
  }
  if (selector !== undefined && candidates.length) throw new PrimitiveError("범위 밖: 선택한 맵이나 이벤트에 연결된 퀘스트만 바꿀 수 있어요.");
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
  if (target.kind === "event") {
    // A quest references the giver event as a whole. Validate a page if the host selected one.
    const event = map.events.find(event => event.id === target.eventId);
    if (!event || (target.pageId && !event.pages?.some(page => page.id === target.pageId))) {
      throw new PrimitiveError("범위 밖: 선택한 이벤트나 페이지를 찾을 수 없어요.");
    }
  }
  return map;
}

function giverRef(quest: QuestDef): EventRef | null {
  if (!quest.giver) return null;
  return "create" in quest.giver
    ? { mapId: quest.giver.create.mapId, eventId: `ev_${quest.key}_giver` }
    : quest.giver;
}

function graphGiver(project: Project, quest: QuestGraphDef, usage: ReturnType<typeof buildStoryFlagUsageIndex>): EventRef | null {
  const first = quest.nodes[0];
  if (!first) return null;
  let giver: EventRef | null = null;
  try {
    for (const raw of extractQuestGraphConditions(first.completesWhen)) {
      const condition = resolveQuestGraphCondition(project, raw);
      const writers = usageBucketFor(usage, condition.kind, condition.targetId).writes
        .filter(site => !writeKnownNotToSatisfy(site.assignedValue, condition));
      const owner = writers[0];
      if (!owner?.mapId || !owner.eventId) return null;
      giver ??= { mapId: owner.mapId, eventId: owner.eventId };
      const { mapId, eventId } = giver;
      if (writers.some(site => site.mapId !== mapId || site.eventId !== eventId)) return null;
    }
  } catch {
    return null;
  }
  return giver;
}

function editScope(
  ctx: PrimitiveContext, args: Args, change: { fields: readonly string[] } | { remove: true },
): ReturnType<SmallTaskPrimitive["scope"]> {
  return { kind: "projectArea", area: "quests", ids: [questDefId(questFor(ctx, args))], ...change };
}

function createGiver(ctx: PrimitiveContext, args: Args): EventRef {
  const map = hostMap(ctx);
  const eventId = ctx.target.kind === "event" ? ctx.target.eventId : args.giverEventId;
  if (ctx.target.kind === "event" && args.giverEventId !== undefined && args.giverEventId !== eventId) {
    throw new PrimitiveError("범위 밖: 선택한 이벤트에만 퀘스트를 등록할 수 있어요.");
  }
  if (typeof eventId !== "string" || !map.events.some(event => event.id === eventId && event.draft?.kind !== "new")) {
    throw new PrimitiveError("범위 밖: 선택한 맵에서 의뢰를 기록할 이벤트를 골라 주세요.");
  }
  return { mapId: map.id, eventId };
}

function* questCommands(project: Project) {
  function* inList(commands: readonly Command[]): Generator<Record<string, string | number | boolean>> {
    for (const command of commands) {
      if (command.kind === "m2Command" && command.commandId === "m2-208-quest-objective") yield command.fields;
      for (const branch of nestedCommandLists(command)) yield* inList(branch);
    }
  }
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      yield* inList(event.commands ?? []);
      for (const page of event.pages ?? []) yield* inList(page.commands);
    }
  }
  for (const event of project.commonEvents) yield* inList(event.commands);
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) yield* inList(page.commands);
    for (const list of troopAfterBattleLists(troop)) yield* inList(list.commands);
  }
}

function questEventViews(ctx: PrimitiveContext) {
  // The selected event in the task copy includes edits from earlier tools in this run.
  const target = ctx.target.kind === "event" ? ctx.target : undefined;
  const working = withOpenEventDrafts(ctx.project, ctx.live, target);
  const saved = projectViewWithoutEventDrafts(withOpenEventDrafts(ctx.project, ctx.live));
  return { working, saved };
}

function questReferenceViews(ctx: PrimitiveContext): Project[] {
  const { working, saved } = questEventViews(ctx);
  return [...new Set([ctx.project, working, saved])];
}

function commandId(value: string | number | boolean | undefined, fallback: string): string {
  return value === undefined ? fallback : String(value);
}

function questDialogueRef(project: Project, id: string, fields: (field: string) => boolean): boolean {
  const prefix = `qs/${encodeURIComponent(id)}#`;
  return project.dialogueDesk?.proposals.some(proposal =>
    proposal.lineId.startsWith(prefix) && fields(proposal.lineId.slice(prefix.length))) ?? false;
}

function assertNoTextProposal(project: Project, quest: AnyQuestDef, field: string): void {
  if (questDialogueRef(project, questDefId(quest), entry => entry === field)) {
    throw new PrimitiveError("자료집에 이 문구의 윤문 제안이 있어요. 제안을 먼저 검토해 주세요.");
  }
}

function assertNoObjectiveReferences(ctx: PrimitiveContext, quest: AnyQuestDef, index: number): void {
  const id = questDefId(quest);
  const graph = isQuestGraphDef(quest);
  const prefix = graph ? "node" : "step";
  if (questDialogueRef(ctx.project, id, field => field.startsWith(prefix) && Number(field.slice(prefix.length)) >= index)) {
    throw new PrimitiveError("범위 밖: 삭제되거나 번호가 바뀌는 목표에 자료집의 윤문 제안이 있어요.");
  }
  for (const project of questReferenceViews(ctx)) {
    for (const fields of questCommands(project)) {
      if (commandId(fields.questId, "quest") !== id) continue;
      const objectiveId = commandId(fields.objectiveId, "objective");
      if (!graph || objectiveId === quest.nodes[index].id) {
        throw new PrimitiveError("범위 밖: 이벤트 명령에서 이 퀘스트 목표를 사용하고 있어요.");
      }
    }
  }
}

// The compiler names progress and supporting state from a quest key and zero-based objective number.
function questProgressUses(project: Project, key: string, stepMatches?: (index: number) => boolean): boolean {
  const matches = (id: string, kind: "switch" | "variable") => {
    const prefix = `${kind === "switch" ? "sw" : "var"}_${key}_`;
    if (!id.startsWith(prefix)) return false;
    const suffix = id.slice(prefix.length);
    if (!stepMatches && /^(?:started|done|progress|report_quantity\d+)$/u.test(suffix)) return true;
    const match = /^(?:step|escort|source|c|craft|choice|follower|deliver)(\d+)(?:_\d+(?:_quantity\d+)?|_quantity\d+)?$/u.exec(suffix);
    return match !== null && (!stepMatches || stepMatches(Number(match[1])));
  };
  if (project.switches.some(entry => matches(entry.id, "switch"))
    || Object.keys(project.flags).some(id => matches(id, "switch"))
    || Object.entries(project.session.switches).some(([id, on]) => on && matches(id, "switch"))
    || project.variables.some(entry => matches(entry.id, "variable"))
    || project.storyFlags?.some(flag => matches(flag.targetId, flag.kind))
    || project.endings?.some(ending => ending.conditions.some(condition =>
      (condition.kind === "switch" && matches(condition.switchId, "switch"))
      || (condition.kind === "variable" && matches(condition.variableId, "variable"))))) return true;
  if (buildStoryFlagUsageIndex(project).sites.some(site => matches(site.targetId, site.kind))) return true;
  return (project.quests ?? []).some(quest => isQuestGraphDef(quest) && quest.nodes.some(node =>
    extractQuestGraphConditions(node.completesWhen).some(condition =>
      ("switchId" in condition && matches(condition.switchId, "switch"))
      || ("variableId" in condition && matches(condition.variableId, "variable")))));
}

function nextQuestKey(ctx: PrimitiveContext): string {
  const { project } = ctx;
  const views = questReferenceViews(ctx);
  const used = new Set((project.quests ?? []).map(questDefId));
  for (const quest of project.quests ?? []) {
    if (!isQuestGraphDef(quest)) for (const required of quest.requiresQuestKeys ?? []) used.add(required);
  }
  for (const flag of project.storyFlags ?? []) if (flag.questId) used.add(flag.questId);
  for (const view of views) for (const fields of questCommands(view)) used.add(commandId(fields.questId, "quest"));
  for (const proposal of project.dialogueDesk?.proposals ?? []) {
    const key = /^qs\/(quest_\d+)#/u.exec(proposal.lineId)?.[1];
    if (key) used.add(key);
  }
  for (const note of project.dialogueDesk?.sceneNotes ?? []) {
    if (note.sceneId.startsWith("qs/")) used.add(note.sceneId.slice(3));
  }
  const switches = new Set(project.switches.map(entry => entry.id));
  for (const flagId of [...Object.keys(project.flags), ...Object.keys(project.session.switches)]) switches.add(flagId);
  const variables = new Set([...project.variables.map(entry => entry.id), ...Object.keys(project.session.variables)]);
  for (const view of views) for (const site of buildStoryFlagUsageIndex(view).sites) {
    (site.kind === "switch" ? switches : variables).add(site.targetId);
  }
  for (const flag of project.storyFlags ?? []) (flag.kind === "switch" ? switches : variables).add(flag.targetId);
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

function validateNewObjective(project: Project, step: QuestStep): void {
  const validatePoint = (point: { mapId: string; x: number; y: number; locationId?: string }) => {
    if (!Object.hasOwn(project.maps, point.mapId)) throw new PrimitiveError("목표를 수행할 맵을 찾을 수 없어요.");
    if (point.locationId === undefined) return;
    const rect = resolveLocationAnchorRect(project, point.mapId, point);
    if (!rect) throw new PrimitiveError("목표로 지정한 장소를 해당 맵에서 찾을 수 없어요.");
    const { x, y } = locationCenter(rect);
    const map = project.maps[point.mapId];
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) throw new PrimitiveError("목표로 지정한 장소의 중심이 맵 밖에 있어요.");
  };
  if ("target" in step) {
    if ("create" in step.target) {
      const npc = step.target.create;
      validatePoint(npc);
      if ((npc.textureKey === undefined) !== (npc.characterIndex === undefined)) {
        throw new PrimitiveError("인물 그림과 그림 안의 인물 번호를 함께 입력해 주세요.");
      }
      if (npc.textureKey !== undefined && (!findCharsetAsset(npc.textureKey) && project.assets.uploaded[npc.textureKey]?.kind !== "charset")) {
        throw new PrimitiveError("목표에 넣을 인물 그림을 찾을 수 없어요.");
      }
      if (npc.characterIndex !== undefined && (!Number.isInteger(npc.characterIndex) || npc.characterIndex < 0 || npc.characterIndex > 7)) {
        throw new PrimitiveError("그림 안의 인물 번호는 0부터 7까지예요.");
      }
    } else {
      const { mapId, eventId } = step.target;
      if (!Object.hasOwn(project.maps, mapId) || !project.maps[mapId].events.some(event => event.id === eventId && event.draft?.kind !== "new")) {
        throw new PrimitiveError("목표에서 만날 이벤트를 찾을 수 없어요.");
      }
    }
  }
  if ("at" in step) validatePoint(step.at);
  if (step.kind === "reach") validatePoint(step);
  if (step.kind === "escort") validatePoint(step.destination);
  if (step.kind === "collect") for (const source of step.sources) validatePoint(source);
  if (step.kind === "inspect" && !step.lines.some(line => line.trim())) throw new PrimitiveError("조사할 때 보여 줄 단서 대사를 입력해 주세요.");
}

function validateStepDef(project: Project, def: QuestDef, previous?: QuestDef): QuestDef {
  for (const step of def.steps) if (!previous?.steps.includes(step)) validateNewObjective(project, step);
  const withoutPrevious = previous ? { ...project, quests: project.quests?.filter(quest => quest !== previous) } : project;
  try {
    validateQuestReferences(withoutPrevious, def);
  } catch {
    throw new PrimitiveError("목표나 보상의 연결 대상, 좌표, 수량을 확인해 주세요. 목표는 최대 12개까지 넣을 수 있어요.");
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

function switchCondition(ctx: PrimitiveContext, switchId: string, value = true) {
  const { working, saved } = questEventViews(ctx);
  if (!ctx.project.switches.some(entry => entry.id === switchId)) throw new PrimitiveError("목표를 완료할 스위치를 찾을 수 없어요.");
  const condition = { kind: "switch" as const, targetId: switchId, value };
  for (const view of new Set([working, saved])) {
    if (!selectWriteSite(buildStoryFlagUsageIndex(view), condition)) {
      throw new PrimitiveError("이벤트에서 값을 기록하는 완료 스위치를 골라 주세요.");
    }
  }
  return { kind: "switch" as const, switchId, value };
}

function replaceGraphSwitch(ctx: PrimitiveContext, expression: QuestGraphConditionExpression, args: Args) {
  const conditions = extractQuestGraphConditions(expression);
  if (conditions.length !== 1) throw new PrimitiveError("여러 조건이 걸린 목표는 여기서 완료 스위치를 바꿀 수 없어요.");
  let previous;
  try {
    previous = resolveQuestGraphCondition(ctx.project, conditions[0]);
  } catch {
    throw new PrimitiveError("현재 목표의 완료 조건을 자료집에서 먼저 확인해 주세요.");
  }
  if (previous.kind !== "switch") throw new PrimitiveError("스위치로 완료되는 목표에서만 완료 스위치를 바꿀 수 있어요.");
  const switchId = requiredText(args.switchId, "목표를 완료할 스위치를 골라 주세요.");
  return switchId === previous.targetId ? expression : switchCondition(ctx, switchId, previous.value);
}

function assertSameGraphGiver(project: Project, previous: QuestGraphDef, updated: QuestGraphDef) {
  const usage = buildStoryFlagUsageIndex(project);
  if (!jsonEqual(graphGiver(project, previous, usage), graphGiver(project, updated, usage))) {
    throw new PrimitiveError("범위 밖: 첫 목표를 이렇게 바꾸면 퀘스트를 시작하는 이벤트도 바뀌어요.");
  }
}

function assertReachableChildren(quest: QuestGraphDef, children: readonly { to: string }[]): void {
  const reachable = new Set<string>();
  const pending = [quest.nodes[0].id];
  for (const id of pending) {
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of quest.edges) if (edge.from === id) pending.push(edge.to);
  }
  if (children.some(child => !reachable.has(child.to))) {
    throw new PrimitiveError("첫 목표를 지우면 일부 갈래로 진행할 수 없어요.");
  }
}

function stepIndex(args: Args, length: number): number {
  const step = args.step as number;
  if (!Number.isSafeInteger(step) || step < 1 || step > length) throw new PrimitiveError("해당 번호의 목표를 찾을 수 없어요.");
  return step - 1;
}

function withSteps(quest: QuestDef, steps: readonly QuestStep[]): QuestDef {
  return { ...quest, steps, ...(quest.blueprint ? { blueprint: steps.map(step => step.kind) } : {}) };
}

function appendObjective(ctx: PrimitiveContext, quest: AnyQuestDef, args: Args): AnyQuestDef {
  const { project } = ctx;
  if (isQuestGraphDef(quest)) {
    if (args.objective !== undefined) throw new PrimitiveError("그래프 목표에는 문구와 완료 스위치를 입력해 주세요.");
    const used = new Set(quest.nodes.map(node => node.id));
    for (const view of questReferenceViews(ctx)) for (const fields of questCommands(view)) {
      if (commandId(fields.questId, "quest") === quest.id) used.add(commandId(fields.objectiveId, "objective"));
    }
    let number = 1;
    while (used.has(`step_${number}`)) number++;
    const node = {
      id: `step_${number}`,
      description: requiredText(args.label, "추가할 목표 문구를 입력해 주세요."),
      completesWhen: switchCondition(ctx, requiredText(args.switchId, "목표를 완료할 스위치를 골라 주세요.")),
    };
    const outgoing = new Set(quest.edges.map(edge => edge.from));
    const tails = quest.nodes.filter(previous => !outgoing.has(previous.id));
    return validateGraph(project, {
      ...quest, nodes: [...quest.nodes, node],
      edges: [...quest.edges, ...tails.map(tail => ({ from: tail.id, to: node.id }))],
    });
  }
  if (args.objective === undefined || args.switchId !== undefined || args.label !== undefined) {
    throw new PrimitiveError("단계형 퀘스트에 추가할 목표를 입력해 주세요.");
  }
  const updated = parseStepDef(withSteps(quest, [...quest.steps, structuredClone(args.objective) as QuestStep]));
  validateStepDef(project, updated, quest);
  if (questReferenceViews(ctx).some(view => questProgressUses(view, quest.key))) {
    throw new PrimitiveError("범위 밖: 플레이에 연결된 퀘스트에 목표를 추가하려면 완료 이벤트도 함께 바꿔야 해요.");
  }
  return updated;
}

function updateObjective(ctx: PrimitiveContext, quest: AnyQuestDef, args: Args): AnyQuestDef {
  const { project } = ctx;
  if (isQuestGraphDef(quest)) {
    if (args.objective !== undefined || (args.label === undefined && args.switchId === undefined)) {
      throw new PrimitiveError("그래프 목표에서 바꿀 문구나 완료 스위치를 입력해 주세요.");
    }
    const index = stepIndex(args, quest.nodes.length);
    const label = args.label === undefined ? quest.nodes[index].description : requiredText(args.label, "목표 문구를 입력해 주세요.");
    if (label !== quest.nodes[index].description) assertNoTextProposal(project, quest, `node${index}`);
    const nodes = quest.nodes.map((node, i) => i === index ? {
      ...node,
      description: label,
      ...(args.switchId !== undefined ? { completesWhen: replaceGraphSwitch(ctx, node.completesWhen, args) } : {}),
    } : node);
    const updated = { ...quest, nodes };
    if (args.switchId === undefined) return updated;
    if (index === 0) assertSameGraphGiver(project, quest, updated);
    return validateGraph(project, updated);
  }
  const index = stepIndex(args, quest.steps.length);
  if (args.switchId !== undefined || (args.objective === undefined) === (args.label === undefined)) {
    throw new PrimitiveError("바꿀 목표나 목표 문구 중 하나를 입력해 주세요.");
  }
  if (args.label !== undefined) {
    const label = requiredText(args.label, "목표 문구를 입력해 주세요.");
    if (label !== quest.steps[index].label) assertNoTextProposal(project, quest, `step${index}`);
    return { ...quest, steps: quest.steps.map((step, i) => i === index ? { ...step, label } : step) };
  }
  const updated = parseStepDef(withSteps(quest, quest.steps.map((step, i) =>
    i === index ? structuredClone(args.objective) as QuestStep : step)));
  validateStepDef(project, updated, quest);
  const { label: oldLabel, ...oldObjective } = quest.steps[index];
  const { label: newLabel, ...newObjective } = updated.steps[index];
  if (oldLabel !== newLabel) assertNoTextProposal(project, quest, `step${index}`);
  if (!jsonEqual(oldObjective, newObjective)
    && questReferenceViews(ctx).some(view => questProgressUses(view, quest.key, step => step === index))) {
    throw new PrimitiveError("범위 밖: 플레이에 연결된 목표를 교체하려면 해당 이벤트도 함께 바꿔야 해요. 일지에 표시할 문구는 바꿀 수 있어요.");
  }
  return updated;
}

function removeObjective(ctx: PrimitiveContext, quest: AnyQuestDef, args: Args): AnyQuestDef {
  const { project } = ctx;
  if (isQuestGraphDef(quest)) {
    const index = stepIndex(args, quest.nodes.length);
    if (quest.nodes.length === 1) throw new PrimitiveError("퀘스트에는 목표가 하나 이상 있어야 해요.");
    assertNoObjectiveReferences(ctx, quest, index);
    const id = quest.nodes[index].id;
    const edges = quest.edges.filter(edge => edge.from !== id && edge.to !== id);
    const parents = quest.edges.filter(edge => edge.to === id);
    const children = quest.edges.filter(edge => edge.from === id);
    for (const parent of parents) {
      for (const child of children) {
        if (!edges.some(edge => edge.from === parent.from && edge.to === child.to)) edges.push({ from: parent.from, to: child.to });
      }
    }
    const updated = validateGraph(project, {
      ...quest,
      nodes: quest.nodes.filter(node => node.id !== id),
      edges,
    });
    if (index === 0) {
      assertSameGraphGiver(project, quest, updated);
      assertReachableChildren(updated, children);
    }
    return updated;
  }
  const index = stepIndex(args, quest.steps.length);
  if (quest.steps.length === 1) throw new PrimitiveError("퀘스트에는 목표가 하나 이상 있어야 해요.");
  if (quest.gates?.some(gate => gate.requiresStep === index)) throw new PrimitiveError("통로를 여는 목표는 삭제할 수 없어요.");
  assertNoObjectiveReferences(ctx, quest, index);
  if (questReferenceViews(ctx).some(view => questProgressUses(view, quest.key, step => step >= index))) {
    throw new PrimitiveError("범위 밖: 이 목표나 뒤 목표의 진행 스위치·변수도 정리해야 해서 삭제할 수 없어요.");
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
  if ((rewards.gold ?? 0) === (quest.rewards?.gold ?? 0) && jsonEqual(rewards.items ?? [], quest.rewards?.items ?? [])) return quest;
  return validateStepDef(project, parseStepDef({ ...quest, rewards }), quest);
}

function primitive(id: string, title: string, spec: Pick<SmallTaskPrimitive, "args" | "describe" | "apply" | "scope" | "hidden">): SmallTaskPrimitive {
  return {
    id, unit: UNIT, title, covers: { tools: [id] }, targets: ["map", "event"], ...spec,
    reviseRegionBaseline: (baseline, applied) => ({ ...baseline, quests: applied.quests }),
  };
}

const objectiveFields = { label: LABEL, switchId: SWITCH, objective: OBJECTIVE };

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  primitive("quest.create", "퀘스트 정의 등록", {
    args: schema("선택한 이벤트를 의뢰인으로 기록하고 첫 목표를 등록합니다.", {
      title: TITLE,
      summary: { type: "string", description: "퀘스트 일지에 표시할 짧은 설명" },
      giverEventId: { type: "string", minLength: 1, pattern: "\\S", description: "맵을 선택했을 때 그 맵에 이미 있는 의뢰 이벤트의 식별자" },
      objective: OBJECTIVE,
    }, ["title", "objective"]),
    scope(ctx, args) {
      createGiver(ctx, args);
      return { kind: "projectArea", area: "quests", ids: [], create: 1 };
    },
    describe(_ctx, args) {
      return `「${preview(args.title, "새 퀘스트")}」 퀘스트 정의를 등록합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = validateStepDef(project, parseStepDef({
        key: nextQuestKey(ctx),
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
    scope: (ctx, args) => editScope(ctx, args, { fields: ["title"] }),
    describe(_ctx, args) {
      const name = preview(args.title, "새 이름");
      return `퀘스트 이름을 「${name}」${roJosa(name)} 바꿉니다.`;
    },
    apply(ctx, args) {
      const quest = questFor(ctx, args);
      const title = requiredText(args.title, "퀘스트 이름을 입력해 주세요.");
      if (quest.title !== title) assertNoTextProposal(ctx.project, quest, "title");
      return replaceQuest(ctx.project, quest, { ...quest, title });
    },
  }),
  primitive("quest.objective.add", "퀘스트 목표 추가", {
    args: schema("아직 플레이 진행에 연결하지 않은 단계형에 목표 하나를 추가합니다. 그래프형에는 문구와 기존 완료 스위치를 추가합니다.", { questId: QUEST_ID, ...objectiveFields }, []),
    scope: (ctx, args) => editScope(ctx, args, { fields: ["steps", "blueprint", "nodes", "edges"] }),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 정의에 목표를 하나 추가합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      return replaceQuest(project, quest, appendObjective(ctx, quest, args));
    },
  }),
  primitive("quest.objective.update", "퀘스트 목표 수정", {
    args: schema("목표 문구를 바꾸거나 단계형 목표를 교체합니다. 그래프에서는 완료 스위치도 바꿀 수 있습니다.", {
      questId: QUEST_ID, step: STEP_NUMBER, ...objectiveFields,
    }, ["step"]),
    scope: (ctx, args) => editScope(ctx, args, { fields: ["steps", "blueprint", "nodes"] }),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 정의의 ${args.step}번 목표를 수정합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      return replaceQuest(project, quest, updateObjective(ctx, quest, args));
    },
  }),
  primitive("quest.objective.remove", "퀘스트 목표 삭제", {
    args: schema("퀘스트 정의에서 번호로 지정한 목표를 지웁니다.", { questId: QUEST_ID, step: STEP_NUMBER }, ["step"]),
    scope: (ctx, args) => editScope(ctx, args, { fields: ["steps", "blueprint", "gates", "nodes", "edges"] }),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 정의의 ${args.step}번 목표를 지웁니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      return replaceQuest(project, quest, removeObjective(ctx, quest, args));
    },
  }),
  primitive("quest.reward.set", "퀘스트 보상 정의 변경", {
    args: schema("단계형 퀘스트 정의에 골드나 아이템 보상을 기록합니다. 플레이 지급 이벤트를 갱신하려면 별도 컴파일이 필요합니다.", { questId: QUEST_ID, gold: GOLD, items: REWARD_ITEMS }, []),
    scope: (ctx, args) => editScope(ctx, args, { fields: ["rewards"] }),
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
    scope: (ctx, args) => editScope(ctx, args, { remove: true }),
    describe(ctx, args) {
      return `「${questName(ctx, args)}」 퀘스트 등록을 삭제합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const quest = questFor(ctx, args);
      const id = questDefId(quest);
      if (project.quests?.some(other => other !== quest && !isQuestGraphDef(other) && other.requiresQuestKeys?.includes(id))
        || project.storyFlags?.some(flag => flag.questId === id)) {
        throw new PrimitiveError("범위 밖: 다른 퀘스트나 이야기 진행에서 이 퀘스트를 사용하고 있어요.");
      }
      if (questDialogueRef(project, id, () => true) || project.dialogueDesk?.sceneNotes?.some(note => note.sceneId === `qs/${id}`)) {
        throw new PrimitiveError("범위 밖: 자료집에 이 퀘스트의 윤문 제안이나 장면 메모가 있어요.");
      }
      const views = questReferenceViews(ctx);
      for (const view of views) {
        for (const fields of questCommands(view)) {
          if (commandId(fields.questId, "quest") === id) throw new PrimitiveError("범위 밖: 이벤트 명령에서 이 퀘스트를 사용하고 있어요.");
        }
      }
      if (!isQuestGraphDef(quest) && views.some(view => questProgressUses(view, id))) {
        throw new PrimitiveError("범위 밖: 이 퀘스트에 연결된 진행 스위치나 변수를 먼저 정리해야 해요.");
      }
      return { ...project, quests: project.quests?.filter(entry => entry !== quest) };
    },
  }),
  primitive("quest.giver.link", "퀘스트 의뢰인 연결", {
    hidden: true,
    scope: () => ({ kind: "projectArea", area: "quests", ids: [] }),
    args: schema("기존 퀘스트를 선택한 의뢰 이벤트에 연결합니다.", { questId: QUEST_ID }, ["questId"]),
    describe() {
      return "퀘스트를 선택한 의뢰 이벤트에 연결합니다.";
    },
    apply() {
      throw new PrimitiveError("범위 밖: 의뢰인을 연결하려면 퀘스트와 이벤트를 함께 바꿔야 해요.");
    },
  }),
];
