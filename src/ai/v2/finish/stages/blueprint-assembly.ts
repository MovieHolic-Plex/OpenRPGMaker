// 조립 기본값(2026-10-28): 청사진이 있는 게임 요청이면 아무도 고르지 않은 타이틀 그림·기본 문구·기본 왕국 오프닝을 청사진에 맞춘다 — 모델이 부르지 않아도.
// 장소 자동 짓기 뒤에 둔다(시작 맵이 생긴 뒤라야 그 맵 화면을 타이틀로 쓸 수 있다).
import type { FinishStage } from "../types";
import { applyBlueprintAssembly } from "@/project/blueprintAssembly";

export const stage: FinishStage = {
  id: "blueprint-assembly", phase: "assembly", order: 100,
  run({ env, assembled }) {
    assembled.push(...applyBlueprintAssembly(env.ctx.project));
  },
};
