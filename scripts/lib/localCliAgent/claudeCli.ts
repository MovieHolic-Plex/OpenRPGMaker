// 사용자의 순정 Claude Code(`claude`)를 조수 엔진으로 부르는 부분 — 찾기·로그인 확인·인자·stream-json 해석.
//
// 원칙(Anthropic 약관, claude-viz/opus-external-access-1.html):
// - 바이너리를 고치지 않는다. 사용자가 자기 계정·키로 직접 로그인한 상태를 그대로 쓴다.
// - 우리는 토큰을 읽지도, 옮기지도 않는다. `claude auth status` 의 loggedIn/authMethod 만 본다.
// - --bare 는 쓰지 않는다. --bare 는 OAuth(구독 로그인)를 읽지 않아 구독 사용자가 막힌다.

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CLAUDE_MCP_SERVER_NAME = "oprn";
export const CLAUDE_TOKEN_ENV = "OPRN_MCP_TOKEN";

export interface ClaudeCliStatus {
  readonly found: boolean;
  readonly version?: string;
  readonly loggedIn?: boolean;
  /** "oauth_token"(구독) · "api_key" 등. 값만 보고 토큰은 보지 않는다. */
  readonly authMethod?: string;
  readonly apiProvider?: string;
  readonly problem?: string;
}

export function detectClaudeCli(binary = "claude"): ClaudeCliStatus {
  const version = spawnSync(binary, ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (version.error || version.status !== 0) return { found: false, problem: "Claude Code 를 찾지 못했습니다" };
  const status = spawnSync(binary, ["auth", "status"], { encoding: "utf8", timeout: 20_000 });
  try {
    const parsed = JSON.parse(status.stdout) as { loggedIn?: boolean; authMethod?: string; apiProvider?: string };
    return { found: true, version: version.stdout.trim(), loggedIn: parsed.loggedIn === true, authMethod: parsed.authMethod, apiProvider: parsed.apiProvider };
  } catch {
    return { found: true, version: version.stdout.trim(), problem: "로그인 상태를 읽지 못했습니다" };
  }
}

export interface ClaudeTurnOptions {
  readonly binary?: string;
  readonly mcpUrl: string;
  readonly mcpToken: string;
  readonly prompt: string;
  readonly appendSystemPrompt?: string;
  readonly model?: string;
  /** API 키 사용자에게만 의미 있는 비용 상한(구독은 한도로 막힌다). */
  readonly maxBudgetUsd?: number;
  readonly signal?: AbortSignal;
  readonly onLine?: (message: ClaudeStreamMessage) => void;
  readonly onStderr?: (text: string) => void;
}

/** stream-json 한 줄. 필요한 필드만 좁혀 둔다 — 나머지는 그대로 기록에 남는다. */
export type ClaudeStreamMessage = {
  readonly type: string;
  readonly subtype?: string;
  readonly [key: string]: unknown;
};

export interface ClaudeTurnResult {
  readonly exitCode: number | null;
  readonly result?: ClaudeStreamMessage;
}

/**
 * 인자를 만든다. 비밀값은 여기 들어가지 않는다 — MCP 설정 파일은 `${OPRN_MCP_TOKEN}` 자리표시만 갖고,
 * 실제 값은 자식 환경 변수로만 간다(명령줄은 같은 머신 누구나 ps 로 본다).
 */
export function buildClaudeArgs(configPath: string, options: Pick<ClaudeTurnOptions, "appendSystemPrompt" | "model" | "maxBudgetUsd">): string[] {
  return [
    "-p",
    "--output-format", "stream-json", "--verbose",
    "--mcp-config", configPath, "--strict-mcp-config",
    // 내장 도구(Bash·Read·Edit·Write·WebFetch…)는 전부 끈다. 조수가 쓸 수 있는 것은 우리 MCP 도구뿐이다.
    "--tools", "",
    "--allowedTools", `mcp__${CLAUDE_MCP_SERVER_NAME}`,
    // 미리 허용 안 된 것은 묻지 않고 거절한다(-p 는 물어볼 사람이 없다).
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    // 사용자 훅이 조수 실행에 끼어들지 않게. 사용자의 다른 설정(로그인·프록시·제공자)은 그대로 쓴다.
    "--settings", JSON.stringify({ disableAllHooks: true }),
    ...(options.appendSystemPrompt ? ["--append-system-prompt", options.appendSystemPrompt] : []),
    ...(options.model ? ["--model", options.model] : []),
    ...(options.maxBudgetUsd ? ["--max-budget-usd", String(options.maxBudgetUsd)] : []),
  ];
}

export async function runClaudeTurn(options: ClaudeTurnOptions): Promise<ClaudeTurnResult> {
  // 빈 작업 폴더: 프로젝트 폴더의 CLAUDE.md·.mcp.json 이 자동으로 섞이지 않게.
  const cwd = mkdtempSync(join(tmpdir(), "oprn-claude-turn-"));
  const configPath = join(cwd, "oprn-mcp.json");
  writeFileSync(configPath, JSON.stringify({
    mcpServers: {
      [CLAUDE_MCP_SERVER_NAME]: {
        type: "http",
        url: options.mcpUrl,
        headers: { Authorization: `Bearer \${${CLAUDE_TOKEN_ENV}}` },
      },
    },
  }), { mode: 0o600 });
  const args = buildClaudeArgs(configPath, options);
  const child = spawn(options.binary ?? "claude", args, {
    cwd,
    env: { ...process.env, [CLAUDE_TOKEN_ENV]: options.mcpToken },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const abort = () => child.kill("SIGTERM");
  options.signal?.addEventListener("abort", abort, { once: true });
  // 지시문은 stdin 으로 — 명령줄 길이 제한도 피한다.
  child.stdin.end(options.prompt);
  let buffer = "";
  let result: ClaudeStreamMessage | undefined;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;
      try {
        const message = JSON.parse(line) as ClaudeStreamMessage;
        if (message.type === "result") result = message;
        options.onLine?.(message);
      } catch {
        options.onStderr?.(`(json 아님) ${line.slice(0, 200)}`);
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => options.onStderr?.(chunk));
  const exitCode = await new Promise<number | null>((resolve) => child.on("close", resolve));
  options.signal?.removeEventListener("abort", abort);
  rmSync(cwd, { recursive: true, force: true });
  return { exitCode, ...(result ? { result } : {}) };
}
