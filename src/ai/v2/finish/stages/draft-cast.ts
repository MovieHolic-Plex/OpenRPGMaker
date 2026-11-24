// 첫 판 초안 데이터(2026-11-24 ideal-flow-draft): 세계관·주인공·동료·직업·대표 기술·이 게임 물건·적 — story/draftCast.ts.
// 출하 기본값(130) 앞에 돈다: 주인공 이름을 청사진 cast 로 먼저 정해야 기본 이름 채우기가 다른 이름을 붙이지 않는다.
import type { FinishStage } from "../types";
import { applyDraftCast } from "../../story/draftCast";

export const stage: FinishStage = {
  id: "draft-cast", phase: "assembly", order: 128,
  run({ env, assembled }) {
    try { assembled.push(...applyDraftCast(env.ctx.project, String(env.request.task ?? ""))); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `초안 데이터를 채우지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
