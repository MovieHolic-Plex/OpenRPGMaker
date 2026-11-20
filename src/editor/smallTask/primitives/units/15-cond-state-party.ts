import { pageConditionSentence } from "@/editor/panels/eventEditor/pageConditionSentence";
import { displayText } from "@/editor/smallTask/target";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import type { JsonSchema } from "@/editor/tools/types";
import { ACTOR_LEVEL_MAX } from "@/project/actorModel";
import { GOLD_MAX } from "@/project/economyValues";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { validateCondition, validateMonsterSpeciesReferences } from "@/project/io/commandReferenceValidation";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { findLocationById } from "@/project/mapNamedLocations";
import { sightWatcherIds, watchersHaveSelector } from "@/project/sightWatchers";
import type { Condition, ConditionCompareOp, EventPage, GameMap, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { scopedPage } from "../core/helpers";
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
  return { type: "string", minLength: 1, pattern: "\\S", description };
}

function rowNumber(description: string): JsonSchema {
  return { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER, description };
}

const conditionNumber = rowNumber("현재 페이지의 맨 바깥 조건 줄 번호입니다. 첫 줄은 1번입니다.");
const compareOps = ["==", "!=", ">", ">=", "<", "<="] as const;
const selfSwitchKeys = ["A", "B", "C", "D"] as const;
const timerIds = ["timer1", "timer2"] as const;
const comparison: JsonSchema = {
  type: "string",
  enum: compareOps,
  description: "같음, 다름, 초과, 이상, 미만, 이하 중 비교 방법입니다. 생략하면 이상입니다.",
};
const on: JsonSchema = { type: "boolean", description: "켜짐이면 참, 꺼짐이면 거짓입니다. 생략하면 켜짐입니다." };
const present: JsonSchema = { type: "boolean", description: "있어야 하면 참, 없어야 하면 거짓입니다. 생략하면 참입니다." };
const number: JsonSchema = { type: "number", description: "기준 수치입니다. 생략하면 0입니다." };
const count: JsonSchema = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "0 이상의 기준 개수입니다." };
const amount: JsonSchema = { ...count, maximum: GOLD_MAX, description: `0부터 ${GOLD_MAX.toLocaleString("ko-KR")}까지의 기준 금액입니다. 생략하면 0입니다.` };
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

function pageScope(ctx: PrimitiveContext) {
  const { target } = ctx;
  if (target.kind !== "event") {
    throw new PrimitiveError("범위 밖입니다. 먼저 이벤트 페이지를 선택하세요.");
  }
  const pageId = target.pageId ?? scopedPage(ctx).page.id;
  return { kind: "eventPage" as const, field: "conditions" as const, mapId: target.mapId, eventId: target.eventId, pageId };
}

function locatePage(ctx: PrimitiveContext) {
  const { mapId, eventId, pageId } = pageScope(ctx);
  const map = ctx.project.maps[mapId];
  if (!map || map.id !== mapId) throw new PrimitiveError("범위 밖입니다. 선택한 맵을 다시 골라 주세요.");
  const eventIndex = map.events.findIndex(event => event.id === eventId);
  const event = map.events[eventIndex];
  const pageIndex = event?.pages?.findIndex(page => page.id === pageId) ?? -1;
  const page = event?.pages?.[pageIndex];
  if (!page || !event?.pages) throw new PrimitiveError("범위 밖입니다. 선택한 이벤트 페이지를 찾을 수 없어요.");
  if (map.events.slice(eventIndex + 1).some(entry => entry.id === eventId) ||
      event.pages.slice(pageIndex + 1).some(entry => entry.id === pageId)) {
    throw new PrimitiveError("범위 밖입니다. 선택한 이벤트 페이지를 하나로 확인할 수 없어요.");
  }
  return { mapId, map, event, eventIndex, page, pageIndex, pages: event.pages };
}

function changeConditions(ctx: PrimitiveContext, edit: (conditions: readonly Condition[], page: EventPage, map: GameMap) => Condition[]): Project {
  const { mapId, map, event, eventIndex, page, pageIndex, pages } = locatePage(ctx);
  const nextPages = [...pages];
  nextPages[pageIndex] = { ...page, conditions: edit(page.conditions ?? [], page, map) };
  const events = [...map.events];
  events[eventIndex] = { ...event, pages: nextPages };
  return { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map, events } } };
}

function indexOfRow(conditions: readonly Condition[], row: unknown): number {
  if (typeof row !== "number" || !Number.isSafeInteger(row) || row < 1 || row > conditions.length) {
    throw new PrimitiveError("범위 밖입니다. 선택한 페이지에서 조건 줄을 찾을 수 없어요.");
  }
  return row - 1;
}

function setCondition(conditions: readonly Condition[], next: Leaf, row: unknown): Condition[] {
  if (row === undefined) {
    const duplicate = conditions.some(condition => {
      if (condition.kind === "timer" && next.kind === "timer") {
        return condition.timerId === next.timerId && condition.seconds === next.seconds
          && (condition.op ?? "<=") === (next.op ?? "<=");
      }
      return jsonEqual(condition, next);
    });
    return duplicate ? [...conditions] : [...conditions, next];
  }
  const index = indexOfRow(conditions, row);
  return conditions.map((condition, position) => position === index ? next : condition);
}

function requireRecord(records: readonly { readonly id: string }[] | undefined, id: string, label: string): void {
  if (!records?.some(record => record.id === id)) throw new PrimitiveError(`${label} 항목을 찾을 수 없어요.`);
}

function requireEvent(project: Project, id: string, label: string): void {
  // 이벤트는 플레이 중 다른 맵에서 오거나 이벤트 생성 명령으로 나타날 수 있습니다.
  if (Object.values(project.maps).some(map => map.events.some(event => event.id === id))) return;
  let spawned = false;
  visitProjectCommands(project, ({ command }) => {
    if (spawned || command.kind !== "m2Command" || m2CommandById(command.commandId)?.title !== "Spawn Event") return;
    const templateId = String(command.fields.templateEventId ?? command.fields.prefabId ?? "");
    const fallbackId = templateId ? `${templateId}_spawn` : "spawned-event";
    spawned = String(command.fields.eventId ?? fallbackId) === id;
  });
  if (!spawned) throw new PrimitiveError(`${label}에 지정한 이벤트를 찾을 수 없어요.`);
}

function validateConditionValues(project: Project, map: GameMap, condition: Condition): void {
  if ("op" in condition && condition.kind !== "stringVariable" && condition.op !== undefined && !compareOps.includes(condition.op)) {
    throw new PrimitiveError("등장 조건의 비교 방법을 다시 골라 주세요.");
  }
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
      // 값이 아직 없는 변수는 일반 객체에서 읽히므로 기본 속성 이름과 충돌할 수 있습니다.
      if (Object.hasOwn(Object.prototype, condition.stringVariableId)) throw new PrimitiveError("이 이름은 문자열 변수에 쓸 수 없어요. 다른 이름을 골라 주세요.");
      if (condition.op === "contains" && condition.value === "") throw new PrimitiveError("포함 여부를 확인할 글자를 입력해 주세요.");
      return;
    case "selfSwitch":
      if (!selfSwitchKeys.includes(condition.key)) throw new PrimitiveError("이벤트 기억은 A부터 D까지 고를 수 있어요.");
      return;
    case "timer":
      if (!timerIds.includes(condition.timerId)) throw new PrimitiveError("첫째 또는 둘째 타이머를 골라 주세요.");
      return;
    case "insideLocation":
      if (!findLocationById(map, condition.locationId)) throw new PrimitiveError("선택한 맵에서 조건에 쓰인 장소를 찾을 수 없어요.");
      if (condition.eventId) requireEvent(project, condition.eventId, "장소 조건");
      return;
    case "pursuitActive":
      if (condition.eventId) requireEvent(project, condition.eventId, "추격 조건");
      return;
    case "eventSeesPlayer": {
      if (condition.eventId) return requireEvent(project, condition.eventId, "시야 조건");
      const watchers = condition.watchers;
      if (!watchers || !watchersHaveSelector(watchers)) throw new PrimitiveError("시야 조건에서 주인공을 볼 이벤트를 골라 주세요.");
      if (watchers.locationId?.trim() && !findLocationById(map, watchers.locationId)) {
        throw new PrimitiveError("선택한 맵에서 시야 조건에 쓰인 장소를 찾을 수 없어요.");
      }
      if (sightWatcherIds(map.events, watchers, map.locations).length === 0) {
        throw new PrimitiveError("선택한 맵에 시야 조건과 일치하는 감시 이벤트가 없어요.");
      }
      return;
    }
    case "difficulty":
      return requireRecord(project.system.difficulties, condition.difficultyId, "난이도");
    case "endingSeen":
      return requireRecord(project.endings, condition.endingId, "결말");
    case "all":
    case "any":
      for (const child of condition.conditions) validateConditionValues(project, map, child);
      return;
    case "not":
      return validateConditionValues(project, map, condition.condition);
    default:
      return;
  }
}

function validate(project: Project, map: GameMap, condition: Condition): void {
  try {
    validateConditionShape("등장 조건", condition);
  } catch {
    throw new PrimitiveError("등장 조건의 입력값을 확인해 주세요.");
  }
  validateConditionValues(project, map, condition);
}

function validateLeaf(project: Project, map: GameMap, page: EventPage, condition: Leaf): void {
  validate(project, map, condition);
  if (condition.kind === "itemUsed") {
    const trigger = page.trigger.kind;
    if (trigger !== "action" && trigger !== "touch" && trigger !== "playerTouch" && trigger !== "eventTouch") {
      throw new PrimitiveError("아이템 사용 조건을 쓰려면 페이지의 시작 방식을 조사나 접촉으로 바꿔 주세요.");
    }
  }
  const field = condition.kind === "gold" ? { value: condition.amount, label: "기준 금액", max: GOLD_MAX }
    : condition.kind === "timer" ? { value: condition.seconds, label: "기준 시간" }
    : condition.kind === "partySize" ? { value: condition.value, label: "기준 파티 인원" }
    : condition.kind === "badgeCount" ? { value: condition.value, label: "기준 배지 수" }
    : condition.kind === "actorStat" ? {
      value: condition.value, label: "기준 능력치",
      max: condition.stat === "level" ? ACTOR_LEVEL_MAX : condition.stat.endsWith("Percent") ? 100 : undefined,
    }
    : undefined;
  if (field && (!Number.isSafeInteger(field.value) || field.value < 0)) {
    throw new PrimitiveError(`${field.label}에는 0 이상의 정수를 입력해 주세요.`);
  }
  if (field?.max !== undefined && field.value > field.max) {
    throw new PrimitiveError(`${field.label}에는 ${field.max.toLocaleString("ko-KR")} 이하의 값을 입력해 주세요.`);
  }
}

function safeName(value: string | undefined, fallback: string): string {
  const text = displayText(value ?? "", fallback).replace(/[.!?{}\[\]「」]/gu, "").trim();
  if (!text || text === "…") return fallback;
  return text.length > 18 ? text.slice(0, 17) + "…" : text;
}

function comparisonLiteral(value: string): string {
  let escaped = "";
  for (const character of value) {
    const next = JSON.stringify(character).slice(1, -1).replace(/[\u2028\u2029{}\[\]]/gu,
      entry => `\\u${entry.charCodeAt(0).toString(16).padStart(4, "0")}`);
    if (escaped.length + next.length > 19) return `"${escaped}"…`;
    escaped += next;
  }
  return `"${escaped}"`;
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

function pageSentence(project: Project, condition: Leaf): string {
  const actor = (id: string) => recordName(project.database.actors, id, "지정한 배우");
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
    case "stringVariable": {
      const name = safeName(condition.stringVariableId, "지정한 변수");
      if (condition.op === "empty" || condition.value === "") {
        detail = `「${name}」의 값이 ${condition.op === "!=" ? "비어 있지 않음" : "비어 있음"}`;
      } else if (condition.op === "contains") {
        detail = `「${name}」의 값에 ${comparisonLiteral(condition.value)} 포함`;
      } else {
        detail = `「${name}」의 값이 ${comparisonLiteral(condition.value)}${condition.op === "==" ? "와 같음" : "와 다름"}`;
      }
      break;
    }
    case "item":
      detail = `「${item(condition.itemId)}」 ${condition.present ? "보유 중" : "없음"}`;
      break;
    case "itemUsed":
      detail = `이 이벤트에 아이템 「${item(condition.itemId)}」 사용`;
      break;
    case "actor":
      detail = `「${actor(condition.actorId)}」 파티에 ${condition.present ? "있음" : "없음"}`;
      break;
    case "actorStat":
      detail = `${condition.actorId === "leader" ? "파티 선두" : `「${actor(condition.actorId)}」`}의 ${statLabels[condition.stat]} ${condition.value}${condition.stat.endsWith("Percent") ? "%" : ""}${compareLabels[condition.op]}`;
      break;
    case "actorState": {
      const state = recordName(project.database.states, condition.stateId, "지정한 상태");
      const subject = condition.actorId === "anyone" ? condition.present ? "파티원 중 누군가에게" : "파티원 모두에게"
        : condition.actorId === "leader" ? "파티 선두에게" : `「${actor(condition.actorId)}」에게`;
      detail = `${subject} 「${state}」 ${condition.present ? "있음" : "없음"}`;
      break;
    }
    case "partyLeader":
      detail = `파티 선두가 「${actor(condition.actorId)}」임`;
      break;
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
  return `이 페이지에 ‘${detail}’ 조건을 설정합니다.`;
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
    args: schema({
      ...properties,
      conditionNumber: rowNumber("기존 조건을 바꿀 때만 지정합니다. get_event로 선택한 페이지의 전체 조건 목록을 확인하세요. 첫 줄은 1번입니다. 생략하면 기존 조건을 유지하고 끝에 추가합니다. 동일한 조건이 이미 있으면 그대로 둡니다."),
    }, required),
    scope: pageScope,
    describe: (ctx, args) => pageSentence(ctx.project, fromArgs(args)),
    apply: (ctx, args) => changeConditions(ctx, (conditions, page, map) => {
      const condition = fromArgs(args);
      validateLeaf(ctx.project, map, page, condition);
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
      if (kind === "not") return `이 페이지의 ${args.conditionNumber}번 조건을 반대로 바꿉니다.`;
      const size = Array.isArray(args.conditionNumbers) ? args.conditionNumbers.length : 0;
      return kind === "all" ? `고른 조건 ${size}개가 모두 맞아야 하도록 묶습니다.`
        : `고른 조건 ${size}개 중 하나라도 맞으면 되도록 묶습니다.`;
    },
    apply: (ctx, args) => changeConditions(ctx, (conditions, _page, map) => {
      const rows = single ? [args.conditionNumber] : args.conditionNumbers;
      if (!Array.isArray(rows) || rows.length === 0) throw new PrimitiveError("묶을 조건 줄을 골라 주세요.");
      const indexes = new Set(rows.map(row => indexOfRow(conditions, row)));
      if (indexes.size !== rows.length) throw new PrimitiveError("같은 조건 줄은 한 번만 골라 주세요.");
      const selected = conditions.filter((_condition, index) => indexes.has(index));
      const combined = single ? build.buildConditionNot({ condition: selected[0] })
        : kind === "all" ? build.buildConditionAll({ conditions: selected }) : build.buildConditionAny({ conditions: selected });
      validate(ctx.project, map, combined);
      const first = conditions.findIndex((_condition, index) => indexes.has(index));
      return conditions.flatMap((condition, index) => index === first ? [combined] : indexes.has(index) ? [] : [condition]);
    }),
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  leaf("switch", build.buildConditionSwitch, { switchId, value: on }, ["switchId"]),
  leaf("variable", build.buildConditionVariable, { variableId, op: comparison, value: number }, ["variableId"]),
  leaf("selfSwitch", build.buildConditionSelfSwitch, {
    key: { type: "string", enum: selfSwitchKeys, description: "이 이벤트의 기억 A부터 D까지 중 하나입니다. 생략하면 A입니다." },
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
    timerId: { type: "string", enum: timerIds, description: "첫째 또는 둘째 타이머입니다. 생략하면 첫째입니다." },
    seconds: { ...count, description: "남은 시간의 기준을 초로 입력합니다. 생략하면 0초입니다." },
    op: { ...comparison, description: "남은 시간의 비교 방법입니다. 생략하면 이하입니다." },
  }),
  leaf("actor", build.buildConditionActor, { actorId, present }, ["actorId"]),
  leaf("actorStat", build.buildConditionActorStat, {
    actorId: ref("배우의 식별자 또는 파티 선두입니다. 생략하면 선두입니다."),
    stat: { type: "string", enum: ["level", "hp", "mp", "hpPercent", "mpPercent"], description: "레벨, 체력, 마력, 체력 비율, 마력 비율 중 하나입니다. 생략하면 레벨입니다." },
    op: comparison, value: { ...count, description: `능력치 기준입니다. 레벨 기준은 ${ACTOR_LEVEL_MAX} 이하, 비율은 0~100의 정수입니다. 생략하면 10입니다.` },
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
