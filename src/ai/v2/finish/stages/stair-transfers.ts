// 계단 그림 한 칸에만 남은 층 이동을 계단 폭 전체로(출하 exit-hidden) — 끝맺음이 이동 칸을 그림 칸으로 옮긴 뒤에는 도구의 넓히기가 다시 돌지 않았다
// (2026-10-29 vm3 argon 추리 재생: 여관 2층 2칸 계단 (12,6)에만 이동, (11,7)에서 위로 걸어도 아무 일 없음).
import type { FinishStage } from "../types";
import { fitStairTransfers, hiddenStairExits } from "@/project/stairs/fit";

export const stage: FinishStage = {
  id: "stair-transfers", phase: "assembly", order: 260,
  run({ env, assembled }) {
    try {
      const names = new Set(hiddenStairExits(env.ctx.project).map((line) => line.split(":")[0]!));
      const ids = Object.values(env.ctx.project.maps).filter((m) => names.has(m.name ?? m.id)).map((m) => m.id);
      if (ids.length) assembled.push(...fitStairTransfers(env.ctx.project, ids));
    } catch { /* 계단 출구 넓히기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
