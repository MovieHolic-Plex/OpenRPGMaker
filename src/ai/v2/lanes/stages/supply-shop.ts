// 전투 게임 보급(2026-10-29 vm3 jrpg 판정 「206G 를 쓸 곳이 없다」): 돈을 버는데 상점이 없으면 떠돌이 상인. 경로를 다시 짓지 않은 판도 여기서 건다.
// 보스 앞 회복(쉼터 결정)·단계 순서 보호는 끝맺음 단계 boss-rest·order-step-battles 가 한다.
import type { LaneStage } from "../types";
import { ensureSupplyShop } from "../../healingAccess";

export const stage: LaneStage = {
  id: "supply-shop", scope: "project", order: 40,
  run({ notes, run }) {
    try { notes.push(...ensureSupplyShop(run)); } catch { /* 상점 실패는 끝맺음을 깨지 않는다 */ }
  },
};
