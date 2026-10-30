// OPRN 수정본(원본 general-good-writing scripts/src/jev/client.ts @eeb868e 의 앞부분만).
// 원본은 TypeSafe Jev 판정 서버를 부르는 클라이언트(JevClient·requestKey, node:crypto·키 파일 읽기)를 담는다.
// OPRN 은 판정 모델 없이 로컬 규칙만 쓰므로(jev:false) 오류 클래스·타입·Usage 만 남기고 네트워크·키 코드를 뺐다.
// 남긴 줄은 원본과 같다. 바꾼 것: import 줄 셋 제거, json import 를 타입 import 로, requestKey 이하 삭제, 그 아래에서만 쓰던 상수 MAX_ATTEMPTS·RETRY_STATUS 와 서버 주소·모델·UA·리플레이 상수(ENDPOINT·MODEL·USER_AGENT·REPLAY_ENV) 삭제.
import type { Json, JsonObject } from "../text/json.ts";
import { roundHalfEven } from "../text/num.ts";

const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

export type Questions = JsonObject;
export type Answers = JsonObject;
export type Job = readonly [state: Json, questions: Questions];

export class JevError extends Error {
  override readonly name: string = "JevError";
}

/** The remote endpoint failed. `reason` is short and key-free ('HTTP 402 billing_error'); the CLI then degrades. */
export class JevBackendError extends JevError {
  override readonly name = "JevBackendError";
  readonly reason: string;
  constructor(reason: string, detail = "") {
    super(detail === "" ? reason : `${reason}: ${detail}`);
    this.reason = reason;
  }
}

export type UsageDict = {
  readonly requests: number;
  readonly input_tokens: number;
  readonly usd: number;
  readonly wall_ms: number;
  readonly errors: readonly string[];
};

export class Usage {
  requests = 0;
  inputTokens = 0;
  outputTokens = 0;
  wallMs = 0;
  readonly errors: string[] = [];

  get usd(): number {
    return this.inputTokens * USD_PER_INPUT_TOKEN;
  }

  asDict(): UsageDict {
    return {
      requests: this.requests,
      input_tokens: this.inputTokens,
      usd: roundHalfEven(this.usd, 5),
      wall_ms: roundHalfEven(this.wallMs),
      errors: this.errors.slice(0, 5),
    };
  }
}

export interface Client {
  readonly usage: Usage;
  readonly model: string;
  ask(state: Json, questions: Questions): Promise<Answers>;
  askMany(jobs: readonly Job[]): Promise<(Answers | null)[]>;
}
