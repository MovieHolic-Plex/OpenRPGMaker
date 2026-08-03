// Scarloxy 포켓몬풍 데모 실내 맵 3종의 계약.
//
// 핵심은 "죽은 콘텐츠 금지" — 이 저장소는 이미 시작 집 실내가 통행 불가 바닥(342)으로
// 채워져 슬라임을 영원히 만날 수 없었던 전례가 있다(starterHouseTransfer.ts 주석).
// 그래서 타일 id 를 확인하는 데서 멈추지 않고, 실제 통행 판정으로 걸어서 확인한다.
import { describe, expect, it } from "vitest";
import { canMove, tilePassability } from "@/project/collision";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";
import { CENTER_MAP_ID, HOME_MAP_ID, INTERIOR_TILESET_ID, LAB_MAP_ID, ensureScarloxyPokemonInteriors } from "@/project/defaults/scarloxyPokemonInteriors";
import { deserialize, serialize } from "@/project/io";
import { canTravelBetweenMaps } from "@/testing/mapTravelReachability";

const TOWN_MAP_ID = "map_pkmn_town";
const INTERIOR_MAP_IDS = [LAB_MAP_ID, HOME_MAP_ID, CENTER_MAP_ID] as const;
const START = { mapId: TOWN_MAP_ID, x: 13, y: 12 } as const;

describe("Scarloxy 포켓몬풍 데모 실내 맵", () => {
  it("실내 3종이 RTP Interior 칩셋으로 등록되고 직렬화를 왕복한다", () => {
    const project = deserialize(serialize(createScarloxyPokemonDemoProject()));
    for (const mapId of INTERIOR_MAP_IDS) {
      const map = project.maps[mapId];
      expect(map, mapId).toBeDefined();
      expect(map!.tilesetId).toBe(INTERIOR_TILESET_ID);
      expect(project.tilesets[INTERIOR_TILESET_ID]).toBeDefined();
    }
  });

  it("마을 시작 지점에서 실내 3종에 모두 걸어서 도달한다", () => {
    const project = createScarloxyPokemonDemoProject();
    for (const mapId of INTERIOR_MAP_IDS) {
      const result = canTravelBetweenMaps(project, START, mapId);
      expect(result.reachable, `${mapId} 도달 실패: ${JSON.stringify(result.unreachableGates)}`).toBe(true);
    }
  });

  it("실내에서 마을로 되돌아 나올 수 있다", () => {
    const project = createScarloxyPokemonDemoProject();
    for (const mapId of INTERIOR_MAP_IDS) {
      const map = project.maps[mapId]!;
      const exit = map.events.find((event) => event.id.endsWith("_exit"))!;
      expect(exit, `${mapId} 출구 이벤트 없음`).toBeDefined();
      const result = canTravelBetweenMaps(project, { mapId, x: exit.x, y: exit.y }, TOWN_MAP_ID);
      expect(result.reachable, `${mapId} → 마을 복귀 실패`).toBe(true);
    }
  });

  it("실내 NPC 가 전부 입구에서 걸어 닿는 칸에 서 있다 (죽은 콘텐츠 금지)", () => {
    const project = createScarloxyPokemonDemoProject();
    for (const mapId of INTERIOR_MAP_IDS) {
      const map = project.maps[mapId]!;
      const entry = map.events.find((event) => event.id.endsWith("_exit"))!;
      const walkable = floodFill(project, mapId, entry.x, entry.y);
      for (const event of map.events) {
        // NPC 자신은 통행을 막을 수 있으니, 인접 4칸 중 하나라도 밟히면 말을 걸 수 있다.
        const adjacent = [
          [event.x + 1, event.y],
          [event.x - 1, event.y],
          [event.x, event.y + 1],
          [event.x, event.y - 1],
        ];
        const speakable = walkable.has(`${event.x},${event.y}`) || adjacent.some(([x, y]) => walkable.has(`${x},${y}`));
        expect(speakable, `${mapId}:${event.id} (${event.x},${event.y}) 에 접근할 수 없다`).toBe(true);
      }
    }
  });

  // 가구(upper 소품)는 통행 불가가 정상이다 — 침대·탁자·카운터는 실제로 막아야 한다.
  // 여기서 막고 싶은 결함은 "가구가 아닌 빈 바닥인데 입구에서 닿지 않는 칸"(고립 구역)이다.
  it("가구 없는 빈 바닥은 한 칸도 빠짐없이 입구에서 닿는다 (고립 구역 금지)", () => {
    const project = createScarloxyPokemonDemoProject();
    for (const mapId of INTERIOR_MAP_IDS) {
      const map = project.maps[mapId]!;
      const tileset = project.tilesets[map.tilesetId]!;
      const entry = map.events.find((event) => event.id.endsWith("_exit"))!;
      const walkable = floodFill(project, mapId, entry.x, entry.y);

      const orphans: string[] = [];
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const index = y * map.width + x;
          if (map.upperTiles[index] !== -1) continue; // 가구 칸은 제외
          const pass = tilePassability(tileset, map.lowerTiles[index]!, -1);
          if (!pass.up || !pass.down || !pass.left || !pass.right) continue; // 벽 칸은 제외
          if (!walkable.has(`${x},${y}`)) orphans.push(`(${x},${y})`);
        }
      }
      expect(orphans, `${mapId} 고립된 빈 바닥: ${orphans.join(" ")}`).toEqual([]);
      // 방이 실제로 걸어다닐 만한 크기인지 — 벽·가구를 빼고도 내부의 절반 이상.
      expect(walkable.size, `${mapId} 보행 가능 칸 ${walkable.size}`).toBeGreaterThan((map.width - 2) * (map.height - 3) * 0.5);
    }
  });

  // 맵은 코드가 아니라 DB(rpg_zzu.maps)에 산다 — 이미 저장된 데모는 코드를 고쳐도
  // 실내가 생기지 않는다. store 가 로드 직후 돌리는 보강 패스가 그 결손을 메운다.
  describe("이미 저장된 데모 프로젝트 보강", () => {
    /** DB에 남아 있는 옛 상태 재현 — 마을+1번 길 2장, 실내도 출입구도 없음. */
    function legacyStoredDemo(): ReturnType<typeof createScarloxyPokemonDemoProject> {
      const project = createScarloxyPokemonDemoProject();
      for (const mapId of INTERIOR_MAP_IDS) delete project.maps[mapId];
      const town = project.maps[TOWN_MAP_ID]!;
      town.events = town.events.filter((event) => !event.id.startsWith("ev_pkmn_door_") && !event.id.startsWith("ev_pkmn_sign_"));
      return project;
    }

    it("실내가 없는 옛 프로젝트에 실내 3종과 출입구를 채운다", () => {
      const project = legacyStoredDemo();
      expect(Object.keys(project.maps)).toHaveLength(2);

      expect(ensureScarloxyPokemonInteriors(project)).toBe(true);

      expect(Object.keys(project.maps).sort()).toEqual([CENTER_MAP_ID, HOME_MAP_ID, LAB_MAP_ID, TOWN_MAP_ID, "map_pkmn_route"].sort());
      for (const mapId of INTERIOR_MAP_IDS) {
        const result = canTravelBetweenMaps(project, START, mapId);
        expect(result.reachable, `보강 후에도 ${mapId} 에 닿지 않는다`).toBe(true);
      }
    });

    it("두 번 돌려도 이벤트가 중복되지 않는다 (멱등)", () => {
      const project = legacyStoredDemo();
      expect(ensureScarloxyPokemonInteriors(project)).toBe(true);
      const townEventIds = project.maps[TOWN_MAP_ID]!.events.map((event) => event.id);

      expect(ensureScarloxyPokemonInteriors(project)).toBe(false);
      expect(project.maps[TOWN_MAP_ID]!.events.map((event) => event.id)).toEqual(townEventIds);
      expect(new Set(townEventIds).size).toBe(townEventIds.length);
    });

    it("사용자가 실내 하나만 지운 경우엔 손대지 않는다", () => {
      const project = createScarloxyPokemonDemoProject();
      delete project.maps[HOME_MAP_ID];
      expect(ensureScarloxyPokemonInteriors(project)).toBe(false);
      expect(project.maps[HOME_MAP_ID]).toBeUndefined();
    });

    it("포켓몬풍 데모가 아닌 프로젝트는 건드리지 않는다", () => {
      const project = createScarloxyPokemonDemoProject();
      // 스타터 지급 이벤트가 없으면 이 데모가 아니다.
      const town = project.maps[TOWN_MAP_ID]!;
      town.events = town.events.filter((event) => event.id !== "ev_pkmn_professor");
      for (const mapId of INTERIOR_MAP_IDS) delete project.maps[mapId];
      expect(ensureScarloxyPokemonInteriors(project)).toBe(false);
      expect(project.maps[LAB_MAP_ID]).toBeUndefined();
    });
  });
});

/** 이벤트를 무시하고 지형 통행만으로 도달 가능한 칸 집합. */
function floodFill(project: ReturnType<typeof createScarloxyPokemonDemoProject>, mapId: string, startX: number, startY: number): Set<string> {
  const map = project.maps[mapId]!;
  const seen = new Set<string>([`${startX},${startY}`]);
  const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (!canMove(project, map, x, y, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}
