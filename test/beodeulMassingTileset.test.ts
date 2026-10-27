import { describe, expect, it } from "vitest";
import catalog from "@/assets/beodeulMassingCatalog.json";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetFrameCount } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { createBeodeulMassingTileset } from "@/project/defaults/beodeulMassing";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "@/editor/tools/authorBeodeulTown";
import { layerTileAt } from "@/project/mapLayers";

/**
 * building-kit massing(bk-massing-100 → 손 도트 건물)의 공용 번들: 위임 허용한 건물만 든 시트가
 * 모든 새 프로젝트에 있고, beodeul_city 에 키트·통행이 이식되어 조수가 bd-house-mk-* 로 놓을 수 있다.
 */
describe("beodeul_massing bundle", () => {
  const buildings = catalog.buildings as { id: string; width: number; height: number; rows: number[][]; blocked: number[][]; parts: { dx: number; dy: number; w: number; h: number }[] }[];

  it("번들 자산과 칸 수가 카탈로그와 같다", () => {
    expect(BUNDLED_EASYRPG_CHIPSET_ASSETS.some((a) => a.textureKey === "tex_beodeul_massing")).toBe(true);
    expect(bundledChipsetFrameCount("tex_beodeul_massing")).toBe(catalog.count);
    expect(buildings.length).toBeGreaterThan(0);
  });

  it("새 프로젝트가 시트를 갖고, beodeul_city 에 건물 키트(본체·그림자·기초)가 이식된다", () => {
    const p = createBlankProject();
    expect(p.tilesets.beodeul_massing?.count).toBe(catalog.count);
    const city = p.tilesets.beodeul_city!;
    for (const b of buildings) {
      const kid = b.id.slice("bd-house-mk-".length);
      const body = city.structureKits!.find((k) => k.id === b.id)!;
      expect(body, b.id).toBeTruthy();
      expect([body.width, body.height]).toEqual([b.width, b.height]);
      expect(city.structureKits!.some((k) => k.id === `bd-mk-shadow-${kid}`)).toBe(true);
      expect(city.structureKits!.some((k) => k.id === `bd-mk-foundation-${kid}`)).toBe(true);
      // 이식된 칸의 통행: 막힌 칸은 막히고, 처마(그림 있는 나머지)는 열려 있다
      const blocked = new Set(b.blocked.map(([x, y]) => `${x},${y}`));
      for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
        const n = body.rows[y]!.upperTiles![x]!;
        if (n < 0) continue;
        const pass = city.passability[n]!;
        expect(pass.up && pass.down && pass.left && pass.right, `${b.id} ${x},${y}`).toBe(!blocked.has(`${x},${y}`));
      }
      // 문 하나, 문 아랫칸 = 그 문 아래 땅선(groundLines). 앞이 들어간 ㄷ자 건물(manor, #3514)은 가운데 땅선이 맨 아랫줄보다 한 줄 위다.
      expect(body.parts?.length).toBe(1);
      const d = b.parts[0]!;
      const lines = (b as { groundLines: number[][] }).groundLines;
      expect(lines.some(([x0, x1, y]) => d.dx >= x0! && d.dx + d.w - 1 <= x1! && y === d.dy + d.h - 1), b.id).toBe(true);
    }
  });

  it("옛 프로젝트(시트 없음)도 ensureBundledTilesets 로 받는다", () => {
    const p = createBlankProject();
    delete p.tilesets.beodeul_massing;
    const city = p.tilesets.beodeul_city!;
    city.structureKits = city.structureKits!.filter((k) => !k.id.startsWith("bd-house-mk-") && !k.id.startsWith("bd-mk-"));
    expect(ensureBundledTilesets(p)).toBe(true);
    expect(p.tilesets.beodeul_massing?.count).toBe(catalog.count);
    expect(p.tilesets.beodeul_city!.structureKits!.filter((k) => k.id.startsWith("bd-house-mk-")).length).toBe(buildings.length);
  });

  it("키트 설명이 위임 허용 출처를 말한다(사람 클릭으로 적지 않는다)", () => {
    const ts = createBeodeulMassingTileset();
    const k = ts.structureKits!.find((x) => x.id.startsWith("bd-house-mk-"))!;
    expect(k.ai?.description).toContain("사용자 위임");
    expect(k.ai?.tags).not.toContain("사람이 허용");
  });

  it("조수 도구 author_beodeul_town roofs medieval 이 검수 통과 건물을 그림자·기초와 함께 놓는다", () => {
    const p = createBlankProject();
    const r = AUTHOR_BEODEUL_TOWN_TOOL.run(p as never, { roofs: "medieval", theme: "river", width: 64, height: 48, seed: 7 }) as { data: { mapId: string; roofs: string; doors: { kit: string; x: number; y: number; reached: boolean }[] } };
    expect(r.data.roofs).toBe("medieval");
    const mk = r.data.doors.filter((d) => d.kit.startsWith("bd-house-mk-"));
    expect(mk.length).toBeGreaterThan(0);
    expect(mk.every((d) => d.reached)).toBe(true);
    const m = p.maps[r.data.mapId]!;
    const city = p.tilesets.beodeul_city!;
    const shadowTiles = new Set(city.structureKits!.filter((k) => k.id.startsWith("bd-mk-shadow-")).flatMap((k) => k.rows.flatMap((row) => row.upperTiles ?? [])).filter((t) => t >= 0));
    let shadow = 0;
    for (let i = 0; i < m.width * m.height; i++) if (shadowTiles.has(layerTileAt(m, 2, i))) shadow++;
    expect(shadow).toBeGreaterThan(0);
  });
});
