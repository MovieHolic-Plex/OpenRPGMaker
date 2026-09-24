/**
 * 조수가 실제로 부른 도구를 한 표로 모은다.
 *
 * 실행 영수증(activity trace)은 호출마다 시각·성공·걸린 시간을 갖고, 대화 기록과 활동 로그는
 * 영수증이 없는 호출을 메운다. 같은 호출이 두 곳에 있으면 시각·이름·요약이 가까운 쪽을 한 번만 센다.
 */

export type ToolUsageSource = "trace" | "conversation" | "activity";

export interface ToolUsageObservation {
  readonly name: string;
  readonly at: string;
  readonly ok: boolean | null;
  readonly summary: string;
  readonly durationMs?: number;
  readonly query?: string;
  readonly source: ToolUsageSource;
}

export interface ToolUsageToolRow {
  readonly name: string;
  readonly calls: number;
  readonly ok: number;
  readonly failed: number;
  readonly unknown: number;
  readonly totalDurationMs: number;
  readonly avgDurationMs: number | null;
  readonly lastUsedAt: string | null;
  readonly recentQueries: readonly string[];
}

export interface ToolUsageCallRow {
  readonly at: string;
  readonly name: string;
  readonly ok: boolean | null;
  readonly summary: string;
  readonly durationMs?: number;
  readonly query?: string;
  readonly source: ToolUsageSource;
}

export interface ToolUsageReport {
  readonly version: 1;
  readonly exportedAt: string;
  readonly projectId: string;
  readonly sources: {
    readonly traces: number;
    readonly conversations: number;
    readonly activityLogs: number;
    readonly droppedDuplicates: number;
  };
  readonly totals: {
    readonly calls: number;
    readonly tools: number;
    readonly failed: number;
  };
  readonly tools: readonly ToolUsageToolRow[];
  readonly recent: readonly ToolUsageCallRow[];
}

const RECENT_LIMIT = 40;
const QUERY_LIMIT = 8;
const DEDUP_WINDOW_MS = 5000;

export function buildToolUsageReport(input: {
  readonly observations: readonly ToolUsageObservation[];
  readonly projectId?: string;
  readonly exportedAt?: string;
  readonly sourceCounts?: { readonly traces?: number; readonly conversations?: number; readonly activityLogs?: number };
}): ToolUsageReport {
  const ranked = [...input.observations].sort((a, b) => sourceRank(a.source) - sourceRank(b.source) || a.at.localeCompare(b.at));
  const kept: ToolUsageObservation[] = [];
  let dropped = 0;
  for (const observation of ranked) {
    if (!observation.name.trim()) continue;
    const at = Date.parse(observation.at);
    const duplicate = kept.find((existing) => {
      if (existing.name !== observation.name) return false;
      const existingAt = Date.parse(existing.at);
      if (Number.isFinite(at) && Number.isFinite(existingAt) && Math.abs(at - existingAt) > DEDUP_WINDOW_MS) return false;
      if (!Number.isFinite(at) || !Number.isFinite(existingAt)) {
        return summaryKey(existing.summary) === summaryKey(observation.summary);
      }
      return summaryKey(existing.summary) === summaryKey(observation.summary) || existing.summary === "" || observation.summary === "";
    });
    if (duplicate) {
      dropped += 1;
      continue;
    }
    kept.push(observation);
  }
  kept.sort((a, b) => b.at.localeCompare(a.at));

  const byName = new Map<string, ToolUsageObservation[]>();
  for (const observation of kept) {
    const list = byName.get(observation.name) ?? [];
    list.push(observation);
    byName.set(observation.name, list);
  }
  const tools = [...byName.entries()].map(([name, calls]) => {
    const timed = calls.filter((call) => typeof call.durationMs === "number");
    const totalDurationMs = timed.reduce((sum, call) => sum + (call.durationMs ?? 0), 0);
    const queries: string[] = [];
    for (const call of calls) {
      if (!call.query || queries.includes(call.query)) continue;
      queries.push(call.query);
      if (queries.length >= QUERY_LIMIT) break;
    }
    return {
      name,
      calls: calls.length,
      ok: calls.filter((call) => call.ok === true).length,
      failed: calls.filter((call) => call.ok === false).length,
      unknown: calls.filter((call) => call.ok === null).length,
      totalDurationMs,
      avgDurationMs: timed.length > 0 ? Math.round(totalDurationMs / timed.length) : null,
      lastUsedAt: calls.map((call) => call.at).sort().at(-1) ?? null,
      recentQueries: queries,
    };
  }).sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));

  return {
    version: 1,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    projectId: input.projectId ?? "",
    sources: {
      traces: input.sourceCounts?.traces ?? input.observations.filter((item) => item.source === "trace").length,
      conversations: input.sourceCounts?.conversations ?? input.observations.filter((item) => item.source === "conversation").length,
      activityLogs: input.sourceCounts?.activityLogs ?? input.observations.filter((item) => item.source === "activity").length,
      droppedDuplicates: dropped,
    },
    totals: {
      calls: kept.length,
      tools: tools.length,
      failed: kept.filter((call) => call.ok === false).length,
    },
    tools,
    recent: kept.slice(0, RECENT_LIMIT).map((call) => ({
      at: call.at,
      name: call.name,
      ok: call.ok,
      summary: call.summary,
      ...(call.durationMs !== undefined ? { durationMs: call.durationMs } : {}),
      ...(call.query ? { query: call.query } : {}),
      source: call.source,
    })),
  };
}

export function toolUsageReportJson(report: ToolUsageReport): string {
  return JSON.stringify(report, null, 2);
}

function sourceRank(source: ToolUsageSource): number {
  if (source === "trace") return 0;
  if (source === "conversation") return 1;
  return 2;
}

function summaryKey(summary: string): string {
  return summary.replace(/\s+/gu, " ").trim().slice(0, 80);
}

export function queryFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const query = (args as { query?: unknown }).query;
  return typeof query === "string" && query.trim() ? query.trim() : undefined;
}
