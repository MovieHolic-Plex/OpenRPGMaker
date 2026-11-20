import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { applyEditedGameTitle } from "@/project/defaults/defaultOpeningSequence";
import { GOLD_MAX, isSafeEconomyValue } from "@/project/economyValues";
import { blueprintEndingId } from "@/project/gameBlueprint";
import { validateCondition } from "@/project/io/commandReferenceValidation";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { EndingCondition, EndingDef, Project } from "@/project/types";
import { PrimitiveError } from "../errors";
import type { SmallTaskPrimitive } from "../types";

export const UNIT = "28-project-data";

type FlagArea = "switches" | "variables";
type Area = FlagArea | "endings" | "system";
type Args = Record<string, unknown>;
type Operation = Pick<SmallTaskPrimitive, "args" | "describe" | "apply">;
type Mode = "create" | "edit" | readonly string[];
type NamedRecord = { readonly id: string; readonly name: string };

const text = (description: string): JsonSchema => ({ type: "string", minLength: 1, description });
const object = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: "object", properties, required, additionalProperties: false,
});

function requiredText(value: unknown, reason: string): string {
  if (typeof value !== "string" || !value.trim()) throw new PrimitiveError(reason);
  return value.trim();
}

function quoted(value: string, fallback: string): string {
  const clean = displayText(value.replace(/[{}\[\]「」]/gu, " "), fallback);
  return `「${clean.length > 45 ? clean.slice(0, 44) + "…" : clean}」`;
}

function primitive(id: string, title: string, area: Area, mode: Mode, operation: Operation): SmallTaskPrimitive {
  return {
    id, unit: UNIT, title, covers: { tools: [id] }, targets: ["map"],
    scope({ project, target }) {
      if (target.kind !== "map" || !Object.hasOwn(project.maps, target.mapId)) {
        throw new PrimitiveError("범위 밖: 편집기에서 맵을 먼저 선택해 주세요.");
      }
      if (mode === "create") return { kind: "projectArea", area, create: 1 };
      if (area === "system") return { kind: "projectArea", area, ids: typeof mode === "string" ? [] : mode };
      // 맵에서 프로젝트 자료를 요청할 수 있다. 편집할 수 있는 행은 현재 프로젝트에서 열거한다.
      return { kind: "projectArea", area, ids: (project[area] ?? []).map(record => record.id) };
    },
    ...operation,
  };
}

function namedRecord<T extends NamedRecord>(records: readonly T[], reference: unknown, label: string): T {
  const key = requiredText(reference, `${label} 이름을 입력해 주세요.`);
  const byId = records.find(candidate => candidate.id === key);
  if (byId) return byId;
  const matches = records.filter(candidate => candidate.name.trim() === key);
  if (matches.length > 1) throw new PrimitiveError(`같은 이름의 ${label} 항목이 여러 개 있어요.`);
  if (!matches[0]) throw new PrimitiveError(`${label} 항목을 찾을 수 없어요.`);
  return matches[0];
}

function nextNumberedId(prefix: string, records: readonly { id: string }[], reserved: readonly string[] = []): string {
  const taken = new Set([...records.map(record => record.id), ...reserved]);
  let number = 1;
  while (taken.has(`${prefix}_${String(number).padStart(4, "0")}`)) number++;
  return `${prefix}_${String(number).padStart(4, "0")}`;
}

function defineFlag(area: FlagArea, prefix: "sw" | "var", label: string): Operation {
  return {
    args: object({ name: text(`새 ${label} 이름`) }, ["name"]),
    describe(_ctx, args) {
      return `${quoted(String(args.name), label)} ${label}를 추가해요.`;
    },
    apply({ project }, args) {
      const name = requiredText(args.name, "이름을 입력해 주세요.");
      const reserved = Object.keys(project.session[area]);
      if (area === "switches") reserved.push(...Object.keys(project.flags));
      const id = nextNumberedId(prefix, project[area], reserved);
      // 스토어가 적용할 때 새 항목의 시작 값 슬롯을 채우므로 그 사본도 분리한다.
      return {
        ...project,
        [area]: [...project[area], { id, name }],
        session: { ...project.session, [area]: { ...project.session[area] } },
      };
    },
  };
}

function renameFlag(area: FlagArea, label: string): Operation {
  return {
    args: object({ record: text(`이름을 바꿀 기존 ${label}의 이름 또는 식별자`), name: text(`새 ${label} 이름`) }, ["record", "name"]),
    describe(_ctx, args) {
      return `선택한 ${label} 이름을 ${quoted(String(args.name), "새 이름")}(으)로 바꿔요.`;
    },
    apply(ctx, args) {
      const records = ctx.project[area];
      const record = namedRecord(records, args.record, label);
      const name = requiredText(args.name, "이름을 입력해 주세요.");
      return { ...ctx.project, [area]: records.map(entry => entry === record ? { ...entry, name } : entry) };
    },
  };
}

const VARIABLE_OPS = ["==", "!=", ">=", "<=", ">", "<"] as const;
const CONDITIONS: JsonSchema = {
  type: "array",
  description: "모두 만족해야 하는 엔딩 조건 목록. 빈 목록이면 조건 없이 열려요.",
  items: {
    oneOf: [
      object({ kind: { enum: ["switch"], description: "스위치 조건" }, switchId: text("기존 스위치의 이름 또는 식별자"), value: { type: "boolean", description: "켜져 있어야 하면 참" } }, ["kind", "switchId", "value"]),
      object({ kind: { enum: ["variable"], description: "변수 조건" }, variableId: text("기존 변수의 이름 또는 식별자"), op: { enum: VARIABLE_OPS, description: "비교 방법" }, value: { type: "number", description: "비교할 값" } }, ["kind", "variableId", "op", "value"]),
      object({ kind: { enum: ["friendshipAtLeast"], description: "호감도 조건" }, npcKey: text("호감도를 확인할 인물의 관계 키. 가장 높은 호감도를 보려면 별표"), value: { type: "number", description: "필요한 호감도" } }, ["kind", "npcKey", "value"]),
      object({ kind: { enum: ["newGamePlus"], description: "강하게 다시 하기 조건" }, value: { type: "boolean", description: "강하게 다시 하기 회차면 참" } }, ["kind", "value"]),
    ],
  },
};

function endingConditions(project: Project, value: unknown): EndingCondition[] {
  if (!Array.isArray(value)) throw new PrimitiveError("엔딩 조건을 확인해 주세요.");
  const switchIds = new Set(project.switches.map(record => record.id));
  const variableIds = new Set(project.variables.map(record => record.id));
  return value.map((condition: EndingCondition) => {
    if (condition?.kind === "newGamePlus" && typeof condition.value === "boolean") {
      return { kind: condition.kind, value: condition.value };
    }
    try {
      validateConditionShape("엔딩 조건", condition);
    } catch {
      throw new PrimitiveError("엔딩 조건 형식이 올바르지 않아요.");
    }
    if (condition.kind === "friendshipAtLeast" && condition.npcKey?.trim()) {
      return { kind: condition.kind, npcKey: condition.npcKey.trim(), value: condition.value };
    }
    if (condition.kind === "switch") {
      const flag = namedRecord(project.switches, condition.switchId, "엔딩 조건의 스위치");
      const resolved = { ...condition, switchId: flag.id };
      validateCondition(resolved, switchIds, variableIds);
      return resolved;
    }
    if (condition.kind === "variable" && VARIABLE_OPS.includes(condition.op)) {
      const flag = namedRecord(project.variables, condition.variableId, "엔딩 조건의 변수");
      const resolved = { ...condition, variableId: flag.id };
      validateCondition(resolved, switchIds, variableIds);
      return resolved;
    }
    throw new PrimitiveError("엔딩 조건 형식이 올바르지 않아요.");
  });
}

const endingFields = {
  name: text("엔딩 이름"),
  priority: { type: "integer", description: "조건이 같은 여러 결말 중 선택할 순서. 높을수록 우선하며 새 엔딩의 기본값은 0" },
  conditions: CONDITIONS,
} satisfies Record<string, JsonSchema>;
const endingRecord = text("기존 엔딩의 이름 또는 식별자");

function patchEnding(project: Project, ending: EndingDef, args: Args): EndingDef {
  const priority = args.priority ?? ending.priority;
  if (typeof priority !== "number" || !Number.isSafeInteger(priority)) {
    throw new PrimitiveError("엔딩 우선순위는 정수로 입력해 주세요.");
  }
  return {
    ...ending,
    priority,
    ...(args.name === undefined ? {} : { name: requiredText(args.name, "엔딩 이름을 입력해 주세요.") }),
    ...(args.conditions === undefined ? {} : { conditions: endingConditions(project, args.conditions) }),
  };
}

function hasEndingReference(value: unknown, id: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(child => hasEndingReference(child, id));
  const node = value as Record<string, unknown>;
  if (node.endingId === id && (node.kind === "triggerEnding" || node.kind === "endingSeen" || node.kind === "ending")) return true;
  return Object.values(node).some(child => hasEndingReference(child, id));
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  primitive("switch.define", "스위치 추가", "switches", "create",
    defineFlag("switches", "sw", "스위치")),
  primitive("switch.rename", "스위치 이름 변경", "switches", "edit", renameFlag("switches", "스위치")),
  primitive("variable.define", "변수 추가", "variables", "create",
    defineFlag("variables", "var", "변수")),
  primitive("variable.rename", "변수 이름 변경", "variables", "edit", renameFlag("variables", "변수")),
  primitive("ending.define", "엔딩 추가", "endings", "create", {
    args: object(endingFields, ["name"]),
    describe(_ctx, args) {
      return `${quoted(String(args.name), "새 엔딩")} 엔딩을 추가해요.`;
    },
    apply({ project }, args) {
      const endings = project.endings ?? [];
      const name = requiredText(args.name, "엔딩 이름을 입력해 주세요.");
      const key = blueprintEndingId(name);
      const id = endings.some(ending => ending.id === key) ? nextNumberedId(key, endings) : key;
      const ending = patchEnding(project, { id, name, conditions: [], priority: 0 }, args);
      return { ...project, endings: [...endings, ending] };
    },
  }),
  primitive("ending.update", "엔딩 수정", "endings", "edit", {
    args: object({ record: endingRecord, ...endingFields }, ["record"]),
    describe(ctx, args) {
      const ending = namedRecord(ctx.project.endings ?? [], args.record, "엔딩");
      const name = String(args.name ?? ending.name);
      return `${quoted(name === ending.id ? "" : name, "선택한 결말")} 엔딩을 수정해요.`;
    },
    apply(ctx, args) {
      if (args.name === undefined && args.priority === undefined && args.conditions === undefined) {
        throw new PrimitiveError("바꿀 엔딩 설정을 하나 이상 알려 주세요.");
      }
      const endings = ctx.project.endings ?? [];
      const ending = namedRecord(endings, args.record, "엔딩");
      const updated = patchEnding(ctx.project, ending, args);
      return { ...ctx.project, endings: endings.map(entry => entry === ending ? updated : entry) };
    },
  }),
  primitive("ending.remove", "엔딩 삭제", "endings", "edit", {
    args: object({ record: endingRecord }, ["record"]),
    describe(ctx, args) {
      const ending = namedRecord(ctx.project.endings ?? [], args.record, "엔딩");
      return `${quoted(ending.name === ending.id ? "" : ending.name, "선택한 결말")} 엔딩을 삭제해요.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const endings = project.endings ?? [];
      const ending = namedRecord(endings, args.record, "엔딩");
      const remaining = endings.filter(entry => entry !== ending);
      const sources = [
        ...Object.values(project.maps).map(map => map.events),
        project.commonEvents, project.database.troops, project.system, project.quests, remaining,
      ];
      if (hasEndingReference(sources, ending.id)) {
        throw new PrimitiveError("이벤트나 조건에서 쓰는 엔딩이라 삭제할 수 없어요.");
      }
      return { ...project, endings: remaining };
    },
  }),
  // The title editor updates the generated opening card if it still displays the old title.
  primitive("system.title", "게임 제목 변경", "system", ["title", "opening"], {
    args: object({ title: text("새 게임 제목") }, ["title"]),
    describe(_ctx, args) {
      return `게임 제목을 ${quoted(String(args.title), "새 제목")}(으)로 바꿔요.`;
    },
    apply({ project }, args) {
      const title = requiredText(args.title, "게임 제목을 입력해 주세요.");
      const next = { ...project, meta: { ...project.meta }, system: { ...project.system } };
      applyEditedGameTitle(next, project.system.titleScreen?.title ?? "", title);
      if (project.system.titleScreen) next.system.titleScreen = { ...project.system.titleScreen, title };
      return next;
    },
  }),
  primitive("system.startGold", "시작 소지금 변경", "system", ["startGold"], {
    args: object({ gold: { type: "integer", minimum: 0, maximum: GOLD_MAX, description: "새 게임을 시작할 때 가지고 있는 소지금" } }, ["gold"]),
    describe(_ctx, args) {
      return `시작 소지금을 ${(args.gold as number).toLocaleString("ko-KR")} 골드로 바꿔요.`;
    },
    apply({ project }, args) {
      const gold = args.gold;
      if (!isSafeEconomyValue(gold)) throw new PrimitiveError("시작 소지금이 허용 범위 밖이에요.");
      return { ...project, session: { ...project.session, gold } };
    },
  }),
  primitive("system.startParty", "시작 파티 변경", "system", ["startParty"], {
    args: object({
      actorIds: { type: "array", minItems: 1, maxItems: 4, items: text("기존 배우의 이름 또는 식별자"), description: "맨 앞에 설 배우부터 순서대로 고른 시작 멤버" },
    }, ["actorIds"]),
    describe({ project }, args) {
      const actorIds = args.actorIds as string[];
      const members = actorIds.map(id => {
        const actor = namedRecord(project.database.actors, id, "시작 파티의 배우");
        const name = actor.name !== actor.id ? actor.name : "";
        return quoted(name, "선택한 배우");
      }).join(", ");
      return members.length <= 65
        ? `${members}(으)로 시작해요.`
        : `선택한 배우 ${actorIds.length}명으로 시작해요.`;
    },
    apply({ project }, args) {
      if (!Array.isArray(args.actorIds) || args.actorIds.length < 1 || args.actorIds.length > 4) {
        throw new PrimitiveError("시작 파티의 배우를 한 명에서 네 명까지 골라 주세요.");
      }
      const actorIds = args.actorIds.map(reference => namedRecord(project.database.actors, reference, "시작 파티의 배우").id);
      if (new Set(actorIds).size !== actorIds.length) throw new PrimitiveError("같은 배우를 시작 파티에 두 번 넣을 수 없어요.");
      return {
        ...project,
        system: { ...project.system, startActorIds: [...actorIds] },
        session: { ...project.session, partyActorIds: [...actorIds] },
      };
    },
  }),
];
