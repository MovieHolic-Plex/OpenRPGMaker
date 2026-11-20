import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { compareControlCodes } from "@/editor/dialogue/dialogueText";
import { normalizeEditedDialogueText, DIALOGUE_TEXT_LIMIT } from "@/editor/dialogue/dialogueEdits";
import { dialogueTextHash, parseDialogueLineId } from "@/editor/dialogue/dialogueIndex";
import { newCommand } from "@/editor/eventCommandFactory";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { displayText, mapTarget } from "@/editor/smallTask/target";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import type { JsonSchema } from "@/editor/tools/types";
import { objectiveTextOnMap } from "@/player/objectiveTarget";
import { affectionVariableOwners } from "@/project/affectionVariables";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { eventCommandHash, eventCommandListHash } from "@/project/eventCommands/singleCommandOps";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { projectWithEventRevision } from "@/project/projectClone";
import { findSchedule } from "@/project/schedule";
import { scriptCalls, scriptHasDynamic } from "@/project/script/effects";
import { isNonActorSpeaker, speakerNameScore } from "@/project/staging/dialogueActors";
import type { Command, EventPage, GameEvent, Project, SelfSwitchKey } from "@/project/types";
import { scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "26-npc-dialogue";
type Args = Record<string, unknown>;
type TextCommand = Extract<Command, { kind: "text" }>;
type PageScope = Extract<SmallTaskScope, { kind: "dialogue" | "eventPage" }>;

const path: JsonSchema = {
  type: "array", minItems: 1, items: { type: "integer" },
  description: "이벤트 읽기에서 확인한 명령 위치입니다. 첫 명령은 [0]이고, 분기 안에서는 분기 위치 뒤에 명령 번호를 붙입니다.",
};
const hash: JsonSchema = {
  type: "string", description: "이벤트 읽기의 명령 확인값 또는 대사 목록의 원문 확인값입니다. 읽은 뒤 바뀐 줄은 거절합니다.",
};
const text: JsonSchema = {
  type: "string", minLength: 1, maxLength: DIALOGUE_TEXT_LIMIT, description: "저장할 새 문구입니다.",
};
const name: JsonSchema = { type: "string", description: "저장할 새 이름입니다." };

function schema(properties: Record<string, JsonSchema>, required: readonly string[]): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

function locateEvent({ project, target }: PrimitiveContext) {
  if (target.kind !== "event") throw new PrimitiveError("범위 밖: 편집할 이벤트를 고르세요.");
  const map = project.maps[target.mapId];
  const matches = map?.events.filter(entry => entry.id === target.eventId);
  const event = matches?.[0];
  if (!map || map.id !== target.mapId || !event || matches?.length !== 1 ||
    event.x !== target.x || event.y !== target.y || !Number.isInteger(event.x) || !Number.isInteger(event.y) ||
    event.x < 0 || event.y < 0 || event.x >= map.width || event.y >= map.height) {
    throw new PrimitiveError("범위 밖: 선택한 칸의 이벤트를 다시 고르세요.");
  }
  return { map, event, target };
}

function locatePage(ctx: PrimitiveContext) {
  locateEvent(ctx);
  const selected = scopedPage(ctx);
  if (selected.event.pages?.filter(page => page.id === selected.page.id).length !== 1) {
    throw new PrimitiveError("선택한 이벤트의 페이지가 여러 개 겹쳐 있습니다. 페이지를 확인해 주세요.");
  }
  return selected;
}

function pageScope(ctx: PrimitiveContext, kind: PageScope["kind"]): PageScope {
  const { map, event, page } = locatePage(ctx);
  return { kind, mapId: map.id, eventId: event.id, pageId: page.id };
}

// Each branch is an independent editing location, even when authored in memory from a shared list.
function copyCommandTree<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyCommandTree) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyCommandTree(child)])) as T;
  }
  return value;
}

function editPage(ctx: PrimitiveContext, edit: (page: EventPage) => void): Project {
  locatePage(ctx);
  return updateScopedPage(ctx, page => {
    const next = { ...page, commands: copyCommandTree(page.commands) };
    edit(next);
    return next;
  });
}

function commandSlot(page: EventPage, rawPath: unknown, insert = false) {
  const at = rawPath ?? (insert ? [page.commands.length] : undefined);
  if (!Array.isArray(at) || at.length % 2 !== 1 ||
    Array.from(at).some((part, i) => !Number.isSafeInteger(part) || (i % 2 === 0 && part < 0))) {
    throw new PrimitiveError("명령 줄 위치가 올바르지 않습니다.");
  }
  const list = resolveCommandListAtPath(page.commands, at);
  const row = at[at.length - 1] as number;
  if (!list || row >= list.length + Number(insert)) {
    throw new PrimitiveError("범위 밖: 선택한 페이지에 해당 줄 위치가 없습니다.");
  }
  return { list, row, path: at as number[] };
}

function assertHash(command: Command, original: string, expected: unknown) {
  if (expected !== undefined && expected !== dialogueTextHash(original) && expected !== eventCommandHash(command)) {
    throw new PrimitiveError("원문이 바뀌었습니다. 대사를 다시 읽어 주세요.");
  }
}

function textSlot(page: EventPage, args: Args) {
  const { list, row, path } = commandSlot(page, args.path);
  const command = list[row];
  if (command?.kind !== "text") throw new PrimitiveError("선택한 줄은 대사가 아닙니다.");
  assertHash(command, command.body, args.hash);
  return { list, row, path, command };
}

function newText(value: unknown, original?: string): string {
  if (typeof value !== "string") throw new PrimitiveError("새 문구를 입력해 주세요.");
  const edited = normalizeEditedDialogueText(original ?? "", value);
  if (!edited.trim()) throw new PrimitiveError("새 문구를 입력해 주세요.");
  if (edited.length > DIALOGUE_TEXT_LIMIT) {
    throw new PrimitiveError(`새 문구는 ${DIALOGUE_TEXT_LIMIT.toLocaleString("ko-KR")}자까지 입력할 수 있어요.`);
  }
  if (original !== undefined) {
    const { missing, added } = compareControlCodes(original, edited);
    if (missing.length || added.length) throw new PrimitiveError("색상이나 대기 시간을 표시하는 대사 제어 코드를 원문 그대로 두세요.");
  }
  return edited;
}

function keepChoiceQuestion(list: Command[], row: number) {
  const next = list[row + 1];
  if (next?.kind === "choices" && next.options.length > 0 && !next.prompt?.trim()) {
    throw new PrimitiveError("이 대사는 다음 선택지의 질문으로 쓰여요. 선택지에 질문을 먼저 입력해 주세요.");
  }
}

// A shifted proposal address can point at a different line with the same text.
function assertProposalPositions(ctx: PrimitiveContext, page: EventPage, path: readonly number[], shiftsLaterRows: boolean) {
  const { project, target } = ctx;
  if (target.kind !== "event") return;
  const rowIndex = path.length - 1;
  const row = path[rowIndex]!;
  for (const proposal of project.dialogueDesk?.proposals ?? []) {
    const line = parseDialogueLineId(proposal.lineId);
    if (line?.scope !== "ev" || line.segments[0] !== target.mapId || line.segments[1] !== target.eventId ||
      line.segments[2] !== page.id || line.path.length < path.length ||
      !path.slice(0, rowIndex).every((part, index) => part === line.path[index])) continue;
    const proposedRow = line.path[rowIndex]!;
    if (proposedRow === row || (shiftsLaterRows && proposedRow > row)) {
      throw new PrimitiveError("이 편집으로 자료집의 대사 제안 위치가 바뀌어요. 해당 제안을 먼저 적용하거나 버려 주세요.");
    }
  }
}

function validCommand<T extends Command>(command: T): T {
  try {
    validateCommandArray("대사 명령", [command]);
  } catch {
    throw new PrimitiveError("이 페이지에 저장할 대사 명령 형식이 올바르지 않습니다.");
  }
  return command;
}

function rewrite(page: EventPage, args: Args) {
  const { list, row, command } = textSlot(page, args);
  list[row] = validCommand({ ...command, body: newText(args.text, command.body) });
}

function nameForPreview(value: unknown): string {
  const shown = typeof value === "string" && !/[{}\[\]「」]/u.test(value) ? displayText(value, "새 이름") : "새 이름";
  return shown.length > 40 ? shown.slice(0, 39) + "…" : shown;
}

const SELF_SWITCHES: readonly SelfSwitchKey[] = ["A", "B", "C", "D"];

function scriptSources(command: Extract<Command, { kind: "script" }>, project: Project) {
  const imports = scriptCalls(command, "library", project);
  return [command, ...(project.scriptLibrary ?? []).filter(module => imports.includes(module.id))]
    .flatMap(script => [script.source, script.compiled]);
}

function assertOwnConversation(project: Project, mapId: string, eventId: string) {
  visitProjectCommands(project, ({ command, location }) => {
    if (command.kind === "script" && scriptSources(command, project).some(source => /\b(?:get|set)SelfSwitch\b/u.test(source))) {
      throw new PrimitiveError("스크립트가 어떤 이벤트의 셀프 스위치를 쓰는지 확인할 수 없어 처음 대화 기록을 만들 수 없어요.");
    }
    if ("mapId" in location && location.mapId === mapId && location.eventId === eventId) return;
    if (command.kind === "callMapEvent" && command.eventId === eventId ||
      command.kind === "script" && scriptCalls(command, "event", project).includes(eventId)) {
      // A map event call runs the callee's commands with the caller's currentEventId.
      throw new PrimitiveError("다른 곳에서 이 이벤트를 호출해요. 처음 대화 기록이 섞일 수 있어 이 대사는 바꿀 수 없어요.");
    }
    if (command.kind === "script" && scriptHasDynamic(command, "event", { access: "call", library: project.scriptLibrary })) {
      throw new PrimitiveError("스크립트가 이 이벤트를 호출하는지 확인할 수 없어 처음 대화 기록을 만들 수 없어요.");
    }
  });
}

function unusedSelfSwitch(ctx: PrimitiveContext, event: GameEvent): SelfSwitchKey {
  const { project } = ctx;
  const { map } = locateEvent(ctx);
  if (Object.values(project.maps).some(entry => entry !== map && entry.events.some(candidate => candidate.id === event.id))) {
    throw new PrimitiveError("이 이벤트의 기록을 다른 이벤트와 공유하고 있어요.");
  }
  assertOwnConversation(project, map.id, event.id);
  const used = new Set(Object.keys(project.session.selfSwitches?.[event.id] ?? {}));
  const visited = new WeakSet<object>();
  const pending: unknown[] = [event];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    const entry = value as Record<string, unknown>;
    if ((entry.kind === "selfSwitch" || entry.kind === "setSelfSwitch") && typeof entry.key === "string") used.add(entry.key);
    // Called command lists can run with the same current event and share its self switches.
    switch (entry.kind) {
      case "callCommonEvent":
        pending.push(project.commonEvents.find(common => common.id === entry.commonEventId));
        break;
      case "callMapEvent":
        pending.push(map.events.find(candidate => candidate.id === entry.eventId));
        break;
      case "runSchedule": {
        const schedule = typeof entry.scheduleId === "string" ? findSchedule(project.database, entry.scheduleId) : undefined;
        const activityIds = new Set(schedule?.activities.map(activity => activity.commonEventId));
        pending.push(...project.commonEvents.filter(common => activityIds.has(common.id)));
        break;
      }
      case "battleProcessing":
      case "tacticsBattle":
        if (entry.kind === "battleProcessing" && entry.troopSource === "variable") {
          for (const troop of project.database.troops) pending.push(troop.battleEventPages);
        } else {
          pending.push(project.database.troops.find(troop => troop.id === entry.troopId)?.battleEventPages);
        }
        break;
      case "script":
        throw new PrimitiveError("이 이벤트에서 실행하는 스크립트가 어떤 셀프 스위치를 쓰는지 확인할 수 없어요.");
    }
    for (const child of Object.values(entry)) pending.push(child);
  }
  const key = SELF_SWITCHES.find(candidate => !used.has(candidate));
  if (!key) throw new PrimitiveError("이 이벤트에 비어 있는 셀프 스위치가 없습니다.");
  return key;
}

function locateNpc(ctx: PrimitiveContext) {
  const { map, event, target } = locateEvent(ctx);
  const current = mapTarget(ctx.project, map.id, event.id, target.pageId);
  if (!target.isNpc || current?.kind !== "event" || !current.isNpc) {
    throw new PrimitiveError("범위 밖: 이름을 바꿀 인물을 다시 골라 주세요.");
  }
  return { map, event, target };
}

// A text-only objective uses the displayed event name to find its target on the map.
function objectiveName(value: string) {
  return value.replace(/[\s「」『』"'·.,!?]/gu, "");
}

function assertRenamePreservesReferences(project: Project, updated: Project, mapId: string, event: GameEvent, newName: string) {
  const oldName = event.name?.trim() ?? "";
  const objectiveKeys = [objectiveName(oldName), objectiveName(newName)].filter(Boolean);
  const noEmptyInteractivePage = event.pages?.every(page => page.commands.length > 0 ||
    (page.trigger.kind !== "action" && page.trigger.kind !== "playerTouch" && page.trigger.kind !== "eventTouch"));
  visitProjectCommands(project, ({ command, location }) => {
    const m2Title = command.kind === "m2Command" ? m2CommandById(command.commandId)?.title : undefined;
    const speaker = command.kind === "text" ? command.speaker
      : command.kind === "m2Command" && m2Title === "Advanced Dialogue" ? command.fields.speaker : undefined;
    if (typeof speaker === "string") {
      const mayUseStagingName = (command.kind !== "text" || !command.speakerActor?.trim()) && !isNonActorSpeaker(speaker) &&
        (!("mapId" in location) || location.mapId === mapId);
      if ((oldName && speaker.trim() === oldName) || (mayUseStagingName &&
        (speakerNameScore(speaker, oldName) > 0 || speakerNameScore(speaker, newName) > 0))) {
        throw new PrimitiveError("이전 이름이나 새 이름을 화자로 쓰는 대사가 있어요. 대사의 화자 연결을 확인한 뒤 이름을 바꿔 주세요.");
      }
    }
    if (command.kind === "script") {
      const sources = scriptSources(command, project);
      if (oldName && sources.some(source => source.includes(oldName)) && sources.some(source => /\b(?:event|events)\b/u.test(source))) {
        throw new PrimitiveError("스크립트에서 이 인물의 이름을 쓰고 있어요. 스크립트의 이름 연결을 확인해 주세요.");
      }
    }
    if (command.kind === "m2Command" && m2Title === "UI Command" && command.fields.surface === "objectiveChip") {
      const { targetMapId, targetEventId, message } = command.fields;
      if (typeof message !== "string") return;
      // An empty interactive page can still be found by name after the ID lookup falls through.
      const hasStableTarget = typeof targetMapId === "string" && targetMapId.trim() === mapId &&
        typeof targetEventId === "string" && targetEventId.trim() === event.id && noEmptyInteractivePage;
      const tail = /\(([^():]+):([^()]*)\)\s*$/u.exec(message);
      const tailNames = [tail?.[1] ?? "", ...(tail?.[2]?.split("→").slice(1).join("·").split("·") ?? [])];
      const mentionsName = objectiveKeys.some(key => (key.length >= 2 && objectiveName(message).includes(key)) ||
        tailNames.some(name => objectiveName(name) === key));
      if ((!hasStableTarget && mentionsName) ||
        objectiveTextOnMap(project.maps[mapId]!, message) !== objectiveTextOnMap(updated.maps[mapId]!, message)) {
        throw new PrimitiveError("이 이름으로 인물을 찾는 목표가 있어요. 목표의 문구와 대상 이벤트를 확인한 뒤 이름을 바꿔 주세요.");
      }
    }
  });
}

function pagePrimitive(
  id: string, title: string, args: JsonSchema, describe: SmallTaskPrimitive["describe"],
  edit: (page: EventPage, args: Args, ctx: PrimitiveContext) => void,
  kind: PageScope["kind"] = "dialogue", cover = id,
): SmallTaskPrimitive {
  return {
    id, unit: UNIT, title, covers: { tools: [cover] }, targets: ["event"], args, describe,
    scope: ctx => pageScope(ctx, kind),
    apply: (ctx, input) => editPage(ctx, page => edit(page, input, ctx)),
  };
}

const rewriteArgs = schema({ path, hash, text }, ["path", "text"]);
const TONE_EDIT_LIMIT = 80;

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  pagePrimitive("dialogue.line.rewrite", "대사 고치기", rewriteArgs,
    () => "선택한 대사 한 줄을 고칩니다.",
    rewrite),
  pagePrimitive("dialogue.line.insert", "대사 끼우기", schema({ path: {
    ...path, description: "이 위치 앞에 끼웁니다. 생략하면 페이지 끝에 붙입니다.",
  }, hash: { ...hash, description: "앞에 끼울 때 기준이 되는 명령의 확인값입니다. 끝에 붙일 때는 생략합니다." }, text }, ["text"]),
    () => "선택한 페이지에 대사 한 줄을 추가합니다.",
    (page, args, ctx) => {
      const { list, row, path } = commandSlot(page, args.path, true);
      if (args.hash !== undefined && (!list[row] || args.hash !== eventCommandHash(list[row]))) {
        throw new PrimitiveError("기준 명령이 바뀌었습니다. 끼워 넣을 위치를 다시 확인해 주세요.");
      }
      if (list[row - 1]?.kind === "text") keepChoiceQuestion(list, row - 1);
      assertProposalPositions(ctx, page, path, true);
      const command = newCommand("text") as TextCommand;
      list.splice(row, 0, validCommand({ ...command, body: newText(args.text) }));
    }),
  pagePrimitive("dialogue.line.remove", "대사 지우기", schema({ path, pageHash: {
    type: "string", minLength: 1,
    description: "get_event에서 includeCommandHashes를 켜고 pageHashes에서 읽은 이 페이지의 pageHash입니다. 대사나 위치가 바뀌면 다시 읽어야 합니다.",
  } }, ["path", "pageHash"]),
    () => "선택한 대사 한 줄을 지웁니다.",
    (page, args, ctx) => {
      if (args.pageHash !== eventCommandListHash(page.commands)) {
        throw new PrimitiveError(STALE_COMMAND_LIST);
      }
      const { list, row, path } = textSlot(page, args);
      keepChoiceQuestion(list, row);
      assertProposalPositions(ctx, page, path, true);
      list.splice(row, 1);
    }),
  pagePrimitive("dialogue.choiceLabel.rewrite", "선택지 문구 고치기", schema({ path, hash, text, option: {
    type: "integer", minimum: 0, description: "바꿀 선택지 순서입니다. 첫 번째는 0입니다.",
  } }, ["path", "option", "text"]), (_ctx, args) => `${(args.option as number) + 1}번째 선택지의 문구를 고칩니다.`,
    (page, args) => {
      const { list, row } = commandSlot(page, args.path);
      const command = list[row];
      if (command?.kind !== "choices") throw new PrimitiveError("선택한 줄에는 선택지가 없습니다.");
      const option = args.option;
      if (typeof option !== "number" || !Number.isSafeInteger(option) || option < 0) {
        throw new PrimitiveError("바꿀 선택지 번호를 확인해 주세요.");
      }
      const previous = command.options[option];
      if (!previous) throw new PrimitiveError("범위 밖: 해당 선택지가 없습니다.");
      assertHash(command, previous.text, args.hash);
      const edited = { ...previous, text: newText(args.text, previous.text) };
      list[row] = validCommand({ ...command, options: command.options.map((entry, i) => i === option ? edited : entry) });
    }),
  pagePrimitive("dialogue.tone.rewrite", "대사 말투 맞추기", schema({ edits: {
    type: "array", minItems: 1, maxItems: TONE_EDIT_LIMIT, items: rewriteArgs,
    description: "선택한 페이지에서 말투를 바꿀 대사 위치와 각각의 새 문구입니다.",
  } }, ["edits"]), (_ctx, args) => `선택한 페이지에서 대사 ${(args.edits as Args[]).length}줄의 말투를 바꿉니다.`,
    (page, args) => {
      const seen = new Set<string>();
      for (const edit of args.edits as Args[]) {
        if (!edit || !Array.isArray(edit.path)) throw new PrimitiveError("말투를 바꿀 대사의 위치를 확인해 주세요.");
        const key = (edit.path as number[]).join(".");
        if (seen.has(key)) throw new PrimitiveError("같은 대사 줄이 두 번 들어 있습니다.");
        seen.add(key);
        rewrite(page, edit);
      }
    }, "dialogue", "dialogue.tone.rewrite(batch within page)"),
  pagePrimitive("dialogue.firstTimeOnly", "대사를 처음 한 번만 표시", schema({ path, hash }, ["path"]),
    () => "선택한 대사를 처음 한 번만 보여 줍니다.",
    (page, args, ctx) => {
      if (page.trigger.kind === "parallel") throw new PrimitiveError("병렬 실행 페이지는 대사를 표시할 수 없어요.");
      const { list, row, path, command } = textSlot(page, args);
      keepChoiceQuestion(list, row);
      assertProposalPositions(ctx, page, path, false);
      const key = unusedSelfSwitch(ctx, locateEvent(ctx).event);
      list[row] = validCommand({
        kind: "fork", condition: { kind: "selfSwitch", key, value: false },
        then: [command, { kind: "setSelfSwitch", key, value: true, skipDuringFastForward: true }],
      });
    }, "eventPage"),
  {
    id: "npc.rename", unit: UNIT, title: "인물 이름 바꾸기", covers: { tools: ["npc.rename"] }, targets: ["event"],
    args: schema({ name }, ["name"]),
    scope(ctx) {
      const { target } = locateNpc(ctx);
      const { mapId, eventId, x, y } = target;
      return { kind: "tileEvent", mapId, eventId, x, y };
    },
    describe: (_ctx, args) => `선택한 인물에게 「${nameForPreview(args.name)}」라는 이름을 붙입니다.`,
    apply(ctx, args) {
      const { map, event } = locateNpc(ctx);
      const next = (args.name as string).trim();
      if (!next) throw new PrimitiveError("새 인물 이름을 입력해 주세요.");
      if (event.name === next) return ctx.project;
      const updated = projectWithEventRevision(ctx.project, map.id, event.id, { ...event, name: next });
      if (event.name?.trim() !== next) assertRenamePreservesReferences(ctx.project, updated, map.id, event, next);
      if (event.characterId) {
        const beforeOwners = affectionVariableOwners(ctx.project);
        const afterOwners = affectionVariableOwners(updated);
        if (beforeOwners.size !== afterOwners.size ||
          [...beforeOwners].some(([id, owner]) => afterOwners.get(id) !== owner)) {
          throw new PrimitiveError("이 이름을 바꾸면 호감 변수가 가리키는 인물이 달라져요. 호감 변수의 이름 연결을 먼저 확인해 주세요.");
        }
      }
      return updated;
    },
  },
  pagePrimitive("dialogue.speaker.set", "대사 화자 정하기", schema({ path, hash, speaker: {
    ...name, description: "대화창에 표시할 화자 이름입니다. 빈 문자열을 주면 이름을 지웁니다.",
  } }, ["path", "speaker"]), (_ctx, args) => (args.speaker as string).trim()
    ? `선택한 대사에 「${nameForPreview(args.speaker)}」라는 화자 이름을 붙입니다.`
    : "선택한 대사에서 화자 이름을 지웁니다.",
    (page, args) => {
      const { list, row, command } = textSlot(page, args);
      list[row] = validCommand({ ...command, speaker: (args.speaker as string).trim() });
    }, "eventPage"),
];
