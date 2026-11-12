// prehistoric 이야기 기물 2종(ph-trail-marker · ph-spring, 시트 769~773): 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/prehistoric/bake_ph.py, 목록 tiledata/prehistoric/objects/spec.json).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { PREHISTORIC_ID, createPrehistoricTileset } from "@/project/defaults/prehistoric";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef } from "@/project/types";
import spec from "../tiledata/prehistoric/objects/spec.json";
import ask from "../tiledata/prehistoric/objects/ask.json";

type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
const ITEMS = spec.items as Item[];
const kitId = (id: string) => `ph-${id}`;
const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
const FIRST = 769; // 이 묶음이 덧붙기 전 시트 끝

describe("prehistoric 이야기 기물", () => {
  it("새 사본은 2종 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸)", () => {
    const ts = createPrehistoricTileset();
    const kits = own(ts.structureKits);
    expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
    let next = FIRST;
    for (const item of ITEMS) {
      const kit = kits.find((k) => k.id === kitId(item.id))!;
      expect([kit.width, kit.height]).toEqual([item.w, item.h]);
      expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
      expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
      kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
        expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 769 부터
        const blocked = item.block.some(([bx, by]) => bx === x && by === y);
        expect(ts.passability[tile]!.up).toBe(!blocked);
        expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
      }));
    }
    expect(next).toBe(ts.count);
    expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "ph-objects"))).toBe(true);
  });

  it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
    const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
    const sheet = read("public/assets/prehistoric/prehistoric-chipset.png");
    const ts = createPrehistoricTileset();
    for (const item of ITEMS) {
      const piece = read(`tiledata/prehistoric/objects/pieces/${item.src}`);
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

  it("게임이 바란 낱말이 그 킷을 첫째로 짚는다", () => {
    const project = createBlankProject() as Project;
    const ts = project.tilesets[PREHISTORIC_ID]!;
    for (const [id, words] of Object.entries(ask.items)) for (const word of words) expect([word, existingMatches(project, ts, word)[0]?.id]).toEqual([word, kitId(id)]);
  });

  it("실제 놓기 도구로 놓으면 막힌 칸만 막힌다", () => {
    const ctx = { project: createBlankProject() as Project, currentMapId: "camp", assistantRun: true };
    expect(runTool(ctx, "create_map", { id: "camp", name: "빈터", width: 20, height: 15, tilesetId: PREHISTORIC_ID }).ok).toBe(true);
    const stamp = (id: string, x: number, y: number) => runTool(ctx, "stamp_tileset_object", { mapId: "camp", objectId: kitId(id), base: { x, y } }).ok;
    expect([stamp("spring", 3, 6), stamp("trail-marker", 8, 6)]).toEqual([true, true]);
    const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.camp!, x, y);
    // 샘 2×2 는 네 칸 모두 막힘, 표식은 한 칸 막힘, 둘레는 걷는다
    expect([walk(3, 5), walk(4, 5), walk(3, 6), walk(4, 6), walk(8, 6)]).toEqual([false, false, false, false, false]);
    expect([walk(2, 6), walk(5, 6), walk(3, 7), walk(7, 6), walk(9, 6)]).toEqual([true, true, true, true, true]);
  });
});
