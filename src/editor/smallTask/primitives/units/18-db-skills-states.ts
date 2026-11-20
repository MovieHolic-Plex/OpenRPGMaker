import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { BUNDLED_BATTLE_MOTIONS } from "@/assets/battleMotionCatalog";
import { freshChoreographyId } from "@/assets/retroChoreographyClone";
import { resolveSkillChoreography, retroFxSheetKeys, retroFxSheetMeta } from "@/assets/retroSkillCatalog";
import { abilityContactStatus } from "@/battle/abilities";
import { RAGE_STATE_ID, stateBehavior } from "@/battle/battleStates";
import { normalizeBlendMode } from "@/project/blendMode";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { DEFAULT_ANIMATION_ID, DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import { projectScriptUsage, scriptHasDynamic } from "@/project/script/effects";
import {
  normalizeSkillChoreographyRecord, SKILL_CHOREOGRAPHY_ANCHORS, SKILL_CHOREOGRAPHY_LIMIT,
  SKILL_CHOREOGRAPHY_MOTIONS, SKILL_CHOREOGRAPHY_RANGES,
} from "@/project/skillChoreographyRecords";
import type { BattleAnimationRecord, Project, SkillChoreographyRecord, SkillRecord, StateRecord } from "@/project/types";
import { listDatabaseResourceOptions } from "@/editor/resourceOptions";
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
const bundledChoreographyIds = new Set(BUNDLED_BATTLE_MOTIONS.map(record => record.id));

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

function uniqueRecordIndex(records: readonly { id: string }[], id: string, label: string): number {
  const index = records.findIndex(entry => entry.id === id);
  if (index >= 0 && records.some((entry, position) => position > index && entry.id === id)) {
    throw new PrimitiveError(`${label} 목록에 같은 식별자를 쓰는 항목이 여러 개 있어요. 자료집에서 중복을 먼저 정리해 주세요.`);
  }
  return index;
}

function selectedIndex(records: readonly { id: string }[], id: string, edit: Edit, label: string): number {
  if (edit === "create" && !id && records.length === 0) return -1;
  const index = id ? uniqueRecordIndex(records, id, label) : -1;
  if (index < 0) throw new PrimitiveError("범위 밖입니다. 자료집에서 작업할 항목을 다시 골라 주세요.");
  return index;
}

function withRows<K extends Collection>(project: Project, collection: K, next: Records[K][]): Project {
  return { ...project, database: { ...project.database, [collection]: next } };
}

function nextId<K extends Collection>(project: Project, collection: K, prefix: string, name: string): string {
  const used = new Set(rows(project, collection).map(row => row.id));
  const choreography = collection === "skillChoreographies";
  if (choreography) for (const id of bundledChoreographyIds) used.add(id);
  const base = choreography ? freshChoreographyId([], name) : prefix;
  const candidate = (n: number) => choreography && n === 1 ? base : `${base}_${n}`;
  let n = 1;
  let id = candidate(n);
  // 새 항목이 다른 곳의 끊어진 연결에 갑자기 쓰이지 않도록 한다.
  while (used.has(id) || referenceIndex(project, new Set([id])).has(id)) {
    n += 1;
    id = candidate(n);
  }
  return id;
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
  if ((collection === "skills" && id === DEFAULT_SKILL_ID) ||
      (collection === "states" && id === "state_death") ||
      (collection === "battleAnimations" && id === DEFAULT_ANIMATION_ID)) {
    throw new PrimitiveError("게임이 기본으로 사용 중인 항목이에요. 삭제할 수 없어요.");
  }
  const sites = outsideRecord(referenceIndex(project, new Set([id])).get(id) ?? [], ["database", collection, index]);
  if (sites.some(({ asKey, path }) => asKey || path[0] !== "database" || path.length !== 4 || path[3] !== "id")) {
    throw new PrimitiveError("다른 곳에서 사용 중인 항목이에요. 먼저 연결을 해제해 주세요.");
  }
  if (collection === "states" && id === RAGE_STATE_ID && project.database.skills.some(skill => skill.effect?.kind === "rage")) {
    throw new PrimitiveError("폭주 스킬에서 사용 중인 상태예요. 먼저 스킬의 폭주 효과를 해제해 주세요.");
  }
  if (collection === "states" && project.system.battleModel === "gen1") {
    const status = project.database.states[index]?.gen1MajorStatus;
    if (status && project.database.states.find(state => state.gen1MajorStatus === status)?.id === id &&
        project.database.monsterSpecies?.some(species => abilityContactStatus(species.ability)?.status === status)) {
      throw new PrimitiveError("몬스터의 접촉 특성이 이 상태를 부여해요. 먼저 해당 특성을 바꿔 주세요.");
    }
  }
  const scriptKind = collection === "skills" ? "skill" : collection === "battleAnimations" ? "animation" : undefined;
  if (scriptKind && (projectScriptUsage(project).dynamic(scriptKind) || project.scriptLibrary?.some(module =>
    scriptHasDynamic({ ...module, kind: "script" }, scriptKind)))) {
    throw new PrimitiveError("스크립트에서 어떤 항목을 쓰는지 확인할 수 없어요. 스크립트의 연결을 확인해 주세요.");
  }
}

function resource(project: Project, value: string, kind: "icon" | "battle"): string | undefined {
  const id = value.trim();
  if (!id) return undefined;
  if (!listDatabaseResourceOptions(kind, project).some(option => option.id === id)) {
    throw new PrimitiveError(kind === "icon"
      ? "상태 아이콘으로 고를 수 있는 그림을 찾을 수 없어요."
      : "애니메이션에 쓸 그림 소재를 찾을 수 없어요.");
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
    retroChoreographyId: textField("연결할 도트 연출 식별자. 빈 문자열이면 직접 연결한 연출을 해제하고 기본 연출 사용"),
    stateId: textField("명중 시 부여할 상태 식별자. 같은 상태를 해제하는 효과가 있으면 부여로 변경"),
  },
  create: (_project, id, name) => normalizeSkillRecord({ id, name }),
  patch(project, row, args) {
    const next = { ...row };
    if (args.description !== undefined) next.description = args.description as string;
    if (args.power !== undefined) next.power = args.power as number;
    if (args.mpCost !== undefined || args.mpPercent !== undefined) {
      if (project.system.battleModel === "gen1" && row.maxPp !== undefined) {
        throw new PrimitiveError("이 스킬은 마력 대신 사용 횟수(PP)를 소모해요. 자료집에서 사용 횟수를 바꿔 주세요.");
      }
      next.mpCost = {
        flat: (args.mpCost as number | undefined) ?? row.mpCost?.flat ?? 0,
        percentMax: (args.mpPercent as number | undefined) ?? row.mpCost?.percentMax ?? 0,
      };
    }
    if (args.scope !== undefined) next.scope = args.scope as SkillRecord["scope"];
    if (args.animationId !== undefined) {
      const id = (args.animationId as string).trim();
      if (id && uniqueRecordIndex(project.database.battleAnimations, id, "전투 애니메이션") < 0) {
        throw new PrimitiveError("연결할 전투 애니메이션을 찾을 수 없어요.");
      }
      if (id) next.animationId = id;
      else delete next.animationId;
    }
    if (args.retroChoreographyId !== undefined) {
      const id = (args.retroChoreographyId as string).trim();
      if (!id) {
        delete next.retroChoreographyId;
      } else {
        const records = rows(project, "skillChoreographies");
        if (uniqueRecordIndex(records, id, "스킬 연출") >= 0 && bundledChoreographyIds.has(id)) {
          throw new PrimitiveError("이 스킬 연출은 기본 연출과 식별자가 겹쳐요. 자료집에서 연출 사본을 만든 뒤 연결해 주세요.");
        }
        const requested = resolveSkillChoreography({ id: "", retroChoreographyId: id }, records);
        if (!requested) throw new PrimitiveError("연결할 스킬 연출을 찾을 수 없어요.");
        const resolved = resolveSkillChoreography({ id: row.id, retroChoreographyId: id }, records);
        if (resolved?.id !== requested.id) {
          throw new PrimitiveError("이 스킬은 자체 기본 연출을 써요. 다른 연출을 붙이려면 자료집에서 연출 사본을 만든 뒤 연결해 주세요.");
        }
        next.retroChoreographyId = id;
      }
    }
    if (args.stateId !== undefined) {
      const stateId = (args.stateId as string).trim();
      if (!stateId || uniqueRecordIndex(project.database.states, stateId, "상태") < 0) {
        throw new PrimitiveError("부여할 상태를 찾을 수 없어요.");
      }
      const effects = next.stateEffects ?? [];
      const first = effects.findIndex(effect => effect.stateId === stateId);
      const existingAdd = effects.find(effect => effect.stateId === stateId && effect.operation === "add" && effect.chance > 0);
      const add = existingAdd ?? { stateId, operation: "add" as const, chance: 100 };
      next.stateEffects = first < 0 ? [...effects, add] : [
        ...effects.slice(0, first), add, ...effects.slice(first + 1).filter(effect => effect.stateId !== stateId),
      ];
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
    if (row.id === "state_death" && (args.recoverTurns !== undefined || args.recoverChance !== undefined ||
        args.recoverWhenHitChance !== undefined || args.clearOnBattleEnd === true)) {
      throw new PrimitiveError("전투 불능은 부활할 때 풀려요. 자동 해제를 설정할 수 없어요.");
    }
    if (project.system.battleModel === "gen1" && (
      args.recoverTurns !== undefined || args.recoverWhenHitChance !== undefined ||
      (args.recoverChance !== undefined && row.gen1MajorStatus !== "freeze")
    )) {
      throw new PrimitiveError("포켓몬식 전투에서는 이 상태의 회복 시점과 확률을 전투 규칙이 정해요.");
    }
    if (typeof args.recoverTurns === "number") {
      next.recoverNaturallyFromTurn = args.recoverTurns;
      next.recoverNaturallyChance = 100;
    }
    if (args.recoverChance !== undefined) next.recoverNaturallyChance = args.recoverChance as number;
    if (project.system.battleModel !== "gen1" && (args.recoverTurns !== undefined || args.recoverChance !== undefined)) {
      const { doomTurns, maxTurns, recoverNaturallyFromTurn, recoverNaturallyChance } = stateBehavior(next);
      const recoveryTurn = Math.max(1, Math.ceil(recoverNaturallyFromTurn));
      if (recoverNaturallyChance > 0 && (
        (doomTurns > 0 && doomTurns <= recoveryTurn) || (maxTurns > 0 && maxTurns < recoveryTurn) ||
        (maxTurns === recoveryTurn && recoverNaturallyChance < 100)
      )) {
        throw new PrimitiveError("요청한 자동 해제 설정이 적용되지 않아요. 자료집에서 선고나 최대 지속 턴을 확인해 주세요.");
      }
    }
    if (args.recoverWhenHitChance !== undefined) next.recoverWhenHitChance = args.recoverWhenHitChance as number;
    if (typeof args.clearOnBattleEnd === "boolean") {
      // 전투 종료 스냅샷과 필드에 상태를 넘기는 코드가 각각 이 값을 읽는다.
      next.clearOnBattleEnd = args.clearOnBattleEnd;
      next.runtimeEffects = { ...row.runtimeEffects, removeOnBattleEnd: args.clearOnBattleEnd };
    }
    if (typeof args.iconResourceId === "string") {
      const id = resource(project, args.iconResourceId, "icon");
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
    large: { type: "boolean", description: "큰 애니메이션 표시 여부. 픽셀 효과에는 적용할 수 없음" },
    blendMode: choice(["normal", "add", "screen", "multiply"], "전투에서 겹치기 방식은 보통, 더하기, 밝게, 곱하기 순서"),
  },
  create: (_project, id, name) => normalizeBattleAnimationRecord({ id, name }),
  patch(project, row, args) {
    const next = { ...row };
    if (typeof args.resourceId === "string") {
      const id = resource(project, args.resourceId, "battle");
      if (id && row.pixelFx) {
        throw new PrimitiveError("이 애니메이션은 픽셀 효과를 재생해요. 그림 소재를 쓰려면 자료집에서 먼저 픽셀 효과를 해제해 주세요.");
      }
      if (id) next.resourceId = id;
      else delete next.resourceId;
    }
    if (args.scope !== undefined) next.scope = args.scope as BattleAnimationRecord["scope"];
    if (args.position !== undefined) next.position = args.position as BattleAnimationRecord["position"];
    if (typeof args.large === "boolean") {
      if (row.pixelFx) throw new PrimitiveError("픽셀 효과는 큰 표시 설정을 사용하지 않아요.");
      next.large = args.large;
    }
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
      selectedIndex(rows(ctx.project, collection), id, edit, label);
      return edit === "create"
        ? { kind: "dbEntries", entries: [], create: { collection, max: 1 } }
        : { kind: "dbEntries", entries: [{ collection, id }], ...(edit === "delete" ? { remove: true } : {}) };
    },
    describe(ctx, args) {
      const id = selectedId(ctx, collection);
      const records = rows(ctx.project, collection);
      const current = edit === "create" ? undefined : records[selectedIndex(records, id, edit, label)];
      const name = previewName(current?.name ?? args.name as string, label, current?.id);
      if (edit === "update" && Object.keys(args).length === 1) {
        if (typeof args.name === "string") return `「${name}」의 이름을 「${previewName(args.name, label, id)}」로 바꿉니다.`;
        if (collection === "skills" && typeof args.mpCost === "number") return `「${name}」의 고정 마력 소모량을 ${args.mpCost}로 바꿉니다.`;
        if (collection === "states" && typeof args.recoverTurns === "number") return `「${name}」이 ${args.recoverTurns}턴째에 자동으로 풀리게 합니다.`;
      }
      return `${label} 「${name}」 항목을 ${verbs[edit]}합니다.`;
    },
    apply(ctx, args) {
      const { project } = ctx;
      const id = selectedId(ctx, collection);
      const before = rows(project, collection);
      const index = selectedIndex(before, id, edit, label);
      if (edit === "create") {
        const name = cleanName(args.name as string);
        const row = editor.create(project, nextId(project, collection, editor.prefix, name), name);
        return withRows(project, collection, [...before, editor.patch(project, row, args)]);
      }
      const row = before[index]!;
      if (edit === "delete") {
        ensureUnused(project, collection, id, index);
        return withRows(project, collection, before.filter((_, position) => position !== index));
      }
      if (!Object.keys(args).length) throw new PrimitiveError("바꿀 내용을 입력해 주세요.");
      const next = editor.patch(project, row, args);
      if (typeof args.name === "string") next.name = cleanName(args.name);
      return withRows(project, collection, before.map((entry, position) => position === index ? next : entry));
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
