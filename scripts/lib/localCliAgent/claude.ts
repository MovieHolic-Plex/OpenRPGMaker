// Claude Code(`claude -p`) 어댑터.
//
// - --bare 는 쓰지 않는다. --bare 는 OAuth(구독 로그인)를 읽지 않아 구독 사용자가 막힌다.
// - 한 실행 = 프로세스 하나. `--input-format stream-json` 으로 stdin 을 열어 두고 차례마다 user 줄을 쓴다 —
//   완료 검사·배치 품질 권고 같은 뒤이은 차례가 같은 대화(캐시 포함)를 이어 간다.
// - 기본 시스템 프롬프트(코딩 지시 수천 토큰)는 `--system-prompt-file` 로 우리 지시문으로 «바꾼다».

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyWorkDir, isTransientCliError, runShort, sleep, spawnJsonLines, type SpawnedLines } from "./process.ts";
import type { LocalCliAdapter, LocalCliBlock, LocalCliSession, LocalCliSessionOptions, LocalCliStatus, LocalCliUsage, LocalCliImage } from "./types.ts";

export const CLAUDE_MCP_SERVER_NAME = "oprn";
export const MCP_TOKEN_ENV = "OPRN_MCP_TOKEN";

const MODELS = [
  { id: "sonnet", label: "Sonnet (권장)", roles: ["routine", "deep"] as const },
  { id: "haiku", label: "Haiku (빠름·가벼움)" },
  { id: "opus", label: "Opus (가장 강함·한도 많이 씀)" },
];

export function buildClaudeArgs(configPath: string, systemPromptPath: string, options: { model?: string; effort?: string; maxBudgetUsd?: number; tools?: boolean }): string[] {
  return [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json", "--verbose",
    // 내장 도구(Bash·Read·Edit·Write·WebFetch…)는 전부 끈다. 조수가 쓸 수 있는 것은 우리 MCP 도구뿐이다.
    "--tools", "",
    ...(options.tools === false
      ? ["--strict-mcp-config"]
      : ["--mcp-config", configPath, "--strict-mcp-config", "--allowedTools", `mcp__${CLAUDE_MCP_SERVER_NAME}`]),
    // 미리 허용 안 된 것은 묻지 않고 거절한다(-p 는 물어볼 사람이 없다).
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    "--disable-slash-commands",
    // 사용자 훅이 조수 실행에 끼어들지 않게. 사용자의 다른 설정(로그인·프록시·제공자)은 그대로 쓴다.
    "--settings", JSON.stringify({ disableAllHooks: true }),
    "--system-prompt-file", systemPromptPath,
    ...(options.model ? ["--model", options.model] : []),
    ...(options.effort ? ["--effort", options.effort] : []),
    ...(options.maxBudgetUsd ? ["--max-budget-usd", String(options.maxBudgetUsd)] : []),
  ];
}

function userLine(text: string, images: readonly LocalCliImage[] = []): string {
  return JSON.stringify({ type: "user", message: { role: "user", content: [
    ...images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } })),
    { type: "text", text },
  ] } });
}

function usageOf(raw: unknown, calls: number): LocalCliUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, unknown>;
  const n = (key: string) => (typeof u[key] === "number" ? (u[key] as number) : 0);
  return { input: n("input_tokens"), output: n("output_tokens"), cacheRead: n("cache_read_input_tokens"), cacheWrite: n("cache_creation_input_tokens"), calls };
}

function blocksOf(content: unknown): LocalCliBlock[] {
  if (!Array.isArray(content)) return [];
  const out: LocalCliBlock[] = [];
  for (const part of content) {
    const p = part as { type?: string; text?: string; thinking?: string; name?: string };
    if (p.type === "text" && typeof p.text === "string") out.push({ type: "text", text: p.text });
    else if (p.type === "thinking" && typeof p.thinking === "string") out.push({ type: "thinking", text: p.thinking });
    else if (p.type === "tool_use" && typeof p.name === "string") out.push({ type: "tool_use", name: p.name });
  }
  return out;
}

function openClaudeSession(options: LocalCliSessionOptions, toolsEnabled = true): LocalCliSession {
  const work = emptyWorkDir("claude");
  const configPath = join(work.dir, "oprn-mcp.json");
  const systemPromptPath = join(work.dir, "system.md");
  // 비밀값은 설정 파일에 자리표시로만 둔다 — 실제 값은 자식 환경 변수로만(명령줄은 같은 머신 누구나 ps 로 본다).
  writeFileSync(configPath, JSON.stringify({ mcpServers: { [CLAUDE_MCP_SERVER_NAME]: { type: "http", url: options.mcpUrl, headers: { Authorization: `Bearer \${${MCP_TOKEN_ENV}}` } } } }), { mode: 0o600 });
  // Claude Code 는 MCP 도구를 mcp__oprn__<이름> 으로 노출한다. 지시문은 맨 이름(show_map_region)으로 말하므로 모델이 맨 이름으로 먼저
  // 불러 실패한 뒤 「Tool names have the mcp__oprn__ prefix; retrying.」 같은 줄을 답에 흘렸다(2026-10-22 배경 조수 시험). 처음부터 알려 준다.
  const toolNaming = toolsEnabled
    ? `\n\n## Tool names in this session\nEvery tool these instructions name (for example show_map_region) is available as mcp__${CLAUDE_MCP_SERVER_NAME}__<name> (for example mcp__${CLAUDE_MCP_SERVER_NAME}__show_map_region). Call that full name directly. Never mention tool names, prefixes or retries in your replies to the user.\n`
    : "";
  writeFileSync(systemPromptPath, options.systemPrompt + toolNaming, { mode: 0o600 });
  let proc: SpawnedLines | undefined;
  let waiting: { resolve: () => void } | undefined;
  let lastMessageId = "";
  let calls = 0;
  let closed = false;
  let lastResultError: string | undefined;
  let heldFailure: Extract<Parameters<LocalCliSessionOptions["onEvent"]>[0], { kind: "result" }> | undefined;
  const start = (): SpawnedLines => spawnJsonLines({
    binary: options.binary ?? "claude",
    args: buildClaudeArgs(configPath, systemPromptPath, { tools: toolsEnabled, ...(options.model ? { model: options.model } : {}), ...(options.effort ? { effort: options.effort } : {}) }),
    cwd: work.dir,
    // 그림 생성 같은 긴 도구(한 장 수십 초)가 Claude Code 기본 MCP 도구 시간 제한에 끊기지 않게 — codex 의 tool_timeout_sec=900 과 같은 값.
    env: { MCP_TOOL_TIMEOUT: "900000", ...process.env, [MCP_TOKEN_ENV]: options.mcpToken },
    stdin: "keep-open",
    onJson: (line) => {
      options.onRaw?.(line);
      const message = line.message as { id?: string; content?: unknown } | undefined;
      if (line.type === "assistant") {
        const id = String(message?.id ?? "");
        const newRequest = id !== lastMessageId;
        if (newRequest) calls += 1;
        lastMessageId = id;
        options.onEvent({ kind: "assistant", messageId: id, newRequest, blocks: blocksOf(message?.content) });
      } else if (line.type === "user") {
        // 모델에게 실제로 넘어간 도구 결과(글·그림 원문, Anthropic tool_result 모양 그대로).
        const content = Array.isArray(message?.content) ? message!.content as unknown[] : [];
        const results = content.filter((part) => (part as { type?: string }).type === "tool_result");
        if (results.length) options.onEvent({ kind: "delivered", payload: results });
      } else if (line.type === "result") {
        const usage = usageOf(line.usage, calls);
        calls = 0;
        const event = {
          kind: "result" as const, ok: line.is_error !== true,
          ...(line.is_error === true ? { error: String(line.result ?? line.subtype ?? "Claude Code 실행 실패") } : {}),
          ...(usage ? { usage } : {}),
          ...(typeof line.total_cost_usd === "number" ? { costUsd: line.total_cost_usd } : {}),
          ...(typeof line.session_id === "string" ? { sessionId: line.session_id } : {}),
        };
        // 실패는 prompt() 가 다시 보낼지 정한 뒤에 낸다 — 중간 실패가 루프의 오류로 새지 않게.
        if (event.ok) options.onEvent(event); else { lastResultError = event.error; heldFailure = event; }
        const pending = waiting; waiting = undefined; pending?.resolve();
      }
    },
    onStderr: (text) => options.onEvent({ kind: "stderr", text }),
  });
  const abort = () => proc?.kill();
  options.signal?.addEventListener("abort", abort, { once: true });
  return {
    async prompt(text, images) {
      if (closed) throw new Error("세션이 이미 닫혔습니다");
      for (let attempt = 0; ; attempt++) {
        proc ??= start();
        const current = proc;
        lastResultError = undefined;
        heldFailure = undefined;
        let exitedEarly: string | undefined;
        const done = new Promise<void>((resolve) => { waiting = { resolve }; });
        const exited = current.exited.then((code) => { if (waiting) { waiting = undefined; exitedEarly = `Claude Code 가 코드 ${code} 로 끝났습니다`; } });
        current.write(userLine(text, images));
        await Promise.race([done, exited]);
        if (exitedEarly) { proc = undefined; heldFailure = { kind: "result", ok: false, error: exitedEarly }; }
        const error = exitedEarly ?? lastResultError;
        // 용량·속도 제한만 잠시 뒤 같은 차례를 다시 보낸다. 그 밖의 실패는 루프가 판단한다(이어 가기 차례).
        if (!error || !isTransientCliError(error) || attempt >= 2 || options.signal?.aborted) { if (heldFailure) options.onEvent(heldFailure); return; }
        await sleep(4000 * (attempt + 1), options.signal);
      }
    },
    steer(text) {
      // stream-json 입력은 차례 도중에 들어온 user 줄을 줄 세워 다음 모델 요청에 싣는다.
      proc?.write(userLine(text));
    },
    kill() { proc?.kill(); },
    async close() {
      if (closed) return;
      closed = true;
      options.signal?.removeEventListener("abort", abort);
      if (proc) { proc.endInput(); await Promise.race([proc.exited, sleep(5000)]); proc.kill(); }
      work.remove();
    },
  };

}

export const claudeAdapter: LocalCliAdapter = {
  id: "claude",
  label: "Claude Code",
  echoesResults: true,
  async detect(binary = "claude"): Promise<LocalCliStatus> {
    const base = {
      id: "claude" as const, label: "Claude Code", models: MODELS, defaults: { routine: "sonnet", deep: "sonnet" },
      install: { command: "curl -fsSL https://claude.ai/install.sh | bash", help: "Claude 계정(Pro·Max)이 있으면 설치 후 한 번 로그인하면 됩니다.", url: "https://claude.com/claude-code" },
      login: { command: "claude", help: "터미널에서 claude 를 한 번 실행해 브라우저로 로그인하세요." },
    };
    const version = runShort(binary, ["--version"], 15_000);
    if (!version.ok) return { ...base, state: "not-installed", stateLabel: "설치 필요", found: false, billing: "unknown" };
    const status = runShort(binary, ["auth", "status"], 20_000);
    try {
      const parsed = JSON.parse(status.stdout) as { loggedIn?: boolean; authMethod?: string };
      const loggedIn = parsed.loggedIn === true;
      return {
        ...base, found: true, version: version.stdout.trim(), loggedIn,
        ...(parsed.authMethod ? { authMethod: parsed.authMethod } : {}),
        billing: parsed.authMethod === "oauth_token" ? "subscription" : parsed.authMethod === "api_key" ? "api" : "unknown",
        state: loggedIn ? "ready" : "login-required", stateLabel: loggedIn ? "연결됨" : "로그인 필요",
      };
    } catch {
      return { ...base, found: true, version: version.stdout.trim(), billing: "unknown", state: "error", stateLabel: "확인 실패", problem: "로그인 상태를 읽지 못했습니다" };
    }
  },
  openSession(options) {
    return openClaudeSession(options);
  },
  async complete(prompt, options = {}) {
    let text = "";
    const session = openClaudeSession({
      mcpUrl: "http://127.0.0.1:9/none", mcpToken: "none", systemPrompt: "Answer the user's request directly. No tools are available.",
      ...(options.model ? { model: options.model } : {}), ...(options.signal ? { signal: options.signal } : {}), ...(options.binary ? { binary: options.binary } : {}),
      onEvent: (event) => {
        if (event.kind === "assistant") for (const block of event.blocks) if (block.type === "text") text += block.text;
      },
    }, false);
    try { await session.prompt(prompt, options.images); } finally { await session.close(); }
    return text;
  },
};
