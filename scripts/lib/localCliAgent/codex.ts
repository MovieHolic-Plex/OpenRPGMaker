// Codex CLI(`codex exec`) 어댑터 — ChatGPT 구독 사용자의 경로(D6). ChatGPT 로그인 연동은 따로 만들지 않는다.
//
// - 차례 하나 = `codex exec --json` 프로세스 하나. 뒤이은 차례는 `codex exec resume <thread>` 로 같은 대화를 잇는다
//   (그래서 --ephemeral 은 쓰지 않는다 — 대화 기록은 사용자의 ~/.codex 에 남는다, codex 를 직접 쓸 때와 같다).
// - 잠금(D3): 셸·파일 쓰기·웹·브라우저·플러그인·하위 에이전트를 끈다. sandbox read-only + approval never 라 남은 apply_patch 도
//   쓰기가 거절된다(2026-10-20 실측). 사용자 config.toml·규칙 파일은 읽지 않는다(--ignore-user-config, 로그인은 그대로).
// - 기본 지시문(코딩 에이전트용)은 model_instructions_file 로 우리 지시문으로 바꾼다.
// - "Selected model is at capacity" 가 자주 섞인다(실측: 같은 명령이 번갈아 성공/실패) — 도구 호출 전 실패면 잠시 뒤 다시 보낸다.

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { emptyWorkDir, isTransientCliError, runShort, sleep, spawnJsonLines } from "./process.ts";
import { MCP_TOKEN_ENV } from "./claude.ts";
import type { LocalCliAdapter, LocalCliModel, LocalCliSession, LocalCliSessionOptions, LocalCliStatus, LocalCliUsage } from "./types.ts";

const DISABLED_FEATURES = [
  "shell_tool", "unified_exec", "apps", "browser_use", "browser_use_external", "computer_use", "image_generation",
  "in_app_browser", "plugins", "remote_plugin", "view_image", "tool_suggest", "skill_search", "skill_mcp_dependency_install",
  "sleep_tool", "multi_agent", "hooks", "goals", "realtime_conversation", "in_app_local_automation", "workspace_dependencies",
];

const FALLBACK_MODELS: LocalCliModel[] = [
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (권장)", roles: ["deep"] },
  { id: "gpt-6-luna", label: "GPT-6 Luna (빠름·가벼움)", roles: ["routine"] },
];

export function buildCodexArgs(work: string, instructionsPath: string, mcpUrl: string | undefined, options: { model?: string; effort?: string; resume?: string }): string[] {
  return [
    "exec", ...(options.resume ? ["resume", options.resume] : []),
    "--json", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules",
    ...(options.resume ? [] : ["-s", "read-only", "-C", work]),
    "-c", `approval_policy="never"`,
    "-c", `sandbox_mode="read-only"`,
    "-c", `web_search="disabled"`,
    "-c", `model_instructions_file=${JSON.stringify(instructionsPath)}`,
    ...(mcpUrl ? [
      "-c", `mcp_servers.oprn.url=${JSON.stringify(mcpUrl)}`,
      "-c", `mcp_servers.oprn.bearer_token_env_var="${MCP_TOKEN_ENV}"`,
      "-c", `mcp_servers.oprn.default_tools_approval_mode="approve"`,
      "-c", "mcp_servers.oprn.tool_timeout_sec=900",
    ] : []),
    ...DISABLED_FEATURES.flatMap((feature) => ["--disable", feature]),
    ...(options.model ? ["-m", options.model] : []),
    ...(options.effort ? ["-c", `model_reasoning_effort="${options.effort}"`] : []),
    "-",
  ];
}

function usageOf(raw: unknown, calls: number): LocalCliUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, number>;
  const cached = u.cached_input_tokens ?? 0;
  return { input: Math.max(0, (u.input_tokens ?? 0) - cached), output: (u.output_tokens ?? 0), cacheRead: cached, cacheWrite: u.cache_write_input_tokens ?? 0, calls };
}

/** MCP 결과(content 배열)를 관문이 읽는 Anthropic tool_result 모양으로. CLI 가 «받았다»고 되돌려 준 것만 넣는다. */
export function mcpResultAsDelivered(result: unknown): unknown | undefined {
  const content = (result as { content?: unknown } | null)?.content;
  if (!Array.isArray(content)) return undefined;
  return {
    type: "tool_result",
    content: content.map((part) => {
      const p = part as { type?: string; text?: string; data?: string; mimeType?: string; mime_type?: string };
      if (p.type === "image" && typeof p.data === "string") return { type: "image", source: { type: "base64", media_type: p.mimeType ?? p.mime_type ?? "image/png", data: p.data } };
      return { type: "text", text: typeof p.text === "string" ? p.text : "" };
    }),
  };
}

function codexModels(): LocalCliModel[] {
  // CLI 가 받아 둔 모델 목록(공개 정보, 비밀 아님). 없으면 고정 목록.
  try {
    const cache = JSON.parse(readFileSync(join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "models_cache.json"), "utf8")) as { models?: { slug?: string; display_name?: string; visibility?: string }[] };
    const rows = (cache.models ?? []).filter((m) => typeof m.slug === "string" && m.visibility !== "hide" && !/review/u.test(m.slug!));
    if (rows.length) return rows.map((m) => ({ id: m.slug!, label: m.display_name ?? m.slug!, ...(FALLBACK_MODELS.find((f) => f.id === m.slug)?.roles ? { roles: FALLBACK_MODELS.find((f) => f.id === m.slug)!.roles! } : {}) }));
  } catch { /* 목록이 없다 */ }
  return FALLBACK_MODELS;
}

function openCodexSession(options: LocalCliSessionOptions, toolsEnabled = true): LocalCliSession {
  const work = emptyWorkDir("codex");
  const instructionsPath = join(work.dir, "instructions.md");
  writeFileSync(instructionsPath, options.systemPrompt, { mode: 0o600 });
  let thread: string | undefined;
  let current: ReturnType<typeof spawnJsonLines> | undefined;
  let queued: string[] = [];
  let closed = false;
  const abort = () => current?.kill();
  options.signal?.addEventListener("abort", abort, { once: true });

  async function once(text: string): Promise<{ error?: string; toolCalls: number }> {
    let error: string | undefined;
    let calls = 0;
    let toolCalls = 0;
    let afterDelivery = true;
    let messageSeq = 0;
    const assistant = (blocks: { type: "text" | "thinking" | "tool_use"; text?: string; name?: string }[]) => {
      if (afterDelivery) { calls += 1; messageSeq += 1; }
      options.onEvent({ kind: "assistant", messageId: `${thread ?? "codex"}:${messageSeq}`, newRequest: afterDelivery, blocks: blocks as never });
      afterDelivery = false;
    };
    current = spawnJsonLines({
      binary: options.binary ?? "codex",
      args: buildCodexArgs(work.dir, instructionsPath, toolsEnabled ? options.mcpUrl : undefined, { ...(options.model ? { model: options.model } : {}), ...(options.effort ? { effort: options.effort } : {}), ...(thread ? { resume: thread } : {}) }),
      cwd: work.dir,
      env: { ...process.env, [MCP_TOKEN_ENV]: options.mcpToken },
      stdin: text,
      onJson: (line) => {
        options.onRaw?.(line);
        const item = line.item as { type?: string; text?: string; tool?: string; server?: string; result?: unknown; error?: { message?: string } | null; message?: string } | undefined;
        if (line.type === "thread.started" && typeof line.thread_id === "string") thread = line.thread_id;
        else if (line.type === "item.started" && item?.type === "mcp_tool_call") { toolCalls += 1; assistant([{ type: "tool_use", name: String(item.tool ?? "") }]); }
        else if (line.type === "item.completed" && item?.type === "mcp_tool_call") {
          const delivered = item.error ? { type: "tool_result", is_error: true, content: [{ type: "text", text: item.error.message ?? "" }] } : mcpResultAsDelivered(item.result);
          if (delivered) options.onEvent({ kind: "delivered", payload: [delivered] });
          afterDelivery = true;
        } else if (line.type === "item.completed" && item?.type === "agent_message" && typeof item.text === "string") assistant([{ type: "text", text: item.text }]);
        else if (line.type === "item.completed" && item?.type === "reasoning" && typeof item.text === "string") assistant([{ type: "thinking", text: item.text }]);
        else if (line.type === "turn.completed") {
          const usage = usageOf(line.usage, Math.max(1, calls));
          options.onEvent({ kind: "result", ok: true, ...(usage ? { usage } : {}), ...(thread ? { sessionId: thread } : {}) });
        } else if (line.type === "turn.failed" || line.type === "error") {
          const message = (line.error as { message?: string } | undefined)?.message ?? (typeof line.message === "string" ? line.message : "Codex 실행 실패");
          error ??= message;
        }
      },
      onStderr: (chunk) => { if (!/Reading additional input from stdin/u.test(chunk)) options.onEvent({ kind: "stderr", text: chunk }); },
    });
    const code = await current.exited;
    current = undefined;
    if (!error && code !== 0) error = `Codex 가 코드 ${code} 로 끝났습니다`;
    return { ...(error ? { error } : {}), toolCalls };
  }

  return {
    async prompt(text) {
      if (closed) throw new Error("세션이 이미 닫혔습니다");
      const steer = queued.length ? `${queued.join("\n\n")}\n\n` : "";
      queued = [];
      let next = steer + text;
      let progressed = false;
      for (let attempt = 0; ; attempt++) {
        const outcome = await once(next);
        if (outcome.toolCalls > 0) progressed = true;
        if (!outcome.error || !isTransientCliError(outcome.error) || attempt >= 5 || options.signal?.aborted) {
          if (outcome.error) options.onEvent({ kind: "result", ok: false, error: outcome.error });
          return;
        }
        // 용량 부족은 길게 기다린다(실측 2026-10-20: gpt-6.1-sol 이 수십 초 동안 연달아 거절). 도구를 이미 부른 차례는
        // 같은 지시를 다시 보내지 않고(시공을 두 번 할 수 있다) 같은 대화에 «이어서» 한 줄로 잇는다.
        if (progressed && thread) next = "[연결 재시도] 직전 응답이 모델 용량 부족으로 끊겼습니다. 이미 실행된 도구 결과는 위에 있습니다. 처음부터 다시 하지 말고 이어서 진행하세요.";
        await sleep(Math.min(60_000, 8000 * (attempt + 1)), options.signal);
      }
    },
    // codex exec 는 진행 중인 차례에 말을 끼울 수 없다 — 다음 차례 앞에 붙인다.
    steer(text) { queued.push(text); },
    kill() { current?.kill(); },
    async close() {
      if (closed) return;
      closed = true;
      options.signal?.removeEventListener("abort", abort);
      current?.kill();
      work.remove();
    },
  };
}

export const codexAdapter: LocalCliAdapter = {
  id: "codex",
  label: "Codex (ChatGPT)",
  echoesResults: true,
  async detect(binary = "codex"): Promise<LocalCliStatus> {
    const models = codexModels();
    const has = (id: string) => models.some((m) => m.id === id);
    const base = {
      id: "codex" as const, label: "Codex (ChatGPT)", models,
      defaults: { routine: has("gpt-6-luna") ? "gpt-6-luna" : models[0]!.id, deep: has("gpt-6.1-sol") ? "gpt-6.1-sol" : models[0]!.id },
      install: { command: "npm install -g @openai/codex", help: "ChatGPT 유료 계정이 있으면 설치 후 한 번 로그인하면 됩니다.", url: "https://developers.openai.com/codex/cli" },
      login: { command: "codex login", help: "터미널에서 codex login 을 실행해 ChatGPT 계정으로 로그인하세요." },
    };
    const version = runShort(binary, ["--version"], 15_000);
    if (!version.ok) return { ...base, state: "not-installed", stateLabel: "설치 필요", found: false, billing: "unknown" };
    const status = runShort(binary, ["login", "status"], 20_000);
    const said = `${status.stdout}\n${status.stderr}`.trim();
    const loggedIn = status.ok && /logged in/iu.test(said) && !/not logged in/iu.test(said);
    const chatgpt = /chatgpt/iu.test(said);
    return {
      ...base, found: true, version: version.stdout.trim(), loggedIn,
      ...(loggedIn ? { authMethod: chatgpt ? "ChatGPT" : "API key" } : {}),
      billing: loggedIn ? (chatgpt ? "subscription" : "api") : "unknown",
      state: loggedIn ? "ready" : "login-required", stateLabel: loggedIn ? "연결됨" : "로그인 필요",
    };
  },
  openSession: (options) => openCodexSession(options),
  async complete(prompt, options = {}) {
    let text = "";
    const session = openCodexSession({
      mcpUrl: "", mcpToken: "none", systemPrompt: "Answer the user's request directly. You have no tools.",
      ...(options.model ? { model: options.model } : {}), ...(options.signal ? { signal: options.signal } : {}), ...(options.binary ? { binary: options.binary } : {}),
      onEvent: (event) => { if (event.kind === "assistant") for (const block of event.blocks) if (block.type === "text") text = block.text; },
    }, false);
    try { await session.prompt(prompt); } finally { await session.close(); }
    return text;
  },
};
