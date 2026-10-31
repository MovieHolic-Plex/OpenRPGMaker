// 싸워 이기는 단계는 이기면 끝난다 — 보스 승리 갈래 끝에서 그 단계 이벤트를 부른다(finishStepOnBossVictoryIn). 단계 순서 보호 뒤에.
import type { FinishStage } from "../types";
import { finishStepOnBossVictoryIn } from "../../blueprintPath";

export const stage: FinishStage = {
  id: "boss-win-finishes-step", phase: "assembly", order: 195,
  run({ env, assembled }) {
    try { assembled.push(...finishStepOnBossVictoryIn(env.ctx.project)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `보스 승리 뒤 단계 잇기를 하지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
