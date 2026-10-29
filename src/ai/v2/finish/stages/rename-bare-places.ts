// 빈 맵 청사진 장소 → 지을 장소 이름.
import type { FinishStage } from "../types";
import { renameBareBlueprintPlaces } from "../../blankStart";

export const stage: FinishStage = {
  id: "rename-bare-places", phase: "blueprint", order: 10,
  run({ env, session, done }) {
    // 청사진 장소가 잔디 한 장뿐인 빈 맵이면 장소 이름을 요청의 장소 낱말로 바꿔 아래 장소 짓기가 실제 방을 짓게 한다(blankStart.renameBareBlueprintPlaces).
    if (session.buildPlaces && !session.autoPlacesDone) {
      const bare = renameBareBlueprintPlaces(env.ctx.project);
      if (bare.renamed.size) {
        env.ctx.project = bare.project;
        session.barePlaces = bare.renamed;
        done.push(`빈 맵 장소: 청사진 장소 「빈 맵」을 ${[...bare.renamed.keys()].map((n) => `「${n}」`).join("·")}(으)로 지을 장소로 바꿈`);
      }
    }
  },
};
