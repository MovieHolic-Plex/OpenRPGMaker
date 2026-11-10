// 실행기 이벤트를 옆에서 모은다 — 검토자의 재료(도구 기록)와 마지막 보고 초안. 제공자 오류 문장은 보고로 받지 않는다. 2026-11-11 리팩토링 R3: runAssistantV2 에서 옮겼다.
import type { PiAgentEvent } from "../../piAgent/protocol";
import { assembledReport, isProviderErrorReply } from "../judge/finalReport";
import type { TurnContext } from "./context";

/** onEvent = 실행기가 내는 이벤트를 받아 도구 기록·보고 초안을 적고 사용자 화면으로 흘려보낸다. */
export function turnEvents(turn: TurnContext) {
  const { request, options, state, calls, argsById } = turn;
  const onEvent = (event: PiAgentEvent) => {
    if (event.type === "tool_start") argsById.set(event.id, event.args);
    else if (event.type === "tool_end") { calls.push({ name: event.name, ok: event.ok, args: argsById.get(event.id), summary: event.summary }); argsById.delete(event.id); }
    else if (event.type === "assistant") {
      // 제공자 일반 오류 문장(«Sorry, something went wrong» 등)은 보고가 아니다 — 대화창에 보내지 않는다. 그러면 앞의 정직한 보고가 마지막 답으로 남는다.
      // 앞에 보고가 하나도 없으면 실제 프로젝트 상태로 조립한 보고를 대신 보낸다(2026-10-28 mt3 flash·mt2 argon escape).
      if (isProviderErrorReply(event.text)) {
        options.onEvent?.({ type: "execution_status", name: "v2.answer.provider_error", ok: false, at: Date.now(), summary: `모델이 보고 대신 제공자 오류 문장을 돌려줌 — 최종 답으로 쓰지 않음: ${JSON.stringify(event.text.trim().slice(0, 120))}` });
        if (!state.draft) { state.draft = assembledReport(lastProject()); options.onEvent?.({ type: "assistant", text: state.draft }); }
        return;
      }
      state.draft = event.text;
    }
    options.onEvent?.(event);
  };
  const lastProject = () => state.liveEnv?.ctx.project ?? request.project;
  return { onEvent };
}
