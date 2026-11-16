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
    call(tool: string, argsIn: Record<string, unknown>): ToolResult {
      // 빌더(코드)가 페이지를 다시 쓰는 것은 일부러 옮기는 것이다(추리 증거를 바닥 칸으로 · 경로 고리 다시 짓기) — 빠진 쓰기 되붙이기(keptWrites)는 모델 호출에만 건다.
      const args = (tool === "upsert_event" || tool === "patch_event_page") && argsIn.dropWrites === undefined ? { ...argsIn, dropWrites: true } : argsIn;
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
      calls.push({ tool, args: argsIn, ok: result.ok, summary: `${String(result.summary ?? "").slice(0, 400)}${issueText ? ` — ${issueText.slice(0, 400)}` : ""}` });
      return result;
    },
    takeConstructionLogs() {
      const out = logs;
      logs = [];
      return out;
    },
  };
}
