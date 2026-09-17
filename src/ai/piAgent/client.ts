import type { Project } from "@/project/types";
// 브라우저 → 동반 서비스 `/v1/agent/run` 클라이언트. 요청 하나에 프로젝트 사본을 실어 보내고,
// NDJSON 진행 이벤트를 받는다. checkpoint는 실제 적용/승인 뒤 ACK하며 done을 최종 결과로 돌려준다.

import { companionAuthUrl } from "@/ai/chatgptOAuthClient";
import { createPiAgentLineDecoder, PI_AGENT_STALE_MS, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "./protocol";

export interface RunPiAgentClientOptions {
  readonly onCheckpoint?: (event: Extract<PiAgentEvent, { type: "checkpoint" }>) => Promise<Project | void>;
  readonly onEvent?: (event: PiAgentEvent) => void;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  /** 이 시간 동안 줄이 하나도 안 오면 워커가 죽은 것으로 보고 끊는다. 워커는 5초마다 heartbeat 를 쓴다. */
  readonly staleMs?: number;
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
  let checkpoints = Promise.resolve();
  let checkpointError: unknown;
  const decoder = createPiAgentLineDecoder((event) => {
    if (event.type === "checkpoint") {
      checkpoints = checkpoints.then(async () => {
        let issue: string | undefined;
        let project: Project | void = undefined;
        try {
          options.signal?.throwIfAborted();
          if (!options.onCheckpoint) throw new Error("이 호출자는 실시간 적용을 지원하지 않습니다.");
          project = await options.onCheckpoint(event);
        } catch (error) {
          checkpointError = error;
          issue = error instanceof Error ? error.message : String(error);
        }
        const ack = await doFetch(companionAuthUrl("/v1/agent/checkpoint", request.provider), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkpointId: event.checkpointId, ok: issue === undefined, issue, project }),
          ...(options.signal ? { signal: options.signal } : {}),
        });
        if (!ack.ok) throw new PiAgentClientError("적용 응답을 전달하지 못했습니다.", ack.status);
      }).catch(error => { checkpointError = error; void reader.cancel().catch(() => undefined); });
      return;
    }
    if (event.type === "done") done = event;
    if (event.type === "error") lastError = event.message;
    options.onEvent?.(event);
  });
  const reader = response.body.getReader();
  const text = new TextDecoder();
  // 워치독: 침묵은 모델이 생각하는 것이 아니라(그건 heartbeat 가 묻는다) 워커가 죽은 것이다. 끊지 않으면 실행 상한(PI_AGENT_DEFAULT_TIMEOUT_MS, 3000초)까지 「실행 중」이 떠 있는다.
  const staleMs = options.staleMs ?? PI_AGENT_STALE_MS;
  let stale = false;
  let lastLineAt = Date.now();
  const onStale = () => { stale = true; void reader.cancel().catch(() => undefined); };
  let watchdog = setTimeout(onStale, staleMs);
  try {
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      if (value) {
        clearTimeout(watchdog);
        watchdog = setTimeout(onStale, staleMs);
        lastLineAt = Date.now();
        decoder.push(text.decode(value, { stream: true }));
      }
    }
  } finally {
    clearTimeout(watchdog);
  }
  decoder.push(text.decode());
  decoder.flush();
  await checkpoints;
  if (checkpointError) throw checkpointError;
  if (done) return done;
  if (stale) {
    throw new PiAgentClientError(`워커에서 ${Math.round((Date.now() - lastLineAt) / 1000)}초 동안 신호가 없어 연결을 끊었습니다. 워커가 응답하지 않습니다 — 다시 시도하고, 반복되면 개발 서버 콘솔의 [oh-my-pi-worker] 줄을 봐 주세요.`);
  }
  throw new PiAgentClientError(lastError ?? "Pi 에이전트가 결과를 돌려주지 않았습니다");
}
