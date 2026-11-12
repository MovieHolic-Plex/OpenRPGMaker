// 청사진 없는 장소 턴(«마을 하나 깔아 줘»)의 맵 마감 — 이번 턴에 장소 도구가 지은 맵에 출구·이동 칸 마감의 맵 단계를 돈다(finish/lanes/index.ts 가 범위를 본다).
// 왜(2026-11-11 map-vqa 깔기 village): 마을 한 장만 깐 턴은 청사진이 없어 마감이 한 번도 돌지 않았다 — 집 문 여섯이 모두 조사 키에 답이 없었다
// («여기로는 들어갈 수 없다» 한 줄은 맵 단계 locked-house-doors 가 세운다). 게임 전체 판은 blueprint 묶음의 lanes 단계가 그대로 돈다.
import type { FinishStage } from "../types";
import { lanesStamp } from "../lanesStamp";

export const stage: FinishStage = {
  id: "place-lanes", phase: "place", order: 10,
  async run({ env, session, done }) {
    if (env.ctx.project.gameBlueprint || !session.clearLanes || session.autoLanesDone) return;
    // 이번 턴에 지은 맵이 남아 있을 때만(다시 지어 사라진 id 는 세지 않는다).
    if (![...session.places.keys()].some((mapId) => env.ctx.project.maps[mapId])) return;
    session.autoLanesDone = true;
    const lanes = await session.clearLanes();
    session.lanesStamp = lanesStamp(env.ctx.project);
    if (!lanes.length) return;
    env.emit({ type: "execution_status", name: "v2.place.auto_lanes", ok: true, summary: `지은 장소의 출구·문 마감 — ${lanes.join(" / ").slice(0, 300)}` });
    done.push(`지은 장소의 출구·문 마감: ${lanes.join(" / ").slice(0, 500)}`);
  },
};
