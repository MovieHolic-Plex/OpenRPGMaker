import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { newCommand } from "@/editor/eventCommandFactory";
import type { JsonSchema } from "@/editor/tools/types";
import { cancelChoiceIndex } from "@/project/choiceCancellation";
import { MAX_SHOWN_CHOICES } from "@/project/choiceView";
import { EventCommandEditError, eventCommandHash, eventCommandListHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { ProjectFormatError } from "@/project/io/errors";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { Command, EventPage, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import {
  dialogueDetail, dialogueFields, validateDialogueReferences, type DialogueCommand, type DialogueKind,
} from "./01-cmd-dialogue/fields";

export const UNIT = "01-cmd-dialogue";
type Args = Record<string, unknown>;
type Action = "insert" | "update";
type Choices = Extract<DialogueCommand, { kind: "choices" }>;

const indexField: JsonSchema = { type: "integer", minimum: 0, description: "명령 목록 안의 위치. 첫 줄은 0입니다." };
const branchPathField: JsonSchema = {
  type: "array", items: { type: "integer" },
  description: "분기 안이면 읽어 온 분기 경로를 넣습니다. 가장 바깥 목록이면 생략합니다.",
};
const expectedHashField: JsonSchema = {
  type: "string", minLength: 1,
  description: "get_event의 commandHashTarget에서 받은 expectedHash 또는 includeCommandHashes에서 읽은 줄 해시.",
};
const expectedPageHashField: JsonSchema = {
  type: "string", minLength: 1,
  description: "get_event의 commandHashTarget에서 받은 expectedPageHash. 수정하거나 삽입 위치를 지정할 때 이 값 또는 expectedPageHashes가 필요합니다.",
};
const expectedPageHashesField: JsonSchema = {
  type: "array", items: { type: "string", minLength: 1 },
  description: "expectedPageHash 대신 사용할 수 있는 목록. get_event의 includeCommandHashes에서 읽은 최상위 줄(branchPath가 빈 줄) 해시를 순서대로 넣습니다.",
};

function commandLocation(page: EventPage, action: Action, args: Args) {
  const branchPath = args.branchPath as number[] | undefined ?? [];
  const row = args.index as number | undefined;
  const missingBranch = () => new PrimitiveError("범위 밖: 선택한 페이지에서 명령 분기를 찾을 수 없습니다.");
  if (branchPath.length % 2 !== 0) throw missingBranch();
  let list: readonly Command[] = page.commands;
  for (let depth = 0; depth < branchPath.length; depth += 2) {
    const parentIndex = branchPath[depth]!;
    if (!Number.isSafeInteger(parentIndex) || parentIndex < 0) throw missingBranch();
    const parent = list[parentIndex];
    const branch = parent && eventCommandBranches(parent).find(entry => entry.branchIndex === branchPath[depth + 1]);
    if (!branch) throw missingBranch();
    list = branch.commands;
  }
  const index = row ?? list.length;
  if (!Number.isSafeInteger(index) || index < 0 || index >= list.length + Number(action === "insert")) {
    throw new PrimitiveError("범위 밖: 선택한 페이지에서 명령 줄을 찾을 수 없습니다.");
  }
  return { path: [...branchPath, index], current: list[index], index };
}

function verifyCommandEdit(
  before: readonly Command[], after: readonly Command[], path: readonly number[], action: Action, command: Command,
): void {
  const outsideRow = () => new PrimitiveError("범위 밖: 다른 명령이나 분기도 함께 바뀌어 적용할 수 없습니다.");
  for (let depth = 0; depth < path.length - 1; depth += 2) {
    const row = path[depth]!;
    const branch = path[depth + 1]!;
    const beforeBranches = eventCommandBranches(before[row]!);
    const afterBranches = eventCommandBranches(after[row]!);
    const beforeList = beforeBranches.find(entry => entry.branchIndex === branch)?.commands;
    const afterList = afterBranches.find(entry => entry.branchIndex === branch)?.commands;
    // 복제 뒤에도 여러 분기가 같은 배열을 공유할 수 있다.
    if (!beforeList || !afterList || before.length !== after.length || beforeBranches.length !== afterBranches.length ||
        !before.every((entry, index) => index === row || jsonEqual(entry, after[index])) ||
        beforeBranches.some(entry => entry.branchIndex !== branch &&
          !jsonEqual(entry.commands, afterBranches.find(candidate => candidate.branchIndex === entry.branchIndex)?.commands))) {
      throw outsideRow();
    }
    before = beforeList;
    after = afterList;
  }
  const expected = before.slice();
  expected.splice(path.at(-1)!, action === "insert" ? 0 : 1, command);
  if (!jsonEqual(expected, after)) throw outsideRow();
}

function editChoices(
  base: Choices, labels: string[] | undefined, appended: string | undefined, action: Action, fields: Args,
): Choices {
  if (labels?.some(label => !label.trim()) || (appended !== undefined && !appended.trim())) {
    throw new PrimitiveError("선택지 문구를 입력해 주세요.");
  }
  if (action === "update" && labels && labels.length !== base.options.length) {
    throw new PrimitiveError("기존 선택지 수에 맞춰 문구를 입력해 주세요.");
  }
  if (appended && base.options.length >= MAX_SHOWN_CHOICES) {
    throw new PrimitiveError("선택지는 다섯 개까지만 표시할 수 있습니다.");
  }

  const options = labels === undefined ? [...base.options] : labels.map((text, index) => ({
    ...(action === "insert" ? { branch: [] } : base.options[index]!), text,
  }));
  if (appended !== undefined) options.push({ text: appended, branch: [] });

  const next = { ...base, ...fields, options };
  if (action === "insert" && fields.cancelBehavior === undefined && options.length === 1) {
    next.cancelBehavior = "disallow";
  }
  if (action === "insert" || fields.cancelBehavior !== undefined || appended !== undefined) {
    const cancelIndex = cancelChoiceIndex(next.cancelBehavior, MAX_SHOWN_CHOICES);
    if (cancelIndex !== null && cancelIndex >= options.length) {
      throw new PrimitiveError("취소했을 때 고를 선택지가 없습니다.");
    }
  }
  if (fields.cancelBehavior === "branch" && next.cancelBranch === undefined) next.cancelBranch = [];
  return next;
}

function commandFields(kind: DialogueKind, action: Action): Record<string, JsonSchema> {
  const fields: Record<string, JsonSchema> = { ...dialogueFields[kind].fields };
  if (kind === "choices") {
    if (action === "insert") fields.optionLabels = { ...dialogueFields.choices.fields.optionLabels, maxItems: MAX_SHOWN_CHOICES };
    else fields.appendOption = dialogueFields.choices.appendOption;
  }
  if (kind === "presentItem" && action === "insert") fields.correctItemIds = dialogueFields.presentItem.correctItemIds;
  return fields;
}

function nextCommand(
  project: Readonly<Project>, base: DialogueCommand, action: Action, fields: Args,
): { command: DialogueCommand; patch: Args } {
  const patch = { ...fields };
  switch (base.kind) {
    case "text":
      if (typeof patch.body === "string" && !patch.body.trim()) throw new PrimitiveError("대사 문구를 입력해 주세요.");
      break;
    case "choices": {
      const { optionLabels, appendOption, ...settings } = patch;
      const command = editChoices(base, optionLabels as string[] | undefined, appendOption as string | undefined, action, settings);
      return { command, patch: { ...settings, options: command.options } };
    }
    case "presentItem": {
      if (Array.isArray(patch.itemIds) && patch.itemIds.length === 0) patch.itemIds = undefined;
      const { correctItemIds, ...settings } = patch;
      const options = correctItemIds === undefined ? base.options
        : [...new Set(correctItemIds as string[])].map(itemId => ({ itemId, branch: [] }));
      const command = { ...base, ...settings, options };
      const itemIds = settings.itemIds;
      if (Array.isArray(itemIds) && options.some(option => !itemIds.includes(option.itemId))) {
        throw new PrimitiveError("정답 아이템은 제시할 목록에도 넣어 주세요.");
      }
      return { command, patch: settings };
    }
    case "changeFace":
      if (patch.appearanceId !== undefined) {
        if (patch.resourceId) throw new PrimitiveError("얼굴 그림과 인물 외형 중 하나만 골라 주세요.");
        patch.resourceId = "";
      } else if (Object.hasOwn(patch, "resourceId") && base.appearanceId !== undefined) {
        patch.appearanceId = undefined;
      }
      break;
    case "enterHeroName":
      if (typeof patch.actorId === "string" && patch.actorId && !patch.actorId.trim()) {
        throw new PrimitiveError("이름을 바꿀 배우를 자료집에서 골라 주세요.");
      }
      if (action === "insert" && patch.actorId === undefined && !patch.stringVariableId) {
        patch.actorId = project.session.partyActorIds[0] ?? project.database.actors[0]?.id ?? "";
      }
      if (action === "update" && patch.actorId && patch.stringVariableId === undefined && base.stringVariableId) {
        patch.stringVariableId = undefined;
      }
      break;
  }
  return { command: { ...base, ...patch }, patch };
}

function editPrimitive(kind: DialogueKind, action: Action): SmallTaskPrimitive {
  const { title, insertRequires } = dialogueFields[kind];
  const fields = commandFields(kind, action);
  const inserting = action === "insert";
  const verb = inserting ? "추가" : "수정";

  function prepare(ctx: PrimitiveContext, args: Args) {
    const { page } = scopedPage(ctx);
    const { expectedPageHash, expectedPageHashes } = args;
    // 페이지와 최상위 줄 해시는 하위 분기를 포함한다.
    if ((expectedPageHash !== undefined && eventCommandListHash(page.commands) !== expectedPageHash) ||
        (expectedPageHashes !== undefined && !jsonEqual(page.commands.map(eventCommandHash), expectedPageHashes))) {
      throw new PrimitiveError(STALE_COMMAND_LIST);
    }
    const { path, current, index } = commandLocation(page, action, args);
    if (!inserting && current?.kind !== kind) {
      throw new PrimitiveError("범위 밖: 이 줄에서 해당 명령을 찾을 수 없습니다.");
    }
    const expectedHash = args.expectedHash as string;
    if (!inserting && eventCommandHash(current!) !== expectedHash) {
      throw new PrimitiveError(STALE_COMMAND_LIST);
    }
    const positioned = !inserting || args.index !== undefined || path.length > 1;
    if (positioned && expectedPageHash === undefined && expectedPageHashes === undefined) {
      throw new PrimitiveError("명령 위치를 확인할 수 없습니다. 페이지 명령 해시를 읽어 주세요.");
    }
    const edits = Object.fromEntries(Object.keys(fields).filter(key => Object.hasOwn(args, key)).map(key => [key, args[key]]));
    if (!inserting && Object.keys(edits).length === 0) throw new PrimitiveError("바꿀 값을 하나 이상 입력해 주세요.");
    const base = (inserting ? newCommand(kind) : current) as DialogueCommand;
    const { command, patch } = nextCommand(ctx.project, base, action, edits);
    return { page, path, index, command, patch };
  }

  return {
    id: `cmd.${kind}.${action}`,
    unit: UNIT,
    title: `${title} ${verb}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      properties: {
        index: inserting ? { ...indexField, description: "끼워 넣을 위치. 첫 줄은 0이며, 생략하면 끝에 추가합니다." } : indexField,
        branchPath: branchPathField,
        ...(inserting ? {} : { expectedHash: expectedHashField }),
        expectedPageHash: expectedPageHashField,
        expectedPageHashes: expectedPageHashesField,
        ...fields,
      },
      required: inserting ? insertRequires : ["index", "expectedHash"],
      additionalProperties: false,
    },
    scope(ctx) {
      // 공용 검사는 페이지를 고정하고 verifyCommandEdit는 그 안에서 명령 한 줄만 바뀌었는지 확인한다.
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { command } = prepare(ctx, args);
      const detail = dialogueDetail(ctx.project, command).replace(/[.!?。！？]+/gu, " ").replace(/\s+/gu, " ").trim();
      const ending = `」 명령을 ${verb}합니다.`;
      const room = 79 - ending.length;
      return `「${detail.length <= room ? detail : detail.slice(0, room - 1).trimEnd() + "…"}${ending}`;
    },
    apply(ctx, args) {
      const { page, path, index, command, patch } = prepare(ctx, args);
      validateDialogueReferences(ctx.project, command, patch);
      let nextPage: EventPage;
      try {
        if (inserting) {
          nextPage = insertEventCommand(page, path, command);
        } else if (command.kind === "choices") {
          // 기존 분기 안의 명령은 이 편집의 검증 대상이 아니다. 새 분기는 비어 있다.
          validateCommandArray("선택지", [{
            ...command,
            options: command.options.map(option => ({ ...option, branch: [] })),
            ...(command.cancelBranch !== undefined ? { cancelBranch: [] } : {}),
          }]);
          const commands = structuredClone(page.commands);
          resolveCommandListAtPath(commands, path)![index] = structuredClone(command);
          nextPage = { ...page, commands };
        } else {
          nextPage = updateEventCommand(page, path, patch, args.expectedHash as string);
        }
      } catch (error) {
        if (error instanceof EventCommandEditError || error instanceof ProjectFormatError) {
          throw new PrimitiveError("명령 값이나 분기 위치를 다시 확인해 주세요.");
        }
        throw error;
      }

      verifyCommandEdit(page.commands, nextPage.commands, path, action, command);
      return updateScopedPage(ctx, () => nextPage);
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(dialogueFields) as DialogueKind[])
  .flatMap(kind => [editPrimitive(kind, "insert"), editPrimitive(kind, "update")]);
