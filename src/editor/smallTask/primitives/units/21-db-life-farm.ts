import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { displayText } from "@/editor/smallTask/target";
import { outsideRecord, referenceIndex } from "@/editor/tools/dbReferenceIndex";
import type { JsonSchema } from "@/editor/tools/types";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { validateDatabase } from "@/project/io/shapeDatabaseFields";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { records, type Collection, type EditArgs, type LifeFarmRecord } from "./21-db-life-farm/records";

export const UNIT = "21-db-life-farm";

const labels: Readonly<Record<string, string>> = {
  ...DATABASE_AREA_LABELS,
  homeDecorationTypes: "집 장식",
  schedules: "일정표",
};

const idSchema: JsonSchema = {
  type: "string",
  description: "영문자로 시작하는 새 항목 값. 영문자, 숫자, 밑줄, 붙임표를 쓸 수 있습니다.",
  minLength: 1,
  maxLength: 120,
  pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
};

function targetFor(ctx: PrimitiveContext, collection: Collection) {
  if (ctx.target.kind !== "dbEntry" || ctx.target.collection !== collection) {
    throw new PrimitiveError("범위 밖: 이 자료집에서 대상을 골라 주세요.");
  }
  return ctx.target;
}

function scopeFor(ctx: PrimitiveContext, collection: Collection, operation: Operation): SmallTaskScope {
  const target = targetFor(ctx, collection);
  if (operation === "create") return { kind: "dbEntries", entries: [], create: { collection, max: 1 } };
  return {
    kind: "dbEntries",
    entries: [{ collection, id: target.id }],
    ...(operation === "delete" ? { remove: true } : {}),
  };
}

function selectedIndex(rows: readonly LifeFarmRecord[], id: string) {
  const index = rows.findIndex(row => row.id === id);
  if (index < 0) throw new PrimitiveError("선택한 자료집 항목을 찾을 수 없어요.");
  if (rows.some((row, at) => at !== index && row.id === id)) {
    throw new PrimitiveError("선택한 자료집 항목을 하나로 구별할 수 없어요.");
  }
  return index;
}

function checkResult(before: Project, after: Project, collection: Collection) {
  // Validate the edited collection using the same shape contract used when loading a project.
  try {
    validateDatabase({
      actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [],
      troops: [], states: [], battleAnimations: [],
      [collection]: after.database[collection],
    });
  } catch {
    throw new PrimitiveError("입력한 값이나 자료집 항목 수를 확인해 주세요.");
  }

  const issues = collectProjectReferenceIssues(after, { databaseOnly: true });
  if (issues.length) {
    const existing = new Set(collectProjectReferenceIssues(before, { databaseOnly: true }));
    if (issues.some(issue => !existing.has(issue))) {
      throw new PrimitiveError("연결할 자료가 없거나 항목 사이의 연결이 올바르지 않아요.");
    }
  }
}

type Operation = "create" | "update" | "delete";
const actions = {
  create: { title: "추가", sentence: "추가해요" },
  update: { title: "수정", sentence: "수정해요" },
  delete: { title: "삭제", sentence: "삭제해요" },
};

function previewName(record: LifeFarmRecord): string {
  const source = "title" in record ? record.title : record.name;
  return displayText(source === record.id ? "" : source, "선택 항목")
    .replace(/[.!?…。！？{}\[\]「」]/gu, " ").replace(/\s+/gu, " ").trim()
    .slice(0, 46).trim() || "선택 항목";
}

function makePrimitive(collection: Collection, operation: Operation, shortcut?: {
  id: string;
  title: string;
  field: "growthDays" | "goldCost";
  suffix: (value: number) => string;
}): SmallTaskPrimitive {
  const record = records[collection];
  const create = operation === "create";
  const remove = operation === "delete";
  const label = labels[collection];
  const action = actions[operation];
  const properties = shortcut ? { [shortcut.field]: record.fields[shortcut.field]! }
    : create ? { id: idSchema, ...record.fields } : remove ? {} : record.fields;

  function edit(ctx: PrimitiveContext, args: EditArgs) {
    const target = targetFor(ctx, collection);
    const rows = ctx.project.database[collection] ?? [];
    const index = create ? rows.length : selectedIndex(rows, target.id);
    if (create && (!args.id || Object.hasOwn(Object.prototype, args.id))) {
      throw new PrimitiveError("새 항목을 구별할 다른 값을 입력해 주세요.");
    }
    if (create && rows.some(row => row.id === args.id)) {
      throw new PrimitiveError("같은 항목이 이미 있어요. 새 항목을 구별할 값을 사용해 주세요.");
    }

    const previous = rows[index];
    if (remove) return { rows, index, previous: previous!, next: undefined };
    const next = record.edit(args, previous, ctx.project);
    if (previous && jsonEqual(previous, next)) throw new PrimitiveError("선택한 항목에 바뀌는 값이 없어요.");
    return { rows, index, previous, next };
  }

  return {
    id: `db.${collection}.${shortcut?.id ?? operation}`,
    unit: UNIT,
    title: shortcut?.title ?? `${label} ${action.title}`,
    covers: { collections: [collection] },
    targets: ["dbEntry"],
    args: {
      type: "object",
      properties,
      required: shortcut ? [shortcut.field] : create ? ["id", ...record.required] : [],
      additionalProperties: false,
    },
    scope(ctx) {
      return scopeFor(ctx, collection, operation);
    },
    describe(ctx, args) {
      const { previous, next } = edit(ctx, args);
      if (shortcut) return `「${previewName(next!)}」 ${shortcut.suffix(Number(args[shortcut.field]))}`;
      return `${label} 「${previewName(next ?? previous!)}」 항목을 ${action.sentence}.`;
    },
    apply(ctx, args) {
      const { rows, index, previous, next } = edit(ctx, args);
      if (remove) {
        const references = referenceIndex(ctx.project, new Set([previous!.id]));
        if (outsideRecord(references.get(previous!.id) ?? [], ["database", collection, index]).length) {
          throw new PrimitiveError("이 항목을 쓰는 곳이 있어 삭제할 수 없어요.");
        }
      }
      const updated = [...rows];
      if (next) updated[index] = next;
      else updated.splice(index, 1);
      const after = { ...ctx.project, database: { ...ctx.project.database, [collection]: updated } };
      // Deletion already checks references throughout the project. Comparing index-based messages
      // after removing a row could falsely report existing issues on rows that shifted position.
      if (!remove) checkResult(ctx.project, after, collection);
      return after;
    },
  };
}

const collections = Object.keys(records) as Collection[];

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  ...collections.flatMap(collection => (["create", "update", "delete"] as const)
    .map(operation => makePrimitive(collection, operation))),
  makePrimitive("crops", "update", {
    id: "growthDays.set",
    title: "작물 성장 기간 설정",
    field: "growthDays",
    suffix: value => `성장 기간을 ${value}일로 바꿔요.`,
  }),
  makePrimitive("farmBuildingTypes", "update", {
    id: "goldCost.set",
    title: "농장 건물 건설비 설정",
    field: "goldCost",
    suffix: value => `건설비를 ${value}골드로 바꿔요.`,
  }),
];
