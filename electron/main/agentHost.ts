// 에이전트 모드(실험) — 사용자 PC 의 코딩 에이전트를 ACP(Agent Client Protocol)로 띄우는 호스트.
//
//   편집기 패널 ─(oprn:agent.* 채널: IPC 또는 /__oprn/bridge)─▶ 이 모듈 ─stdio JSON-RPC(ACP)─▶ 에이전트 어댑터
//   에이전트 ─MCP stdio─▶ scripts/oprn-agent-mode-mcp.mjs ─HTTP 127.0.0.1(토큰)─▶ 이 모듈 ─(poll 이벤트)─▶ 편집기가 도구 실행
//
// 이 모듈은 프로젝트 파일을 읽거나 쓰지 않는다. 도구 실행은 편집기 렌더러가 자기 스토어에서 하고(캔버스 즉시 반영·
// 턴 단위 되돌리기·바뀐 칸 표시), 저장도 편집기의 평소 저장 경로를 탄다. 토큰·로그인은 에이전트가 갖는다 —
// 이 모듈은 환경 변수를 그대로 넘길 뿐 자격 증명을 읽지 않는다.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";
import { AGENT_RULES_SKILL_ID, agentRulesPromptLines, renderAgentRulesSkill } from "../../src/ai/agentRules";
import { createAgentInstaller, type AgentInstaller, type InstallableAgent, type InstallerPaths, type SetupEvent } from "./agentInstaller";

export type AgentKind = "claude" | "codex" | "opencode";

export type AgentAvailability = {
  readonly id: AgentKind;
  readonly label: string;
  /** 에이전트 CLI(로그인 주체)가 PATH 에 있는가. */
  readonly cliFound: boolean;
  /** ACP 로 말하는 실행 파일(어댑터)이 PATH 에 있는가. opencode 는 CLI 자체가 ACP 를 말한다. */
  readonly adapterFound: boolean;
  readonly ready: boolean;
  readonly installHint: string;
  readonly loginHint: string;
  /** 앱 전용 폴더에 설치한 것인가(앱이 설치·제거할 수 있다). */
  readonly appInstalled: boolean;
  /** 공식 상태 명령으로 물은 로그인 여부. 모르면 null. */
  readonly loggedIn: boolean | null;
};

type AgentSpec = {
  readonly id: AgentKind;
  readonly label: string;
  readonly cli: string;
  readonly adapter: string;
  readonly adapterArgs: readonly string[];
  readonly installHint: string;
  readonly loginHint: string;
};

const AGENT_SPECS: readonly AgentSpec[] = [
  {
    id: "claude", label: "Claude Code", cli: "claude", adapter: "claude-agent-acp", adapterArgs: [],
    installHint: "npm install -g @anthropic-ai/claude-code @agentclientprotocol/claude-agent-acp",
    loginHint: "Claude 공식 로그인 창(브라우저)에서 본인 계정으로 로그인합니다. OPRN 은 로그인 정보를 보지 않습니다.",
  },
  {
    id: "codex", label: "Codex", cli: "codex", adapter: "codex-acp", adapterArgs: [],
    installHint: "npm install -g @agentclientprotocol/codex-acp",
    loginHint: "Codex 공식 로그인 창(브라우저)에서 본인 ChatGPT 계정으로 로그인합니다.",
  },
  {
    id: "opencode", label: "opencode", cli: "opencode", adapter: "opencode", adapterArgs: ["acp"],
    installHint: "npm install -g opencode-ai",
    loginHint: "로그인 없이 무료 모델로 바로 쓸 수 있습니다. 다른 제공자는 opencode 의 auth login 으로 추가합니다.",
  },
];

/** PATH(윈도는 PATHEXT 포함)에서 실행 파일을 찾는다. 없으면 null. */
export function findOnPath(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const dirs = (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean) : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, `${name}${ext.toLowerCase()}`);
      if (existsSync(candidate)) return candidate;
      const upper = join(dir, `${name}${ext}`);
      if (existsSync(upper)) return upper;
    }
  }
  return null;
}

export function detectAgents(env: NodeJS.ProcessEnv = process.env): readonly AgentAvailability[] {
  return AGENT_SPECS.map((spec) => {
    const cliFound = findOnPath(spec.cli, env) !== null;
    const adapterFound = findOnPath(spec.adapter, env) !== null;
    return { id: spec.id, label: spec.label, cliFound, adapterFound, ready: cliFound && adapterFound, installHint: spec.installHint, loginHint: spec.loginHint, appInstalled: false, loggedIn: null };
  });
}

type LaunchCommand = { readonly command: string; readonly args: readonly string[]; readonly env: Readonly<Record<string, string>> };

/** 앱 폴더에 설치한 것을 먼저, 없으면 PATH 의 것을 쓴다. */
function resolveAdapter(spec: AgentSpec, installer: AgentInstaller | null, env: NodeJS.ProcessEnv): LaunchCommand | null {
  const installed = installer?.installed(spec.id);
  if (installed) return installed.adapter;
  const onPath = findOnPath(spec.adapter, env);
  return onPath ? { command: onPath, args: spec.adapterArgs, env: {} } : null;
}

/** 패널이 poll 로 받는 이벤트. ACP session/update 는 그대로 싣고, 도구 실행·승인은 요청 id 로 짝을 맞춘다. */
export type AgentEvent =
  | { readonly seq: number; readonly type: "status"; readonly state: "starting" | "ready" | "busy" | "idle" | "stopped" | "error"; readonly detail?: string }
  | { readonly seq: number; readonly type: "update"; readonly update: Record<string, unknown> }
  | { readonly seq: number; readonly type: "permission"; readonly requestId: string; readonly toolCall: Record<string, unknown>; readonly options: readonly { optionId: string; name: string; kind: string }[] }
  | { readonly seq: number; readonly type: "tool-request"; readonly requestId: string; readonly kind: "list" | "call"; readonly name?: string; readonly args?: unknown }
  | { readonly seq: number; readonly type: "turn-start"; readonly turnId: string; readonly prompt: string }
  | { readonly seq: number; readonly type: "turn-end"; readonly turnId: string; readonly stopReason: string; readonly error?: string }
  | { readonly seq: number; readonly type: "log"; readonly text: string }
  | ({ readonly seq: number; readonly type: "setup" } & SetupEvent);

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewEvent = DistributiveOmit<AgentEvent, "seq">;

export type AgentHostOptions = {
  /** 에이전트가 띄울 MCP 서버 명령. 데스크톱은 Electron 바이너리 + ELECTRON_RUN_AS_NODE, 웹 호스트는 node. */
  readonly mcpCommand: { readonly command: string; readonly args: readonly string[]; readonly env?: Readonly<Record<string, string>> };
  /** 에이전트 작업 폴더(프로젝트 파일이 아닌 빈 폴더). 내장 파일 도구를 꺼도 cwd 는 필요하다. */
  readonly workDir: string;
  readonly env?: NodeJS.ProcessEnv;
  /** 앱 안 설치기. 없으면(브라우저 로컬 호스트) PATH 감지만 한다. */
  readonly installer?: Omit<InstallerPaths, "env">;
};

/** 에이전트에게 붙이는 지시. 쓰기는 oprn 도구로만, 파일 도구 없음, 결과는 짧게 — 게임 짓기 규칙은 src/ai/agentRules.ts 한 곳에 있다. */
export const AGENT_SYSTEM_APPEND = [
  "You are working inside OPRN Studio, an RPG map/game editor that is open on the user's screen.",
  "Edit the game ONLY through the `oprn` MCP tools. You have no file or shell tools; never try to edit project files.",
  "Every successful write tool call is applied to the open editor at once; the user watches the map change live and can undo your whole turn with one click.",
  "The direct tools are the most common ones. For anything else, search with oprn_tools (a word like 'npc', 'door', 'paint', 'event'), read one schema with oprn_schema, and call it with oprn_call.",
  "Start by reading the project summary when you need map ids or coordinates. Keep replies short and in the user's language.",
  ...agentRulesPromptLines(),
].join("\n");

const POLL_WAIT_MS = 25_000;

/**
 * 에이전트 작업 폴더에 게임 짓기 규칙을 파일로도 둔다 — 시스템 프롬프트(_meta.systemPrompt.append)를 무시하는 어댑터
 * (codex-acp·opencode)는 cwd 의 AGENTS.md 를 직접 읽고, Claude Code 는 CLAUDE.md 와 skills/ 를 읽는다.
 * 한 글을 두 경로로 주므로 어느 어댑터로 돌려도 같은 규칙을 받는다(원문은 src/ai/agentRules.ts 하나).
 */
export function writeAgentRulesFiles(workDir: string): readonly string[] {
  const skill = renderAgentRulesSkill();
  const dirs = [join(workDir, "skills", AGENT_RULES_SKILL_ID), join(workDir, ".claude", "skills", AGENT_RULES_SKILL_ID)];
  const written: string[] = [];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
    written.push(join(dir, "SKILL.md"));
  }
  written.push(join(workDir, "AGENTS.md"), join(workDir, "CLAUDE.md"));
  for (const file of written) writeFileSync(file, skill, "utf8");
  return written;
}
const TOOL_TIMEOUT_MS = 5 * 60_000;
const MAX_EVENTS = 2000;

export function createAgentHost(options: AgentHostOptions) {
  let events: AgentEvent[] = [];
  let seq = 0;
  const waiters = new Set<() => void>();
  const pendingTools = new Map<string, { resolve: (value: unknown) => void; timer: ReturnType<typeof setTimeout> }>();
  const pendingPermissions = new Map<string, (optionId: string | null) => void>();
  let child: ChildProcessWithoutNullStreams | null = null;
  let rpcId = 0;
  const rpcPending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let sessionId: string | null = null;
  let agent: AgentKind | null = null;
  let busyTurn: string | null = null;
  let mcpServer: Server | null = null;
  let mcpPort = 0;
  const mcpToken = randomUUID();
  const hostEnv = options.env ?? process.env;
  const installer: AgentInstaller | null = options.installer
    ? createAgentInstaller({ ...options.installer, env: hostEnv }, (event: SetupEvent) => push({ type: "setup", ...event }))
    : null;

  const push = (event: NewEvent): void => {
    seq += 1;
    events.push({ ...event, seq } as AgentEvent);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    for (const wake of [...waiters]) wake();
  };

  const rpcSend = (message: Record<string, unknown>): void => {
    child?.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  };
  const rpcRequest = (method: string, params: unknown): Promise<unknown> => new Promise((resolve, reject) => {
    if (!child) { reject(new Error("agent is not running")); return; }
    rpcId += 1;
    rpcPending.set(rpcId, { resolve, reject });
    rpcSend({ id: rpcId, method, params });
  });

  /** 에이전트 → 클라이언트 요청(승인, fs, terminal). fs·terminal 은 능력에서 껐으므로 거절한다. */
  const onAgentRequest = (message: { id: number | string; method: string; params?: Record<string, unknown> }): void => {
    if (message.method === "session/request_permission") {
      const requestId = randomUUID();
      const params = message.params ?? {};
      pendingPermissions.set(requestId, (optionId) => {
        rpcSend({ id: message.id, result: { outcome: optionId ? { outcome: "selected", optionId } : { outcome: "cancelled" } } });
      });
      push({ type: "permission", requestId, toolCall: (params.toolCall ?? {}) as Record<string, unknown>,
        options: Array.isArray(params.options) ? params.options as { optionId: string; name: string; kind: string }[] : [] });
      return;
    }
    rpcSend({ id: message.id, error: { code: -32601, message: `OPRN agent mode does not support ${message.method}` } });
  };

  async function ensureMcpServer(): Promise<number> {
    if (mcpServer) return mcpPort;
    const server = createServer((request, response) => {
      if (request.method !== "POST" || request.url !== "/agent-mcp" || request.headers["x-oprn-agent-token"] !== mcpToken) {
        response.writeHead(403).end();
        return;
      }
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        let body: { kind?: string; name?: string; args?: unknown };
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as typeof body; } catch { response.writeHead(400).end(); return; }
        const requestId = randomUUID();
        const kind = body.kind === "list" ? "list" : "call";
        const timer = setTimeout(() => {
          pendingTools.delete(requestId);
          response.writeHead(504, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: "편집기가 응답하지 않습니다(에이전트 모드 패널이 열려 있는지 확인)" }));
        }, TOOL_TIMEOUT_MS);
        pendingTools.set(requestId, {
          timer,
          resolve: (result) => {
            clearTimeout(timer);
            response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, result }));
          },
        });
        push({ type: "tool-request", requestId, kind, ...(kind === "call" ? { name: body.name, args: body.args ?? {} } : {}) });
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    mcpPort = typeof address === "object" && address ? address.port : 0;
    mcpServer = server;
    return mcpPort;
  }

  function stopChild(): void {
    const running = child;
    child = null;
    sessionId = null;
    for (const [, pending] of rpcPending) pending.reject(new Error("agent stopped"));
    rpcPending.clear();
    for (const [, answer] of pendingPermissions) answer(null);
    pendingPermissions.clear();
    if (running && running.exitCode === null) running.kill();
  }

  return {
    async detect(): Promise<readonly AgentAvailability[]> {
      const onPath = detectAgents(hostEnv);
      return await Promise.all(onPath.map(async (agent) => {
        const installed = installer?.installed(agent.id);
        if (!installed) return agent;
        return { ...agent, cliFound: true, adapterFound: true, appInstalled: true, loggedIn: await installer!.loggedIn(agent.id), ready: true };
      }));
    },

    canInstall(): boolean {
      return installer !== null;
    },

    install(kind: AgentKind): { started: boolean } {
      if (!installer) throw new Error("이 화면에서는 앱 안 설치를 쓸 수 없습니다(데스크톱 앱에서 설치하세요)");
      if (installer.isBusy(kind)) return { started: false };
      if (agent === kind && child) stopChild();
      void installer.install(kind as InstallableAgent);
      return { started: true };
    },

    uninstall(kind: AgentKind): void {
      if (!installer) throw new Error("이 화면에서는 앱 안 설치를 쓸 수 없습니다");
      if (agent === kind) { stopChild(); push({ type: "status", state: "stopped", detail: "에이전트를 지워 세션을 닫았습니다" }); }
      installer.uninstall(kind as InstallableAgent);
    },

    login(kind: AgentKind): void {
      if (!installer) throw new Error("이 화면에서는 앱 안 로그인을 쓸 수 없습니다");
      installer.login(kind as InstallableAgent);
    },

    loginCode(kind: AgentKind, code: string): boolean {
      return installer?.loginCode(kind as InstallableAgent, code) ?? false;
    },

    cancelLogin(kind: AgentKind): void {
      installer?.cancelLogin(kind as InstallableAgent);
    },

    state() {
      return { agent, sessionId, running: child !== null, busy: busyTurn !== null, seq };
    },

    async start(kind: AgentKind): Promise<{ sessionId: string }> {
      const spec = AGENT_SPECS.find((candidate) => candidate.id === kind);
      if (!spec) throw new Error(`unknown agent ${kind}`);
      const launch = resolveAdapter(spec, installer, hostEnv);
      if (!launch) throw new Error(`${spec.label} 이(가) 설치되어 있지 않습니다. 「설치」를 눌러 주세요.`);
      stopChild();
      agent = kind;
      push({ type: "status", state: "starting", detail: spec.label });
      const port = await ensureMcpServer();
      mkdirSync(options.workDir, { recursive: true });
      writeAgentRulesFiles(options.workDir);
      // 윈도 .cmd 래퍼는 shell 없이 띄울 수 없다.
      const spawned = spawn(launch.command, [...launch.args], { cwd: options.workDir, env: { ...hostEnv, ...launch.env }, stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(launch.command), windowsHide: true });
      child = spawned;
      spawned.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8").trim();
        if (text) push({ type: "log", text: text.slice(0, 2000) });
      });
      spawned.on("exit", (code, signal) => {
        if (child === spawned) {
          stopChild();
          push({ type: "status", state: "stopped", detail: `에이전트가 종료되었습니다(code ${code ?? "-"}${signal ? `, ${signal}` : ""})` });
        }
      });
      spawned.on("error", (error) => push({ type: "status", state: "error", detail: error.message }));
      createInterface({ input: spawned.stdout }).on("line", (line) => {
        let message: { id?: number | string; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message?: string } };
        try { message = JSON.parse(line) as typeof message; } catch { return; }
        if (message.method && message.id !== undefined) { onAgentRequest(message as { id: number | string; method: string; params?: Record<string, unknown> }); return; }
        if (message.method === "session/update") {
          const update = message.params?.update as Record<string, unknown> | undefined;
          if (update && update.sessionUpdate !== "available_commands_update") push({ type: "update", update });
          return;
        }
        if (typeof message.id === "number" && rpcPending.has(message.id)) {
          const pending = rpcPending.get(message.id)!;
          rpcPending.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message ?? "agent error"));
          else pending.resolve(message.result);
        }
      });
      try {
        await rpcRequest("initialize", {
          protocolVersion: 1,
          clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
          clientInfo: { name: "oprn-studio", title: "OPRN Studio", version: "1" },
        });
        const mcpEnv = { ...(options.mcpCommand.env ?? {}), OPRN_AGENT_HOST: `http://127.0.0.1:${port}`, OPRN_AGENT_TOKEN: mcpToken };
        const created = await rpcRequest("session/new", {
          cwd: options.workDir,
          mcpServers: [{ name: "oprn", command: options.mcpCommand.command, args: [...options.mcpCommand.args], env: Object.entries(mcpEnv).map(([name, value]) => ({ name, value })) }],
          // claude-agent-acp: 내장 파일·셸 도구를 끄고 OPRN 지시를 덧붙인다. 다른 어댑터는 모르는 _meta 를 무시한다.
          _meta: { disableBuiltInTools: true, systemPrompt: { append: AGENT_SYSTEM_APPEND } },
        }) as { sessionId: string };
        sessionId = created.sessionId;
        push({ type: "status", state: "ready", detail: spec.label });
        return { sessionId: created.sessionId };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        push({ type: "status", state: "error", detail });
        stopChild();
        throw error;
      }
    },

    /** 프롬프트 한 턴. 끝날 때까지 기다리지 않는다 — 결과는 poll 이벤트(turn-end)로 온다. */
    prompt(text: string): { turnId: string } {
      if (!child || !sessionId) throw new Error("에이전트 세션이 없습니다");
      if (busyTurn) throw new Error("이전 요청이 아직 진행 중입니다");
      const turnId = randomUUID();
      busyTurn = turnId;
      push({ type: "turn-start", turnId, prompt: text });
      push({ type: "status", state: "busy" });
      rpcRequest("session/prompt", { sessionId, prompt: [{ type: "text", text }] }).then(
        (result) => {
          busyTurn = null;
          push({ type: "turn-end", turnId, stopReason: String((result as { stopReason?: string } | undefined)?.stopReason ?? "end_turn") });
          push({ type: "status", state: "idle" });
        },
        (error: unknown) => {
          busyTurn = null;
          push({ type: "turn-end", turnId, stopReason: "error", error: error instanceof Error ? error.message : String(error) });
          push({ type: "status", state: child ? "idle" : "stopped" });
        },
      );
      return { turnId };
    },

    cancel(): void {
      if (!child || !sessionId) return;
      // 대기 중인 승인은 ACP 규약대로 cancelled 로 답한다.
      for (const [, answer] of pendingPermissions) answer(null);
      pendingPermissions.clear();
      rpcSend({ method: "session/cancel", params: { sessionId } });
    },

    answerPermission(requestId: string, optionId: string | null): boolean {
      const answer = pendingPermissions.get(requestId);
      if (!answer) return false;
      pendingPermissions.delete(requestId);
      answer(optionId);
      return true;
    },

    answerTool(requestId: string, result: unknown): boolean {
      const pending = pendingTools.get(requestId);
      if (!pending) return false;
      pendingTools.delete(requestId);
      pending.resolve(result);
      return true;
    },

    /** after 보다 큰 seq 의 이벤트를 돌려준다. 없으면 최대 waitMs 기다린다(롱 폴). */
    async poll(after: number, waitMs = POLL_WAIT_MS): Promise<{ events: readonly AgentEvent[]; seq: number }> {
      const pick = () => events.filter((event) => event.seq > after);
      let ready = pick();
      if (ready.length === 0 && waitMs > 0) {
        await new Promise<void>((resolve) => {
          const wake = () => { waiters.delete(wake); clearTimeout(timer); resolve(); };
          const timer = setTimeout(wake, Math.min(waitMs, POLL_WAIT_MS));
          waiters.add(wake);
        });
        ready = pick();
      }
      return { events: ready, seq };
    },

    stop(): void {
      stopChild();
      busyTurn = null;
      push({ type: "status", state: "stopped", detail: "세션을 닫았습니다" });
    },

    close(): void {
      stopChild();
      installer?.close();
      for (const [, pending] of pendingTools) clearTimeout(pending.timer);
      pendingTools.clear();
      mcpServer?.close();
      mcpServer = null;
      for (const wake of [...waiters]) wake();
    },
  };
}

export type AgentHost = ReturnType<typeof createAgentHost>;

export const AGENT_CHANNELS = {
  detect: "oprn:agent.detect",
  start: "oprn:agent.start",
  prompt: "oprn:agent.prompt",
  cancel: "oprn:agent.cancel",
  permission: "oprn:agent.permission",
  toolResult: "oprn:agent.toolResult",
  poll: "oprn:agent.poll",
  stop: "oprn:agent.stop",
  install: "oprn:agent.install",
  uninstall: "oprn:agent.uninstall",
  login: "oprn:agent.login",
  loginCode: "oprn:agent.loginCode",
  cancelLogin: "oprn:agent.cancelLogin",
} as const;

const AGENT_KINDS: ReadonlySet<string> = new Set(["claude", "codex", "opencode"]);

function agentKind(input: Record<string, unknown>): AgentKind {
  const kind = String(input.agent ?? "");
  if (!AGENT_KINDS.has(kind)) throw new Error("agent must be claude, codex or opencode");
  return kind as AgentKind;
}

function record(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
}

/** IPC·HTTP 두 전송로가 같은 검증으로 부르는 채널 본문. 모르는 채널이면 undefined. */
export async function dispatchAgentChannel(host: AgentHost, channel: string, payload: unknown): Promise<unknown> {
  const input = record(payload);
  switch (channel) {
    case AGENT_CHANNELS.detect: return { agents: await host.detect(), state: host.state(), canInstall: host.canInstall() };
    case AGENT_CHANNELS.install: return host.install(agentKind(input));
    case AGENT_CHANNELS.uninstall: host.uninstall(agentKind(input)); return { ok: true };
    case AGENT_CHANNELS.login: host.login(agentKind(input)); return { ok: true };
    case AGENT_CHANNELS.loginCode: {
      const code = typeof input.code === "string" ? input.code.trim() : "";
      if (!code || code.length > 4000) throw new Error("code is required");
      return { ok: host.loginCode(agentKind(input), code) };
    }
    case AGENT_CHANNELS.cancelLogin: host.cancelLogin(agentKind(input)); return { ok: true };
    case AGENT_CHANNELS.start: {
      const kind = String(input.agent ?? "");
      if (!AGENT_KINDS.has(kind)) throw new Error("agent must be claude, codex or opencode");
      return await host.start(kind as AgentKind);
    }
    case AGENT_CHANNELS.prompt: {
      const text = typeof input.text === "string" ? input.text.trim() : "";
      if (!text || text.length > 20_000) throw new Error("prompt text is required (max 20000 chars)");
      return host.prompt(text);
    }
    case AGENT_CHANNELS.cancel: host.cancel(); return { ok: true };
    case AGENT_CHANNELS.stop: host.stop(); return { ok: true };
    case AGENT_CHANNELS.permission: {
      const optionId = typeof input.optionId === "string" ? input.optionId : null;
      return { ok: host.answerPermission(String(input.requestId ?? ""), optionId) };
    }
    case AGENT_CHANNELS.toolResult: return { ok: host.answerTool(String(input.requestId ?? ""), input.result ?? null) };
    case AGENT_CHANNELS.poll: {
      const after = Number(input.after ?? 0);
      const waitMs = Number(input.waitMs ?? 25_000);
      return await host.poll(Number.isFinite(after) ? after : 0, Number.isFinite(waitMs) ? Math.max(0, waitMs) : 0);
    }
    default: return undefined;
  }
}

export function isAgentChannel(channel: string): boolean {
  return (Object.values(AGENT_CHANNELS) as string[]).includes(channel);
}
