// 추리 청사진이 투명 칸 일직선이면(2026-10-29 vm mystery 판정 「NPC 없음·추리·선택 없음」) 용의자·증거 제시·범인 고르기를 세운다.
// 모델이 사건을 이미 지었으면 단서 칸 소품만 본다(mysteryCase.ts). 경로를 다시 짓지 않은 판(막힘 없음)도 여기서 세운다.
import type { LaneStage } from "../types";
import { stageMysteryCase } from "../../mysteryCase";

export const stage: LaneStage = {
  id: "mystery-case", scope: "project", order: 30,
  run({ notes, run }) {
    try { notes.push(...stageMysteryCase(run)); } catch { /* 추리 세우기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
