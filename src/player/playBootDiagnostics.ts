// 플레이 부트 진단 — 로컬 링버퍼 + Supabase(ai_activity_logs / 폴백).
// 테스트 플레이가 "준비 완료"에서 멈추거나 create 예외가 날 때 원격에서 단계를 본다.
import { recordAiActivity } from "@/ai/activityLog";
import { store } from "@/project/store";

export type PlayBootStage =
  | "engine"
  | "assets"
  | "map"
  | "ready"
  | "refresh"
  | "error"
  | "timeout";

export type PlayBootDiagnosticInput = {
  readonly stage: PlayBootStage;
  readonly ok: boolean;
  readonly mapId?: string;
  readonly eventTestId?: string;
  readonly elapsedMs?: number;
  readonly error?: unknown;
  readonly detail?: string;
};

export type PlayBootDiagnosticPayload = {
  readonly kind: "play-boot";
  readonly stage: PlayBootStage;
  readonly ok: boolean;
  readonly mapId?: string;
  readonly eventTestId?: string;
  readonly elapsedMs?: number;
  readonly detail?: string;
  readonly errorMessage?: string;
  readonly errorStack?: string;
  readonly userAgent?: string;
  readonly href?: string;
};

const RECENT: PlayBootDiagnosticPayload[] = [];
const MAX_RECENT = 40;

export function listRecentPlayBootDiagnostics(): readonly PlayBootDiagnosticPayload[] {
  return [...RECENT];
}

export function clearRecentPlayBootDiagnosticsForTest(): void {
  RECENT.length = 0;
}

export function buildPlayBootPayload(input: PlayBootDiagnosticInput): PlayBootDiagnosticPayload {
  const err = normalizeError(input.error);
  return {
    kind: "play-boot",
    stage: input.stage,
    ok: input.ok,
    ...(input.mapId ? { mapId: input.mapId } : {}),
    ...(input.eventTestId ? { eventTestId: input.eventTestId } : {}),
    ...(input.elapsedMs === undefined ? {} : { elapsedMs: Math.round(input.elapsedMs) }),
    ...(input.detail ? { detail: input.detail.slice(0, 500) } : {}),
    ...(err.message ? { errorMessage: err.message } : {}),
    ...(err.stack ? { errorStack: err.stack } : {}),
    ...(typeof navigator !== "undefined" ? { userAgent: navigator.userAgent.slice(0, 240) } : {}),
    ...(typeof location !== "undefined" ? { href: location.href.slice(0, 400) } : {}),
  };
}

/**
 * 플레이 부트 단계/실패를 AI activity 채널(other)로 남긴다.
 * - 로컬 localStorage 링버퍼
 * - Supabase 설정 시 원격 (ai_activity_logs / ai_analysis_runs 폴백)
 * - DEV 디스크 미러 (`/__rpgzzu/ai-activity`)
 * 실패해도 플레이 경로를 막지 않는다.
 */
export function recordPlayBootDiagnostic(input: PlayBootDiagnosticInput): void {
  const payload = buildPlayBootPayload(input);
  RECENT.unshift(payload);
  if (RECENT.length > MAX_RECENT) RECENT.length = MAX_RECENT;

  if (typeof window !== "undefined") {
    (window as Window & { __rpgzzuPlayBootLog?: () => readonly PlayBootDiagnosticPayload[] }).__rpgzzuPlayBootLog =
      listRecentPlayBootDiagnostics;
  }

  const project = (() => {
    try {
      return store.getCurrent();
    } catch {
      return null;
    }
  })();
  const mapId = input.mapId ?? project?.startMapId;
  const instruction = [
    "[play-boot]",
    `stage=${input.stage}`,
    input.ok ? "ok" : "fail",
    mapId ? `map=${mapId}` : null,
    input.detail ?? null,
    payload.errorMessage ? `err=${payload.errorMessage}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  void recordAiActivity({
    channel: "other",
    instruction,
    mapId,
    result: {
      ok: input.ok,
      ...(payload.errorMessage ? { error: payload.errorMessage } : {}),
      stoppedReason: input.stage,
      assistantText: JSON.stringify(payload).slice(0, 2000),
    },
    uiEvents: [payload],
  }).catch(() => {
    /* best-effort */
  });

  if (!input.ok) {
    console.error("[play-boot]", instruction, payload);
  } else {
    console.info("[play-boot]", instruction);
  }
}

function normalizeError(error: unknown): { message?: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message.slice(0, 1500),
      ...(error.stack ? { stack: error.stack.slice(0, 4000) } : {}),
    };
  }
  if (error === undefined || error === null) return {};
  return { message: String(error).slice(0, 1500) };
}
