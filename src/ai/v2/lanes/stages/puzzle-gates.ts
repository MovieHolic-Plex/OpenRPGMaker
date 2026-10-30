// 퍼즐 문(스위치로 여는 같은 맵 통로): 두 갈래 통로 선택지를 보는 쪽 건너편 이동으로 바꾸고, 여는 장치에 문 바깥에서 닿지 못하면 적는다.
// 왜·규칙은 puzzleGates.ts 머리글(2026-10-30 씬 벤치 terra gym-leader 「새싹 돌 받침」·「위(관장 쪽)로/아래로」).
import { mapLabel, type LaneStage } from "../types";
import { checkPuzzleGates } from "../../puzzleGates";

export const stage: LaneStage = {
  id: "puzzle-gates", scope: "map", order: 154,
  run(ctx, mapId) {
    for (const n of checkPuzzleGates(ctx.run, mapId)) ctx.notes.push(`${mapLabel(ctx.env, mapId)}: ${n}`);
  },
};
