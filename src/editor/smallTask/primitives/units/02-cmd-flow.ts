import { newCommand } from "@/editor/eventCommandFactory";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { forkConditionSentence } from "@/editor/panels/eventEditor/commandSummary";
import { CONDITION_SCHEMA } from "@/editor/tools/schemaShapes";
import type { JsonSchema } from "@/editor/tools/types";
import {
  EventCommandEditError, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { SCRIPT_SOURCE_LIMIT } from "@/project/script/types";
import type { Command, Condition, GameMap } from "@/project/types";
import { displayText } from "@/editor/smallTask/target";
import { jsonEqual } from "@/util/structuralJson";
import { eventName, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { compileFlowScript } from "./02-cmd-flow/script";
import { assertFlowCommandDeletion, firstLabelIndex, hasCallerLabel, labelReferenceViews, validateLabelChange } from "./02-cmd-flow/labels";
import { referenceName, requireReference, validateForkCondition } from "./02-cmd-flow/references";
import type { SmallTaskUnitHost } from "../host";

export const UNIT = "02-cmd-flow";
export const host: SmallTaskUnitHost = { commandDeletionGuard: assertFlowCommandDeletion };

type Args = Record<string, unknown>;
type Operation = "insert" | "update";
type FlowKind = "fork" | "wait" | "label" | "gotoLabel" | "loop" | "breakLoop"
  | "callCommonEvent" | "callMapEvent" | "cutsceneControl" | "script";
type FlowCommand = Extract<Command, { kind: FlowKind }>;

function textField(description: string): JsonSchema {
  return { type: "string", minLength: 1, description };
}

const labelName = textField("찾아갈 위치에 붙인 이름.");
// Player waits use a browser timeout, whose delay must fit in a signed 32-bit integer.
const MAX_WAIT_MS = 2 ** 31 - 1;
const position = {
  index: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "명령 목록의 줄 번호. 첫 줄은 0." },
  branchPath: {
    type: "array", items: { type: "integer" },
    description: "분기 안이면 get_event에서 확인한 branchPath. 맨 바깥 목록이면 생략.",
  },
} satisfies Record<string, JsonSchema>;

const fields: Record<FlowKind, {
  title: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
}> = {
  fork: {
    title: "조건 분기",
    properties: { condition: {
      ...CONDITION_SCHEMA,
      properties: {
        ...CONDITION_SCHEMA.properties,
        op: { type: "string", description: "조건 종류에 맞는 비교 방법. 문자열 비교에는 contains와 empty도 쓸 수 있습니다." },
        result: { type: "string", description: "전투 결과는 victory, defeat, escape 중 하나. 탐험 결과는 completed, failed, abandoned 중 하나." },
      },
    } },
    required: ["condition"],
  },
  wait: {
    title: "대기",
    properties: {
      ms: { type: "number", minimum: 0, maximum: MAX_WAIT_MS, description: "대기 시간(밀리초). 1000이면 1초. 새 줄의 기본값은 500." },
      variableId: { type: ["string", "null"], minLength: 1, description: "대기 시간을 밀리초로 읽을 변수. 고정 시간으로 바꾸려면 null을 넣거나 ms만 넣으세요." },
    },
  },
  label: { title: "위치 표시", properties: { name: labelName }, required: ["name"] },
  gotoLabel: { title: "표시한 위치로 이동", properties: { name: labelName }, required: ["name"] },
  loop: { title: "반복" },
  breakLoop: { title: "반복 탈출" },
  callCommonEvent: {
    title: "공용 이벤트 호출", properties: { commonEventId: textField("부를 공용 이벤트의 식별자.") },
    required: ["commonEventId"],
  },
  callMapEvent: {
    title: "맵 이벤트 호출", properties: { eventId: textField("같은 맵에서 부를 이벤트의 식별자.") },
    required: ["eventId"],
  },
  cutsceneControl: {
    title: "컷신 제어",
    properties: {
      mode: { type: "string", enum: ["begin", "end"], description: "컷신의 시작 또는 종료. 삽입 기본값은 시작." },
      skippable: { type: "boolean", description: "컷신을 시작할 때 건너뛸 수 있으면 참." },
    },
  },
  script: {
    title: "스크립트",
    properties: {
      source: { ...textField("게임 안에서 실행할 타입스크립트 원문."), maxLength: SCRIPT_SOURCE_LIMIT },
      name: { type: "string", description: "이벤트 명령에 표시할 짧은 제목. 빈 문자열을 넣으면 제목을 지웁니다." },
    },
    required: ["source"],
  },
};

function patchFields(kind: FlowKind, args: Args, ctx: PrimitiveContext, map: GameMap, current?: Command): Args {
  switch (kind) {
    case "fork": {
      const condition = args.condition as Condition;
      validateForkCondition(ctx.project, map, condition);
      return current ? { condition } : { condition, then: [], else: [] };
    }
    case "wait": {
      const variableId = args.variableId;
      if (typeof variableId === "string") requireReference(ctx.project.variables, variableId, "변수");
      const useFixedTime = variableId === null || (variableId === undefined && args.ms !== undefined);
      if (useFixedTime && args.ms === undefined && current?.kind === "wait" && current.ms > MAX_WAIT_MS) {
        throw new PrimitiveError("저장된 대기 시간이 너무 깁니다. 고정 대기 시간을 새로 입력해 주세요.");
      }
      return {
        ...(args.ms === undefined ? {} : { ms: args.ms }),
        // A duration on its own selects fixed-time waiting.
        ...(typeof variableId === "string" ? { variableId } : {}),
        ...(current?.kind === "wait" && current.variableId !== undefined && useFixedTime ? { variableId: undefined } : {}),
      };
    }
    case "label":
    case "gotoLabel": {
      const name = args.name as string;
      if (!name.trim()) throw new PrimitiveError("위치에 붙일 이름을 입력해 주세요.");
      return { name };
    }
    case "loop":
      return current ? {} : { body: [] };
    case "breakLoop":
      return {};
    case "callCommonEvent":
      requireReference(ctx.project.commonEvents, args.commonEventId as string, "공용 이벤트");
      return { commonEventId: args.commonEventId };
    case "callMapEvent":
      requireReference(map.events, args.eventId as string, "같은 맵의 이벤트");
      return { eventId: args.eventId };
    case "cutsceneControl": {
      const mode = args.mode ?? (current?.kind === "cutsceneControl" ? current.mode : "begin");
      if (mode === "end" && args.skippable === true) throw new PrimitiveError("건너뛰기 여부는 컷신을 시작하는 줄에서 정해 주세요.");
      return {
        ...(args.mode === undefined ? {} : { mode }),
        ...(mode === "end" ? { skippable: undefined } : args.skippable === undefined ? {} : { skippable: args.skippable }),
      };
    }
    case "script": {
      if (current?.kind === "script" && args.source === undefined) {
        return args.name === undefined ? {} : { name: (args.name as string).trim() || undefined };
      }
      const name = (args.name ?? (current?.kind === "script" ? current.name : undefined)) as string | undefined;
      const command = compileFlowScript(ctx.project, map.id, args.source as string, name);
      return { ...command, name: command.name, summary: command.summary };
    }
  }
}

function listsAt(commands: Command[], branchPath: readonly number[], allowNewBranch = false): Command[][] {
  const lists = [commands];
  let list = commands;
  for (let offset = 0; offset < branchPath.length; offset += 2) {
    const [row, branchIndex] = branchPath.slice(offset, offset + 2) as [number, number];
    const parent = list[row];
    let branch = resolveCommandListAtPath(list, [row, branchIndex]);
    if (!branch && parent && allowNewBranch && offset + 2 === branchPath.length) {
      // The resolver initializes optional fields on the parent. Probe a copy during validation and preview.
      branch = resolveCommandListAtPath([{ ...parent }], [0, branchIndex], { missingBranches: "create" });
    }
    if (!branch) throw new PrimitiveError("범위 밖입니다. 이 페이지에서 해당 분기를 찾을 수 없습니다.");
    list = branch;
    lists.push(list);
  }
  return lists;
}

function rowPosition(commands: Command[], args: Args, kind: FlowKind, operation: Operation) {
  const branchPath = (args.branchPath ?? []) as number[];
  if (branchPath.length % 2 || branchPath.some((part, offset) => !Number.isSafeInteger(part) || (offset % 2 === 0 && part < 0))) {
    throw new PrimitiveError("범위 밖입니다. 올바른 분기 위치를 골라 주세요.");
  }
  const lists = listsAt(commands, branchPath, operation === "insert");
  const list = lists.at(-1)!;
  const index = args.index as number;
  if (!Number.isSafeInteger(index) || index < 0 || index >= list.length + Number(operation === "insert")) {
    throw new PrimitiveError("명령 줄을 찾을 수 없습니다. 페이지에서 줄 위치를 다시 확인해 주세요.");
  }
  const current = operation === "update" ? list[index] : undefined;
  if (operation === "update" && current?.kind !== kind) {
    throw new PrimitiveError("범위 밖입니다. 이 종류의 명령 줄을 골라 주세요.");
  }
  return { branchPath, lists, index, current };
}

function editedPage(ctx: PrimitiveContext, args: Args, kind: FlowKind, operation: Operation, selected: ReturnType<typeof scopedPage>) {
  const { map, page } = selected;
  const { branchPath, lists, index, current } = rowPosition(page.commands, args, kind, operation);
  const patch = patchFields(kind, args, ctx, map, current);
  const path = [...branchPath, index];
  let next;
  try {
    next = operation === "update"
      ? updateEventCommand(page, path, patch, args.expectedHash as string)
      : insertEventCommand(page, path, { ...newCommand(kind), ...patch } as Command);
  } catch (error) {
    if (error instanceof EventCommandEditError && error.code === "invalid-command-edit") {
      throw new PrimitiveError("명령 줄의 위치와 내용을 확인해 주세요.");
    }
    throw error;
  }
  const command = listsAt(next.commands, branchPath).at(-1)![index]!;
  if (command.kind === "label") {
    const previousName = current?.kind === "label" ? current.name : undefined;
    for (const project of labelReferenceViews(ctx)) {
      validateLabelChange(project, project.maps[map.id]!, lists, index, command.name, previousName);
    }
  }
  return current && jsonEqual(current, command) ? page : next;
}

function shortName(name: string, fallback: string, readable = /[가-힣]/u): string {
  const text = displayText(name, fallback);
  if (!readable.test(text) || /[{}\[\]]/u.test(text)) return fallback;
  return text.length > 36 ? text.slice(0, 35) + "…" : text;
}

function describeChange(ctx: PrimitiveContext, map: GameMap, command: FlowCommand, operation: Operation): string {
  const { project } = ctx;
  const verb = operation === "insert" ? "추가합니다" : "수정합니다";
  switch (command.kind) {
    case "fork": {
      const condition = command.condition;
      if (condition.kind === "switch") {
        const name = shortName(referenceName(project.switches, condition.switchId), "");
        return `${name ? `‘${name}’ ` : ""}스위치가 ${condition.value ? "켜져" : "꺼져"} 있는지 확인하는 분기를 ${verb}.`;
      }
      if (condition.kind === "gold" || condition.kind === "timePhase") {
        return `${forkConditionSentence(condition)} 실행할 분기를 ${verb}.`;
      }
      return `조건에 따라 실행할 갈래를 ${verb}.`;
    }
    case "wait":
      if (command.variableId) {
        const name = shortName(referenceName(project.variables, command.variableId), "");
        return `${name ? `‘${name}’ 변수` : "지정한 변수"}에 저장된 시간만큼 기다리는 줄을 ${verb}.`;
      }
      return `${command.ms / 1000}초 동안 기다리는 줄을 ${verb}.`;
    case "label":
    case "gotoLabel": {
      const { target } = ctx;
      const words: readonly string[] = command.name.match(/[\p{L}\p{N}_-]+/gu) ?? [];
      const includesTargetId = target.kind === "event" && [target.mapId, target.eventId, target.pageId]
        .some(id => id && /^[a-z][\w-]*$/iu.test(id) && words.includes(id));
      const name = shortName(includesTargetId ? "" : command.name, "지정한 위치", /\p{L}/u);
      return command.kind === "label" ? `‘${name}’ 위치 표시를 ${verb}.` : `‘${name}’로 이동하는 줄을 ${verb}.`;
    }
    case "callCommonEvent": {
      const name = shortName(referenceName(project.commonEvents, command.commonEventId), "");
      return `${name ? `‘${name}’ ` : ""}공용 이벤트를 부르는 줄을 ${verb}.`;
    }
    case "callMapEvent": {
      const event = requireReference(map.events, command.eventId, "같은 맵의 이벤트");
      return `같은 맵의 ‘${shortName(eventName(event), "이벤트")}’를 부르는 줄을 ${verb}.`;
    }
    case "script":
      return `‘${shortName(command.name ?? "", "게임 스크립트")}’를 실행하는 줄을 ${verb}.`;
    case "cutsceneControl":
      if (command.mode === "end") return `컷신을 끝내는 줄을 ${verb}.`;
      return `${command.skippable ? "건너뛸 수 있는 " : ""}컷신을 시작하는 줄을 ${verb}.`;
    case "loop":
      return operation === "insert" ? "빈 반복 블록을 추가합니다." : "반복 블록을 그대로 유지합니다.";
    case "breakLoop":
      return operation === "insert" ? "반복을 끝내는 줄을 추가합니다." : "반복을 끝내는 줄을 그대로 유지합니다.";
  }
}

function primitive(kind: FlowKind, operation: Operation): SmallTaskPrimitive {
  const { title, properties, required = [] } = fields[kind];
  return {
    id: `cmd.${kind}.${operation}`,
    unit: UNIT,
    title: `${title} ${operation === "insert" ? "추가" : "수정"}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      properties: {
        ...position, ...properties,
        ...(operation === "update" ? { expectedHash: textField("get_event에서 includeCommandHashes를 켜고 읽은 해당 줄의 hash.") } : {}),
      },
      required: [
        "index",
        ...(operation === "update" ? ["expectedHash"] : []),
        ...(operation === "update" && kind === "script" ? [] : required),
      ],
      additionalProperties: false,
    },
    scope(ctx) {
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { map, page } = scopedPage(ctx);
      const { current } = rowPosition(page.commands, args, kind, operation);
      const base = current ?? newCommand(kind);
      // The script preview needs only its name. Compilation belongs to the write.
      const patch = kind === "script" ? { name: args.name ?? (base.kind === "script" ? base.name : undefined) }
        : patchFields(kind, args, ctx, map, current);
      return describeChange(ctx, map, { ...base, ...patch } as FlowCommand, operation);
    },
    apply(ctx, args) {
      const selected = scopedPage(ctx);
      const project = updateScopedPage(ctx, () => editedPage(ctx, args, kind, operation, selected));
      if (kind === "gotoLabel") {
        const { map, page } = scopedPage({ ...ctx, project });
        const lists = listsAt(page.commands, (args.branchPath ?? []) as number[]);
        const name = args.name as string;
        if (!lists.some(list => firstLabelIndex(list, name) >= 0) && !hasCallerLabel(project, map, lists, name)) {
          throw new PrimitiveError("이 줄에서 이동할 수 있는 위치 표시가 없습니다.");
        }
      }
      return project;
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(fields) as FlowKind[])
  .flatMap(kind => [primitive(kind, "insert"), primitive(kind, "update")]);
