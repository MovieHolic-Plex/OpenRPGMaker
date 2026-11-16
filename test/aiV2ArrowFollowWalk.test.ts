// 명세 은행 «화살표대로 걸어 못 닿음» 의 걷는 이(scripts/qa/assistant-v2/arrowFollowWalk.mts).
// 2026-11-15: 옛 자(화살표를 읽고 4칸씩 누르는 이)는 한 칸 폭 문간을 지나쳤다 되돌아오기를 120번 되풀이해 안내가 멀쩡한 자리를 못 닿음으로 셌다
// (은행 interior-tiers-merge 655/2850 → 701/2865, 「강지기의 집」 (18,7)→ (22,7)↖ (18,7)→ …). 칸마다 다시 읽는 이로 바꾸되 판정은 그대로 —
// 안내가 벽을 가리키거나 서로를 가리키면 여전히 못 닿는다.
import { describe, expect, it } from "vitest";
import { followArrowWalk, holdArrowWalk, type ArrowRead, type ArrowWorld, type Cell } from "../scripts/qa/assistant-v2/arrowFollowWalk.mts";

const STEPS: Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
type Grid = { open(c: Cell): boolean; target: Cell; start: Cell; left(c: Cell): number; canStep(a: Cell, b: Cell): boolean };
/** '#' 벽 · '.' 바닥 · 'S' 출발 · 'T' 대상(설 수 있는 칸). */
function grid(rows: string[]): Grid {
  const h = rows.length, w = rows[0]!.length;
  const at = (ch: string): Cell => { const y = rows.findIndex((r) => r.includes(ch)); return { x: rows[y]!.indexOf(ch), y }; };
  const open = (c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h && rows[c.y]![c.x] !== "#";
  const target = at("T"), start = at("S");
  const dist = new Map<string, number>([[`${target.x},${target.y}`, 0]]);
  const queue = [target];
  for (let i = 0; i < queue.length; i++) for (const s of STEPS) {
    const n = { x: queue[i]!.x + s.x, y: queue[i]!.y + s.y };
    if (!open(n) || dist.has(`${n.x},${n.y}`)) continue;
    dist.set(`${n.x},${n.y}`, dist.get(`${queue[i]!.x},${queue[i]!.y}`)! + 1); queue.push(n);
  }
  return { open, target, start, left: (c) => dist.get(`${c.x},${c.y}`) ?? -1, canStep: (_a, b) => open(b) };
}
/** 제품 화살표의 꼴: 길의 다음 곧은 구간 끝 칸을 가리킨다(같은 방향으로 이어지는 동안 따라간다). */
function legArrow(g: Grid): (c: Cell) => ArrowRead {
  return (c) => {
    let cur = c, dir: Cell | undefined;
    for (;;) {
      const d = g.left(cur);
      const next = (dir && g.left({ x: cur.x + dir.x, y: cur.y + dir.y }) === d - 1 ? [dir] : dir ? [] : STEPS).find((s) => g.open({ x: cur.x + s.x, y: cur.y + s.y }) && g.left({ x: cur.x + s.x, y: cur.y + s.y }) === d - 1);
      if (!next || d <= 1) break;
      dir = next; cur = { x: cur.x + next.x, y: cur.y + next.y };
    }
    return { visible: true, angle: Math.atan2(cur.y - c.y, cur.x - c.x), kind: "route" };
  };
}
/** 끊긴 안내의 꼴: 벽을 모르고 대상을 곧장 가리킨다. */
const straightArrow = (g: Grid, visible: boolean) => (c: Cell): ArrowRead => ({ visible, angle: Math.atan2(g.target.y - c.y, g.target.x - c.x), kind: "straight" });
const world = (g: Grid, arrowAt: (c: Cell) => ArrowRead): ArrowWorld => ({ canStep: g.canStep, arrowAt, left: g.left });

// 문간(4,2)은 한 칸 폭. 출발에서 문간 아래까지 3칸 — 4칸씩 누르면 한 칸 지나친다.
const DOORWAY = grid([
  "#########",
  "#..T....#",
  "####.####",
  "#S......#",
  "#########",
]);
// 문이 반대쪽 끝(7,2)에 있다 — 대상을 곧장 가리키는 안내로는 벽 앞에서 맴돈다.
const FAR_DOOR = grid([
  "#########",
  "#..T....#",
  "#######.#",
  "#S......#",
  "#########",
]);

describe("arrow walk — the walker re-reads the arrow every cell", () => {
  it("the old 4-cell hold walker overshoots a one-cell doorway and never arrives, although the guidance is right", () => {
    const held = holdArrowWalk(world(DOORWAY, legArrow(DOORWAY)), DOORWAY.start, 4);
    expect(held.reached).toBe(false);
    expect(held.holds).toBe(120);
    expect(held.trace.slice(0, 4)).toEqual(["(1,3)→", "(5,3)←", "(1,3)→", "(5,3)←"]);
  });
  it("the per-cell walker turns at the doorway and arrives on the same guidance", () => {
    const walked = followArrowWalk(world(DOORWAY, legArrow(DOORWAY)), DOORWAY.start);
    expect(walked.reached).toBe(true);
    expect(walked.steps).toBe(5);
    expect(walked.trace).toEqual(["(1,3)→", "(2,3)→", "(3,3)→", "(4,3)↑", "(4,2)↑"]);
    expect(followArrowWalk(world(FAR_DOOR, legArrow(FAR_DOOR)), FAR_DOOR.start).reached).toBe(true);
  });
});

describe("arrow walk — the judgment is not loosened", () => {
  it("guidance that points through a wall stays unreached and is blamed on the guidance", () => {
    const walked = followArrowWalk(world(FAR_DOOR, straightArrow(FAR_DOOR, true)), FAR_DOOR.start);
    expect(walked.reached).toBe(false);
    expect(walked.end).toBe("맴돎");
    expect(walked.cause).toBe("안내 틀림");
    expect(walked.firstBad?.cell).toEqual({ x: 4, y: 3 }); // 벽 앞에서 왼쪽으로 되돌아선 칸
    expect(walked.left).toBeGreaterThan(1);
  });
  it("a hidden arrow (target on screen behind a wall) stays unreached and is counted apart", () => {
    const walked = followArrowWalk(world(FAR_DOOR, straightArrow(FAR_DOOR, false)), FAR_DOOR.start);
    expect(walked.reached).toBe(false);
    expect(walked.cause).toBe("화살표 없음");
  });
  it("an arrow into a dead end with no other way is a block", () => {
    const pocket = grid(["#####", "#T#S#", "#.#.#", "#...#", "#####"]);
    const up = (): ArrowRead => ({ visible: true, angle: -Math.PI / 2, kind: "route" });
    const walked = followArrowWalk(world(pocket, up), pocket.start);
    expect(walked.reached).toBe(false);
    expect(walked.end).toBe("막힘");
    expect(walked.cause).toBe("안내 틀림");
    expect(walked.steps).toBe(0);
  });
  it("a start with no way to the target is never counted as reached", () => {
    const sealed = grid(["#####", "#S#T#", "#####"]);
    const walked = followArrowWalk(world(sealed, straightArrow(sealed, true)), sealed.start);
    expect(walked.reached).toBe(false);
    expect(walked.end).toBe("길 없는 칸");
  });
  it("two cells whose arrows point at each other end as a loop, not as an endless walk", () => {
    const hall = grid(["#######", "#S...T#", "#######"]);
    const arrows = (c: Cell): ArrowRead => ({ visible: true, angle: c.x === 2 ? Math.PI : 0, kind: "route" });
    const walked = followArrowWalk(world(hall, arrows), hall.start);
    expect(walked.reached).toBe(false);
    expect(walked.end).toBe("맴돎");
    expect(walked.cause).toBe("안내 틀림");
    expect(walked.steps).toBe(2);
  });
  it("back on a cell with a diagonal arrow the walker tries the other axis once — and only once", () => {
    // (1,1)↘: 기운 축(→)으로 갔다가 (2,1)← 에 밀려 돌아온다. 다른 축(↓)을 눌러 내려가 닿는다.
    const room = grid(["####", "#S.#", "#.##", "#.##", "#T##", "####"]);
    const arrows = (c: Cell): ArrowRead => ({ visible: true, angle: c.x === 2 ? Math.PI : c.y === 1 ? Math.PI / 4 : Math.PI / 2, kind: "route" });
    const walked = followArrowWalk(world(room, arrows), room.start);
    expect(walked.reached).toBe(true);
    expect(walked.swaps).toBe(1);
    // 아래가 벽이면 한 번 바꿔 눌러 보고 끝난다. 처음 어긋난 칸은 되돌려 보낸 (2,1)← — 안내 틀림.
    const shut = grid(["#####", "#S..#", "###.#", "#T..#", "#####"]);
    const stuck = followArrowWalk(world(shut, arrows), shut.start);
    expect(stuck.reached).toBe(false);
    expect(stuck.end).toBe("막힘");
    expect(stuck.cause).toBe("안내 틀림");
    expect(stuck.firstBad?.cell).toEqual({ x: 2, y: 1 });
    expect(stuck.swaps).toBe(0);
  });
});
