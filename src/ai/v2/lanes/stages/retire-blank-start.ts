// 쓰지 않는 빈 시작 맵(잔디 한 장)을 먼저 치운다 — 그쪽으로 가던 이동이 사라진 막다른 틈은 아래 출구 마감이 문 그림으로 닫는다.
import type { LaneStage } from "../types";
import { retireBlankStart } from "../../blankStart";

export const stage: LaneStage = {
  id: "retire-blank-start", scope: "project", order: 10,
  run({ notes, run }) {
    notes.push(...retireBlankStart(run));
  },
};
