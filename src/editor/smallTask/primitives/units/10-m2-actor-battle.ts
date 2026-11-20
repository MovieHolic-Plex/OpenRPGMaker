import { newM2Command } from "@/editor/eventCommandFactory";
import type { JsonSchema } from "@/editor/tools/types";
import { M2_COMMAND_CATALOG, m2CatalogEntryRuntimeSupport } from "@/project/eventCommands/m2Catalog";
import { eventCommandHash, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
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

const indexSchema: JsonSchema = { type: "integer", minimum: 0, description: "명령 줄 위치. 첫 줄은 0입니다." };
const branchPathSchema: JsonSchema = {
  type: "array", items: { type: "integer" },
  description: "분기 안의 줄이면 조회한 분기 경로를 그대로 입력합니다.",
};
const expectedHashSchema: JsonSchema = {
  type: "string", minLength: 1, description: "이벤트를 읽을 때 확인한 현재 줄의 해시입니다.",
};

function scope(ctx: PrimitiveContext) {
  const { map, event, page } = scopedPage(ctx);
  return { kind: "eventPage" as const, mapId: map.id, eventId: event.id, pageId: page.id };
}

function readUpdate(ctx: PrimitiveContext, args: Args, commandId: string) {
  const { page } = scopedPage(ctx);
  const branchPath = (args.branchPath ?? []) as readonly number[];
  const index = args.index as number;
  const current = commandListAt(page, branchPath)[index];
  if (current?.kind !== "m2Command" || current.commandId !== commandId) {
    throw new PrimitiveError("고른 줄에서 같은 종류의 명령을 찾을 수 없어요.");
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
      ...(troopOnly ? { description: "실제 효과는 적 그룹의 전투 이벤트에서 실행됩니다." } : {}),
      properties: {
        index: update ? indexSchema : { ...indexSchema, description: "삽입할 줄 위치. 생략하면 끝에 넣습니다." },
        branchPath: branchPathSchema,
        ...(update ? { expectedHash: expectedHashSchema } : {}),
        ...row.properties,
      },
      required: update ? ["index"] : row.required,
      additionalProperties: false,
    },
    scope,
    describe(ctx, args) {
      const initial = update ? readUpdate(ctx, args, defaults.commandId).current : defaults;
      const { fields } = prepareCommand(ctx.project, args, row, initial);
      const detail = row.detail?.(ctx.project, fields);
      const shown = typeof detail === "string" && !/[{}\[\]]/u.test(detail) ? displayText(detail, "").slice(0, 44) : "";
      const name = shown ? `「${shown}」 ${row.title} 명령` : `${row.title} 명령`;
      return koreanSentence(`${name}을 ${update ? "고쳐요" : "넣어요"}.`);
    },
    apply(ctx, args): Project {
      if (!update) {
        const command = prepareCommand(ctx.project, args, row, defaults);
        return insertAtIndex(ctx, command, args.index as number | undefined, args.branchPath as number[] | undefined);
      }
      const { current, path } = readUpdate(ctx, args, defaults.commandId);
      const { fields } = prepareCommand(ctx.project, args, row, current);
      const expectedHash = (args.expectedHash as string | undefined) ?? eventCommandHash(current);
      return updateScopedPage(ctx, page => updateEventCommand(page, path, { fields }, expectedHash));
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
