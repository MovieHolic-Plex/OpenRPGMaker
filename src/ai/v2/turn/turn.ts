// 한 턴의 정책을 조립한다 — 문맥(context.ts) 위에 이벤트 모으기·화면 검수·기계 확인·재주입·자동 짓기·모델 갈고리·판정자 차례·최종 보고를 얹는다.
// 실행기(scripts/lib/assistantV2Runtime.ts)는 이것을 runPiAgent 에 끼우기만 한다. 2026-11-11 리팩토링 R3.
import type { PiAgentRequest } from "../../piAgent/protocol";
import type { PiAssistantV2Hooks } from "../shared/env";
import { unknownToolText } from "../tools/toolExposure";
import { turnAfterMain } from "./afterMain";
import { turnAutoBuild } from "./autoBuild";
import { createTurnContext, type TurnIo, type TurnOptions } from "./context";
import { turnEvents } from "./events";
import { turnFinish } from "./finishTurn";
import { turnLateTools } from "./lateTools";
import { turnModelHooks } from "./modelHooks";
import { turnRecheck } from "./recheck";
import { turnReinject } from "./reinject";
import { turnVqa } from "./vqaRound";

/** store = 이 턴의 할 일 목록(시스템 지시가 읽는다) · onEvent = 실행기 이벤트 모으개 · hooks = runPiAgent 의 v2 갈고리 · finishTurn = 실행이 끝난 뒤 최종 보고. */
export function createV2Turn(request: PiAgentRequest, options: TurnOptions, io: TurnIo) {
  const turn = createTurnContext(request, options, io);
  const { store, state } = turn;
  const { onEvent } = turnEvents(turn);
  const { vqaStep } = turnVqa(turn);
  const { refreshChecks, stamp } = turnRecheck(turn);
  const { reinject, newBatch } = turnReinject(turn);
  const { autoBuild, lateBuildPending } = turnAutoBuild(turn);
  const { lateTool } = turnLateTools(turn);
  const { tools, stateCard, firstPromptSuffix, beforeFirstPrompt, keepToolsOn } = turnModelHooks(turn);
  const { afterMain } = turnAfterMain({ ...turn, vqaStep, refreshChecks, stamp, reinject, newBatch, autoBuild, lateBuildPending, lateTool });
  const { finishTurn } = turnFinish({ ...turn, refreshChecks, stamp });
  const hooks: PiAssistantV2Hooks = {
    tools,
    // 이름으로 바로 부른 호출도 같은 길로 — 묶음 밖 v2 도구는 그 자리에서 지어 싣는다(lateTools.ts).
    lazyTool: lateTool,
    // load_tools 가 목록에 없는 요청(장소만 까는 요청)에는 그 도구를 권하지 않는다 — 관문이 도구를 실은 뒤 «load_tools 로 실어라» 가 나가 모델이 없는 도구를 불렀다(2026-11-12 Haiku prison·mine).
    unknownToolText: (name) => unknownToolText(name, state.exposure?.tools.some((t) => t.name === "load_tools") ? state.exposure.lazy : new Map()),
    stateCard,
    firstPromptSuffix,
    beforeFirstPrompt,
    // 할 일 고리는 스스로 멈춘다(묶음당 8·진척 없음 2·서명 같음·ask_user). 이 수는 안전 상한일 뿐이다.
    maxRounds: 64,
    keepToolsOn,
    afterMain,
  };
  return { store, onEvent, hooks, finishTurn };
}
