// 사용자의 로컬 에이전트 CLI(claude · codex · gemini)를 조수 루프로 쓰는 어댑터의 공용 모양.
//
// 원칙(설계 http://mdc-server:18301/assistant-local-agent-1.html):
// - CLI 바이너리를 고치지 않는다. 사용자가 그 CLI 에 직접 로그인한 상태를 그대로 쓴다.
// - 우리는 토큰·키를 읽지도, 옮기지도, 서버에 두지도 않는다. 로그인 여부는 CLI 자신의 상태 명령으로만 본다.
// - 에디터 도구는 실행마다 뜨는 루프백 MCP 서버(mcpHttpServer.ts)로만 노출한다. CLI 의 내장 도구(셸·파일·웹)는 끈다.

export type LocalCliId = "claude" | "codex" | "gemini";

export const LOCAL_CLI_PROVIDER_PREFIX = "local-cli:";
export const LOCAL_CLI_IDS: readonly LocalCliId[] = ["claude", "codex", "gemini"];

export function localCliProviderId(id: LocalCliId): string {
  return `${LOCAL_CLI_PROVIDER_PREFIX}${id}`;
}

/** `local-cli:claude` → `claude`. 다른 제공자는 undefined. */
export function localCliIdOf(provider: unknown): LocalCliId | undefined {
  if (typeof provider !== "string" || !provider.startsWith(LOCAL_CLI_PROVIDER_PREFIX)) return undefined;
  const id = provider.slice(LOCAL_CLI_PROVIDER_PREFIX.length);
  return (LOCAL_CLI_IDS as readonly string[]).includes(id) ? (id as LocalCliId) : undefined;
}

/** 청구 방식 — 구독 로그인이면 비용은 «청구가 아니라 한도 사용»으로 보인다(D8). */
export type LocalCliBilling = "subscription" | "api" | "unknown";

export interface LocalCliModel {
  readonly id: string;
  readonly label: string;
  /** 이 모델을 기본으로 쓰는 역할(routine: 일상 편집 · deep: 큰 시공·설계). */
  readonly roles?: readonly ("routine" | "deep")[];
}

/** 설정 화면이 그대로 그리는 상태 한 줄. 문구는 비개발자용 — API·키 낱말은 고급 칸에만. */
export interface LocalCliStatus {
  readonly id: LocalCliId;
  readonly label: string;
  /** 설치·로그인·준비 상태를 한 값으로: 연결됨 / 로그인 필요 / 설치 필요 / 확인 실패. */
  readonly state: "ready" | "login-required" | "not-installed" | "error";
  readonly stateLabel: string;
  readonly found: boolean;
  readonly version?: string;
  readonly loggedIn?: boolean;
  /** CLI 가 말한 로그인 종류(예: claude `oauth_token`·`api_key`, codex `ChatGPT`). 값만 보고 토큰은 보지 않는다. */
  readonly authMethod?: string;
  readonly billing: LocalCliBilling;
  readonly models: readonly LocalCliModel[];
  /** 역할별 기본 모델(비용·품질 균형). */
  readonly defaults: { readonly routine: string; readonly deep: string };
  /** 설치·로그인 안내. 한 번 눌러 실행할 명령과 사람이 읽을 설명. */
  readonly install: { readonly command: string; readonly help: string; readonly url: string };
  readonly login: { readonly command: string; readonly help: string };
  readonly problem?: string;
}

/** 어댑터가 낸 사용량 — 모델 호출 합계. 비용은 CLI 가 알려 줄 때만(claude). */
export interface LocalCliUsage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly calls: number;
}

/**
 * 어댑터가 루프에 넘기는 사건. CLI 마다 원본 모양이 달라 여기서 한 모양으로 맞춘다.
 * - assistant: 모델 응답 한 덩어리(새 모델 요청이면 newRequest). 글·생각·도구 호출 블록.
 * - delivered: 모델에게 «실제로 넘어간» 도구 결과(CLI 가 되돌려 준 원문). Anthropic tool_result 모양으로 맞춘다 —
 *   참고문서·캐릭터 칩 관문이 이것을 보고 읽음을 인정한다(우리가 보낸 것이 아니라 CLI 가 받았다고 말한 것).
 * - result: 한 번의 prompt 가 끝남(성공·실패). 사용량·비용·세션 id.
 */
export type LocalCliEvent =
  | { readonly kind: "assistant"; readonly messageId: string; readonly newRequest: boolean; readonly blocks: readonly LocalCliBlock[]; /** 이 응답(모델 요청 하나)의 사용량 — CLI 가 줄마다 실어 준다(claude). */ readonly usage?: LocalCliUsage }
  | { readonly kind: "delivered"; readonly payload: readonly unknown[] }
  /**
   * 결과 원문을 되돌려 주지 않는 CLI(gemini stream-json 은 글 output 만, 그림은 안 준다)의 «받았다» 신호.
   * 루프가 그 도구 호출에 우리가 돌려준 원문을 짝지어 관문에 넘긴다(D5: stream-json 도구 결과를 읽음 증거로 인정).
   */
  | { readonly kind: "acknowledged"; readonly toolName: string; readonly ok: boolean }
  | { readonly kind: "result"; readonly ok: boolean; readonly error?: string; readonly usage?: LocalCliUsage; readonly costUsd?: number; readonly sessionId?: string }
  | { readonly kind: "stderr"; readonly text: string };

export type LocalCliBlock =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "thinking"; readonly text: string }
  | { readonly type: "tool_use"; readonly name: string };

export interface LocalCliSessionOptions {
  readonly mcpUrl: string;
  readonly mcpToken: string;
  /** 우리 지시문 전체. claude 는 기본 시스템 프롬프트를 이것으로 «바꾼다»(코딩 지시 수천 토큰을 안 싣는다). */
  readonly systemPrompt: string;
  readonly model?: string;
  readonly effort?: "low" | "medium" | "high";
  readonly signal?: AbortSignal;
  readonly onEvent: (event: LocalCliEvent) => void;
  /** CLI 원본 줄(기록용). */
  readonly onRaw?: (line: unknown) => void;
  readonly binary?: string;
}

/** 보조 글 생성에 붙이는 그림(그림 검토·시각 판정). */
export interface LocalCliImage { readonly mimeType: string; readonly data: string }

export interface LocalCliSession {
  /** 사용자 차례 하나를 보내고 그 차례가 끝날 때(result) 돌아온다. 같은 대화를 이어 간다. 그림은 그 차례에 함께 싣는다. */
  prompt(text: string, images?: readonly LocalCliImage[]): Promise<void>;
  /** 진행 중인 차례에 끼워 넣을 말(반복 경고·팀 메시지). 즉시 못 넣는 CLI 는 다음 prompt 앞에 붙인다. */
  steer(text: string): void;
  /** 즉시 멈춘다(프로세스 종료). */
  kill(): void;
  /** 정상 마무리(stdin 닫기·임시 폴더 정리). */
  close(): Promise<void>;
}

export interface LocalCliAdapter {
  readonly id: LocalCliId;
  readonly label: string;
  /** stream 출력이 모델에 넘긴 도구 결과 원문을 되돌려 주는가(claude·codex 예, gemini 아니오 — acknowledged 로 대신한다). */
  readonly echoesResults: boolean;
  detect(binary?: string): Promise<LocalCliStatus>;
  openSession(options: LocalCliSessionOptions): LocalCliSession;
  /** 도구 없는 한 번짜리 글 생성(event_command_assist·도트 글 저작 같은 내부 보조 호출). */
  /** 그림을 못 받는 CLI(gemini 비대화 모드)는 images 가 있으면 오류를 낸다 — 그림 없이 「봤다」고 답하게 두지 않는다. */
  complete(prompt: string, options?: { readonly model?: string; readonly signal?: AbortSignal; readonly binary?: string; readonly images?: readonly LocalCliImage[]; /** 이 호출의 사용량(판정자·비평가 토큰을 실행 합계에 넣는다). 보고하는 CLI 만 부른다. */ readonly onUsage?: (usage: LocalCliUsage, costUsd?: number) => void }): Promise<string>;
}
