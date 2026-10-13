import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { eventScopeRefusal, onlyEventPageCommandsChanged, type EventCommandScope } from "@/ai/eventCommandScope";
import { resolveAssistScope, runEventCommandAssist } from "@/ai/eventCommandAssist";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { EVENT_COMMAND_ASSIST_TOOL, eventCommandAssistTarget } from "./eventCommandAssistTool";
import { validateArgs } from "./jsonSchema";
import { getTool } from "./toolRegistry";
import { normalizeToolArgs, runTool, runToolDefinition, type RunToolOptions } from "./toolRunner";
import { ToolError, type ToolContext, type ToolResult } from "./types";
import type { Project } from "@/project/types";

/** Await the tool's lazy data so the synchronous run finds it. A failed load surfaces from run itself. */
export async function prepareTool(name: string, args: Record<string, unknown>, project?: Project): Promise<void> {
  const tool = getTool(name);
  if (tool?.prepare) await tool.prepare(normalizeToolArgs(name, args), project).catch(() => undefined);
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
    await prepareTool(name, args, ctx.project);
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
    // 지우거나 바꾸라는 말이 없는 요청에서 기존 명령이 사라지면 편집이 아니라 파손이다 — 되돌려 보내 mode:'append' 로 다시 시키게 한다
    // (실측 2026-10-13: 「화면 흔들림 추가」가 기존 화면 숨기기·표시 명령을 지웠다).
    if (result.scope === "page") {
      const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
      const lost = page.commands.filter((old) => !result.commands.some((next) => same(next, old)));
      if (lost.length > 0 && !/지워|지우|삭제|제거|없애|빼|바꿔|바꾸|교체|수정|변경|고쳐|대신|replace|remove|delete|change/iu.test(String(normalized.prompt))) {
        throw new ToolError(
          `이 요청은 기존 명령을 지우라는 말이 없는데 결과에서 기존 명령 ${lost.length}개가 사라져 적용하지 않았습니다. 새로 넣을 것만 mode:'append' 로 다시 요청하세요(기존 명령은 그대로 남습니다).`,
          { code: "event-assist-dropped-commands" },
        );
      }
    }
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
        const wasCommands = structuredClone(target.page.commands);
        if (result.scope === "append") {
          const selection = options.eventCommandScope?.selection;
          const list = selection?.length ? resolveCommandListAtPath(target.page.commands, selection) : null;
          if (list && selection) list.splice(selection[selection.length - 1] + 1, 0, ...structuredClone(result.commands));
          else target.page.commands.push(...structuredClone(result.commands));
        } else target.page.commands = structuredClone(result.commands);
        // 결과를 말로 못 보면 모델은 성공한 편집 위에 다른 도구로 덮어쓴다(실측 2026-10-13). 무엇이 추가·제거됐는지 적어 준다.
        const label = (command: unknown): string => { const c = command as { kind?: string; commandId?: string }; return c.commandId ? `${c.kind}:${c.commandId}` : String(c.kind); };
        const has = (list: readonly unknown[], command: unknown): boolean => list.some((item) => JSON.stringify(item) === JSON.stringify(command));
        const added = target.page.commands.filter((command) => !has(wasCommands, command)).map(label);
        const removed = wasCommands.filter((command) => !has(target.page.commands, command)).map(label);
        return {
          summary: `이벤트 '${target.event.id}' 페이지 '${target.page.id}' 명령 ${target.page.commands.length}개로 수정 — 추가 [${added.join(", ") || "없음"}], 제거 [${removed.join(", ") || "없음"}] (추가한 것이 요청한 전부면 더 고치지 말고 끝낸다)`,
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
