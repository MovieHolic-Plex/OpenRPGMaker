import {
  deleteEventCommand, EventCommandEditError, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { eventDisplayName } from "@/project/eventDisplayName";
import { COMMAND_SCHEMA_COMPACT, CONDITION_SCHEMA } from "./schemaShapes";
import { eventCommandAssistTarget } from "./eventCommandAssistTool";
import { ToolError, type JsonSchema, type ToolDefinition } from "./types";
import type { Command, EventPage } from "@/project/types";
import type { EventCommandIndex } from "@/project/eventCommands/singleCommandOps";

const targetProperties: Record<string, JsonSchema> = {
  mapId: { type: "string", minLength: 1 },
  eventId: { type: "string", minLength: 1 },
  pageId: { type: "string", minLength: 1 },
  index: { type: "integer", minimum: 0, description: "목록 안의 줄 번호. 첫 줄은 0." },
  branchPath: { type: "array", items: { type: "integer" }, description: "분기 안이면 get_event에서 받은 branchPath. 바깥 목록이면 생략." },
};
const requiredTarget = ["mapId", "eventId", "pageId", "index"] as const;
const expectedHash: JsonSchema = { type: "string", minLength: 1, description: "get_event({...,includeCommandHashes:true})에서 읽은 해당 줄의 hash." };

const commandFields = COMMAND_SCHEMA_COMPACT.properties!;
const branchSchema: JsonSchema = { type: "array", items: commandFields.cancelBranch?.items };
const insertSchema: JsonSchema = {
  ...COMMAND_SCHEMA_COMPACT,
  description: "삽입할 이벤트 명령. 대사는 {kind:'text',body:'문구'}로 입력한다.",
  properties: {
    ...commandFields,
    body: { description: "대사(text)의 문구 또는 반복(loop)의 명령 목록." },
    amount: { description: "수량 또는 변수 피연산자." },
    name: { type: "string", description: "라벨 이름." },
    condition: CONDITION_SCHEMA,
    then: branchSchema,
    else: branchSchema,
  },
};
const patchSchema: JsonSchema = {
  type: "object",
  properties: {
    body: { type: "string" },
    optionLabels: { type: "array", items: { type: "string" } },
    speaker: commandFields.speaker!,
    ms: commandFields.ms!,
    value: commandFields.value!,
  },
  additionalProperties: true,
};

function commandTool(
  name: string, description: string, operation: string, fields: Record<string, JsonSchema>,
  edit: (page: EventPage, index: EventCommandIndex, args: Record<string, unknown>) => EventPage,
): ToolDefinition {
  return {
    name,
    description,
    mode: "write",
    parameters: {
      type: "object",
      properties: { ...targetProperties, ...fields },
      required: [...requiredTarget, ...Object.keys(fields)],
      additionalProperties: false,
    },
    run(draft, args) {
      const { event, page } = eventCommandAssistTarget(draft, args);
      const index = args.index as number;
      const path = [...(args.branchPath as number[] | undefined ?? []), index];
      try {
        page.commands = edit(page, path, args).commands;
      } catch (error) {
        if (error instanceof EventCommandEditError) throw new ToolError(error.message, { code: error.code });
        throw error;
      }
      return { summary: `『${eventDisplayName(event)}』 이벤트의 ${index + 1}번째 명령을 ${operation}했습니다.` };
    },
  };
}

export const SINGLE_EVENT_COMMAND_TOOLS: readonly ToolDefinition[] = [
  commandTool(
    "insert_event_command",
    "기존 이벤트 페이지에 명령 한 줄을 끼워 넣는다. get_event로 위치를 확인한다. 마지막에 추가할 때는 목록 길이를 index로 준다.",
    "추가", { command: insertSchema },
    (page, index, args) => insertEventCommand(page, index, args.command as Command),
  ),
  commandTool(
    "update_event_command",
    "기존 이벤트 페이지의 명령 한 줄에서 patch에 지정한 필드만 고친다. get_event의 includeCommandHashes로 줄의 위치와 해시를 읽는다. 선택지 문구만 바꿀 때는 patch.optionLabels에 기존 순서대로 문구를 넣는다.",
    "수정", { patch: patchSchema, expectedHash },
    (page, index, args) => updateEventCommand(page, index, args.patch as Record<string, unknown>, args.expectedHash as string),
  ),
  commandTool(
    "delete_event_command",
    "기존 이벤트 페이지의 명령 한 줄을 지운다. get_event의 includeCommandHashes로 줄의 위치와 해시를 읽는다. 분기 안에 명령이 남아 있으면 지울 수 없다.",
    "삭제", { expectedHash },
    (page, index, args) => deleteEventCommand(page, index, args.expectedHash as string),
  ),
];
