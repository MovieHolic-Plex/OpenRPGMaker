// 조수 v2 실행기 — v1 의 runPiAgent 를 그대로 쓰되(체크포인트·실시간 시공·맵 소유권·사용량·로컬 CLI), 도구를 v2 동사로,
// 시스템 지시를 v2 카드로 바꾼다. v1 레지스트리 도구는 하나도 노출하지 않는다(options.toolNames 가 아무것도 고르지 않는다).
// 켜는 곳: 편집기 ?assistant=v2 또는 localStorage oprn:assistant-v2=1 → 요청 assistantVersion:"v2" → 워커가 여기로 보낸다.
import { runPiAgent, type RunPiAgentOptions } from "./piAgentRuntime.ts";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { buildV2SystemPrompt } from "../../src/ai/v2/prompt.ts";
import { createV2Tools, V2Session, v2FinishGate } from "../../src/ai/v2/verbs.ts";
import type { PiAssistantV2Env } from "../../src/ai/v2/env.ts";
import { adviseTurn, advisorFollowUp, advisorSummary, compactToolLog, summarizeProjectDiff, type AdvisorToolCall, type AdvisorVerdict } from "../../src/ai/v2/advisor.ts";

/** 독립 검토자(src/ai/v2/advisor.ts). 끄려면 OPRN_V2_ADVISOR=0 — 비교 실행·장애 때만 쓴다. 읽기 전용 실행에는 돌지 않는다. */
// 설정에서 검토자를 끈 경우(assistantRoles.advisor = "off")도 돌지 않는다. 검토자 모델은 env.advisorChat(따로 고른 칸) → 없으면 주 모델(sideChat).
const advisorEnabled = (request: PiAgentRequest): boolean => process.env.OPRN_V2_ADVISOR !== "0" && !request.readOnly && request.assistantRoles?.advisor !== "off";
const advisorChatOf = (env: PiAssistantV2Env) => env.advisorChat ?? env.sideChat;
const safeDiff = (env: PiAssistantV2Env): string => {
  try { return summarizeProjectDiff(env.request.project, env.ctx.project); } catch (error) { return `(변경 요약 실패: ${error instanceof Error ? error.message : String(error)})`; }
};

export async function runAssistantV2(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const session = new V2Session();
  const started = Date.now();
  // 검토자의 재료: 이 실행의 도구 기록과 마지막 보고 초안. 사용자 화면으로 가는 이벤트를 그대로 흘려보내며 옆에서 모은다.
  const calls: AdvisorToolCall[] = [];
  const argsById = new Map<string, unknown>();
  let draft = "";
  const onEvent = (event: PiAgentEvent) => {
    if (event.type === "tool_start") argsById.set(event.id, event.args);
    else if (event.type === "tool_end") { calls.push({ name: event.name, ok: event.ok, args: argsById.get(event.id), summary: event.summary }); argsById.delete(event.id); }
    else if (event.type === "assistant" && event.text.trim()) draft = event.text;
    options.onEvent?.(event);
  };
  let advice: AdvisorVerdict | undefined;
  // 검토자가 더한 시간: 검토 호출(advice.ms) + 검토자 글로 한 차례 더 돈 시간(followMs, 막음이 있을 때만).
  let followFrom = 0, followMs = 0;
  const done = await runPiAgent({
    ...request,
    systemPrompt: buildV2SystemPrompt(request.project, request.currentMapId, request.task),
    initialToolNames: [],
    openingProduction: false,
  }, {
    ...options,
    onEvent,
    // 존재하지 않는 이름 하나 — 레지스트리 도구를 하나도 고르지 않고, 이름 지정 실행이라 v1 확인표·작가 도구도 꺼진다.
    toolNames: ["__assistant_v2__"],
    v2: {
      tools: (env) => createV2Tools(env, session),
      afterMain: async (env, round) => {
        // round 1 = 끝맺음 관문/검토자 글로 한 차례 더 돈 뒤. 새 최종 보고를 다시 대어 보고, 남은 막음은 이번에는 돌리지 않고 기록만 한다
        // (두 번째 후속은 없다 — 관문 글도 다시 내지 않는다. 같은 실행에서 같은 글로 두 번 돌리면 실측상 같은 보고만 반복한다).
        if (round > 0) {
          if (followFrom) followMs = Date.now() - followFrom;
          if (!advisorEnabled(env.request) || !advice) return undefined;
          const recheck = await adviseTurn({ task: env.request.task, toolLog: compactToolLog(calls), diff: safeDiff(env), report: draft }, advisorChatOf(env), env.signal);
          advice = { ...recheck, ms: advice.ms + recheck.ms, inputChars: advice.inputChars + recheck.inputChars };
          env.emit({ type: "execution_status", name: "v2.advisor.recheck", ok: !recheck.notes.some((n) => n.level === "blocker"), summary: `다시 검토 — ${advisorSummary(recheck)}`, data: recheck });
          return undefined;
        }
        const gate = v2FinishGate(session, env);
        if (!advisorEnabled(env.request)) return gate;
        // 보고 초안을 «실제로 바뀐 것»에 대어 본다. 막는 메모는 끝맺음 관문 글과 함께 한 차례 더 돌린다.
        // 우려·참고는 조수에게만(관문 글에 붙거나 실행 기록 v2.advisor) — 사용자 대화창에는 싣지 않는다.
        advice = await adviseTurn({ task: env.request.task, toolLog: compactToolLog(calls), diff: safeDiff(env), report: draft }, advisorChatOf(env), env.signal);
        env.emit({ type: "execution_status", name: "v2.advisor", ok: !advice.notes.some((n) => n.level === "blocker"), summary: `${advisorSummary(advice)} · ${env.advisorModel ?? "주 모델"}`, data: { ...advice, model: env.advisorModel ?? "main" } });
        const blockerText = advisorFollowUp(advice);
        const softNotes = advice.notes.filter((n) => n.level !== "blocker");
        if (blockerText) { followFrom = Date.now(); return gate ? `${gate}\n\n${blockerText}` : blockerText; }
        if (gate && softNotes.length) return `${gate}\n\n[독립 검토자 참고 — 막지는 않음]\n${softNotes.map((n) => `- [${n.level}] ${n.what}`).join("\n")}`;
        return gate;
      },
    },
  });
  options.onEvent?.({ type: "execution_status", name: "v2.summary", ok: done.ok, at: Date.now(), summary: `v2 요약: 장소 ${new Set([...session.places.values()]).size}·사람/사건 ${session.content.length}·비평 ${session.criticCalls}회(${Math.round(session.criticMs / 1000)}초)·남은 문제 ${session.unresolved().length}·그림 없음 ${session.missingArt.size}${advice ? `·검토 ${advice.notes.filter((n) => n.level === "blocker").length}막음(${(advice.ms / 1000).toFixed(1)}초${followMs ? `+후속 ${Math.round(followMs / 1000)}초` : ""})` : ""} · 전체 ${Math.round((Date.now() - started) / 1000)}초`,
    data: { places: [...session.places.keys()], unresolved: session.unresolved(), missingArt: [...session.missingArt], criticCalls: session.criticCalls, criticMs: session.criticMs, ...(advice ? { advisor: { blockers: advice.notes.filter((n) => n.level === "blocker").length, notes: advice.notes.length, ms: advice.ms, followMs, inputChars: advice.inputChars } } : {}) } });
  return done;
}
