import { inspectionEpoch, publishPromptInspection } from "../authoring/promptInspection";
import type { Project } from "@/project/types";
// 브라우저 → 동반 서비스 `/v1/agent/run` 클라이언트. 요청 하나에 프로젝트 사본을 실어 보내고,
// NDJSON 진행 이벤트를 받는다. checkpoint는 실제 적용/승인 뒤 ACK하며 done을 최종 결과로 돌려준다.

import { companionAuthUrl } from "@/ai/chatgptOAuthClient";
import { companionTokenHeaders } from "@/ai/companionToken";
import { createPiAgentLineDecoder, PI_AGENT_STALE_MS, restoreCheckpointProject, slimCheckpointProject, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "./protocol";

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
  const captureEpoch = inspectionEpoch();
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch(companionAuthUrl("/v1/agent/run", request.provider), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...companionTokenHeaders() },
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
  const receiveInspection = (event: PiAgentEvent): boolean => {
    if (event.type === "prompt_inspection") {
      if (!options.signal?.aborted) publishPromptInspection(event.snapshot, captureEpoch);
      return true;
    }
    return event.type === "agent_event" && receiveInspection(event.event);
  };
  const decoder = createPiAgentLineDecoder((raw) => {
    // 워커는 요청 그대로인 무거운 키(타일셋 이미지·DB)를 빼고 done 을 보낸다 — 요청 프로젝트의 것을 다시 붙인다.
    const event = raw.type === "done" && raw.unchangedKeys?.length ? restoreDone(raw, request.project) : raw;
    // Never persist request contents into conversation/audit event logs.
    if (receiveInspection(event)) return;
    if (event.type === "checkpoint") {
      options.onEvent?.(event);
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
        options.onEvent?.({ type: "execution_status", name: "checkpoint.apply", summary: issue ? "단계 적용 실패" : "단계 적용 완료", ok: issue === undefined, data: { checkpointId: event.checkpointId, issue } });
        const ackProject = project && event.unchangedKeys?.length
          ? slimCheckpointProject(project, event.unchangedKeys)
          : project;
        const ack = await doFetch(companionAuthUrl("/v1/agent/checkpoint", request.provider), {
          method: "POST", headers: { "Content-Type": "application/json", ...companionTokenHeaders() },
          body: JSON.stringify({ checkpointId: event.checkpointId, ok: issue === undefined, issue, project: ackProject }),
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

function restoreDone(done: PiAgentDoneEvent, requestProject: PiAgentRequest["project"]): PiAgentDoneEvent {
  const { unchangedKeys, ...rest } = done;
  return { ...rest, project: restoreCheckpointProject(requestProject, done.project, unchangedKeys) };
}
