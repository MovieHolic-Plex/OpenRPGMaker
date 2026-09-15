// editor/aiAssistantBridge.ts
// 에디터 AI 채팅과 외부 MCP/에이전트를 같은 세션으로 잇는 브리지.
// - 패널이 register 하면 window.__oprnAiBridge 와 로컬 HTTP 브리지(127.0.0.1)에 연결
// - MCP(scripts/oprn-assistant-mcp.mjs)가 send/status/audit/harness 를 호출하면
//   브라우저에서 실제 채팅 패널이 돌고, 사용자는 UI를 그대로 본다.

import type { RunOutcome } from "@/ai/runOutcome";
import type { RequirementWithdrawalAction } from "@/ai/assistantAcceptance";
import { RunOperation } from "@/ai/runOperation";
import type { Project } from "@/project/types";
import { createPendingWorkTracker } from "@/util/pendingWork";

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
  /** 툴 항목 전용 — 읽기 툴(find_tools·tile_query…)은 「바꾼 것」이 아니다. 패널이 레지스트리로 채운다. */
  readonly mode?: "read" | "write";
  /** 툴 항목 전용 — 실패한 호출은 바꾼 것으로 세지 않는다. */
  readonly ok?: boolean;
};

/**
 * 적용을 미룬 턴이 남긴 초안. 표면이 검토 화면을 그리고 `applyAiAssistantProposal` 로 커밋하거나
 * `discardAiAssistantProposal` 로 버린다. `before`/`after` 는 그 표면이 diff 를 계산하는 재료다.
 */
export type AiBridgePendingProposal = {
  readonly callCount: number;
  readonly summary: string;
  readonly before: Project;
  readonly after: Project;
};

export type AiBridgeSendOptions = {
  /**
   * 턴이 끝나도 초안을 스토어에 적용하지 않는다 — 결과의 `pendingProposal` 로 넘긴다.
   * 검토 게이트를 가진 표면(DB 검토 오버레이)만 쓴다. MCP·외부 전송은 종전대로 즉시 적용이다.
   */
  readonly deferApply?: boolean;
};

export type AiBridgeTurnResult = {
  readonly runOutcome?: RunOutcome | null;
  readonly ok: boolean;
  readonly error?: string;
  readonly pendingProposal?: AiBridgePendingProposal | null;
  readonly status: AiBridgeStatus;
  readonly audit: readonly AiBridgeAuditEntry[];
  readonly harness: unknown;
  readonly lastAssistantText?: string;
};

export type AiAssistantBridgeHandlers = {
  readonly send: (text: string, options?: AiBridgeSendOptions) => Promise<AiBridgeTurnResult>;
  /** 미뤄 둔 초안을 커밋한다. 성공하면 null, 실패하면 사유 한 줄. */
  readonly applyPendingProposal?: () => Promise<string | null>;
  /** 미뤄 둔 초안을 버리고 세션 기준을 스토어 최신으로 맞춘다. */
  readonly discardPendingProposal?: () => void;
  readonly getPendingProposal?: () => AiBridgePendingProposal | null;
  readonly getStatus: () => AiBridgeStatus;
  readonly getAudit: () => readonly AiBridgeAuditEntry[];
  readonly getHarness: () => unknown;
  readonly abort: () => void;
  /** 채팅 패널이 접혀 있으면 펼친다(도크 열기). 선택 — 구 등록부 호환. */
  readonly openPanel?: () => void;
  /** Local user action only; not a transport command or MCP/LLM tool. */
  readonly withdrawRequirement?: (action: RequirementWithdrawalAction) => boolean;
};

type BridgeCommand =
  | { readonly id: string; readonly type: "send"; readonly text: string }
  | { readonly id: string; readonly type: "status" }
  | { readonly id: string; readonly type: "audit" }
  | { readonly id: string; readonly type: "harness" }
  | { readonly id: string; readonly type: "abort" };

let handlers: AiAssistantBridgeHandlers | null = null;
let registration = new RunOperation();
const commandResults = new Map<string, Promise<unknown>>();
const pendingPolls = createPendingWorkTracker();

/** Teardown observers await actual owned transport completion, never timer guesses. */
export function whenAiAssistantBridgeSettled(): Promise<void> { return pendingPolls.settled(); }
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
  registration.retire();
  stopBridgeClient();
  registration = new RunOperation();
  const owner = registration;
  commandResults.clear();
  handlers = next;
  if (typeof window !== "undefined") {
    window.__oprnAiBridge = {
      send: (text: string) => runSend(text, owner),
      status: () => getStatusSnapshot(),
      audit: () => handlers?.getAudit() ?? [],
      harness: () => handlers?.getHarness() ?? null,
      abort: () => { if (registration === owner) next.abort(); },
      connected: () => bridgeConnected,
    };
  }
  startBridgeClientIfEnabled();
}

export function unregisterAiAssistantBridge(): void {
  registration.retire();
  commandResults.clear();
  handlers = null;
  stopBridgeClient();
  if (typeof window !== "undefined") {
    delete window.__oprnAiBridge;
  }
}

// DB 모달 등 에디터 내부 진입점이 같은 채팅 세션으로 메시지를 보낼 때 쓰는 공개 API.
// 패널이 아직 마운트되지 않았으면 ok:false 결과를 돌려준다(throw 하지 않는다).
export function sendAiAssistantMessage(text: string, options?: AiBridgeSendOptions): Promise<AiBridgeTurnResult> {
  return runSend(text, registration, options);
}

/**
 * `deferApply` 턴이 남긴 초안을 적용한다. 반환값은 실패 사유(성공은 null) —
 * 커밋 게이트 반려·기준 프로젝트 변경(stale-base)이 여기로 온다.
 */
export async function applyAiAssistantProposal(): Promise<string | null> {
  if (!handlers?.applyPendingProposal) return "AI 패널이 아직 마운트되지 않았습니다.";
  return await handlers.applyPendingProposal();
}

export function discardAiAssistantProposal(): void {
  handlers?.discardPendingProposal?.();
}

export function getAiAssistantPendingProposal(): AiBridgePendingProposal | null {
  return handlers?.getPendingProposal?.() ?? null;
}

// 접혀 있는 채팅 패널(도크)을 펼친다. 패널 미마운트/미지원이면 false.
export function openAiAssistantPanel(): boolean {
  if (!handlers?.openPanel) return false;
  handlers.openPanel();
  return true;
}

// DB 모달 AI 바처럼 채팅 패널 **밖**에서 진행 중인 턴을 그리는 표면용 읽기 API.
// 브리지 명령(status/audit)과 같은 스냅샷을 돌려준다 — 폴링해서 도구 결과·답변을 제자리에 보인다.
export function getAiAssistantStatus(): AiBridgeStatus {
  return getStatusSnapshot();
}

export function getAiAssistantAudit(): readonly AiBridgeAuditEntry[] {
  return handlers?.getAudit() ?? [];
}

/** 진행 중인 턴을 중단한다. 패널 미마운트면 아무 일도 하지 않는다. */
export function abortAiAssistantTurn(): void {
  handlers?.abort();
}

/** Invoke only from an explicit scoped user action. Never dispatch model output here. */
export function withdrawAiRequirement(action: RequirementWithdrawalAction): boolean {
  return handlers?.withdrawRequirement?.(action) ?? false;
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

async function runSend(text: string, owner = registration, options?: AiBridgeSendOptions): Promise<AiBridgeTurnResult> {
  const retiredStatus = getStatusSnapshot();
  const retired = (): AiBridgeTurnResult => ({ ok: false, error: "AI bridge owner retired",
    status: { ...retiredStatus, ready: false, turnBusy: false, panelMounted: false }, audit: [], harness: null });
  if (owner !== registration || owner.signal.aborted) return retired();
  if (!handlers) {
    return {
      ok: false,
      error: "AI 패널이 아직 마운트되지 않았습니다.",
      status: getStatusSnapshot(),
      audit: [],
      harness: null,
    };
  }
  try { return await owner.wait(handlers.send(text, options)); }
  catch (cause) { if (owner.signal.aborted) return retired(); throw cause; }
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
  if (pollTimer !== null || (pollAbort && !pollAbort.signal.aborted)) return;
  void pendingPolls.track(pollLoop());
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
    if (typeof window === "undefined" || signal.aborted) return;
    pollTimer = window.setTimeout(() => {
      pollTimer = null;
      void pendingPolls.track(pollLoop());
    }, ms);
  };

  try {
    await fetch(`${base}/v1/browser/hello`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "editor", at: new Date().toISOString() }),
      signal,
    });
    if (signal.aborted) return;
    bridgeConnected = true;

    const res = await fetch(`${base}/v1/browser/next?waitMs=25000`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    if (signal.aborted) return;
    if (!res.ok) {
      bridgeConnected = false;
      consecutivePollFailures += 1;
      schedule(pollRetryDelayMs(1500));
      return;
    }
    consecutivePollFailures = 0;
    const payload = (await res.json()) as { command?: BridgeCommand | null };
    if (signal.aborted) return;
    const command = payload.command;
    if (!command) {
      schedule(50);
      return;
    }
    let pending = commandResults.get(command.id);
    if (!pending) {
      pending = executeBridgeCommand(command);
      commandResults.set(command.id, pending);
    }
    const result = await pending;
    if (signal.aborted) return;
    await fetch(`${base}/v1/browser/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: command.id, result }),
      signal,
    });
    schedule(20);
  } catch {
    if (signal.aborted) return;
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
