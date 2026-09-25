/** Thrown-value dump for the assistant error drawer. No DOM, no log buffer. */

export type ThrownDiagnosticContext = {
  readonly at?: string;
  readonly request?: string;
  readonly stoppedReason?: string;
};

const MAX_STACK = 8_000;
const MAX_REQUEST = 4_000;
const MAX_CAUSES = 8;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…(${text.length - max}자 생략)`;
}

function extraFields(error: Error): readonly string[] {
  const row = error as unknown as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of ["status", "code", "errno"] as const) {
    const value = row[key];
    if (value === undefined || typeof value === "function") continue;
    lines.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
  return lines;
}

function describeOne(value: unknown, depth: number): string {
  if (!(value instanceof Error)) {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const lines = [`${value.name}: ${value.message}`];
  lines.push(...extraFields(value));
  if (value.stack) lines.push(clip(value.stack, MAX_STACK));
  const cause = (value as { cause?: unknown }).cause;
  if (cause !== undefined && depth < MAX_CAUSES) {
    lines.push("", `원인 ${depth + 1}:`, describeOne(cause, depth + 1));
  }
  return lines.join("\n");
}

/** Name, message, stack, cause chain, and the request that was in flight. */
export function formatThrownDiagnostic(cause: unknown, context: ThrownDiagnosticContext = {}): string {
  const lines = [`시각: ${context.at ?? new Date().toISOString()}`];
  if (context.stoppedReason) lines.push(`중단: ${context.stoppedReason}`);
  if (context.request && context.request.trim() !== "") {
    lines.push("요청:", clip(context.request, MAX_REQUEST));
  }
  lines.push("", "예외:", describeOne(cause, 0));
  return lines.join("\n");
}
