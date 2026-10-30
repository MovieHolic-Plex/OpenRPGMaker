// 보스 앞 쉼터 — 깎인 HP·독으로 보스 앞에 서지 않게(2026-10-29 vm3 flash jrpg 리치). 던전 빌더도 같은 함수를 부른다.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { ensureBossRest } from "../../healingAccess";

export const stage: FinishStage = {
  id: "boss-rest", phase: "assembly", order: 160,
  run({ env, assembled }) {
    try { assembled.push(...ensureBossRest(createBuildRun(env.ctx))); }
    catch { /* 쉼터 넣기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
