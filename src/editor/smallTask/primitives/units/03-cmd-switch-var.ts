import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { newCommand } from "@/editor/eventCommandFactory";
import { shortRecordName } from "@/editor/shortRecordName";
import type { JsonSchema } from "@/editor/tools/types";
import { eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { Command, Project, SwitchDef, VariableDef } from "@/project/types";
import { roJosa, withJosa } from "@/util/josa";
import { displayText } from "../../target";
import { commandListAt, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "03-cmd-switch-var";

type Args = Record<string, unknown>;
type StateKind = "setSwitch" | "setVariable" | "setSelfSwitch" | "setFlag";
type StateCommand = Extract<Command, { kind: StateKind }>;
type VariableCommand = Extract<StateCommand, { kind: "setVariable" }>;
type PageScope = Extract<SmallTaskScope, { kind: "eventPage" }>;

const variableActions = {
  "=": (name: string, value: string) => `${name}에 ${withJosa(value, "을/를")} 저장합니다.`,
  "+=": (name: string, value: string) => `${name} 값에 ${withJosa(value, "을/를")} 더합니다.`,
  "-=": (name: string, value: string) => `${name} 값에서 ${withJosa(value, "을/를")} 뺍니다.`,
  "*=": (name: string, value: string) => `${name} 값에 ${withJosa(value, "을/를")} 곱합니다.`,
  "/=": (name: string, value: string) => `${name} 값을 ${value}${roJosa(value)} 나눕니다.`,
} satisfies Record<VariableCommand["op"], (name: string, value: string) => string>;

const recordField = (label: string): JsonSchema => ({
  type: "string", minLength: 1, description: `자료집에 있는 ${label}의 정확한 이름 또는 식별자.`,
});
const booleanValue: JsonSchema = { type: "boolean", description: "켜기는 참, 끄기는 거짓." };
const sourceField: JsonSchema = {
  ...recordField("원본 변수"),
  description: "사용할 값을 읽을 변수의 정확한 이름 또는 식별자. 고정값과 함께 지정할 수 없습니다.",
};
const fields = {
  setSwitch: {
    switchId: recordField("스위치"),
    value: {
      type: ["boolean", "string"],
      oneOf: [booleanValue, { type: "string", enum: ["toggle"], description: "현재 상태를 반전합니다." }],
      description: "켜기는 참, 끄기는 거짓, 반전은 문자열 toggle. 삽입할 때 기본은 켜기.",
    },
    operandVariableId: sourceField,
  },
  setVariable: {
    variableId: recordField("변수"),
    op: { type: "string", enum: Object.keys(variableActions), description: "대입, 더하기, 빼기, 곱하기, 나누기의 연산 기호. 기본은 대입." },
    value: { type: "number", description: "계산에 쓸 숫자. 삽입할 때 기본은 0." },
    operandVariableId: sourceField,
  },
  setSelfSwitch: {
    key: { type: "string", enum: ["A", "B", "C", "D"], description: "이 이벤트의 셀프 스위치 문자. 삽입할 때 기본은 A." },
    value: booleanValue,
  },
  setFlag: {
    flag: { type: "string", minLength: 1, description: "옛 기억 명령에 기록할 이름. 생략하면 기존 이름 유지." },
    value: booleanValue,
  },
} satisfies Record<StateKind, Record<string, JsonSchema>>;

function pageScope(ctx: PrimitiveContext): PageScope {
  const { map, event, page } = scopedPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
}

function recordId(records: readonly (SwitchDef | VariableDef)[], input: string, label: string): string {
  if (records.some(record => record.id === input)) return input;
  const name = input.trim();
  if (!name) throw new PrimitiveError(`${label} 이름을 입력하세요.`);
  const matches = records.filter(record => record.name.trim() === name);
  if (matches.length === 1) return matches[0]!.id;
  if (matches.length > 1) throw new PrimitiveError(`같은 이름의 ${label} 항목이 여럿 있습니다. 자료집에서 대상을 확인하세요.`);
  throw new PrimitiveError(`범위 밖입니다. 등록된 ${label} 항목이 없어서 이 페이지에서 새로 만들 수 없습니다.`);
}

function commandFromArgs(project: Project, current: StateCommand, args: Args): StateCommand {
  const { value, operandVariableId } = args;
  if (value !== undefined && operandVariableId !== undefined) {
    throw new PrimitiveError("숫자나 상태를 직접 지정하거나 원본 변수를 하나만 골라 주세요.");
  }
  const operand = operandVariableId === undefined ? undefined : {
    kind: "var" as const,
    id: recordId(project.variables, operandVariableId as string, "변수"),
  };
  switch (current.kind) {
    case "setSwitch":
      return {
        ...current,
        switchId: args.switchId === undefined ? current.switchId : recordId(project.switches, args.switchId as string, "스위치"),
        value: operand ?? (value as boolean | "toggle" | undefined) ?? current.value,
      };
    case "setVariable":
      return {
        ...current,
        variableId: args.variableId === undefined ? current.variableId : recordId(project.variables, args.variableId as string, "변수"),
        op: (args.op as VariableCommand["op"] | undefined) ?? current.op,
        value: operand ?? (value as number | undefined) ?? current.value,
      };
    case "setSelfSwitch":
      return { ...current, key: (args.key as typeof current.key | undefined) ?? current.key, value: (value as boolean | undefined) ?? current.value };
    case "setFlag": {
      const flag = (args.flag as string | undefined) ?? current.flag;
      if (!flag.trim()) throw new PrimitiveError("기억 이름을 입력하세요.");
      if (typeof (value ?? current.value) !== "boolean") throw new PrimitiveError("기억을 켤지 끌지 지정하세요.");
      return { ...current, flag, value: (value as boolean | undefined) ?? current.value };
    }
  }
}

const unusedIds = new Set<string>();

function validateCommand(project: Project, command: StateCommand): void {
  try {
    validateCommandArray("명령", [command]);
  } catch {
    throw new PrimitiveError("명령에 넣을 값의 형식을 확인하세요.");
  }
  if (command.kind !== "setSwitch" && command.kind !== "setVariable") return;
  if (command.kind === "setVariable" && (
    !Object.hasOwn(variableActions, command.op) || (typeof command.value === "number" && !Number.isFinite(command.value))
  )) {
    throw new PrimitiveError("변수의 계산 방법과 숫자를 확인하세요.");
  }
  // 이 두 명령의 참조 검증은 스위치와 변수만 읽는다.
  const context: ReferenceContext = {
    switchIds: new Set(project.switches.map(record => record.id)),
    variableIds: new Set(project.variables.map(record => record.id)),
    actorIds: unusedIds, classIds: unusedIds, enemyIds: unusedIds, itemIds: unusedIds, equipmentIds: unusedIds,
    skillIds: unusedIds, animationIds: unusedIds, commonEventIds: unusedIds, endingIds: unusedIds,
    mapIds: unusedIds, troopIds: unusedIds, speciesIds: unusedIds, resourceIds: unusedIds,
  };
  try {
    validateCommands([command], context);
  } catch {
    throw new PrimitiveError("명령에서 참조하는 스위치나 변수를 자료집에서 찾을 수 없습니다.");
  }
}

function displayName(records: readonly (SwitchDef | VariableDef)[], id: string, label: string): string {
  const name = records.find(record => record.id === id)?.name ?? "";
  const safe = displayText(name === id ? "" : shortRecordName(name).replace(/[{}\[\]]/gu, ""), label);
  return safe.length > 22 ? `${safe.slice(0, 21)}…` : safe;
}

function describeCommand(project: Project, command: StateCommand, current: StateCommand): string {
  const onOff = (value: boolean) => value ? "켭니다." : "끕니다.";
  const variable = (id: string) => displayName(project.variables, id, "변수");
  switch (command.kind) {
    case "setSwitch": {
      const name = displayName(project.switches, command.switchId, "스위치");
      if (typeof command.value === "object") {
        return `『${variable(command.value.id)}』 값에 따라 『${name}』 스위치를 켜거나 끕니다.`;
      }
      return `『${name}』 스위치를 ${command.value === "toggle" ? "반전합니다." : onOff(command.value)}`;
    }
    case "setVariable": {
      const value = typeof command.value === "number" ? String(command.value) : `『${variable(command.value.id)}』 값`;
      return variableActions[command.op](`『${variable(command.variableId)}』 변수`, value);
    }
    case "setSelfSwitch":
      return `이 이벤트의 셀프 스위치 ${command.key}를 ${onOff(command.value)}`;
    case "setFlag": {
      if (current.kind === "setFlag" && current.flag !== command.flag) {
        return `이전 방식의 기억 이름을 ${current.value === command.value ? "바꿉니다." : `바꾸고 ${onOff(command.value)}`}`;
      }
      return `이전 방식의 기억을 ${onOff(command.value)}`;
    }
  }
}

function prepareCommand(ctx: PrimitiveContext, args: Args, kind: StateKind, update: boolean) {
  const { page } = scopedPage(ctx);
  const branchPath = (args.branchPath as number[] | undefined) ?? [];
  const list = commandListAt(page, branchPath);
  const index = (args.index as number | undefined) ?? list.length;
  if (!Number.isSafeInteger(index) || index < 0 || index > list.length) {
    throw new PrimitiveError("명령 줄을 찾을 수 없습니다. 페이지를 다시 확인하세요.");
  }
  const current = update ? list[index] : newCommand(kind);
  if (current?.kind !== kind) throw new PrimitiveError("선택한 줄에서 같은 종류의 명령을 찾을 수 없습니다.");
  if (update && args.expectedHash !== undefined && args.expectedHash !== eventCommandHash(current)) {
    throw new PrimitiveError("그 줄의 내용이 바뀌었습니다. 다시 읽은 뒤 수정하세요.");
  }
  const command = commandFromArgs(ctx.project, current, args);
  validateCommand(ctx.project, command);
  return { path: [...branchPath, index], current, command };
}

function primitive(kind: StateKind, name: string, update: boolean): SmallTaskPrimitive {
  const required = update ? ["index"] : kind === "setSwitch" ? ["switchId"] : kind === "setVariable" ? ["variableId"] : [];
  return {
    id: `cmd.${kind}.${update ? "update" : "insert"}`,
    unit: UNIT,
    title: `${name} ${update ? "수정" : "추가"}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      additionalProperties: false,
      required,
      properties: {
        index: { type: "integer", minimum: 0, description: "목록에서 첫 줄은 0. 추가할 때 생략하면 맨 끝에 넣습니다." },
        branchPath: {
          type: "array", items: { type: "integer" },
          description: "분기 안의 명령이면 이벤트 조회에서 읽은 분기 경로. 바깥 목록이면 생략합니다.",
        },
        ...(update ? { expectedHash: { type: "string", minLength: 1, description: "편집하기 전에 이 줄에서 읽은 확인값." } } : {}),
        ...fields[kind],
      },
    },
    scope: pageScope,
    describe(ctx, args) {
      const { command, current } = prepareCommand(ctx, args, kind, update);
      return describeCommand(ctx.project, command, current);
    },
    apply(ctx, args) {
      const { path, current, command } = prepareCommand(ctx, args, kind, update);
      return updateScopedPage(ctx, page => update
          ? updateEventCommand(page, path, command, eventCommandHash(current))
          : insertEventCommand(page, path, command));
    },
  };
}

const switchInsert = primitive("setSwitch", "스위치 조작", false);

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  switchInsert,
  primitive("setSwitch", "스위치 조작", true),
  primitive("setVariable", "변수 조작", false),
  primitive("setVariable", "변수 조작", true),
  primitive("setSelfSwitch", "셀프 스위치", false),
  primitive("setSelfSwitch", "셀프 스위치", true),
  // 새 기억은 기존 자료집 스위치를 사용한다. 저장된 옛 기억은 그 종류를 유지하며 고친다.
  { ...switchInsert, id: "cmd.setFlag.insert", aliasOf: switchInsert.id, covers: {}, hidden: true },
  primitive("setFlag", "이전 방식의 기억", true),
];
