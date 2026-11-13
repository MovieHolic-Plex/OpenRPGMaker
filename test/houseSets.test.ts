// 집 벌(assets/houseSets.ts · project/houseSetKit.ts): 게임마다 집 그림 가족을 통째로 갈아 끼운다.
// 벌은 원본 킷과 «같은 칸 크기 · 같은 문 칸 · 같은 막힌 칸» 그림이라 배치·통행·도달이 달라지면 안 되고,
// 겉모습이 없는 프로젝트(옛 저장본·사람 편집)는 원본 칸 그대로여야 한다. 같은 벌 안에서는 집마다(자리마다) 변형이 갈린다.
import { describe, expect, it } from "vitest";
import sets from "@/assets/beodeulHouseSets.json";
import { houseSetCovers, houseSetNames, houseSetTableFor } from "@/assets/houseSets";
import { tilesetLookOptions, tilesetLookTableFor } from "@/assets/tilesetLooks";
import { bundledChipsetFrameCount, BUNDLED_REFERENCE_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { createBlankProject } from "@/project/defaults";
import { houseSetBaseTiles, houseSetKit } from "@/project/houseSetKit";
import { lookKit, withKitLook, withKitSite, withoutHouseSet } from "@/project/kitLook";
import { isPassable } from "@/project/collision";
import { layerTileAt } from "@/project/mapLayers";
import { runTool } from "@/editor/tools";
import { harmonizeBeodeulDaylight } from "@/editor/tools/beodeulLightTools";
import { detectPlacedMapObjects } from "@/editor/stampPlaceRunner";
import { buildingEntrances, placeMarks } from "@/ai/v2/place/entrances";
import { resolveWhere } from "@/ai/v2/place/where";
import { coveredCell } from "@/ai/v2/place/underRoof";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "@/project/types";

const TS = "beodeul_city";
const table = houseSetTableFor(TS)!;
const SETS = houseSetNames(TS);
const KEY = JSON.stringify(["project", "house-set-game"]);
const lookTable = tilesetLookTableFor(TS)!;

/** 강가 마을 한 판(조수의 마을 도구 그대로 — 집 놓기 · 바닥 꾸밈 · 낮 빛 맞춤까지). look 을 주면 그 겉모습을 미리 적어 고정한다. */
function village(look: { houses?: string; plaza?: string } | undefined, key: string | undefined, seed = 4242, extra: Record<string, unknown> = {}): { project: Project; map: GameMap; summary: string } {
  const project = createBlankProject() as Project;
  if (look) project.tilesets[TS]!.look = { textureKey: lookTable.texture, ...look };
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(key ? { lookKey: key } : {}) } as ToolContext;
  const res = runTool(ctx, "author_beodeul_town", { theme: "river", seed, ...extra });
  expect(res.ok, res.summary).toBe(true);
  return { project: ctx.project, map: ctx.project.maps[(res.data as { mapId: string }).mapId]!, summary: res.summary };
}
const setTiles = (ts: TilesetDef): Set<number> => new Set((ts.tileGrafts ?? []).filter((graft) => graft.sourceChipset === table.texture).map((graft) => graft.targetTile));
const setCellsOnMap = (project: Project, map: GameMap): number => {
  const tiles = setTiles(project.tilesets[TS]!);
  let n = 0;
  for (let i = 0; i < map.width * map.height; i += 1) if (tiles.has(layerTileAt(map, 3, i))) n += 1;
  return n;
};
const kitTile = (kit: StructureKitDef, x: number, y: number): number => { const up = kit.rows[y]?.upperTiles?.[x] ?? -1; return up >= 0 ? up : kit.rows[y]?.tiles?.[x] ?? -1; };

describe("집 벌 — 게임마다 다른 집 그림 가족", () => {
  it("표: 벌 넷이 같은 킷을 덮고, 킷마다 변형이 둘 이상, 칸 번호는 그림판 안이며 그림마다 따로다", () => {
    expect(table.tilesetId).toBe(TS);
    expect(sets.gate).toContain("owner waiver");
    expect(sets.gate).not.toContain("DEV");
    expect(BUNDLED_REFERENCE_CHIPSET_ASSETS.some((asset) => asset.textureKey === table.texture)).toBe(true);
    expect(bundledChipsetFrameCount(table.texture)).toBe(table.count);
    expect(bundledChipsetTilesPerRow(table.texture)).toBe(table.tilesPerRow);
    expect(SETS.length).toBeGreaterThanOrEqual(4);
    // 겉모습 표의 집 선택지와 벌 표가 같은 이름이다(원래 가족 "" 은 벌 표에 없다)
    expect([...tilesetLookOptions(lookTable, "houses")].filter(Boolean).sort()).toEqual([...SETS].sort());
    const ts = (createBlankProject() as Project).tilesets[TS]!;
    const kits = new Map((ts.structureKits ?? []).map((kit) => [kit.id, kit]));
    const covered = Object.keys(table.sets[SETS[0]!]!.kits).sort();
    expect(covered.length).toBeGreaterThanOrEqual(40);
    for (const set of SETS) {
      expect(Object.keys(table.sets[set]!.kits).sort()).toEqual(covered);
      const owner = new Map<number, string>();   // 그림판 칸 → 그 칸을 쓰는 (킷의 그림 · 자리)
      for (const [kitId, variants] of Object.entries(table.sets[set]!.kits)) {
        const kit = kits.get(kitId)!;
        expect(kit, kitId).toBeDefined();
        expect(variants.length).toBeGreaterThanOrEqual(2);
        expect(variants.length).toBeLessThanOrEqual(3);
        variants.forEach((rows, v) => {
          expect(rows.length).toBe(kit.height);
          rows.forEach((row, y) => {
            expect(row.length).toBe(kit.width);
            row.forEach((cell, x) => {
              const base = kitTile(kit, x, y);
              if (base < 0) { expect(cell).toBe(-1); return; }   // 원본이 비운 칸에는 그림이 없다
              expect(cell === -2 || cell > 0).toBe(true);        // 원본 칸 그대로(문 앞 포석) 또는 벌 그림 칸
              if (cell < 0) return;
              expect(cell).toBeLessThan(table.count);
              // 같은 그림을 쓰는 킷끼리만 칸을 나눈다 — 칸 하나는 한 그림의 한 자리(원본 칸으로 되짚을 수 있어야 한다)
              const at = `${v}|${x}|${y}|${base}`;
              if (owner.has(cell)) expect(owner.get(cell)).toBe(at); else owner.set(cell, at);
            });
          });
        });
      }
    }
    expect(houseSetCovers(TS, SETS[0], "bd-house-inn")).toBe(true);
    expect(houseSetCovers(TS, undefined, "bd-house-inn")).toBe(false);
    expect(houseSetCovers(TS, SETS[0], "bd-prop-well_roofed")).toBe(false);
  });

  it("갈아 끼운 킷: id·이름·부품·칸 크기 그대로, 통행·위아래는 원본 칸 것, 벌 칸은 원본 칸으로 되짚인다", () => {
    const ts = (createBlankProject() as Project).tilesets[TS]!;
    const before = ts.count;
    for (const kitId of ["bd-house-inn", "bd-house-h112_0", "bd-house-mk-tower-house", "bd-farm-barn"]) {
      const kit = ts.structureKits!.find((k) => k.id === kitId)!;
      for (const set of SETS) {
        const swapped = houseSetKit(ts, kit, set, 1)!;
        expect(swapped.id).toBe(kit.id);
        expect(swapped.name).toBe(kit.name);
        expect(swapped.parts).toEqual(kit.parts);
        expect([swapped.width, swapped.height]).toEqual([kit.width, kit.height]);
        const reverse = houseSetBaseTiles(ts);
        let changed = 0;
        for (let y = 0; y < kit.height; y += 1) for (let x = 0; x < kit.width; x += 1) {
          const base = kitTile(kit, x, y), now = kitTile(swapped, x, y);
          expect(now >= 0).toBe(base >= 0);
          if (base < 0 || now === base) continue;
          changed += 1;
          expect(ts.passability[now]).toEqual(ts.passability[base]);
          expect(ts.priority[now]).toEqual(ts.priority[base]);
          expect(reverse.get(now)).toBe(base);
        }
        expect(changed).toBeGreaterThan(kit.width);
      }
    }
    expect(ts.count).toBeGreaterThan(before);   // 벌 칸은 이식 칸으로 붙는다
    // 덮지 않는 킷 · 없는 벌은 바꾸지 않는다
    expect(houseSetKit(ts, ts.structureKits!.find((k) => k.id === "bd-prop-well_roofed")!, SETS[0]!)).toBeUndefined();
    expect(houseSetKit(ts, ts.structureKits!.find((k) => k.id === "bd-house-inn")!, "no-such-set")).toBeUndefined();
  });

  it("같은 벌 안 변형: 집마다(자리마다) 갈리고, 같은 게임·같은 자리는 늘 같은 그림 · 열쇠가 없으면 원본", () => {
    const project = createBlankProject() as Project;
    const ts = project.tilesets[TS]!;
    ts.look = { textureKey: lookTable.texture, houses: SETS[1]! };
    const kit = ts.structureKits!.find((k) => k.id === "bd-house-h112_0")!;
    expect(lookKit(ts, kit)).toBe(kit);   // 실행 구간 밖(사람 편집)
    const first = (site: string, key = KEY) => withKitLook(key, () => withKitSite(site, () => kitTile(lookKit(ts, kit), 0, 1)));
    const sites = Array.from({ length: 24 }, (_, n) => `map|${n * 7}|${n * 3}`);
    const picks = sites.map((site) => first(site));
    expect(sites.map((site) => first(site))).toEqual(picks);
    expect(new Set(picks).size).toBe(table.sets[SETS[1]!]!.kits[kit.id]!.length);   // 스물네 자리면 변형이 다 나온다
    for (const tile of picks) expect(tile).not.toBe(kitTile(kit, 0, 1));
    // 다른 게임은 같은 자리에서도 따로 고른다
    const other = sites.map((site) => first(site, JSON.stringify(["project", "another-game"])));
    expect(other).not.toEqual(picks);
    // 지붕 가족을 직접 말한 요청 구간에서는 갈아 끼우지 않는다
    expect(withKitLook(KEY, () => withoutHouseSet(() => lookKit(ts, kit)))).toBe(kit);
    // 겉모습에 벌이 없으면 원본
    ts.look = { textureKey: lookTable.texture, woods: "wall" };
    expect(withKitLook(KEY, () => lookKit(ts, kit))).toBe(kit);
  });

  it("마을: 벌을 고른 게임은 겉모습 없는 판과 건물 자리·통행이 같고 집 칸만 벌 그림이다 · 도구가 벌 집을 같은 집으로 알아본다", () => {
    const plain = village(undefined, undefined);
    const set = SETS[2]!;
    const looked = village({ houses: set }, KEY);
    expect(setCellsOnMap(plain.project, plain.map)).toBe(0);
    expect((plain.project.tilesets[TS]!.tileGrafts ?? []).some((graft) => graft.sourceChipset === table.texture)).toBe(false);
    expect(setCellsOnMap(looked.project, looked.map)).toBeGreaterThan(100);
    expect([looked.map.width, looked.map.height]).toEqual([plain.map.width, plain.map.height]);
    const spots = (map: GameMap) => (map.structurePlacements ?? []).filter((p) => houseSetCovers(TS, set, p.kitId)).map((p) => `${p.kitId}@${p.x},${p.y}`).sort();
    expect(spots(looked.map)).toEqual(spots(plain.map));
    expect(spots(looked.map).length).toBeGreaterThan(3);
    for (let y = 0; y < plain.map.height; y += 1) for (let x = 0; x < plain.map.width; x += 1) expect(isPassable(looked.project, looked.map, x, y)).toBe(isPassable(plain.project, plain.map, x, y));
    // 결과 글: 지붕 이름 자리에 벌 이름이 온다(모델이 읽는 글에서 달라지는 것은 이것 하나)
    expect(looked.summary).toContain(table.sets[set]!.label);
    expect(plain.summary).not.toContain(table.sets[set]!.label);
    // 한 마을 안에서 변형이 둘 이상 쓰인다
    const cellVariant = new Map<number, number>();
    for (const variants of Object.values(table.sets[set]!.kits)) variants.forEach((rows, v) => rows.forEach((row) => row.forEach((cell) => { if (cell >= 0 && !cellVariant.has(cell)) cellVariant.set(cell, v); })));
    const source = new Map((looked.project.tilesets[TS]!.tileGrafts ?? []).filter((graft) => graft.sourceChipset === table.texture).map((graft) => [graft.targetTile, graft.sourceTile]));
    const used = new Set<number>();
    for (let i = 0; i < looked.map.width * looked.map.height; i += 1) { const cell = source.get(layerTileAt(looked.map, 3, i)); if (cell !== undefined) used.add(cellVariant.get(cell)!); }
    expect(used.size).toBeGreaterThanOrEqual(2);
    // 집 보기 도구: 벌 집도 원본 킷으로 센다(같은 채 수)
    const seen = (project: Project, map: GameMap) => {
      const res = runTool({ project, currentMapId: map.id }, "look_at_houses", { mapId: map.id });
      expect(res.ok).toBe(true);
      return (res.data as { houses: { kitId: string; bbox: { x: number; y: number } }[] }).houses.map((h) => `${h.kitId}@${h.bbox.x},${h.bbox.y}`).sort();
    };
    const plainHouses = seen(plain.project, plain.map);
    expect(seen(looked.project, looked.map)).toEqual(plainHouses);
    expect(plainHouses.length).toBeGreaterThan(2);
    // 낮 빛 맞춤: 마을 짓기가 이미 넣었다 — 그림자·잔디 칸 수가 겉모습 없는 판과 같다(벌 집을 못 알아보면 그 집의 그림자가 빠진다)
    const lit = (project: Project, map: GameMap) => {
      const ground = new Set((project.tilesets[TS]!.tileGrafts ?? []).filter((graft) => graft.sourceChipset === "tex_beodeul_ground").map((graft) => graft.targetTile));
      let n = 0;
      for (let i = 0; i < map.width * map.height; i += 1) if (ground.has(layerTileAt(map, 2, i))) n += 1;
      return n;
    };
    expect(lit(looked.project, looked.map)).toBe(lit(plain.project, plain.map));
    expect(lit(plain.project, plain.map)).toBeGreaterThan(0);
    // 다시 맞춰 보면 벌 집도 원본 킷과 같은 자리의 같은 집으로 잡힌다
    const anchors = (project: Project, map: GameMap) => {
      const data = harmonizeBeodeulDaylight(structuredClone(project), map.id, { roads: false, meadow: false }).data as { anchors?: unknown[] };
      expect(data.anchors?.length).toBeGreaterThan(0);
      return JSON.stringify(data.anchors);
    };
    expect(anchors(looked.project, looked.map)).toBe(anchors(plain.project, plain.map));
  }, 480_000);

  it("입구·건물 찾기: 벌 마을의 집 문·건물 칸·놓인 집이 같은 게임의 벌 없는 마을과 같다(v2 가 문을 잇고 잠그는 자리)", () => {
    const same = village({}, KEY), looked = village({ houses: SETS[3]! }, KEY);
    expect(setCellsOnMap(looked.project, looked.map)).toBeGreaterThan(100);
    const doors = (v: { project: Project; map: GameMap }) => buildingEntrances(v.project, v.map).map((e) => `${e.x},${e.y},${e.kit}`);
    expect(doors(looked)).toEqual(doors(same));
    expect(doors(same).length).toBeGreaterThan(3);
    expect(Array.from(placeMarks(looked.project, looked.map).buildings)).toEqual(Array.from(placeMarks(same.project, same.map).buildings));
    // 지우기·옮기기 도구가 맵에서 집을 찾는 길: 기록이 없어도 칸 무늬로 같은 집을 찾는다
    const found = (v: { project: Project; map: GameMap }) => { const map = structuredClone(v.map); map.structurePlacements = []; return detectPlacedMapObjects(map, v.project.tilesets[TS]).filter((o) => /^bd-(house|farm)-/.test(o.kitId ?? "")).map((o) => `${o.kitId}@${o.x},${o.y}`).sort(); };
    expect(found(looked)).toEqual(found(same));
    expect(found(same).length).toBeGreaterThan(3);
  }, 480_000);

  it("지붕 가족을 직접 말한 마을은 말한 그림 그대로 짓는다(벌로 갈아 끼우지 않는다) — 결과 글도 벌 없는 게임과 같다", () => {
    const asked = village({ houses: SETS[0]! }, KEY, 4242, { roofs: "slate" });
    expect(setCellsOnMap(asked.project, asked.map)).toBe(0);
    expect(asked.summary).not.toContain(table.sets[SETS[0]!]!.label);
    expect(asked.summary).toBe(village({}, KEY, 4242, { roofs: "slate" }).summary);
  }, 480_000);

  it("문 열림 도구는 벌 집 문을 알아보고 까닭을 말하며 거절한다(원본 문 그림 시트를 덮지 않는다)", () => {
    const project = createBlankProject() as Project;
    const ts = project.tilesets[TS]!;
    ts.look = { textureKey: lookTable.texture, houses: SETS[0]! };
    const mapId = project.startMapId, map = project.maps[mapId]!;
    const kit = ts.structureKits!.find((k) => k.id === "bd-house-h101_0")!;
    const door = kit.parts!.find((part) => part.kind === "entrance")!;
    const ctx = { project, currentMapId: mapId, assistantRun: true, lookKey: KEY } as ToolContext;
    const stamped = runTool(ctx, "stamp_object", { objectId: `kit:${TS}/${kit.id}`, mapId, x: 4, y: 4 });
    expect(stamped.ok, stamped.summary).toBe(true);
    const next = ctx.project;
    const at = { x: 4 + door.dx, y: 4 + door.dy + door.h };
    const inside = structuredClone(next.maps[mapId]!); inside.id = "inside"; inside.events = [];
    next.maps.inside = inside;
    next.maps[mapId]!.events.push({ id: "ev_door", x: at.x, y: at.y, trigger: { kind: "playerTouch" }, commands: [], pages: [{ id: "p1", name: "문", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, animationType: "fixedGraphic", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: "inside", x: 2, y: 2 }] }] } as never);
    expect(setTiles(next.tilesets[TS]!).has(next.maps[mapId]!.upperTiles[(at.y - 2) * map.width + at.x]!)).toBe(true);
    const res = runTool({ project: next, currentMapId: mapId }, "apply_beodeul_door_animation", { mapId, eventId: "ev_door" });
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res.issues ?? [])).toContain("house-set-door");
    expect(`${res.summary} ${JSON.stringify(res.issues ?? [])}`).toContain("house set");
  }, 120_000);

  it("광장 구성: 고른 게임마다 가운데 기물이 다르고 우물은 남는다 · 고르지 않은 게임은 원래 광장", () => {
    const count = (map: GameMap, kit: RegExp) => (map.structurePlacements ?? []).filter((p) => kit.test(p.kitId)).length;
    const centre: Record<string, RegExp> = { round: /fountain/, market: /column_monument/, green: /^bd-tree-d43edd/, statue: /statue/ };
    expect([...tilesetLookOptions(lookTable, "plaza")].filter(Boolean).sort()).toEqual(Object.keys(centre).sort());
    const classic = village({}, KEY).map;
    expect(count(classic, /well/)).toBe(1);
    for (const kit of Object.values(centre)) expect(count(classic, kit)).toBe(0);
    for (const plaza of ["round", "market", "statue"]) {
      const { project, map: built } = village({ plaza }, KEY);
      expect(count(built, /well/), plaza).toBe(1);
      for (const [name, kit] of Object.entries(centre)) expect(count(built, kit), `${plaza}/${name}`).toBe(name === plaza ? 1 : 0);
      // 광장에 세우는 사람은 가운데 기물의 머리 그림 밑(걸을 수 있지만 윗층 그림이 덮는 칸)에 서지 않는다 — 가려지고, 끝맺음이 옮기면 출구 마감을 한 번 더 쓴다.
      const taken: { x: number; y: number }[] = [];
      for (const word of ["광장", "광장", "우물 옆"]) {
        const spot = resolveWhere(project, built, word, { avoid: taken }).cell;
        taken.push(spot);
        expect(coveredCell(project, built, spot.x, spot.y), `${plaza}/${word} (${spot.x},${spot.y})`).toBe(false);
      }
    }
  }, 480_000);
});
