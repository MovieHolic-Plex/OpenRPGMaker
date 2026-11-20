import { newM2Command } from "@/editor/eventCommandFactory";
import type { JsonSchema } from "@/editor/tools/types";
import { M2_COMMAND_CATALOG, type M2CommandCatalogEntry, type M2CommandFieldSpec } from "@/project/eventCommands/m2Catalog";
import { EventCommandEditError, eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import type { M2CommandFields } from "@/project/types";
import { commandListAt, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { ROWS, type ModernLogicRow } from "./14-m2-modern-logic/rows";

export const UNIT = "14-m2-modern-logic";

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
  const fieldProperties = Object.fromEntries(entry.fields.map(spec => [
    spec.key, fieldSchema(spec, row.descriptions?.[spec.key]),
  ]));
  function edit(ctx: PrimitiveContext, args: Record<string, unknown>) {
    const { page } = scopedPage(ctx);
    const branchPath = (args.branchPath ?? []) as number[];
    const list = commandListAt(page, branchPath);
    const index = (args.index ?? list.length) as number;
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
      throw new PrimitiveError("범위 밖: 고르신 줄에 같은 종류의 명령이 없습니다.");
    }
    if (Object.keys(editFields).length === 0) throw new PrimitiveError("바꿀 명령 항목을 한 가지 이상 입력해 주세요.");
    return {
      path,
      hash: (args.expectedHash as string | undefined) ?? eventCommandHash(current),
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
        index: { type: "integer", minimum: 0, description: update ? "고칠 줄의 위치. 첫 줄은 0입니다." : "추가할 위치. 첫 줄은 0이고, 생략하면 목록 끝입니다." },
        branchPath: { type: "array", items: { type: "integer" }, description: "분기 안이면 이벤트 읽기에서 받은 분기 경로. 바깥 목록이면 생략합니다." },
        ...(update ? { expectedHash: { type: "string", minLength: 1, description: "이벤트 읽기에서 받은 줄의 내용 확인값. 읽은 뒤 줄이 바뀌었는지 확인합니다." } } : {}),
        ...fieldProperties,
      },
      required: update ? ["index"] : (row.required ?? []),
    },
    scope,
    describe(ctx, args) {
      const prepared = edit(ctx, args);
      return koreanSentence(`${row.detail(ctx, prepared.validationFields)} 명령을 ${verb}합니다.`);
    },
    apply(ctx, args) {
      const { command, path, hash, validationFields } = edit(ctx, args);
      row.validate?.(ctx, validationFields);
      try {
        return updateScopedPage(ctx, page => hash === undefined
          ? insertEventCommand(page, path, command)
          : updateEventCommand(page, path, { fields: command.fields }, hash));
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

const checkpointAlias: SmallTaskPrimitive = {
  id: "m2.213.insert",
  unit: UNIT,
  title: "체크포인트 저장 추가",
  covers: { m2Ids: ["m2-213"] },
  targets: ["event"],
  args: { type: "object", description: "체크포인트 저장 명령과 같은 입력입니다." },
  aliasOf: "cmd.checkpointSave.insert",
  hidden: true,
  scope,
  describe: () => "체크포인트 저장 명령을 추가합니다.",
  apply() { throw new PrimitiveError("체크포인트 저장 명령을 불러올 수 없습니다."); },
};

export const PRIMITIVES: readonly SmallTaskPrimitive[] = M2_COMMAND_CATALOG.flatMap(entry => {
  if (entry.index === 213) return [checkpointAlias];
  const row = ROWS[entry.index];
  return row ? [commandEdit(entry, row, false), commandEdit(entry, row, true)] : [];
});
