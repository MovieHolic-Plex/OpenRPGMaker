// 세계 장소 채우기 — 위험한 종류(★)의 구성기 맵에 보이는 적과 보물상자를 둔다.
// 왜(2026-11-10): 구성기는 땅·집·소품만 깐다. 버들항 던전 빌더는 적·상자를 같이 두는데 세계 장소는 걸어 지나가는 빈 맵이었다(판정 38판: 보상 0.88/3).
// 새 도구는 없다 — place_field_enemy(시작 파티에 맞춘 잡몹 사본)·place_chest 를 들어온 칸에서 먼 자리에 부른다. 되풀이 안전(이벤트 id 로 센다).
import { chestLoot, pickFittedTroops, pickSpot } from "@/editor/tools/jrpgVolumeTools";
import { isPassable } from "@/project/collision";
import { walkStart } from "./people";
import type { BuildRun } from "./types";

type Cell = { readonly x: number; readonly y: number };
/** 맵 넓이에 따른 보이는 적 수 — 방 한 칸짜리 묘실은 하나, 큰 바깥 맵은 셋. */
const foeCount = (cells: number): number => (cells >= 1200 ? 3 : cells >= 280 ? 2 : 1);

/** 한 맵에 적·상자를 둔다. 둔 것이 있으면 한 줄(없으면 undefined). entrance = 그 맵에 들어오는 칸(없으면 가장 큰 걸음 덩이). */
export function populateWorldPlace(run: BuildRun, mapId: string, entrance: { readonly x: number; readonly y: number } | undefined, salt: number): string | undefined {
  const map0 = run.ctx.project.maps[mapId];
  if (!map0) return undefined;
  const origin: Cell = entrance && isPassable(run.ctx.project, map0, entrance.x, entrance.y) ? { x: entrance.x, y: entrance.y } : walkStart(run.ctx.project, map0);
  const foeId = (n: number) => `ev_${mapId}_wfoe${n}`, chestId = `ev_${mapId}_wchest`;
  const taken = new Set<string>();
  const troops = pickFittedTroops(run.ctx.project, undefined).field;
  const want = foeCount(map0.width * map0.height);
  let foes = 0;
  for (let n = 1; n <= want && troops.length; n++) {
    const map = run.ctx.project.maps[mapId]!;
    if (map.events.some((e) => e.id === foeId(n))) continue;
    // 들어온 칸에서 중간~먼 쪽으로 퍼뜨린다(문 앞에서 바로 싸우지 않게 최소 6걸음).
    const spot = pickSpot(run.ctx.project, map, origin, taken, 0.45 + (0.4 * (n - 1)) / Math.max(1, want - 1), 6);
    if (!spot) break;
    const troopId = troops[(salt + n) % troops.length]!;
    const patrol = run.call("place_field_enemy", { mapId, x: spot.x, y: spot.y, troopId, behavior: "patrol", patrol: { length: 2, axis: n % 2 ? "horizontal" : "vertical" }, id: foeId(n) });
    const placed = patrol.ok ? patrol : run.call("place_field_enemy", { mapId, x: spot.x, y: spot.y, troopId, behavior: "stationary", id: foeId(n) });
    if (placed.ok) foes += 1;
  }
  let chest = false;
  const map = run.ctx.project.maps[mapId]!;
  if (!map.events.some((e) => e.id === chestId)) {
    const spot = pickSpot(run.ctx.project, map, origin, taken, 0.97, 6);
    if (spot) chest = !!run.call("place_chest", { mapId, x: spot.x, y: spot.y, id: chestId, name: "깊은 곳의 보물상자", contents: chestLoot(run.ctx.project, salt) }).ok;
  }
  if (!foes && !chest) return undefined;
  return `「${map.name ?? mapId}」 ${[foes ? `보이는 적 ${foes}` : "", chest ? "보물상자 1" : ""].filter(Boolean).join(" · ")}`;
}
