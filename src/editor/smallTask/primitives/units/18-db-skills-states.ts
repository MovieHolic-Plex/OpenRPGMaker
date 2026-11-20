import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { freshChoreographyId } from "@/assets/retroChoreographyClone";
import { resolveSkillChoreography, retroFxSheetKeys, retroFxSheetMeta } from "@/assets/retroSkillCatalog";
import { normalizeBlendMode } from "@/project/blendMode";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { collectResourceIds, validateOptionalResource } from "@/project/io/resourceReferenceValidation";
import {
  normalizeSkillChoreographyRecord, SKILL_CHOREOGRAPHY_ANCHORS, SKILL_CHOREOGRAPHY_LIMIT,
  SKILL_CHOREOGRAPHY_MOTIONS, SKILL_CHOREOGRAPHY_RANGES,
} from "@/project/skillChoreographyRecords";
import type { BattleAnimationRecord, Project, SkillChoreographyRecord, SkillRecord, StateRecord } from "@/project/types";
import { outsideRecord, referenceIndex } from "@/editor/tools/dbReferenceIndex";
import type { JsonSchema } from "@/editor/tools/types";
import { displayText } from "../../target";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "18-db-skills-states";

type Records = {
  skills: SkillRecord;
  states: StateRecord;
  skillChoreographies: SkillChoreographyRecord;
  battleAnimations: BattleAnimationRecord;
};
type Collection = keyof Records;
type Args = Record<string, unknown>;
type Edit = "create" | "update" | "delete";
type Shortcut = { readonly field: string; readonly title: string };
type Editor<K extends Collection> = {
  readonly fields: Record<string, JsonSchema>;
  readonly prefix: string;
  create(project: Project, id: string, name: string): Records[K];
  patch(project: Project, row: Records[K], args: Args): Records[K];
};

const nameField = { type: "string", minLength: 1, maxLength: 80, description: "자료집에 표시할 이름" } as const;
const textField = (description: string, maxLength = 96): JsonSchema => ({ type: "string", maxLength, description });
const integer = (minimum: number, maximum: number, description: string): JsonSchema =>
  ({ type: "integer", minimum, maximum, description });
const choice = (values: readonly string[], description: string): JsonSchema =>
  ({ type: "string", enum: values, description });

function selectedId(ctx: PrimitiveContext, collection: Collection): string {
  if (ctx.target.kind !== "dbEntry" || ctx.target.collection !== collection) {
    throw new PrimitiveError("범위 밖입니다. 같은 자료집 묶음에서 작업 대상을 골라 주세요.");
  }
  return ctx.target.id;
}

function rows<K extends Collection>(project: Project, collection: K): readonly Records[K][] {
  const database: { [C in Collection]?: Records[C][] } = project.database;
  return database[collection] ?? [];
}

function selectedRow<K extends Collection>(ctx: PrimitiveContext, collection: K, id: string): Records[K] {
  const row = rows(ctx.project, collection).find(entry => entry.id === id);
  if (!row) throw new PrimitiveError("범위 밖입니다. 선택한 자료집 항목을 찾을 수 없어요.");
  return row;
}

function withRows<K extends Collection>(project: Project, collection: K, next: Records[K][]): Project {
  return { ...project, database: { ...project.database, [collection]: next } };
}

function nextId<K extends Collection>(project: Project, collection: K, prefix: string, name: string): string {
  if (collection === "skillChoreographies") return freshChoreographyId(project.database.skillChoreographies ?? [], name);
  const used = new Set(rows(project, collection).map(row => row.id));
  let n = 1;
  while (used.has(`${prefix}_${n}`)) n += 1;
  return `${prefix}_${n}`;
}

function cleanName(value: string): string {
  const name = value.trim();
  if (!name) throw new PrimitiveError("이름을 입력해 주세요.");
  return name;
}

function previewName(value: string, fallback: string, id?: string): string {
  const name = displayText(value === id ? "" : value, fallback).replace(/[{}\[\]「」.!?。！？]/gu, "");
  return name.trim().slice(0, 24) || fallback;
}

function ensureUnused(project: Project, collection: Collection, id: string, index: number): void {
  if ((collection === "skills" && id === "skill_attack") || (collection === "states" && id === "state_death")) {
    throw new PrimitiveError("게임에 꼭 필요한 기본 항목이에요.");
  }
  if (outsideRecord(referenceIndex(project, new Set([id])).get(id) ?? [], ["database", collection, index]).length) {
    throw new PrimitiveError("다른 곳에서 사용 중인 항목이에요. 먼저 연결을 정리해 주세요.");
  }
}

function resource(project: Project, value: unknown, message: string): string | undefined {
  if (value === undefined) return undefined;
  const id = (value as string).trim();
  if (!id) return undefined;
  try {
    validateOptionalResource("소재", id, collectResourceIds(project));
  } catch {
    throw new PrimitiveError(message);
  }
  return id;
}

const skillEditor: Editor<"skills"> = {
  prefix: "skill_small_task",
  fields: {
    description: textField("스킬 설명", 512),
    power: integer(-9999, 9999, "스킬 위력"),
    mpCost: integer(0, 9999, "고정 마력 소모량"),
    mpPercent: integer(0, 100, "최대 마력에 비례하는 소모율"),
    scope: choice(["self", "ally", "allAllies", "enemy", "allEnemies"], "대상은 자신, 아군 하나, 아군 전체, 적 하나, 적 전체 순서"),
    animationId: textField("연결할 전투 애니메이션 식별자. 빈 문자열이면 연결 해제"),
    retroChoreographyId: textField("연결할 도트 연출 식별자. 빈 문자열이면 연결 해제"),
    stateId: textField("명중 시 부여할 상태 식별자"),
  },
  create: (_project, id, name) => normalizeSkillRecord({ id, name }),
  patch(project, row, args) {
    const next = { ...row };
    if (args.description !== undefined) next.description = args.description as string;
    if (args.power !== undefined) next.power = args.power as number;
    if (args.mpCost !== undefined || args.mpPercent !== undefined) {
      next.mpCost = {
        flat: (args.mpCost as number | undefined) ?? row.mpCost?.flat ?? 0,
        percentMax: (args.mpPercent as number | undefined) ?? row.mpCost?.percentMax ?? 0,
      };
    }
    if (args.scope !== undefined) next.scope = args.scope as SkillRecord["scope"];
    if (args.animationId !== undefined) {
      const id = (args.animationId as string).trim();
      if (id && !project.database.battleAnimations.some(entry => entry.id === id)) {
        throw new PrimitiveError("연결할 전투 애니메이션을 찾을 수 없어요.");
      }
      if (id) next.animationId = id;
      else delete next.animationId;
    }
    if (args.retroChoreographyId !== undefined) {
      const id = (args.retroChoreographyId as string).trim();
      const resolved = resolveSkillChoreography({ id: row.id, retroChoreographyId: id }, project.database.skillChoreographies);
      if (id && resolved?.id !== id) throw new PrimitiveError("연결할 수 있는 스킬 연출을 찾을 수 없어요.");
      if (id) next.retroChoreographyId = id;
      else delete next.retroChoreographyId;
    }
    if (args.stateId !== undefined) {
      const stateId = (args.stateId as string).trim();
      if (!project.database.states.some(entry => entry.id === stateId)) throw new PrimitiveError("부여할 상태를 찾을 수 없어요.");
      const effects = next.stateEffects ?? [];
      if (!effects.some(effect => effect.stateId === stateId && effect.operation === "add")) {
        // 부여와 해제가 같은 명중에서 충돌하지 않도록 같은 상태의 효과만 교체한다.
        next.stateEffects = [...effects.filter(effect => effect.stateId !== stateId), { stateId, operation: "add", chance: 100 }];
      }
    }
    return next;
  },
};

const stateEditor: Editor<"states"> = {
  prefix: "state_small_task",
  fields: {
    recoverTurns: integer(1, 999, "이 턴부터 자연 회복. 확률을 생략하면 해당 턴에 확정 해제"),
    recoverChance: integer(0, 100, "자연 회복 확률"),
    recoverWhenHitChance: integer(0, 100, "맞았을 때 풀릴 확률"),
    clearOnBattleEnd: { type: "boolean", description: "전투가 끝나면 해제할지 여부" },
    iconResourceId: textField("상태 아이콘으로 쓸 소재 식별자. 빈 문자열이면 연결 해제"),
  },
  create: (_project, id, name) => normalizeStateRecord({ id, name }),
  patch(project, row, args) {
    const next = { ...row };
    if (args.recoverTurns !== undefined) {
      next.recoverNaturallyFromTurn = args.recoverTurns as number;
      next.recoverNaturallyChance = 100;
    }
    if (args.recoverChance !== undefined) next.recoverNaturallyChance = args.recoverChance as number;
    if (args.recoverWhenHitChance !== undefined) next.recoverWhenHitChance = args.recoverWhenHitChance as number;
    if (args.clearOnBattleEnd !== undefined) next.clearOnBattleEnd = args.clearOnBattleEnd as boolean;
    if (args.iconResourceId !== undefined) {
      const id = resource(project, args.iconResourceId, "상태 아이콘으로 쓸 소재를 찾을 수 없어요.");
      if (id) next.iconResourceId = id;
      else delete next.iconResourceId;
    }
    return next;
  },
};

const choreographyEditor: Editor<"skillChoreographies"> = {
  prefix: "chor",
  fields: {
    description: textField("스킬 연출 설명", 400),
    motion: choice(SKILL_CHOREOGRAPHY_MOTIONS, "시전자 동작"),
    speed: { type: "number", minimum: SKILL_CHOREOGRAPHY_RANGES.speed[0], maximum: SKILL_CHOREOGRAPHY_RANGES.speed[1], description: "재생 속도 배율" },
    sheet: { type: "string", minLength: 1, maxLength: 96, description: "첫 효과 층에 연결할 도트 그림 식별자" },
    anchor: choice(SKILL_CHOREOGRAPHY_ANCHORS, "첫 효과 층이 표시될 위치"),
  },
  create(project, id, name) {
    if (rows(project, "skillChoreographies").length >= SKILL_CHOREOGRAPHY_LIMIT) {
      throw new PrimitiveError("스킬 연출을 더 만들 수 없어요.");
    }
    const sheet = retroFxSheetKeys()[0];
    const record = normalizeSkillChoreographyRecord({ id, name, motion: "cast", layers: [{ sheet, anchor: "target" }] });
    if (!record) throw new PrimitiveError("기본 효과 그림을 찾을 수 없어요.");
    return record;
  },
  patch(_project, row, args) {
    const next = { ...row };
    if (args.description !== undefined) {
      const description = (args.description as string).trim();
      if (description) next.description = description;
      else delete next.description;
    }
    if (args.motion !== undefined) next.motion = args.motion as SkillChoreographyRecord["motion"];
    if (args.speed !== undefined) next.speed = Math.round((args.speed as number) * 100) / 100;
    if (args.sheet !== undefined || args.anchor !== undefined) {
      const [first, ...rest] = row.layers;
      const sheet = (args.sheet as string | undefined)?.trim() ?? first?.sheet;
      if (!sheet || !retroFxSheetMeta(sheet)) throw new PrimitiveError("연출에 쓸 효과 그림을 찾을 수 없어요.");
      const anchor = (args.anchor as SkillChoreographyRecord["layers"][number]["anchor"] | undefined) ?? first?.anchor ?? "target";
      next.layers = [{ ...first, sheet, anchor }, ...rest];
    }
    return next;
  },
};

const animationEditor: Editor<"battleAnimations"> = {
  prefix: "anim_small_task",
  fields: {
    resourceId: textField("애니메이션에 쓸 그림 소재 식별자. 빈 문자열이면 연결 해제"),
    scope: choice(["singleTarget", "allTargets", "screen"], "표시 범위는 대상 하나, 대상 전체, 화면 전체 순서"),
    position: choice(["head", "center", "feet", "screen"], "표시 위치는 머리, 가운데, 발밑, 화면 순서"),
    large: { type: "boolean", description: "큰 애니메이션 표시 여부" },
    blendMode: choice(["normal", "add", "screen", "multiply"], "겹치기 방식은 보통, 더하기, 밝게, 곱하기 순서"),
  },
  create: (_project, id, name) => normalizeBattleAnimationRecord({ id, name }),
  patch(project, row, args) {
    const next = { ...row };
    if (args.resourceId !== undefined) {
      const id = resource(project, args.resourceId, "애니메이션에 쓸 그림 소재를 찾을 수 없어요.");
      if (id) next.resourceId = id;
      else delete next.resourceId;
    }
    if (args.scope !== undefined) next.scope = args.scope as BattleAnimationRecord["scope"];
    if (args.position !== undefined) next.position = args.position as BattleAnimationRecord["position"];
    if (args.large !== undefined) next.large = args.large as boolean;
    if (args.blendMode !== undefined) {
      const blendMode = normalizeBlendMode(args.blendMode);
      if (blendMode) next.blendMode = blendMode;
      else delete next.blendMode;
    }
    return next;
  },
};

const verbs = { create: "추가", update: "수정", delete: "삭제" } as const;

function databasePrimitives<K extends Collection>(collection: K, editor: Editor<K>, shortcut?: Shortcut): SmallTaskPrimitive[] {
  const label = DATABASE_AREA_LABELS[collection];
  const primitive = (edit: Edit, field?: Shortcut): SmallTaskPrimitive => ({
    id: `db.${collection}.${field ? `${field.field}.set` : edit}`,
    unit: UNIT,
    title: field?.title ?? `${label} ${verbs[edit]}`,
    covers: { collections: [collection] },
    targets: ["dbEntry"],
    args: {
      type: "object",
      properties: field ? { [field.field]: editor.fields[field.field]! }
        : edit === "delete" ? {} : { name: nameField, ...editor.fields },
      required: field ? [field.field] : edit === "create" ? ["name"] : [],
      additionalProperties: false,
    },
    scope(ctx): SmallTaskScope {
      const id = selectedId(ctx, collection);
      return edit === "create"
        ? { kind: "dbEntries", entries: [], create: { collection, max: 1 } }
        : { kind: "dbEntries", entries: [{ collection, id }], ...(edit === "delete" ? { remove: true } : {}) };
    },
    describe(ctx, args) {
      const current = edit === "create" ? undefined : selectedRow(ctx, collection, selectedId(ctx, collection));
      const name = previewName(current?.name ?? args.name as string, label, current?.id);
      if (edit === "update" && Object.keys(args).length === 1) {
        if (typeof args.name === "string") return `「${name}」의 새 이름은 「${previewName(args.name, label)}」입니다.`;
        if (collection === "skills" && typeof args.mpCost === "number") return `「${name}」의 고정 마력 소모량은 ${args.mpCost}입니다.`;
        if (collection === "states" && typeof args.recoverTurns === "number") return `「${name}」 상태가 ${args.recoverTurns}턴째에 풀리게 합니다.`;
      }
      return `${label} 「${name}」 항목을 ${verbs[edit]}합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const id = selectedId(ctx, collection);
      const before = rows(project, collection);
      if (edit === "create") {
        if (id) selectedRow(ctx, collection, id);
        const name = cleanName(args.name as string);
        const row = editor.create(project, nextId(project, collection, editor.prefix, name), name);
        return withRows(project, collection, [...before, editor.patch(project, row, args)]);
      }
      const row = selectedRow(ctx, collection, id);
      if (edit === "delete") {
        ensureUnused(project, collection, id, before.indexOf(row));
        return withRows(project, collection, before.filter(entry => entry !== row));
      }
      if (!Object.keys(args).length) throw new PrimitiveError("바꿀 내용을 입력해 주세요.");
      const next = editor.patch(project, row, args);
      if (typeof args.name === "string") next.name = cleanName(args.name);
      return withRows(project, collection, before.map(entry => entry === row ? next : entry));
    },
  });
  const primitives = [primitive("create"), primitive("update"), primitive("delete")];
  if (shortcut) primitives.push(primitive("update", shortcut));
  return primitives;
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  ...databasePrimitives("skills", skillEditor, { field: "mpCost", title: "스킬 마력 소모 설정" }),
  ...databasePrimitives("states", stateEditor, { field: "recoverTurns", title: "상태 해제 턴 설정" }),
  ...databasePrimitives("skillChoreographies", choreographyEditor),
  ...databasePrimitives("battleAnimations", animationEditor),
];
