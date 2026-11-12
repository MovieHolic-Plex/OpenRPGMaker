// 버들항 이야기 기물(bd-obj-*, 시트 꼬리 34,944~): 새 사본·옛 사본이 킷과 참고문서를 갖는지, 칸 표가 선언(막힘·★·바닥 그림)과 같은지,
// 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/beodeul-objects/bake.py).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  BEODEUL_OBJECTS_BASE, BEODEUL_OBJECTS_KIT_PREFIX, createBeodeulCityTileset, ensureBeodeulCityReferences, ensureBeodeulCityTileset,
} from "@/project/defaults/beodeulCity";
import { buildObjectGenRequest, existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef } from "@/project/types";
import catalog from "../tiledata/beodeul-objects/catalog.json";

const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => kit.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX));

describe("버들항 이야기 기물 꼬리", () => {
  it("새 사본은 16종 킷을 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸·바닥 그림)", () => {
    const ts = createBeodeulCityTileset();
    const kits = own(ts.structureKits);
    expect(kits.map((kit) => kit.id)).toEqual(catalog.items.map((item) => item.kit));
    expect(catalog.base).toBe(BEODEUL_OBJECTS_BASE);
    for (const item of catalog.items) {
      const kit = kits.find((k) => k.id === item.kit)!;
      expect(kit.learnedFrom).toBe("pack-preset");
      expect(kit.rows.map((row) => row.upperTiles)).toEqual(item.rows);
      expect(kit.ai?.description).toContain("3/4 관문 미통과");
      item.rows.forEach((row, y) => row.forEach((tile, x) => {
        if (tile < 0) return;
        expect(tile).toBeGreaterThanOrEqual(BEODEUL_OBJECTS_BASE);
        expect(tile).toBeLessThan(BEODEUL_OBJECTS_BASE + ts.tilesPerRow);
        const blocked = item.block.some(([bx, by]) => bx === x && by === y);
        expect(ts.passability[tile]!.up).toBe(!blocked);
        expect(ts.priority[tile]).toBe(blocked || item.place === "decal" ? "lower" : "upper");
      }));
    }
    // 번들 자신의 이식 칸은 시트 끝 뒤에서 시작한다(시트 꼬리가 이식 칸과 겹치지 않는다)
    expect(Math.min(...(ts.tileGrafts ?? []).map((graft) => graft.targetTile))).toBeGreaterThanOrEqual(catalog.count);
    expect((ts.referenceDocuments ?? []).some((category) => category.id === "beodeul-objects")).toBe(true);
  });

  it("킷·참고문서가 빠진 옛 사본은 다시 받고, 저자 킷은 남는다", () => {
    const ts = createBeodeulCityTileset();
    const authored = { ...structuredClone(ts.structureKits![0]!), id: "my-kit" } as StructureKitDef;
    ts.structureKits = [...ts.structureKits!.filter((kit) => !kit.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX)), authored];
    ts.referenceDocuments = (ts.referenceDocuments ?? []).filter((category) => category.id !== "beodeul-objects");
    expect(ensureBeodeulCityTileset(ts)).toBe(true);
    expect(ensureBeodeulCityReferences(ts)).toBe(true);
    expect(own(ts.structureKits)).toHaveLength(catalog.items.length);
    expect(ts.structureKits!.some((kit) => kit.id === "my-kit")).toBe(true);
    expect((ts.referenceDocuments ?? []).some((category) => category.id === "beodeul-objects")).toBe(true);
    expect(ensureBeodeulCityTileset(ts)).toBe(false);
    expect(ensureBeodeulCityReferences(ts)).toBe(false);
  });

  it("게임이 바란 낱말이 그 킷을 첫째로 짚는다 — 한 글자 이름(샘)과 끝 낱말이 지형(판자 길)인 이름도", () => {
    const project = createBlankProject() as Project;
    const mapId = project.startMapId;
    const ts = project.tilesets[project.maps[mapId]!.tilesetId]!;
    const first = (title: string) => existingMatches(project, ts, title)[0]?.id;
    expect(first("샘")).toBe("bd-obj-spring");
    expect(first("봉인 제단")).toBe("bd-obj-seal-altar");
    expect(first("무너진 기둥")).toBe("bd-obj-broken-pillar");
    expect(first("유적 입구")).toBe("bd-obj-ruin-entrance");
    expect(first("게시판")).toBe("bd-obj-notice-board");
    expect(first("쪽지")).toBe("bd-obj-note");
    const ask = (title: string) => () => buildObjectGenRequest(project, { mapId, title, description: `${title} 하나`, objectKind: "floor", need: `${title} 을 놓고 싶다` });
    // 끝 낱말은 «길»(지형)이지만 킷이 그 이름을 태그로 달았다 — 「칸 타일이 없다」가 아니라 그 킷을 이른다
    expect(ask("판자 길")).toThrow(/이미 있다[^]*bd-obj-plank-ew/u);
    // 그런 선언이 없는 지형 이름은 예전처럼 지형으로 돌려보낸다
    expect(ask("자갈 도로")).toThrow(/지형·바닥·벽 칸/u);
    // 봤는데 다른 물건이라고 밝히면(notThese) 그 킷을 건너뛴다
    const others = existingMatches(project, ts, "샘").map((row) => row.id);
    expect(() => buildObjectGenRequest(project, { mapId, title: "샘", description: "돌 샘", objectKind: "floor", need: "샘", notThese: others })).not.toThrow(/이미 있다/u);
  });

  it("실제 놓기 도구로 놓으면 막힌 칸만 막힌다", () => {
    const ctx = { project: createBlankProject() as Project, currentMapId: "", assistantRun: true };
    const mapId = ctx.project.startMapId;
    ctx.currentMapId = mapId;
    const spring = catalog.items.find((item) => item.id === "spring")!;
    const tent = catalog.items.find((item) => item.id === "camp-tent")!;
    expect(runTool(ctx, "stamp_tileset_object", { mapId, objectId: spring.kit, base: { x: 3, y: 4 } }).ok).toBe(true);
    expect(runTool(ctx, "stamp_tileset_object", { mapId, objectId: tent.kit, base: { x: 7, y: 4 } }).ok).toBe(true);
    const map = ctx.project.maps[mapId]!;
    // 샘 2×2 는 네 칸 모두 막힘, 천막 2×2 는 아랫줄만 막히고 윗줄은 사람 위에 그려지는 걸음 칸
    for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4], [7, 4], [8, 4]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(false);
    for (const [x, y] of [[7, 3], [8, 3]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(true);
    expect(map.upperTiles[3 * map.width + 7]).toBe(tent.rows[0]![0]);
  });
});
