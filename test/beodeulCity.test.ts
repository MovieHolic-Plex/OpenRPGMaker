import { describe, expect, it } from "vitest";
import { BEODEUL_CITY_TILE_COUNT, BEODEUL_TOWN_WALL_BASE, createBeodeulCityTileset, ensureBeodeulCityTileset, BEODEUL_CITY_BASE_COUNT, BEODEUL_PICK_KIT_PREFIX, ensureBeodeulCityReferences, BEODEUL_REF_BUILDING_KIT_PREFIX } from "@/project/defaults/beodeulCity";
import { townWallAvailable } from "@/editor/tools/beodeulTownWall";
import type { StructureKitDef, TilesetDef } from "@/project/types";
import catalog from "../tiledata/beodeul-ref-buildings/catalog.json";
import table from "../src/assets/beodeulRefBuildings.json";
import kindTable from "../tiledata/beodeul-objects/kinds.json";
import { isolateTimers } from "./mergedTeardown";

// 버들항 사본의 이식 칸이 새 번들 꼬리(성벽 28,544~)와 겹치면 새 끝 뒤로 옮기고 맵·킷·changeTile 번호를 같이 고친다(localTailRelocation.ts).
describe("beodeulGraftRelocation", () => {
  isolateTimers();
  /** 성벽 꼬리 전(28,544칸)에 저장되고 그 뒤에 이식 칸 네 개를 붙인 사본. */
  function copyWithGrafts(): TilesetDef {
    const ts = createBeodeulCityTileset();
    const end = BEODEUL_TOWN_WALL_BASE;
    ts.passability = ts.passability.slice(0, end);
    ts.priority = ts.priority.slice(0, end);
    ts.terrain = ts.terrain.slice(0, end);
    ts.tileMeta = ts.tileMeta!.slice(0, end);
    ts.structureKits = (ts.structureKits ?? []).filter((kit) => !kit.id.startsWith("bd-wall-"));
    ts.tileGroups = (ts.tileGroups ?? []).filter((group) => !group.id.startsWith("beodeul:town_wall"));
    ts.tileGrafts = [0, 1, 2, 3].map((k) => ({ targetTile: end + k, sourceChipset: "tex_beodeul_forms", sourceTile: 10 + k }));
    for (let k = 0; k < ts.tilesPerRow; k += 1) {
      ts.passability.push(k === 1 ? { up: false, down: false, left: false, right: false } : { up: true, down: true, left: true, right: true });
      ts.priority.push(k === 2 ? "upper" : "lower");
      ts.terrain.push(0);
      ts.tileMeta!.push({ label: k < 4 ? `이식 ${k}` : "", description: "" });
    }
    ts.count = end + ts.tilesPerRow;
    ts.structureKits = [...ts.structureKits!, { id: "my-kit", name: "내 킷", kind: "section", width: 2, height: 1, tileSize: 16, learnedFrom: "user",
      rows: [{ tiles: [-1, 5], upperTiles: [end + 2, end + 3] }] } as unknown as StructureKitDef];
    return ts;
  }
  describe("버들항 이식 칸 옮기기", () => {
    it("겹치는 이식 칸을 새 번들 끝 뒤로 옮기고 맵·킷·changeTile 을 같이 고친 뒤 성벽 꼬리를 받는다", () => {
      const ts = copyWithGrafts();
      const end = BEODEUL_TOWN_WALL_BASE;
      const tiles = new Array(16).fill(5);
      const upper = new Array(16).fill(-1); upper[3] = end + 1; upper[7] = 12;
      const project = {
        tilesets: { beodeul_city: ts },
        maps: {
          m1: { id: "m1", tilesetId: "beodeul_city", width: 4, height: 4, lowerTiles: tiles, upperTiles: upper, upperOverlayTiles: [...new Array(15).fill(-1), end],
            events: [{ id: "e", pages: [{ commands: [{ kind: "conditional", then: [{ kind: "changeTile", mapId: "m1", layer: "upper", x: 0, y: 0, tile: end + 3 }] }] }] }] },
          other: { id: "other", tilesetId: "forest_harmony", width: 1, height: 1, lowerTiles: [end + 1], upperTiles: [-1], events: [] },
        },
        commonEvents: [{ id: "c", commands: [{ kind: "changeTile", mapId: "m1", layer: "lower", x: 1, y: 1, tile: end }] }],
      };
      expect(ensureBeodeulCityTileset(ts, project as never)).toBe(true);
      const shift = BEODEUL_CITY_TILE_COUNT - end;
      expect(ts.tileGrafts!.map((g) => g.targetTile)).toEqual([0, 1, 2, 3].map((k) => end + shift + k));
      expect(ts.passability[end + shift + 1]).toEqual({ up: false, down: false, left: false, right: false });
      expect(ts.priority[end + shift + 2]).toBe("upper");
      expect(ts.tileMeta![end + shift]!.label).toBe("이식 0");
      expect(ts.tileMeta![end]!.label).toContain("성벽");
      expect(townWallAvailable(ts)).toBe(true);
      const m1 = project.maps.m1;
      expect(m1.upperTiles[3]).toBe(end + shift + 1);
      expect(m1.upperTiles[7]).toBe(12);
      expect(m1.upperOverlayTiles[15]).toBe(end + shift);
      expect(m1.events[0]!.pages[0]!.commands[0]!.then[0]!.tile).toBe(end + shift + 3);
      expect(project.commonEvents[0]!.commands[0]!.tile).toBe(end + shift);
      expect(project.maps.other.lowerTiles[0]).toBe(end + 1);
      const kit = ts.structureKits!.find((k) => k.id === "my-kit")!;
      expect(kit.rows[0]!.upperTiles).toEqual([end + shift + 2, end + shift + 3]);
      expect(kit.rows[0]!.tiles).toEqual([-1, 5]);
      // 두 번째 실행은 아무것도 바꾸지 않는다
      expect(ensureBeodeulCityTileset(ts, project as never)).toBe(false);
    });

    it("프로젝트 없이 부르면 예전처럼 겹치는 꼬리를 받지 않는다", () => {
      const ts = copyWithGrafts();
      ensureBeodeulCityTileset(ts);
      expect(ts.tileGrafts![0]!.targetTile).toBe(BEODEUL_TOWN_WALL_BASE);
      expect(townWallAvailable(ts)).toBe(false);
    });
  });
});

// 버들항 고른 조각(bd-pick-*) — 시트 꼬리 덧붙이기가 새 사본과 옛 사본 모두에 들어가는지, 앞 칸은 그대로인지.
describe("beodeulPickedParts", () => {
  isolateTimers();
  /** 고른 조각이 굽기 전의 사본(23,936칸, bd-pick-* 키트·용도 없음)을 흉내 낸다. */
  function oldCopy(): TilesetDef {
    const ts = createBeodeulCityTileset();
    const base = BEODEUL_CITY_BASE_COUNT;
    ts.count = base;
    ts.passability = ts.passability.slice(0, base);
    ts.priority = ts.priority.slice(0, base);
    ts.terrain = ts.terrain.slice(0, base);
    ts.tileMeta = ts.tileMeta!.slice(0, base);
    ts.animationStrips = (ts.animationStrips ?? []).filter(strip => strip.baseTile < base);
    ts.structureKits = (ts.structureKits ?? []).filter(kit => !kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX));
    ts.autotileGroups = (ts.autotileGroups ?? []).filter(group => group.id !== "beodeul_snow_road");
    ts.referenceDocuments = (ts.referenceDocuments ?? []).filter(cat => !cat.id.startsWith("beodeul-picks-"));
    // 새 사본은 시트 끝 뒤에 형태·검수·매싱 건물 이식 칸(tileGrafts)을 갖고 태어난다 — 옛 사본에는 그 칸이 없다.
    ts.tileGrafts = (ts.tileGrafts ?? []).filter(graft => graft.targetTile < base);
    return ts;
  }
  describe("버들항 고른 조각", () => {
    it("새 사본은 꼬리 칸·bd-pick 키트·beodeul-picks 용도를 갖고 태어난다", () => {
      const ts = createBeodeulCityTileset();
      expect(BEODEUL_CITY_TILE_COUNT).toBeGreaterThan(BEODEUL_CITY_BASE_COUNT);
      expect(ts.count % ts.tilesPerRow).toBe(0);
      const picks = (ts.structureKits ?? []).filter(kit => kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX));
      expect(picks.length).toBeGreaterThan(100);
      for (const kit of picks) {
        expect(kit.rows).toHaveLength(kit.height);
        for (const row of kit.rows) {
          for (const t of [...row.tiles, ...(row.upperTiles ?? [])]) {
            if (t >= 0) { expect(t).toBeGreaterThanOrEqual(BEODEUL_CITY_BASE_COUNT); expect(t).toBeLessThan(ts.count); }
          }
        }
      }
      const cats = (ts.referenceDocuments ?? []).filter(cat => cat.id.startsWith("beodeul-picks-"));
      expect(cats.map(cat => cat.id).sort()).toEqual(
        ["beodeul-picks-climate-village", "beodeul-picks-dungeon", "beodeul-picks-field", "beodeul-picks-special", "beodeul-picks-village"]);
      for (const cat of cats) for (const image of cat.images) expect(image.dataUrl.startsWith("/assets/")).toBe(true);
    });

    it("옛 사본은 앞 칸을 그대로 두고 꼬리·키트·용도만 덧붙는다(저자 키트는 남는다)", () => {
      const ts = oldCopy();
      const authored = { ...structuredClone(ts.structureKits![0]!), id: "my-kit" } as StructureKitDef;
      ts.structureKits = [...ts.structureKits!, authored];
      ts.passability[5] = { up: true, down: true, left: true, right: true };       // 저자가 고친 앞 칸
      const before = structuredClone(ts.passability.slice(0, BEODEUL_CITY_BASE_COUNT));
      expect(ensureBeodeulCityTileset(ts)).toBe(true);
      expect(ensureBeodeulCityReferences(ts)).toBe(true);
      const fresh = createBeodeulCityTileset();
      // ensureBeodeulCityTileset 은 번들 시트 끝(BEODEUL_CITY_TILE_COUNT)까지 맞춘다. 그 뒤 이식 칸은 형태·검수·매싱 ensure 의 몫이다.
      expect(ts.count).toBe(BEODEUL_CITY_TILE_COUNT);
      expect(ts.passability.slice(0, BEODEUL_CITY_BASE_COUNT)).toEqual(before);
      expect(ts.passability.slice(BEODEUL_CITY_BASE_COUNT)).toEqual(fresh.passability.slice(BEODEUL_CITY_BASE_COUNT, BEODEUL_CITY_TILE_COUNT));
      expect(ts.tileMeta).toHaveLength(BEODEUL_CITY_TILE_COUNT);
      expect(ts.structureKits!.some(kit => kit.id === "my-kit")).toBe(true);
      expect(ts.structureKits!.filter(kit => kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX)).length)
        .toBe(fresh.structureKits!.filter(kit => kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX)).length);
      expect((ts.referenceDocuments ?? []).some(cat => cat.id === "beodeul-picks-dungeon")).toBe(true);
      // 주제 2 꼬리의 설원 눈길 오토타일은 칸과 함께 기존 사본에도 들어간다(폴른 스타 서리나루 길이 이 그룹을 찾는다).
      const road = (ts.autotileGroups ?? []).find(group => group.id === "beodeul_snow_road");
      expect(road?.memberTileIds.length).toBeGreaterThan(0);
      expect(road).toEqual(fresh.autotileGroups!.find(group => group.id === "beodeul_snow_road"));
      // 두 번째 실행은 아무것도 바꾸지 않는다
      expect(ensureBeodeulCityTileset(ts)).toBe(false);
      expect(ensureBeodeulCityReferences(ts)).toBe(false);
    });
  });
});

// 버들항 참고 건물 유형(bd-bld-ref-*, 시트 토막 46,464~): 새 사본이 목록의 킷을 모두 갖는지, 칸 표가 선언(막힘·★·통로 바닥)과 같은지, 문·통로 부품이 문 칸에 있는지,
// 빌더용 표(src/assets/beodeulRefBuildings.json)가 킷과 같은지, 태그의 마을 종류 id 가 종류 표에 있는 이름인지.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-refbuildings-beodeul-2026-11-15 (굽기 scripts/content/beodeul-ref-buildings/bake.py).
describe("beodeulRefBuildings", () => {
  isolateTimers();
  const ts = createBeodeulCityTileset();
  const kits = (ts.structureKits ?? []).filter((kit) => kit.id.startsWith(BEODEUL_REF_BUILDING_KIT_PREFIX));
  const closed = (n: number) => { const p = ts.passability[n]!; return !p.up && !p.down && !p.left && !p.right; };
  describe("버들항 참고 건물 유형 토막", () => {
    it("새 사본은 목록의 킷을 순서대로 모두 갖고 칸 번호가 제 토막 안에 있다", () => {
      expect(kits.map((kit) => kit.id)).toEqual(catalog.buildings.map((b) => b.id));
      expect(kits).toHaveLength(48);   // 44 + 초대형 넷(성 본채 · 마을 대성당 · 수도원 · 큰 세관 — 둘째 토막)
      expect(catalog.base).toBe(46464);
      expect(catalog.end % ts.tilesPerRow).toBe(0);
      expect(ts.count).toBeGreaterThanOrEqual(catalog.end);
      const seen = new Set<number>();
      for (const b of catalog.buildings) for (const n of [...b.rows.flat(), ...b.lowerRows.flat()]) {
        if (n < 0) continue;
        const big = catalog as unknown as { bigBase?: number; bigEnd?: number };
        const inFirst = n >= catalog.base && n < catalog.end, inBig = big.bigBase !== undefined && n >= big.bigBase && n < big.bigEnd!;
        expect(inFirst || inBig, `${b.id} ${n}`).toBe(true); expect(seen.has(n)).toBe(false); seen.add(n);
      }
    });

    it("칸 표가 선언과 같다: 막힌 칸은 닫히고 지붕·처마 칸은 열린 윗층, 통로 바닥은 열린 아래층", () => {
      for (const b of catalog.buildings) {
        const kit = kits.find((k) => k.id === b.id)!;
        expect([kit.width, kit.height]).toEqual([b.width, b.height]);
        expect(kit.rows.map((row) => row.upperTiles)).toEqual(b.rows);
        expect(kit.rows.map((row) => row.tiles)).toEqual(b.lowerRows);
        const blocked = new Set(b.blocked.map(([x, y]) => `${x},${y}`));
        const passage = new Set((b.passage as number[][]).map(([x, y]) => `${x},${y}`));
        b.rows.forEach((row, y) => row.forEach((n, x) => {
          if (n < 0) return;
          expect(passage.has(`${x},${y}`), `${b.id} (${x},${y})`).toBe(false);
          expect(closed(n), `${b.id} (${x},${y})`).toBe(blocked.has(`${x},${y}`));
          expect(ts.priority[n]).toBe("upper");
        }));
        b.lowerRows.forEach((row, y) => row.forEach((n, x) => {
          if (n < 0) return;
          expect(passage.has(`${x},${y}`), `${b.id} (${x},${y})`).toBe(true);
          expect(closed(n)).toBe(false);
          expect(ts.priority[n]).toBe("lower");
        }));
      }
    });

    it("문 부품은 문 칸(두 칸 높이, 문 폭)에 있고 문 칸은 막힌다. 통로 킷은 맨 아랫줄 통로 칸이 부품이다", () => {
      for (const b of catalog.buildings) {
        const kit = kits.find((k) => k.id === b.id)!;
        const part = kit.parts?.[0];
        if ((b.passage as number[][]).length) {
          expect(part).toMatchObject({ id: "gate", kind: "entrance", dy: b.height - 1, h: 1 });
          for (const [x, y] of b.passage as number[][]) expect(b.blocked.some(([bx, by]) => bx === x && by === y)).toBe(false);
        } else if (b.door) {
          expect(part).toMatchObject({ id: "door", kind: "entrance", dx: b.door[0], dy: b.door[1] - 1, w: b.doorw, h: 2 });
          expect(b.door[1]).toBe(b.height - 1);
          for (let x = b.door[0]; x < b.door[0] + b.doorw; x++) expect(b.blocked.some(([bx, by]) => bx === x && by === b.door![1])).toBe(true);
          expect(kit.ai?.role).toBe("building");
        } else {
          expect(kit.parts).toBeUndefined();
          expect(kit.ai?.role).toBe("prop");
        }
      }
    });

    it("빌더용 표가 킷과 같고, 태그의 갈래·터·급·양식·마을 종류가 표와 같다(마을 종류 id 는 종류 표의 이름)", () => {
      expect(table.buildings.map((b) => b.id)).toEqual(kits.map((kit) => kit.id));
      const names = new Set(Object.keys(kindTable.names));
      for (const b of table.buildings) {
        const tags = kits.find((k) => k.id === b.id)!.ai!.tags!;
        expect(tags).toContain(`cat:${b.cat}`); expect(tags).toContain(`setting:${b.setting}`); expect(tags).toContain(`tier:${b.tier}`); expect(tags).toContain(`style:${b.style}`);
        expect(b.kinds.length).toBeGreaterThan(0);
        for (const kind of b.kinds) { expect(names.has(kind), `${b.id} ${kind}`).toBe(true); expect(tags).toContain(`kind:${kind}`); }
      }
    });

    it("지붕 옆선은 수직이다(편차 1px 이하 — 탑 뾰족지붕은 세모라 재지 않는다)", () => {
      for (const b of catalog.buildings) expect(b.roofSideDeviationPx, b.id).toBeLessThanOrEqual(1);
    });
  });
});
