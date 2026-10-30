// 출하 기본값(2026-10-29 vm1): 전투 곡·전투 배경·파티 모습/얼굴·엔딩 맺음·기본 지명 — 출하 검사가 «기본값이 남았다»고 짚는 것만 채운다.
import type { FinishStage } from "../types";
import { applyShipDefaults } from "../../shipDefaults";

export const stage: FinishStage = {
  id: "ship-defaults", phase: "assembly", order: 130,
  run({ env, assembled }) {
    try { assembled.push(...applyShipDefaults(env.ctx.project, env.request.task)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `출하 기본값을 채우지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
