// 「먼저 …」 안내가 붙은 뒤 — 그 앞의 「필요한 것이 있어야 할 것 같다」 같은 토큰 줄을 뺀다(vm4 argon 추리 재생).
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { dropTokenLines } from "../../stepSubjects";

export const stage: FinishStage = {
  id: "drop-token-lines", phase: "assembly", order: 230,
  run({ env, assembled }) {
    try { assembled.push(...dropTokenLines(createBuildRun(env.ctx))); }
    catch { /* 토큰 줄 정리 실패는 끝맺음을 깨지 않는다 */ }
  },
};
