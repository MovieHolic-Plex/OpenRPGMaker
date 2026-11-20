import { pageConditionSentence } from "@/editor/panels/eventEditor/pageConditionSentence";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { validateCondition, validateMonsterSpeciesReferences } from "@/project/io/commandReferenceValidation";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Condition, ConditionCompareOp, Project } from "@/project/types";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import * as build from "./15-cond-state-party/builders";

export * from "./15-cond-state-party/builders";

export const UNIT = "15-cond-state-party";

const TITLES = {
  switch: "스위치 상태",
  variable: "숫자 변수 비교",
  selfSwitch: "이벤트 기억",
  stringVariable: "문자열 변수 비교",
  item: "아이템 보유",
  itemUsed: "아이템 사용",
  gold: "소지금",
  timer: "남은 시간",
  actor: "파티 합류",
  actorStat: "배우 능력치",
  actorState: "배우 상태",
  partyLeader: "파티 선두",
  partyKnowsSkill: "파티가 아는 기술",
  partySize: "파티 인원",
  badgeCount: "배지 수",
  monsterSpecies: "몬스터 종 보유",
  all: "조건 모두 충족",
  any: "조건 중 하나 충족",
  not: "조건 반대로",
} as const;

type OwnedKind = keyof typeof TITLES;
type GroupKind = "all" | "any" | "not";
type LeafKind = Exclude<OwnedKind, GroupKind>;
type Leaf = Extract<Condition, { kind: LeafKind }>;
type Named = { readonly id: string; readonly name: string };

function ref(description: string): JsonSchema {
  return { type: "string", minLength: 1, description };
}

function rowNumber(description: string): JsonSchema {
  return { type: "integer", minimum: 1, description };
}

const conditionNumber = rowNumber("페이지의 맨 바깥 조건 줄 번호입니다. 첫 줄은 1번입니다.");
const comparison: JsonSchema = {
  type: "string",
  enum: ["==", "!=", ">", ">=", "<", "<="],
  description: "같음, 다름, 초과, 이상, 미만, 이하 중 비교 방법입니다. 생략하면 이상입니다.",
};
const on: JsonSchema = { type: "boolean", description: "켜짐이면 참, 꺼짐이면 거짓입니다. 생략하면 켜짐입니다." };
const present: JsonSchema = { type: "boolean", description: "있어야 하면 참, 없어야 하면 거짓입니다. 생략하면 참입니다." };
const number: JsonSchema = { type: "number", description: "기준 수치입니다. 생략하면 0입니다." };
const amount: JsonSchema = { type: "integer", minimum: 0, description: "0 이상의 기준 금액입니다. 생략하면 0입니다." };
const count: JsonSchema = { type: "integer", minimum: 0, description: "0 이상의 기준 개수입니다." };
const switchId = ref("프로젝트에 등록된 스위치의 식별자입니다.");
const variableId = ref("프로젝트에 등록된 숫자 변수의 식별자입니다.");
const itemId = ref("자료집에 등록된 아이템의 식별자입니다.");
const actorId = ref("자료집에 등록된 배우의 식별자입니다.");

function schema(properties: Record<string, JsonSchema>, required: readonly string[] = []): JsonSchema {
  return {
    type: "object",
    description: "선택한 이벤트 페이지의 등장 조건을 편집합니다.",
    properties,
    required,
    additionalProperties: false,
  };
}

function pageScope({ target }: PrimitiveContext) {
  if (target.kind !== "event" || !target.pageId) {
    throw new PrimitiveError("범위 밖입니다. 먼저 이벤트 페이지를 선택하세요.");
  }
  return { kind: "eventPage" as const, field: "conditions" as const, mapId: target.mapId, eventId: target.eventId, pageId: target.pageId };
}

function locatePage(ctx: PrimitiveContext) {
  const { mapId, eventId, pageId } = pageScope(ctx);
  const map = ctx.project.maps[mapId];
  const eventIndex = map?.events.findIndex(event => event.id === eventId) ?? -1;
  const event = map?.events[eventIndex];
  const pageIndex = event?.pages?.findIndex(page => page.id === pageId) ?? -1;
  const page = event?.pages?.[pageIndex];
  if (!page || !event?.pages) throw new PrimitiveError("범위 밖입니다. 선택한 이벤트 페이지를 찾을 수 없어요.");
  if (map.events.slice(eventIndex + 1).some(entry => entry.id === eventId) ||
      event.pages.slice(pageIndex + 1).some(entry => entry.id === pageId)) {
    throw new PrimitiveError("범위 밖입니다. 선택한 이벤트 페이지를 하나로 확인할 수 없어요.");
  }
  return { map, event, eventIndex, page, pageIndex, pages: event.pages };
}

function changeConditions(ctx: PrimitiveContext, edit: (conditions: readonly Condition[]) => Condition[]): Project {
  const { map, event, eventIndex, page, pageIndex, pages } = locatePage(ctx);
  const nextPages = [...pages];
  nextPages[pageIndex] = { ...page, conditions: edit(page.conditions ?? []) };
  const events = [...map.events];
  events[eventIndex] = { ...event, pages: nextPages };
  return { ...ctx.project, maps: { ...ctx.project.maps, [map.id]: { ...map, events } } };
}

function indexOfRow(conditions: readonly Condition[], row: unknown): number {
  if (typeof row !== "number" || !Number.isSafeInteger(row) || row < 1 || row > conditions.length) {
    throw new PrimitiveError("범위 밖입니다. 선택한 페이지에서 조건 줄을 찾을 수 없어요.");
  }
  return row - 1;
}

function setCondition(conditions: readonly Condition[], next: Leaf, row: unknown): Condition[] {
  const index = row === undefined ? conditions.findIndex(condition => condition.kind === next.kind) : indexOfRow(conditions, row);
  if (index < 0) return [...conditions, next];
  if (conditions[index].kind !== next.kind) {
    throw new PrimitiveError("고른 줄의 조건 종류가 달라요.");
  }
  if (row === undefined && conditions.slice(index + 1).some(condition => condition.kind === next.kind)) {
    throw new PrimitiveError("같은 종류의 조건이 여러 줄 있어요. 바꿀 줄을 골라 주세요.");
  }
  return conditions.map((condition, position) => position === index ? next : condition);
}

function requireRecord(records: readonly Named[] | undefined, id: string, label: string): void {
  if (!records?.some(record => record.id === id)) throw new PrimitiveError(`${label} 항목을 찾을 수 없어요.`);
}

function validateReferences(project: Project, condition: Condition): void {
  switch (condition.kind) {
    case "switch":
    case "variable": {
      try {
        validateCondition(condition, new Set(project.switches.map(record => record.id)), new Set(project.variables.map(record => record.id)));
      } catch {
        throw new PrimitiveError(condition.kind === "switch" ? "스위치를 찾을 수 없어요." : "숫자 변수를 찾을 수 없어요.");
      }
      return;
    }
    case "item":
    case "itemUsed":
      return requireRecord(project.database.items, condition.itemId, "아이템");
    case "actor":
    case "partyLeader":
      return requireRecord(project.database.actors, condition.actorId, "배우");
    case "actorStat":
      if (condition.actorId !== "leader") requireRecord(project.database.actors, condition.actorId, "배우");
      return;
    case "actorState":
      if (condition.actorId !== "leader" && condition.actorId !== "anyone") requireRecord(project.database.actors, condition.actorId, "배우");
      return requireRecord(project.database.states, condition.stateId, "상태");
    case "partyKnowsSkill":
      return requireRecord(project.database.skills, condition.skillId, "기술");
    case "monsterSpecies":
      try {
        validateMonsterSpeciesReferences(condition, { speciesIds: new Set(project.database.monsterSpecies?.map(record => record.id)) });
      } catch {
        throw new PrimitiveError("몬스터 종을 찾을 수 없어요.");
      }
      return;
    case "stringVariable":
      // 문자 입력 명령이 자유 키를 씁니다. 숫자 변수 목록에는 등록되지 않습니다.
      if (!condition.stringVariableId.trim()) throw new PrimitiveError("문자열 변수를 지정해 주세요.");
      if (condition.op === "contains" && condition.value === "") throw new PrimitiveError("포함 여부를 확인할 글자를 입력해 주세요.");
      return;
    case "all":
    case "any":
      for (const child of condition.conditions) validateReferences(project, child);
      return;
    case "not":
      return validateReferences(project, condition.condition);
    default:
      return;
  }
}

function validate(project: Project, condition: Condition): void {
  try {
    validateConditionShape("등장 조건", condition);
  } catch {
    throw new PrimitiveError("등장 조건의 입력값을 확인해 주세요.");
  }
  validateReferences(project, condition);
}

function validateLeaf(project: Project, condition: Leaf): void {
  validate(project, condition);
  const field = condition.kind === "gold" ? { value: condition.amount, label: "기준 금액" }
    : condition.kind === "timer" ? { value: condition.seconds, label: "기준 시간" }
    : condition.kind === "partySize" ? { value: condition.value, label: "기준 파티 인원" }
    : condition.kind === "badgeCount" ? { value: condition.value, label: "기준 배지 수" }
    : undefined;
  if (field && (!Number.isSafeInteger(field.value) || field.value < 0)) {
    throw new PrimitiveError(`${field.label}에는 0 이상의 정수를 입력해 주세요.`);
  }
}

function safeName(value: string | undefined, fallback: string): string {
  const text = displayText(value ?? "", fallback).replace(/[.!?{}\[\]「」]/gu, "").trim();
  if (!text || text === "…") return fallback;
  return text.length > 18 ? text.slice(0, 17) + "…" : text;
}

function recordName(records: readonly Named[] | undefined, id: string, fallback: string): string {
  const record = records?.find(entry => entry.id === id);
  return safeName(record?.name === id ? undefined : record?.name, fallback);
}

const compareLabels: Record<ConditionCompareOp, string> = {
  "==": " 같음", "!=": " 다름", ">": " 초과", ">=": " 이상", "<": " 미만", "<=": " 이하",
};
const statLabels = { level: "레벨", hp: "체력", mp: "마력", hpPercent: "체력 비율", mpPercent: "마력 비율" };
const memoryLabels = { A: "첫째", B: "둘째", C: "셋째", D: "넷째" };
const stringLabels = { "==": "일치", "!=": "불일치", contains: "포함" };

function pageSentence(project: Project, condition: Leaf): string {
  const actor = (id: string) => id === "leader" ? "선두 배우" : id === "anyone" ? "파티원 중 한 명" : recordName(project.database.actors, id, "지정한 배우");
  const item = (id: string) => recordName(project.database.items, id, "지정한 아이템");
  let detail: string;
  switch (condition.kind) {
    case "gold":
    case "timer":
      return pageConditionSentence([condition], project).text;
    case "switch":
      detail = `「${recordName(project.switches, condition.switchId, "지정한 스위치")}」 ${condition.value ? "켜짐" : "꺼짐"}`;
      break;
    case "variable":
      detail = `「${recordName(project.variables, condition.variableId, "지정한 변수")}」 값 ${condition.value}${compareLabels[condition.op]}`;
      break;
    case "selfSwitch":
      detail = `이벤트의 ${memoryLabels[condition.key]} 기억 ${condition.value ? "켜짐" : "꺼짐"}`;
      break;
    case "stringVariable":
      detail = condition.op === "empty" ? "지정한 문자열 변수가 비어 있음" : `문자열에 「${safeName(condition.value, "지정한 글자")}」 ${stringLabels[condition.op]}`;
      break;
    case "item":
      detail = `「${item(condition.itemId)}」 ${condition.present ? "보유 중" : "없음"}`;
      break;
    case "itemUsed":
      return `이 이벤트에 「${item(condition.itemId)}」을 사용하면 페이지가 보입니다.`;
    case "actor":
      detail = `「${actor(condition.actorId)}」 파티에 ${condition.present ? "있음" : "없음"}`;
      break;
    case "actorStat":
      detail = `「${actor(condition.actorId)}」의 ${statLabels[condition.stat]} ${condition.value}${condition.stat.endsWith("Percent") ? "%" : ""}${compareLabels[condition.op]}`;
      break;
    case "actorState":
      detail = `「${actor(condition.actorId)}」에게 「${recordName(project.database.states, condition.stateId, "지정한 상태")}」 ${condition.present ? "있음" : "없음"}`;
      break;
    case "partyLeader":
      return `파티 선두가 「${actor(condition.actorId)}」이면 이 페이지가 보입니다.`;
    case "partyKnowsSkill":
      detail = `파티가 「${recordName(project.database.skills, condition.skillId, "지정한 기술")}」을 ${condition.present === false ? "모름" : "앎"}`;
      break;
    case "partySize":
      detail = `파티 인원 ${condition.value}명${compareLabels[condition.op]}`;
      break;
    case "badgeCount":
      detail = `배지 ${condition.value}개${compareLabels[condition.op]}`;
      break;
    case "monsterSpecies":
      detail = `파티나 보관함에 「${recordName(project.database.monsterSpecies, condition.speciesId, "지정한 몬스터 종")}」 ${condition.present ? "있음" : "없음"}`;
      break;
  }
  return `이 페이지는 ${detail}일 때 보입니다.`;
}

function leaf<A extends Record<string, unknown>>(
  kind: LeafKind,
  buildCondition: (args: A) => Leaf,
  properties: Record<string, JsonSchema>,
  required?: readonly string[],
): SmallTaskPrimitive {
  // The registry validates JSON arguments against this row's schema before invoking it.
  const fromArgs = (args: Record<string, unknown>) => buildCondition(args as A);
  return {
    id: `cond.${kind}.page.set`,
    unit: UNIT,
    title: TITLES[kind],
    covers: { conditionKinds: [kind] },
    targets: ["event"],
    args: schema({ ...properties, conditionNumber: rowNumber("같은 종류가 여러 줄이면 바꿀 줄 번호를 고릅니다. 첫 줄은 1번입니다.") }, required),
    scope: pageScope,
    describe: (ctx, args) => pageSentence(ctx.project, fromArgs(args)),
    apply: (ctx, args) => changeConditions(ctx, conditions => {
      const condition = fromArgs(args);
      validateLeaf(ctx.project, condition);
      return setCondition(conditions, condition, args.conditionNumber);
    }),
  };
}

function group(kind: GroupKind): SmallTaskPrimitive {
  const single = kind === "not";
  return {
    id: `cond.${kind}.page.set`,
    unit: UNIT,
    title: TITLES[kind],
    covers: { conditionKinds: [kind] },
    targets: ["event"],
    args: single
      ? schema({ conditionNumber }, ["conditionNumber"])
      : schema({
        conditionNumbers: { type: "array", items: conditionNumber, minItems: 1, description: "한 묶음으로 옮길 기존 조건 줄 번호입니다." },
      }, ["conditionNumbers"]),
    scope: pageScope,
    describe: (_ctx, args) => {
      if (kind === "not") return `${args.conditionNumber}번 조건이 맞지 않을 때 보이도록 바꿉니다.`;
      const size = Array.isArray(args.conditionNumbers) ? args.conditionNumbers.length : 0;
      const match = kind === "all" ? "모두" : "중 하나라도";
      return `고른 조건 ${size}개 ${match} 맞을 때 보이도록 묶습니다.`;
    },
    apply: (ctx, args) => changeConditions(ctx, conditions => {
      const rows = single ? [args.conditionNumber] : args.conditionNumbers;
      if (!Array.isArray(rows) || rows.length === 0) throw new PrimitiveError("묶을 조건 줄을 골라 주세요.");
      const indexes = new Set(rows.map(row => indexOfRow(conditions, row)));
      if (indexes.size !== rows.length) throw new PrimitiveError("같은 조건 줄은 한 번만 골라 주세요.");
      const selected = conditions.filter((_condition, index) => indexes.has(index));
      const combined = single ? build.buildConditionNot({ condition: selected[0] })
        : kind === "all" ? build.buildConditionAll({ conditions: selected }) : build.buildConditionAny({ conditions: selected });
      validate(ctx.project, combined);
      const first = conditions.findIndex((_condition, index) => indexes.has(index));
      return conditions.flatMap((condition, index) => index === first ? [combined] : indexes.has(index) ? [] : [condition]);
    }),
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  leaf("switch", build.buildConditionSwitch, { switchId, value: on }, ["switchId"]),
  leaf("variable", build.buildConditionVariable, { variableId, op: comparison, value: number }, ["variableId"]),
  leaf("selfSwitch", build.buildConditionSelfSwitch, {
    key: { type: "string", enum: ["A", "B", "C", "D"], description: "이 이벤트의 기억 네 칸 중 하나입니다. 생략하면 첫째 칸입니다." },
    value: on,
  }),
  leaf("stringVariable", build.buildConditionStringVariable, {
    stringVariableId: ref("문자 입력 명령에서 사용하는 문자열 변수 이름입니다."),
    op: { type: "string", enum: ["==", "!=", "contains", "empty"], description: "같음, 다름, 포함, 비어 있음 중 비교 방법입니다. 생략하면 같음입니다." },
    value: { type: "string", description: "비교할 글자입니다. 비어 있음으로 비교하면 생략합니다." },
  }, ["stringVariableId"]),
  leaf("item", build.buildConditionItem, { itemId, present }, ["itemId"]),
  leaf("itemUsed", build.buildConditionItemUsed, { itemId }, ["itemId"]),
  leaf("gold", build.buildConditionGold, { op: comparison, amount }),
  leaf("timer", build.buildConditionTimer, {
    timerId: { type: "string", enum: ["timer1", "timer2"], description: "첫째 또는 둘째 타이머입니다. 생략하면 첫째입니다." },
    seconds: { ...count, description: "남은 시간의 기준을 초로 입력합니다. 생략하면 0초입니다." },
    op: { ...comparison, description: "남은 시간의 비교 방법입니다. 생략하면 이하입니다." },
  }),
  leaf("actor", build.buildConditionActor, { actorId, present }, ["actorId"]),
  leaf("actorStat", build.buildConditionActorStat, {
    actorId: ref("배우의 식별자 또는 파티 선두입니다. 생략하면 선두입니다."),
    stat: { type: "string", enum: ["level", "hp", "mp", "hpPercent", "mpPercent"], description: "레벨, 체력, 마력, 체력 비율, 마력 비율 중 하나입니다. 생략하면 레벨입니다." },
    op: comparison, value: { ...number, description: "능력치 기준입니다. 비율은 백분율로 입력합니다. 생략하면 10입니다." },
  }),
  leaf("actorState", build.buildConditionActorState, {
    actorId: ref("배우의 식별자, 선두 또는 파티원 중 한 명입니다. 생략하면 파티원 중 한 명입니다."),
    stateId: ref("자료집에 등록된 상태의 식별자입니다."), present,
  }, ["stateId"]),
  leaf("partyLeader", build.buildConditionPartyLeader, { actorId }, ["actorId"]),
  leaf("partyKnowsSkill", build.buildConditionPartyKnowsSkill, {
    skillId: ref("자료집에 등록된 기술의 식별자입니다."),
    present: { type: "boolean", description: "파티에서 누군가 알아야 하면 참, 아무도 몰라야 하면 거짓입니다. 생략하면 참입니다." },
  }, ["skillId"]),
  leaf("partySize", build.buildConditionPartySize, { op: comparison, value: { ...count, description: "기준 파티 인원입니다. 생략하면 2명입니다." } }),
  leaf("badgeCount", build.buildConditionBadgeCount, { op: comparison, value: { ...count, description: "기준 배지 수입니다. 생략하면 1개입니다." } }),
  leaf("monsterSpecies", build.buildConditionMonsterSpecies, {
    speciesId: ref("자료집에 등록된 몬스터 종의 식별자입니다."), present,
  }, ["speciesId"]),
  group("all"),
  group("any"),
  group("not"),
  {
    id: "cond.page.remove",
    unit: UNIT,
    title: "등장 조건 제거",
    covers: {},
    targets: ["event"],
    args: schema({ conditionNumber }, ["conditionNumber"]),
    scope: pageScope,
    describe: (_ctx, args) => `이 페이지에서 ${args.conditionNumber}번 등장 조건을 뺍니다.`,
    apply: (ctx, args) => changeConditions(ctx, conditions => {
      const index = indexOfRow(conditions, args.conditionNumber);
      return conditions.filter((_condition, position) => position !== index);
    }),
  },
];
