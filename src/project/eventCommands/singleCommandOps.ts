import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { LOOP_BODY_BRANCH_INDEX, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { Command, EventPage } from "@/project/types";
import { contentFingerprint } from "@/util/fingerprint";
import { jsonEqual, structuralJson } from "@/util/structuralJson";

/** Root index or [command index, branch index, ..., index within the list]. All row indices start at zero. */
export type EventCommandIndex = number | readonly number[];

export class EventCommandEditError extends Error {
  constructor(message: string, readonly code: "invalid-command-edit" | "stale-event-command" | "event-command-branch" = "invalid-command-edit") {
    super(message);
  }
}

export function eventCommandHash(command: Command): string {
  return contentFingerprint(structuralJson(command));
}

function editTarget(page: EventPage, index: EventCommandIndex, insert = false) {
  const path = typeof index === "number" ? [index] : index;
  const row = path.at(-1);
  if (row === undefined || path.length % 2 !== 1 ||
    path.some((part, offset) => !Number.isSafeInteger(part) || (offset % 2 === 0 && part < 0))) {
    throw new EventCommandEditError("명령 줄 위치가 올바르지 않습니다.");
  }
  const commands = structuredClone(page.commands);
  const list = resolveCommandListAtPath(commands, path);
  if (!list || row >= list.length + Number(insert)) {
    throw new EventCommandEditError("명령 줄을 찾을 수 없습니다. 페이지를 다시 확인하세요.");
  }
  return { commands, list, row, inLoop: path.some((part, offset) => offset % 2 === 1 && part === LOOP_BODY_BRANCH_INDEX) };
}

function verifyHash(command: Command, expectedHash: string): void {
  if (eventCommandHash(command) !== expectedHash) {
    throw new EventCommandEditError("그 줄의 내용이 바뀌었습니다. 다시 읽은 뒤 수정하세요.", "stale-event-command");
  }
}

function validateInsertedFields(command: Command, inLoop: boolean, includeChildren = true): void {
  if (command.kind === "breakLoop" && !inLoop) {
    throw new EventCommandEditError("반복 탈출은 반복 안에만 넣을 수 있습니다.", "event-command-branch");
  }
  if (command.kind === "text" && (typeof command.body !== "string" || (command.speaker !== undefined && typeof command.speaker !== "string"))) {
    throw new EventCommandEditError("대사에는 문구가 필요합니다. 화자도 글자로 입력하세요.");
  }
  if (command.kind === "wait" && (!Number.isFinite(command.ms) || command.ms < 0)) {
    throw new EventCommandEditError("대기 시간은 0 이상의 숫자로 입력하세요.");
  }
  if (command.kind === "label" || command.kind === "gotoLabel") {
    if (typeof command.name !== "string" || !command.name.trim()) throw new EventCommandEditError("라벨 이름을 입력하세요.");
  }
  if (command.kind === "choices") {
    const cancelChoice = Number(command.cancelBehavior?.match(/^choice(\d)$/u)?.[1]);
    if (cancelChoice > command.options.length) throw new EventCommandEditError("취소했을 때 실행할 선택지가 없습니다.", "event-command-branch");
  }
  if (!includeChildren) return;
  for (const branch of nestedCommandLists(command)) {
    for (const child of branch) validateInsertedFields(child, inLoop || command.kind === "loop");
  }
}

function validateCommand(command: Command): void {
  try {
    validateCommandArray("명령", [command]);
  } catch (error) {
    throw new EventCommandEditError(error instanceof Error ? error.message : "명령 형식이 올바르지 않습니다.");
  }
}

function commandBranches(command: Command) {
  // The path resolver distinguishes an optional branch's missing list from a stored empty list.
  return eventCommandBranches(command).map(({ branchIndex }) => ({
    branchIndex,
    commands: resolveCommandListAtPath([command], [0, branchIndex, 0]),
  }));
}

export function insertEventCommand(page: EventPage, index: EventCommandIndex, command: Command): EventPage {
  const { commands, list, row, inLoop } = editTarget(page, index, true);
  validateCommand(command);
  validateInsertedFields(command, inLoop);
  list.splice(row, 0, structuredClone(command));
  return { ...page, commands };
}

/** Patch the fields of one command. Branch contents belong to their own editable rows. */
export function updateEventCommand(page: EventPage, index: EventCommandIndex, patch: Readonly<Record<string, unknown>>, expectedHash: string): EventPage {
  const { commands, list, row, inLoop } = editTarget(page, index);
  const current = list[row]!;
  verifyHash(current, expectedHash);
  const { optionLabels, ...fields } = structuredClone(patch);
  let next = { ...current, ...fields } as Command;
  if (next.kind !== current.kind) throw new EventCommandEditError("한 줄을 고칠 때 명령 종류는 바꿀 수 없습니다.");
  if (optionLabels !== undefined) {
    if (current.kind !== "choices" || next.kind !== "choices" || Object.hasOwn(fields, "options") ||
      !Array.isArray(optionLabels) || optionLabels.length !== current.options.length || optionLabels.some(label => typeof label !== "string")) {
      throw new EventCommandEditError("선택지 문구는 현재 선택지 수만큼 글자로 입력하세요.");
    }
    next = { ...next, options: current.options.map((option, i) => ({ ...option, text: optionLabels[i] as string })) };
  }
  validateCommand(next);
  if (!jsonEqual(commandBranches(current), commandBranches(next))) {
    throw new EventCommandEditError("분기 안의 명령은 해당 줄을 골라 따로 고쳐야 합니다.", "event-command-branch");
  }
  // Existing child commands are untouched. Validate only the updated command's own fields.
  validateInsertedFields(next, inLoop, false);
  list[row] = next;
  return { ...page, commands };
}

export function deleteEventCommand(page: EventPage, index: EventCommandIndex, expectedHash: string): EventPage {
  const { commands, list, row } = editTarget(page, index);
  const current = list[row]!;
  verifyHash(current, expectedHash);
  if (nestedCommandLists(current).some(branch => branch.length > 0)) {
    throw new EventCommandEditError("분기 안에 명령이 남아 있어 이 줄을 지울 수 없습니다.", "event-command-branch");
  }
  list.splice(row, 1);
  return { ...page, commands };
}
