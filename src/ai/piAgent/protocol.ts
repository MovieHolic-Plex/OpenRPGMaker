import type { SpecialistModels } from "../modelRoles";
// Pi 에이전트 경로의 공용 규약. 브라우저(클라이언트)·동반 서비스(Node)·Bun 워커(런타임)가 같은
// 요청/이벤트 모양을 쓴다. 전송은 NDJSON 한 줄 = 이벤트 하나.
//
// 왜 별도 규약인가: 기존 세션은 OpenAI chat.completions 모양을 브라우저 루프가 소비했다.
// Pi 경로는 루프가 Bun 쪽에 있어 브라우저는 진행 이벤트만 받고, 마지막 `done` 에 결과
// 프로젝트가 실린다. 적용은 브라우저의 커밋 게이트가 그대로 맡는다.

import type { Project } from "@/project/types";
import type { PiTeamSpec } from "./teamSpec";

export type PiAgentThinkingLevel = "off" | "low" | "medium" | "high";

export type PiAgentMode = "single" | "team";

export interface PiAgentRequest {
  /** 기본 single. team 이면 팀장 에이전트가 맵별 시공·검수 에이전트를 띄운다. */
  readonly mode?: PiAgentMode;
  readonly roleModels?: SpecialistModels;
  readonly provider: string;
  /** 비우면 제공자 기본 모델. */
  readonly model?: string;
  readonly task: string;
  /** 에이전트가 소유하는 맵. 비우면 프로젝트 전체가 작업 범위다. */
  readonly mapIds: readonly string[];
  /**
   * 사용자가 지금 보고 있는 맵. 팀장이 「여기」「이 맵」을 해석하는 기준이자, 다른 맵을 지목하지 않은 지시의 기본 대상이다.
   * 후보(mapIds)를 제한하지 않는다 — 실측(2026-09-15) 팀 모드가 이걸 버려 팀장이 43맵 중 엉뚱한 마을에 배정했다.
   */
  readonly currentMapId?: string;
  readonly project: Project;
  /** 기본 시스템 프롬프트를 대체한다(테스트·CLI 용). */
  readonly systemPrompt?: readonly string[];
  readonly maxTurns?: number;
  readonly thinkingLevel?: PiAgentThinkingLevel;
  /** 노출할 툴 도메인. 비우면 살아 있는 레지스트리 전부. */
  readonly toolDomains?: readonly string[];
  /** 팀 모드의 팀원 명세. 비우면 기본 팀. */
  readonly team?: PiTeamSpec;
  /** 읽기 전용 실행: 쓰기 툴을 주지 않고 조회·보고만 한다(자율성 「읽기 전용」·계획 턴). */
  readonly readOnly?: boolean;
  /** 한 실행의 시간 상한(ms). 비우면 런타임 기본 PI_AGENT_DEFAULT_TIMEOUT_MS(3000초). 팀은 하위 에이전트마다 같은 값이 걸린다. */
  readonly timeoutMs?: number;
}
export interface PiAgentStats {
  readonly ms: number;
  readonly turns: number;
  readonly toolCalls: number;
  readonly toolErrors: number;
  readonly usage?: unknown;
}

export type PiTeamRoleId = "orchestrator" | "builder" | "reviewer";

/**
 * 한 에이전트 실행의 기본 시간 상한. 팀장·시공·검수가 각자 이 상한을 따로 가진다(요청의 timeoutMs 가 있으면 그 값).
 * 처음 10분이었다 — 실측이 19~213초일 때 잡은 값이다. 기존 마을 맵을 손보는 팀 실행은 시공 팀원이 도구 거부를
 * 우회하느라 한 맵에 100초 넘게 쓰고, 검수 → 수정 → 재검수까지 가면 10분이 팀장을 먼저 끊었다(2026-09-15).
 * 유휴 끊김은 heartbeat 가 따로 막으므로 이 값은 «정말 끝나지 않는 실행» 만 잡으면 된다.
 */
export const PI_AGENT_DEFAULT_TIMEOUT_MS = 3_000 * 1_000;

/**
 * 워커가 heartbeat 줄을 쓰는 간격. 진행 이벤트는 턴·툴 경계에만 나오므로 모델이 생각하는 동안 와이어가
 * 비는데, 그 침묵을 유휴 타임아웃 층(Bun.serve idleTimeout 10초 — 지금은 꺼 둠, undici bodyTimeout 300초,
 * 앞으로 끼어들 프록시)이 끊었다(실측 2026-09-14: 팀 모드 「마을 만들어줘」 가 매번 `terminated`).
 */
export const PI_AGENT_HEARTBEAT_MS = 5_000;
/** 브라우저 워치독: 이 시간 동안 줄이 하나도 안 오면 워커가 죽은 것으로 보고 끊는다. heartbeat 의 6배. */
export const PI_AGENT_STALE_MS = 30_000;
/**
 * 델타 중계 간격. 토큰마다 줄을 쓰면 NDJSON 이 수천 줄이 된다. 보드가 이미 1초마다 행을 통째 다시 그리므로
 * (`aiTeamBoard` 티커) 그보다 잔 간격은 보이지 않는 렌더만 늘린다. 와이어가 살아 있는 것은 heartbeat 가 맡는다.
 */
export const PI_AGENT_DELTA_FLUSH_MS = 1_000;

export interface PiTeamAgentStats extends PiAgentStats {}

export type PiAgentEvent =
  | { readonly type: "start"; readonly provider: string; readonly model: string; readonly toolCount: number }
  // ── 팀 이벤트. 하위 에이전트의 진행은 agent_event 로 감싸서 흘린다(보드가 행 단위로 그린다). ──
  | { readonly type: "team_start"; readonly task: string; readonly roles: readonly { id: PiTeamRoleId; label: string }[] }
  | { readonly type: "agent_spawn"; readonly agentId: string; readonly role: PiTeamRoleId; readonly mapId: string | null; readonly mapName: string | null; readonly task: string; readonly memberId?: string; readonly label?: string; /** 검수 지적을 고치러 간 배정이면 그 검수 에이전트 id. 보드가 두 행을 잇는다. */ readonly fixOf?: string }
  | { readonly type: "agent_event"; readonly agentId: string; readonly event: PiAgentEvent }
  | { readonly type: "agent_done"; readonly agentId: string; readonly ok: boolean; readonly summary: string; readonly stats: PiAgentStats; readonly changedKeys: readonly string[]; readonly spills: readonly string[]; readonly conflicts: readonly string[] }
  | { readonly type: "review"; readonly agentId: string; readonly mapId: string | null; readonly ok: boolean; readonly findings: readonly string[] }
  | { readonly type: "team_report"; readonly text: string }
  | { readonly type: "turn"; readonly index: number }
  /** 연결이 살아 있음. 내용은 없다 — 유휴 타임아웃을 지나가게 하고 브라우저 워치독의 시계가 된다. 보드는 무시한다. */
  | { readonly type: "heartbeat"; readonly at: number }
  /** 모델 스트림 조각. 생각(thinking)·본문(text)을 PI_AGENT_DELTA_FLUSH_MS 간격으로 합친 것 — 보드의 「생각 중」 재료. */
  | { readonly type: "delta"; readonly kind: "thinking" | "text"; readonly text: string }
  | { readonly type: "assistant"; readonly text: string }
  | { readonly type: "tool_start"; readonly id: string; readonly name: string; readonly args: unknown }
  | { readonly type: "tool_end"; readonly id: string; readonly name: string; readonly ok: boolean; readonly summary: string }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "done"; readonly project: Project; readonly stats: PiAgentStats; readonly changedKeys: readonly string[] };

export type PiAgentDoneEvent = Extract<PiAgentEvent, { type: "done" }>;

export function encodePiAgentEvent(event: PiAgentEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** 빈 줄·깨진 줄은 null. 워커가 죽으며 반 토막 난 마지막 줄을 조용히 버리기 위함. */
export function parsePiAgentEventLine(line: string): PiAgentEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown };
    return parsed && typeof parsed === "object" && typeof parsed.type === "string" ? (parsed as PiAgentEvent) : null;
  } catch {
    return null;
  }
}

/** 스트림 조각을 줄 단위 이벤트로 바꾼다. 조각 경계가 줄 중간에 걸려도 된다. */
export function createPiAgentLineDecoder(onEvent: (event: PiAgentEvent) => void): {
  push(chunk: string): void;
  flush(): void;
} {
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const event = parsePiAgentEventLine(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
        if (event) onEvent(event);
        index = buffer.indexOf("\n");
      }
    },
    flush() {
      const event = parsePiAgentEventLine(buffer);
      buffer = "";
      if (event) onEvent(event);
    },
  };
}

/** 최상위 키 기준 변경 목록. maps 는 맵 id 단위로 쪼갠다(어느 맵이 바뀌었는지가 곧 범위 감사다). */
export function changedProjectKeys(before: Project, after: Project): string[] {
  const out: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "maps") {
      const ids = new Set([...Object.keys(before.maps ?? {}), ...Object.keys(after.maps ?? {})]);
      for (const id of ids) {
        if (JSON.stringify(before.maps?.[id]) !== JSON.stringify(after.maps?.[id])) out.push(`maps.${id}`);
      }
      continue;
    }
    const a = (before as unknown as Record<string, unknown>)[key];
    const b = (after as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(key);
  }
  return out.sort();
}
