// 공식 Antigravity CLI(`agy acp`) 어댑터 — Google 구독 사용자의 안전한 공식 ACP 경로.
//
// 원칙:
// - 제3자 OAuth 토큰 추출·직접 호출을 쓰지 않고, Google 공식 `agy acp --stdio` JSON-RPC 2.0 서버를 그대로 구동한다.
// - 사용자가 터미널에서 `agy acp --login` 으로 직접 로그인한 상태를 사용한다(토큰을 읽거나 옮기지 않는다).
// - 에디터 도구는 실행마다 뜨는 루프백 MCP 서버(mcpHttpServer.ts)를 ACP `session/new.mcpServers` 로만 연결한다.
// - 내장 셸/파일 편집 도구에 대한 권한 요청이 오면 `oprn` MCP 도구 외에는 거절한다.

import { spawn, type ChildProcess } from "node:child_process";
import { emptyWorkDir, isTransientCliError, runShort, sleep } from "./process.ts";
import { planSpawn, resolveBinary } from "./resolveBinary.ts";
import {
  installFields,
  type LocalCliAdapter,
  type LocalCliBlock,
  type LocalCliImage,
  type LocalCliInstallByOs,
  type LocalCliModel,
  type LocalCliSession,
  type LocalCliSessionOptions,
  type LocalCliStatus,
  type LocalCliUsage,
} from "./types.ts";

export const AGY_MCP_SERVER_NAME = "oprn";
export const AGY_DEFAULT_ROUTINE_MODEL = "gemini-4-argon";
export const AGY_DEFAULT_DEEP_MODEL = "gemini-4-neon";

export const AGY_FALLBACK_MODELS: readonly LocalCliModel[] = [
  { id: "gemini-4-neon", label: "Gemini 4 Neon (권장·깊은 작업)", roles: ["deep"] },
  { id: "gemini-4-argon", label: "Gemini 4 Argon (권장·일상)", roles: ["routine"] },
  { id: "gemini-4-carbon", label: "Gemini 4 Carbon" },
  { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (빠름)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (via agy)" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (via agy)" },
];

const AGY_INSTALL_HELP = "Google 공식 Antigravity CLI(agy)를 설치한 뒤 터미널에서 `agy acp --login` 으로 Google 계정에 로그인해 주세요.";
const AGY_INSTALL_URL = "https://antigravity.google/";

export const AGY_INSTALL_BY_OS: LocalCliInstallByOs = {
  win32: { command: "agy acp --login", help: AGY_INSTALL_HELP },
  darwin: { command: "agy acp --login", help: AGY_INSTALL_HELP },
  linux: { command: "agy acp --login", help: AGY_INSTALL_HELP },
};

const EFFORT_SUFFIX_RE = /-(low|medium|high|xhigh|max)$/iu;

/** `agy acp` 실행 인자. 기본 사용자 커스터마이징은 꺼서 에디터 시스템 프롬프트·MCP 도구와 충돌하지 않게 한다. */
export function buildAgyAcpArgs(): string[] {
  return [
    "acp",
    "--stdio",
    "--include-default-customizations=false",
    "--dangerously-skip-permissions",
  ];
}

/**
 * `agy models` 출력을 파싱한다.
 * - 로그인됨: `<modelId>\t<label>` 줄들이 반환된다(예: `gemini-4-neon-high\tGemini 4 Neon (High)`).
 * - 미로그인: `Error: Please sign in to view available models.` 문구가 나온다.
 */
export function parseAgyModelsOutput(output: string): { readonly models: LocalCliModel[]; readonly needsLogin: boolean } {
  const text = String(output ?? "");
  const rawModels: { id: string; label: string }[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || /^Fetching available models/iu.test(line)) continue;
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    const id = line.slice(0, tab).trim();
    const label = line.slice(tab + 1).trim();
    if (/^[a-z0-9._-]+$/iu.test(id) && label) rawModels.push({ id, label });
  }
  if (!rawModels.length) {
    const needsLogin = /please sign in|sign in|login|not logged in|authenticate/iu.test(text);
    return { models: [], needsLogin };
  }
  // 변형(-low/-medium/-high/-xhigh)은 기본 모델 ID 로 묶어 설정 선택지가 깔끔하게 보이도록 정리한다.
  const byBase = new Map<string, LocalCliModel>();
  for (const fallback of AGY_FALLBACK_MODELS) {
    const hasMatch = rawModels.some((row) => row.id === fallback.id || row.id.startsWith(`${fallback.id}-`));
    if (hasMatch) byBase.set(fallback.id, fallback);
  }
  for (const row of rawModels) {
    const baseId = row.id.replace(EFFORT_SUFFIX_RE, "");
    if (!byBase.has(baseId)) {
      const cleanLabel = row.label.replace(/\s*\((low|medium|high|xhigh|max)\)\s*$/iu, "").trim() || baseId;
      byBase.set(baseId, { id: baseId, label: cleanLabel });
    }
  }
  return { models: [...byBase.values()], needsLogin: false };
}

/** 에디터 모델 ID + 추론 강도를 `agy acp` 의 실제 `modelId`(예: `gemini-4-argon-high`)로 맞춘다. */
export function resolveAgyModelId(
  model: string | undefined,
  effort: string | undefined,
  availableIds: readonly string[] = [],
): string | undefined {
  const trimmed = model?.trim();
  if (!trimmed || trimmed === "auto") return undefined;
  const available = new Set(availableIds);
  if (available.size > 0 && available.has(trimmed)) return trimmed;
  if (EFFORT_SUFFIX_RE.test(trimmed)) return trimmed;
  const normalizedEffort = effort === "low" || effort === "medium" || effort === "high" || effort === "xhigh" || effort === "max"
    ? effort
    : "medium";
  const candidates = [
    `${trimmed}-${normalizedEffort}`,
    `${trimmed}-medium`,
    `${trimmed}-high`,
    `${trimmed}-low`,
    trimmed,
  ];
  if (available.size > 0) {
    const hit = candidates.find((candidate) => available.has(candidate));
    if (hit) return hit;
  }
  return candidates[0];
}

/**
 * `agy acp` 가 한도 소진 시 `stopReason: "end_turn"` 과 함께 경고 문구만 흘려보내는 경우를 감지한다.
 * 실제 토큰 사용량이 없으면서 한도 경고만 돌아오면 실패로 변환해 자동 페일오버가 다음 구독으로 전환할 수 있게 한다.
 */
export function parseAgyQuotaWarning(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (/individual quota reached|quota reached|quota exceeded|usage limit reached/iu.test(trimmed)) {
    const resetMatch = trimmed.match(/resets?\s+in\s+([^\n.]+)/iu);
    const suffix = resetMatch ? ` (${resetMatch[1].trim()} 후 초기화)` : "";
    return `Google Antigravity(agy) 구독 한도에 도달했습니다${suffix} — 429 quota exceeded`;
  }
  return undefined;
}

/** ACP 권한 요청(`session/request_permission`)에서 우리 MCP 도구만 허용하고 내장 셸/파일 도구는 차단한다. */
export function shouldApproveAgyPermission(params: unknown): boolean {
  if (!params || typeof params !== "object") return false;
  const p = params as {
    toolCall?: { title?: unknown; kind?: unknown; rawInput?: unknown; toolName?: unknown };
    title?: unknown;
    toolName?: unknown;
  };
  const title = String(p.toolCall?.title ?? p.title ?? "");
  const toolName = String(p.toolCall?.toolName ?? p.toolName ?? "");
  const kind = String(p.toolCall?.kind ?? "");
  const combined = `${title} ${toolName}`.toLowerCase();
  if (combined.includes("oprn") || combined.includes(`mcp__${AGY_MCP_SERVER_NAME}`)) return true;
  if (kind === "mcp" && !/(shell|bash|terminal|write_file|edit_file|delete)/iu.test(combined)) return true;
  return false;
}

function usageFromAcp(raw: unknown, calls: number): LocalCliUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, unknown>;
  const n = (key: string) => (typeof u[key] === "number" && Number.isFinite(u[key]) ? (u[key] as number) : 0);
  const input = n("inputTokens") || n("input_tokens");
  const output = n("outputTokens") || n("output_tokens");
  const cacheRead = n("cachedReadTokens") || n("cached_read_tokens");
  const cacheWrite = n("cachedWriteTokens") || n("cached_write_tokens");
  if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) return undefined;
  return { input: Math.max(0, input - cacheRead), output, cacheRead, cacheWrite, calls: Math.max(1, calls) };
}

/** ACP `session/update` 알림을 `LocalCliEvent` 로 변환하는 상태 기계(단위 테스트 가능). */
export function createAgyUpdateHandler(
  emit: LocalCliSessionOptions["onEvent"],
): {
  handleUpdate: (sessionId: string, update: Record<string, unknown>) => void;
  resetTurn: () => void;
  snapshot: () => { readonly calls: number; readonly toolCalls: number; readonly text: string };
} {
  let seq = 0;
  let calls = 0;
  let toolCalls = 0;
  let afterDelivery = true;
  let text = "";
  const toolNames = new Map<string, string>();

  const emitAssistant = (sessionId: string, blocks: LocalCliBlock[]) => {
    if (!blocks.length) return;
    if (afterDelivery) {
      seq += 1;
      calls += 1;
    }
    emit({ kind: "assistant", messageId: `${sessionId || "agy"}:${seq}`, newRequest: afterDelivery, blocks });
    afterDelivery = false;
  };

  return {
    resetTurn() {
      calls = 0;
      toolCalls = 0;
      afterDelivery = true;
      text = "";
      toolNames.clear();
    },
    snapshot() {
      return { calls, toolCalls, text };
    },
    handleUpdate(sessionId, update) {
      const kind = String(update.sessionUpdate ?? "");
      if (kind === "agent_message_chunk") {
        const content = update.content as { type?: string; text?: string } | undefined;
        if (content?.type === "text" && typeof content.text === "string" && content.text) {
          text += content.text;
          emitAssistant(sessionId, [{ type: "text", text: content.text }]);
        }
      } else if (kind === "agent_thought_chunk") {
        const content = update.content as { type?: string; text?: string } | undefined;
        if (content?.type === "text" && typeof content.text === "string" && content.text) {
          emitAssistant(sessionId, [{ type: "thinking", text: content.text }]);
        }
      } else if (kind === "tool_call") {
        const id = String(update.toolCallId ?? update.id ?? "");
        const rawName = String(update.toolName ?? update.title ?? "tool");
        const cleanName = rawName.replace(/^mcp__oprn__/u, "");
        if (id) toolNames.set(id, cleanName);
        const rawInput = update.rawInput as { name?: unknown } | undefined;
        emitAssistant(sessionId, [{
          type: "tool_use",
          name: cleanName,
          ...(typeof rawInput?.name === "string" ? { callee: rawInput.name } : {}),
        }]);
      } else if (kind === "tool_call_update") {
        const status = String(update.status ?? "");
        if (status === "completed" || status === "failed" || status === "error") {
          const id = String(update.toolCallId ?? update.id ?? "");
          const name = toolNames.get(id) ?? String(update.toolName ?? update.title ?? "").replace(/^mcp__oprn__/u, "");
          toolCalls += 1;
          emit({ kind: "acknowledged", toolName: name, ok: status === "completed" });
          afterDelivery = true;
        }
      }
    },
  };
}

interface AcpClient {
  call<T = Record<string, unknown>>(method: string, params: unknown): Promise<T>;
  notify(method: string, params: unknown): void;
  kill(): void;
  readonly alive: boolean;
}

function spawnAgyAcpClient(
  binary: string,
  cwd: string,
  onUpdate: (sessionId: string, update: Record<string, unknown>) => void,
  onStderr: (text: string) => void,
  onRaw?: (line: unknown) => void,
): AcpClient {
  const plan = planSpawn(binary, buildAgyAcpArgs());
  const child: ChildProcess = spawn(plan.command, [...plan.args], {
    cwd,
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    ...(plan.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
  });

  let alive = true;
  let nextId = 1;
  let stdoutBuf = "";
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  const failAll = (error: Error) => {
    alive = false;
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  const writeMsg = (payload: unknown) => {
    if (!alive || !child.stdin || child.stdin.destroyed) throw new Error("Antigravity ACP 프로세스가 이미 종료되었습니다.");
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  };

  const handlePermissionRequest = (id: number | string, params: unknown) => {
    const allowed = shouldApproveAgyPermission(params);
    const options = Array.isArray((params as { options?: unknown } | null)?.options)
      ? ((params as { options: Array<{ optionId?: string; kind?: string }> }).options)
      : [];
    const allowOption = options.find((opt) => opt.kind === "allow_once" || opt.kind === "allow_always" || opt.optionId === "allow_once")
      ?? options[0];
    const rejectOption = options.find((opt) => opt.kind === "reject_once" || opt.kind === "reject_always");
    const outcome = allowed && allowOption?.optionId
      ? { outcome: "selected", optionId: allowOption.optionId }
      : rejectOption?.optionId
        ? { outcome: "selected", optionId: rejectOption.optionId }
        : { outcome: "cancelled" };
    try { writeMsg({ jsonrpc: "2.0", id, result: { outcome } }); } catch { /* 이미 닫힘 */ }
  };

  child.stdout?.on("data", (chunk) => {
    stdoutBuf += String(chunk);
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(trimmed) as Record<string, unknown>; } catch { continue; }
      onRaw?.(msg);
      if (typeof msg.id === "number" && pending.has(msg.id) && !("method" in msg)) {
        const entry = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error && typeof msg.error === "object") {
          const errObj = msg.error as { message?: unknown; code?: unknown };
          entry.reject(new Error(String(errObj.message ?? `ACP error ${String(errObj.code ?? "")}`)));
        } else {
          entry.resolve(msg.result);
        }
      } else if (msg.id !== undefined && typeof msg.method === "string") {
        if (msg.method === "session/request_permission") {
          handlePermissionRequest(msg.id as number | string, msg.params);
        } else {
          try { writeMsg({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Unsupported client method: ${msg.method}` } }); } catch { /* 무시 */ }
        }
      } else if (msg.method === "session/update" && msg.params && typeof msg.params === "object") {
        const params = msg.params as { sessionId?: unknown; update?: unknown };
        if (params.update && typeof params.update === "object") {
          onUpdate(String(params.sessionId ?? ""), params.update as Record<string, unknown>);
        }
      }
    }
  });

  child.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    if (text.trim()) onStderr(text);
  });

  child.on("error", (error) => failAll(error instanceof Error ? error : new Error(String(error))));
  child.on("exit", (code, signal) => failAll(new Error(`Antigravity ACP 프로세스가 종료되었습니다 (code=${code ?? "none"}, signal=${signal ?? "none"})`)));

  return {
    get alive() { return alive; },
    call<T = Record<string, unknown>>(method: string, params: unknown): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve: (v) => resolve(v as T), reject });
        try {
          writeMsg({ jsonrpc: "2.0", id, method, params });
        } catch (error) {
          pending.delete(id);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    notify(method: string, params: unknown): void {
      try { writeMsg({ jsonrpc: "2.0", method, params }); } catch { /* 이미 닫힘 */ }
    },
    kill(): void {
      alive = false;
      try { child.stdin?.end(); } catch { /* 무시 */ }
      try { child.kill("SIGTERM"); } catch { /* 무시 */ }
    },
  };
}

function openAgySession(options: LocalCliSessionOptions, toolsEnabled = true): LocalCliSession {
  const work = emptyWorkDir("agy");
  const binary = options.binary ?? "agy";
  const toolNaming = toolsEnabled
    ? `\n\n## Tool names in this session\nUse the connected '${AGY_MCP_SERVER_NAME}' MCP server tools for every editor action. Never invoke shell, terminal, or local filesystem tools.\n`
    : "";
  const systemAppend = options.systemPrompt + toolNaming;

  let client: AcpClient | undefined;
  let sessionId: string | undefined;
  let resumePending: string | undefined = options.resumeSessionId;
  let queued: string[] = [];
  let closed = false;

  const updates = createAgyUpdateHandler(options.onEvent);

  const ensureSession = async (): Promise<{ client: AcpClient; sessionId: string }> => {
    if (client && client.alive && sessionId) return { client, sessionId };
    client?.kill();
    sessionId = undefined;

    const nextClient = spawnAgyAcpClient(
      binary,
      work.dir,
      (sid, update) => updates.handleUpdate(sid, update),
      (text) => options.onEvent({ kind: "stderr", text }),
      options.onRaw,
    );
    client = nextClient;

    await nextClient.call("initialize", {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: "oprn-studio", version: "1.0.0" },
    });

    const mcpServers = toolsEnabled
      ? [{
        type: "http",
        name: AGY_MCP_SERVER_NAME,
        url: options.mcpUrl,
        headers: [{ name: "Authorization", value: `Bearer ${options.mcpToken}` }],
      }]
      : [];

    let created: {
      sessionId?: string;
      models?: { currentModelId?: string; availableModels?: Array<{ modelId?: string }> };
    };
    if (resumePending) {
      const targetId = resumePending;
      resumePending = undefined;
      try {
        created = await nextClient.call("session/load", { sessionId: targetId, cwd: work.dir, mcpServers });
        if (!created?.sessionId) created = { ...created, sessionId: targetId };
      } catch {
        created = await nextClient.call("session/new", {
          cwd: work.dir,
          mcpServers,
          _meta: { antigravity: { systemPrompt: { append: systemAppend } } },
        });
      }
    } else {
      created = await nextClient.call("session/new", {
        cwd: work.dir,
        mcpServers,
        _meta: { antigravity: { systemPrompt: { append: systemAppend } } },
      });
    }

    const sid = typeof created.sessionId === "string" && created.sessionId ? created.sessionId : "";
    if (!sid) throw new Error("Antigravity ACP 가 sessionId 를 반환하지 않았습니다.");
    sessionId = sid;

    const availableIds = (created.models?.availableModels ?? [])
      .map((entry) => entry.modelId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const wantedModel = resolveAgyModelId(options.model, options.effort, availableIds);
    if (wantedModel && wantedModel !== created.models?.currentModelId) {
      await nextClient.call("session/set_model", { sessionId: sid, modelId: wantedModel }).catch(() => {
        // 선택 모델이 지원 목록에 없어도 세션 기본 모델로 계속 진행한다.
      });
    }

    return { client: nextClient, sessionId: sid };
  };

  const abort = () => {
    if (client?.alive && sessionId) client.notify("session/cancel", { sessionId });
    client?.kill();
    client = undefined;
  };
  options.signal?.addEventListener("abort", abort, { once: true });

  return {
    async prompt(text, images = []) {
      if (closed) throw new Error("세션이 이미 닫혔습니다");
      const prefix = queued.length ? `${queued.join("\n\n")}\n\n` : "";
      queued = [];
      const fullText = prefix + text;

      for (let attempt = 0; ; attempt++) {
        updates.resetTurn();
        try {
          const active = await ensureSession();
          const promptBlocks: Array<Record<string, unknown>> = [
            ...images.map((image) => ({ type: "image", mimeType: image.mimeType, data: image.data })),
            { type: "text", text: fullText },
          ];
          const res = await active.client.call<{ stopReason?: string; usage?: unknown; error?: string }>("session/prompt", {
            sessionId: active.sessionId,
            prompt: promptBlocks,
          });
          const snap = updates.snapshot();
          const usage = usageFromAcp(res?.usage, snap.calls);
          const quotaError = !usage ? parseAgyQuotaWarning(snap.text) : undefined;
          if (quotaError) {
            options.onEvent({ kind: "result", ok: false, error: quotaError, sessionId: active.sessionId });
            return;
          }
          options.onEvent({
            kind: "result",
            ok: true,
            ...(usage ? { usage } : {}),
            sessionId: active.sessionId,
          });
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const snap = updates.snapshot();
          client?.kill();
          client = undefined;
          sessionId = undefined;
          if (snap.toolCalls > 0 || !isTransientCliError(message) || attempt >= 2 || options.signal?.aborted) {
            options.onEvent({ kind: "result", ok: false, error: message });
            return;
          }
          await sleep(2500 * (attempt + 1), options.signal);
        }
      }
    },
    steer(text) { queued.push(text); },
    kill() { abort(); },
    async restartSession() {
      if (sessionId) resumePending = sessionId;
      client?.kill();
      client = undefined;
      sessionId = undefined;
    },
    conversationId: () => sessionId ?? resumePending,
    async close() {
      if (closed) return;
      closed = true;
      options.signal?.removeEventListener("abort", abort);
      abort();
      work.remove();
    },
  };
}

export const agyAdapter: LocalCliAdapter = {
  id: "agy",
  label: "Antigravity (agy)",
  echoesResults: false,
  async detect(binary = "agy"): Promise<LocalCliStatus> {
    const base = {
      id: "agy" as const,
      label: "Antigravity (agy)",
      defaults: { routine: AGY_DEFAULT_ROUTINE_MODEL, deep: AGY_DEFAULT_DEEP_MODEL },
      ...installFields(AGY_INSTALL_BY_OS, AGY_INSTALL_URL),
      login: {
        command: "agy acp --login",
        help: "터미널에서 `agy acp --login` 으로 Google 계정에 로그인한 뒤 「연결 확인」을 눌러 주세요.",
      },
    };
    const resolved = resolveBinary(binary);
    if (!resolved) {
      return { ...base, state: "not-installed", stateLabel: "설치 필요", found: false, billing: "unknown", models: [] };
    }
    const ver = await runShort(resolved, ["--version"], 5_000);
    if (ver.enoent) {
      return { ...base, state: "not-installed", stateLabel: "설치 필요", found: false, billing: "unknown", models: [] };
    }
    const version = (ver.stdout || ver.stderr).trim().split(/\r?\n/u)[0]?.trim() || undefined;
    const modelsRes = await runShort(resolved, ["models"], 8_000);
    const parsed = parseAgyModelsOutput(`${modelsRes.stdout}\n${modelsRes.stderr}`);
    if (parsed.models.length > 0) {
      return {
        ...base,
        state: "ready",
        stateLabel: "연결됨",
        found: true,
        binaryPath: resolved,
        ...(version ? { version } : {}),
        loggedIn: true,
        authMethod: "Google ACP",
        billing: "subscription",
        models: parsed.models,
      };
    }
    if (parsed.needsLogin) {
      return {
        ...base,
        state: "login-required",
        stateLabel: "로그인 필요",
        found: true,
        binaryPath: resolved,
        ...(version ? { version } : {}),
        loggedIn: false,
        billing: "unknown",
        models: AGY_FALLBACK_MODELS,
      };
    }
    return {
      ...base,
      state: "login-required",
      stateLabel: "로그인 필요",
      found: true,
      binaryPath: resolved,
      ...(version ? { version } : {}),
      loggedIn: false,
      billing: "unknown",
      models: AGY_FALLBACK_MODELS,
      ...(modelsRes.timedOut ? { problem: "모델 목록 확인 시간이 초과됐습니다." } : {}),
    };
  },
  openSession: (options) => openAgySession(options, true),
  async complete(prompt, options) {
    let text = "";
    let result: { ok: boolean; error?: string; usage?: LocalCliUsage } | undefined;
    const session = openAgySession({
      mcpUrl: "",
      mcpToken: "",
      systemPrompt: "Answer concisely and follow the user's format instructions exactly.",
      ...(options?.model ? { model: options.model } : {}),
      ...(options?.effort ? { effort: options.effort } : {}),
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(options?.binary ? { binary: options.binary } : {}),
      onEvent: (event) => {
        if (event.kind === "assistant") {
          for (const block of event.blocks) if (block.type === "text") text += block.text;
        } else if (event.kind === "result") {
          result = { ok: event.ok, ...(event.error ? { error: event.error } : {}), ...(event.usage ? { usage: event.usage } : {}) };
        }
      },
    }, false);
    try {
      await session.prompt(prompt, options?.images);
    } finally {
      await session.close();
    }
    if (result?.usage) options?.onUsage?.(result.usage);
    if (!result?.ok) throw new Error(result?.error || "Antigravity ACP 호출에 실패했습니다.");
    return text.trim();
  },
};
