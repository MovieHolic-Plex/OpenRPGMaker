// 맵→맵(=칩셋→칩셋) 도달성 도구의 계약과, 《천공의 계단》에 대한 실제 적용.
//
// 이 도구가 필요했던 이유: projectLint 는 transfer 의 **목적지**만 보고, 완주 시나리오는
// 이벤트를 **id 로 호출**한다. 그래서 "관문이 벽 위에 놓여 영원히 밟을 수 없다"는 결함을
// 둘 다 놓쳤다(실측 6건, 게임이 완주 불가였다). 이 테스트는 실제 통행 판정으로 걸어서 확인한다.
import { describe, expect, it } from "vitest";
import { canMove } from "@/project/collision";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { canTravelBetweenMaps, firstStandableCell } from "@/testing/mapTravelReachability";
import type { GameMap, Project } from "@/project/types";

describe("도달성 도구의 계약", () => {
  /** 두 칸 맵 두 개를 관문 하나로 이은 최소 프로젝트. 관문 칸의 통행성을 바꿔 가며 검사한다. */
  function twoMapProject(gateTile: number): Project {
    const tileset = defaultTilesets()[COMBINED_TOWN_TILESET_ID]!;
    const makeMap = (id: string, gateAt: { x: number; y: number } | null, target?: string): GameMap => {
      const width = 4;
      const height = 3;
      const map: GameMap = {
        id,
        name: id,
        width,
        height,
        tilesetId: COMBINED_TOWN_TILESET_ID,
        tileSize: 16,
        lowerTiles: new Array<number>(width * height).fill(240), // 잔디 = 통행 가능
        upperTiles: new Array<number>(width * height).fill(-1),
        events: [],
      } as GameMap;
      if (gateAt && target) {
        map.lowerTiles[gateAt.y * width + gateAt.x] = gateTile;
        map.events.push({
          id: `gate_${id}`,
          x: gateAt.x,
          y: gateAt.y,
          pages: [{
            id: "p",
            name: "관문",
            conditions: [],
            graphic: { transparent: true },
            trigger: "touch",
            priority: "below",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{ kind: "transfer", mapId: target, x: 1, y: 1 }],
          }],
        } as never);
      }
      return map;
    };
    return {
      maps: {
        map_a: makeMap("map_a", { x: 3, y: 1 }, "map_b"),
        map_b: makeMap("map_b", null),
      },
      tilesets: { [COMBINED_TOWN_TILESET_ID]: tileset },
    } as unknown as Project;
  }

  it("관문 칸이 통행 가능하면 건너간다", () => {
    const project = twoMapProject(240); // 잔디
    const result = canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b");
    expect(result.reachable, "잔디 위 관문인데 못 건넜다").toBe(true);
    expect(result.hops).toHaveLength(1);
    expect(result.hops[0]?.toMapId).toBe("map_b");
  });

  it("관문이 통행 불가 타일 위에 있으면 도달 실패로 잡고 그 이유를 말한다", () => {
    // 342 는 이름이 TILE.FLOOR 인데 전방향 통행 불가다(constants.ts 경고 참조).
    const project = twoMapProject(342);
    const result = canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b");
    expect(result.reachable).toBe(false);
    expect(result.unreachableGates).toHaveLength(1);
    expect(result.unreachableGates[0]?.reason).toBe("통행 불가 타일");
    expect(result.unreachableGates[0]?.eventId).toBe("gate_map_a");
  });

  it("스위치로 잠긴 관문은 스위치를 켜야 열린다", () => {
    const project = twoMapProject(240);
    const gate = project.maps.map_a!.events[0]!;
    const base = (gate.pages ?? [])[0]!;
    // 페이지 순서 규약: 일반 → 구체. 뒤 페이지가 이기므로 조건 있는 페이지를 뒤에 둔다.
    const openPage = { ...base, id: "open", conditions: [{ kind: "switch", switchId: "sw_gate", value: true }] };
    gate.pages = [{ ...base, id: "closed", commands: [] }, openPage as never];

    expect(canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b").reachable).toBe(false);
    expect(
      canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b", { openSwitches: ["sw_gate"] }).reachable,
      "스위치를 켰는데도 관문이 열리지 않았다"
    ).toBe(true);
    expect(
      canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b", { ignoreSwitches: true }).reachable,
      "ignoreSwitches 는 지형만 보게 하는 옵션이다"
    ).toBe(true);
  });

  it("firstStandableCell 은 나갈 수 있는 칸을 고른다", () => {
    const project = twoMapProject(240);
    const map = project.maps.map_a!;
    const cell = firstStandableCell(project, map)!;
    const canLeave = canMove(project, map, cell.x, cell.y, cell.x + 1, cell.y)
      || canMove(project, map, cell.x, cell.y, cell.x - 1, cell.y)
      || canMove(project, map, cell.x, cell.y, cell.x, cell.y + 1)
      || canMove(project, map, cell.x, cell.y, cell.x, cell.y - 1);
    expect(canLeave).toBe(true);
  });
});
