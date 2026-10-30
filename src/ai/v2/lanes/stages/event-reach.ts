// 걸어 닿지 못하는 진행 이벤트(전투·스위치·아이템·엔딩 — 출하 검사 critical-unreachable)는 닿는 빈 바닥으로(repairEventReach).
// 경로를 다시 짓지 않는 판(전투가 든 단계라 build_blueprint_path 가 건너뜀)에도 돈다 — 2026-10-29 vm4 argon jrpg: 동굴 잡몹 (6,9)가 바위 속에 갇혔다.
import type { LaneStage } from "../types";
import { repairEventReach, unreachableEvents } from "../../eventReach";

export const stage: LaneStage = {
  id: "event-reach", scope: "map", order: 150,
  run(ctx, mapId) {
    const { env, notes, run } = ctx;
    const live = env.ctx.project.maps[mapId];
    const progress = (ev: NonNullable<typeof live>["events"][number]) => {
      const text = JSON.stringify(ev.pages ?? []);
      const acts = (ev.pages ?? []).some((p) => { const t = p.trigger as unknown; const k = typeof t === "string" ? t : (t as { kind?: string } | undefined)?.kind; return k !== "auto" && k !== "autorun" && k !== "parallel"; });
      return acts && /"kind":"(?:battleProcessing|setSwitch|changeItem|triggerEnding)"/u.test(text) && !/"kind":"transfer"/u.test(text);
    };
    const lost = live ? unreachableEvents(env.ctx.project, mapId).filter((id) => { const ev = live.events.find((e) => e.id === id); return !!ev && progress(ev); }) : [];
    if (lost.length) {
      const fixed = repairEventReach(run, mapId, lost);
      for (const m of fixed.moved) notes.push(`${ctx.map.name}: 닿지 못하던 ${m}`);
    }
  },
};
