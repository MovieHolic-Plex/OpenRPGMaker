// 단계 순서 보호(orderStepBattlesIn).
import type { FinishStage } from "../types";
import { orderStepBattlesIn } from "../../blueprintPath";

export const stage: FinishStage = {
  id: "order-step-battles", phase: "assembly", order: 190,
  run({ env, assembled }) {
    try { assembled.push(...orderStepBattlesIn(env.ctx.project)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `단계 순서 보호를 하지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
