// 청사진 기본 오프닝(맵 화면 장면 + 청사진 문장 내레이션) — 모델이 만든 오프닝은 그대로 둔다. 실패해도 마감은 계속한다.
// autoBuild 안이라 늦게 쓴 청사진(v2.blueprint.late)에서도 장소·경로·출구를 지은 뒤 돈다.
import type { FinishStage } from "../types";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";

export const stage: FinishStage = {
  id: "blueprint-opening", phase: "assembly", order: 110,
  run({ env, assembled }) {
    try { assembled.push(...applyBlueprintOpening(env.ctx.project)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `기본 오프닝을 깔지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
