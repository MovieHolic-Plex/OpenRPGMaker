// Pi 실행 녹화 — 툴 호출마다 한 줄(tools.jsonl)과 에이전트 이벤트 스트림(events.ndjson).
//
// 툴 인자는 코어의 `tool_start` 이벤트(모델이 보낸 그대로), 결과는 런타임의 `onToolCall`(레지스트리 결과 원본)에서 온다.
// `tool_end` 의 결과는 활동 로그용으로 잘려 있어 재생·비교의 기준으로 쓰지 않는다.
// 재생(replay.mts)은 이 파일의 순서·인자로 현재 툴 코드를 다시 돌린다.

import fs from "node:fs";
import path from "node:path";
import type { PiToolCallRecord } from "../../../src/ai/piAgent/toolAdapter.ts";
import type { PiAgentEvent } from "../../../src/ai/piAgent/protocol.ts";

export interface RecordedToolCall {
  /** 전체 실행에서의 시작 순서(0부터). 쓰기 툴은 코어가 배타 실행하므로 이 순서가 적용 순서다. */
  readonly order: number;
  /** 어느 에이전트 실행인가 — plan(읽기 전용 계획 턴) · build(실행 턴) · repair … */
  readonly phase: string;
  readonly toolCallId: string;
  readonly name: string;
  readonly args: unknown;
  readonly ok: boolean;
  readonly summary: string;
  /** 레지스트리 툴이 돌았는가(false 면 인자 검증·미노출·코어 밖 툴). */
  readonly registry: boolean;
  readonly warnings: readonly string[];
  readonly issues: readonly unknown[];
  readonly diff?: unknown;
  /** 읽기 툴 데이터(길면 잘림). */
  readonly data?: unknown;
  readonly startedAt: number;
  readonly durationMs?: number;
  /** 코어가 본 결과(tool_end) — 게이트가 발행을 거절하면 registry ok 와 다를 수 있다. */
  readonly coreOk: boolean;
  readonly coreSummary: string;
}

const DATA_LIMIT = 6_000;

function clip(value: unknown): unknown {
  if (value === undefined) return undefined;
  const text = JSON.stringify(value);
  if (text === undefined) return undefined;
  return text.length > DATA_LIMIT ? { truncated: true, chars: text.length, head: text.slice(0, DATA_LIMIT) } : value;
}

export function resultWarnings(result: { warnings?: unknown; diff?: unknown } | undefined): string[] {
  const own = Array.isArray(result?.warnings) ? result!.warnings as unknown[] : [];
  const diff = result?.diff && typeof result.diff === "object" ? (result.diff as { warnings?: unknown }).warnings : undefined;
  return [...own, ...(Array.isArray(diff) ? diff : [])].map((warning) => String(warning));
}

/** 이벤트 스트림에서 빼는 무거운 것 — 결과 프로젝트·프롬프트 스냅숏. */
function slimEvent(event: PiAgentEvent): unknown {
  if (event.type === "done") {
    const { project: _project, ...rest } = event as PiAgentEvent & { project?: unknown };
    return rest;
  }
  if (event.type === "prompt_inspection") return { type: event.type, at: (event as { at?: number }).at };
  if (event.type === "map_delta") return { type: event.type, maps: (event as { maps?: { mapId?: string }[] }).maps?.map((m) => m.mapId) };
  if (event.type === "checkpoint") {
    const { project: _project, spatialProof: _proof, ...rest } = event as PiAgentEvent & { project?: unknown; spatialProof?: unknown };
    return rest;
  }
  if (event.type === "agent_event") return { ...event, event: slimEvent((event as { event: PiAgentEvent }).event) };
  return event;
}

export interface PiRunRecorder {
  /** 이 실행(단계)의 onEvent / onToolCall. */
  phase(label: string): { onEvent: (event: PiAgentEvent) => void; onToolCall: (record: PiToolCallRecord) => void };
  readonly calls: readonly RecordedToolCall[];
  close(): void;
}

export function createPiRunRecorder(dir: string): PiRunRecorder {
  fs.mkdirSync(dir, { recursive: true });
  const toolsFile = fs.openSync(path.join(dir, "tools.jsonl"), "w");
  const eventsFile = fs.openSync(path.join(dir, "events.ndjson"), "w");
  const calls: RecordedToolCall[] = [];
  let order = 0;
  return {
    calls,
    phase(label) {
      const started = new Map<string, { order: number; name: string; args: unknown; at: number }>();
      const records = new Map<string, PiToolCallRecord>();
      const onEvent = (event: PiAgentEvent): void => {
        fs.writeSync(eventsFile, `${JSON.stringify({ phase: label, at: Date.now(), event: slimEvent(event) })}\n`);
        if (event.type === "tool_start") {
          started.set(event.id, { order: order++, name: event.name, args: event.args, at: Date.now() });
          return;
        }
        if (event.type !== "tool_end") return;
        const start = started.get(event.id);
        started.delete(event.id);
        const record = records.get(event.id);
        records.delete(event.id);
        const result = record?.result;
        const call: RecordedToolCall = {
          order: start?.order ?? order++,
          phase: label,
          toolCallId: event.id,
          name: event.name,
          args: start?.args ?? record?.args ?? null,
          ok: result ? result.ok : event.ok,
          summary: result ? result.summary : event.summary,
          registry: Boolean(record),
          warnings: resultWarnings(result),
          issues: (result?.issues ?? []).slice(0, 30),
          ...(result?.diff ? { diff: result.diff } : {}),
          ...(result?.data !== undefined ? { data: clip(result.data) } : {}),
          startedAt: start?.at ?? Date.now(),
          ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
          coreOk: event.ok,
          coreSummary: event.summary,
        };
        calls.push(call);
        fs.writeSync(toolsFile, `${JSON.stringify(call)}\n`);
      };
      const onToolCall = (record: PiToolCallRecord): void => {
        if (record.toolCallId) records.set(record.toolCallId, record);
      };
      return { onEvent, onToolCall };
    },
    close() {
      fs.closeSync(toolsFile);
      fs.closeSync(eventsFile);
    },
  };
}

export function readRecordedCalls(file: string): RecordedToolCall[] {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as RecordedToolCall)
    .sort((a, b) => a.order - b.order);
}
