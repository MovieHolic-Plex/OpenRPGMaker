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
  /** public/ 아래 정적 그림 하나를 data URL 로(예: assets/room-ideas/rooms2-28.png). 못 읽으면 undefined. */
  readonly readPublicAsset?: (path: string) => Promise<string | undefined>;
  /** 그림 여러 장(data URL)을 1배 그대로 한 장에 차례로 모은다(줄바꿈 격자). 못 하면 undefined. */
  readonly combinePictures?: (urls: readonly string[]) => Promise<string | undefined>;
  /** room_parts 그림 싣기: one 한 장으로 합침(기본) · each 따로 · none 글만. 실행기가 OPRN_ROOM_PARTS_PICTURES 로 바꾼다(A/B 시험용). */
  readonly roomPartsPictures?: "one" | "each" | "none";
  /** room_parts 글: slim 기물 40줄·모양 예 하나(기본) · full 기물 90줄·모양 예 여섯. 실행기가 OPRN_ROOM_PARTS_TEXT 로 바꾼다(A/B 시험용). */
  readonly roomPartsText?: "slim" | "full";
  /** 동사 안에서 중간 결과를 편집기에 바로 싣는다(첫 짓기를 비평 전에 보이게). */
  readonly checkpoint: (label: string) => Promise<void>;
  readonly signal?: AbortSignal;
  /**
   * 다음 지시의 첫 모델 호출에 tool_choice 를 건다(한 번만) — 이름을 주면 그 도구 하나(첫 호출 todo init), 없으면 «required».
   * 재주입 차례가 글만 쓰고 끝나지 않게. 로컬 CLI 고리는 무시한다(그쪽은 todo 동사 감싸개가 첫 쓰기를 되돌린다).
   * Anthropic 확장 생각이 켜진 호출은 이름 지정 강제를 거절하므로 실행기가 그때는 걸지 않는다.
   */
  readonly requireToolNextTurn?: (toolName?: string) => void;
  /**
   * H3 다음 호출 우선(할 일 고리 갈고리): 다음 모델 호출부터 이 도구를 먼저 부르게 한다 — 코어의 SoftToolRequirement(알림 한 번 → 그래도 다른 도구면
   * 실행하지 않고 그 도구를 강제). todo 는 같이 불러도 된다. 강제는 최대 2번, 그 도구가 불리면(clearToolPreference) 또는 3차례 지나면 내린다.
   * 로컬 CLI 고리·Anthropic 확장 생각 호출은 무시한다(이름 강제를 못 건다).
   */
  readonly preferToolNextTurn?: (toolName: string, reminder: string) => void;
  readonly clearToolPreference?: () => void;
  /** 다음 지시 앞에서 대화 기록을 비운다(한 번). 화면 검수 고치기 차례가 긴 실행의 문맥을 다시 싣지 않게(J78). 시스템 지시는 그대로. */
  readonly freshContextNextTurn?: () => void;
  /** 빌려 쓰는 v1 도구가 이 실행의 관문(참고문서 읽기·캐릭터 칩 선택)·맵 범위·보조 호출을 같이 쓰게 하는 옵션. */
  readonly toolsetOptions?: Pick<ResolvePiToolOptions, "referenceGate" | "charsetGate" | "scopeMapIds" | "scopeAllowsSystem" | "findToolsCallable" | "eventAssistChat">;
}
export interface PiAssistantV2Hooks {
  readonly tools: (env: PiAssistantV2Env) => PiToolShape[];
  /** 첫 지시(사용자 요청)를 보내기 직전에 한 번 — 첫 호출 todo 강제 같은 준비. */
  readonly beforeFirstPrompt?: (env: PiAssistantV2Env) => void;
  /**
   * 모델이 도구 없이 멈춘 뒤마다 — 글을 돌려주면 그 글(숨은 재주입)로 같은 대화를 한 차례 더 돈다. undefined 면 실행이 끝난다.
   * v2 는 여기서 할 일 고리를 돌린다(열린 항목·기계 확인 ✗·관문·비평·화면 검수 → 재주입, 상한·진척 규칙은 src/ai/v2/loop/continuation.ts).
   */
  readonly afterMain?: (env: PiAssistantV2Env, round: number) => Promise<string | undefined> | string | undefined;
  /** afterMain 이 몇 차례까지 돌 수 있나(기본 2). v2 할 일 고리는 자체 상한(묶음당 8·진척 없음 2)으로 멈추므로 넉넉히 준다. */
  readonly maxRounds?: number;
}

