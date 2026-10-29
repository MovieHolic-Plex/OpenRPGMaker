// 영문 id 맵 이름(「dungeon_cave」)을 뜻 낱말로 — 아래 목표 꼬리·런타임 출구 라벨이 그 이름을 그대로 보여 준다(2026-10-29 vm4 flash jrpg).
import type { FinishStage } from "../types";
import { humanizeMapNames } from "../../mapNames";

export const stage: FinishStage = {
  id: "humanize-map-names", phase: "assembly", order: 200,
  run({ env, assembled }) {
    try { const renamed = humanizeMapNames(env.ctx.project); if (renamed.length) assembled.push(`맵 이름 ${renamed.join(" · ")}`); }
    catch { /* 이름 바꾸기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
