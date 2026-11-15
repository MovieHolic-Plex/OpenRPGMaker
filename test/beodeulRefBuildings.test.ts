// 버들항 참고 건물 유형(bd-bld-ref-*, 시트 토막 46,464~): 새 사본이 목록의 킷을 모두 갖는지, 칸 표가 선언(막힘·★·통로 바닥)과 같은지, 문·통로 부품이 문 칸에 있는지,
// 빌더용 표(src/assets/beodeulRefBuildings.json)가 킷과 같은지, 태그의 마을 종류 id 가 종류 표에 있는 이름인지.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-refbuildings-beodeul-2026-11-15 (굽기 scripts/content/beodeul-ref-buildings/bake.py).
import { describe, expect, it } from "vitest";
import { BEODEUL_REF_BUILDING_KIT_PREFIX, createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import catalog from "../tiledata/beodeul-ref-buildings/catalog.json";
import table from "../src/assets/beodeulRefBuildings.json";
import kindTable from "../tiledata/beodeul-objects/kinds.json";

const ts = createBeodeulCityTileset();
const kits = (ts.structureKits ?? []).filter((kit) => kit.id.startsWith(BEODEUL_REF_BUILDING_KIT_PREFIX));
const closed = (n: number) => { const p = ts.passability[n]!; return !p.up && !p.down && !p.left && !p.right; };

describe("버들항 참고 건물 유형 토막", () => {
  it("새 사본은 목록의 킷을 순서대로 모두 갖고 칸 번호가 제 토막 안에 있다", () => {
    expect(kits.map((kit) => kit.id)).toEqual(catalog.buildings.map((b) => b.id));
    expect(kits).toHaveLength(44);
    expect(catalog.base).toBe(46464);
    expect(catalog.end % ts.tilesPerRow).toBe(0);
    expect(ts.count).toBeGreaterThanOrEqual(catalog.end);
    const seen = new Set<number>();
    for (const b of catalog.buildings) for (const n of [...b.rows.flat(), ...b.lowerRows.flat()]) {
      if (n < 0) continue;
      expect(n).toBeGreaterThanOrEqual(catalog.base); expect(n).toBeLessThan(catalog.end); expect(seen.has(n)).toBe(false); seen.add(n);
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
