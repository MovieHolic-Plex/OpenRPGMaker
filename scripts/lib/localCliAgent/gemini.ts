// Gemini CLI(`gemini -p`) 어댑터.
//
// 이 머신의 gemini 0.38.1 은 설치돼 있지만 비대화형 로그인이 없다(「Manual authorization is required」, 2026-10-20) —
// 실제 한 차례는 못 돌렸고, 모양은 녹화한 stream-json 으로만 검증했다(test/fixtures/localCli/gemini-stream.ndjson).
//
// - 설정은 시스템 설정 파일(GEMINI_CLI_SYSTEM_SETTINGS_PATH)로 덮는다 — 사용자 설정보다 우선이고 사용자 파일은 건드리지 않는다.
//   우리 MCP 서버 하나만 허용, 내장 도구(셸·파일·웹·메모리)는 제외, 훅·폴더 지침 파일 끔.
// - 승인 방식은 기본(default)으로 둔다: 비대화형에서 확인이 필요한 도구는 거절된다. 우리 서버만 trust:true 라 확인 없이 돈다.
// - 뒤이은 차례는 같은 임시 폴더에서 `--resume latest` 로 대화를 잇는다.

import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { emptyWorkDir, isTransientCliError, runShort, sleep, spawnJsonLines } from "./process.ts";
import { MCP_TOKEN_ENV } from "./claude.ts";
import type { LocalCliAdapter, LocalCliSession, LocalCliSessionOptions, LocalCliStatus } from "./types.ts";

/** 끄는 내장 도구. 이름은 gemini-cli 0.3x 의 도구 이름. */
const EXCLUDED_BUILTINS = [
  "run_shell_command", "write_file", "replace", "read_file", "read_many_files", "glob", "search_file_content",
  "list_directory", "web_fetch", "google_web_search", "save_memory", "write_todos", "activate_skill",
];

export function geminiSystemSettings(mcpUrl: string | undefined): Record<string, unknown> {
  return {
    ...(mcpUrl ? { mcpServers: { oprn: { httpUrl: mcpUrl, headers: { Authorization: `Bearer $${MCP_TOKEN_ENV}` }, trust: true, timeout: 900_000 } } } : { mcpServers: {} }),
    mcp: { allowed: mcpUrl ? ["oprn"] : [] },
    tools: { exclude: EXCLUDED_BUILTINS },
    hooksConfig: { enabled: false },
    hooks: {},
    context: { fileName: ["OPRN_NO_CONTEXT_FILE.md"] },
    general: { checkpointing: { enabled: false } },
    security: { folderTrust: { enabled: false } },
  };
}

export function buildGeminiArgs(options: { model?: string; resume?: boolean; mcp?: boolean }): string[] {
  return [
    "--output-format", "stream-json",
    "--approval-mode", "default",
    ...(options.mcp ? ["--allowed-mcp-server-names", "oprn"] : []),
    "--extensions", "none",
    ...(options.model ? ["-m", options.model] : []),
    ...(options.resume ? ["--resume", "latest"] : []),
    "-p", "",
  ];
}

/** gemini stream-json 한 줄 → 공용 사건. 녹화 시험이 이 함수를 그대로 쓴다. */
export function createGeminiLineReader(emit: LocalCliSessionOptions["onEvent"]): (line: Record<string, unknown>) => { error?: string } {
  let afterDelivery = true;
  let seq = 0;
  let calls = 0;
  let session = "";
  let error: string | undefined;
  const names = new Map<string, string>();
  return (line) => {
    const assistant = (blocks: { type: "text" | "tool_use"; text?: string; name?: string }[]) => {
      if (afterDelivery) { seq += 1; calls += 1; }
      emit({ kind: "assistant", messageId: `${session}:${seq}`, newRequest: afterDelivery, blocks: blocks as never });
      afterDelivery = false;
    };
    if (line.type === "init" && typeof line.session_id === "string") session = line.session_id;
    else if (line.type === "message" && line.role === "assistant" && typeof line.content === "string" && line.content) assistant([{ type: "text", text: line.content }]);
    else if (line.type === "tool_use") { names.set(String(line.tool_id ?? ""), String(line.tool_name ?? "")); assistant([{ type: "tool_use", name: String(line.tool_name ?? "") }]); }
    else if (line.type === "tool_result") {
      // gemini 는 도구 결과를 글(output)로만, 그림 없이 되돌려 준다 — 원문 대신 «이 호출의 결과를 모델에 넘겼다»는 확인만 보낸다.
      // 루프가 그 호출에 우리가 돌려준 원문(글·그림)을 짝지어 관문에 넘긴다.
      emit({ kind: "acknowledged", toolName: names.get(String(line.tool_id ?? "")) ?? "", ok: line.status === "success" });
      afterDelivery = true;
    } else if (line.type === "error") error ??= String(line.message ?? "Gemini CLI 오류");
    else if (line.type === "result") {
      const stats = (line.stats ?? {}) as Record<string, number>;
      const ok = line.status === "success";
      if (!ok) error ??= String((line.error as { message?: string } | undefined)?.message ?? "Gemini CLI 실행 실패");
      emit({ kind: "result", ok, ...(ok ? {} : { error: error! }), usage: { input: Math.max(0, (stats.input_tokens ?? 0) - (stats.cached ?? 0)), output: stats.output_tokens ?? 0, cacheRead: stats.cached ?? 0, cacheWrite: 0, calls: Math.max(1, calls) }, ...(session ? { sessionId: session } : {}) });
      calls = 0;
    }
    return error ? { error } : {};
  };
}

function openGeminiSession(options: LocalCliSessionOptions, toolsEnabled = true): LocalCliSession {
  const work = emptyWorkDir("gemini");
  const settingsPath = join(work.dir, "system-settings.json");
  const systemPromptPath = join(work.dir, "system.md");
  writeFileSync(settingsPath, JSON.stringify(geminiSystemSettings(toolsEnabled ? options.mcpUrl : undefined)), { mode: 0o600 });
  writeFileSync(systemPromptPath, options.systemPrompt, { mode: 0o600 });
  let started = false;
  let current: ReturnType<typeof spawnJsonLines> | undefined;
  let queued: string[] = [];
  let closed = false;
  const abort = () => current?.kill();
  options.signal?.addEventListener("abort", abort, { once: true });
  async function once(text: string): Promise<{ error?: string; toolCalls: number }> {
    let error: string | undefined;
    let toolCalls = 0;
    // 실패한 result 는 prompt() 가 다시 보낼지 정한 뒤에 낸다.
    const read = createGeminiLineReader((event) => { if (event.kind === "acknowledged") toolCalls += 1; if (event.kind === "result" && !event.ok) return; options.onEvent(event); });
    let sawResult = false;
    current = spawnJsonLines({
      binary: options.binary ?? "gemini",
      args: buildGeminiArgs({ ...(options.model ? { model: options.model } : {}), resume: started, mcp: toolsEnabled }),
      cwd: work.dir,
      env: {
        ...process.env, [MCP_TOKEN_ENV]: options.mcpToken,
        GEMINI_CLI_SYSTEM_SETTINGS_PATH: settingsPath,
        // 기본 시스템 프롬프트(코딩 지시)를 우리 지시문으로 바꾼다.
        GEMINI_SYSTEM_MD: systemPromptPath,
      },
      stdin: text,
      onJson: (line) => { options.onRaw?.(line); if (line.type === "result") sawResult = true; error = read(line).error ?? error; },
      onStderr: (chunk) => options.onEvent({ kind: "stderr", text: chunk }),
    });
    const code = await current.exited;
    current = undefined;
    started = true;
    if (!sawResult) error ??= `Gemini CLI 가 코드 ${code} 로 끝났습니다`;
    return { ...(error ? { error } : {}), toolCalls };
  }
  return {
    async prompt(text) {
      if (closed) throw new Error("세션이 이미 닫혔습니다");
      const steer = queued.length ? `${queued.join("\n\n")}\n\n` : "";
      queued = [];
      for (let attempt = 0; ; attempt++) {
        const outcome = await once(steer + text);
        // 도구를 하나라도 부른 뒤의 실패는 여기서 다시 보내지 않는다(같은 시공을 두 번 할 수 있다) — 루프가 «이어서» 차례로 잇는다.
        if (!outcome.error || outcome.toolCalls > 0 || !isTransientCliError(outcome.error) || attempt >= 3 || options.signal?.aborted) {
          if (outcome.error) options.onEvent({ kind: "result", ok: false, error: outcome.error });
          return;
        }
        await sleep(3000 * (attempt + 1), options.signal);
      }
    },
    steer(text) { queued.push(text); },
    kill() { current?.kill(); },
    async close() { if (closed) return; closed = true; options.signal?.removeEventListener("abort", abort); current?.kill(); work.remove(); },
  };
}

export const geminiAdapter: LocalCliAdapter = {
  id: "gemini",
  label: "Gemini CLI",
  echoesResults: false,
  async detect(binary = "gemini"): Promise<LocalCliStatus> {
    const base = {
      id: "gemini" as const, label: "Gemini CLI",
      models: [
        { id: "auto", label: "자동 (권장)", roles: ["routine", "deep"] as const },
        { id: "flash", label: "Flash (빠름·가벼움)" },
        { id: "pro", label: "Pro (강함)" },
      ],
      defaults: { routine: "auto", deep: "auto" },
      install: { command: "npm install -g @google/gemini-cli", help: "Google 계정이 있으면 설치 후 한 번 로그인하면 됩니다.", url: "https://github.com/google-gemini/gemini-cli" },
      login: { command: "gemini", help: "터미널에서 gemini 를 한 번 실행해 「Login with Google」로 로그인하세요." },
    };
    const version = runShort(binary, ["--version"], 15_000);
    if (!version.ok) return { ...base, state: "not-installed", stateLabel: "설치 필요", found: false, billing: "unknown" };
    // gemini 에는 로그인 상태 명령이 없다. 모델을 부르지 않고(한도를 안 쓰게) 로그인 흔적만 본다 —
    // 구글 로그인 자격 파일이 «있는지»만 확인하고 내용은 읽지 않는다. 키 환경 변수가 있으면 API 사용자다.
    const home = process.env.GEMINI_CLI_HOME ?? join(homedir(), ".gemini");
    const oauth = existsSync(join(home, "oauth_creds.json"));
    const apiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_USE_VERTEXAI);
    const loggedIn = oauth || apiKey;
    return {
      ...base, found: true, version: version.stdout.trim(), loggedIn,
      ...(loggedIn ? { authMethod: oauth ? "Google 로그인" : "API key" } : {}),
      billing: oauth ? "subscription" : apiKey ? "api" : "unknown",
      state: loggedIn ? "ready" : "login-required", stateLabel: loggedIn ? "연결됨" : "로그인 필요",
    };
  },
  openSession: (options) => openGeminiSession(options),
  async complete(prompt, options = {}) {
    // 비대화 gemini 는 표준 입력 글에 그림을 못 싣는다(@파일 읽기 도구는 잠금으로 껐다). 그림 없이 「봤다」고 답하게 두지 않는다.
    if (options.images?.length) throw Object.assign(new Error("Gemini CLI 엔진은 그림 검토를 아직 못 합니다 — 그림 판정은 Claude Code·Codex 엔진에서 하세요."), { status: 501 });
    let text = "";
    const session = openGeminiSession({
      mcpUrl: "", mcpToken: "none", systemPrompt: "Answer the user's request directly. You have no tools.",
      ...(options.model ? { model: options.model } : {}), ...(options.signal ? { signal: options.signal } : {}), ...(options.binary ? { binary: options.binary } : {}),
      onEvent: (event) => { if (event.kind === "assistant") for (const block of event.blocks) if (block.type === "text") text += block.text; },
    }, false);
    try { await session.prompt(prompt); } finally { await session.close(); }
    return text;
  },
};
