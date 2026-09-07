// ai/runRecap.ts
//
// 한 사용자 목표(자율 런이면 드라이버 전체)가 끝났을 때 남기는 계량.
// 감사 로그·활동 로그에는 과정 전부, 채팅에는 토큰(+경과)만. 개선은 로그를 보고 한다.

import type { RunOutcome } from "./runOutcome";
import {
  formatTokenCount,
  type SessionUsageTotals,
} from "./sessionUsage";

/** assistantSession.AuditEntry 의 계량에 필요한 부분집합 — 세션 모듈을 끌어오지 않는다. */
export type RecapAuditEntry =
  | { readonly kind: "tool"; readonly name: string; readonly ok: boolean; readonly deferred?: boolean; readonly at?: string }
  | { readonly kind: "status"; readonly text: string; readonly at?: string }
  | { readonly kind: string; readonly at?: string };

export interface RunProcessStep {
  readonly kind: "planner" | "ralph" | "volume" | "tool" | "phase" | "rekick" | "continue" | "end" | "other";
  readonly at?: string;
  readonly text: string;
}

export interface RunRecap {
  readonly runOutcome?: RunOutcome;
  readonly elapsedMs: number;
  readonly usage: SessionUsageTotals;
  readonly toolCalls: number;
  readonly toolFailures: number;
  readonly deferredToolCalls?: number;
  readonly ralphContinues: number;
  readonly volumeContinues: number;
  readonly proposedWrites: number;
  readonly stoppedReason: string;
  readonly process: readonly RunProcessStep[];
}

export function usageDelta(before: SessionUsageTotals, after: SessionUsageTotals): SessionUsageTotals {
  const byModel = after.byModel
    .map((entry) => {
      const prev = before.byModel.find((model) => model.model === entry.model);
      return {
        model: entry.model,
        calls: Math.max(0, entry.calls - (prev?.calls ?? 0)),
        promptTokens: Math.max(0, entry.promptTokens - (prev?.promptTokens ?? 0)),
        completionTokens: Math.max(0, entry.completionTokens - (prev?.completionTokens ?? 0)),
        callsWithoutUsage: Math.max(0, entry.callsWithoutUsage - (prev?.callsWithoutUsage ?? 0)),
      };
    })
    .filter((entry) => entry.calls > 0 || entry.promptTokens > 0 || entry.completionTokens > 0);
  return {
    calls: Math.max(0, after.calls - before.calls),
    promptTokens: Math.max(0, after.promptTokens - before.promptTokens),
    completionTokens: Math.max(0, after.completionTokens - before.completionTokens),
    callsWithoutUsage: Math.max(0, after.callsWithoutUsage - before.callsWithoutUsage),
    byModel,
  };
}

export function formatElapsedMs(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}

export function classifyRunProcessText(text: string): RunProcessStep["kind"] {
  if (text.startsWith("planner:")) return "planner";
  if (text.startsWith("ralph:") || text.startsWith("Ralph ")) return "ralph";
  if (text.startsWith("volume-contract:") || text.startsWith("볼륨 계약")) return "volume";
  if (text.startsWith("zero-change-rekick") || text.startsWith("spec-npc-autobuild")) return "rekick";
  if (text.startsWith("agent_run:auto-continue") || text.startsWith("자율 실행 계속")) return "continue";
  if (text.startsWith("phase:")) return "phase";
  if (text.startsWith("턴 종료") || text.startsWith("턴 중단")) return "end";
  return "other";
}

const PROCESS_STATUS_RE =
  /^(?:planner:|ralph:|Ralph |volume-contract:|볼륨 계약|zero-change-rekick|spec-npc-autobuild|agent_run:auto-continue|자율 실행 계속|phase:|턴 종료|턴 중단|WorkPlan |완료 보류:)/u;

export function extractRunProcess(audit: readonly RecapAuditEntry[]): RunProcessStep[] {
  const steps: RunProcessStep[] = [];
  for (const entry of audit) {
    if (entry.kind === "tool") {
      const tool = entry as Extract<RecapAuditEntry, { kind: "tool" }>;
      const mark = tool.deferred ? "deferred" : tool.ok ? "ok" : "fail";
      const prev = steps[steps.length - 1];
      const compact = `${tool.name} ${mark}`;
      if (prev?.kind === "tool" && prev.text.startsWith(`${compact}`)) {
        const times = /×(\d+)$/u.exec(prev.text);
        const count = times ? Number(times[1]) + 1 : 2;
        steps[steps.length - 1] = { ...prev, text: `${compact} ×${count}` };
      } else {
        steps.push({ kind: "tool", at: tool.at, text: compact });
      }
      continue;
    }
    if (entry.kind !== "status") continue;
    const status = entry as Extract<RecapAuditEntry, { kind: "status" }>;
    if (status.text.startsWith("run-recap ")) continue;
    if (!PROCESS_STATUS_RE.test(status.text)) continue;
    steps.push({ kind: classifyRunProcessText(status.text), at: status.at, text: status.text.slice(0, 240) });
  }
  return steps.slice(0, 80);
}

export function buildRunRecap(input: {
  readonly elapsedMs: number;
  readonly usage: SessionUsageTotals;
  readonly audit: readonly RecapAuditEntry[];
  readonly stoppedReason: string;
  readonly proposedWrites: number;
  readonly runOutcome?: RunOutcome;
}): RunRecap {
  const process = extractRunProcess(input.audit);
  const tools = input.audit.filter((entry): entry is Extract<RecapAuditEntry, { kind: "tool" }> => entry.kind === "tool");
  const deferredToolCalls = tools.filter((entry) => entry.deferred).length;
  return {
    ...(input.runOutcome ? { runOutcome: input.runOutcome } : {}),
    elapsedMs: Math.max(0, Math.trunc(input.elapsedMs)),
    usage: input.usage,
    toolCalls: tools.length,
    toolFailures: tools.filter((entry) => !entry.ok && !entry.deferred).length,
    ...(deferredToolCalls > 0 ? { deferredToolCalls } : {}),
    ralphContinues: process.filter((step) => step.kind === "ralph" && /ralph:continue/u.test(step.text)).length,
    volumeContinues: process.filter((step) => step.kind === "volume" && /volume-contract:continue/u.test(step.text)).length,
    proposedWrites: input.proposedWrites,
    stoppedReason: input.stoppedReason,
    process,
  };
}

/** 채팅에 보이는 한 줄 — 토큰과 경과만. 과정은 로그에 둔다. */
export function formatRunRecapPlayerLine(recap: RunRecap): string {
  const time = formatElapsedMs(recap.elapsedMs);
  if (recap.usage.calls === 0) return `토큰 입력 0 · 출력 0 · ${time}`;
  if (recap.usage.callsWithoutUsage === recap.usage.calls && recap.usage.promptTokens === 0 && recap.usage.completionTokens === 0) {
    return `토큰 미보고 · LLM ${formatTokenCount(recap.usage.calls)}회 · ${time}`;
  }
  return `토큰 입력 ${formatTokenCount(recap.usage.promptTokens)} · 출력 ${formatTokenCount(recap.usage.completionTokens)} · ${time}`;
}

/** 감사/활동 로그용 — 파싱 가능한 한 줄 JSON. */
export function serializeRunRecap(recap: RunRecap): string {
  return JSON.stringify({
    ...(recap.runOutcome ? { runOutcome: recap.runOutcome } : {}),
    elapsedMs: recap.elapsedMs,
    prompt: recap.usage.promptTokens,
    completion: recap.usage.completionTokens,
    calls: recap.usage.calls,
    missingUsage: recap.usage.callsWithoutUsage,
    byModel: recap.usage.byModel.map((entry) => ({
      model: entry.model,
      calls: entry.calls,
      prompt: entry.promptTokens,
      completion: entry.completionTokens,
    })),
    tools: recap.toolCalls,
    toolFail: recap.toolFailures,
    ...(recap.deferredToolCalls ? { toolDeferred: recap.deferredToolCalls } : {}),
    ralph: recap.ralphContinues,
    volume: recap.volumeContinues,
    writes: recap.proposedWrites,
    stopped: recap.stoppedReason,
    // 감사 한 줄에는 kind 만 남긴다. 원문(`agent_run:auto-continue` 등)을 그대로 넣으면
    // 상태 문자열 카운트 테스트가 recap 한 줄 때문에 +1 된다. 원문은 활동 로그 recap.process.
    process: recap.process.map((step) => step.kind),
  });
}

export function parseRunRecapPayload(raw: string): RunRecap | null {
  const jsonText = raw.startsWith("run-recap ") ? raw.slice("run-recap ".length) : raw;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (!isRecord(parsed)) return null;
    const runOutcome = parseStoredRunOutcome(parsed.runOutcome);
    const elapsedMs = asInt(parsed.elapsedMs);
    const processRaw = Array.isArray(parsed.process) ? parsed.process : [];
    const processKinds = new Set<RunProcessStep["kind"]>([
      "planner", "ralph", "volume", "tool", "phase", "rekick", "continue", "end", "other",
    ]);
    const process = processRaw
      .filter((step): step is string => typeof step === "string")
      .map((text) => ({
        kind: processKinds.has(text as RunProcessStep["kind"])
          ? (text as RunProcessStep["kind"])
          : classifyRunProcessText(text),
        text,
      }));
    const byModelRaw = Array.isArray(parsed.byModel) ? parsed.byModel : [];
    return {
      ...(runOutcome ? { runOutcome } : {}),
      elapsedMs,
      usage: {
        calls: asInt(parsed.calls),
        promptTokens: asInt(parsed.prompt),
        completionTokens: asInt(parsed.completion),
        callsWithoutUsage: asInt(parsed.missingUsage),
        byModel: byModelRaw.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.model !== "string") return [];
          return [{
            model: entry.model,
            calls: asInt(entry.calls),
            promptTokens: asInt(entry.prompt),
            completionTokens: asInt(entry.completion),
            callsWithoutUsage: 0,
          }];
        }),
      },
      toolCalls: asInt(parsed.tools),
      toolFailures: asInt(parsed.toolFail),
      ...(asInt(parsed.toolDeferred) > 0 ? { deferredToolCalls: asInt(parsed.toolDeferred) } : {}),
      ralphContinues: asInt(parsed.ralph),
      volumeContinues: asInt(parsed.volume),
      proposedWrites: asInt(parsed.writes),
      stoppedReason: typeof parsed.stopped === "string" ? parsed.stopped : "final",
      process,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStoredRunOutcome(value: unknown): RunOutcome | null {
  if (!isRecord(value)) return null;
  const { execution, goal, delivery } = value;
  if (execution !== "response-final" && execution !== "awaiting-user" && execution !== "blocked"
    && execution !== "cancelled" && execution !== "budget-exhausted" && execution !== "failed") return null;
  if (goal !== "unassessed" && goal !== "incomplete" && goal !== "satisfied") return null;
  if (delivery !== "no-change" && delivery !== "draft" && delivery !== "applied"
    && delivery !== "persisted" && delivery !== "persisted-verified") return null;
  return Object.freeze({ execution, goal, delivery });
}

function asInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
