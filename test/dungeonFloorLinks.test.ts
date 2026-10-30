// 여러 층 던전 층 잇기(2026-10-30): 깊은 방(보스방)이 장식으로 차 내려가는 계단 자리가 없으면 계단을 말없이 빠뜨려
// 성 2층 시드 4·9·11 이 `links: []`·1층 `exitStair: null` 로 끊겼다. 이제 다른 칸·다른 방으로 물러나 늘 잇는다.
// 시드 1~40 전수는 `bun scripts/content/dungeon-floor-link-probe.mts castle,cave,tower 40`.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";

type FloorData = { exitStair: unknown; entryStair: unknown };

describe("여러 층 던전은 층마다 계단으로 이어진다", () => {
  for (const [floors, seed] of [[2, 4], [2, 9], [2, 11], [3, 9]] as const) {
    it(`성 ${floors}층 시드 ${seed}`, () => {
      const project = createBlankProject();
      const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { type: "castle", floors, seed, populate: false });
      const d = res.data as { links: string[]; floorData: FloorData[] };
      expect(d.links).toHaveLength(floors - 1);
      for (let k = 0; k + 1 < floors; k += 1) {
        expect(d.floorData[k]!.exitStair).toBeTruthy();
        expect(d.floorData[k + 1]!.entryStair).toBeTruthy();
      }
    });
  }
});
