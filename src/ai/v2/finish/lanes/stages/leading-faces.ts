// 내레이션 줄에 인물 얼굴이 남지 않게(2026-10-29 standin 마법학교 천문탑: 「망원경 곁에 파란 모자의 여인이…」에 교수 흉상) —
// 맨 앞 얼굴 하나를 그 인물이 화자로 말하는 줄 바로 앞에만 다시 둔다. 모델이 patch_event_page 로 옛 순서를 되써도 여기서 고친다.
import type { LaneStage } from "../types";
import type { Project } from "@/project/types";
import { relocateLeadingFace } from "@/editor/tools/eventCompile";

export const stage: LaneStage = {
  id: "leading-faces", scope: "project", order: 90,
  run({ env, notes }) {
    for (const [mapId, map0] of Object.entries(env.ctx.project.maps)) {
      let fixed = 0;
      const events = (map0.events ?? []).map((ev) => {
        let changed = false;
        const pages = (ev.pages ?? []).map((page) => {
          const next = relocateLeadingFace(page.commands ?? [], ev.name ?? "");
          if (!next) return page;
          changed = true;
          return { ...page, commands: next };
        });
        if (changed) fixed += 1;
        return changed ? { ...ev, pages } : ev;
      });
      if (fixed) {
        env.ctx.project = { ...env.ctx.project, maps: { ...env.ctx.project.maps, [mapId]: { ...map0, events } } } as Project;
        notes.push(`${map0.name}: 인물 ${fixed}명의 얼굴을 그 인물 대사 바로 앞으로(내레이션 줄에서 뺌)`);
      }
    }
  },
};
