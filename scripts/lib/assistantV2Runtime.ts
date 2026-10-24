// 조수 v2 실행기 — v1 의 runPiAgent 를 그대로 쓰되(체크포인트·실시간 시공·맵 소유권·사용량·로컬 CLI), 도구를 v2 동사로,
// 시스템 지시를 v2 카드로 바꾼다. v1 레지스트리 도구는 하나도 노출하지 않는다(options.toolNames 가 아무것도 고르지 않는다).
// 켜는 곳: 편집기 ?assistant=v2 또는 localStorage oprn:assistant-v2=1 → 요청 assistantVersion:"v2" → 워커가 여기로 보낸다.
import { runPiAgent, type RunPiAgentOptions } from "./piAgentRuntime.ts";
import type { PiAgentDoneEvent, PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { buildV2SystemPrompt } from "../../src/ai/v2/prompt.ts";
import { createV2Tools, V2Session, v2FinishGate } from "../../src/ai/v2/verbs.ts";

export async function runAssistantV2(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const session = new V2Session();
  const started = Date.now();
  const done = await runPiAgent({
    ...request,
    systemPrompt: buildV2SystemPrompt(request.project, request.currentMapId, request.task),
    initialToolNames: [],
    openingProduction: false,
  }, {
    ...options,
    // 존재하지 않는 이름 하나 — 레지스트리 도구를 하나도 고르지 않고, 이름 지정 실행이라 v1 확인표·작가 도구도 꺼진다.
    toolNames: ["__assistant_v2__"],
    v2: {
      tools: (env) => createV2Tools(env, session),
      afterMain: (env) => v2FinishGate(session, env),
    },
  });
  options.onEvent?.({ type: "execution_status", name: "v2.summary", ok: done.ok, at: Date.now(), summary: `v2 요약: 장소 ${new Set([...session.places.values()]).size}·사람/사건 ${session.content.length}·비평 ${session.criticCalls}회(${Math.round(session.criticMs / 1000)}초)·남은 문제 ${session.unresolved().length}·그림 없음 ${session.missingArt.size} · 전체 ${Math.round((Date.now() - started) / 1000)}초`,
    data: { places: [...session.places.keys()], unresolved: session.unresolved(), missingArt: [...session.missingArt], criticCalls: session.criticCalls, criticMs: session.criticMs } });
  return done;
}
