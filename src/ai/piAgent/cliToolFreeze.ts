// 로컬 CLI 엔진(Claude Code·Codex·Gemini CLI)의 도구 목록을 한 대화 동안 고정한다 — 프롬프트 캐시를 지키려고.
//
// 왜 (2026-11-01 비용 분석, openwiki/assistant-v2.md 「토큰 비용 재기」): Claude Code 는 도구 목록을 요청 맨 앞에 싣는다.
// load_tools·할 일 고리의 도구 선언으로 목록이 하나라도 바뀌면(MCP list_changed) 다음 호출은 캐시를 하나도 못 읽고
// 지시문+도구+쌓인 기록 전부(10만 토큰 안팎)를 다시 쓴다. 스크립트 A/B 로직 요청 6판에서 이 «통째 다시 쓰기»가 비용의 약 29%였다.
// 그래서: 대화 중에 «더해진» 도구는 목록에 올리지 않고 call_tool{name, args} 하나로 부른다. 매개변수는 load_tools 결과(기록 = 캐시 뒤쪽)로 준다.
// 목록에 있던 도구가 «빠진» 경우(윤문 차례처럼 통째로 바꿀 때)만 알린다 — 그때는 옛 도구를 부르면 안 되니까.
// 끄기: OPRN_CLI_TOOL_FREEZE=0 (A/B 측정용).

import { ArgShapeError } from "./argRepair";

export const CLI_CALL_TOOL = "call_tool";

export function cliToolFreezeOn(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.OPRN_CLI_TOOL_FREEZE !== "0";
}

/** CLI 가 이미 받은 목록(listed)에서 빠진 이름이 있을 때만 다시 알린다. 더해지기만 했으면 call_tool 로 부르므로 알리지 않는다. */
export function cliListNeedsAnnounce(listed: readonly string[], now: readonly string[]): boolean {
  const current = new Set(now);
  return listed.some((name) => name !== CLI_CALL_TOOL && !current.has(name));
}

export const CLI_CALL_TOOL_SPEC = {
  name: CLI_CALL_TOOL,
  description: "Run a tool that is not in your tool list — one you loaded with load_tools, or one a reminder, check or rejection names. "
    + "name = the tool name, args = that tool's parameters (load_tools shows them). Tools in your list are called directly, not through this.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Tool name, e.g. upsert_enemy." },
      args: { type: "object", additionalProperties: true, description: "That tool's parameters." },
    },
    required: ["name"],
    additionalProperties: false,
  },
} as const;

/** call_tool 인자를 풀어 안쪽 도구 이름·인자를 낸다. CLI 접두(mcp__oprn__)는 떼어 준다. */
export function unwrapCallTool(args: unknown): { name: string; args: Record<string, unknown> } | { error: string } {
  const a = (args && typeof args === "object" ? args : {}) as { name?: unknown; args?: unknown };
  const name = typeof a.name === "string" ? a.name.trim().replace(/^mcp__[^_]+__/u, "") : "";
  if (!name) return { error: "call_tool needs name (the tool to run) and args (its parameters)." };
  if (name === CLI_CALL_TOOL) return { error: "call_tool cannot run itself — pass the inner tool's name." };
  const inner = a.args && typeof a.args === "object" && !Array.isArray(a.args) ? a.args as Record<string, unknown> : {};
  return { name, args: inner };
}

/**
 * 실패한 도구 호출이 모델에게 돌려줄 글. call_tool 로 부른 도구(viaCallTool)는 목록에 스키마가 없으니, 인자 모양 거절(ArgShapeError)에는
 * 그 도구의 매개변수를 붙여 다음 호출이 맞는 모양이 되게 한다. 연달아 틀릴 때 첫 번째와 세 번째에만 붙인다(두 번째는 바로 위에 있고, 그 뒤는 같은 글을 쌓지 않는다).
 * 실측(2026-11-12 Haiku 게임 다섯 판): call_tool 로 부른 쓰기 도구의 실패 41건 가운데 18건이 인자 모양이었고, 8건은 그 도구를 load_tools 로 실은 적도 없었다.
 */
export function callToolFailureText(error: unknown, name: string, viaCallTool: boolean, callSchema: ((name: string) => string | undefined) | undefined): string {
  const text = error instanceof Error ? error.message : String(error);
  if (!viaCallTool || !(error instanceof ArgShapeError) || (error.streak !== 1 && error.streak !== 3)) return text;
  const schema = callSchema?.(name);
  return schema ? `${text}\n\nParameters of ${name} — this call is checked against them. Fix the fields the error names and run ${CLI_CALL_TOOL}{name:"${name}", args:{…}} again:\n${schema}` : text;
}

/** CLI 시스템 지시 한 줄 — 목록 밖 도구를 부르는 길. */
export const CLI_LAZY_TOOLS_LINE = "Your tool list stays the same for the whole conversation (this keeps the prompt cache). "
  + "A tool that is not in it — one you load with load_tools, or one a reminder or check names — is run with call_tool{name, args}; load_tools shows its parameters.";
