// 끝맺음 자동 짓기를 부르고, 그 마감만 건드린 기존 이벤트를 적어 둔다(관문이 기존 결함을 가를 때 쓴다). 2026-11-11 리팩토링 R3: runAssistantV2 에서 옮겼다.
import { finishBuildPending, runFinishAutoBuild } from "../finishAutoBuild";
import type { PiAssistantV2Env } from "../env";
import { indexProject } from "../loop/refs";
import type { TurnContext } from "./context";

/** autoBuild = ③ 끝맺음 자동 짓기 · lateBuildPending = 끝맺음 뒤에 지을 청사진이 남았나. */
export function turnAutoBuild(turn: TurnContext) {
  const { session, store, autoTouched } = turn;
  const autoBuild = async (env: PiAssistantV2Env): Promise<string | undefined> => {
    let pre; try { pre = indexProject(env.ctx.project); } catch { pre = undefined; }
    const note = await runFinishAutoBuild(env, session);
    try {
      const post = indexProject(env.ctx.project);
      if (pre && store.baseline) for (const [k, fp] of post.events) if (store.baseline.events.get(k) === pre.events.get(k) && pre.events.has(k) && pre.events.get(k) !== fp) autoTouched.set(k, fp);
    } catch { /* 기록 실패는 분류만 덜 정확해진다 */ }
    return note;
  };
  const lateBuildPending = (env: PiAssistantV2Env) => finishBuildPending(env, session);
  return { autoBuild, lateBuildPending };
}
