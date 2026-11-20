import { newM2Command } from "@/editor/eventCommandFactory";
import type { JsonSchema } from "@/editor/tools/types";
import { M2_COMMAND_CATALOG, type M2CommandCatalogEntry, type M2CommandFieldSpec } from "@/project/eventCommands/m2Catalog";
import { EventCommandEditError, eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import type { M2CommandFields } from "@/project/types";
import { commandListAt, insertAtIndex, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { PRIMITIVES as movementPrimitives } from "./09-cmd-move-system";
import { ROWS, type ModernLogicRow } from "./14-m2-modern-logic/rows";
import { validateRecordEdit } from "./14-m2-modern-logic/recordReferences";

export const UNIT = "14-m2-modern-logic";

const insertIndex: JsonSchema = { type: "integer", minimum: 0, description: "추가할 위치입니다. 첫 줄은 0이고, 생략하면 목록 끝에 넣습니다." };
const branchPathSchema: JsonSchema = { type: "array", items: { type: "integer" }, description: "분기 안의 줄이면 이벤트를 읽을 때 받은 분기 경로를 입력합니다." };
type Position = { index?: number; branchPath?: number[] };

function scope(ctx: PrimitiveContext) {
  const { map, event, page } = scopedPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id } as const;
}

function fieldSchema(spec: M2CommandFieldSpec, description: string | undefined): JsonSchema {
  const label = description ?? spec.label;
  if (spec.type === "number") {
    return { type: "integer", description: label, minimum: spec.min ?? 0, maximum: spec.max ?? Number.MAX_SAFE_INTEGER };
  }
  if (spec.type === "boolean") return { type: "boolean", description: label };
  if (!spec.options) return { type: "string", description: label };
  const options = spec.options.map(option => option.label
    .replaceAll("HUD", "상태 표시").replaceAll("HP", "체력").replaceAll("MP", "마력")
    .replace("주인공 X", "주인공 가로 위치").replace("주인공 Y", "주인공 세로 위치"));
  return {
    type: "string",
    description: `${label}. ${options.join(" · ")} 중 하나.`,
    enum: spec.options.map(option => option.value),
  };
}

function commandEdit(entry: M2CommandCatalogEntry, row: ModernLogicRow, update: boolean): SmallTaskPrimitive {
  const verb = update ? "수정" : "추가";
  const fieldProperties = Object.fromEntries(entry.fields.map(spec => {
    const field = entry.index === 214 && spec.key === "surface"
      ? { ...spec, options: spec.options?.filter(option => ["toast", "banner", "objectiveChip"].includes(option.value)) }
      : spec;
    return [spec.key, fieldSchema(field, row.descriptions?.[spec.key])];
  }));
  function edit(ctx: PrimitiveContext, args: Record<string, unknown>) {
    const { page } = scopedPage(ctx);
    const branchPath = (args.branchPath ?? []) as number[];
    const list = commandListAt(page, branchPath);
    const index = (args.index ?? list.length) as number;
    if (!Number.isSafeInteger(index) || index < 0 || index > list.length || (update && index === list.length)) {
      throw new PrimitiveError("그 위치에 명령 줄이 없습니다. 이벤트 페이지를 다시 확인해 주세요.");
    }
    const path = [...branchPath, index];
    const editFields = Object.fromEntries(entry.fields
      .filter(spec => Object.hasOwn(args, spec.key))
      .map(spec => {
        const value = args[spec.key];
        return [spec.key, typeof value === "string" && (spec.key.endsWith("Id") || spec.key === "target") ? value.trim() : value];
      })) as M2CommandFields;

    const command = newM2Command(entry.id);
    if (!update) {
      const fields = { ...command.fields, ...editFields };
      return { path, hash: undefined, command: { ...command, fields }, validationFields: fields };
    }
    const current = list[index];
    if (current?.kind !== "m2Command" || current.commandId !== entry.id) {
      throw new PrimitiveError("범위 밖: 선택한 줄은 이 동작으로 수정할 수 없는 명령입니다.");
    }
    const hash = eventCommandHash(current);
    if (args.expectedHash !== hash) {
      throw new PrimitiveError("그 줄의 내용이 바뀌었습니다. 다시 읽은 뒤 수정해 주세요.");
    }
    if (Object.keys(editFields).length === 0) throw new PrimitiveError("바꿀 명령 항목을 한 가지 이상 입력해 주세요.");
    return {
      path,
      hash,
      current,
      list,
      command: { ...current, fields: { ...current.fields, ...editFields } },
      // Older stored commands may omit new fields. Validate with factory defaults without writing them back.
      validationFields: { ...command.fields, ...current.fields, ...editFields },
    };
  }

  return {
    id: `m2.${entry.index}.${update ? "update" : "insert"}`,
    unit: UNIT,
    title: `${row.title ?? entry.label} ${verb}`,
    covers: { m2Ids: [`m2-${entry.index}`] },
    targets: ["event"],
    args: {
      type: "object",
      additionalProperties: false,
      properties: {
        index: update ? { ...insertIndex, description: "고칠 줄의 위치입니다. 첫 줄은 0입니다." } : insertIndex,
        branchPath: branchPathSchema,
        ...(update ? { expectedHash: { type: "string", minLength: 1, description: "이벤트를 읽을 때 수정할 줄에서 받은 확인값입니다." } } : {}),
        ...fieldProperties,
      },
      required: update ? ["index", "expectedHash"] : (row.required ?? []),
    },
    scope,
    describe(ctx, args) {
      const prepared = edit(ctx, args);
      const fields = row.prepare?.(prepared.validationFields, prepared.validationFields, args) ?? prepared.validationFields;
      return koreanSentence(`${row.detail(ctx, fields)} 명령을 ${verb}합니다.`);
    },
    apply(ctx, args) {
      const { command, path, hash, current, list, validationFields } = edit(ctx, args);
      row.validate?.(ctx, validationFields, args);
      const fields = row.prepare?.(command.fields, validationFields, args) ?? command.fields;
      if (current) validateRecordEdit(ctx.project, current, fields, list, path.at(-1)!);
      try {
        return updateScopedPage(ctx, page => hash === undefined
          ? insertEventCommand(page, path, { ...command, fields })
          : updateEventCommand(page, path, { fields }, hash));
      } catch (error) {
        if (!(error instanceof EventCommandEditError)) throw error;
        if (error.code === "stale-event-command") {
          throw new PrimitiveError("그 줄의 내용이 바뀌었습니다. 다시 읽은 뒤 수정하세요.");
        }
        throw new PrimitiveError("명령 줄 위치나 입력값을 다시 확인해 주세요.");
      }
    },
  };
}

const checkpointInsert: SmallTaskPrimitive<Position & Record<string, unknown>> = {
  id: "m2.213.insert",
  unit: UNIT,
  title: "체크포인트 저장 추가",
  covers: { m2Ids: ["m2-213"] },
  // This PR can run on the shared base before unit 09 is integrated.
  ...(movementPrimitives.some(primitive => primitive.id === "cmd.checkpointSave.insert")
    ? { aliasOf: "cmd.checkpointSave.insert", hidden: true }
    : {}),
  targets: ["event"],
  args: {
    type: "object",
    additionalProperties: false,
    properties: {
      index: insertIndex,
      branchPath: branchPathSchema,
      label: { type: "string", description: "체크포인트 이름입니다. 이름 없이 저장하려면 생략합니다." },
    },
  },
  scope,
  describe: () => "체크포인트 저장 명령을 추가합니다.",
  apply(ctx, { label, index, branchPath }) {
    return insertAtIndex(ctx, { kind: "checkpointSave", ...(typeof label === "string" ? { label } : {}) }, index, branchPath);
  },
};

export const PRIMITIVES: readonly SmallTaskPrimitive[] = M2_COMMAND_CATALOG.flatMap(entry => {
  if (entry.index === 213) return [checkpointInsert];
  const row = ROWS[entry.index];
  return row ? [commandEdit(entry, row, false), commandEdit(entry, row, true)] : [];
});
