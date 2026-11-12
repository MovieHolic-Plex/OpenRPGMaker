// 손 도트 실내(atlas_biome_interior) 이야기 기물 8종(시트 7677~7692, interior-plus 조각 oneshot): 사양·킷이 실리고 칸 표가 선언과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 이름·태그로),
// 방 짓기 도구와 놓기 도구로 놓이는지, 시트 끝에 다른 칩셋 그림을 붙여 쓰던 옛 사본도 받는지.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (목록 tiledata/hand-interior/plus/oneshot/spec.json, 굽기 scripts/content/interior-plus/bake.py).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ATLAS_BIOME_INTERIOR_ID, createAtlasBiomeInteriorTileset } from "@/project/defaults/atlasBiomeInterior";
import { HAND_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef } from "@/project/types";
import spec from "../tiledata/hand-interior/plus/oneshot/spec.json";
import ask from "../tiledata/hand-interior/plus/oneshot/ask.json";

type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[]; piece: { kind: string; w: number; h: number; up: number } };
const ITEMS = spec.items as Item[];
const kitId = (id: string) => `hand-interior:${id}`;
const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
const FIRST = 7677; // 이 묶음이 덧붙기 전 시트 끝

describe("손 도트 실내 이야기 기물", () => {
  it("사양·킷 8종이 실리고, 칸 표가 선언과 같다(막힌 칸·★ 칸·밟는 바닥 그림)", () => {
    const ts = createAtlasBiomeInteriorTileset();
    const kits = own(ts.structureKits);
    expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
    let next = FIRST;
    for (const item of ITEMS) {
      const kit = kits.find((k) => k.id === kitId(item.id))!;
      const object = HAND_INTERIOR_SPEC.objects[item.id]!;
      expect([object.kind, object.w, object.h, object.up]).toEqual([item.piece.kind, item.piece.w, item.piece.kind === "hang" ? 0 : item.piece.h, item.piece.up]);
      expect([kit.width, kit.height]).toEqual([item.w, item.h]);
      expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
      expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
      kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
        expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 7677 부터
        const blocked = item.block.some(([bx, by]) => bx === x && by === y);
        expect(ts.passability[tile]!.up).toBe(!blocked);
        expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
      }));
    }
    expect(next).toBe(ts.count);
  });

  it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
    const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
    const sheet = read("public/assets/atlas-interior/interior-chipset.png");
    const ts = createAtlasBiomeInteriorTileset();
    for (const item of ITEMS) {
      const piece = read(`tiledata/hand-interior/plus/oneshot/pieces/${item.src}`);
      expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
      const kit = own(ts.structureKits).find((k) => k.id === kitId(item.id))!;
      kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
        const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
        for (let y = 0; y < 16; y += 1) {
          const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
          expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
        }
      }));
    }
  });

  it("게임이 바란 낱말이 그 킷을 짚는다 — 이미 같은 이름의 v5 기물이 있는 «족쇄» 는 그 기물 다음", () => {
    const project = createBlankProject() as Project;
    const ts = project.tilesets[ATLAS_BIOME_INTERIOR_ID]!;
    for (const [id, words] of Object.entries(ask.items)) for (const word of words) {
      const found = existingMatches(project, ts, word).map((row) => row.id);
      if (word === "족쇄") expect(found.slice(0, 2)).toEqual(["hand-interior:shackles", kitId(id)]);
      else expect([word, found[0]]).toEqual([word, kitId(id)]);
    }
  });

  it("방 짓기 도구(objects[].id)와 놓기 도구로 놓이고, 막힌 칸만 막힌다 — 벽 걸이는 벽면에만", () => {
    const ctx = { project: createBlankProject() as Project, currentMapId: "", assistantRun: true };
    const plan = ["##########", "#........#", "#........#", "#........#", "#........#", "#........#", "####.#####"];
    const built = runTool(ctx, "build_hand_interior_room", { mapId: "cell", name: "감방", plan, floor: "dungeon", wall: "dungeonw",
      objects: [{ id: "wall shackles", x: 2, y: 1 }, { id: "straw cot", x: 1, y: 3 }, { id: "cell bars", x: 6, y: 4 }, { id: "floor key", x: 4, y: 4 }] });
    expect(built.ok, built.summary).toBe(true);
    const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.cell!, x, y);
    expect([walk(1, 3), walk(1, 4)]).toEqual([false, false]); // 짚 침상 1×2
    expect([walk(6, 4), walk(6, 3)]).toEqual([false, true]); // 철창: 발밑만 막힘, 윗칸은 사람 위에 그려지는 걸음 칸
    expect(walk(4, 4)).toBe(true); // 열쇠는 밟고 지나간다
    const stamp = (objectId: string, x: number, y: number) => runTool(ctx, "stamp_tileset_object", { mapId: "cell", objectId, base: { x, y } });
    expect(stamp(kitId("cell bars door"), 7, 5).ok).toBe(true);
    expect([walk(7, 5), walk(7, 4)]).toEqual([false, true]);
    expect(stamp(kitId("floor note"), 3, 5).ok).toBe(true);
    expect(walk(3, 5)).toBe(true);
    expect(stamp(kitId("wall shackles"), 5, 2).ok).toBe(true); // 벽면 두 줄(1~2줄)
    expect(stamp(kitId("wall shackles"), 5, 5).ok).toBe(false); // 바닥에는 걸리지 않는다
  });

  it("시트 끝에 다른 칩셋 그림을 붙여 쓰던 옛 사본: 그 칸이 새 번들 끝 뒤로 밀리고(맵 번호도) 8종을 받는다 — 다시 불러도 그대로", () => {
    const made = { project: createBlankProject() as Project, currentMapId: "" };
    expect(runTool(made, "build_hand_interior_room", { mapId: "old", name: "옛 방", plan: ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "###.###"], floor: "plank", wall: "plaster" }).ok).toBe(true);
    const project = made.project; // 도구는 프로젝트 객체를 새로 갈아 끼운다
    const ts = project.tilesets[ATLAS_BIOME_INTERIOR_ID]!;
    // 7677칸 때 저장한 사본을 흉내 낸다: 번들 칸 표는 7677 까지, 그 바로 뒤에 다른 칩셋 그림 한 칸(이식)
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (ts as unknown as Record<string, unknown[]>)[key] = (ts as unknown as Record<string, unknown[]>)[key]!.slice(0, FIRST);
    ts.structureKits = ts.structureKits!.filter((kit) => !IDS.has(kit.id));
    ts.passability.push({ up: false, down: false, left: false, right: false }); ts.priority.push("upper"); ts.terrain.push(0);
    ts.tileMeta!.push({ label: "빌린 수정 받침", description: "" });
    ts.tileGrafts = [{ targetTile: FIRST, sourceChipset: "tex_beodeul_city", sourceTile: 10 }];
    ts.count = FIRST + 1;
    const cell = 4 * project.maps.old!.width + 2;
    project.maps.old!.upperTiles[cell] = FIRST;

    expect(ensureBundledTilesets(project)).toBe(true);
    const now = project.tilesets[ATLAS_BIOME_INTERIOR_ID]!;
    const bundle = createAtlasBiomeInteriorTileset();
    const start = now.tileGrafts![0]!.targetTile;
    expect(start).toBeGreaterThanOrEqual(bundle.count);
    expect(project.maps.old!.upperTiles[cell]).toBe(start);
    expect(now.tileMeta![start]!.label).toBe("빌린 수정 받침");
    expect(isPassable(project, project.maps.old!, 2, 4)).toBe(false);
    expect(own(now.structureKits)).toHaveLength(ITEMS.length);
    expect(now.passability.slice(0, bundle.count)).toEqual(bundle.passability);
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) expect((now as unknown as Record<string, unknown[]>)[key]).toHaveLength(now.count);
    const settled = JSON.stringify([project.tilesets[ATLAS_BIOME_INTERIOR_ID], project.maps.old!.upperTiles]);
    ensureBundledTilesets(project);
    expect(JSON.stringify([project.tilesets[ATLAS_BIOME_INTERIOR_ID], project.maps.old!.upperTiles])).toBe(settled);
  });
});
