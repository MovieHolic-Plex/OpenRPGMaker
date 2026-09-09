// 브라우저 → 동반 서비스 `/v1/agent/run` 클라이언트. 요청 하나에 프로젝트 사본을 실어 보내고,
// NDJSON 진행 이벤트를 콜백으로 받는다. 마지막 `done` 이벤트를 결과로 돌려준다.

import { companionAuthUrl } from "@/ai/chatgptOAuthClient";
import { createPiAgentLineDecoder, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "./protocol";

export interface RunPiAgentClientOptions {
  readonly onEvent?: (event: PiAgentEvent) => void;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

export class PiAgentClientError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PiAgentClientError";
  }
}

export async function runPiAgentViaCompanion(request: PiAgentRequest, options: RunPiAgentClientOptions = {}): Promise<PiAgentDoneEvent> {
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch(companionAuthUrl("/v1/agent/run", request.provider), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) detail = payload.error;
    } catch {
      // 본문 없음
    }
    throw new PiAgentClientError(`Pi 에이전트 실행 실패: ${detail}`, response.status);
  }
  if (!response.body) throw new PiAgentClientError("Pi 에이전트 응답에 본문이 없습니다");
  let done: PiAgentDoneEvent | null = null;
  let lastError: string | null = null;
  const decoder = createPiAgentLineDecoder((event) => {
    if (event.type === "done") done = event;
    if (event.type === "error") lastError = event.message;
    options.onEvent?.(event);
  });
  const reader = response.body.getReader();
  const text = new TextDecoder();
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    if (value) decoder.push(text.decode(value, { stream: true }));
  }
  decoder.push(text.decode());
  decoder.flush();
  if (done) return done;
  throw new PiAgentClientError(lastError ?? "Pi 에이전트가 결과를 돌려주지 않았습니다");
}
