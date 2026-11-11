// 빌더가 v1 결정론 도구를 부르는 창구. 쓰기 도구는 시공 재생 기록(constructionLogs)을 모아 실행기에 넘긴다 —
// 편집기는 체크포인트마다 그 순서대로 맵 위에서 다시 튼다(v1 과 같은 「실시간 시공」).
import { runTool } from "@/editor/tools";
import { getTool } from "@/editor/tools/toolRegistry";
import { synthesizeToolConstructionLogs, withConstructionLog, type ConstructionLog } from "@/editor/tools/constructionLog";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import type { BuildRun, BuilderCall } from "./types";

export interface RecordingBuildRun extends BuildRun {
  /** 지난 take 이후 쓰기 도구가 남긴 시공 재생 기록(꺼내면 비운다). */
  takeConstructionLogs(): ConstructionLog[];
}

export function createBuildRun(ctx: ToolContext): RecordingBuildRun {
  const calls: BuilderCall[] = [];
  let logs: ConstructionLog[] = [];
  return {
    ctx,
    calls,
    call(tool: string, args: Record<string, unknown>): ToolResult {
      const definition = getTool(tool);
      const before = ctx.project;
      const started = Date.now();
      let result: ToolResult;
      let toolLogs: readonly ConstructionLog[] = [];
      try {
        if (definition?.mode === "write") {
          const out = withConstructionLog(tool, () => runTool(ctx, tool, args));
          result = out.value;
          toolLogs = out.logs;
        } else {
          result = runTool(ctx, tool, args);
        }
      } catch (error) {
        result = { ok: false, summary: `${tool} 실패: ${error instanceof Error ? error.message : String(error)}` };
      }
      if (definition?.mode === "write" && result.ok && ctx.project !== before) {
        logs = [...logs, ...toolLogs, ...synthesizeToolConstructionLogs(tool, before, ctx.project, toolLogs, Date.now() - started)];
      }
      const issueText = (result.issues ?? []).filter((i) => i.severity === "error").map((i) => i.message).join(" / ");
      calls.push({ tool, args, ok: result.ok, summary: `${String(result.summary ?? "").slice(0, 400)}${issueText ? ` — ${issueText.slice(0, 400)}` : ""}` });
      return result;
    },
    takeConstructionLogs() {
      const out = logs;
      logs = [];
      return out;
    },
  };
}
