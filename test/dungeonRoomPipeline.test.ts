import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  DUNGEON_ROOM_DEMO_PLANS,
  DUNGEON_ROOM_THEMES,
  DUNGEON_ROOM_TILESET_ID,
  ensureDungeonRoomHarness,
  runDungeonRoomPipeline,
  type DungeonRoomTheme,
} from "@/editor/dungeonRoomPipeline";
import { getTool } from "@/editor/tools/toolRegistry";
import { createDungeonTerrainAutotileGroups } from "@/project/defaults/dungeonTerrainAutotiles";

// 테마별 [천장 그룹 key, 천장 하단 벽 좌끝/증식/우끝, 바닥 몸통] 기대치.
const EXPECT: Record<DungeonRoomTheme, { ceilKey: string; wall: [number, number, number]; floor: number }> = {
  lava: { ceilKey: "pit-gold", wall: [102, 103, 104], floor: 301 },
  stone: { ceilKey: "abyss-gray", wall: [21, 22, 23], floor: 187 },
  ice: { ceilKey: "abyss-blue", wall: [372, 373, 374], floor: 67 },
};
const ceilMembers = (key: string) =>
  new Set(createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith(`terrain-${key}`))!.memberTileIds);

describe("dungeon-room-v1 pipeline", () => {
  it("테마 3종 데모 플랜이 등록돼 있다", () => {
    expect(DUNGEON_ROOM_THEMES).toEqual(["lava", "stone", "ice"]);
    expect(DUNGEON_ROOM_DEMO_PLANS).toHaveLength(3);
  });

  it("각 테마가 천장 프레임 + 천장 하단 직선 벽(대각 없음) + 바닥을 시공한다", () => {
    for (const theme of DUNGEON_ROOM_THEMES) {
      const exp = EXPECT[theme];
      const { map, ok } = runDungeonRoomPipeline({ mapId: `m_${theme}`, name: theme, width: 26, height: 18, theme });
      const W = map.width;
      const at = (x: number, y: number) => map.lowerTiles[y * W + x];
      // 천장 공허가 바깥 테두리를 채운다(코너는 오토타일 성형 변형이라 그룹 멤버로 검사)
      expect(ceilMembers(exp.ceilKey).has(at(0, 0)!)).toBe(true);
      // 천장 하단 벽 윗줄(y=2): 좌끝·증식·우끝
      expect(at(2, 2)).toBe(exp.wall[0]);           // 좌끝
      expect(at(13, 2)).toBe(exp.wall[1]);          // 가로 증식
      expect(at(W - 3, 2)).toBe(exp.wall[2]);       // 우끝
      // 벽 아랫줄(y=3)은 상위레이어 아님, 하위 벽 아랫줄
      expect(at(13, 3)).toBeGreaterThan(0);
      // 대각 타일(16/17/432/433/287/316)이 천장 하단 벽줄(y=2)에 없어야 한다
      const diagonals = new Set([16, 17, 432, 433, 286, 287, 316, 317]);
      for (let x = 2; x <= W - 3; x += 1) expect(diagonals.has(at(x, 2)!)).toBe(false);
      // 바닥 몸통이 방 중앙 상단(벽 바로 아래)에 있다
      expect(at(13, 5)).toBe(exp.floor);
      expect(ok).toBe(true);
    }
  });

  it("위험지형 + 판자 다리(상위 레이어)가 배치된다", () => {
    const { map } = runDungeonRoomPipeline({ mapId: "m", name: "lava", width: 26, height: 18, theme: "lava" });
    const W = map.width;
    const hasLava = map.lowerTiles.some((t) => [303, 304, 305, 273, 274, 275, 333, 334, 335, 243, 245].includes(t));
    expect(hasLava).toBe(true);
    // 판자 다리는 상위 레이어(252/253/254)
    const hasPlank = map.upperTiles.some((t) => [252, 253, 254].includes(t));
    expect(hasPlank).toBe(true);
    void W;
  });

  it("hazard:false면 위험지형/다리를 생략한다", () => {
    const { map } = runDungeonRoomPipeline({ mapId: "m", name: "ice", width: 26, height: 18, theme: "ice", hazard: false });
    expect(map.upperTiles.every((t) => ![252, 253, 254].includes(t))).toBe(true);
  });

  it("ensureDungeonRoomHarness가 던전 타일셋에 팩을 시드한다(idempotent)", () => {
    const project = createBlankProject();
    // 블랭크 프로젝트는 이미 시드됨 → 재적용은 false
    expect(ensureDungeonRoomHarness(project)).toBe(false);
    expect(project.tilesets[DUNGEON_ROOM_TILESET_ID]).toBeDefined();
  });

  it("run_dungeon_room_pipeline 툴이 레지스트리에 노출되고 맵을 만든다", () => {
    const tool = getTool("run_dungeon_room_pipeline");
    expect(tool).toBeDefined();
    const project = createBlankProject();
    const res = tool!.run(project, { demo: "stone" });
    expect(res.summary).toContain("stone");
    expect(project.maps.map_dungeon_stone).toBeDefined();
    expect(project.maps.map_dungeon_stone!.tilesetId).toBe(DUNGEON_ROOM_TILESET_ID);
  });
});
