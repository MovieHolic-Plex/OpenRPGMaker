import { newM2Command } from "@/editor/eventCommandFactory";
import type { JsonSchema } from "@/editor/tools/types";
import { M2_COMMAND_CATALOG, m2CatalogEntryRuntimeSupport } from "@/project/eventCommands/m2Catalog";
import { updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import type { Command, M2CommandFields, Project } from "@/project/types";
import { displayText } from "../../target";
import { commandListAt, insertAtIndex, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { ROWS, validateFields, type Row } from "./10-m2-actor-battle/fields";

export const UNIT = "10-m2-actor-battle";
const targets = ["event"] as const;
type M2Command = Extract<Command, { kind: "m2Command" }>;
type Args = Record<string, unknown>;

const indexSchema: JsonSchema = {
  type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER,
  description: "명령 줄 위치입니다. 첫 줄은 0입니다.",
};
const branchPathSchema: JsonSchema = {
  type: "array", items: { type: "integer" },
  description: "분기 안의 줄이면 조회한 분기 경로를 그대로 입력합니다.",
};
const expectedHashSchema: JsonSchema = {
  type: "string", minLength: 1, description: "get_event에서 includeCommandHashes를 켜고 수정할 줄의 위치와 해시를 읽습니다.",
};

function scope(ctx: PrimitiveContext) {
  const { map, event, page } = scopedPage(ctx);
  if (ctx.target.kind !== "event" || ctx.target.mapId !== map.id) {
    throw new PrimitiveError("선택한 이벤트를 담은 맵을 다시 확인해 주세요.");
  }
  return { kind: "eventPage" as const, mapId: map.id, eventId: event.id, pageId: page.id };
}

function readUpdate(ctx: PrimitiveContext, args: Args, commandId: string) {
  const { page } = scopedPage(ctx);
  const branchPath = (args.branchPath ?? []) as readonly number[];
  const index = args.index as number;
  const current = commandListAt(page, branchPath)[index];
  if (!current) throw new PrimitiveError("고칠 명령 줄을 찾을 수 없어요. 페이지를 다시 확인해 주세요.");
  if (current.kind !== "m2Command" || current.commandId !== commandId) {
    throw new PrimitiveError("고른 줄에 이 종류의 명령이 없어요.");
  }
  return { current, path: [...branchPath, index] };
}

function prepareCommand(project: Project, args: Args, row: Row, initial: M2Command): M2Command {
  const patch: M2CommandFields = {};
  for (const key of Object.keys(row.properties)) {
    if (Object.hasOwn(args, key)) patch[key] = args[key] as M2CommandFields[string];
  }
  const fields = { ...initial.fields, ...patch };
  validateFields(project, row, fields, patch);
  return { ...initial, fields };
}

function requireMapCommand(troopOnly: boolean): void {
  if (troopOnly) {
    throw new PrimitiveError("이 명령은 맵 이벤트에서 실행되지 않아요. 자료집의 적 그룹에서 전투 이벤트를 편집해 주세요.");
  }
}

function makePrimitive(number: number, row: Row, update: boolean): SmallTaskPrimitive {
  const entry = M2_COMMAND_CATALOG.find(candidate => candidate.index === number)!;
  const initial = newM2Command(entry.id);
  const defaults = { ...initial, fields: { ...initial.fields, ...row.defaults } };
  const digits = String(number).padStart(3, "0");
  const troopOnly = m2CatalogEntryRuntimeSupport(entry, "troop") === "runtime-full"
    && m2CatalogEntryRuntimeSupport(entry, "map") !== "runtime-full";
  return {
    id: `m2.${digits}.${update ? "update" : "insert"}`,
    unit: UNIT,
    title: `${row.title} ${update ? "수정" : "추가"}`,
    covers: { m2Ids: [`m2-${digits}`] },
    targets,
    args: {
      type: "object",
      ...(troopOnly ? { description: "적 그룹의 전투 이벤트에서만 사용할 수 있습니다." } : {}),
      properties: {
        index: update ? indexSchema : { ...indexSchema, description: "삽입할 줄 위치. 생략하면 끝에 넣습니다." },
        branchPath: branchPathSchema,
        ...(update ? { expectedHash: expectedHashSchema } : {}),
        ...row.properties,
      },
      required: update ? ["index", "expectedHash"] : row.required,
      additionalProperties: false,
    },
    ...(troopOnly ? { hidden: true } : {}),
    scope(ctx) {
      requireMapCommand(troopOnly);
      return scope(ctx);
    },
    describe(ctx, args) {
      const initial = update ? readUpdate(ctx, args, defaults.commandId).current : defaults;
      const { fields } = prepareCommand(ctx.project, args, row, initial);
      const detail = row.detail?.(ctx.project, fields);
      const shown = typeof detail === "string" && !/[{}\[\]]/u.test(detail) ? displayText(detail, "").slice(0, 44) : "";
      const name = shown ? `${row.title}(${shown})` : row.title;
      return koreanSentence(`${name} 명령을 ${update ? "고쳐요" : "추가해요"}.`);
    },
    apply(ctx, args): Project {
      requireMapCommand(troopOnly);
      if (!update) {
        const command = prepareCommand(ctx.project, args, row, defaults);
        return insertAtIndex(ctx, command, args.index as number | undefined, args.branchPath as number[] | undefined);
      }
      if (!Object.keys(row.properties).some(key => Object.hasOwn(args, key))) {
        throw new PrimitiveError("이 줄에서 바꿀 값을 하나 이상 입력해 주세요.");
      }
      const { current, path } = readUpdate(ctx, args, defaults.commandId);
      const { fields } = prepareCommand(ctx.project, args, row, current);
      return updateScopedPage(ctx, page => updateEventCommand(page, path, { fields }, args.expectedHash as string));
    },
  };
}

// 두 카탈로그 행의 실행과 검증은 정본 명령이 맡는다.
function alias(number: string, title: string, kind: "showAnimation" | "callCommonEvent"): SmallTaskPrimitive {
  const resolvedOnly = (): never => { throw new PrimitiveError("이 명령은 기존 명령으로 실행해 주세요."); };
  return {
    id: `m2.${number}.insert`, unit: UNIT, title,
    covers: { m2Ids: [`m2-${number}`] }, targets,
    aliasOf: `cmd.${kind}.insert`,
    args: { type: "object", additionalProperties: false },
    hidden: true, scope, describe: () => `${title} 명령을 넣어요.`, apply: resolvedOnly,
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  ...Object.entries(ROWS).flatMap(([number, row]) => [makePrimitive(Number(number), row, false), makePrimitive(Number(number), row, true)]),
  alias("103", "전투 애니메이션", "showAnimation"),
  alias("106", "공통 이벤트 호출", "callCommonEvent"),
];
