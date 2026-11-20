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
  readonly live?: PrimitiveContext["live"];
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
  const offered = primitivesForTarget(ctx.smallTaskTarget);
  if (tool.name === LIST_SMALL_TASK_PRIMITIVES) {
    return {
      ok: true,
      summary: "선택한 대상에 쓸 수 있는 동작을 읽었어요.",
      data: offered.map(({ id, title }) => ({ id, title, args: getPrimitive(id)!.args })),
    };
  }

  const id = args.id as string;
  if (!offered.some(row => row.id === id)) throw new PrimitiveError("범위 밖: 선택한 대상에 이 동작을 쓸 수 없어요.");
  const result = runPrimitive(ctx.project, ctx.smallTaskTarget, id, args.args as Record<string, unknown>, ctx.smallTaskSelection, ctx.live);
  ctx.project = result.after;
  return { ok: true, summary: result.sentence };
}
