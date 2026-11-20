import type { PrimitiveContext } from "@/editor/smallTask/primitives/types";
import type { SmallTaskTarget } from "@/editor/smallTask/target";
import type { ToolContext, ToolDefinition } from "./types";

export const LIST_SMALL_TASK_PRIMITIVES = "list_small_task_primitives";
export const APPLY_SMALL_TASK_PRIMITIVE = "apply_small_task_primitive";

export function isSmallTaskPrimitiveTool(name: string): boolean {
  return name === LIST_SMALL_TASK_PRIMITIVES || name === APPLY_SMALL_TASK_PRIMITIVE;
}

export const SMALL_TASK_PRIMITIVE_TOOLS = [
  {
    name: LIST_SMALL_TASK_PRIMITIVES,
    description: "작은 일에서 지금 선택한 대상에 쓸 수 있는 동작의 이름과 입력 형식을 읽는다.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: APPLY_SMALL_TASK_PRIMITIVE,
    description: "작은 일에서 고른 대상에 동작 하나를 적용한다. 목록에서 확인한 동작 이름과 입력값을 사용한다.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 1, description: "동작 목록에서 확인한 이름." },
        args: { type: "object", additionalProperties: true, description: "그 동작에 필요한 입력값." },
      },
      required: ["id", "args"],
      additionalProperties: false,
    },
  },
] as const satisfies readonly Pick<ToolDefinition, "name" | "description" | "parameters">[];

export interface SmallTaskToolContext extends ToolContext {
  readonly smallTaskTarget: SmallTaskTarget;
  readonly smallTaskSelection?: PrimitiveContext["selection"];
  readonly smallTaskDraftSource?: PrimitiveContext["live"];
  readonly smallTaskCommonEvents?: { readonly initialIds: ReadonlySet<string>; createdId?: string };
}

/** Only the small-task host can supply this context. Its final changeset and history are handled by the frame. */
export async function runSmallTaskPrimitiveTool(ctx: SmallTaskToolContext, name: string, args: Record<string, unknown>) {
  // 등록 초기화가 끝난 뒤 유닛을 읽는다. 유닛과 범위 검사도 공용 도구를 참조할 수 있다.
  const [{ PrimitiveError }, { getPrimitive, primitivesForTarget }, { matchesPrimitiveSchema, runPrimitive }] = await Promise.all([
    import("@/editor/smallTask/primitives/errors"),
    import("@/editor/smallTask/primitives/registry"),
    import("@/editor/smallTask/primitives/run"),
  ]);
  const tool = SMALL_TASK_PRIMITIVE_TOOLS.find(tool => tool.name === name);
  if (!tool || !matchesPrimitiveSchema(tool.parameters, args)) throw new PrimitiveError("동작에 필요한 값의 형식을 확인해 주세요.");
  const target = ctx.smallTaskTarget;
  const offered = primitivesForTarget(target);
  if (tool.name === LIST_SMALL_TASK_PRIMITIVES) {
    const event = target.kind === "event"
      ? ctx.project.maps[target.mapId]?.events.find(row => row.id === target.eventId)
      : undefined;
    const available = target.kind === "event" && !event?.pages?.length
      ? offered.filter(row => !["cmd.delete", "cmd.move"].includes(getPrimitive(row.id)!.id))
      : offered;
    return {
      ok: true,
      summary: "선택한 대상에 쓸 수 있는 동작을 읽었어요.",
      data: available.map(({ id, title }) => ({ id, title, args: getPrimitive(id)!.args })),
    };
  }

  const id = args.id as string;
  if (!offered.some(row => row.id === id)) throw new PrimitiveError("범위 밖: 선택한 대상에 이 동작을 쓸 수 없어요.");
  const primitiveArgs = args.args as Record<string, unknown>;
  const commonEvents = ctx.smallTaskCommonEvents;
  if (ctx.smallTaskSelection?.rect && id.startsWith("commonEvent.")) {
    throw new PrimitiveError("맵의 선택 영역을 해제한 뒤 공용 이벤트를 편집해 주세요.");
  }
  if (commonEvents && id.startsWith("commonEvent.")) {
    if (id === "commonEvent.create") {
      if (commonEvents.createdId !== undefined) throw new PrimitiveError("작은 일 한 번에 공용 이벤트를 하나만 만들 수 있어요.");
    } else {
      const eventId = primitiveArgs.commonEventId;
      if (typeof eventId === "string" && (!commonEvents.initialIds.has(eventId) || eventId === commonEvents.createdId)) {
        throw new PrimitiveError("범위 밖: 작업을 시작할 때 있던 공용 이벤트만 고칠 수 있어요.");
      }
    }
  }
  const result = runPrimitive(ctx.project, target, id, primitiveArgs, ctx.smallTaskSelection, ctx.smallTaskDraftSource);
  if (commonEvents && id === "commonEvent.create") commonEvents.createdId = result.after.commonEvents.at(-1)?.id;
  ctx.project = result.after;
  return { ok: true, summary: result.sentence };
}
