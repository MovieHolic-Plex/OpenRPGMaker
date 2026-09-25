import { inspectionEpoch, publishPromptInspection } from "../authoring/promptInspection";
import type { Project } from "@/project/types";
// 브라우저 → 동반 서비스 `/v1/agent/run` 클라이언트. 요청 하나에 프로젝트 사본을 실어 보내고,
// NDJSON 진행 이벤트를 받는다. checkpoint는 실제 적용/승인 뒤 ACK하며 done을 최종 결과로 돌려준다.

import { companionAuthUrl } from "@/ai/chatgptOAuthClient";
import { companionTokenHeaders } from "@/ai/companionToken";
import { createPiAgentLineDecoder, PI_AGENT_STALE_MS, restoreCheckpointProject, slimCheckpointProject, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "./protocol";
import { piRequestBody } from "./requestBody";

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
  const wire = await piRequestBody(request, options.signal);
  const response = await doFetch(companionAuthUrl("/v1/agent/run", request.provider), {
    method: "POST",
    ...wire,
    headers: { ...wire.headers, ...companionTokenHeaders() },
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
  // 대입이 스트림 콜백 안에서만 일어나 제어흐름 분석이 초기값 null 로 좁힌다(그러면 truthy 분기가 never 가 된다).
  let done: PiAgentDoneEvent | null = null as PiAgentDoneEvent | null;
  let lastError: string | null = null;
  let checkpoints = Promise.resolve();
  let checkpointError: unknown;
  // 워커가 «우리» 적용·그림 응답을 기다리는 동안의 침묵은 워커 사망이 아니다. 25MB 체크포인트 적용이
  // 페이지 주 스레드를 30초 넘게 잡으면(부하 걸린 머신) 이미 도착한 heartbeat 를 읽지 못한 채 워치독이 먼저
  // 울려 실행 전체를 끊었고, 뒤따른 ACK 가 409 로 돌아와 「적용 응답을 전달하지 못했습니다」만 남았다
  // (2026-09-24 몬스터 수집 도그푸딩, 22턴/89툴콜에서 사망). 응답 중에는 워치독을 다시 건다.
  let acksInFlight = 0;
  let stale = false;
  let lastLineAt = Date.now();
  const trackAck = (work: () => Promise<void>) => async () => {
    acksInFlight += 1;
    try { await work(); } finally { acksInFlight -= 1; lastLineAt = Date.now(); }
  };
  const receiveInspection = (event: PiAgentEvent): boolean => {
    if (event.type === "prompt_inspection") {
      if (!options.signal?.aborted) publishPromptInspection(event.snapshot, captureEpoch);
      return true;
    }
    return event.type === "agent_event" && receiveInspection(event.event);
  };
  const receiveRender = (event: PiAgentEvent): boolean => {
    if (event.type === "agent_event") return receiveRender(event.event);
    if (event.type !== "render_request") return false;
    checkpoints = checkpoints.then(trackAck(async () => {
      let png: string | undefined, issue: string | undefined;
      try {
        options.signal?.throwIfAborted();
        const { renderPiMapImage } = await import("../toolImageRenderer");
        const draft = restoreCheckpointProject(request.project, event.project, event.unchangedKeys);
        const url = await renderPiMapImage(draft, event.data);
        png = url.replace(/^data:image\/png;base64,/, "");
      } catch (error) { issue = error instanceof Error ? error.message : String(error); }
      const ack = await doFetch(companionAuthUrl("/v1/agent/render", request.provider), {
        method: "POST", headers: { "Content-Type": "application/json", ...companionTokenHeaders() },
        body: JSON.stringify({ renderId: event.renderId, png, issue }),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!ack.ok) throw new PiAgentClientError("맵 이미지 응답을 전달하지 못했습니다.", ack.status);
    })).catch(error => { checkpointError = error; void reader.cancel().catch(() => undefined); });
    return true;
  };
  const decoder = createPiAgentLineDecoder((raw) => {
    // 워커는 요청 그대로인 무거운 키(타일셋 이미지·DB)를 빼고 done 을 보낸다 — 요청 프로젝트의 것을 다시 붙인다.
    const event = raw.type === "done" && raw.unchangedKeys?.length ? restoreDone(raw, request.project) : raw;
    // Never persist request contents into conversation/audit event logs.
    if (receiveInspection(event) || receiveRender(event)) return;
    if (event.type === "checkpoint") {
      options.onEvent?.(event);
      checkpoints = checkpoints.then(trackAck(async () => {
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
        const ackWire = await piRequestBody({ checkpointId: event.checkpointId, ok: issue === undefined, issue, project: ackProject }, options.signal);
        const ack = await doFetch(companionAuthUrl("/v1/agent/checkpoint", request.provider), {
          method: "POST",
          ...ackWire,
          headers: { ...ackWire.headers, ...companionTokenHeaders() },
          ...(options.signal ? { signal: options.signal } : {}),
        });
        if (!ack.ok) throw new PiAgentClientError(stale ? "적용 응답을 전달하지 못했습니다 — 워커 연결이 먼저 끊겼습니다." : "적용 응답을 전달하지 못했습니다.", ack.status);
      })).catch(error => { checkpointError = error; void reader.cancel().catch(() => undefined); });
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
  const onStale = () => {
    // 우리가 응답 중이거나, 타이머가 늦게 울렸을 뿐 마지막 줄 이후 staleMs 가 안 지났으면 다시 건다.
    if (acksInFlight > 0 || Date.now() - lastLineAt < staleMs) { watchdog = setTimeout(onStale, staleMs); return; }
    stale = true;
    void reader.cancel().catch(() => undefined);
  };
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
  // 워치독이 먼저 끊었으면 그 뒤 ACK 실패(워커가 이미 대기를 거둔 409)는 결과일 뿐 — 원인을 보고한다.
  if (checkpointError && !stale) throw checkpointError;
  if (done?.interiorCompletion?.length) throw new PiAgentClientError(`실내 미완료: ${done.interiorCompletion.length}개 맵에 검사 문제가 남아 완료 처리하지 않았습니다. 실행 기록의 실내 검사 결과를 확인하세요.`);
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
