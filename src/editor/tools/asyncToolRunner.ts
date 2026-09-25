import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { eventScopeRefusal, onlyEventPageCommandsChanged, type EventCommandScope } from "@/ai/eventCommandScope";
import { resolveAssistScope, runEventCommandAssist } from "@/ai/eventCommandAssist";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { EVENT_COMMAND_ASSIST_TOOL, eventCommandAssistTarget } from "./eventCommandAssistTool";
import { validateArgs } from "./jsonSchema";
import { getTool } from "./toolRegistry";
import { normalizeToolArgs, runTool, runToolDefinition, type RunToolOptions } from "./toolRunner";
import { ToolError, type ToolContext, type ToolResult } from "./types";

/** Await the tool's lazy data so the synchronous run finds it. A failed load surfaces from run itself. */
export async function prepareTool(name: string, args: Record<string, unknown>): Promise<void> {
  const tool = getTool(name);
  if (tool?.prepare) await tool.prepare(normalizeToolArgs(name, args)).catch(() => undefined);
}

/** Generate first, then enter the same synchronous draft/lint/commit boundary as other tools. */
export async function runToolAsync(
  ctx: ToolContext, name: string, args: Record<string, unknown>,
  options: RunToolOptions & {
    readonly signal?: AbortSignal;
    readonly eventCommandScope?: EventCommandScope;
    readonly config?: AiConfig;
    readonly chat?: Parameters<typeof runEventCommandAssist>[0]["chat"];
    readonly projectScopeKey?: string;
    readonly generate?: typeof runEventCommandAssist;
  } = {},
): Promise<ToolResult> {
  options.signal?.throwIfAborted();
  if (name !== EVENT_COMMAND_ASSIST_TOOL) {
    await prepareTool(name, args);
    options.signal?.throwIfAborted();
    return runTool(ctx, name, args, options);
  }
  if (options.eventCommandScope) {
    const refusal = eventScopeRefusal(options.eventCommandScope, name, args);
    if (refusal) return refusal;
  }
  const tool = getTool(name)!;
  const normalized = normalizeToolArgs(name, args);
  if (validateArgs(tool.parameters, normalized).length) return runTool(ctx, name, args, options);
  try {
    const before = ctx.project;
    const baseline = JSON.stringify(before);
    const snapshot = structuredClone(before);
    const { event, page } = eventCommandAssistTarget(snapshot, normalized);
    if (!String(normalized.prompt).trim()) throw new ToolError("요청을 입력하세요.", { code: "invalid-args" });
    const scope = normalized.mode === "append" ? "append" : resolveAssistScope(page);
    if (scope === "append" && normalized.mode !== "append") throw new ToolError(
      "페이지가 길어 전체 수정이 불가능합니다. 추가 요청만 mode:'append'로 실행하세요.", { code: "event-assist-scope" },
    );
    const result = await (options.generate ?? runEventCommandAssist)({
      config: options.config ?? loadAiConfig(), chat: options.chat, prompt: normalized.prompt as string,
      context: { project: snapshot, mapId: normalized.mapId as string, event, page, scope,
        selection: options.eventCommandScope?.selection, selectionLabel: options.eventCommandScope?.selectionLabel },
      signal: options.signal, projectScopeKey: options.projectScopeKey,
    });
    options.signal?.throwIfAborted();
    // Includes changes to resources/references, not just the target command list.
    if (ctx.project !== before || JSON.stringify(ctx.project) !== baseline) {
      throw new ToolError("생성 중 프로젝트가 바뀌었습니다. 최신 상태로 다시 요청하세요.", { code: "stale-project" });
    }
    const isolated: ToolContext = {
      project: ctx.project,
      ...(ctx.currentMapId ? { currentMapId: ctx.currentMapId } : {}),
      ...(ctx.approvedTilesetFamilies ? { approvedTilesetFamilies: ctx.approvedTilesetFamilies } : {}),
    };
    const applied = runToolDefinition(isolated, {
      ...tool,
      run(draft, targetArgs) {
        const target = eventCommandAssistTarget(draft, targetArgs);
        if (result.scope === "append") {
          const selection = options.eventCommandScope?.selection;
          const list = selection?.length ? resolveCommandListAtPath(target.page.commands, selection) : null;
          if (list && selection) list.splice(selection[selection.length - 1] + 1, 0, ...structuredClone(result.commands));
          else target.page.commands.push(...structuredClone(result.commands));
        } else target.page.commands = structuredClone(result.commands);
        return {
          summary: `이벤트 '${target.event.id}' 페이지 '${target.page.id}' 명령 ${target.page.commands.length}개로 수정`,
          data: { mapId: targetArgs.mapId, eventId: target.event.id, pageId: target.page.id, scope: result.scope, attempts: result.attempts },
        };
      },
    }, normalized, { ...options, dryRun: false });
    if (applied.ok && !onlyEventPageCommandsChanged(before, isolated.project, {
      mapId: normalized.mapId as string, eventId: normalized.eventId as string, pageId: normalized.pageId as string,
    })) throw new ToolError("명령 외의 변경이 있어 초안을 거부했습니다.", { code: "event-page-scope" });
    if (applied.ok && !options.dryRun) ctx.project = isolated.project;
    return applied;
  } catch (cause) {
    options.signal?.throwIfAborted();
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, summary: message, issues: [{ severity: "error", code: cause instanceof ToolError ? cause.code : "event-assist-failed", message }] };
  }
}
