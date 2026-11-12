// 세계 장소 채우기 — 위험한 종류(★)의 구성기 맵에 보이는 적과 보물상자를 둔다.
// 왜(2026-11-10): 구성기는 땅·집·소품만 깐다. 버들항 던전 빌더는 적·상자를 같이 두는데 세계 장소는 걸어 지나가는 빈 맵이었다(판정 38판: 보상 0.88/3).
// 새 도구는 없다 — place_field_enemy(시작 파티에 맞춘 잡몹 사본)·place_chest 를 들어온 칸에서 먼 자리에 부른다. 되풀이 안전(이벤트 id 로 센다).
import { pickFittedTroops, pickSpot } from "@/editor/tools/jrpgVolumeTools";
import { isPassable } from "@/project/collision";
import { walkStart } from "./cells";
import { applyThemeBackdrop, placeThemeOf, themeFieldTroops, usableLoot } from "./placeTheme";
import type { BuildRun } from "../shared/types";
import { leadEnemyId, useCurrentArt } from "../story/currentFoes";

type Cell = { readonly x: number; readonly y: number };
/** 맵 넓이에 따른 보이는 적 수 — 방 한 칸짜리 묘실은 하나, 큰 바깥 맵은 셋. */
const foeCount = (cells: number): number => (cells >= 1200 ? 3 : cells >= 280 ? 2 : 1);
/** 보이는 적이 주인공을 알아채는 거리(칸) — 곁을 지나가면 덤비고, 멀리 돌아가면 피할 수 있다. */
const NOTICE_RANGE = 3;

/**
 * 한 맵에 적·상자를 둔다. 둔 것이 있으면 한 줄(없으면 undefined). entrance = 그 맵에 들어오는 칸(없으면 가장 큰 걸음 덩이).
 * 적 · 전투 배경은 그 장소의 테마에서 고른다(placeTheme) — 사막 피라미드에 «광산 해골 궁수» 와 숲 배경이 섰다. 맞는 그림이 없어 대역을 쓰면 onGap 으로 알린다.
 */
export function populateWorldPlace(run: BuildRun, mapId: string, entrance: { readonly x: number; readonly y: number } | undefined, salt: number, onGap?: (line: string) => void): string | undefined {
  const map0 = run.ctx.project.maps[mapId];
  if (!map0) return undefined;
  const origin: Cell = entrance && isPassable(run.ctx.project, map0, entrance.x, entrance.y) ? { x: entrance.x, y: entrance.y } : walkStart(run.ctx.project, map0);
  const foeId = (n: number) => `ev_${mapId}_wfoe${n}`, chestId = `ev_${mapId}_wchest`;
  const taken = new Set<string>();
  const backdrop = applyThemeBackdrop(run.ctx.project, mapId);
  if (backdrop.gap) onGap?.(backdrop.gap);
  const themed = themeFieldTroops(run.ctx.project, mapId);
  for (const gap of themed.gaps) onGap?.(gap);
  const troops = themed.troopIds.length ? themed.troopIds : pickFittedTroops(run.ctx.project, undefined).field;
  const want = foeCount(map0.width * map0.height);
  let foes = 0;
  for (let n = 1; n <= want && troops.length; n++) {
    const map = run.ctx.project.maps[mapId]!;
    if (map.events.some((e) => e.id === foeId(n))) continue;
    // 들어온 칸에서 중간~먼 쪽으로 퍼뜨린다(문 앞에서 바로 싸우지 않게 최소 6걸음).
    const spot = pickSpot(run.ctx.project, map, origin, taken, 0.45 + (0.4 * (n - 1)) / Math.max(1, want - 1), 6);
    if (!spot) break;
    const troopId = troops[(salt + n) % troops.length]!;
    // 세우는 적의 현행 그림을 먼저 넣는다 — 놓는 도구가 그 그림(전투 그림)으로 세운다(옛 걷기 칩이 아니라).
    useCurrentArt(run.ctx.project, leadEnemyId(run.ctx.project, troopId));
    // 보이는 적은 걷는다 — 서 있기만 하는 적은 말 걸 사람으로 읽힌다(«해골 NPC 를 조사하자 전투»). 두 방향 · 한 칸 왕복까지 해 보고 그래도 없을 때만 세워 둔다.
    const walks = [{ length: 2, axis: n % 2 ? "horizontal" : "vertical" }, { length: 2, axis: n % 2 ? "vertical" : "horizontal" }, { length: 1, axis: "any" }];
    // 걷다가 주인공이 가까이(세 칸 안) 오면 알아채고 다가온다 — 순찰만 하는 적은 주인공 바로 옆을 스쳐 지나가고도 싸움을 걸지 않았다.
    const placed = walks.some((patrol) => run.call("place_field_enemy", { mapId, x: spot.x, y: spot.y, troopId, behavior: "chase", sightRange: NOTICE_RANGE, pace: "slow", patrol, id: foeId(n) }).ok)
      || walks.some((patrol) => run.call("place_field_enemy", { mapId, x: spot.x, y: spot.y, troopId, behavior: "patrol", patrol, id: foeId(n) }).ok)
      || run.call("place_field_enemy", { mapId, x: spot.x, y: spot.y, troopId, behavior: "stationary", id: foeId(n) }).ok;
    if (placed) foes += 1;
  }
  let chest = false;
  const map = run.ctx.project.maps[mapId]!;
  if (!map.events.some((e) => e.id === chestId)) {
    const spot = pickSpot(run.ctx.project, map, origin, taken, 0.97, 6);
    if (spot) chest = !!run.call("place_chest", { mapId, x: spot.x, y: spot.y, id: chestId, name: "깊은 곳의 보물상자", contents: usableLoot(run.ctx.project, salt) }).ok;
  }
  if (!foes && !chest && !backdrop.note) return undefined;
  return `「${map.name ?? mapId}」 ${[foes ? `보이는 적 ${foes}` : "", chest ? "보물상자 1" : "", backdrop.note ?? ""].filter(Boolean).join(" · ")}`;
}

/**
 * 앞선 빌드가 세운 세계 장소의 적·상자가 그 장소의 테마 밖이면 걷고 다시 놓는다 — 적은 앞장선 적의 전투 그림으로 견준다(맞춤 사본도 같은 그림이다).
 * 상자는 제작 재료(쓸 곳 없는 것)를 줄 때만. 이미 맞으면 아무것도 하지 않는다(되풀이 안전).
 */
export function restockOffThemePlaces(run: BuildRun, onGap?: (line: string) => void): string[] {
  const notes: string[] = [];
  for (const mapId of Object.keys(run.ctx.project.maps)) {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    if (!placeThemeOf(project, mapId)?.kind?.danger) continue;
    const foes = map.events.filter((e) => new RegExp(`^ev_${mapId}_wfoe\\d+$`, "u").test(e.id));
    const chest = map.events.find((e) => e.id === `ev_${mapId}_wchest`);
    if (!foes.length && !chest) continue;
    const spriteOf = (troopId: string): string => {
      const troop = project.database.troops.find((t) => t.id === troopId);
      const lead = project.database.enemies.find((e) => e.id === (troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0]));
      return String((lead as { monsterResourceId?: string } | undefined)?.monsterResourceId ?? "");
    };
    const themed = new Set(themeFieldTroops(project, mapId).troopIds.map(spriteOf));
    const troopOf = (ev: (typeof foes)[number]) => /"troopId":"([^"]+)"/u.exec(JSON.stringify(ev.pages ?? []))?.[1] ?? "";
    const offFoes = themed.size ? foes.filter((ev) => !themed.has(spriteOf(troopOf(ev)))) : [];
    const junk = !!chest && [...JSON.stringify(chest.pages ?? []).matchAll(/"kind":"changeItem","itemId":"([^"]+)"/gu)].some((m) => project.database.items.find((i) => i.id === m[1])?.type === "normalGoods");
    if (!offFoes.length && !junk) continue;
    for (const ev of [...offFoes, ...(junk ? [chest!] : [])]) run.call("remove_event", { mapId, eventId: ev.id });
    const salt = [...mapId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 9973;
    const placed = populateWorldPlace(run, mapId, undefined, salt, onGap);
    notes.push(`「${map.name ?? mapId}」 테마 밖 ${[offFoes.length ? `적 ${offFoes.length}` : "", junk ? "상자 보상" : ""].filter(Boolean).join(" · ")} 다시 놓음${placed ? ` — ${placed}` : ""}`);
  }
  return notes;
}
