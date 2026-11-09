// 출하 기본값(2026-10-29 vm1): 전투 곡·전투 배경·파티 모습/얼굴·엔딩 맺음·기본 지명 — 출하 검사가 «기본값이 남았다»고 짚는 것만 채운다.
import type { FinishStage } from "../types";
import { applyShipDefaults } from "../../shipDefaults";
import { FIT_INCOMPLETE_PREFIX } from "../../monsterRouteLevels";

export const stage: FinishStage = {
  id: "ship-defaults", phase: "assembly", order: 130,
  run({ env, session, assembled }) {
    try {
      const applied = applyShipDefaults(env.ctx.project, env.request.task);
      assembled.push(...applied);
      // 예산을 넘긴 맞춤은 «기록하고 완료는 허용» — 모델이 풀 수 없고 같은 입력이면 같은 곳에서 또 멈춘다. 최종 보고가 이 줄을 읽는다.
      const cut = applied.find((line) => line.startsWith(FIT_INCOMPLETE_PREFIX));
      if (cut) { session.fitIncomplete = cut; env.emit({ type: "execution_status", name: "v2.fit.incomplete", ok: false, summary: cut.slice(0, 300) }); }
    }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `출하 기본값을 채우지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
