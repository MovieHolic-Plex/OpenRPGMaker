// 싸우는 상대·전투 맵을 그 장소와 맞춘다 — 적 그림은 현행 세트(story/currentFoes) · 서 있는 그림 = 전투 그림 · 이긴 몬스터는 맵에서 걷힘 · 전투 배경은 장소 테마 · 테마 밖 적과 쓸 곳 없는 상자 보상은 다시 놓는다.
// 길 위 전투 맞추기(path-battles) 앞에 돈다 — 다시 놓은 적도 예산에 맞춰진다. 경로를 다시 짓지 않는 «계속» 턴이 옛 판을 고치는 자리다.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../shared/buildRun";
import { restockOffThemePlaces } from "../../place/worldPopulate";
import { redrawStepFoesIn, settleStepFoesIn, themeBattleBackdropsIn } from "../../story/stepFoes";
import { settleCurrentArtIn } from "../../story/currentFoes";
import { artGapLine } from "@/project/artGap";
import { preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";

export const stage: FinishStage = {
  id: "step-foes", phase: "assembly", order: 135,
  async run({ env, session, assembled }) {
    await preloadCurrentMonsterArt().catch(() => undefined);
    try {
      const redrawn = redrawStepFoesIn(env.ctx.project);
      assembled.push(...redrawn.notes);
      for (const gap of redrawn.gaps) session.missingArt.add(gap);
      assembled.push(...settleStepFoesIn(env.ctx.project));
      const run = createBuildRun(env.ctx);
      assembled.push(...restockOffThemePlaces(run, (gap) => session.missingArt.add(gap)));
      // 맵에서 싸우는 적마다 현행 그림을 넣고 옛 걷기 칩을 전투 그림으로 — 현행 그림이 없는 종은 없는 그림 줄(그릴 목록)로 남긴다.
      const art = settleCurrentArtIn(env.ctx.project);
      assembled.push(...art.notes);
      for (const m of art.missing) session.missingArt.add(artGapLine({ want: "foe", wanted: m.wanted, where: m.where, standIn: `${m.name} (old-set picture)`, by: "step-foes" }));
      const backdrops = themeBattleBackdropsIn(env.ctx.project);
      assembled.push(...backdrops.notes);
      for (const gap of backdrops.gaps) session.missingArt.add(gap);
    } catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `싸우는 상대·전투 맵을 장소에 맞추지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
