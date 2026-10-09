// wing 도면 — 세로 복도 축(방이 동·서에 붙고 홀이 남쪽 끝). row/double-row 와 실루엣이 다르다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

const WING_PLAN = {
  layout: "wing",
  places: [
    { id: "bedroom", label: "객실", size: "s", count: 4, floor: "plank" },
    { id: "kitchen", label: "주방", size: "s", floor: "stone" },
    { id: "store", label: "창고", size: "s" },
    { id: "corridor", label: "복도", role: "walkway" },
    { id: "hall", label: "홀", role: "entrance", size: "m" },
  ],
  things: [
    { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
    { objectId: "stone_hearth_lit", placeIds: ["corridor"], chips: ["block", "event"], required: true },
    { objectId: "barrel", placeIds: ["store"], chips: ["block"], required: true },
    { objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true },
  ],
};

type Room = { roomId: string; x: number; y: number; w: number; h: number; role: string };

function buildWing() {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "place_concept", { query: "민가", mapId: "map_wing", seed: 7, plan: WING_PLAN }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  return { ctx, rooms: (result.data as { rooms: Room[] }).rooms, warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])] };
}

/** 문에서 걸어갈 수 있는 칸(가구·벽 제외). */
function reachableFromDoor(ctx: { project: { maps: Record<string, { width: number; height: number; lowerTiles: number[]; upperTiles: number[] }> } }, hall: Room): Set<number> {
  const map = ctx.project.maps.map_wing!;
  const start = { x: hall.x + Math.floor(hall.w / 2), y: hall.y + hall.h - 1 };
  const seen = new Set<number>([start.y * map.width + start.x]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const index = y * map.width + x;
      if (seen.has(index)) continue;
      if ((map.lowerTiles[index] ?? -1) < 0) continue;
      if ((map.upperTiles[index] ?? -1) >= 0) continue;
      seen.add(index);
      queue.push({ x, y });
    }
  }
  return seen;
}

describe("place_concept wing 도면", () => {
  it("방을 복도 동·서에 세우고 홀을 남쪽 끝에 둔다", () => {
    const { rooms } = buildWing();
    const corridor = rooms.find((room) => room.role === "walkway");
    if (!corridor) throw new Error("Missing corridor");
    const west = rooms.filter((room) => room.role === "room" && room.x + room.w < corridor.x);
    const east = rooms.filter((room) => room.role === "room" && room.x > corridor.x);
    expect(west.length).toBeGreaterThan(0);
    expect(east.length).toBeGreaterThan(0);
    // 복도는 세로로 길다 — 가로 밴드 문법과 갈리는 지점.
    expect(corridor.h).toBeGreaterThan(corridor.w);
    const hall = rooms.find((room) => room.roomId === "hall");
    if (!hall) throw new Error("Missing hall");
    expect(hall.y).toBeGreaterThanOrEqual(corridor.y + corridor.h);
  });

  it("설계가 복도 장소를 주면 그 장소가 복도의 정본이다", () => {
    const { rooms } = buildWing();
    expect(rooms.some((room) => room.roomId === "corridor" && room.role === "walkway")).toBe(true);
  });

  it("석조 화로는 복도 끝 알코브에 서고 통행을 막지 않는다", () => {
    const { ctx, rooms, warnings } = buildWing();
    const map = ctx.project.maps.map_wing!;
    const corridor = rooms.find((room) => room.role === "walkway");
    const hall = rooms.find((room) => room.roomId === "hall");
    if (!corridor || !hall) throw new Error("Missing corridor/hall");
    // 불 켜진 화구 타일(124, 애니메이션 프레임 154/184/214 포함)의 자리 = 화로의 위치(하부 레이어).
    const FIRE_TILES = new Set([124, 154, 184, 214]);
    const fires: { x: number; y: number }[] = [];
    [...map.lowerTiles, ...map.upperTiles].forEach((tile, index) => {
      const local = index % (map.width * map.height);
      if (FIRE_TILES.has(tile)) fires.push({ x: local % map.width, y: Math.floor(local / map.width) });
    });
    expect(fires.length, "화로가 서지 않았다").toBeGreaterThan(0);
    for (const fire of fires) {
      expect(fire.x).toBeGreaterThanOrEqual(corridor.x);
      expect(fire.x).toBeLessThan(corridor.x + corridor.w);
      // 복도 북단(끝) 알코브 — 방 구간보다 위.
      expect(fire.y).toBeLessThan(corridor.y + 4);
    }
    expect(warnings.filter((line) => line.includes("자리 없음"))).toEqual([]);
    // 화로가 복도를 막지 않았다 — 모든 객실에 여전히 걸어갈 수 있다.
    const seen = reachableFromDoor(ctx, hall);
    for (const room of rooms.filter((entry) => entry.role === "room")) {
      let reached = false;
      for (let y = room.y; y < room.y + room.h && !reached; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          if (seen.has(y * map.width + x)) { reached = true; break; }
        }
      }
      expect(reached, `${room.roomId} 에 닿지 않는다`).toBe(true);
    }
  });

  it("모르는 layout 은 여전히 거절한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "place_concept", {
      query: "민가", mapId: "map_wing_bad",
      plan: { layout: "spiral", places: [{ id: "hall", role: "entrance" }], things: [] },
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("layout");
  });
});
