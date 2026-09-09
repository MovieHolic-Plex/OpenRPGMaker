// 레지스트리 툴 → Pi AgentTool 모양 어댑터. 순수 함수라 브라우저/Bun/Node 어디서나 같다.
//
// 설계 원칙: 툴 코드는 한 줄도 바꾸지 않는다. Pi 가 요구하는 것은 `execute` 가 실패 시 throw
// 하는 것뿐이므로, `runTool` 의 `ok:false` 를 예외로 옮기고 issues 를 본문에 실어 모델이
// 스스로 고치게 한다(기존 세션의 자가수정 루프와 같은 정보량).
//
// 이 파일은 @oh-my-pi 패키지를 import 하지 않는다. 그래서 vitest(Node)에서 검증되고,
// 원본 Pi 코어로 갈아탈 때도 이 모양은 그대로 쓸 수 있다(어댑터가 곧 퇴로다).

import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools";
import type { ToolContext, ToolResult } from "@/editor/tools/types";

export interface PiToolTextContent {
  readonly type: "text";
  readonly text: string;
}

export interface PiToolExecResult {
  readonly content: PiToolTextContent[];
  readonly details?: unknown;
}

export interface PiToolShape {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly parameters: unknown;
  execute(toolCallId: string, params: unknown, signal?: AbortSignal): Promise<PiToolExecResult>;
}

export interface PiToolCallRecord {
  readonly name: string;
  readonly args: unknown;
  readonly result: ToolResult;
}

export interface CreatePiToolsetOptions {
  /** 노출 도메인. 비우면 살아 있는 레지스트리 전부. 도메인 없는(범용) 툴은 항상 포함. */
  readonly domains?: readonly string[];
  /** 읽기 툴만(검수 역할). */
  readonly readOnly?: boolean;
  /** 이름으로 딱 집어 노출(팀장 역할의 소수 읽기 툴). domains·readOnly 와 교집합. */
  readonly toolNames?: readonly string[];
  /** 툴 호출마다 호출. 이벤트 스트림·감사 로그용. */
  readonly onCall?: (record: PiToolCallRecord) => void;
  /** 읽기 툴 data 직렬화 상한(문자). 맵 전체 덤프가 컨텍스트를 삼키지 않게. */
  readonly maxDataChars?: number;
  /** 실패 본문에 실을 issues 상한. */
  readonly maxIssues?: number;
}

const DEFAULT_MAX_DATA_CHARS = 12_000;
const DEFAULT_MAX_ISSUES = 8;

export function selectPiToolDefinitions(
  domains?: readonly string[],
  options: { readonly readOnly?: boolean; readonly toolNames?: readonly string[] } = {},
) {
  const wanted = domains && domains.length > 0 ? new Set(domains) : null;
  const names = options.toolNames && options.toolNames.length > 0 ? new Set(options.toolNames) : null;
  return TOOL_REGISTRY.filter((tool) => {
    if (tool.deprecated) return false;
    if (options.readOnly && tool.mode !== "read") return false;
    if (names && !names.has(tool.name)) return false;
    if (!wanted) return true;
    if (!tool.domains || tool.domains.length === 0) return true;
    return tool.domains.some((domain) => wanted.has(domain));
  });
}

function truncateJson(value: unknown, maxChars: number): { text: string; truncated: boolean } {
  const text = JSON.stringify(value);
  if (text === undefined) return { text: "null", truncated: false };
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

export function formatPiToolSuccess(result: ToolResult, maxDataChars = DEFAULT_MAX_DATA_CHARS): string {
  const body: Record<string, unknown> = { ok: true, summary: result.summary };
  if (result.warnings && result.warnings.length > 0) body.warnings = result.warnings;
  if (result.issues && result.issues.length > 0) body.issues = result.issues.slice(0, DEFAULT_MAX_ISSUES);
  if (result.data !== undefined) {
    const { text, truncated } = truncateJson(result.data, maxDataChars);
    if (truncated) {
      body.dataTruncated = true;
      body.dataPreview = text;
      body.hint = "data 가 길어 잘렸습니다. 더 좁은 영역이나 필터로 다시 읽으세요.";
    } else {
      body.data = result.data;
    }
  }
  return JSON.stringify(body);
}

export function formatPiToolFailure(result: ToolResult, maxIssues = DEFAULT_MAX_ISSUES): string {
  return JSON.stringify({
    ok: false,
    summary: result.summary,
    issues: (result.issues ?? []).slice(0, maxIssues),
    ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
  });
}

export function createPiToolset(ctx: ToolContext, options: CreatePiToolsetOptions = {}): PiToolShape[] {
  const maxDataChars = options.maxDataChars ?? DEFAULT_MAX_DATA_CHARS;
  const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES;
  return selectPiToolDefinitions(options.domains, { readOnly: options.readOnly, toolNames: options.toolNames }).map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    async execute(_toolCallId, params) {
      const args = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
      const result = runTool(ctx, tool.name, args);
      options.onCall?.({ name: tool.name, args, result });
      if (!result.ok) throw new Error(formatPiToolFailure(result, maxIssues));
      return { content: [{ type: "text", text: formatPiToolSuccess(result, maxDataChars) }], details: result };
    },
  }));
}
