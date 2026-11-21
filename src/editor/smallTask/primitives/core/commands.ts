import { moveCommandBetweenLists } from "@/editor/eventCommandPaths";
import { deleteEventCommand, eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import type { JsonSchema } from "@/editor/tools/types";
import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { assertCommandDeletion } from "./commandReferences";
import { commandListAt, eventName, koreanSentence, scopedPage, updateScopedPage } from "./helpers";

const index: JsonSchema = { type: "integer", minimum: 0, description: "목록 안의 줄 위치. 첫 줄은 0." };
const branchPath: JsonSchema = {
  type: "array", items: { type: "integer" }, description: "분기 안이면 이벤트 읽기에서 받은 분기 경로. 바깥 목록이면 생략.",
};
const expectedHash: JsonSchema = { type: "string", minLength: 1, description: "이벤트를 읽을 때 확인한 현재 줄의 해시." };

function scope(ctx: PrimitiveContext): SmallTaskScope {
  const { map, event, page } = scopedPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
}

type CommandPosition = { index: number; branchPath?: number[]; expectedHash: string };

export const CORE_PRIMITIVES: readonly SmallTaskPrimitive[] = [
  {
    id: "cmd.delete", unit: "00-core", title: "명령 한 줄 삭제", covers: {}, targets: ["event"],
    args: { type: "object", properties: { index, branchPath, expectedHash }, required: ["index", "expectedHash"], additionalProperties: false },
    scope,
    describe(ctx, args) {
      return koreanSentence(`『${eventName(scopedPage(ctx).event)}』의 ${Number(args.index) + 1}번째 명령을 지웠어요.`);
    },
    apply(ctx, args) {
      const { index, branchPath = [], expectedHash } = args as CommandPosition;
      const list = commandListAt(scopedPage(ctx).page, branchPath);
      const command = list[index];
      if (!command) throw new PrimitiveError(STALE_COMMAND_LIST);
      const after = updateScopedPage(ctx, page =>
        deleteEventCommand(page, [...branchPath, index], expectedHash));
      assertCommandDeletion(ctx, after, list, command);
      if (command.kind === "m2Command") {
        for (const guard of ctx.m2CommandDeleteGuards ?? []) guard(ctx, command.commandId, list, index, command);
      }
      return after;
    },
  },
  {
    id: "cmd.move", unit: "00-core", title: "명령 한 줄 이동", covers: {}, targets: ["event"],
    args: {
      type: "object",
      properties: { index, toIndex: { ...index, description: "이동한 뒤의 줄 위치. 첫 줄은 0." }, branchPath, expectedHash },
      required: ["index", "toIndex", "expectedHash"], additionalProperties: false,
    },
    scope,
    describe(ctx, args) {
      return koreanSentence(`『${eventName(scopedPage(ctx).event)}』의 ${Number(args.index) + 1}번째 명령을 ${Number(args.toIndex) + 1}번째로 옮겼어요.`);
    },
    apply(ctx, args) {
      const { index, toIndex, branchPath, expectedHash } = args as CommandPosition & { toIndex: number };
      return updateScopedPage(ctx, page => {
        const list = commandListAt(page, branchPath);
        const command = list[index];
        if (!command || eventCommandHash(command) !== expectedHash) throw new PrimitiveError(STALE_COMMAND_LIST);
        if (toIndex >= list.length) throw new PrimitiveError("옮길 명령의 도착 위치를 찾을 수 없어요.");
        if (index === toIndex) return page;
        // A populated branching row can move as one row. Deleting it would discard its children.
        const edited = { ...page, commands: structuredClone(page.commands) };
        const rows = commandListAt(edited, branchPath);
        moveCommandBetweenLists(rows, index, rows, toIndex);
        return edited;
      });
    },
  },
];
