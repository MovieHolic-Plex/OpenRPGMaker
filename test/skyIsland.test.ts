import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { SKY_ISLAND_CONCEPT_HINT, SKY_ISLAND_TILESET_ID, describesSkyIsland, formatSkyIslandNote, hasSkyIslandTileset, namesSkyIslandTileset, skyIslandPromptLines, skyIslandStyleFor, skyIslandTargetFor } from "@/ai/skyIslandPolicy";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import { SKY_MIN_SIZE, composeSkyIsland, skyPaletteFromTileset, type SkyComposeStyle } from "@/project/skyIslandComposer";
import data from "@/assets/skyIslandTileset.json";
import references from "@/assets/skyIslandReferences.json";
import { declaredIntent } from "./intentFixture";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { SKY_ISLAND_ID, createSkyIslandTileset } from "@/project/defaults/skyIsland";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef } from "@/project/types";
import spec from "../tiledata/sky-island/objects/spec.json";
import ask from "../tiledata/sky-island/objects/ask.json";
import { isolateTimers } from "./mergedTeardown";

// sky_island 조수 연결(skyIslandPolicy) + 순수 구성기(skyIslandComposer) — 이 파일은 작성 시 실행하지 않았다(not run).
describe("skyIslandPolicy", () => {
  isolateTimers();
  const START = "map_blank_start";
  const create = declaredIntent({ mode: "create", space: "outdoor" });
  describe("낱말", () => {
    it.each(["하늘섬 마을 만들어줘", "구름 위 신전", "비공정 부두", "떠 있는 섬", "공중 정원", "floating island village", "airship dock"])("%s", (text) => {
      expect(describesSkyIsland(text)).toBe(true);
    });
    it.each(["먹구름 날씨 효과", "숲속 마을 만들어줘", "구름다리", "비구름이 끼는 날씨", "항구 도시"])("%s 는 아니다", (text) => {
      expect(describesSkyIsland(text)).toBe(false);
    });
    it("칩셋 이름", () => {
      expect(namesSkyIslandTileset("sky_island 로 맵")).toBe(true);
      expect(namesSkyIslandTileset("하늘섬 칩셋")).toBe(true);
      expect(namesSkyIslandTileset("하늘섬 마을")).toBe(false);
    });
  });
  describe("구성 종류", () => {
    it.each([
      ["하늘섬 마을 만들어줘", "village"], ["구름 위 신전", "shrine"], ["비공정 부두", "dock"], ["섬 네 개를 다리로 이어줘", "archipelago"],
      ["비공정 선실 만들어줘", "room-cabin"], ["천문대 내부", "room-observatory"], ["하늘섬 신전 실내", "room-shrine"], ["오두막 방 만들어줘", "room-cottage"],
    ] as const)("%s → %s", (text, style) => {
      expect(skyIslandStyleFor(text, false)).toBe(style);
    });
  });
  describe("skyIslandTargetFor — 칩셋이 프로젝트에 있을 때만", () => {
    it("새 프로젝트는 번들 칩셋을 갖고 태어난다", () => {
      expect(hasSkyIslandTileset(createBlankProject())).toBe(true);
    });
    it("칩셋이 없으면 null", () => {
      const blank = createBlankProject();
      delete (blank.tilesets as Record<string, unknown>)[SKY_ISLAND_TILESET_ID];
      expect(skyIslandTargetFor(blank, create, "하늘섬 마을 만들어줘", START, false)).toBeNull();
      expect(skyIslandPromptLines(blank, [START])).toEqual([]);
    });
    it("생성 요청은 새 맵 + 문장의 구성 종류", () => {
      const project = createBlankProject();
      expect(skyIslandTargetFor(project, create, "하늘섬 마을 만들어줘", START, false)).toEqual({ style: "village" });
      expect(skyIslandTargetFor(project, create, "구름 위 신전", START, false)).toEqual({ style: "shrine" });
      expect(skyIslandTargetFor(project, create, "비공정 부두", START, false)).toEqual({ style: "dock" });
      expect(skyIslandTargetFor(project, create, "숲속 마을 만들어줘", START, false)).toBeNull();
      expect(skyIslandTargetFor(project, declaredIntent({ mode: "question", space: "outdoor" }), "하늘섬이 뭐야", START, false)).toBeNull();
    });
    it("노트는 도구 이름과 style 을 싣는다", () => {
      const note = formatSkyIslandNote({ style: "dock" }, null);
      expect(note).toContain("compose_sky_island_map");
      expect(note).toContain('style "dock"');
      expect(note).toContain("ask_tileset_change");
    });
    it("컨셉 카드 무대 낱말 → sky_island, 지을 수 있는 타일셋", () => {
      expect(SKY_ISLAND_CONCEPT_HINT["하늘섬·비공정"]).toBe(SKY_ISLAND_TILESET_ID);
      expect(BUILDABLE_CONCEPT_TILESETS).toContain(SKY_ISLAND_TILESET_ID);
    });
  });
  describe("구성기 — 씨앗·크기를 바꿔도 시작 칸에서 모든 목표에 닿는다", () => {
    const pal = skyPaletteFromTileset(data as never);
    const styles = Object.keys(SKY_MIN_SIZE) as SkyComposeStyle[];
    it.each(styles)("%s", (style) => {
      const min = SKY_MIN_SIZE[style];
      for (const seed of [1, 2, 3, 7, 11]) {
        for (const grow of [0, 4]) {
          const r = composeSkyIsland({ width: min.w + grow, height: min.h + grow, style, seed }, pal);
          expect(r.lower.length).toBe((min.w + grow) * (min.h + grow));
          expect(r.notes.filter((n) => n.includes("닿지 않는 목표"))).toEqual([]);
          if (!style.startsWith("room-")) expect(r.buildings.length).toBeGreaterThan(0);
          else expect(r.exits.length).toBe(1);
        }
      }
    });
    it("너무 작은 맵은 거절한다(맵을 바꾸지 않게 던진다)", () => {
      expect(() => composeSkyIsland({ width: 20, height: 12, style: "village", seed: 1 }, pal)).toThrow();
    });
  });
  describe("참고문서 — 번들 소유 si- · 그림은 경로만", () => {
    it("용도 둘, 모든 id 가 si-, 그림 바이트 없음", () => {
      const cats = references as { id: string; documents: { id: string }[]; images: { id: string; dataUrl: string }[] }[];
      expect(cats.map((c) => c.id)).toEqual(["si-outdoor", "si-interior"]);
      for (const c of cats) {
        for (const d of c.documents) expect(d.id.startsWith("si-")).toBe(true);
        for (const i of c.images) { expect(i.id.startsWith("si-")).toBe(true); expect(i.dataUrl.startsWith("/assets/sky-island-references/")).toBe(true); }
      }
    });
    it("새 프로젝트의 sky_island 정의가 참고문서를 들고 태어난다", () => {
      const def = createBlankProject().tilesets[SKY_ISLAND_TILESET_ID]!;
      expect((def.referenceDocuments ?? []).map((c) => c.id)).toEqual(["si-outdoor", "si-interior"]);
    });
  });
});

// sky_island 이야기 기물 1종(si-seal-altar, 시트 691~694): 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘·★)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/sky-island/bake_si.py, 목록 tiledata/sky-island/objects/spec.json).
describe("skyIslandStoryObjects", () => {
  isolateTimers();
  type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
  const ITEMS = spec.items as Item[];
  const kitId = (id: string) => `si-${id}`;
  const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
  const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
  const FIRST = 691;   // 이 묶음이 덧붙기 전 시트 끝

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
});
