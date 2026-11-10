import { describe, expect, it } from "vitest";
import { WELL, WELL_SHAFT_LAYOUT } from "@/project/flagship/fallen/wellShaftRooms";

// fs-vqa-obs(2026-11-10): 천문대 서고로 오르는 승강 발판이 우물 사다리 착지 방(landing) 안 4걸음 자리에 있어
// 갱도 여섯 방을 통째로 건너뛰었다. 발판은 수문 앞방(sluice)에 있고, 착지에서 방·복도만 따라 멀리 떨어져야 한다.
describe("fallen star well shaft lift placement", () => {
  type Rect = { x: number; y: number; w: number; h: number };
  const layout = WELL_SHAFT_LAYOUT as unknown as {
    map: { w: number; h: number };
    rooms: { id: string; rects: Rect[] }[];
    corridors: { width: number; path: [number, number][] }[];
    hazards: (Rect & { kind: string })[];
    bridges: Rect[];
    objects: { id: string; x: number; y: number }[];
  };
  const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const roomOf = (x: number, y: number) => layout.rooms.find((room) => room.rects.some((r) => inside(r, x, y)))?.id;

  it("puts the lift pad in the sluice antechamber, not the entrance room", () => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(roomOf(WELL.lift.x + dx, WELL.lift.y + dy)).toBe("sluice");
    expect(roomOf(WELL.arrive.x, WELL.arrive.y)).toBe("landing");
    // 발판 자리는 바닥 쇠 격자 2×2 가 표시한다 — 발판을 옮기면 격자도 따라간다.
    const grates = new Set(layout.objects.filter((o) => o.id === "grate floor").map((o) => `${o.x},${o.y}`));
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(grates.has(`${WELL.lift.x + dx},${WELL.lift.y + dy}`)).toBe(true);
    expect(grates.has("5,7")).toBe(false);
  });

  it("is a long walk from the ladder arrival through rooms and corridors", () => {
    // 방 사각과 복도(폭 2)를 걸을 수 있는 칸으로, 물·구덩이를 막힌 칸으로, 그 위 다리를 다시 걷는 칸으로 본 평면 BFS.
    const open = new Set<string>();
    for (const room of layout.rooms) for (const r of room.rects) for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) open.add(`${x},${y}`);
    for (const c of layout.corridors) {
      const [[x0, y0], [x1, y1]] = [c.path[0]!, c.path[c.path.length - 1]!];
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + (x0 === x1 ? 0 : c.width - 1); y += 1)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + (x0 === x1 ? c.width - 1 : 0); x += 1) open.add(`${x},${y}`);
    }
    for (const h of layout.hazards) for (let y = h.y; y < h.y + h.h; y += 1) for (let x = h.x; x < h.x + h.w; x += 1) open.delete(`${x},${y}`);
    for (const b of layout.bridges) for (let y = b.y; y < b.y + b.h; y += 1) for (let x = b.x; x < b.x + b.w; x += 1) open.add(`${x},${y}`);
    const start = `${WELL.arrive.x},${WELL.arrive.y}`;
    const dist = new Map([[start, 0]]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      const [x, y] = cur.split(",").map(Number) as [number, number];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = `${x + dx},${y + dy}`;
        if (open.has(next) && !dist.has(next)) { dist.set(next, dist.get(cur)! + 1); queue.push(next); }
      }
    }
    const pad = dist.get(`${WELL.lift.x},${WELL.lift.y}`);
    expect(pad, "lift pad unreachable from the ladder arrival").toBeDefined();
    expect(pad!).toBeGreaterThanOrEqual(40);
  });
});
