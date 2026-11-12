// 대사의 화자 흉상 — 출하 기본값(주인공 칩이 정해진다) 뒤에 게임 전체의 대사를 한 번 훑는다. 함수가 대신 지은 경로·옛 판·주인공 줄이 여기서 맞춰진다.
import type { FinishStage } from "../types";
import { settleSpeakerBustsIn } from "../../story/speakerBust";

export const stage: FinishStage = {
  id: "speaker-busts", phase: "assembly", order: 310,
  run({ env, assembled }) {
    try { assembled.push(...settleSpeakerBustsIn(env.ctx.project)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `대사에 화자 흉상을 걸지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
