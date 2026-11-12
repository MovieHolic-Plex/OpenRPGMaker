// 이 요청의 묶음 밖 v2 도구를 턴 중간에 싣는다 — 동사 결과·관문 글이 이름으로 이른 도구를 모델이 부를 수 있어야 한다.
// 2026-11-12 Haiku 깔기 24(harbor · village-chief-house): 장소만 까는 요청에는 create_transfer_pair 가 없는데 make_place 결과와 관문이 그 도구를 일렀다 —
// 모델이 이름으로 부르자 «there is no tool named» 가 돌아왔고, 방을 마을과 잇지 못한 채 할 일 다섯이 막혔다.
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { englishToolCopy } from "../tools/toolExposure";
import type { TurnContext } from "./context";

export function turnLateTools(turn: Pick<TurnContext, "session" | "state" | "toolNames" | "writeRequest">) {
  const { session, state, toolNames, writeRequest } = turn;
  /** 필요할 때 싣는 표에 있으면 그 사본, 없으면(쓰기 요청만) v2 도구 묶음에서 같은 감싸개로 하나 지어 표에 올린다. 처음부터 실린 도구·v2 에 없는 이름은 undefined. */
  const lateTool = (name: string): PiToolShape | undefined => {
    const exposure = state.exposure;
    if (!exposure) return undefined;
    const have = exposure.lazy.get(name);
    if (have || !writeRequest || exposure.tools.some((t) => t.name === name)) return have;
    const made = session.repairTool?.(name);
    if (!made || !session.loop.wrapLate) return undefined;
    const tool = englishToolCopy(session.loop.wrapLate(made), false);
    toolNames.add(name);
    exposure.lazy.set(name, tool);
    return tool;
  };
  return { lateTool };
}
