// 시작 자리·말 걸 대상이 지붕·나무 머리 밑(주인공 위로 그려지는 윗층 그림)에 있으면 트인 칸으로(underRoof.ts; 2026-10-31 jb2a terra jrpg
// 시작 칸이 집 지붕 한가운데라 주인공이 가려진 채 시작, 지붕 뒤 첫 단계를 23분 뒤에야 찾음). 사람·단계 자리를 고치는 단계들 뒤, 목표 길 잇기 앞.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { stepOutFromUnderRoofs } from "../../underRoof";

export const stage: FinishStage = {
  id: "out-from-under-roofs", phase: "assembly", order: 245,
  run({ env, done }) {
    try { const notes = stepOutFromUnderRoofs(createBuildRun(env.ctx)); if (notes.length) done.push(`지붕 밑에서 꺼냄: ${notes.join(" / ").slice(0, 300)}`); }
    catch { /* 자리 옮기기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
