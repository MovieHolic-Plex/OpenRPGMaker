// 버들항 새 종류 기물을 빌더가 놓는다(editor/tools/beodeulObjectSets.ts): 게임 열쇠로 쓰임마다 몇 가지를 고르고(한 게임은 한 벌, 게임이 다르면 다른 벌),
// 강가·포구 마을을 조수 실행으로 지으면 놓인다. 열쇠가 없으면 아무것도 놓지 않는다 — 사람 편집·스크립트는 전과 같다. 문 앞 도달은 그대로다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { beodeulBayObjects, beodeulObjectPick, beodeulObjectsCuttingWays, beodeulVergeObjects } from "@/editor/tools/beodeulObjectSets";
import { layerTileAt } from "@/project/mapLayers";
import type { GameMap, Project } from "@/project/types";
import catalog from "../tiledata/beodeul-objects/catalog.json";

const NEWS = (catalog.items as { kit: string; waiver?: string; on?: string; rows: number[][] }[]).filter((item) => item.waiver === "fable-objects100-beodeul-2026-11-14");
const KEYS = ["ashvale", "moonharbor", "thornkeep", "reedwater"].map((name) => JSON.stringify(["project", `variety-${name}`]));
// 빈 프로젝트를 한 번만 만들어 사본으로 쓴다(게임마다 새로 만들면 CI 한도를 넘긴다 — kitLook 시험과 같은 까닭)
const TEMPLATE = JSON.stringify(createBlankProject());
const fresh = () => JSON.parse(TEMPLATE) as Project;

function newKitsOn(map: GameMap): string[] {
  const found: string[] = [];
  for (const item of NEWS) {
    const cells = item.rows.flatMap((row, dy) => row.map((tile, dx) => ({ dx, dy, tile })).filter((cell) => cell.tile >= 0));
    for (let y = 0; y + item.rows.length <= map.height; y++) for (let x = 0; x + item.rows[0]!.length <= map.width; x++)
      if (cells.every((cell) => layerTileAt(map, 3, (y + cell.dy) * map.width + x + cell.dx) === cell.tile)) found.push(item.kit);
  }
  return found;
}
function village(key: string | undefined, theme: "river" | "coast", seed: number) {
  const ctx = { project: fresh(), ...(key ? { assistantRun: true, lookKey: key } : {}) };
  const result = runTool(ctx, "author_beodeul_town", { theme, form: "plaza", terrain: "flat", seed, id: `v_${theme}_${seed}` } as never);
  expect(result.ok, result.summary).toBe(true);
  const data = result.data as { mapId: string; newObjects?: Record<string, number>; doors: { reached: boolean }[]; stampFailed: number };
  return { data, project: ctx.project, map: ctx.project.maps[data.mapId]! };
}

describe("버들항 새 종류 기물 — 게임마다 한 벌", () => {
  it("한 쓰임의 물건은 열쇠로 정해진다 — 같은 열쇠는 늘 같은 목록, 열쇠가 다르면 갈린다", () => {
    const pool = NEWS.map((item) => item.kit);
    const picks = KEYS.map((key) => beodeulObjectPick(pool, 5, key, "home"));
    for (const [n, key] of KEYS.entries()) expect(beodeulObjectPick([...pool].reverse(), 5, key, "home")).toEqual(picks[n]); // 후보 순서와 무관
    expect(new Set(picks.map((pick) => pick.join())).size).toBe(KEYS.length);
    // 쓰임이 다르면 같은 게임에서도 다른 목록
    expect(beodeulObjectPick(pool, 5, KEYS[0]!, "plaza")).not.toEqual(picks[0]);
    // 열쇠가 없으면 길섶·숲 끝에 더하는 것이 없다
    expect(beodeulVergeObjects(() => true, undefined)).toEqual([]);
    expect(beodeulBayObjects(() => true, undefined)).toEqual([]);
    expect(beodeulVergeObjects(() => true, KEYS[0]).length).toBe(3);
    expect(beodeulVergeObjects(() => false, KEYS[0])).toEqual([]);
  });

  it("길목에 선 기물만 걷어 낸다 — 걷는 땅을 둘로 가르는 것, 나란히 목을 막은 둘 가운데 뒤의 것", () => {
    // '#' 막힌 칸 · '.' 걷는 칸 · 'o' 기물이 선 칸(막힘)
    const cutting = (rows: string[], objects: { x: number; y: number; w: number; h: number }[]) =>
      beodeulObjectsCuttingWays(rows[0]!.length, rows.length, objects, (x, y) => rows[y]?.[x] === ".", () => true);
    // 한 칸 폭 길 한가운데: 양쪽이 갈린다
    expect(cutting(["#######", "...o...", "#######"], [{ x: 3, y: 1, w: 1, h: 1 }])).toEqual([0]);
    // 트인 풀밭 한가운데: 돌아갈 수 있다
    expect(cutting([".....", ".....", "..o..", ".....", "....."], [{ x: 2, y: 2, w: 1, h: 1 }])).toEqual([]);
    // 두 칸 폭 목을 둘이 나란히 막았다: 하나만 걷으면 열린다 — 뒤의 것만 걷는다(하나씩 걷어 보는 검사로는 못 잡는 경우)
    expect(cutting(["#####", "..o..", "..o..", "#####"], [{ x: 2, y: 1, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 }])).toEqual([1]);
    // 막다른 한 칸(위·아래 끝)을 가두는 것도 걷는다
    expect(cutting(["##.##", "..o..", "..o..", "##.##"], [{ x: 2, y: 1, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 }])).toEqual([0, 1]);
    // 디딜 수 없는 사이(단이 다른 칸)는 원래 따로다 — 그 경계에 선 기물은 길목이 아니다
    expect(beodeulObjectsCuttingWays(5, 1, [{ x: 2, y: 0, w: 1, h: 1 }], (x) => x !== 2, (x, _y, nx) => (x < 2) === (nx < 2) && x !== 2 && nx !== 2)).toEqual([]);
  });

  it("조수 실행(게임 열쇠)으로 지은 강가 마을에는 새 기물이 놓이고, 열쇠가 없으면 하나도 없다 — 문 앞 도달·찍기 실패는 같다", () => {
    const plain = village(undefined, "river", 7);
    expect(plain.data.newObjects).toBeUndefined();
    expect(newKitsOn(plain.map)).toEqual([]);
    const a = village(KEYS[0], "river", 7), again = village(KEYS[0], "river", 7), b = village(KEYS[1], "river", 7);
    const kitsA = newKitsOn(a.map), kitsB = newKitsOn(b.map);
    expect(kitsA.length).toBeGreaterThanOrEqual(10);
    expect(Object.values(a.data.newObjects ?? {}).reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(10);
    // 같은 게임·같은 씨앗은 같은 마을이다
    expect(newKitsOn(again.map)).toEqual(kitsA);
    // 게임이 다르면 놓인 종류가 다르다
    expect([...new Set(kitsB)].sort()).not.toEqual([...new Set(kitsA)].sort());
    for (const built of [a, b]) {
      expect(built.data.doors.filter((door) => !door.reached).length).toBe(plain.data.doors.filter((door) => !door.reached).length);
      expect(built.data.stampFailed).toBe(plain.data.stampFailed);
    }
  }, 240_000);

  it("포구 마을의 물 위 것은 모두 물 칸 위에 있다", () => {
    const built = village(KEYS[2], "coast", 7);
    expect((built.data.newObjects?.water ?? 0) + (built.data.newObjects?.shore ?? 0)).toBeGreaterThan(0);
    const meta = built.project.tilesets[built.map.tilesetId]!.tileMeta ?? [];
    let seen = 0;
    for (const item of NEWS.filter((it) => it.on === "water")) {
      const cells = item.rows.flatMap((row, dy) => row.map((tile, dx) => ({ dx, dy, tile })).filter((cell) => cell.tile >= 0));
      for (let y = 0; y + item.rows.length <= built.map.height; y++) for (let x = 0; x + item.rows[0]!.length <= built.map.width; x++) {
        if (!cells.every((cell) => layerTileAt(built.map, 3, (y + cell.dy) * built.map.width + x + cell.dx) === cell.tile)) continue;
        seen += 1;
        for (const cell of cells) {
          const ground = built.map.lowerTiles[(y + cell.dy) * built.map.width + x + cell.dx]!;
          expect(meta[ground]?.tags?.includes("water"), `${item.kit} (${x + cell.dx},${y + cell.dy})`).toBe(true);
        }
      }
    }
    expect(seen).toBe(built.data.newObjects?.water ?? 0);
  }, 240_000);
});
