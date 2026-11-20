import { sameName } from "@/ai/v2/story/blueprintPathNames";
import { eventReferenceMatches } from "@/editor/databaseEventReferences";
import { parseDialogueLineId } from "@/editor/dialogue/dialogueIndex";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { affectionVariableOwner } from "@/project/affectionVariables";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { retitlePlaceholderOpening } from "@/project/defaults/defaultOpeningSequence";
import { GOLD_MAX, isSafeEconomyValue } from "@/project/economyValues";
import { listEventDraftVaultEntries } from "@/project/eventDraftVault";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { SCRIPT_API_BY_NAME } from "@/project/script/apiSpec";
import { isScriptCommand, resolveScriptRefId, type ScriptEffectSource } from "@/project/script/effects";
import { ANY_FRIENDSHIP_KEY, FRIENDSHIP_MAX, FRIENDSHIP_MIN } from "@/project/session";
import type { EndingCondition, EndingDef, PersistedGameEvent, Project } from "@/project/types";
import { genId } from "@/util/id";
import { roJosa } from "@/util/josa";
import { PrimitiveError } from "../errors";
import type { SmallTaskPrimitive } from "../types";
import { scriptCmdMayMatch, scriptMayUseGameApi, scriptStringArg } from "./28-project-data/scriptReferences";

export const UNIT = "28-project-data";

type FlagArea = "switches" | "variables";
type Area = FlagArea | "endings" | "system";
type Args = Record<string, unknown>;
type Operation = Pick<SmallTaskPrimitive, "args" | "describe" | "apply">;
type Mode = "create" | "edit" | readonly string[] | ((project: Project, args: Args) => readonly string[]);
type NamedRecord = { readonly id: string; readonly name: string };
const RECORD_LABELS = { switches: "스위치", variables: "변수", endings: "엔딩" };

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

function quotedTo(value: string, fallback: string): string {
  const name = quoted(value, fallback);
  return name + roJosa(name.slice(1, -1));
}

function primitive(id: string, title: string, area: Area, mode: Mode, operation: Operation): SmallTaskPrimitive {
  return {
    id, unit: UNIT, title, covers: { tools: [id] }, targets: ["map"],
    scope({ project, target }, args) {
      if (target.kind !== "map" || !Object.hasOwn(project.maps, target.mapId)) {
        throw new PrimitiveError("범위 밖: 편집기에서 맵을 먼저 선택해 주세요.");
      }
      if (mode === "create") return { kind: "projectArea", area, create: 1 };
      if (mode === "edit" && area !== "system") {
        const record = namedRecord(project[area] ?? [], args.record, RECORD_LABELS[area]);
        return { kind: "projectArea", area, ids: [record.id] };
      }
      const ids = typeof mode === "function" ? mode(project, args) : mode === "edit" ? [] : mode;
      return { kind: "projectArea", area, ids };
    },
    ...operation,
  };
}

function namedRecord<T extends NamedRecord>(records: readonly T[], reference: unknown, label: string): T {
  const key = requiredText(reference, `${label} 이름을 입력해 주세요.`);
  const byId = records.filter(candidate => candidate.id === key);
  const matches = byId.length ? byId : records.filter(candidate => candidate.name.trim() === key);
  if (matches.length > 1) throw new PrimitiveError(`가리키는 ${label} 항목이 여러 개예요. 항목을 하나로 지정해 주세요.`);
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
      const reserved = [...Object.keys(project.session[area]), ...project[area].map(record => record.name)];
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

function flagScriptLookupChanges(script: ScriptEffectSource, before: Project, after: Project, area: FlagArea): boolean {
  const kind = area === "switches" ? "switch" : "variable";
  return scriptMayUseGameApi(script, (api, call) => {
    if (api === "cmd") {
      // Commands themselves use IDs. A nested script can still look up a flag by name.
      return scriptCmdMayMatch(call, command => someAuthoredRecord(command, node =>
        isScriptCommand(node) && flagScriptLookupChanges(node, before, after, area)));
    }
    return SCRIPT_API_BY_NAME.get(api)?.refs?.some(ref => {
      if (ref.kind !== kind) return false;
      const id = scriptStringArg(call, ref.arg);
      return id === undefined || resolveScriptRefId(before, kind, id) !== resolveScriptRefId(after, kind, id);
    }) ?? false;
  });
}

function renameFlag(area: FlagArea, label: string): Operation {
  return {
    args: object({ record: text(`이름을 바꿀 기존 ${label}의 이름 또는 식별자`), name: text(`새 ${label} 이름`) }, ["record", "name"]),
    describe(_ctx, args) {
      return `${label} 이름을 ${quotedTo(String(args.name), "새 이름")} 바꿔요.`;
    },
    apply(ctx, args) {
      const records = ctx.project[area];
      const record = namedRecord(records, args.record, label);
      const name = requiredText(args.name, "이름을 입력해 주세요.");
      if (name === record.name) return ctx.project;
      const next = { ...ctx.project, [area]: records.map(entry => entry === record ? { ...entry, name } : entry) };
      const affected = (script: ScriptEffectSource) => flagScriptLookupChanges(script, ctx.project, next, area);
      if (someProjectRecord(ctx.project, node => isScriptCommand(node) && affected(node))
        || (ctx.project.scriptLibrary ?? []).some(affected)) {
        throw new PrimitiveError(`스크립트가 ${label}를 찾는 데 영향을 줄 수 있어 이름을 바꿀 수 없어요.`);
      }
      if (area === "variables" && affectionVariableOwner(ctx.project, record.id) !== affectionVariableOwner(next, record.id)) {
        throw new PrimitiveError("이름을 바꾸면 인물의 호감도 연결도 바뀌어서 이 이름을 쓸 수 없어요.");
      }
      return next;
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
      object({ kind: { enum: ["friendshipAtLeast"], description: "호감도 조건" }, npcKey: text("호감도를 확인할 기존 인물의 관계 키. 가장 높은 호감도를 보려면 별표"), value: { type: "integer", minimum: FRIENDSHIP_MIN, maximum: FRIENDSHIP_MAX, description: "필요한 호감도" } }, ["kind", "npcKey", "value"]),
      object({ kind: { enum: ["newGamePlus"], description: "강하게 다시 하기 조건" }, value: { type: "boolean", description: "강하게 다시 하기 회차면 참" } }, ["kind", "value"]),
    ],
  },
};

function endingConditions(project: Project, value: unknown): EndingCondition[] {
  if (!Array.isArray(value)) throw new PrimitiveError("엔딩 조건을 확인해 주세요.");
  return value.map((condition: EndingCondition) => {
    if (condition?.kind === "newGamePlus" && typeof condition.value === "boolean") {
      return { kind: condition.kind, value: condition.value };
    }
    try {
      validateConditionShape("엔딩 조건", condition);
    } catch {
      throw new PrimitiveError("엔딩 조건 형식이 올바르지 않아요.");
    }
    if (condition.kind === "friendshipAtLeast") {
      const npcKey = requiredText(condition.npcKey, "호감도를 확인할 인물을 골라 주세요.");
      if (npcKey !== ANY_FRIENDSHIP_KEY && !Object.hasOwn(project.characters ?? {}, npcKey)
        && !Object.values(project.maps).some(map => map.events.some(event => event.characterId?.trim() === npcKey))
        && !someProjectRecord(project, node => node.kind === "changeFriendship"
          && typeof node.npcKey === "string" && node.npcKey.trim() === npcKey)) {
        throw new PrimitiveError("호감도를 확인할 인물을 찾을 수 없어요.");
      }
      return { kind: condition.kind, npcKey, value: condition.value };
    }
    if (condition.kind === "switch") {
      const flag = namedRecord(project.switches, condition.switchId, "엔딩 조건의 스위치");
      return { ...condition, switchId: flag.id };
    }
    if (condition.kind === "variable" && VARIABLE_OPS.includes(condition.op)) {
      const flag = namedRecord(project.variables, condition.variableId, "엔딩 조건의 변수");
      return { ...condition, variableId: flag.id };
    }
    throw new PrimitiveError("엔딩 조건 형식이 올바르지 않아요.");
  });
}

const endingFields = {
  name: text("엔딩 이름"),
  priority: { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER, description: "조건을 충족한 엔딩이 여러 개면 숫자가 큰 엔딩을 골라요. 새 엔딩의 기본값은 0이에요." },
  conditions: CONDITIONS,
} satisfies Record<string, JsonSchema>;
const endingRecord = text("기존 엔딩의 이름 또는 식별자");

function patchEnding(project: Project, ending: EndingDef, args: Args): EndingDef {
  const priority = args.priority;
  if (priority !== undefined && (typeof priority !== "number" || !Number.isSafeInteger(priority))) {
    throw new PrimitiveError("엔딩 우선순위는 정수로 입력해 주세요.");
  }
  return {
    ...ending,
    ...(typeof priority === "number" ? { priority } : {}),
    ...(args.name === undefined ? {} : { name: requiredText(args.name, "엔딩 이름을 입력해 주세요.") }),
    ...(args.conditions === undefined ? {} : { conditions: endingConditions(project, args.conditions) }),
  };
}

function someProjectRecord(
  project: Project,
  matches: (node: Record<string, unknown>) => boolean,
  endings = project.endings,
): boolean {
  return Object.values(project.maps).some(map => map.events.some(event =>
    eventReferenceMatches(event, body => someEventRecord(body, matches))))
    || someAuthoredRecord([project.commonEvents, project.database, project.system, project.quests, endings], matches);
}

function someEventRecord(event: PersistedGameEvent, matches: (node: Record<string, unknown>) => boolean): boolean {
  return Object.entries(event).some(([key, value]) => key !== "draft" && someAuthoredRecord(value, matches));
}

function someAuthoredRecord(value: unknown, matches: (node: Record<string, unknown>) => boolean): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(child => someAuthoredRecord(child, matches));
  const node = value as Record<string, unknown>;
  return matches(node) || Object.values(node).some(child => someAuthoredRecord(child, matches));
}

function refersToEnding(node: Record<string, unknown>, id: string): boolean {
  // ID를 생략하면 조건에 맞는 엔딩을 목록에서 고른다.
  if (node.kind === "triggerEnding" && !node.endingId) return true;
  return node.endingId === id && (node.kind === "triggerEnding" || node.kind === "endingSeen" || node.kind === "ending");
}

function scriptMayUseEnding(script: ScriptEffectSource, id: string): boolean {
  return scriptMayUseGameApi(script, (api, call) => api === "cmd" && scriptCmdMayMatch(call, command =>
    someAuthoredRecord(command, node => refersToEnding(node, id) || (isScriptCommand(node) && scriptMayUseEnding(node, id)))));
}

/** Check working bodies before the editor restores them onto the worker's canonical proposal. */
export function assertProjectDataDraftReferences(live: Project, before: Project, after: Project): void {
  const remaining = before.endings === after.endings ? undefined : new Set(after.endings?.map(ending => ending.id));
  const removed = remaining ? before.endings?.filter(ending => !remaining.has(ending.id)) ?? [] : [];
  const flags = (["switches", "variables"] as const).filter(area => {
    if (before[area] === after[area]) return false;
    const oldNames = new Map(before[area].map(record => [record.id, record.name]));
    return after[area].some(record => oldNames.has(record.id) && oldNames.get(record.id) !== record.name);
  });
  if (!removed.length && !flags.length) return;

  function checkDraft(event: PersistedGameEvent): void {
    if (removed.length && someEventRecord(event, node => removed.some(({ id }) =>
      refersToEnding(node, id) || (isScriptCommand(node) && scriptMayUseEnding(node, id))))) {
      throw new PrimitiveError("저장하지 않은 이벤트에서 엔딩을 쓸 수 있어 삭제할 수 없어요.");
    }
    if (flags.length && someEventRecord(event, node => isScriptCommand(node)
      && flags.some(area => flagScriptLookupChanges(node, before, after, area)))) {
      throw new PrimitiveError("저장하지 않은 이벤트 스크립트에 영향을 줄 수 있어 이름을 바꿀 수 없어요.");
    }
  }

  for (const map of Object.values(live.maps)) {
    if (!Object.hasOwn(after.maps, map.id)) continue;
    for (const event of map.events) if (event.draft) checkDraft(event);
  }
  // The store also restores vault entries missing from the live project. Live drafts take precedence.
  for (const { mapId, event } of listEventDraftVaultEntries()) {
    if (Object.hasOwn(after.maps, mapId) && !live.maps[mapId]?.events.some(liveEvent => liveEvent.id === event.id && liveEvent.draft)) {
      checkDraft(event);
    }
  }
}

function blueprintEnding(project: Project, endings: readonly EndingDef[]): EndingDef | undefined {
  const name = project.gameBlueprint?.ending.name;
  if (!name) return undefined;
  return endings.find(ending => sameName(ending.name, name)) ?? (endings.length === 1 ? endings[0] : undefined);
}

function openingWithTitle(project: Project, title: string) {
  return retitlePlaceholderOpening(project.system.opening, [project.meta.title, project.system.titleScreen?.title ?? ""], title);
}

function titleFields(project: Project, args: Args): readonly string[] {
  const title = requiredText(args.title, "게임 제목을 입력해 주세요.");
  const ids: string[] = [];
  const screen = project.system.titleScreen;
  if (screen && screen.title !== title) ids.push("title");
  else if (project.meta.title !== title) ids.push("meta.title");
  if (!screen) ids.push("titleScreen");
  if (openingWithTitle(project, title)) ids.push("opening");
  return ids;
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
      // Device clear records may outlive a deleted ending and can exist on other machines.
      const id = genId("ending");
      const ending = patchEnding(project, { id, name, conditions: [], priority: 0 }, args);
      const next = [...endings, ending];
      const linked = blueprintEnding(project, endings);
      if (linked && blueprintEnding(project, next)?.id !== linked.id) {
        throw new PrimitiveError("엔딩을 추가하면 게임 청사진의 기존 엔딩 연결이 바뀌어서 추가할 수 없어요.");
      }
      return { ...project, endings: next };
    },
  }),
  primitive("ending.update", "엔딩 수정", "endings", "edit", {
    args: object({ record: endingRecord, ...endingFields }, ["record"]),
    describe(ctx, args) {
      const ending = namedRecord(ctx.project.endings ?? [], args.record, "엔딩");
      const name = String(args.name ?? ending.name);
      return `엔딩 ${quoted(name === ending.id ? "" : name, "선택한 결말")}의 설정을 수정해요.`;
    },
    apply(ctx, args) {
      if (args.name === undefined && args.priority === undefined && args.conditions === undefined) {
        throw new PrimitiveError("바꿀 엔딩 설정을 하나 이상 알려 주세요.");
      }
      const endings = ctx.project.endings ?? [];
      const ending = namedRecord(endings, args.record, "엔딩");
      const updated = patchEnding(ctx.project, ending, args);
      const next = endings.map(entry => entry === ending ? updated : entry);
      if (updated.name !== ending.name && blueprintEnding(ctx.project, endings)?.id !== blueprintEnding(ctx.project, next)?.id) {
        throw new PrimitiveError("이름을 바꾸면 게임 청사진의 엔딩 연결이 바뀌어서 이 이름을 쓸 수 없어요.");
      }
      return { ...ctx.project, endings: next };
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
      if (someProjectRecord(project, node => refersToEnding(node, ending.id), remaining)) {
        throw new PrimitiveError("이벤트나 조건에서 쓰는 엔딩이라 삭제할 수 없어요.");
      }
      if (someProjectRecord(project, node => isScriptCommand(node) && scriptMayUseEnding(node, ending.id), remaining)) {
        throw new PrimitiveError("이벤트 스크립트에서 엔딩을 쓸 수 있어 삭제할 수 없어요.");
      }
      if ((project.scriptLibrary ?? []).some(script => scriptMayUseEnding(script, ending.id))) {
        throw new PrimitiveError("공용 스크립트에서 엔딩을 쓸 수 있어 삭제할 수 없어요.");
      }
      if (project.dialogueDesk?.proposals.some(({ lineId }) => {
        const line = parseDialogueLineId(lineId);
        return (line?.scope === "en" || line?.scope === "ep") && line.segments[0] === ending.id;
      })) {
        throw new PrimitiveError("자료집에 이 엔딩의 문장 수정 제안이 남아 있어 삭제할 수 없어요.");
      }
      if (blueprintEnding(project, endings)?.id === ending.id) {
        throw new PrimitiveError("게임 청사진에서 쓰는 엔딩이라 삭제할 수 없어요.");
      }
      return { ...project, endings: remaining };
    },
  }),
  // The title editor updates the generated opening card if it still displays the old title.
  primitive("system.title", "게임 제목 변경", "system", titleFields, {
    args: object({ title: text("새 게임 제목") }, ["title"]),
    describe(_ctx, args) {
      return `게임 제목을 ${quotedTo(String(args.title), "새 제목")} 바꿔요.`;
    },
    apply({ project }, args) {
      const title = requiredText(args.title, "게임 제목을 입력해 주세요.");
      const opening = openingWithTitle(project, title);
      const { system } = project;
      const meta = project.meta.title === title ? project.meta : { ...project.meta, title };
      const titleScreen = system.titleScreen?.title === title
        ? system.titleScreen
        : { ...(system.titleScreen ?? defaultTitleScreenSettings()), title };
      if (titleScreen === system.titleScreen && !opening) {
        return meta === project.meta ? project : { ...project, meta };
      }
      return { ...project, meta, system: { ...system, titleScreen, ...(opening ? { opening } : {}) } };
    },
  }),
  primitive("system.startGold", "시작 소지금 변경", "system", ["session.gold"], {
    args: object({ gold: { type: "integer", minimum: 0, maximum: GOLD_MAX, description: "새 게임을 시작할 때 가지고 있는 소지금" } }, ["gold"]),
    describe(_ctx, args) {
      return `시작 소지금을 ${(args.gold as number).toLocaleString("ko-KR")}골드로 바꿔요.`;
    },
    apply({ project }, args) {
      const gold = args.gold;
      if (!isSafeEconomyValue(gold)) throw new PrimitiveError("시작 소지금이 허용 범위 밖이에요.");
      return { ...project, session: { ...project.session, gold } };
    },
  }),
  primitive("system.startParty", "시작 파티 변경", "system", ["startActorIds", "session.partyActorIds"], {
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
      return members.length <= 60
        ? `시작 파티를 ${members} 순서로 바꿔요.`
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
