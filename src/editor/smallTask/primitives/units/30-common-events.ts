import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { CHOICE_CANCEL_BRANCH_INDEX, FORK_ELSE_BRANCH_INDEX, PRESENT_OTHERWISE_BRANCH_INDEX,
  resolveCommandAtPath, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { COMMON_EVENT_TRIGGER_OPTIONS, commonEventTriggerLabel } from "@/editor/panels/databaseDisplay";
import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import {
  deleteEventCommand, eventCommandHash, eventCommandListHash, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import type { Command, CommonEvent, Project } from "@/project/types";
import { roJosa } from "@/util/josa";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import {
  commandForInsert, editCommands, quotedName, refuseReferencedRemoval,
  validateCommandReferences, validateLabelEdit,
  validateSingleInsert,
} from "./30-common-events/validation";

export const UNIT = "30-common-events";

type Args = Record<string, unknown>;
type Scope = ReturnType<SmallTaskPrimitive["scope"]>;

const eventId = { type: "string", minLength: 1, description: "get_database_records(collection: commonEvents)에서 확인한 공용 이벤트의 식별자입니다." } as const;
const eventName = { type: "string", minLength: 1, description: "공용 이벤트에 붙일 이름입니다." } as const;
const index = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "목록의 줄 위치입니다. 첫 줄은 0입니다." } as const;
const branchPath = {
  type: "array",
  items: { type: "integer" },
  description: "바깥에서 안쪽 순으로 명령 줄과 분기 번호를 짝지어 입력합니다. 선택지는 0부터, 거래 성공 -1, 조건 참 -2, 거짓 -3, 취소 -4, 반복 -5, 승급·진화 성공 -6, 실패 -7, 숙박비 부족 -8, 전투 승리 -9, 패배 -10, 도주 -11, 거래 실패 -12, 틀린 아이템 제시 -13입니다. 바깥 목록이면 생략합니다.",
} as const;
const commandSnapshot = {
  expectedListHash: {
    type: "string", minLength: 1,
    description: "get_database_records(collection: commonEvents, include: full)에서 읽은 commandListHash입니다.",
  },
  expectedCommand: {
    type: "object", additionalProperties: true, required: ["kind"], properties: { kind: { type: "string", enum: COMMAND_KINDS } },
    description: "자료집에서 전체 내용(include: full)을 읽고 고른 줄의 기존 명령을 그대로 입력합니다.",
  },
  expectedHash: { type: "string", minLength: 1, description: "해당 줄의 기존 내용 해시를 이미 읽었다면 기존 명령 대신 입력할 수 있습니다." },
} as const;
const commandFields: Record<string, JsonSchema> = {
  body: { type: ["string", "array"], description: "대사 문구 또는 반복 명령의 목록입니다." },
  ms: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "대기 시간입니다. 1초는 1000입니다." },
  amount: { type: ["number", "object"], description: "아이템이나 소지금의 수량 또는 그 값을 담은 변수입니다." },
  switchId: { type: "string", description: "조작할 스위치의 식별자입니다." },
  resourceId: { type: "string", description: "재생할 소리나 표시할 그림의 식별자입니다." },
};

function argsSchema(properties: Record<string, JsonSchema>, required: readonly string[]): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

function targetMap(ctx: PrimitiveContext) {
  if (ctx.target.kind !== "map" || !Object.hasOwn(ctx.project.maps, ctx.target.mapId)) {
    throw new PrimitiveError("범위 밖: 맵에서 공용 이벤트 작업을 시작해 주세요.");
  }
  return ctx.project.maps[ctx.target.mapId];
}

function projectScope(ctx: PrimitiveContext, args?: Args): Scope {
  targetMap(ctx);
  return args
    ? { kind: "projectArea", area: "commonEvents", ids: [findEvent(ctx, args).id] }
    : { kind: "projectArea", area: "commonEvents", ids: [], create: 1 };
}

function findEvent(ctx: PrimitiveContext, args: Args): CommonEvent {
  const event = ctx.project.commonEvents.find(candidate => candidate.id === args.commonEventId);
  if (!event) throw new PrimitiveError("공용 이벤트를 찾을 수 없습니다.");
  return event;
}

function nameFromArgs(args: Args): string {
  const name = (args.name as string).trim();
  if (!name) throw new PrimitiveError("공용 이벤트 이름을 입력해 주세요.");
  return name;
}

function nameOf(event: CommonEvent): string {
  return quotedName(event.name === event.id ? "" : event.name, "공용 이벤트");
}

function renameSentence(event: CommonEvent, name: string): string {
  const quoted = quotedName(name, "새 이름");
  const label = quoted.endsWith("」") ? quoted.slice(1, -1) : quoted;
  return `${nameOf(event)}의 이름을 ${quoted}${roJosa(label)} 바꿔요.`;
}

function nextCommonEventId(project: Project): string {
  const used = new Set(project.commonEvents.map(event => event.id));
  let number = 1;
  while (used.has(`ce_${number}`)) number += 1;
  return `ce_${number}`;
}

function createPrimitive(
  id: string, title: string, args: JsonSchema,
  describe: SmallTaskPrimitive["describe"], apply: SmallTaskPrimitive["apply"],
  scope: SmallTaskPrimitive["scope"] = projectScope,
): SmallTaskPrimitive {
  return { id, unit: UNIT, title, covers: { tools: [id] }, targets: ["map"], args, scope, describe, apply };
}

function editEvent(event: CommonEvent, project: Project, next: CommonEvent): Project {
  return { ...project, commonEvents: project.commonEvents.map(current => current === event ? next : current) };
}

function commandPath(event: CommonEvent, args: Args): number[] {
  const branch = (args.branchPath as number[] | undefined) ?? [];
  if (branch.length % 2 || branch.some((part, offset) => !Number.isSafeInteger(part) || (offset % 2 === 0 && part < 0))) {
    throw new PrimitiveError("명령 줄과 분기 위치를 다시 확인해 주세요.");
  }
  if (branch.length && args.index === undefined) throw new PrimitiveError("분기 안에 넣을 명령 줄 위치를 알려 주세요.");
  return [...branch, (args.index as number | undefined) ?? event.commands.length];
}

function existingCommand(event: CommonEvent, path: number[]): Command {
  const command = resolveCommandAtPath(event.commands, path);
  if (!command) throw new PrimitiveError("공용 이벤트의 명령 줄을 찾을 수 없습니다.");
  return command;
}

function expectedCommandHash(event: CommonEvent, path: number[], args: Args): string {
  if (eventCommandListHash(event.commands) !== args.expectedListHash) throw new PrimitiveError(STALE_COMMAND_LIST);
  if (typeof args.expectedHash === "string" && args.expectedCommand === undefined) return args.expectedHash;
  if (args.expectedHash === undefined && args.expectedCommand !== undefined) return eventCommandHash(args.expectedCommand as Command);
  if (args.expectedHash !== undefined) throw new PrimitiveError("기존 명령과 그 줄의 해시 중 하나만 입력해 주세요.");
  return eventCommandHash(existingCommand(event, path));
}

function eventForInsert(event: CommonEvent, path: number[]): CommonEvent {
  if (path.length === 1 || path.at(-1) !== 0 || resolveCommandListAtPath(event.commands, path)) return event;
  const parent = resolveCommandAtPath(event.commands, path.slice(0, -2));
  if (!parent) return event;
  const branchIndex = path.at(-2);
  const implicit = (parent.kind === "fork" && branchIndex === FORK_ELSE_BRANCH_INDEX) ||
    (parent.kind === "presentItem" && (branchIndex === PRESENT_OTHERWISE_BRANCH_INDEX || branchIndex === CHOICE_CANCEL_BRANCH_INDEX));
  if (!implicit && !eventCommandBranches(parent).some(branch => branch.branchIndex === branchIndex)) return event;
  // An available branch may have no stored array until its first row is inserted.
  const commands = structuredClone(event.commands);
  resolveCommandListAtPath(commands, path, { missingBranches: "create" });
  return { ...event, commands };
}

function describeCommand(ctx: PrimitiveContext, args: Args, verb: string): string {
  const event = findEvent(ctx, args);
  const kind = existingCommand(event, commandPath(event, args)).kind;
  const label = displayText(commandKindLabel(kind), "이벤트 명령");
  return `${nameOf(event)}에 있는 ‘${label}’ 명령을 ${verb}.`;
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  createPrimitive(
    "commonEvent.create", "공용 이벤트 추가",
    argsSchema({ name: eventName }, ["name"]),
    (_ctx, args) => `이름이 ${quotedName(nameFromArgs(args), "공용 이벤트")}인 공용 이벤트를 만들어요.`,
    ({ project }, args) => ({
      ...project,
      commonEvents: [...project.commonEvents, {
        id: nextCommonEventId(project), name: nameFromArgs(args), trigger: "none", commands: [],
      }],
    }),
    ctx => projectScope(ctx),
  ),
  createPrimitive(
    "commonEvent.rename", "공용 이벤트 이름 변경",
    argsSchema({ commonEventId: eventId, name: eventName }, ["commonEventId", "name"]),
    (ctx, args) => renameSentence(findEvent(ctx, args), nameFromArgs(args)),
    (ctx, args) => {
      const event = findEvent(ctx, args);
      return editEvent(event, ctx.project, { ...event, name: nameFromArgs(args) });
    },
  ),
  createPrimitive(
    "commonEvent.trigger.set", "공용 이벤트 실행 조건 설정",
    argsSchema({
      commonEventId: eventId,
      trigger: {
        type: "string", enum: COMMON_EVENT_TRIGGER_OPTIONS.map(option => option.value),
        description: "호출, 자동 실행, 병렬 처리 중 하나를 고릅니다.",
      },
      conditionSwitchId: {
        type: ["string", "null"], minLength: 1,
        description: "자동 실행이나 병렬 처리에 쓸 스위치의 식별자입니다. null은 조건 해제, 생략은 현재 조건 유지입니다.",
      },
    }, ["commonEventId", "trigger"]),
    (ctx, args) => {
      const event = findEvent(ctx, args);
      const label = commonEventTriggerLabel(args.trigger as CommonEvent["trigger"]);
      if (typeof args.conditionSwitchId === "string") {
        const condition = ctx.project.switches.find(row => row.id === args.conditionSwitchId);
        const name = quotedName(condition && condition.name !== condition.id ? condition.name : "", "");
        return `${nameOf(event)}에 ‘${label}’ 방식과 ${name || "스위치"} 켜짐 조건을 설정해요.`;
      }
      const suffix = args.conditionSwitchId === null ? "설정하고 스위치 조건을 지워요." : "설정해요.";
      return `${nameOf(event)}에 ‘${label}’ 방식을 ${suffix}`;
    },
    (ctx, args) => {
      const event = findEvent(ctx, args);
      const trigger = args.trigger as CommonEvent["trigger"];
      const condition = args.conditionSwitchId === undefined ? event.conditionSwitchId : args.conditionSwitchId;
      if (trigger === "none" && typeof args.conditionSwitchId === "string") {
        throw new PrimitiveError("호출 방식에는 스위치 조건을 새로 설정할 수 없습니다. 자동 실행이나 병렬 처리를 골라 주세요.");
      }
      if (trigger !== "none" && typeof condition === "string" && !ctx.project.switches.some(row => row.id === condition)) {
        throw new PrimitiveError("실행 조건에 쓸 스위치를 찾을 수 없습니다.");
      }
      const next = { ...event, trigger };
      if (typeof condition === "string") next.conditionSwitchId = condition;
      else delete next.conditionSwitchId;
      return editEvent(event, ctx.project, next);
    },
  ),
  createPrimitive(
    "commonEvent.remove", "공용 이벤트 삭제",
    argsSchema({ commonEventId: eventId }, ["commonEventId"]),
    (ctx, args) => `${nameOf(findEvent(ctx, args))} 항목을 공용 이벤트 목록에서 지워요.`,
    (ctx, args) => {
      const event = findEvent(ctx, args);
      refuseReferencedRemoval(ctx.project, event.id, ctx.live);
      return { ...ctx.project, commonEvents: ctx.project.commonEvents.filter(row => row !== event) };
    },
  ),
  createPrimitive(
    "commonEvent.command.insert", "공용 이벤트 명령 추가",
    argsSchema({
      commonEventId: eventId, index, branchPath,
      command: {
        type: "object",
        properties: {
          kind: { type: "string", enum: COMMAND_KINDS, description: "넣을 명령의 종류입니다." },
          ...commandFields,
        },
        required: ["kind"],
        additionalProperties: true,
        description: "한 줄에 넣을 명령과 그 필드입니다. 분기 안의 명령은 줄을 골라 따로 넣습니다.",
      },
    }, ["commonEventId", "command"]),
    (ctx, args) => {
      const event = findEvent(ctx, args);
      const label = displayText(commandKindLabel((args.command as Command).kind), "이벤트 명령");
      return `${nameOf(event)}에 ‘${label}’ 명령을 넣어요.`;
    },
    (ctx, args) => {
      const event = findEvent(ctx, args);
      const command = commandForInsert(args.command as Command);
      const path = commandPath(event, args);
      const next = editCommands(() => insertEventCommand(eventForInsert(event, path), path, command));
      const inserted = existingCommand(next, path);
      validateSingleInsert(inserted);
      validateCommandReferences(ctx.project, targetMap(ctx), inserted);
      validateLabelEdit(ctx.project, targetMap(ctx), event, next.commands, path, undefined, inserted);
      return editEvent(event, ctx.project, next);
    },
  ),
  createPrimitive(
    "commonEvent.command.update", "공용 이벤트 명령 수정",
    argsSchema({
      commonEventId: eventId, index, branchPath, ...commandSnapshot,
      patch: {
        type: "object", additionalProperties: true,
        properties: {
          ...commandFields,
          optionLabels: { type: "array", items: { type: "string" }, description: "기존 순서에 맞춘 모든 선택지의 문구입니다." },
          fields: { type: "object", additionalProperties: true, description: "기타 명령에서 바꿀 항목과 값입니다. 생략한 항목은 유지합니다." },
        },
        description: "고칠 필드와 값입니다. 선택지 문구만 고칠 때는 기존 순서대로 문구 목록을 입력합니다.",
      },
    }, ["commonEventId", "index", "expectedListHash", "patch"]),
    (ctx, args) => describeCommand(ctx, args, "고쳐요"),
    (ctx, args) => {
      const event = findEvent(ctx, args);
      const path = commandPath(event, args);
      const expectedHash = expectedCommandHash(event, path, args);
      const current = existingCommand(event, path);
      const patch = args.patch as Args;
      if (Object.keys(patch).length === 0) throw new PrimitiveError("이 명령에서 바꿀 값을 입력해 주세요.");
      const fields = current.kind === "m2Command" && patch.fields !== undefined
        ? { ...patch, fields: { ...current.fields, ...patch.fields as Args } }
        : patch;
      const next = editCommands(() => updateEventCommand(event, path, fields, expectedHash));
      const updated = existingCommand(next, path);
      validateCommandReferences(ctx.project, targetMap(ctx), updated, current);
      validateLabelEdit(ctx.project, targetMap(ctx), event, next.commands, path, current, updated);
      return editEvent(event, ctx.project, next);
    },
  ),
  createPrimitive(
    "commonEvent.command.delete", "공용 이벤트 명령 삭제",
    argsSchema({ commonEventId: eventId, index, branchPath, ...commandSnapshot }, ["commonEventId", "index", "expectedListHash"]),
    (ctx, args) => describeCommand(ctx, args, "지워요"),
    (ctx, args) => {
      const event = findEvent(ctx, args);
      const path = commandPath(event, args);
      const expectedHash = expectedCommandHash(event, path, args);
      const current = existingCommand(event, path);
      const next = editCommands(() => deleteEventCommand(event, path, expectedHash));
      validateLabelEdit(ctx.project, targetMap(ctx), event, next.commands, path, current);
      return editEvent(event, ctx.project, next);
    },
  ),
];
