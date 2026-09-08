import { diagnosticObserved, diagnosticToken, publishDiagnostic } from "@/util/diagnosticObserver";

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

export type PlayBootDiagnosticSink = (
  payload: PlayBootDiagnosticPayload,
) => void | Promise<void>;

const MAX_RECENT = 40;
const RECENT: PlayBootDiagnosticPayload[] = [];

export function listRecentPlayBootDiagnostics(): readonly PlayBootDiagnosticPayload[] {
  return [...RECENT];
}

export function clearRecentPlayBootDiagnosticsForTest(): void {
  RECENT.length = 0;
}

export function buildPlayBootPayload(input: PlayBootDiagnosticInput): PlayBootDiagnosticPayload {
  const error = normalizeError(input.error);
  return {
    kind: "play-boot",
    stage: input.stage,
    ok: input.ok,
    ...(input.mapId ? { mapId: input.mapId } : {}),
    ...(input.eventTestId ? { eventTestId: input.eventTestId } : {}),
    ...(input.elapsedMs === undefined ? {} : { elapsedMs: Math.round(input.elapsedMs) }),
    ...(input.detail ? { detail: input.detail.slice(0, 500) } : {}),
    ...(error.message ? { errorMessage: error.message } : {}),
    ...(error.stack ? { errorStack: error.stack } : {}),
    ...(typeof navigator === "undefined" ? {} : { userAgent: navigator.userAgent.slice(0, 240) }),
    ...(typeof location === "undefined" ? {} : { href: location.href.slice(0, 400) }),
  };
}

export function formatPlayBootDiagnosticInstruction(payload: PlayBootDiagnosticPayload): string {
  const segments = [
    "[play-boot]",
    `stage=${payload.stage}`,
    payload.ok ? "ok" : "fail",
    payload.mapId ? `map=${payload.mapId}` : undefined,
    payload.detail,
    payload.errorMessage ? `err=${payload.errorMessage}` : undefined,
  ];
  return segments.filter((segment): segment is string => segment !== undefined).join(" ");
}

/** Raw logs/sinks are independent of consent; local receipts require the initiating owner's token. */
export function recordPlayBootDiagnostic(
  input: PlayBootDiagnosticInput,
  sink?: PlayBootDiagnosticSink,
  diagnosticOwner?: symbol,
): void {
  const payload = buildPlayBootPayload(input);
  if (diagnosticOwner && diagnosticOwner === diagnosticToken() && diagnosticObserved("asset")
    && ["assets", "ready", "error", "timeout"].includes(payload.stage)) {
    publishDiagnostic({ category: "asset", phase: payload.stage, ok: payload.ok });
  }
  RECENT.unshift(payload);
  if (RECENT.length > MAX_RECENT) RECENT.length = MAX_RECENT;

  if (typeof window !== "undefined") {
    Reflect.set(window, "__oprnPlayBootLog", listRecentPlayBootDiagnostics);
  }

  const instruction = formatPlayBootDiagnosticInstruction(payload);
  if (payload.ok) console.info("[play-boot]", instruction);
  else console.error("[play-boot]", instruction, payload);

  if (sink) {
    void Promise.resolve()
      .then(() => sink(payload))
      .catch(() => console.warn("[play-boot] diagnostic sink failed"));
  }
}

function normalizeError(error: unknown): { readonly message?: string; readonly stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message.slice(0, 1500),
      ...(error.stack ? { stack: error.stack.slice(0, 4000) } : {}),
    };
  }
  if (error === undefined || error === null) return {};
  return { message: String(error).slice(0, 1500) };
}
