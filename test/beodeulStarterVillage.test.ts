// 실제 시작 마을(editor/content/beodeulStarterMap.ts — 「예제로 시작」·「작은 마을 추가하기」의 첫 맵)이 짓는 것:
// 집이 있고, 집마다 문 앞 칸까지 시작 칸에서 걸어갈 수 있고, 길이 한 덩어리다.
//
// 칸 번호를 적지 않는다(옛 시작 마을 시험들은 합본 마을 칸 번호를 적었다가 칩셋이 바뀌자 통째로 낡았다). 모두 짓는 쪽이 스스로 적어 둔 것에서 읽는다:
//  - 집과 문: 맵에 찍힌 블록 킷(detectKitStamps)의 입구 조각(parts kind:"entrance"). 문 앞 칸은 입구 조각 바로 아래 칸 —
//    도시 형태 점검이 문 앞을 세는 셈과 같다(cityForm.ts doorFronts: p.y + part.dy + part.h).
//  - 길: 도시 형태 점검(analyzeCityForm — check_city_form 이 돌려주는 것)의 길 그래프.
//  - 걷기: check_reachability 도구와 통행 판정(isPassable).
// beodeulStarterMap.test.ts 는 도구 실행기를 가짜로 바꿔 «짓는 문맥» 만 본다 — 이 파일은 진짜 도구로 지은 맵을 본다.
import { describe, expect, it } from "vitest";
import { createBeodeulStarterMap } from "@/editor/content/beodeulStarterMap";
import { analyzeCityForm, detectKitStamps } from "@/editor/tools/cityForm";
import { runTool } from "@/editor/tools/toolRunner";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

interface House {
  readonly block: string;
  readonly door: { readonly x: number; readonly y: number };
  readonly front: { readonly x: number; readonly y: number };
}

interface Village {
  readonly project: Project;
  readonly map: GameMap;
  readonly startPos: { readonly x: number; readonly y: number };
  readonly blocks: ReturnType<typeof detectKitStamps>;
  readonly houses: readonly House[];
}

let built: Village | undefined;
/** 한 번만 짓는다 — 빈 프로젝트와 마을 짓기가 이 파일 시간의 거의 전부다(첫 경우의 시간에 실린다). */
function village(): Village {
  if (built) return built;
  const blank = createBlankProject();
  const starter = createBeodeulStarterMap(blank);
  if (!starter) throw new Error("시작 마을을 짓지 못했다 — 기본 칩셋(버들항)이 빈 프로젝트에 없다");
  const { map, startPos } = starter;
  // 시작 마을이 첫 맵인 프로젝트(편집기가 「예제로 시작」에서 만드는 모양) — 점검 도구가 읽는다.
  const project = { ...blank, maps: { [map.id]: map }, mapTree: { mapId: map.id, children: [] }, startMapId: map.id, startPos: { ...blank.startPos, ...startPos } } as Project;
  const tileset = project.tilesets[map.tilesetId]!;
  const blocks = detectKitStamps(map, tileset);
  const houses = blocks.flatMap((block) => (tileset.structureKits?.find((kit) => kit.id === block.kitId)?.parts ?? [])
    .filter((part) => part.kind === "entrance")
    .map((part): House => ({
      block: block.kitId,
      door: { x: block.x + part.dx, y: block.y + part.dy },
      front: { x: block.x + part.dx, y: block.y + part.dy + part.h },
    })));
  built = { project, map, startPos, blocks, houses };
  return built;
}

describe("beodeul starter village (the real first map)", () => {
  it("has houses: the builder's blocks are on the map and declare at least one house door", () => {
    const { map, blocks, houses, project } = village();
    // 내용 파일은 집 수를 적지 않는다 — 버들항 블록 격자를 청할 뿐이다. 그래서 바닥은 «블록이 찍혀 있고, 그 블록들이 적어 둔 집 문이 하나 이상» 이다.
    expect(blocks.length).toBeGreaterThan(0);
    expect(analyzeCityForm(project, map).blocks.count).toBe(blocks.length);
    expect(houses.length).toBeGreaterThan(0);
    // 문은 건물 칸이고(걸어 들어갈 수 없다) 문마다 맵 안에 문 앞 칸이 있다.
    for (const house of houses) {
      expect(isPassable(project, map, house.door.x, house.door.y), `${house.block} door (${house.door.x},${house.door.y})`).toBe(false);
      expect(house.front.y, `${house.block} door front`).toBeLessThan(map.height);
    }
    // 같은 문 앞 칸을 두 집이 나눠 쓰지 않는다.
    expect(new Set(houses.map((house) => `${house.front.x},${house.front.y}`)).size).toBe(houses.length);
  });

  it("lets the player walk from the start position to the front of every house door", () => {
    const { project, map, startPos, houses } = village();
    expect(isPassable(project, map, startPos.x, startPos.y)).toBe(true);
    const blockedFronts = houses.filter((house) => !isPassable(project, map, house.front.x, house.front.y));
    expect(blockedFronts).toEqual([]);
    const ctx = { project };
    const reach = runTool(ctx, "check_reachability", { mapId: map.id, from: startPos, targets: houses.map((house) => house.front) });
    expect(reach.ok, reach.summary).toBe(true);
    expect(reach.data).toMatchObject({ reachable: true, unreachable: [] });
  });

  it("has one connected road network, and the start row runs as walkable road to the east edge", () => {
    const { project, map, startPos } = village();
    const form = analyzeCityForm(project, map);
    expect(form.lines.count).toBeGreaterThan(0);
    expect(form.graph.components).toBe(1);
    expect(form.graph.isolated).toEqual([]);
    // 첫 구간 뼈대(playableSegment)가 (맵 가로-1, 시작 y) 에 다음 맵 문을 단다 — 내용 파일이 시작 줄 길을 동쪽 끝까지 잇는 까닭이다.
    const blockedOnStartRow: number[] = [];
    for (let x = startPos.x; x < map.width; x += 1) if (!isPassable(project, map, x, startPos.y)) blockedOnStartRow.push(x);
    expect(blockedOnStartRow).toEqual([]);
    const ctx = { project };
    const east = runTool(ctx, "check_reachability", { mapId: map.id, from: startPos, targets: [{ x: map.width - 1, y: startPos.y }] });
    expect(east.data).toMatchObject({ reachable: true, unreachable: [] });
  });
});
