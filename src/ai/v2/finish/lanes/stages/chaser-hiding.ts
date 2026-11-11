// 추격자가 있는데 숨을 곳이 0곳인 맵(2026-10-29 standin horror 「폐병원」) — 맵에 있는 옷장·사물함·침대·커튼 1~2곳을 순찰 길 가까이에서 은신처로.
// 다른 물건을 대신 고르지 않는다. 칩셋에 그런 가구 그림이 아예 없으면 없는 그림으로 적고(project/artGap), 그림은 있는데 이 맵에 놓이지 않았으면 적지 않는다 — 출하 검사(chaserMapsWithoutHiding)가 조수에게 돌려준다.
import type { FinishStage } from "../../types";
import type { Project } from "@/project/types";
import { recordArtGaps } from "@/project/artGap";
import { chaserEvents, ensureChaserHidingSpots, mapHidingEvents, markHidingSpots, tilesetHasHidingFurniture } from "@/project/chaserHiding";

export const stage: FinishStage = {
  id: "chaser-hiding", phase: "lane-project", order: 80,
  run({ env, session, notes }) {
    for (const [mapId, map0] of Object.entries(env.ctx.project.maps)) {
      if (!chaserEvents(map0).length) continue;
      if (mapHidingEvents(map0).some((ev) => (ev.pages ?? []).some((pg) => (pg.interaction as { kind?: string } | undefined)?.kind === "hiding" && !pg.nearSparkle))) {
        // 이미 있는 은신처에 가까이 반짝임을 단다(들어가기 전엔 안 보였다).
        const marked = { ...map0, events: (map0.events ?? []).map((ev) => structuredClone(ev)) };
        const n = markHidingSpots(marked);
        env.ctx.project = { ...env.ctx.project, maps: { ...env.ctx.project.maps, [mapId]: marked } } as Project;
        notes.push(`${map0.name}: 은신처 ${n}곳에 가까이 반짝임`);
        continue;
      }
      if (mapHidingEvents(map0).length) continue;
      const copy = { ...map0, events: [...(map0.events ?? [])] };
      const auto = ensureChaserHidingSpots(env.ctx.project, copy);
      if (auto.placed.length) {
        env.ctx.project = { ...env.ctx.project, maps: { ...env.ctx.project.maps, [mapId]: copy } } as Project;
        notes.push(`${map0.name}: 추격자 은신처 ${auto.placed.map((p) => `${p.label}(${p.x},${p.y})`).join(" · ")}`);
      } else if (auto.note) {
        notes.push(`${auto.note} — 은신처 0곳`);
        if (tilesetHasHidingFurniture(env.ctx.project, map0.tilesetId)) continue;
        const chaser = chaserEvents(map0)[0]!;
        recordArtGaps(session, [{ chipset: map0.tilesetId, want: "hiding-furniture", wanted: "숨을 가구", where: `${map0.name} ${chaser.x},${chaser.y}`, standIn: "none", by: "chaser-hiding", note: "추격자에게서 숨을 옷장·사물함·침대·커튼" }]);
      }
    }
  },
};
