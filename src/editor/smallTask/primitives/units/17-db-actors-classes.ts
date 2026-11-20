import { withOpenEventDrafts, type SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { eventReferenceMatches } from "@/editor/databaseEventReferences";
import { displayText } from "@/editor/smallTask/target";
import { outsideRecord, referenceIndex } from "@/editor/tools/dbReferenceIndex";
import { expandShortParameterCurves } from "@/editor/tools/parameterCurveInput";
import type { JsonSchema } from "@/editor/tools/types";
import { resolveDialogueSpeakerName, resolveDialogueText } from "@/player/dialogueText";
import { ACTOR_LEVEL_MAX, ACTOR_LEVEL_MIN, createActorRecord } from "@/project/actorModel";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import { playerChoiceText } from "@/project/choiceText";
import { normalizeClassRecord } from "@/project/databaseRecordModel";
import { characterAppearanceReferenceIssues, validateCharacterAppearances } from "@/project/io/characterAppearanceValidation";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { clampVariableValue, VARIABLE_MAX, VARIABLE_MIN } from "@/project/session";
import { isNonActorSpeaker, speakerNameScore } from "@/project/staging/dialogueActors";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { ActorRecord, CharacterAppearanceRecord, ClassRecord, Command, Project } from "@/project/types";
import { roJosa } from "@/util/josa";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "17-db-actors-classes";

type Records = {
  actors: ActorRecord;
  classes: ClassRecord;
  characterAppearances: CharacterAppearanceRecord;
};
type Collection = keyof Records;
type Args = Record<string, unknown>;

const labels = { actors: "주인공", classes: "직업", characterAppearances: DATABASE_AREA_LABELS.characterAppearances };
const verbs = { create: "추가", update: "수정", delete: "삭제" };
const prefixes = { actors: "actor", classes: "class", characterAppearances: "appearance" };
const MAX_HP = 99999;

const name: JsonSchema = { type: "string", minLength: 1, description: "자료집에 표시할 이름" };
const level = (description: string): JsonSchema => ({ type: "integer", minimum: ACTOR_LEVEL_MIN, maximum: ACTOR_LEVEL_MAX, description });
const link = (description: string): JsonSchema => ({ type: ["string", "null"], minLength: 1, description });
const actorFields = {
  name,
  nickname: { type: "string", description: "별명, 빈 글로 지우기" },
  classId: { type: "string", minLength: 1, description: "자료집에 있는 직업의 식별자" },
  initialLevel: level("게임 시작 레벨"),
  maxLevel: level("성장할 수 있는 최고 레벨"),
  appearanceId: link("자료집 외형의 식별자, 연결 해제는 널"),
} satisfies Record<string, JsonSchema>;
const classFields = {
  name,
  maxHpAtLevel99: { type: "integer", minimum: 1, maximum: MAX_HP, description: "99레벨 최대 체력을 지정. 기존 직업은 1~98레벨 값을 유지" },
} satisfies Record<string, JsonSchema>;
const appearanceFields = {
  name,
  description: { type: "string", description: "외형 설명, 빈 글로 지우기" },
  charsetResourceId: link("걷기 그림의 식별자, 연결 해제는 널"),
  characterIndex: { type: "integer", minimum: 0, maximum: 7, description: "걷기 그림에서 고른 칸의 번호, 첫 칸은 0" },
  faceResourceId: link("얼굴 그림의 식별자, 연결 해제는 널"),
  bustResourceId: link("흉상 그림의 식별자, 연결 해제는 널"),
  fullResourceId: link("전신 그림의 식별자, 연결 해제는 널"),
} satisfies Record<string, JsonSchema>;

function targetIndex<C extends Collection>(ctx: PrimitiveContext, collection: C, records: readonly Records[C][]): number {
  const { target } = ctx;
  if (target.kind !== "dbEntry" || target.collection !== collection) {
    throw new PrimitiveError(`범위 밖 요청이에요. ${labels[collection]} 항목을 선택해 주세요.`);
  }
  const index = records.findIndex(record => record.id === target.id);
  if (index === -1) throw new PrimitiveError("범위 밖 요청이에요. 선택한 항목을 다시 골라 주세요.");
  return index;
}

function nextId(project: Project, collection: Collection, records: readonly { id: string }[]): string {
  const ids = new Set(records.map(record => record.id));
  const prefix = `${prefixes[collection]}_small_task_`;
  for (let number = 1; ; number++) {
    const id = `${prefix}${number}`;
    // An older project can still name a row that was deleted elsewhere.
    if (!ids.has(id) && !recordIdIsReferenced(project, collection, id)) return id;
  }
}

function someCommand(project: Project, matches: (command: Command) => boolean): boolean {
  const commands = (list: readonly Command[]): boolean => list.some(command =>
    matches(command) || nestedCommandLists(command).some(commands));
  return Object.values(project.maps).some(map => map.events.some(event => eventReferenceMatches(event, row =>
    commands(row.commands) || (row.pages ?? []).some(page => commands(page.commands)))))
    || project.commonEvents.some(event => commands(event.commands))
    || project.database.troops.some(troop => troop.battleEventPages.some(page => commands(page.commands))
      || troopAfterBattleLists(troop).some(list => commands(list.commands)));
}

function legacyActorReference(project: Project, id: string): boolean {
  // These two M2 command paths trim actorId at runtime, while the shared index matches exact values.
  return someCommand(project, command => command.kind === "m2Command"
    && ((command.commandId === "m2-078-open-menu-screen" && command.fields.screen === "skills")
      || (command.commandId === "m2-092-change-battle-commands" && command.fields.target === "actor"))
    && typeof command.fields.actorId === "string" && command.fields.actorId.trim() === id);
}

function recordIdIsReferenced(project: Project, collection: Collection, id: string): boolean {
  return referenceIndex(project, new Set([id])).has(id) || (collection === "actors" && legacyActorReference(project, id));
}

function someDialogue(project: Project, matches: (text: string, isSpeaker: boolean, speakerActor?: string) => boolean): boolean {
  const body = (text: unknown) => typeof text === "string" && matches(text, false);
  const speaker = (text: unknown, speakerActor?: string) => typeof text === "string" && matches(text, true, speakerActor);
  const beatMatches = (beat: Record<string, unknown>): boolean => {
    if (beat.kind === "parallel" && Array.isArray(beat.beats)) return beat.beats.some(beatMatches);
    if (beat.kind !== "say") return false;
    const lines = Array.isArray(beat.lines) && beat.lines.length ? beat.lines : [beat.text];
    return lines.some(body) || (lines.some(line => typeof line === "string" && line.length > 0)
      && speaker(beat.speaker, typeof beat.actor === "string" ? beat.actor : undefined));
  };
  return someCommand(project, command => {
    switch (command.kind) {
      case "text": return body(textBodyOf(command)) || speaker(command.speaker, command.speakerActor);
      case "choices": return body(command.prompt) || command.options.some(option =>
        body(playerChoiceText(option.text)) || body(option.disabledText));
      case "presentItem": case "inputNumber": return body(command.prompt);
      case "m2Command": return command.commandId === "m2-209-advanced-dialogue"
        && (body(command.fields.body) || speaker(command.fields.speaker));
      default: return false;
    }
  }) || (project.endings ?? []).some(ending => ending.epilogue?.some(beatMatches));
}

function dialogueUsesActorNumber(project: Project, firstChangedIndex: number): boolean {
  // The runtime expands \N[번호] by the actor's current list position. Override only the
  // affected names while parsing so escaped backslashes and other control codes keep their meaning.
  const actorNames = Object.fromEntries(project.database.actors.slice(firstChangedIndex).map(actor => [actor.id, `${actor.name}\0`]));
  const session = { variables: {} };
  return someDialogue(project, text => /\\n\[/iu.test(text)
    && resolveDialogueText(text, { project, session }) !== resolveDialogueText(text, { project, session: { ...session, actorNames } }));
}

function assertActorDeletion(project: Project, index: number): void {
  if (legacyActorReference(project, project.database.actors[index].id)) {
    throw new PrimitiveError("사용 중인 주인공 항목이에요. 다른 곳의 연결을 먼저 해제해 주세요.");
  }
  if (dialogueUsesActorNumber(project, index)) {
    throw new PrimitiveError("이 주인공을 지우면 대사에 나오는 이름이 바뀌거나 사라져요. 대사의 주인공 번호를 먼저 확인해 주세요.");
  }
}

function assertActorCreation(project: Project, firstNewIndex: number): void {
  if (dialogueUsesActorNumber(project, firstNewIndex)) {
    throw new PrimitiveError("새 주인공이 대사에서 이미 쓰는 번호에 들어가요. 대사의 주인공 번호를 먼저 확인해 주세요.");
  }
}

export function assertActorClassDraftChanges(before: Project, after: Project, collection: keyof Project["database"], id: string, live: SmallTaskDraftSource): void {
  if (collection !== "actors" && collection !== "classes" && collection !== "characterAppearances") return;
  const beforeRows = before.database[collection] ?? [];
  const afterRows = after.database[collection] ?? [];
  const existingIds = new Set(beforeRows.map(row => row.id));
  const added = afterRows.filter(row => !existingIds.has(row.id));
  const removedIndex = collection === "actors" && !afterRows.some(row => row.id === id)
    ? beforeRows.findIndex(row => row.id === id) : -1;
  if (!added.length && removedIndex === -1) return;
  const working = withOpenEventDrafts(before, live);
  if (added.some(row => recordIdIsReferenced(working, collection, row.id))) {
    throw new PrimitiveError("열린 이벤트에서 새 항목의 식별자를 사용하고 있어요. 이벤트를 먼저 확인해 주세요.");
  }
  if (removedIndex !== -1) assertActorDeletion(working, removedIndex);
  if (collection === "actors" && added.length) {
    const firstNewIndex = afterRows.findIndex(row => row.id === added[0].id);
    assertActorCreation(withOpenEventDrafts(after, live), firstNewIndex);
  }
}

function appearancePortraitByName(project: Project, name: string) {
  const appearance = project.database.characterAppearances?.find(row => row.name.trim() === name);
  return appearance && resolveAppearancePortrait(project, appearance.id, "full");
}

function numericVariableSpeakerCanMatch(parts: readonly string[], name: string): boolean {
  if (!name.startsWith(parts[0])) return false;
  const maxLength = Math.max(String(VARIABLE_MIN).length, String(VARIABLE_MAX).length);
  let positions = new Set([parts[0].length]);
  for (const suffix of parts.slice(1)) {
    const next = new Set<number>();
    for (const start of positions) {
      for (let end = start + 1; end <= Math.min(start + maxLength, name.length); end++) {
        const value = name.slice(start, end);
        if (String(clampVariableValue(Number(value))) === value && name.startsWith(suffix, end)) next.add(end + suffix.length);
      }
    }
    positions = next;
  }
  return positions.has(name.length);
}

function variableSpeakerCanMatch(text: string, project: Project, names: ReadonlySet<string>): boolean {
  if (!/\\[tv]\[/iu.test(text)) return false;
  // Authored starting values can be present before the first clamped variable write.
  if (names.has(resolveDialogueSpeakerName(text, { project, session: project.session }) ?? "")) return true;
  // Let the runtime parser recognize real substitutions, including escapes and inline tags.
  const stringMarker = "\0";
  const numberMarker = "\u0001";
  const stringVariables = new Proxy<Record<string, string>>({}, { get: () => stringMarker });
  // The parser stringifies numeric variable values when it appends them to the dialogue.
  const variables = new Proxy<Record<string, number>>({}, { get: () => numberMarker });
  const resolved = resolveDialogueText(text, { project, session: { variables, stringVariables } });
  const parts = resolved.split(stringMarker);
  if (parts.length === 1) {
    const numericParts = resolved.trim().split(numberMarker);
    return numericParts.length > 1 && [...names].some(name => numericVariableSpeakerCanMatch(numericParts, name));
  }
  // Actor names and numeric variables in a mixed expression can change during play too.
  if (/\\[nv]\[/iu.test(text)) return true;
  const literals = parts.map(part => part.trim());
  for (const name of names) {
    if (!name.startsWith(literals[0]) || !name.endsWith(literals.at(-1)!)) continue;
    let offset = 0;
    if (literals.every(literal => {
      const index = name.indexOf(literal, offset);
      if (index < 0) return false;
      offset = index + literal.length;
      return true;
    })) return true;
  }
  return false;
}

function dialogueUsesName(project: Project, collection: Collection, record: Records[Collection], after: Project): boolean {
  if (collection === "classes") return false;
  const oldName = record.name.trim();
  const newName = after.database[collection]?.find(row => row.id === record.id)?.name.trim();
  if (oldName === newName) return false;
  const isActor = collection === "actors";
  const names = new Set([oldName, newName].filter((name): name is string => Boolean(name)));
  if (!isActor) {
    for (const name of names) {
      const previous = appearancePortraitByName(project, name);
      const next = appearancePortraitByName(after, name);
      if (previous?.resourceId === next?.resourceId && previous?.presentation === next?.presentation) names.delete(name);
    }
  }
  if (!names.size) return false;
  const textContext = { project, session: { variables: {} } };
  // A speaker written with this actor's number follows a rename on its own.
  const byNumber = isActor ? { ...textContext, session: { ...textContext.session, actorNames: { [record.id]: "\0" } } } : textContext;
  return someDialogue(project, (text, isSpeaker, speakerActor) => {
    if (!isSpeaker || !text.trim()) return false;
    if (names.has(resolveDialogueSpeakerName(text, byNumber) ?? "")) return true;
    if (!isActor) return variableSpeakerCanMatch(text, project, names);
    // Automatic staging also considers partial and subsequence matches on the raw speaker label.
    if (speakerActor?.trim() || isNonActorSpeaker(text)) return false;
    return speakerNameScore(text, oldName) !== speakerNameScore(text, newName ?? "");
  });
}

function authoredName(args: Args, fallback: string): string {
  const value = args.name;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) throw new PrimitiveError("이름을 입력해 주세요.");
  return trimmed;
}

function previewName(value: string, fallback: string): string {
  const text = displayText(value.replace(/[{}\[\]「」.?!。！？]/gu, " "), fallback);
  if (!text) return "";
  return `「${text.length > 24 ? `${text.slice(0, 23)}…` : text}」`;
}

function actorEdit(ctx: PrimitiveContext, args: Args, actor: ActorRecord): ActorRecord {
  const classId = typeof args.classId === "string" ? args.classId.trim() : actor.classId;
  if (args.classId !== undefined && !ctx.project.database.classes.some(record => record.id === classId)) {
    throw new PrimitiveError("연결할 직업을 자료집에서 찾을 수 없어요.");
  }
  const initialLevel = typeof args.initialLevel === "number" ? args.initialLevel : actor.initialLevel;
  const maxLevel = typeof args.maxLevel === "number" ? args.maxLevel : actor.maxLevel;
  if (initialLevel > maxLevel) throw new PrimitiveError("시작 레벨은 최고 레벨 이하여야 해요.");
  const edited = {
    ...actor, classId, initialLevel, maxLevel,
    name: authoredName(args, actor.name),
    nickname: typeof args.nickname === "string" ? args.nickname.trim() : actor.nickname,
  };
  if (args.appearanceId === null) delete edited.appearanceId;
  if (typeof args.appearanceId === "string") {
    const id = args.appearanceId.trim();
    if (!ctx.project.database.characterAppearances?.some(record => record.id === id)) {
      throw new PrimitiveError("연결할 캐릭터 외형을 찾을 수 없어요.");
    }
    edited.appearanceId = id;
  }
  return edited;
}

function classEdit(args: Args, record: ClassRecord, creating = false): ClassRecord {
  const edited = { ...record, name: authoredName(args, record.name) };
  const end = args.maxHpAtLevel99;
  const current = record.parameterCurves.maxHp;
  if (typeof end !== "number" || end === current[ACTOR_LEVEL_MAX - 1]) return edited;
  if (end < current[0]) throw new PrimitiveError("99레벨 최대 체력은 1레벨 최대 체력 이상이어야 해요.");
  if (!creating && end < current[ACTOR_LEVEL_MAX - 2]) {
    throw new PrimitiveError("99레벨 최대 체력은 98레벨 최대 체력 이상이어야 해요.");
  }
  if (creating) {
    const patch = { parameterCurves: { maxHp: [current[0], end] } };
    expandShortParameterCurves(patch, "직업", []);
    edited.parameterCurves = { ...record.parameterCurves, ...patch.parameterCurves };
  } else {
    const maxHp = current.slice();
    maxHp[ACTOR_LEVEL_MAX - 1] = end;
    edited.parameterCurves = { ...record.parameterCurves, maxHp };
  }
  return edited;
}

function appearanceEdit(ctx: PrimitiveContext, args: Args, record: CharacterAppearanceRecord): CharacterAppearanceRecord {
  const edited = {
    ...record,
    name: authoredName(args, record.name),
    description: typeof args.description === "string" ? args.description : record.description,
  };
  if (args.charsetResourceId === null) delete edited.charset;
  if (typeof args.charsetResourceId === "string") {
    const resourceId = args.charsetResourceId.trim();
    edited.charset = { resourceId, characterIndex: resourceId === record.charset?.resourceId ? record.charset.characterIndex : 0 };
  }
  if (typeof args.characterIndex === "number") {
    if (!edited.charset) throw new PrimitiveError("걷기 그림을 먼저 연결해 주세요.");
    edited.charset = { ...edited.charset, characterIndex: args.characterIndex };
  }
  for (const [slot, key] of [["face", "faceResourceId"], ["bust", "bustResourceId"], ["full", "fullResourceId"]] as const) {
    const value = args[key];
    if (value === null) delete edited[slot];
    if (typeof value === "string") edited[slot] = { resourceId: value.trim() };
  }
  try {
    validateCharacterAppearances([edited]);
  } catch {
    throw new PrimitiveError("외형에 넣을 이름, 설명이나 그림 칸을 확인해 주세요.");
  }
  const issues = (appearance: CharacterAppearanceRecord) => characterAppearanceReferenceIssues({
    ...ctx.project, database: { ...ctx.project.database, characterAppearances: [appearance] },
  });
  const previous = new Set(issues(record));
  if (issues(edited).some(issue => !previous.has(issue))) {
    throw new PrimitiveError("그림을 찾을 수 없거나 외형 칸에 맞지 않아요.");
  }
  return edited;
}

function databaseFamily<C extends Collection>(collection: C, config: {
  readonly rows: (project: Project) => readonly Records[C][];
  readonly fields: Record<string, JsonSchema>;
  readonly create: (ctx: PrimitiveContext, id: string, selected: Records[C], args: Args) => Records[C];
  readonly update: (ctx: PrimitiveContext, args: Args, record: Records[C]) => Records[C];
  readonly updateSentence?: (args: Args) => string | undefined;
}): SmallTaskPrimitive[] {
  const label = labels[collection];
  return (["create", "update", "delete"] as const).map((operation): SmallTaskPrimitive => ({
    id: `db.${collection}.${operation}`,
    unit: UNIT,
    title: `${label} ${verbs[operation]}`,
    covers: { collections: [collection] },
    targets: ["dbEntry"],
    args: {
      type: "object", additionalProperties: false,
      description: operation === "delete" ? "선택한 항목을 삭제합니다" : "요청한 항목의 값만 적습니다",
      properties: operation === "delete" ? {} : config.fields,
      ...(operation === "create" ? { required: ["name"] } : {}),
    },
    scope(ctx) {
      const records = config.rows(ctx.project);
      const selected = records[targetIndex(ctx, collection, records)];
      return operation === "create"
        ? { kind: "dbEntries", entries: [], create: { collection, max: 1 } }
        : { kind: "dbEntries", entries: [{ collection, id: selected.id }], ...(operation === "delete" ? { remove: true } : {}) };
    },
    describe(ctx, args) {
      const records = config.rows(ctx.project);
      const record = records[targetIndex(ctx, collection, records)];
      const currentName = previewName(record.name === record.id ? "" : record.name, "");
      const subject = currentName ? `${label} ${currentName}` : `선택한 ${label}`;
      const nextName = typeof args.name === "string" ? previewName(args.name, "새 이름") : undefined;
      if (operation === "create") return `새 ${label}${nextName ? ` ${nextName}` : ""} 항목을 추가해요.`;
      if (operation === "delete") return `${subject} 항목을 삭제해요.`;
      if (Object.keys(args).length === 1) {
        if (nextName) return `${subject}의 이름을 ${nextName}${roJosa(nextName.slice(1, -1))} 바꿔요.`;
        const change = config.updateSentence?.(args);
        if (change) return `${subject}의 ${change}`;
      }
      return `${subject} 항목을 수정해요.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const records = config.rows(project);
      const index = targetIndex(ctx, collection, records);
      const selected = records[index];
      const edited = [...records];
      const proposed = { ...project, database: { ...project.database, [collection]: edited } };
      if (operation === "create") {
        edited.push(config.create(ctx, nextId(withOpenEventDrafts(project, ctx.live), collection, records), selected, args));
        if (collection === "actors") assertActorCreation(withOpenEventDrafts(proposed, ctx.live), records.length);
      }
      if (operation === "update") {
        if (!Object.keys(args).length) throw new PrimitiveError("바꿀 내용을 입력해 주세요.");
        edited[index] = config.update(ctx, args, selected);
        if (dialogueUsesName(project, collection, selected, proposed)) {
          throw new PrimitiveError("대사에 이 이름과 연결된 화자가 있어요. 대사의 화자를 먼저 확인해 주세요.");
        }
      }
      if (operation === "delete") {
        const sites = referenceIndex(project, new Set([selected.id])).get(selected.id) ?? [];
        if (outsideRecord(sites, ["database", collection, index]).length) {
          throw new PrimitiveError(`사용 중인 ${label} 항목이에요. 다른 곳의 연결을 먼저 해제해 주세요.`);
        }
        if (collection === "actors") assertActorDeletion(withOpenEventDrafts(project, ctx.live), index);
        edited.splice(index, 1);
        if (dialogueUsesName(project, collection, selected, proposed)) {
          throw new PrimitiveError(`대사에서 이름으로 사용하는 ${label} 항목이에요. 대사의 화자를 먼저 확인해 주세요.`);
        }
      }
      return proposed;
    },
  }));
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  ...databaseFamily("actors", {
    rows: project => project.database.actors,
    fields: actorFields,
    create(ctx, id, selected, args) {
      const classId = ctx.project.database.classes.find(record => record.id === selected.classId)?.id
        ?? ctx.project.database.classes[0]?.id;
      if (classId === undefined) throw new PrimitiveError("주인공에게 연결할 직업을 먼저 만들어 주세요.");
      return actorEdit(ctx, { classId, ...args }, { ...createActorRecord(id, classId), nickname: "" });
    },
    update: actorEdit,
    updateSentence: args => typeof args.initialLevel === "number" ? `시작 레벨을 ${args.initialLevel}레벨로 바꿔요.` : undefined,
  }),
  ...databaseFamily("classes", {
    rows: project => project.database.classes,
    fields: classFields,
    create: (_ctx, id, _selected, args) => classEdit(args, normalizeClassRecord({ id, name: "새 직업" }), true),
    update: (_ctx, args, record) => classEdit(args, record),
    updateSentence: args => typeof args.maxHpAtLevel99 === "number" ? `99레벨 최대 체력만 ${args.maxHpAtLevel99}점으로 바꿔요.` : undefined,
  }),
  ...databaseFamily("characterAppearances", {
    rows: project => project.database.characterAppearances ?? [],
    fields: appearanceFields,
    create: (ctx, id, _selected, args) => appearanceEdit(ctx, args, { id, name: "새 외형", description: "" }),
    update: appearanceEdit,
  }),
];
