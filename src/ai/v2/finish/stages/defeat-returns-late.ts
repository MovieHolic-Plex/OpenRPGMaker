// 조립 뒤에 한 번 더 — 조립 단계가 다시 놓은 길 적(테마 밖 적 다시 놓기)·이번 판에 처음 정해진 기본 게임 오버도 «지면 그 장소 입구에서 다시» 를 받는다.
// 청사진 단계의 boss-defeat-returns 는 조립 앞에 돌아, 한 번만 도는 끝맺음에서는 그 적들이 게임 시작점으로 돌아갔다. 되풀이 안전.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../shared/buildRun";
import { bossDefeatReturns } from "../../story/bossTalkBattles";

export const stage: FinishStage = {
  id: "defeat-returns-late", phase: "assembly", order: 165,
  run({ env, assembled }) {
    try { const notes = bossDefeatReturns(createBuildRun(env.ctx)); if (notes.length) assembled.push(`패배 뒤 돌아올 자리: ${notes.join(" / ").slice(0, 400)}`); }
    catch { /* 돌아올 자리 실패는 끝맺음을 깨지 않는다 */ }
  },
};
