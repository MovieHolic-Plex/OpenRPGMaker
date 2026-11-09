// 몬스터 원정 캠페인 길 출구: 문 칸에서 가장자리 띠로 이어지는 통행 칸마다 이동 이벤트가 있어야 한다.
// 별싹 마을 북쪽 길은 두 칸 폭인데 이동 이벤트가 오른쪽 한 칸뿐이라, 왼쪽 열을 따라 올라간 플레이어가 지도 끝에서 멈췄다(terra-autopilot c4·c5·c9),
// 첫 사냥터 북쪽은 14칸 폭에 문이 한 칸이었다(c1). 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
import { describe, expect, it } from "vitest";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { canMove, isPassableLanding } from "@/project/collision";
import type { GameEvent, GameMap } from "@/project/types";

const isTransfer = (e: GameEvent) => JSON.stringify(e.pages ?? e.commands).includes('"kind":"transfer"');
const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

describe("monster expedition road exits", () => {
  it("puts a transfer event on every walkable tile where an exit meets the map edge", () => {
    const { project, manifest } = createMonsterExpedition();
    const role = new Map(manifest.maps.map((m) => [m.id, m.role]));
    const building = /_(house|center|mart|gym)(_2f)?$/;
    const gaps: string[] = [];
    let checked = 0;
    for (const link of manifest.links) {
      // 건물 문·계단은 한 칸이 맞다 — 지도 사이를 잇는 길(마을·길·동굴·탑·학교) 출구만 본다.
      if (role.get(link.from) === "interior" || building.test(link.to)) continue;
      const map: GameMap = project.maps[link.from]!;
      const { x, y } = link.source;
      const dist = { N: y, S: map.height - 1 - y, W: x, E: map.width - 1 - x };
      const [side, near] = Object.entries(dist).sort((a, b) => a[1] - b[1])[0]! as ["N" | "S" | "W" | "E", number];
      if (near > 4) continue;
      const toEdge = (p: { x: number; y: number }) => (side === "N" ? p.y : side === "S" ? map.height - 1 - p.y : side === "W" ? p.x : map.width - 1 - p.x);
      const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[side];
      const queue = [{ x, y }], seen = new Set([`${x},${y}`]);
      for (let n = 0; n < queue.length; n++) {
        const p = queue[n]!;
        if (toEdge(p) === 0) {
          checked++;
          // 그 칸에서 문 쪽(안쪽)으로 되짚어 한 칸이라도 이동 이벤트가 있으면 닿는다.
          let covered = false;
          for (let k = 0; k <= near && !covered; k++) covered = map.events.some((e) => e.x === p.x - out[0] * k && e.y === p.y - out[1] * k && isTransfer(e));
          if (!covered) gaps.push(`${link.from}->${link.to} edge tile ${p.x},${p.y}`);
        }
        for (const [dx, dy] of steps) {
          const q = { x: p.x + dx, y: p.y + dy };
          if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height || seen.has(`${q.x},${q.y}`) || toEdge(q) > near) continue;
          if (isPassableLanding(project, map, q.x, q.y) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(`${q.x},${q.y}`); queue.push(q); }
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(gaps).toEqual([]);
  }, 180_000);

  it("gives both columns of the start town north road the school transfer", () => {
    const { project } = createMonsterExpedition();
    const home = project.maps["mx_map_home"]!;
    for (const x of [10, 11]) {
      expect(home.events.some((e) => e.x === x && e.y === 1 && JSON.stringify(e.pages ?? e.commands).includes('"mapId":"mx_map_school"'))).toBe(true);
    }
  }, 180_000);
});
