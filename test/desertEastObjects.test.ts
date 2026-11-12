// desert_east 이야기 기물 8종(de-seal-altar … de-inscription-stone, 시트 928~949): 새 사본이 킷을 갖고 칸 표가 선언(막힘·★·바닥 그림)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 다른 칩셋 그림을 끝에 붙여 쓰던(이식 칸) 옛 사본도 킷을 받는지(이식 꼬리를 새 번들 끝 뒤로 민다),
// 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/desert-east/bake_de.py, 목록 tiledata/desert-east/objects/spec.json).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { DESERT_EAST_ID, createDesertEastTileset, ensureDesertEastTileset } from "@/project/defaults/desertEast";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef } from "@/project/types";
import spec from "../tiledata/desert-east/objects/spec.json";
import ask from "../tiledata/desert-east/objects/ask.json";

type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][] };
const ITEMS = spec.items as Item[];
const IDS = new Set(ITEMS.map((item) => `de-${item.id}`));
const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
const FIRST = 928; // 이 묶음이 덧붙기 전 시트 끝

describe("desert_east 이야기 기물", () => {
  it("새 사본은 8종 킷을 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸·바닥 그림)", () => {
    const ts = createDesertEastTileset();
    const kits = own(ts.structureKits);
    expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => `de-${item.id}`));
    let next = FIRST;
    for (const item of ITEMS) {
      const kit = kits.find((k) => k.id === `de-${item.id}`)!;
      expect([kit.width, kit.height]).toEqual([item.w, item.h]);
      expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
      expect(kit.ai?.tags).toContain(item.place);
      kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
        expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 928 부터
        const blocked = item.block.some(([bx, by]) => bx === x && by === y);
        expect(ts.passability[tile]!.up).toBe(!blocked);
        expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
      }));
    }
    expect(next).toBe(ts.count);
    expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "de-objects"))).toBe(true);
  });

  it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
    const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
    const sheet = read("public/assets/desert-east/desert-east-chipset.png");
    const ts = createDesertEastTileset();
    for (const item of ITEMS) {
      const piece = read(`tiledata/desert-east/objects/pieces/${item.src}`);
      expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
      const kit = own(ts.structureKits).find((k) => k.id === `de-${item.id}`)!;
      kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
        const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
        for (let y = 0; y < 16; y += 1) {
          const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
          expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
        }
      }));
    }
  });

  it("다른 칩셋 그림을 끝에 붙여 쓰던 옛 사본: 이식 칸이 새 번들 끝 뒤로 밀리고(맵 번호도) 킷을 받는다 — 다시 불러도 그대로", () => {
    const made = { project: createBlankProject() as Project, currentMapId: "" };
    expect(runTool(made, "create_map", { id: "old", name: "옛 사막", width: 20, height: 15, tilesetId: DESERT_EAST_ID }).ok).toBe(true);
    const project = made.project; // 도구는 프로젝트 객체를 새로 갈아 끼운다
    const ts = project.tilesets[DESERT_EAST_ID]!;
    // 928칸 때 저장한 사본을 흉내 낸다: 번들 칸 표는 928 까지, 그 바로 뒤에 다른 칩셋 그림 두 칸(이식)과 그 킷
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (ts as unknown as Record<string, unknown[]>)[key] = (ts as unknown as Record<string, unknown[]>)[key]!.slice(0, FIRST);
    ts.structureKits = ts.structureKits!.filter((kit) => !IDS.has(kit.id));
    ts.tileGroups = ts.tileGroups!.filter((group) => !group.tileIds.some((tile) => tile >= FIRST));
    ts.passability.push({ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false });
    ts.priority.push("upper", "lower"); ts.terrain.push(0, 0);
    ts.tileMeta!.push({ label: "빌린 표지판 (1,1)", description: "" }, { label: "빌린 표지판 (1,2)", description: "" });
    ts.tileGrafts = [{ targetTile: FIRST, sourceChipset: "tex_wasteland_ruins", sourceTile: 10 }, { targetTile: FIRST + 1, sourceChipset: "tex_wasteland_ruins", sourceTile: 58 }];
    ts.structureKits.push({ id: "borrowed-sign", kind: "section", name: "빌린 표지판", width: 1, height: 2, tileSize: 16, rows: [{ tiles: [-1], upperTiles: [FIRST] }, { tiles: [-1], upperTiles: [FIRST + 1] }] } as StructureKitDef);
    ts.count = FIRST + 2;
    const map = project.maps.old!;
    map.upperTiles[3 * map.width + 4] = FIRST; map.upperTiles[4 * map.width + 4] = FIRST + 1;

    expect(ensureBundledTilesets(project)).toBe(true);
    const bundle = createDesertEastTileset();
    const start = Math.min(...ts.tileGrafts!.map((graft) => graft.targetTile));
    expect(start).toBeGreaterThanOrEqual(bundle.count);
    expect(start % ts.tilesPerRow).toBe(FIRST % ts.tilesPerRow); // 한 줄 폭 배수만큼 밀린다
    expect(map.upperTiles[3 * map.width + 4]).toBe(start);
    expect(map.upperTiles[4 * map.width + 4]).toBe(start + 1);
    expect(ts.structureKits!.find((kit) => kit.id === "borrowed-sign")!.rows.map((row) => row.upperTiles)).toEqual([[start], [start + 1]]);
    expect(ts.tileMeta![start]!.label).toBe("빌린 표지판 (1,1)");
    expect(isPassable(project, map, 4, 4)).toBe(false);
    expect(own(ts.structureKits)).toHaveLength(ITEMS.length);
    expect(ts.passability.slice(0, bundle.count)).toEqual(bundle.passability);
    expect(ts.tileMeta!.slice(0, bundle.count)).toEqual(bundle.tileMeta);
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) expect((ts as unknown as Record<string, unknown[]>)[key]).toHaveLength(ts.count);
    const settled = JSON.stringify([ts, map.upperTiles]);
    ensureBundledTilesets(project);
    expect(JSON.stringify([ts, map.upperTiles])).toBe(settled);
    // 프로젝트 없이 부르면(맵 번호를 같이 고칠 수 없다) 겹치는 사본은 손대지 않는다
    const lone = structuredClone(ts);
    lone.tileGrafts = [{ targetTile: FIRST, sourceChipset: "tex_wasteland_ruins", sourceTile: 10 }];
    const before = JSON.stringify(lone);
    expect(ensureDesertEastTileset(lone)).toBe(false);
    expect(JSON.stringify(lone)).toBe(before);
  });

  it("게임이 바란 낱말이 그 킷을 첫째로 짚는다", () => {
    const project = createBlankProject() as Project;
    const ts = project.tilesets[DESERT_EAST_ID]!;
    for (const [id, words] of Object.entries(ask.items)) for (const word of words) expect([word, existingMatches(project, ts, word)[0]?.id]).toEqual([word, `de-${id}`]);
  });

  it("실제 놓기 도구로 놓으면 막힌 칸만 막힌다", () => {
    const ctx = { project: createBlankProject() as Project, currentMapId: "sand", assistantRun: true };
    expect(runTool(ctx, "create_map", { id: "sand", name: "모래밭", width: 20, height: 15, tilesetId: DESERT_EAST_ID }).ok).toBe(true);
    expect(runTool(ctx, "stamp_tileset_object", { mapId: "sand", objectId: "de-spring", base: { x: 3, y: 6 } }).ok).toBe(true);
    expect(runTool(ctx, "stamp_tileset_object", { mapId: "sand", objectId: "de-seal-altar", base: { x: 8, y: 6 } }).ok).toBe(true);
    expect(runTool(ctx, "stamp_tileset_object", { mapId: "sand", objectId: "de-note", base: { x: 12, y: 6 } }).ok).toBe(true);
    const map = ctx.project.maps.sand!;
    // 샘 3×3 은 아홉 칸 모두 막힘, 제단 2×2 는 아랫줄만 막히고 윗줄은 사람 위에 그려지는 걸음 칸, 쪽지는 밟고 지나간다
    for (let y = 4; y <= 6; y += 1) for (let x = 3; x <= 5; x += 1) expect(isPassable(ctx.project, map, x, y)).toBe(false);
    for (const [x, y] of [[8, 6], [9, 6]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(false);
    for (const [x, y] of [[8, 5], [9, 5], [12, 6]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(true);
  });
});
