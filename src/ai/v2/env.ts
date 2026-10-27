// 조수 v2 가 runPiAgent(scripts/lib/piAgentRuntime.ts)에 끼우는 두 갈고리와 그 환경. 순수 타입.
import type { PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import type { PiToolCallRecord, PiToolShape, ResolvePiToolOptions } from "@/ai/piAgent/toolAdapter";
import type { ToolContext } from "@/editor/tools/types";

/** 조수 v2 가 runPiAgent 에 끼우는 두 갈고리. 환경은 이 실행의 사본·기록·보조 호출·1배 렌더를 그대로 넘긴다. */
export interface PiAssistantV2Env {
  readonly ctx: ToolContext;
  readonly request: PiAgentRequest;
  readonly emit: (event: PiAgentEvent) => void;
  /** 쓰기 기록 — 시공 재생 단계(constructionLogs)를 다음 체크포인트에 싣고 tool_end 요약을 채운다. */
  readonly record: (record: PiToolCallRecord) => void;
  /** 조수와 같은 모델로 따로 부르는 한 번짜리 호출(비평가·해석) — 사용량은 stats.review 로 따로 모인다. */
  readonly sideChat: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
  /**
   * 독립 검토자용 대화(src/ai/assistantRoles.ts 의 advisor 칸). 칸이 없거나 그 계정 키가 없으면 비고, 검토자는 sideChat(주 모델·다른 문맥)으로 돈다.
   * advisorModel 은 실제로 부르는 모델 이름(실행 기록용).
   */
  readonly advisorChat?: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
  readonly advisorModel?: string;
  /**
   * 타이틀·오프닝 그림을 1배로 찍는다(화면 검수 src/ai/v2/vqa.ts). resourceId 한 장, 또는 애니메틱 샷의 시간 표본(atMs 1~4개).
   * 편집기 렌더 브로커 경로라 브라우저가 붙은 실행에만 있다.
   */
  readonly renderArt?: (request: { readonly resourceId: string } | { readonly shotId: string; readonly atMs: readonly number[] }) => Promise<string>;
  /** 역할 모델 하나로 따로 부르기(그림 포함 가능). 그 계정 키가 없으면 던진다. */
  readonly roleChat?: (role: { readonly provider: string; readonly model: string; readonly effort?: "low" | "medium" | "high" }, messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
  /** 이 실행에 키가 실린 계정 id(로컬 CLI 포함). 검수자 고르기에 쓴다. */
  readonly keyedProviders?: ReadonlySet<string>;
  /** 맵 한 구역을 약 1배 PNG(data URL)로. 렌더 경로가 없으면 undefined. */
  readonly render?: (mapId: string, x: number, y: number, w: number, h: number) => Promise<string>;
  /** 동사 안에서 중간 결과를 편집기에 바로 싣는다(첫 짓기를 비평 전에 보이게). */
  readonly checkpoint: (label: string) => Promise<void>;
  readonly signal?: AbortSignal;
  /** 다음 지시의 첫 모델 호출에 tool_choice «required» 를 건다(한 번만). 화면 검수 고치기 차례가 글만 쓰고 끝나지 않게. 로컬 CLI 고리는 무시한다. */
  readonly requireToolNextTurn?: () => void;
  /** 다음 지시 앞에서 대화 기록을 비운다(한 번). 화면 검수 고치기 차례가 긴 실행의 문맥을 다시 싣지 않게(J78). 시스템 지시는 그대로. */
  readonly freshContextNextTurn?: () => void;
  /** 빌려 쓰는 v1 도구가 이 실행의 관문(참고문서 읽기·캐릭터 칩 선택)·맵 범위·보조 호출을 같이 쓰게 하는 옵션. */
  readonly toolsetOptions?: Pick<ResolvePiToolOptions, "referenceGate" | "charsetGate" | "scopeMapIds" | "scopeAllowsSystem" | "findToolsCallable" | "eventAssistChat">;
}
export interface PiAssistantV2Hooks {
  readonly tools: (env: PiAssistantV2Env) => PiToolShape[];
  /**
   * 주 지시가 끝난 뒤 — 글을 돌려주면 그 글로 한 차례 더 돈다(완료 조건 미충족 보고 등). round 0 이 첫 부름이고,
   * round 0 이 글을 돌려줘 한 차례 더 돈 뒤에 round 1 로 한 번 더 부른다(새 최종 보고를 다시 대어 보는 자리). 최대 2차례.
   */
  readonly afterMain?: (env: PiAssistantV2Env, round: number) => Promise<string | undefined> | string | undefined;
  /** afterMain 이 몇 차례까지 돌 수 있나(기본 2 — 검토자 후속·재검토). 화면 검수 고리가 켜진 실행은 더 늘린다. */
  readonly maxRounds?: number;
}

