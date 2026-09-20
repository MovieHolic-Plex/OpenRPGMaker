// ai/webSearch/types.ts
// 조수 웹 검색의 결과 표현 — 제공자 중립. 툴 결과·감사 로그·테스트가 같은 모양을 쓴다.

export interface WebSearchSource {
  readonly url: string;
  /** 페이지 제목이 오면 채운다. 없으면 url 만 쓴다(업스트림이 안 주는 경우가 있다). */
  readonly title?: string;
}

export interface WebSearchOutcome {
  readonly ok: boolean;
  /** 모델이 읽는 본문. 실패면 사용자에게 보일 한 문장 이유. */
  readonly answer: string;
  readonly sources: readonly WebSearchSource[];
  /** 제공자가 실제로 던진 검색 질의(있으면). 모델이 "무엇을 검색했나" 를 알게 한다. */
  readonly queries: readonly string[];
  readonly provider: string;
  readonly model?: string;
  /** 실패 분류 — 호출부가 재시도·안내를 가른다. */
  readonly code?: string;
}

export interface WebSearchRequest {
  readonly query: string;
  readonly signal?: AbortSignal;
  /** 결과에 실을 출처 상한. 기본 6. */
  readonly maxSources?: number;
}
