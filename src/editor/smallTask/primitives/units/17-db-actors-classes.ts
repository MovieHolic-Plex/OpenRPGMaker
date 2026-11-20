import { displayText } from "@/editor/smallTask/target";
import { outsideRecord, referenceIndex } from "@/editor/tools/dbReferenceIndex";
import { expandShortParameterCurves } from "@/editor/tools/parameterCurveInput";
import type { JsonSchema } from "@/editor/tools/types";
import { ACTOR_LEVEL_MAX, ACTOR_LEVEL_MIN, createActorRecord } from "@/project/actorModel";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { normalizeClassRecord } from "@/project/databaseRecordModel";
import { characterAppearanceReferenceIssues, validateCharacterAppearances } from "@/project/io/characterAppearanceValidation";
import type { ActorRecord, CharacterAppearanceRecord, ClassRecord, Project } from "@/project/types";
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
  maxHpAtLevel99: { type: "integer", minimum: 1, maximum: MAX_HP, description: "시작 체력을 유지하며 성장 곡선의 99레벨 최대 체력을 지정" },
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

function nextId(collection: Collection, records: readonly { id: string }[]): string {
  const ids = new Set(records.map(record => record.id));
  const prefix = `${prefixes[collection]}_small_task_`;
  let number = 1;
  while (ids.has(`${prefix}${number}`)) number++;
  return `${prefix}${number}`;
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

function classEdit(_ctx: PrimitiveContext, args: Args, record: ClassRecord): ClassRecord {
  const edited = { ...record, name: authoredName(args, record.name) };
  if (typeof args.maxHpAtLevel99 === "number") {
    const current = record.parameterCurves.maxHp;
    if (args.maxHpAtLevel99 !== current[ACTOR_LEVEL_MAX - 1]) {
      const patch = { parameterCurves: { maxHp: [current[0], args.maxHpAtLevel99] } };
      expandShortParameterCurves(patch, "직업", []);
      edited.parameterCurves = { ...record.parameterCurves, ...patch.parameterCurves };
    }
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
      const currentName = previewName(record.name === record.id ? "" : record.name, `선택한 ${label}`);
      const nextName = typeof args.name === "string" ? previewName(args.name, label) : undefined;
      if (operation === "create") return `${label} ${nextName ?? "새 항목"} 항목을 추가해요.`;
      if (operation === "delete") return `${label} ${currentName} 항목을 삭제해요.`;
      if (Object.keys(args).length === 1) {
        if (nextName) return `${label} ${currentName}의 이름을 ${nextName}${roJosa(nextName.slice(1, -1))} 바꿔요.`;
        const change = config.updateSentence?.(args);
        if (change) return `${label} ${currentName}의 ${change}`;
      }
      return `${label} ${currentName} 항목을 수정해요.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const records = config.rows(project);
      const index = targetIndex(ctx, collection, records);
      const selected = records[index];
      const edited = [...records];
      if (operation === "create") edited.push(config.create(ctx, nextId(collection, records), selected, args));
      if (operation === "update") {
        if (!Object.keys(args).length) throw new PrimitiveError("바꿀 내용을 입력해 주세요.");
        edited[index] = config.update(ctx, args, selected);
      }
      if (operation === "delete") {
        const sites = referenceIndex(project, new Set([selected.id])).get(selected.id) ?? [];
        if (outsideRecord(sites, ["database", collection, index]).length) {
          throw new PrimitiveError(`사용 중인 ${label} 항목은 삭제할 수 없어요.`);
        }
        edited.splice(index, 1);
      }
      return { ...project, database: { ...project.database, [collection]: edited } };
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
    create: (ctx, id, _selected, args) => classEdit(ctx, args, normalizeClassRecord({ id, name: "새 직업" })),
    update: classEdit,
    updateSentence: args => typeof args.maxHpAtLevel99 === "number" ? `99레벨 최대 체력을 ${args.maxHpAtLevel99}점으로 바꿔요.` : undefined,
  }),
  ...databaseFamily("characterAppearances", {
    rows: project => project.database.characterAppearances ?? [],
    fields: appearanceFields,
    create: (ctx, id, _selected, args) => appearanceEdit(ctx, args, { id, name: "새 외형", description: "" }),
    update: appearanceEdit,
  }),
];
