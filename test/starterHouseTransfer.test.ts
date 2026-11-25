import { describe, expect, it } from "vitest";
import { canMove, isPassable } from "@/project/collision";
import { COMBINED_TOWN_TILESET_ID, DEFAULT_TROOP_ID } from "@/project/defaults/constants";
import { createStarterHouseInteriorMap, STARTER_HOUSE_INTERIOR_ENTRY, STARTER_HOUSE_SLIME_POS, addStarterHouseDoor, STARTER_HOUSE_SLIME_EVENT_ID } from "@/project/defaults/starterHouseTransfer";
import { nearestPassableTile } from "@/player/playSceneMapCommands";
import type { GameMap, Project } from "@/project/types";
import { retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { createStarterMap } from "@/project/defaults";
import { isolateTimers } from "./mergedTeardown";

// 통행성 함정 회귀 — "들어갈 수는 있는데 나올 수 없는/아무 데도 못 가는" 결함을 막는다.
//
// 배경(2026-07-27 조사): 타일 통행 모델 자체는 정상이다. `canMove` 는 RM2K3 정석대로
// 출발 칸의 나가는 비트 AND 도착 칸의 들어오는 비트를 보고, 두 항이 같아서 **대칭**이다
//   canMove(A→B) = dirPassable(A,dir) && dirPassable(B,opp)
//   canMove(B→A) = dirPassable(B,opp) && dirPassable(A,dir)
// 즉 **걸어서** 들어간 칸에서는 원리상 못 나올 수 없다.
//
// 문제는 두 곳이었다.
//  ① 맵 이동(transfer)이 이 판정을 우회하고 `isPassable`(스스로 "레거시 호환 — EditScene
//     표시용"이라 적힌 4방향 OR)로 착지 칸을 정했다. 한 방향만 열린 타일에 내려놓으면 갇힌다.
//  ② `TILE.FLOOR`(342)가 이름과 달리 combined_town 에서 전방향 통행 불가인데,
//     starterHouseTransfer 가 실내 300칸을 그걸로 채웠다 — 밟을 수 있는 칸이 2칸뿐이었다.
describe("passabilityTraps", () => {
  isolateTimers();
  // 시작 집 내부·함정 맵은 합본 마을 칩셋(TILE.* 번호) 위에 있다 — 2026-10-07 정리로 새 프로젝트에서 빠진 그 정의를 되살린다.
  const tileset = retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID);
  const project = { tilesets: { [COMBINED_TOWN_TILESET_ID]: tileset } } as unknown as Project;
  function reachableFrom(map: GameMap, sx: number, sy: number): Set<number> {
    const key = (x: number, y: number): number => y * map.width + x;
    const seen = new Set<number>([key(sx, sy)]);
    const queue: [number, number][] = [[sx, sy]];
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        if (seen.has(key(nx, ny))) continue;
        if (!canMove(project, map, x, y, nx, ny)) continue;
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
    return seen;
  }
  describe("TILE.FLOOR / TILE.STAIRS 는 바닥이 아니다", () => {
    it("두 상수는 기본 칩셋에서 전방향 통행 불가다 — 이름에 속지 않게 못 박는다", () => {
      for (const id of [342, 246]) {
        const flag = tileset.passability[id]!;
        expect(
          [flag.up, flag.down, flag.left, flag.right],
          `타일 ${id} 가 통행 가능해졌다면 constants.ts 의 경고 주석도 함께 고쳐야 한다`
        ).toEqual([false, false, false, false]);
      }
    });

    it("나무 마루(222)는 실내 바닥으로 쓸 수 있다", () => {
      const flag = tileset.passability[222]!;
      expect([flag.up, flag.down, flag.left, flag.right]).toEqual([true, true, true, true]);
    });
  });
  describe("시작 집 내부는 실제로 돌아다닐 수 있다", () => {
    const interior = createStarterHouseInteriorMap("map_return");

    it("실내 대부분이 입구에서 걸어서 닿는다", () => {
      const seen = reachableFrom(interior, STARTER_HOUSE_INTERIOR_ENTRY.x, STARTER_HOUSE_INTERIOR_ENTRY.y);
      // 20×15 에서 테두리 벽을 뺀 내부는 18×13 = 234칸. 예전엔 2칸이었다.
      expect(seen.size, `입구에서 닿는 칸이 ${seen.size}개뿐 — 바닥이 통행 불가 타일인지 확인하라`).toBeGreaterThan(200);
    });

    it("실내에 배치된 슬라임에게 실제로 갈 수 있다", () => {
      const seen = reachableFrom(interior, STARTER_HOUSE_INTERIOR_ENTRY.x, STARTER_HOUSE_INTERIOR_ENTRY.y);
      const key = (x: number, y: number): number => y * interior.width + x;
      expect(
        seen.has(key(STARTER_HOUSE_SLIME_POS.x, STARTER_HOUSE_SLIME_POS.y)),
        "실내 슬라임이 도달 불가 — 배치했지만 만날 수 없는 죽은 콘텐츠다"
      ).toBe(true);
    });
  });
  describe("transfer 착지는 나갈 수 있는 칸을 고른다", () => {
    /** 한 방향만 열린 타일(나무 데크 북측 가장자리 230)로 둘러싸인 함정 맵. */
    function trapMap(): GameMap {
      const width = 7;
      const height = 7;
      const lowerTiles = new Array<number>(width * height).fill(306); // 전부 벽
      // (3,3) 은 230 — up 만 닫힌 타일. 위쪽 이웃을 벽으로 두면 네 방향 모두 나갈 수 없다.
      lowerTiles[3 * width + 3] = 230;
      // (5,5) 는 정상 잔디 + 옆에 나갈 곳이 있다.
      lowerTiles[5 * width + 5] = 240;
      lowerTiles[5 * width + 4] = 240;
      return {
        id: "map_trap",
        name: "함정",
        width,
        height,
        tilesetId: COMBINED_TOWN_TILESET_ID,
        tileSize: 16,
        lowerTiles,
        upperTiles: new Array<number>(width * height).fill(-1),
        events: [],
      } as GameMap;
    }

    it("한 방향만 열린 칸은 isPassable 은 통과시키지만 실제로는 갇힌다", () => {
      const map = trapMap();
      // 레거시 판정은 이 칸을 "통행 가능"이라고 한다 — 이게 예전 착지 기준이었다.
      expect(isPassable(project, map, 3, 3)).toBe(true);
      // 그런데 어느 방향으로도 못 나간다.
      const canLeave =
        canMove(project, map, 3, 3, 4, 3) ||
        canMove(project, map, 3, 3, 2, 3) ||
        canMove(project, map, 3, 3, 3, 4) ||
        canMove(project, map, 3, 3, 3, 2);
      expect(canLeave, "이 칸이 나갈 수 있게 됐다면 이 테스트의 함정 구성을 다시 짜라").toBe(false);
    });

    it("착지 계산이 그 함정 칸을 피해 나갈 수 있는 칸으로 보낸다", () => {
      const map = trapMap();
      const landing = nearestPassableTile(project, map, 3, 3);
      expect(
        landing,
        "transfer 가 갇히는 칸에 플레이어를 내려놓았다 — nearestPassableTile 이 canMove 를 안 본다"
      ).not.toEqual({ x: 3, y: 3 });
      const canLeave =
        canMove(project, map, landing.x, landing.y, landing.x + 1, landing.y) ||
        canMove(project, map, landing.x, landing.y, landing.x - 1, landing.y) ||
        canMove(project, map, landing.x, landing.y, landing.x, landing.y + 1) ||
        canMove(project, map, landing.x, landing.y, landing.x, landing.y - 1);
      expect(canLeave, `착지 칸 (${landing.x},${landing.y})에서 나갈 수 없다`).toBe(true);
    });
  });
});

describe("starterDoorTransfer", () => {
  isolateTimers();
  describe("starter door transfer defaults", () => {
    it("builds a starter house door and matching interior transfer", () => {
      // Given: a starter village and its paired interior map are built from the transfer helpers.
      const starter = createStarterMap();
      addStarterHouseDoor(starter);
      const interior = createStarterHouseInteriorMap(starter.id);

      // When: the generated transfer events are inspected.
      const door = starter.events.find((event) => event.id === "event_starter_house_door");
      const doorPage = door?.pages?.[0];
      const transfer = doorPage?.commands.find((command) => command.kind === "transfer");
      const exit = interior.events.find((event) => event.id === "event_starter_house_exit");
      const exitPage = exit?.pages?.[0];
      const exitTransfer = exitPage?.commands.find((command) => command.kind === "transfer");
      const slime = interior.events.find((event) => event.id === STARTER_HOUSE_SLIME_EVENT_ID);
      const slimePage = slime?.pages?.[0];
      const slimeBattle = slimePage?.commands.find((command) => command.kind === "battleProcessing");

      // Then: player-touch transfers connect the exterior door and interior exit.
      expect(interior.name).toBe("시작 집 내부");
      expect(interior.width).toBeGreaterThanOrEqual(20);
      expect(interior.height).toBeGreaterThanOrEqual(15);
      expect(door).toMatchObject({
        x: 7,
        y: 10,
        trigger: { kind: "playerTouch" },
      });
      expect(doorPage).toMatchObject({
        id: "event_starter_house_door_page",
        priority: "below",
        trigger: { kind: "playerTouch" },
      });
      expect(transfer).toEqual({ kind: "transfer", mapId: "map_starter_house_interior", x: 4, y: 6, fade: "black" });
      expect(exit).toMatchObject({
        x: 4,
        y: 7,
        trigger: { kind: "playerTouch" },
      });
      expect(exitTransfer).toEqual({ kind: "transfer", mapId: starter.id, x: 7, y: 11, fade: "black" });
      // And: an indoor yard slime is ready for quick battle tests.
      expect(slime).toMatchObject({
        x: STARTER_HOUSE_SLIME_POS.x,
        y: STARTER_HOUSE_SLIME_POS.y,
        trigger: { kind: "eventTouch" },
      });
      expect(slimePage?.graphic?.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_monster1" });
      expect(slimeBattle).toEqual({
        kind: "battleProcessing",
        troopId: DEFAULT_TROOP_ID,
        canEscape: true,
        canLose: true,
      });
    });
  });
});
