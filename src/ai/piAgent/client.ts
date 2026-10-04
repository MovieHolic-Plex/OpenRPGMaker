import { inspectionEpoch, publishPromptInspection } from "../authoring/promptInspection";
import type { Project } from "@/project/types";
// 브라우저 → 동반 서비스 `/v1/agent/run` 클라이언트. 요청 하나에 프로젝트 사본을 실어 보내고,
// NDJSON 진행 이벤트를 받는다. checkpoint는 실제 적용/승인 뒤 ACK하며 done을 최종 결과로 돌려준다.

import { companionAuthUrl } from "@/ai/chatgptOAuthClient";
import { companionTokenHeaders } from "@/ai/companionToken";
import { createPiAgentLineDecoder, PI_AGENT_STALE_MS, restoreCheckpointProject, slimCheckpointProject, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest, type PiCheckpointHeavyKey } from "./protocol";
import { piRequestBody } from "./requestBody";
import { forgetHeavySent, markHeavySent, planHeavyWire, withHeavyBlobs } from "./heavyWire";
import { defaultYieldToUi } from "../yieldToUi";
import { loadAiConfig } from '../llmClient';

export interface RunPiAgentClientOptions {
  readonly onCheckpoint?: (event: Extract<PiAgentEvent, { type: "checkpoint" }>) => Promise<Project | void>;
  readonly onEvent?: (event: PiAgentEvent) => void;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  /** 이 시간 동안 줄이 하나도 안 오면 워커가 죽은 것으로 보고 끊는다. 워커는 5초마다 heartbeat 를 쓴다. */
  readonly staleMs?: number;
  /** 끊긴 스트림을 이어 받을 때 시도 사이 대기(ms). 기본 2초에서 두 배씩, 최대 15초. */
  readonly resumeDelayMs?: number;
  /** 이어 받기 시도 상한(연속). 한 번이라도 줄을 받으면 다시 센다. */
  readonly resumeAttempts?: number;
}

export class PiAgentClientError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PiAgentClientError";
  }
}

async function readError(response: Response): Promise<{ error?: string; missing?: string[] }> {
  try { return (await response.json()) as { error?: string; missing?: string[] }; } catch { return {}; }
}

function newRunId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * 실행을 연다. 무거운 키(타일셋·DB·에셋)는 해시로 보내고, 호스트가 모르는 해시만 내용을 싣는다(heavyWire).
 * 호스트가 409 heavy-missing 이면 그 해시만 실어 한 번 더 보낸다. 옛 호스트(해시를 모르는)는 heavy 필드를 무시하고
 * 빈 키를 받게 되므로, 해시 전송은 실행 기록 헤더(X-Oprn-Run-Id)를 돌려주는 호스트에서만 기억한다.
 *
 * 첫 시도는 내용 없이 해시만 보낸다 — 이 탭이 아직 안 보낸 해시라도. 호스트 캐시는 탭·새로고침보다 오래 살아서
 * (2026-10-04 실측) 새로고침 뒤 첫 턴마다 이미 가진 150MB 를 다시 gzip·업로드·해제·파싱했다: 보내기 쪽 약 5s,
 * 호스트 쪽 약 6s. 호스트가 정말 모르면 409 한 번(작은 몸통 왕복)으로 그 해시만 받는다.
 */
async function openRun(request: PiAgentRequest, runId: string, doFetch: typeof fetch, signal: AbortSignal | undefined): Promise<Response> {
  const url = companionAuthUrl("/v1/agent/run", request.provider);
  const origin = new URL(url, typeof location !== "undefined" ? location.href : "http://local").origin;
  const plan = await planHeavyWire(request);
  const post = async (body: unknown) => {
    const wire = await piRequestBody(body, signal);
    return doFetch(url, { method: "POST", ...wire, headers: { ...wire.headers, ...companionTokenHeaders() }, ...(signal ? { signal } : {}) });
  };
  if (!plan) return post({ ...request, runId });
  let response = await post({ ...withHeavyBlobs(plan, origin, []), runId });
  if (response.status === 409) {
    const payload = await readError(response.clone());
    if (payload.error === "heavy-missing" && Array.isArray(payload.missing)) {
      forgetHeavySent(origin, payload.missing);
      response = await post({ ...withHeavyBlobs(plan, origin, payload.missing), runId });
    }
  }
  if (response.ok && response.headers.get("X-Oprn-Run-Id")) markHeavySent(origin, plan);
  else if (response.ok) {
    // 실행 기록을 모르는 옛 호스트 — heavy 를 무시했으므로 빈 키로 돌고 있다. 끊고 예전 방식으로 다시 보낸다.
    void response.body?.cancel().catch(() => undefined);
    response = await post({ ...request, runId });
  }
  return response;
}

export async function runPiAgentViaCompanion(request: PiAgentRequest, options: RunPiAgentClientOptions = {}): Promise<PiAgentDoneEvent> {
  const imageConfig = loadAiConfig();
  request = { ...request, imageProvider: request.imageProvider ?? imageConfig.imageProviderId,
    imageModel: request.imageModel ?? imageConfig.imageModel };
  const captureEpoch = inspectionEpoch();
  const doFetch = options.fetchImpl ?? fetch;
  const runId = newRunId();
  let response = await openRun(request, runId, doFetch, options.signal);
  if (!response.ok) {
    const payload = await readError(response);
    throw new PiAgentClientError(`Pi 에이전트 실행 실패: ${payload.error ?? response.status}`, response.status);
  }
  if (!response.body) throw new PiAgentClientError("Pi 에이전트 응답에 본문이 없습니다");
  // 호스트가 실행 기록을 들고 있으면(헤더) 끊겨도 이어 받는다. 없으면 예전처럼 한 연결이 전부다.
  const resumable = response.headers.get("X-Oprn-Run-Id") === runId;
  // 사용자 중단은 연결을 끊는 것만으로는 실행이 멈추지 않는다(호스트가 이어 받기를 기다린다) — 명시적으로 알린다.
  const onUserAbort = () => {
    if (!resumable) return;
    void doFetch(companionAuthUrl("/v1/agent/cancel", request.provider), {
      method: "POST", headers: { "Content-Type": "application/json", ...companionTokenHeaders() }, body: JSON.stringify({ runId }),
    }).catch(() => undefined);
  };
  options.signal?.addEventListener("abort", onUserAbort, { once: true });
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
  /** 호스트 실행 기록에서 마지막으로 받은 줄 번호. 이어 받을 때 after 로 보낸다. 같은 번호 이하는 두 번 처리하지 않는다. */
  let lastSeq = -1;
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
        const { renderPiToolImage } = await import("../toolImageRenderer");
        const draft = restoreCheckpointProject(request.project, event.project, event.unchangedKeys, event.unchangedTilesetIds);
        const url = await renderPiToolImage(draft, event.toolName, event.data);
        png = url.replace(/^data:image\/png;base64,/, "");
      } catch (error) { issue = error instanceof Error ? error.message : String(error); }
      const ack = await doFetch(companionAuthUrl("/v1/agent/render", request.provider), {
        method: "POST", headers: { "Content-Type": "application/json", ...companionTokenHeaders() },
        body: JSON.stringify({ renderId: event.renderId, png, issue }),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!ack.ok) throw new PiAgentClientError("맵 이미지 응답을 전달하지 못했습니다.", ack.status);
    })).catch(error => { checkpointError = error; abortStream(); });
    return true;
  };
  const decoder = createPiAgentLineDecoder((line) => {
    const seq = (line as { seq?: unknown }).seq;
    if (typeof seq === "number") {
      if (seq <= lastSeq) return;
      lastSeq = seq;
    }
    const raw = line;
    // 워커는 요청 그대로인 무거운 키(타일셋 이미지·DB)를 빼고 done 을 보낸다 — 요청 프로젝트의 것을 다시 붙인다.
    const event = raw.type === "done" && (raw.unchangedKeys?.length || raw.unchangedTilesetIds?.length) ? restoreDone(raw, request.project) : raw;
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
          // 적용은 메인 스레드를 수 초 잡는다. 그 전에 한 번 그리게 해서 방금 받은 줄(「맵에 반영 중」)이 먼저 보이게 한다.
          await defaultYieldToUi();
          options.signal?.throwIfAborted();
          project = await options.onCheckpoint(event);
        } catch (error) {
          checkpointError = error;
          issue = error instanceof Error ? error.message : String(error);
        }
        options.onEvent?.({ type: "execution_status", name: "checkpoint.apply", summary: issue ? "단계 적용 실패" : "단계 적용 완료", ok: issue === undefined, data: { checkpointId: event.checkpointId, issue } });
        // 받은 모양 그대로 돌려준다 — 워커가 뺀 키·타일셋을 자기 사본에서 다시 붙인다.
        const ackProject = project && (event.unchangedKeys?.length || event.unchangedTilesetIds?.length)
          ? slimForAck(project, event.unchangedKeys ?? [], event.unchangedTilesetIds ?? [])
          : project;
        const ackWire = await piRequestBody({ checkpointId: event.checkpointId, ok: issue === undefined, issue, project: ackProject }, options.signal);
        const ack = await doFetch(companionAuthUrl("/v1/agent/checkpoint", request.provider), {
          method: "POST",
          ...ackWire,
          headers: { ...ackWire.headers, ...companionTokenHeaders() },
          ...(options.signal ? { signal: options.signal } : {}),
        });
        if (!ack.ok) throw new PiAgentClientError(stale ? "적용 응답을 전달하지 못했습니다 — 워커 연결이 먼저 끊겼습니다." : "적용 응답을 전달하지 못했습니다.", ack.status);
      })).catch(error => { checkpointError = error; abortStream(); });
      return;
    }
    if (event.type === "done") done = event;
    if (event.type === "error") lastError = event.message;
    options.onEvent?.(event);
  });
  // 지금 읽는 연결. 이어 받으면 새 연결로 바뀐다 — 체크포인트 실패·워치독이 끊는 대상은 언제나 지금 것이다.
  let reader = response.body.getReader();
  /** 우리가 일부러 끊었다(체크포인트 실패·워치독·사용자 중단). 이어 받지 않는다. */
  let stopped = false;
  const abortStream = () => { stopped = true; void reader.cancel().catch(() => undefined); };
  const text = new TextDecoder();
  // 워치독: 침묵은 모델이 생각하는 것이 아니라(그건 heartbeat 가 묻는다) 워커가 죽은 것이다. 끊지 않으면 실행 상한(PI_AGENT_DEFAULT_TIMEOUT_MS, 3000초)까지 「실행 중」이 떠 있는다.
  const staleMs = options.staleMs ?? PI_AGENT_STALE_MS;
  const onStale = () => {
    // 우리가 응답 중이거나, 타이머가 늦게 울렸을 뿐 마지막 줄 이후 staleMs 가 안 지났으면 다시 건다.
    if (acksInFlight > 0 || Date.now() - lastLineAt < staleMs) { watchdog = setTimeout(onStale, staleMs); return; }
    stale = true;
    abortStream();
  };
  let watchdog = setTimeout(onStale, staleMs);
  const resumeAttempts = options.resumeAttempts ?? 6;
  const resumeBase = options.resumeDelayMs ?? 2_000;
  let failures = 0;
  let dropError: unknown = null;
  try {
    for (;;) {
      try {
        for (;;) {
          const { value, done: finished } = await reader.read();
          if (finished) break;
          if (value) {
            clearTimeout(watchdog);
            watchdog = setTimeout(onStale, staleMs);
            lastLineAt = Date.now();
            failures = 0;
            decoder.push(text.decode(value, { stream: true }));
          }
        }
        dropError = null;
      } catch (error) {
        // 연결이 도중에 끊겼다(와이파이·절전·네트워크 변경, Firefox 「Error in input stream」). 호스트는 실행을 계속 들고 있다.
        dropError = error;
      }
      decoder.push(text.decode());
      decoder.flush();
      // 끝까지 받았거나, 우리가 끊었거나, 이어 받을 수 없는 호스트면 멈춘다.
      if (done || stopped || !resumable || options.signal?.aborted) break;
      // 오류 없이 닫혔으면 호스트가 실행을 끝낸 것이다(done 없이 error 줄로 끝난 실행 포함) — 이어 받을 것이 없다.
      // 실측(2026-09-27): 팀 실행이 OAuth 만료 error 로 끝났는데 끊김으로 보고 이어 받기를 네 번 돌았다.
      if (!dropError) break;
      if (++failures > resumeAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(15_000, resumeBase * 2 ** (failures - 1))));
      if (options.signal?.aborted || stopped) break;
      options.onEvent?.({ type: "execution_status", name: "stream.resume", summary: "연결이 끊겨 이어 받는 중", ok: true, data: { after: lastSeq + 1, attempt: failures } });
      let resumed: Response;
      try {
        resumed = await doFetch(companionAuthUrl("/v1/agent/run", request.provider) + "&runId=" + encodeURIComponent(runId) + "&after=" + (lastSeq + 1), {
          method: "GET", headers: companionTokenHeaders(), ...(options.signal ? { signal: options.signal } : {}),
        });
      } catch (error) { dropError = error; continue; }
      // 404: 호스트가 실행을 잃었다(재시작·기록 만료) — 더 기다려도 오지 않는다.
      if (resumed.status === 404) { lastError = (await readError(resumed)).error ?? lastError; break; }
      if (!resumed.ok || !resumed.body) { dropError = new Error("이어 받기 " + resumed.status); continue; }
      reader = resumed.body.getReader();
      lastLineAt = Date.now();
      clearTimeout(watchdog);
      watchdog = setTimeout(onStale, staleMs);
    }
  } finally {
    clearTimeout(watchdog);
    options.signal?.removeEventListener("abort", onUserAbort);
  }
  // 사용자 중단: 예전과 같이 AbortError 로 끝낸다(호출자가 「중단」 경로로 보낸다). 호스트에는 onUserAbort 가 이미 알렸다.
  if (options.signal?.aborted && !done) throw Object.assign(new Error("Request was aborted"), { name: "AbortError" });
  await checkpoints;
  if (!done && dropError && !stale && !checkpointError) {
    throw new PiAgentClientError("AI 작업 연결이 끊겼고 다시 이어 받지 못했습니다: " + (dropError instanceof Error ? dropError.message : String(dropError)));
  }
  // 워치독이 먼저 끊었으면 그 뒤 ACK 실패(워커가 이미 대기를 거둔 409)는 결과일 뿐 — 원인을 보고한다.
  if (checkpointError && !stale) throw checkpointError;
  if (done?.interiorCompletion?.length) throw new PiAgentClientError(`실내 미완료: ${done.interiorCompletion.length}개 맵에 검사 문제가 남아 완료 처리하지 않았습니다. 실행 기록의 실내 검사 결과를 확인하세요.`);
  if (done) return done;
  if (stale) {
    throw new PiAgentClientError(`워커에서 ${Math.round((Date.now() - lastLineAt) / 1000)}초 동안 신호가 없어 연결을 끊었습니다. 워커가 응답하지 않습니다 — 다시 시도하고, 반복되면 개발 서버 콘솔의 [oh-my-pi-worker] 줄을 봐 주세요.`);
  }
  throw new PiAgentClientError(lastError ?? "Pi 에이전트가 결과를 돌려주지 않았습니다");
}

function slimForAck(project: Project, keys: readonly PiCheckpointHeavyKey[], tilesetIds: readonly string[]): Project {
  const slim = slimCheckpointProject(project, keys);
  if (!tilesetIds.length || keys.includes("tilesets")) return slim;
  const skip = new Set(tilesetIds);
  return { ...slim, tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => !skip.has(id))) as Project["tilesets"] };
}

function restoreDone(done: PiAgentDoneEvent, requestProject: PiAgentRequest["project"]): PiAgentDoneEvent {
  const { unchangedKeys, ...rest } = done;
  const { unchangedTilesetIds, ...body } = rest;
  return { ...body, project: restoreCheckpointProject(requestProject, done.project, unchangedKeys, unchangedTilesetIds) };
}


