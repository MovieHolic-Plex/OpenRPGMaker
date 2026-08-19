// editor/aiAssistantBridge.ts
// 에디터 AI 채팅과 외부 MCP/에이전트를 같은 세션으로 잇는 브리지.
// - 패널이 register 하면 window.__rpgzzuAiBridge 와 로컬 HTTP 브리지(127.0.0.1)에 연결
// - MCP(scripts/rpgzzu-assistant-mcp.mjs)가 send/status/audit/harness 를 호출하면
//   브라우저에서 실제 채팅 패널이 돌고, 사용자는 UI를 그대로 본다.

export const AI_ASSISTANT_BRIDGE_DEFAULT_PORT = 17831;
export const AI_ASSISTANT_BRIDGE_DEFAULT_HOST = "127.0.0.1";

export type AiBridgeStatus = {
  readonly ready: boolean;
  readonly turnBusy: boolean;
  readonly configReady: boolean;
  readonly lastStatus: string;
  readonly bridgeConnected: boolean;
  readonly panelMounted: boolean;
};

export type AiBridgeAuditEntry = {
  readonly kind: string;
  readonly text?: string;
  readonly name?: string;
  readonly summary?: string;
  readonly at?: string;
};

export type AiBridgeTurnResult = {
  readonly ok: boolean;
  readonly error?: string;
  readonly status: AiBridgeStatus;
  readonly audit: readonly AiBridgeAuditEntry[];
  readonly harness: unknown;
  readonly lastAssistantText?: string;
};

export type AiAssistantBridgeHandlers = {
  readonly send: (text: string) => Promise<AiBridgeTurnResult>;
  readonly getStatus: () => AiBridgeStatus;
  readonly getAudit: () => readonly AiBridgeAuditEntry[];
  readonly getHarness: () => unknown;
  readonly abort: () => void;
  /** 채팅 패널이 접혀 있으면 펼친다(도크 열기). 선택 — 구 등록부 호환. */
  readonly openPanel?: () => void;
};

type BridgeCommand =
  | { readonly id: string; readonly type: "send"; readonly text: string }
  | { readonly id: string; readonly type: "status" }
  | { readonly id: string; readonly type: "audit" }
  | { readonly id: string; readonly type: "harness" }
  | { readonly id: string; readonly type: "abort" };

let handlers: AiAssistantBridgeHandlers | null = null;
let pollTimer: number | null = null;
let pollAbort: AbortController | null = null;
let bridgeConnected = false;
let lastStatusText = "대기";

export function setAiBridgeLastStatus(text: string): void {
  lastStatusText = text;
}

export function getAiBridgeLastStatus(): string {
  return lastStatusText;
}

export function isAiAssistantBridgeConnected(): boolean {
  return bridgeConnected;
}

export function registerAiAssistantBridge(next: AiAssistantBridgeHandlers): void {
  handlers = next;
  if (typeof window !== "undefined") {
    window.__rpgzzuAiBridge = {
      send: (text: string) => runSend(text),
      status: () => getStatusSnapshot(),
      audit: () => handlers?.getAudit() ?? [],
      harness: () => handlers?.getHarness() ?? null,
      abort: () => handlers?.abort(),
      connected: () => bridgeConnected,
    };
  }
  startBridgeClientIfEnabled();
}

export function unregisterAiAssistantBridge(): void {
  handlers = null;
  stopBridgeClient();
  if (typeof window !== "undefined") {
    delete window.__rpgzzuAiBridge;
  }
}

// DB 모달 등 에디터 내부 진입점이 같은 채팅 세션으로 메시지를 보낼 때 쓰는 공개 API.
// 패널이 아직 마운트되지 않았으면 ok:false 결과를 돌려준다(throw 하지 않는다).
export function sendAiAssistantMessage(text: string): Promise<AiBridgeTurnResult> {
  return runSend(text);
}

// 접혀 있는 채팅 패널(도크)을 펼친다. 패널 미마운트/미지원이면 false.
export function openAiAssistantPanel(): boolean {
  if (!handlers?.openPanel) return false;
  handlers.openPanel();
  return true;
}

function getStatusSnapshot(): AiBridgeStatus {
  if (!handlers) {
    return {
      ready: false,
      turnBusy: false,
      configReady: false,
      lastStatus: lastStatusText,
      bridgeConnected,
      panelMounted: false,
    };
  }
  const base = handlers.getStatus();
  return {
    ...base,
    bridgeConnected,
    panelMounted: true,
    // 패널 setStatus 가 setAiBridgeLastStatus 를 호출하면 그 값을 우선한다.
    lastStatus: lastStatusText || base.lastStatus,
  };
}

async function runSend(text: string): Promise<AiBridgeTurnResult> {
  if (!handlers) {
    return {
      ok: false,
      error: "AI 패널이 아직 마운트되지 않았습니다.",
      status: getStatusSnapshot(),
      audit: [],
      harness: null,
    };
  }
  return handlers.send(text);
}

function bridgeBaseUrl(): string {
  let port = AI_ASSISTANT_BRIDGE_DEFAULT_PORT;
  if (typeof window !== "undefined") {
    try {
      const search = typeof window.location?.search === "string" ? window.location.search : "";
      port = Number(new URLSearchParams(search).get("aiBridgePort") || AI_ASSISTANT_BRIDGE_DEFAULT_PORT);
    } catch {
      port = AI_ASSISTANT_BRIDGE_DEFAULT_PORT;
    }
  }
  return `http://${AI_ASSISTANT_BRIDGE_DEFAULT_HOST}:${Number.isFinite(port) && port > 0 ? port : AI_ASSISTANT_BRIDGE_DEFAULT_PORT}`;
}

function shouldEnableBridgeClient(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const search = typeof window.location?.search === "string" ? window.location.search : "";
    const params = new URLSearchParams(search);
    if (params.get("aiBridge") === "0") return false;
    if (params.get("aiBridge") === "1") return true;
    // 개발 서버에서는 기본 연결 시도(브리지 서버가 없으면 조용히 재시도)
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function startBridgeClientIfEnabled(): void {
  if (!shouldEnableBridgeClient()) return;
  if (pollTimer !== null) return;
  void pollLoop();
}

function stopBridgeClient(): void {
  pollAbort?.abort();
  pollAbort = null;
  if (pollTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(pollTimer);
    pollTimer = null;
  }
  bridgeConnected = false;
}

// 브리지 서버가 없는 개발 부팅에서 1.5~2초 재시도가 콘솔을 ERR_CONNECTION_REFUSED로
// 도배했다(2026-08-18 UX 리뷰 P2-10). 연속 실패 시 지수 백오프(최대 60초)하고,
// 한 번이라도 연결되면 빠른 재시도로 복귀한다.
let consecutivePollFailures = 0;

function pollRetryDelayMs(base: number): number {
  return Math.min(base * 2 ** Math.min(consecutivePollFailures, 5), 60000);
}

async function pollLoop(): Promise<void> {
  if (typeof window === "undefined") return;
  pollAbort?.abort();
  pollAbort = new AbortController();
  const signal = pollAbort.signal;
  const base = bridgeBaseUrl();

  const schedule = (ms: number): void => {
    if (typeof window === "undefined") return;
    pollTimer = window.setTimeout(() => {
      void pollLoop();
    }, ms);
  };

  try {
    await fetch(`${base}/v1/browser/hello`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "editor", at: new Date().toISOString() }),
      signal,
    });
    bridgeConnected = true;

    const res = await fetch(`${base}/v1/browser/next?waitMs=25000`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) {
      bridgeConnected = false;
      consecutivePollFailures += 1;
      schedule(pollRetryDelayMs(1500));
      return;
    }
    consecutivePollFailures = 0;
    const payload = (await res.json()) as { command?: BridgeCommand | null };
    const command = payload.command;
    if (!command) {
      schedule(50);
      return;
    }
    const result = await executeBridgeCommand(command);
    await fetch(`${base}/v1/browser/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: command.id, result }),
      signal,
    });
    schedule(20);
  } catch {
    bridgeConnected = false;
    consecutivePollFailures += 1;
    schedule(pollRetryDelayMs(2000));
  }
}

async function executeBridgeCommand(command: BridgeCommand): Promise<unknown> {
  if (!handlers) {
    return { ok: false, error: "AI 패널 미연결", status: getStatusSnapshot() };
  }
  switch (command.type) {
    case "send":
      return runSend(command.text);
    case "status":
      return getStatusSnapshot();
    case "audit":
      return { ok: true, audit: handlers.getAudit(), status: getStatusSnapshot() };
    case "harness":
      return { ok: true, harness: handlers.getHarness(), status: getStatusSnapshot() };
    case "abort":
      handlers.abort();
      return { ok: true, status: getStatusSnapshot() };
    default:
      return { ok: false, error: "unknown command" };
  }
}

