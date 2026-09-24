// 등대지기 r0735: run_dungeon_room_pipeline {36×28, ice, connected, path:cave} 이 방 4개를 한 덩어리 얼음판으로
// 녹였다(통로 반지름 ≈5 가 9×8 방만큼 넓었다), 방 한가운데는 소품 없이 비었다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runDungeonRoomPipeline, type DungeonRoomPlan } from "@/editor/dungeonRoomPipeline";
import { dungeonFloorMask, planDungeonGraph } from "@/editor/dungeonGeneration/topology";
import { evaluateConnectedDungeon } from "@/editor/dungeonGeneration/connected";

const plan = {
  mapId: "map_frozen_coastal_cave", name: "얼어붙은 해안 동굴", width: 36, height: 28, theme: "ice",
  layout: "connected", path: "cave", character: "cavern", hazard: true, landmark: "gate",
} as DungeonRoomPlan;

/** 바닥 칸 중 반지름 3 원 안이 전부 바닥인 칸의 비율 — 방·통로가 녹아 붙은 「벌판」의 크기. */
function openFieldShare(width: number, height: number, seed: number): number {
  const design = { seed, path: "cave" as const, character: "cavern" as const };
  const mask = dungeonFloorMask(width, height, planDungeonGraph(width, height, design), design);
  let floor = 0, open = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!mask[y * width + x]) continue;
    floor += 1;
    let all = true;
    for (let dy = -3; dy <= 3 && all; dy++) for (let dx = -3; dx <= 3 && all; dx++) if (dx * dx + dy * dy <= 9 && !mask[(y + dy) * width + x + dx]) all = false;
    if (all) open += 1;
  }
  return open / floor;
}

describe("a connected cave keeps rooms and passages apart", () => {
  it("passages no longer fuse rooms into one open field (main: 48–58% open field, now 21–34%)", () => {
    for (const [width, height] of [[36, 28], [48, 40]] as const) for (const seed of [1, 2, 3, 4, 5]) {
      expect(openFieldShare(width, height, seed), `${width}×${height} seed ${seed}`).toBeLessThan(0.4);
    }
  });

  it("rooms past the entrance get a free-standing prop in their open middle and the cave still passes", () => {
    const project = createBlankProject();
    const result = runDungeonRoomPipeline({ ...plan, seed: 1 }, project);
    expect(result.warnings).toEqual([]);
    const standing = Number(/\((\d+) free-standing\)/.exec(result.log.join("\n"))?.[1] ?? 0);
    expect(standing).toBeGreaterThanOrEqual(2);
    project.maps[plan.mapId] = result.map;
    expect(evaluateConnectedDungeon(result.map, { ...plan, seed: 1 } as never, project).issues).toEqual([]);
  });
});
