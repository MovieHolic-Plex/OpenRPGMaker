// 방탈출이면 청사진 장소 밖으로 조건 없이 나가는 이동을 치운다(빈 맵이 아닌 바깥 맵 — retireBlankStart 가 못 치운다). 틈은 아래 출구 마감이 메운다.
import type { LaneStage } from "../types";
import { sealEscapeExits } from "../../blueprintPath";

export const stage: LaneStage = {
  id: "seal-escape-exits", scope: "project", order: 20,
  run({ notes, run }) {
    notes.push(...sealEscapeExits(run));
  },
};
