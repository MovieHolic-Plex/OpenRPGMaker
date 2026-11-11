// editor/tools/eventRunLogTools.ts
// 조수가 테스트 플레이에서 실제로 실행된 이벤트 명령을 읽는 도구(ED5 #1). 기록은 테스트 플레이 씬이 설치한
// window.__oprnEventRunLog(src/player/eventRunLog.ts)에만 있다 — storyTools.liveDebugState 처럼 살아 있는 플레이 창을 읽는다.
// 테스트 플레이가 없으면 오류가 아니라 「기록 없음」을 그대로 돌려준다.

import type { EventRunLogQuery, EventRunLogWindowApi } from "@/player/eventRunLog";
import type { ToolDefinition, ToolExecResult } from "./types";

const ENTRY_TYPES = ["command", "runStart", "runEnd", "handEdit"] as const;
const SOURCES = ["foreground", "parallel", "commonParallel"] as const;

function liveRunLog(): EventRunLogWindowApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { __oprnEventRunLog?: EventRunLogWindowApi }).__oprnEventRunLog;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : undefined;
}

export function eventRunLogQueryFromArgs(args: Readonly<Record<string, unknown>>): EventRunLogQuery {
  const type = optionalString(args.type);
  const source = optionalString(args.source);
  const eventId = optionalString(args.eventId);
  const kind = optionalString(args.kind);
  const sinceSeq = optionalNumber(args.sinceSeq);
  const limit = optionalNumber(args.limit);
  return {
    ...(eventId ? { eventId } : {}),
    ...(kind ? { kind } : {}),
    ...(type && (ENTRY_TYPES as readonly string[]).includes(type) ? { type: type as EventRunLogQuery["type"] } : {}),
    ...(source && (SOURCES as readonly string[]).includes(source) ? { source: source as EventRunLogQuery["source"] } : {}),
    ...(sinceSeq !== undefined ? { sinceSeq } : {}),
    limit: Math.max(1, Math.min(limit ?? 100, 500)),
  };
}

const readEventRunLog: ToolDefinition = {
  name: "read_event_run_log",
  description: "열려 있는 테스트 플레이에서 실제로 실행된 이벤트 명령 기록을 읽는다(명령 종류·인자·스위치/변수 전후 값·조건 분기가 탄 쪽·이벤트 시작/끝·디버그 패널 손 편집). 이벤트를 만든 뒤 테스트 플레이로 의도한 명령과 분기가 돌았는지 확인할 때 쓴다. 테스트 플레이가 없으면 available=false.",
  mode: "read",
  domains: ["event", "quest", "system"],
  invalidArgsExample: { eventId: "ev_mayor", limit: 50 },
  parameters: {
    type: "object",
    properties: {
      eventId: { type: "string", description: "이 이벤트 id 의 항목만" },
      kind: { type: "string", description: "이 명령 종류(setSwitch, fork, text …)만" },
      type: { type: "string", enum: ENTRY_TYPES as unknown as string[] },
      source: { type: "string", enum: SOURCES as unknown as string[] },
      sinceSeq: { type: "integer", description: "이 번호 다음 항목부터(이전 호출의 lastSeq)" },
      limit: { type: "integer", minimum: 1, maximum: 500 },
    },
  },
  run(_project, args): ToolExecResult {
    const log = liveRunLog();
    if (!log) {
      return {
        summary: "테스트 플레이가 열려 있지 않아 실행 기록이 없습니다. 테스트 플레이를 연 뒤 다시 읽으세요.",
        data: { available: false, entries: [] },
      };
    }
    const result = log.query(eventRunLogQueryFromArgs(args));
    const step = log.stepState();
    const commands = result.entries.filter((entry) => entry.type === "command").length;
    return {
      summary: `실행 기록 ${result.entries.length}개(명령 ${commands}개), 마지막 번호 ${result.lastSeq}${result.dropped ? `, 오래된 ${result.dropped}개는 버려짐` : ""}.`,
      data: { available: true, ...result, step },
    };
  },
};

export const EVENT_RUN_LOG_TOOLS: readonly ToolDefinition[] = [readEventRunLog];
