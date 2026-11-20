import { chatCompletion, loadAiConfig, type ChatMessage } from "@/ai/llmClient";
import { splitToolCallReason } from "@/ai/toolReason";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { commitChangeset } from "@/editor/tools/changeset";
import { activeTools, toOpenAiTools } from "@/editor/tools/toolRegistry";
import { normalizeToolArgs } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import { smallTaskRefusal, smallTaskTools } from "./tools";
import { SmallTaskError, type SmallTaskTarget } from "./target";

// 도구는 기존 변경 검증기를 거쳐 이 호출의 사본에만 쓴다. 스토어 교체는 호출자가 한 번 맡는다.
export async function runSmallTask(before: Project, target: SmallTaskTarget, request: string, signal: AbortSignal): Promise<Project> {
  const config = loadAiConfig();
  const ctx: ToolContext = { project: before, assistantRun: true, ...(target.kind !== "dbEntry" ? { currentMapId: target.mapId } : {}) };
  const names = smallTaskTools(target);
  const tools = toOpenAiTools(activeTools().filter(tool => names.includes(tool.name)));
  const messages: ChatMessage[] = [
    { role: "system", content: `선택한 대상의 작은 편집 하나를 맡는다. 먼저 현재 값을 읽고 요청한 것만 도구로 고친다. 기존 내용을 보존한다. 대상: ${JSON.stringify(target)}` },
    { role: "user", content: request },
  ];
  let remaining = config.maxToolCalls;
  for (;;) {
    signal.throwIfAborted();
    const { message, finishReason } = await chatCompletion(config, { messages, tools, signal });
    signal.throwIfAborted();
    if (finishReason === "length" || finishReason === "content_filter") throw new SmallTaskError("요청을 마치지 못했어요. 짧게 나눠서 다시 시도해 주세요.");
    if (!message.tool_calls?.length) {
      if (ctx.project !== before && !commitChangeset(ctx.project, before).ok) throw new SmallTaskError("선택한 대상에 요청한 변경을 적용할 수 없어요.");
      return ctx.project;
    }
    messages.push(message);
    for (const call of message.tool_calls) {
      signal.throwIfAborted();
      if (--remaining < 0) throw new SmallTaskError("한 번에 할 수 있는 작업 수를 넘었어요.");
      const name = call.function.name;
      const raw = JSON.parse(call.function.arguments);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new SmallTaskError("요청을 읽지 못했어요.");
      const args = normalizeToolArgs(name, splitToolCallReason(raw).args);
      const refusal = smallTaskRefusal(target, name, args);
      if (refusal) throw new SmallTaskError(refusal);
      const result = await runToolAsync(ctx, name, args, { config, signal });
      // 결과에는 다음 읽기/쓰기의 근거가 들어 있다. 사본이나 UI에는 모델 답변을 저장하지 않는다.
      messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(result) });
      if (!result.ok) throw new SmallTaskError("선택한 대상에 요청한 변경을 적용할 수 없어요.");
    }
  }
}
