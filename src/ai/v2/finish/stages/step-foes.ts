// 싸우는 상대·전투 맵을 그 장소와 맞춘다 — 서 있는 그림 = 전투 그림 · 이긴 몬스터는 맵에서 걷힘 · 전투 배경은 장소 테마 · 테마 밖 적과 쓸 곳 없는 상자 보상은 다시 놓는다.
// 길 위 전투 맞추기(path-battles) 앞에 돈다 — 다시 놓은 적도 예산에 맞춰진다. 경로를 다시 짓지 않는 «계속» 턴이 옛 판을 고치는 자리다.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../shared/buildRun";
import { restockOffThemePlaces } from "../../place/worldPopulate";
import { settleStepFoesIn, themeBattleBackdropsIn } from "../../story/stepFoes";

export const stage: FinishStage = {
  id: "step-foes", phase: "assembly", order: 135,
  run({ env, session, assembled }) {
    try {
      assembled.push(...settleStepFoesIn(env.ctx.project));
      const run = createBuildRun(env.ctx);
      assembled.push(...restockOffThemePlaces(run, (gap) => session.missingArt.add(gap)));
      const backdrops = themeBattleBackdropsIn(env.ctx.project);
      assembled.push(...backdrops.notes);
      for (const gap of backdrops.gaps) session.missingArt.add(gap);
    } catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `싸우는 상대·전투 맵을 장소에 맞추지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
