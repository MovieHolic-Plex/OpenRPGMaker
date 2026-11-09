// 몬스터 원정 길 출구: 문 칸에서 가장자리 띠로 이어지는 통행 칸마다 같은 이동 이벤트(잠긴 길이면 같은 잠금 fork)가 있어야 한다.
// 별싹 마을 북쪽 길은 두 칸 폭인데 이동 이벤트가 오른쪽 한 칸뿐이라, 왼쪽 열을 따라 올라간 플레이어가 지도 끝에서 멈췄다(terra-autopilot c4·c5·c9),
// 첫 사냥터 북쪽(스위치 mx_rival_2 로 잠긴 14칸 폭)은 문이 한 칸이었다(c1). 사냥터 탐험 생성기(tournament.ts)도 같은 규칙이다.
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
import { describe, expect, it } from "vitest";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { createMonsterHuntingGrounds } from "@/project/examples/monsterExpedition/tournamentGame";
import { canMove, isPassableLanding } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";

type Built = { project: Project; manifest: { maps: { id: string; role: string }[]; links: { from: string; to: string; eventId: string; source: { x: number; y: number } }[] } };
const isTransfer = (e: GameEvent) => JSON.stringify(e.pages ?? e.commands).includes('"kind":"transfer"');
const commandsOf = (e: GameEvent) => JSON.stringify(e.pages?.[0]?.commands ?? e.commands);
const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** 길 출구(건물 문·계단 제외)마다, 문에서 가장자리 띠로 걸어 닿는 가장자리 칸을 모아 이동 이벤트가 없는 칸·잠금이 다른 칸을 돌려준다. */
function auditRoadExits({ project, manifest }: Built) {
  const role = new Map(manifest.maps.map((m) => [m.id, m.role]));
  const building = /_(house|center|mart|gym)(_2f)?$/;
  const gaps: string[] = [], differing: string[] = [];
  let checked = 0, guarded = 0;
  for (const link of manifest.links) {
    // 건물 문·계단은 한 칸이 맞다 — 지도 사이를 잇는 길(마을·길·동굴·탑·학교) 출구만 본다.
    if (role.get(link.from) === "interior" || building.test(link.to)) continue;
    const map: GameMap = project.maps[link.from]!;
    const door = map.events.find((e) => e.id === link.eventId)!;
    const doorCommands = commandsOf(door);
    const { x, y } = link.source;
    const dist = { N: y, S: map.height - 1 - y, W: x, E: map.width - 1 - x };
    const [side, near] = Object.entries(dist).sort((a, b) => a[1] - b[1])[0]! as ["N" | "S" | "W" | "E", number];
    if (near > 4) continue;
    if (doorCommands.includes('"kind":"fork"')) guarded++;
    const toEdge = (p: { x: number; y: number }) => (side === "N" ? p.y : side === "S" ? map.height - 1 - p.y : side === "W" ? p.x : map.width - 1 - p.x);
    const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[side];
    // 같은 가장자리 띠를 다른 길 출구(같은 지도의 다른 문)가 나눠 쓸 수 있다 — 그 칸은 그 출구의 이동이 맡는다.
    const otherDoor = (e: GameEvent) => manifest.links.some((l) => l.from === link.from && l.eventId !== link.eventId && (e.id === l.eventId || e.id.startsWith(`${l.eventId}_edge_`)));
    const queue = [{ x, y }], seen = new Set([`${x},${y}`]);
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n]!;
      if (toEdge(p) === 0) {
        checked++;
        // 그 칸에서 문 쪽(안쪽)으로 되짚어 가장 가까운 이동 이벤트가 이 문의 것이어야 한다(잠긴 길은 같은 잠금 명령).
        let cover: GameEvent | undefined;
        for (let k = 0; k <= near && !cover; k++) cover = map.events.find((e) => e.x === p.x - out[0] * k && e.y === p.y - out[1] * k && isTransfer(e));
        if (!cover) gaps.push(`${link.from}->${link.to} edge tile ${p.x},${p.y}`);
        else if (commandsOf(cover) !== doorCommands && !otherDoor(cover)) differing.push(`${link.from}->${link.to} edge tile ${p.x},${p.y} carries ${cover.id}`);
      }
      for (const [dx, dy] of steps) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height || seen.has(`${q.x},${q.y}`) || toEdge(q) > near) continue;
        if (isPassableLanding(project, map, q.x, q.y) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(`${q.x},${q.y}`); queue.push(q); }
      }
    }
  }
  return { checked, guarded, gaps, differing };
}

describe("monster expedition road exits", () => {
  it("puts the same transfer on every walkable tile where a campaign exit meets the map edge", () => {
    const audit = auditRoadExits(createMonsterExpedition());
    expect(audit.checked).toBeGreaterThan(40);
    expect(audit.guarded).toBeGreaterThan(5);
    expect(audit.gaps).toEqual([]);
    expect(audit.differing).toEqual([]);
  }, 180_000);

  it("does the same for hunting-grounds exits, including the switch-guarded ones", () => {
    for (const rounds of [2, 4]) {
      const audit = auditRoadExits(createMonsterHuntingGrounds({ rounds }));
      expect(audit.checked, `rounds ${rounds}`).toBeGreaterThan(20);
      expect(audit.guarded, `rounds ${rounds}`).toBeGreaterThan(0);
      expect(audit.gaps, `rounds ${rounds}`).toEqual([]);
      expect(audit.differing, `rounds ${rounds}`).toEqual([]);
    }
  }, 180_000);

  it("guards all 14 north edge tiles of the first hunting field with the mx_rival_2 lock (c1)", () => {
    const { project } = createMonsterHuntingGrounds({ rounds: 2 });
    const field = project.maps["mx_map_ground_1"]!;
    const toLast = field.events.filter((e) => e.id.startsWith("mx_map_ground_1_to_mx_map_ground_2") && JSON.stringify(e.pages?.[0]?.commands).includes('"mapId":"mx_map_ground_2"'));
    const north = toLast.filter((e) => e.y === 0);
    expect(north.map((e) => e.x).sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => 6 + i));
    for (const e of toLast) expect(JSON.stringify(e.pages![0]!.commands)).toContain('"switchId":"mx_rival_2"');
  }, 180_000);

  it("gives both columns of the start town north road the school transfer", () => {
    const { project } = createMonsterExpedition();
    const home = project.maps["mx_map_home"]!;
    for (const x of [10, 11]) {
      expect(home.events.some((e) => e.x === x && e.y === 1 && JSON.stringify(e.pages ?? e.commands).includes('"mapId":"mx_map_school"'))).toBe(true);
    }
  }, 180_000);
});
