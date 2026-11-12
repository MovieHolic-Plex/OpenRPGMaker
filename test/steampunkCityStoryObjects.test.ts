// steampunk_city 이야기 기물 6종(sp-ledger-desk · sp-stop-lever · sp-lever-wall · sp-hatch-down · sp-room-door · sp-great-heart, 시트 1329~1354):
// 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘·층)과 같은지, 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 게임이 바란 낱말이 그 킷을 짚는지(낱말 목록이 아니라
// 킷 이름·꼬리표로), 실제 놓기 도구로 놓이는지 — 벽 레버·철문은 벽면 위에, 해치는 밟고 지나가는 계단 칸으로, 철문은 건물 입구(parts)가 아닌 문 그림으로.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-story-steampunk-city-2026-11-13 (굽기 scripts/content/steampunk-city/bake_sp.py, 목록 tiledata/steampunk-city/objects/spec.json).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { STEAMPUNK_CITY_ID, createSteampunkCityTileset } from "@/project/defaults/steampunkCity";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { tilesetSurface } from "@/project/tilesetSurface";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import spec from "../tiledata/steampunk-city/objects/spec.json";
import ask from "../tiledata/steampunk-city/objects/ask.json";

type Item = { id: string; w: number; h: number; place: string; block: number[][]; words: string[] };
const ITEMS = spec.items as Item[];
const kitId = (id: string) => `sp-${id}`;
const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
const FIRST = 1329; // 이 묶음이 덧붙기 전 시트 끝
/** 찍기 도구(stamp_tileset_object)가 읽는 종류 낱말 — 벽 레버만 wallmount, 해치는 decal, 나머지는 prop. */
const STAMP_KIND: Record<string, string> = { wallmount: "wallmount", decal: "decal" };
const tileByLabel = (ts: TilesetDef, label: string) => (ts.tileMeta ?? []).findIndex((meta) => meta?.label === label);

describe("steampunk_city 이야기 기물", () => {
  it("새 사본은 6종 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸·층·덧붙이기 번호)", () => {
    const ts = createSteampunkCityTileset();
    const kits = own(ts.structureKits);
    expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
    let next = FIRST;
    for (const item of ITEMS) {
      const kit = kits.find((k) => k.id === kitId(item.id))!;
      expect([kit.width, kit.height]).toEqual([item.w, item.h]);
      expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, STAMP_KIND[item.place] ?? "prop"]));
      expect((kit as { parts?: unknown[] }).parts ?? []).toEqual([]); // 입구 부품 없음 — 철문도 건물(집) 목록에 들지 않는다
      kit.rows.forEach((row, y) => {
        expect(row.tiles.every((tile) => tile < 0)).toBe(true); // 모두 위층 — 아래층 바닥·벽은 그대로
        (row.upperTiles ?? []).forEach((tile, x) => {
          expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 1329 부터
          const blocked = item.block.some(([bx, by]) => bx === x && by === y);
          expect(ts.passability[tile]!.up).toBe(!blocked);
          expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
        });
      });
    }
    expect(next).toBe(ts.count);
    expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "sp-story-objects"))).toBe(true);
  });

  it("해치는 계단 칸, 철문은 문 그림 칸으로 읽힌다(칩셋 표면 계약) — 벽 레버는 벽걸이 꼬리표", () => {
    const ts = createSteampunkCityTileset();
    const surface = tilesetSurface(ts);
    const tiles = (id: string) => own(ts.structureKits).find((k) => k.id === kitId(id))!.rows.flatMap((row) => row.upperTiles ?? []);
    expect(tiles("hatch-down").every((tile) => surface.stairs.has(tile))).toBe(true);
    expect(tiles("room-door").every((tile) => surface.doors.has(tile) && !surface.stairs.has(tile))).toBe(true);
    for (const id of ["ledger-desk", "stop-lever", "lever-wall", "great-heart"]) expect(tiles(id).some((tile) => surface.stairs.has(tile) || surface.doors.has(tile))).toBe(false);
    expect(own(ts.structureKits).filter((kit) => kit.ai?.tags?.includes("벽걸이")).map((kit) => kit.id)).toEqual(["sp-lever-wall"]);
    // 실내 계단 둘이 해치보다 앞에 있다 — 방의 계단 고르기(키트 차례)가 바뀌지 않는다
    const order = (ts.structureKits ?? []).map((kit) => kit.id);
    expect(order.indexOf("sp-stairs-down")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("sp-stairs-down")).toBeLessThan(order.indexOf("sp-hatch-down"));
  });

  it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
    const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
    const sheet = read("public/assets/steampunk-city/steampunk-city-chipset.png");
    const ts = createSteampunkCityTileset();
    for (const item of ITEMS) {
      const piece = read(`tiledata/steampunk-city/fable-redraw/pieces/story/${kitId(item.id)}.png`);
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
    const ts = project.tilesets[STEAMPUNK_CITY_ID]!;
    for (const [id, words] of Object.entries(ask.items)) for (const word of words) expect([word, existingMatches(project, ts, word)[0]?.id]).toEqual([word, kitId(id)]);
  });

  it("실제 놓기 도구: 벽 레버·철문은 벽면 위에, 나머지는 바닥에 — 막힌 칸만 막힌다", () => {
    const ctx = { project: createBlankProject() as Project, currentMapId: "room", assistantRun: true };
    expect(runTool(ctx, "create_map", { id: "room", name: "기관실", width: 12, height: 9, tilesetId: STEAMPUNK_CITY_ID }).ok).toBe(true);
    const ts = ctx.project.tilesets[STEAMPUNK_CITY_ID]!;
    const [wallTop, wallLow, floor] = [tileByLabel(ts, "리벳 철판 벽면(윗줄)"), tileByLabel(ts, "리벳 철판 벽면(아랫줄, 발판)"), tileByLabel(ts, "리벳 철판 바닥")];
    expect([wallTop, wallLow, floor].every((tile) => tile >= 0)).toBe(true);
    // 방 한 칸: 윗줄 두 줄은 벽면, 아래는 철판 바닥
    const room = structuredClone(ctx.project.maps.room!);
    room.lowerTiles = room.lowerTiles.map((_tile, i) => (i < room.width ? wallTop : i < room.width * 2 ? wallLow : floor));
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, room } } as Project;
    const stamp = (id: string, x: number, y: number) => runTool(ctx, "stamp_tileset_object", { mapId: "room", objectId: kitId(id), base: { x, y } }).ok;
    expect(stamp("lever-wall", 6, 6)).toBe(false); // 벽 레버는 바닥 한가운데에 놓이지 않는다
    expect([stamp("lever-wall", 1, 1), stamp("room-door", 3, 1), stamp("great-heart", 5, 4), stamp("ledger-desk", 1, 5), stamp("stop-lever", 10, 5), stamp("hatch-down", 9, 8)])
      .toEqual([true, true, true, true, true, true]);
    const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.room!, x, y);
    // 대심장 4×3: 윗줄은 걷고(사람 위에 그려진다) 아래 두 줄 여덟 칸이 막힌다
    expect([5, 6, 7, 8].map((x) => walk(x, 2))).toEqual([true, true, true, true]);
    expect([5, 6, 7, 8].flatMap((x) => [walk(x, 3), walk(x, 4)])).toEqual(new Array(8).fill(false));
    // 책상 2×2: 아랫줄만 · 정지 레버 1×2: 아래 칸만 · 해치 2×2: 네 칸 모두 걷는다
    expect([walk(1, 4), walk(2, 4), walk(1, 5), walk(2, 5)]).toEqual([true, true, false, false]);
    expect([walk(10, 4), walk(10, 5)]).toEqual([true, false]);
    expect([walk(9, 7), walk(10, 7), walk(9, 8), walk(10, 8)]).toEqual([true, true, true, true]);
    // 벽면의 레버·문 칸은 막힘(벽), 그 아래 바닥 칸은 서는 자리
    expect([walk(1, 0), walk(1, 1), walk(3, 0), walk(3, 1)]).toEqual([false, false, false, false]);
    expect([walk(1, 2), walk(3, 2)]).toEqual([true, true]);
  });
});
