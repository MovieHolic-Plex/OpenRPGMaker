// sky_island 이야기 기물 1종(si-seal-altar, 시트 691~694): 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘·★)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/sky-island/bake_si.py, 목록 tiledata/sky-island/objects/spec.json).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { SKY_ISLAND_ID, createSkyIslandTileset } from "@/project/defaults/skyIsland";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef } from "@/project/types";
import spec from "../tiledata/sky-island/objects/spec.json";
import ask from "../tiledata/sky-island/objects/ask.json";

type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
const ITEMS = spec.items as Item[];
const kitId = (id: string) => `si-${id}`;
const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
const FIRST = 691; // 이 묶음이 덧붙기 전 시트 끝

describe("sky_island 이야기 기물", () => {
  it("새 사본은 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸)", () => {
    const ts = createSkyIslandTileset();
    const kits = own(ts.structureKits);
    expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
    let next = FIRST;
    for (const item of ITEMS) {
      const kit = kits.find((k) => k.id === kitId(item.id))!;
      expect([kit.width, kit.height]).toEqual([item.w, item.h]);
      expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
      expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
      kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
        expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 691 부터
        const blocked = item.block.some(([bx, by]) => bx === x && by === y);
        expect(ts.passability[tile]!.up).toBe(!blocked);
        expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
      }));
    }
    expect(next).toBe(ts.count);
    expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "si-objects"))).toBe(true);
  });

  it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
    const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
    const sheet = read("public/assets/sky-island/sky-island-chipset.png");
    const ts = createSkyIslandTileset();
    for (const item of ITEMS) {
      const piece = read(`tiledata/sky-island/objects/pieces/${item.src}`);
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

  it("게임이 바란 낱말이 그 킷을 짚는다 — «제단» 은 같은 태그의 실내 신전 제단(si-altar) 다음", () => {
    const project = createBlankProject() as Project;
    const ts = project.tilesets[SKY_ISLAND_ID]!;
    for (const [id, words] of Object.entries(ask.items)) for (const word of words) {
      const found = existingMatches(project, ts, word).map((row) => row.id);
      if (word === "제단") expect(found.slice(0, 2)).toEqual(["si-altar", kitId(id)]);
      else expect([word, found[0]]).toEqual([word, kitId(id)]);
    }
  });

  it("실제 놓기 도구로 놓으면 아랫줄만 막힌다", () => {
    const ctx = { project: createBlankProject() as Project, currentMapId: "isle", assistantRun: true };
    expect(runTool(ctx, "create_map", { id: "isle", name: "섬 마당", width: 20, height: 15, tilesetId: SKY_ISLAND_ID }).ok).toBe(true);
    expect(runTool(ctx, "stamp_tileset_object", { mapId: "isle", objectId: kitId("seal-altar"), base: { x: 3, y: 6 } }).ok).toBe(true);
    const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.isle!, x, y);
    // 봉인 제단 2×2: 아랫줄(앞면) 두 칸 막힘, 윗줄(윗판)은 사람 위에 그려지는 걸음 칸
    expect([walk(3, 6), walk(4, 6)]).toEqual([false, false]);
    expect([walk(3, 5), walk(4, 5), walk(3, 7), walk(2, 6), walk(5, 6)]).toEqual([true, true, true, true, true]);
  });
});
