import { describe, expect, it } from "vitest";
import { layoutDungeon } from "@/editor/dungeonKit/layoutRooms";
import { dungeonPlanFromRead } from "@/ai/imagePlan";

const inter = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("rooms with positions (image plan)", () => {
  const read = {
    subject: "dungeon" as const, cols: 24, rows: 18,
    data: {
      rooms: [
        { kind: "entrance", x: 1, y: 14, w: 5, h: 3 }, { kind: "hall", x: 8, y: 13, w: 6, h: 4 }, { kind: "side", x: 16, y: 14, w: 5, h: 3 },
        { kind: "boss", x: 9, y: 5, w: 6, h: 5 }, { kind: "treasure", x: 9, y: 5, w: 5, h: 4 },
      ],
      links: [[0, 1], [1, 2], [1, 3], [3, 4]],
    },
  };

  it("keeps the relative placement of the given rooms and never overlaps them", () => {
    const plan = dungeonPlanFromRead(read);
    const layout = layoutDungeon({ type: "catacomb", seed: 3, rooms: plan.rooms as never, links: plan.links });
    expect(layout.rooms).toHaveLength(5);
    for (let i = 0; i < layout.rooms.length; i += 1) for (let j = i + 1; j < layout.rooms.length; j += 1) expect(inter(layout.rooms[i]!, layout.rooms[j]!)).toBe(false);
    const [entrance, hall, side, boss] = layout.rooms as [typeof layout.rooms[0], typeof layout.rooms[0], typeof layout.rooms[0], typeof layout.rooms[0]];
    expect(entrance.x).toBeLessThan(hall.x);
    expect(hall.x).toBeLessThan(side.x);
    expect(boss.y).toBeLessThan(hall.y);
    expect(layout.notes.some((n) => n.includes("겹쳐"))).toBe(true);
  });

  it("draws one corridor per link and reaches every room from the entrance", () => {
    const plan = dungeonPlanFromRead(read);
    const layout = layoutDungeon({ type: "catacomb", seed: 3, rooms: plan.rooms as never, links: plan.links });
    const adj = new Map<string, string[]>(layout.rooms.map((r) => [r.id, []]));
    for (const c of layout.corridors) { adj.get(c.a)!.push(c.b); adj.get(c.b)!.push(c.a); }
    const seen = new Set<string>([layout.rooms[0]!.id]);
    const queue = [layout.rooms[0]!.id];
    for (let i = 0; i < queue.length; i += 1) for (const n of adj.get(queue[i]!) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    expect(seen.size).toBe(layout.rooms.length);
  });

  it("joins a room that no link reaches to its nearest reached room", () => {
    const plan = dungeonPlanFromRead(read);
    const layout = layoutDungeon({ type: "catacomb", seed: 3, rooms: plan.rooms as never, links: [["r1", "r2"]] });
    expect(layout.notes.some((n) => n.includes("이어지지 않아"))).toBe(true);
    expect(layout.corridors.length).toBeGreaterThanOrEqual(4);
  });
});
