import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { compareControlCodes } from "@/editor/dialogue/dialogueText";
import { normalizeEditedDialogueText, DIALOGUE_TEXT_LIMIT } from "@/editor/dialogue/dialogueEdits";
import { dialogueTextHash } from "@/editor/dialogue/dialogueIndex";
import { newCommand } from "@/editor/eventCommandFactory";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { Command, EventPage, GameEvent, Project, SelfSwitchKey } from "@/project/types";
import { scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "26-npc-dialogue";
type Args = Record<string, unknown>;
type TextCommand = Extract<Command, { kind: "text" }>;
type PageScope = Extract<SmallTaskScope, { kind: "dialogue" | "eventPage" }>;

const path: JsonSchema = {
  type: "array", minItems: 1, items: { type: "integer" },
  description: "페이지 안 명령 위치입니다. 이벤트 읽기에서 찾은 분기 위치 뒤에 줄 번호를 붙입니다. 첫 명령은 [0]입니다.",
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
  const event = map?.events.find(entry => entry.id === target.eventId);
  if (!map || !event || event.x !== target.x || event.y !== target.y) {
    throw new PrimitiveError("범위 밖: 선택한 칸의 이벤트를 다시 고르세요.");
  }
  return { map, event, target };
}

function pageScope(ctx: PrimitiveContext, kind: PageScope["kind"]): PageScope {
  const { map, event, page } = scopedPage(ctx);
  return { kind, mapId: map.id, eventId: event.id, pageId: page.id };
}

function replaceEvent(ctx: PrimitiveContext, edit: (event: GameEvent) => GameEvent): Project {
  const { map, event, target } = locateEvent(ctx);
  const next = edit(event);
  if (next === event) return ctx.project;
  return { ...ctx.project, maps: { ...ctx.project.maps, [target.mapId]: {
    ...map, events: map.events.map(entry => entry === event ? next : entry),
  } } };
}

function editPage(ctx: PrimitiveContext, edit: (page: EventPage) => void): Project {
  return updateScopedPage(ctx, page => {
    const next = { ...page, commands: structuredClone(page.commands) };
    edit(next);
    return next;
  });
}

function commandSlot(page: EventPage, rawPath: unknown, insert = false) {
  const at = rawPath ?? (insert ? [page.commands.length] : undefined);
  if (!Array.isArray(at) || at.length % 2 !== 1 ||
    at.some((part, i) => !Number.isSafeInteger(part) || (i % 2 === 0 && part < 0))) {
    throw new PrimitiveError("명령 줄 위치가 올바르지 않습니다.");
  }
  const list = resolveCommandListAtPath(page.commands, at);
  const row = at[at.length - 1] as number;
  if (!list || row >= list.length + Number(insert)) {
    throw new PrimitiveError("범위 밖: 선택한 페이지에 해당 줄 위치가 없습니다.");
  }
  return { list, row };
}

function assertHash(command: Command, original: string, expected: unknown) {
  if (expected !== undefined && expected !== dialogueTextHash(original) && expected !== eventCommandHash(command)) {
    throw new PrimitiveError("원문이 바뀌었습니다. 대사를 다시 읽어 주세요.");
  }
}

function textSlot(page: EventPage, args: Args) {
  const { list, row } = commandSlot(page, args.path);
  const command = list[row];
  if (command?.kind !== "text") throw new PrimitiveError("선택한 줄은 대사가 아닙니다.");
  assertHash(command, command.body, args.hash);
  return { list, row, command };
}

function newText(value: unknown, original?: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > DIALOGUE_TEXT_LIMIT) {
    throw new PrimitiveError("새 문구를 2,000자 이내로 입력하세요.");
  }
  if (original === undefined) return normalizeEditedDialogueText("", value);
  const edited = normalizeEditedDialogueText(original, value);
  const { missing, added } = compareControlCodes(original, edited);
  if (missing.length || added.length) throw new PrimitiveError("원문에 있는 대사 제어 코드를 그대로 두세요.");
  return edited;
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

function unusedSelfSwitch(ctx: PrimitiveContext, event: GameEvent): SelfSwitchKey {
  const { project } = ctx;
  const { map } = locateEvent(ctx);
  if (Object.values(project.maps).filter(entry => entry.events.some(candidate => candidate.id === event.id)).length > 1
    || map.events.some(candidate => candidate !== event && candidate.id === event.id)) {
    throw new PrimitiveError("이 이벤트의 기록을 다른 이벤트와 공유하고 있습니다.");
  }
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
      case "battleProcessing":
      case "tacticsBattle":
        pending.push(project.database.troops.find(troop => troop.id === entry.troopId));
        break;
      case "script":
        throw new PrimitiveError("이 이벤트의 스크립트가 쓰는 셀프 스위치를 확인할 수 없습니다.");
    }
    for (const child of Object.values(entry)) pending.push(child);
  }
  const key = SELF_SWITCHES.find(candidate => !used.has(candidate));
  if (!key) throw new PrimitiveError("이 이벤트에 비어 있는 셀프 스위치가 없습니다.");
  return key;
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
  }, text }, ["text"]), () => "선택한 페이지에 대사 한 줄을 추가합니다.",
    (page, args) => {
      const { list, row } = commandSlot(page, args.path, true);
      const command = newCommand("text") as TextCommand;
      list.splice(row, 0, validCommand({ ...command, body: newText(args.text) }));
    }),
  pagePrimitive("dialogue.line.remove", "대사 지우기", schema({ path, hash }, ["path"]),
    () => "선택한 대사 한 줄을 지웁니다.",
    (page, args) => {
      const { list, row } = textSlot(page, args);
      list.splice(row, 1);
    }),
  pagePrimitive("dialogue.choiceLabel.rewrite", "선택지 문구 고치기", schema({ path, hash, text, option: {
    type: "integer", minimum: 0, description: "바꿀 선택지 순서입니다. 첫 번째는 0입니다.",
  } }, ["path", "option", "text"]), () => "선택한 선택지의 문구를 고칩니다.",
    (page, args) => {
      const { list, row } = commandSlot(page, args.path);
      const command = list[row];
      if (command?.kind !== "choices") throw new PrimitiveError("선택한 줄에는 선택지가 없습니다.");
      const option = args.option as number;
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
        const key = (edit.path as number[]).join(".");
        if (seen.has(key)) throw new PrimitiveError("같은 대사 줄이 두 번 들어 있습니다.");
        seen.add(key);
        rewrite(page, edit);
      }
    }, "dialogue", "dialogue.tone.rewrite(batch within page)"),
  pagePrimitive("dialogue.firstTimeOnly", "첫 대화에만 표시", schema({ path, hash }, ["path"]),
    () => "선택한 대사를 처음 한 번만 보여 줍니다.",
    (page, args, ctx) => {
      const { list, row, command } = textSlot(page, args);
      const key = unusedSelfSwitch(ctx, scopedPage(ctx).event);
      list[row] = validCommand({
        kind: "fork", condition: { kind: "selfSwitch", key, value: false },
        then: [{ kind: "setSelfSwitch", key, value: true }, command],
      });
    }, "eventPage"),
  {
    id: "npc.rename", unit: UNIT, title: "인물 이름 바꾸기", covers: { tools: ["npc.rename"] }, targets: ["event"],
    args: schema({ name }, ["name"]),
    scope(ctx) {
      const { target } = locateEvent(ctx);
      if (!target.isNpc) throw new PrimitiveError("범위 밖: 이름을 바꿀 인물을 고르세요.");
      const { mapId, eventId, x, y } = target;
      return { kind: "tileEvent", mapId, eventId, x, y };
    },
    describe: (_ctx, args) => `선택한 인물에게 「${nameForPreview(args.name)}」라는 이름을 붙입니다.`,
    apply(ctx, args) {
      const next = (args.name as string).trim();
      if (!next) throw new PrimitiveError("인물 이름을 입력하세요.");
      return replaceEvent(ctx, event => event.name === next ? event : { ...event, name: next });
    },
  },
  pagePrimitive("dialogue.speaker.set", "대사 화자 정하기", schema({ path, hash, speaker: {
    ...name, description: "대화창에 표시할 화자 이름입니다. 빈 문자열을 주면 이름을 지웁니다.",
  } }, ["path", "speaker"]), (_ctx, args) => (args.speaker as string).trim()
    ? `선택한 대사에 「${nameForPreview(args.speaker)}」라는 화자 이름을 붙입니다.`
    : "선택한 대사에서 화자 이름을 지웁니다.",
    (page, args) => {
      const { list, row, command } = textSlot(page, args);
      const speaker = (args.speaker as string).trim();
      if (speaker) list[row] = validCommand({ ...command, speaker });
      else {
        const { speaker: _speaker, ...rest } = command;
        list[row] = validCommand(rest);
      }
    }, "eventPage"),
];
