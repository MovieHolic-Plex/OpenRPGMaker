// 숲 구성(stand)·풀밭 얼룩(meadow) — 게임마다 다른 숲: 섞인 수종 · 그 수종의 숲 수관 · 숲 바닥 · 열린 바닥의 재질 섞임(2026-11-13 4차).
// 나무 킷의 칸 번호·통행은 그대로이고 그림만 겹친다. 숲 바닥·얼룩은 2층 덧그림이라 걷는 칸이 달라지지 않는다. 겉모습이 없는 게임은 예전 그대로다.
import { describe, expect, it } from "vitest";
import stands from "@/assets/beodeulStands.json";
import sheet from "@/assets/beodeulCitySheet.json";
import { activeTileGrafts, tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { describeTilesetLook, tilesetLookGrafts, tilesetLookOptions, tilesetLookTableFor } from "@/assets/tilesetLooks";
import { standOverlaySource, tilesetStand, tilesetStandTableFor } from "@/assets/tilesetStands";
import { bundledChipsetFrameCount, BUNDLED_REFERENCE_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { createBlankProject } from "@/project/defaults";
import { chooseTilesetLook } from "@/project/tilesetLook";
import { kitBaseTile } from "@/project/houseSetTiles";
import { standKitPictures, standVariantKit } from "@/project/standKit";
import { runTool } from "@/editor/tools/toolRunner";
import { isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { deserialize, serialize } from "@/project/io";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project, TilesetLook } from "@/project/types";

const TS = "beodeul_city";
const looks = tilesetLookTableFor(TS)!;
const table = tilesetStandTableFor(TS)!;

function village(look: Partial<TilesetLook> | undefined, key: string | undefined, salt = 250118, theme?: string): { project: Project; map: GameMap } {
  const project = createBlankProject() as Project;
  if (look) project.tilesets[TS]!.look = { textureKey: looks.texture, ...look };
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(key ? { lookKey: key } : {}) } as ToolContext;
  const spec = { type: "village", name: "버들 마을", salt, ...(theme ? { hints: { theme } } : {}) } as PlaceSpec;
  const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
  expect(res.ok).toBe(true);
  return { project: ctx.project, map: ctx.project.maps[res.mapIds[0]!]! };
}
const walkGrid = (project: Project, map: GameMap): string => {
  let out = "";
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) out += isPassable(project, map, x, y) ? "1" : "0";
  return out;
};
const standCells = (project: Project, map: GameMap): number[] => {
  const own = new Set((project.tilesets[TS]!.tileGrafts ?? []).filter((g) => g.sourceChipset === table.texture).map((g) => g.targetTile));
  const cells: number[] = [];
  for (let i = 0; i < map.width * map.height; i += 1) if (own.has(layerTileAt(map, 2, i))) cells.push(i);
  return cells;
};

describe("tileset stands — 게임마다 다른 숲·바닥", () => {
  it("표: 그림판이 번들에 실리고, 숲 구성마다 나무 킷·밑풀 킷·숲 바닥이 실제로 있다", () => {
    expect(BUNDLED_REFERENCE_CHIPSET_ASSETS.some((asset) => asset.textureKey === table.texture)).toBe(true);
    expect(bundledChipsetFrameCount(table.texture)).toBe(stands.count);
    expect(bundledChipsetTilesPerRow(table.texture)).toBe(table.tilesPerRow);
    const tileset = (createBlankProject() as Project).tilesets[TS]!;
    const kits = new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit]));
    const meta = tileset.tileMeta as unknown as ({ tags?: string[] } | undefined)[];
    expect(Object.keys(table.stands).length).toBeGreaterThanOrEqual(12);
    for (const [id, stand] of Object.entries(table.stands)) {
      expect(table.overlays[stand.floor]?.role, id).toBe("floor");
      expect(stand.pairs.length % 2).toBe(0);
      for (let i = 0; i < stand.pairs.length; i += 2) {
        expect(stand.pairs[i]!).toBeLessThan(sheet.count);
        expect((meta[stand.pairs[i]!]?.tags ?? []).includes("tree"), `${id} 칸 ${stand.pairs[i]}`).toBe(true);
        expect(stand.pairs[i + 1]!).toBeLessThan(table.count);
      }
      for (const cells of Object.values(stand.sources)) for (let i = 1; i < cells.length; i += 2) expect(cells[i]!).toBeLessThan(table.count);
      // 주 수종·곁 수종·덤불이 다 있고 킷은 모두 그 타일셋의 나무 킷이다
      for (const role of ["dominant", "companion", "shrub"] as const) expect(stand.kits[role]?.length ?? 0, `${id} ${role}`).toBeGreaterThan(0);
      for (const list of Object.values(stand.kits)) for (const kit of list ?? []) expect(kits.has(kit), `${id} ${kit}`).toBe(true);
      expect(stand.under.length).toBeGreaterThan(3);
      for (const kit of stand.under) expect(kits.has(kit), `${id} ${kit}`).toBe(true);
      // 4차 뒤(숲 맵): 킷마다 덮개 값, 같은 수종·같은 크기의 «다른 개체» 그림, 숲 수관 위에 얹는 나무 머리, 한 칸 풀·덤불 그림
      for (const [kit, cells] of Object.entries(stand.cover ?? {})) expect(cells.length, `${id} ${kit}`).toBe(kits.get(kit)!.width * kits.get(kit)!.height);
      expect(Object.keys(stand.cover ?? {}).length, id).toBeGreaterThan(10);
      for (const [kit, pictures] of Object.entries(stand.variants ?? {})) {
        const def = kits.get(kit)!;
        expect(stand.variantCover?.[kit]?.length, `${id} ${kit}`).toBe(pictures.length);
        for (const rows of pictures) {
          expect(rows.length).toBe(def.height);
          for (const row of rows) { expect(row.length).toBe(def.width); for (const cell of row) expect(cell === -1 || (cell > 0 && cell < table.count), `${id} ${kit} ${cell}`).toBe(true); }
        }
      }
      expect(stand.crowns?.length ?? 0, id).toBeGreaterThan(3);
      for (const crown of stand.crowns ?? []) {
        expect(crown.rows.length).toBe(crown.h);
        for (const row of crown.rows) { expect(row.length).toBe(crown.w); for (const cell of row) expect(cell === -1 || (cell > 0 && cell < table.count)).toBe(true); }
      }
      expect((stand.small ?? []).length % 2).toBe(0);
      expect((stand.shade ?? []).length % 2).toBe(0);
      for (const kit of stand.loud ?? []) expect(kits.has(kit), `${id} ${kit}`).toBe(true);
    }
    // 변형 칸은 (킷, 그림)마다 따로다 — 한 칸이 원본 킷의 한 자리만 가리킨다(도구가 변형 나무를 그 킷으로 되읽는다)
    for (const [id, stand] of Object.entries(table.stands)) {
      const seen = new Set<number>();
      for (const pictures of Object.values(stand.variants ?? {})) for (const rows of pictures) for (const row of rows) for (const cell of row) {
        if (cell < 0) continue;
        expect(seen.has(cell), `${id} ${cell}`).toBe(false);
        seen.add(cell);
      }
    }
    expect(Object.values(table.stands).filter((stand) => stand.variants).length).toBeGreaterThanOrEqual(12);
    for (const [id, overlay] of Object.entries(table.overlays)) {
      for (const list of [overlay.cells, overlay.alt]) {
        expect(list.length).toBe(16);
        for (let mask = 1; mask < 16; mask += 1) { expect(list[mask]!, id).toBeGreaterThan(0); expect(list[mask]!).toBeLessThan(table.count); }
      }
      if (overlay.role === "floor") expect((overlay.shadow ?? []).length, id).toBeGreaterThan(20);
    }
    for (const meadow of Object.values(table.meadows)) for (const patch of meadow.patches) expect(table.overlays[patch]?.role).toBe("patch");
    for (const id of [table.worn, table.verge.water, table.verge.road]) expect(table.overlays[id]).toBeDefined();
    expect(kits.has(table.reed)).toBe(true);
    // 덧그림 원본 타일셋: 모두 걷는 ★ 칸이고 이름표가 있다
    const source = standOverlaySource(table);
    const cell = table.overlays[table.worn]!.cells[15]!;
    expect(source.priority[cell]).toBe("upper");
    expect(source.passability[cell]).toEqual({ up: true, down: true, left: true, right: true });
    expect((source.tileMeta as unknown as { label: string }[])[cell]!.label).toContain("덧그림");
  });

  it("고르기: 숲 구성·풀밭 얼룩은 겉모습 갈래로 골라지고, 고른 게임은 둘째 그림판 열쇠를 적는다", () => {
    expect(tilesetLookOptions(looks, "stand")).toEqual(["", ...Object.keys(table.stands)]);
    expect(tilesetLookOptions(looks, "meadow")).toEqual(["", ...Object.keys(table.meadows)]);
    const seen = new Set<string>();
    for (let n = 0; n < 600; n += 1) {
      const look = chooseTilesetLook(looks, JSON.stringify(["project", `stand-${n}`]));
      seen.add(look?.stand ?? "");
      if (look?.stand || look?.meadow) expect(look.standKey).toBe(table.texture); else expect(look?.standKey).toBeUndefined();
    }
    expect(seen.size).toBe(Object.keys(table.stands).length + 1);
    const project = createBlankProject() as Project;
    project.tilesets[TS]!.look = { textureKey: looks.texture, stand: "oakwood", meadow: "flowers", standKey: table.texture };
    expect(deserialize(serialize(project)).tilesets[TS]!.look).toEqual(project.tilesets[TS]!.look);
    expect(describeTilesetLook(TS, { textureKey: looks.texture, trees: "birch", stand: "oakwood" })).toBe(table.stands.oakwood!.label);
  });

  it("그리는 이식 목록: 숲 구성을 고르면 나무 킷 칸·숲 수관 칸이 숲 그림판 그림으로 겹치고, 수종 하나(trees)는 겹치지 않는다", () => {
    const tileset = (createBlankProject() as Project).tilesets[TS]!;
    const plain = activeTileGrafts(tileset);
    expect(plain.some((graft) => graft.sourceChipset === table.texture)).toBe(false);
    const stand = tilesetStand(TS, "oakwood")!;
    const withStand = { ...tileset, look: { textureKey: looks.texture, trees: "birch", stand: "oakwood" } };
    const drawn = tilesetLookGrafts(withStand);
    expect(drawn.length).toBeGreaterThanOrEqual(stand.pairs.length / 2);
    expect(drawn.every((graft) => graft.sourceChipset === table.texture)).toBe(true);
    expect(drawn.find((graft) => graft.targetTile === stand.pairs[0])!.sourceTile).toBe(stand.pairs[1]);
    expect(tileGraftsTextureSuffix(withStand)).not.toBe(tileGraftsTextureSuffix(tileset));
    expect(tileGraftsTextureSuffix({ ...withStand, look: { ...withStand.look, stand: "pinewood" } })).not.toBe(tileGraftsTextureSuffix(withStand));
    // 표에 없는 이름·풀밭 얼룩만 고른 look 은 그림을 겹치지 않는다(얼룩은 맵의 2층 칸이다)
    expect(tilesetLookGrafts({ ...tileset, look: { textureKey: looks.texture, stand: "no-such-stand" } })).toEqual([]);
    expect(tilesetLookGrafts({ ...tileset, look: { textureKey: looks.texture, meadow: "flowers" } })).toEqual([]);
  });

  it("마을 짓기: 숲 구성을 고른 게임은 여러 수종·여러 크기의 나무가 서고, 숲 바닥·얼룩은 2층에만 깔려 걷는 칸이 그대로다", () => {
    for (const theme of [undefined, "coast"]) {
      const { project, map } = village({ stand: "oakwood", meadow: "flowers", woods: "clumps", standKey: table.texture }, JSON.stringify(["project", "stand-village"]), 250118, theme);
      const tileset = project.tilesets[TS]!;
      const stand = tilesetStand(TS, "oakwood")!;
      // 놓인 나무 칸이 주 수종·곁 수종·덤불 킷에 고루 걸친다
      const kits = new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit]));
      // 다른 개체 그림(변형)으로 선 나무는 원본 킷의 칸으로 되읽는다
      const base = kitBaseTile(tileset);
      const placed = new Set<number>();
      for (let i = 0; i < map.width * map.height; i += 1) { const t = layerTileAt(map, 3, i); if (t >= 0) placed.add(base(t)); }
      const usedKits = (role: "dominant" | "companion" | "shrub"): string[] => (stand.kits[role] ?? []).filter((id) => (kits.get(id)!.rows[0]!.upperTiles ?? []).some((t) => placed.has(t)));
      expect(usedKits("dominant").length).toBeGreaterThan(0);
      expect(usedKits("companion").length).toBeGreaterThan(0);
      expect(usedKits("shrub").length).toBeGreaterThan(1);
      const sizes = new Set([...usedKits("dominant"), ...usedKits("companion"), ...usedKits("shrub")].map((id) => `${kits.get(id)!.width}x${kits.get(id)!.height}`));
      expect(sizes.size).toBeGreaterThanOrEqual(3);
      // 덧그림: 2층에만, 숲 바닥과 얼룩이 둘 다 깔린다
      const cells = standCells(project, map);
      expect(cells.length).toBeGreaterThan(40);
      const labels = new Set(cells.map((i) => (tileset.tileMeta as unknown as { label: string }[])[layerTileAt(map, 2, i)]!.label.split("(")[0]));
      expect([...labels].sort()).toEqual(["숲 바닥 덧그림", "풀밭 바닥 덧그림"]);
      for (const i of cells) expect(tileset.priority[layerTileAt(map, 2, i)]).toBe("upper");
      // 덧그림과 숲 수관 위의 나무 머리(4층)를 걷어 내도 걷는 칸은 한 칸도 달라지지 않는다 — 나무 머리는 막힌 숲 칸 위에만 선다
      const before = walkGrid(project, map);
      const bare = structuredClone(map);
      for (const i of cells) setLayerTileAt(bare, 2, i, -1);
      const own = new Set((tileset.tileGrafts ?? []).filter((graft) => graft.sourceChipset === table.texture).map((graft) => graft.targetTile));
      for (let i = 0; i < map.width * map.height; i += 1) {
        if (!own.has(layerTileAt(map, 4, i))) continue;
        expect(isPassable(project, map, i % map.width, Math.floor(i / map.width)), `4층 숲 그림판 칸 ${i}`).toBe(false);
        setLayerTileAt(bare, 4, i, -1);
      }
      expect(walkGrid(project, bare)).toBe(before);
      // 이벤트 칸·경사로에는 깔지 않는다
      const on = new Set(cells);
      for (const event of map.events) expect(on.has(event.y * map.width + event.x)).toBe(false);
    }
  }, 240_000);

  it("다른 개체 그림: 변형 킷은 원본 킷의 통행·위아래·킷 id 를 그대로 갖고, 도구가 그 칸을 원본 킷의 칸으로 되읽는다", () => {
    const tileset = (createBlankProject() as Project).tilesets[TS]!;
    const kit = (tileset.structureKits ?? []).find((candidate) => standKitPictures(TS, "oakwood", candidate.id) > 1)!;
    const pictures = standKitPictures(TS, "oakwood", kit.id);
    expect(pictures).toBeGreaterThan(1);
    expect(standKitPictures(TS, undefined, kit.id)).toBe(1);
    // 그림 수로 나눈 나머지가 0 이면 원본 그림 — 킷 그대로 찍는다. 숲 구성이 없으면 늘 원본이다
    expect(standVariantKit(tileset, kit, "oakwood", 0)).toBeUndefined();
    expect(standVariantKit(tileset, kit, "oakwood", pictures)).toBeUndefined();
    expect(standVariantKit(tileset, kit, undefined, 1)).toBeUndefined();
    const variant = standVariantKit(tileset, kit, "oakwood", 1)!;
    expect(variant.id).toBe(kit.id);
    const flat = (def: typeof kit): number[] => def.rows.flatMap((row) => row.tiles.map((tile, x) => ((row.upperTiles?.[x] ?? -1) >= 0 ? row.upperTiles![x]! : tile)));
    const from = flat(kit), to = flat(variant), base = kitBaseTile(tileset);
    expect(to.some((tile, i) => tile !== from[i])).toBe(true);
    to.forEach((tile, i) => {
      if (tile < 0) return;
      expect(from[i]!).toBeGreaterThanOrEqual(0);
      expect(tileset.passability[tile]).toEqual(tileset.passability[from[i]!]);
      expect(tileset.priority[tile]).toBe(tileset.priority[from[i]!]);
      expect(base(tile)).toBe(from[i]);
    });
    // 같은 그림을 다시 청하면 같은 칸이다(이식 칸을 두 번 만들지 않는다)
    expect(flat(standVariantKit(tileset, kit, "oakwood", 1)!)).toEqual(to);
  });

  it("퍼뜨려 고르기: 다른 게임들의 겉모습을 주면 덜 쓴 숲 구성·다른 주 수종을 먼저 고르고, 주지 않으면 열쇠 해시 그대로다", () => {
    const keys = Array.from({ length: 12 }, (_, n) => JSON.stringify(["project", `spread-${n}`]));
    const taken: TilesetLook[] = [];
    for (const key of keys) taken.push(chooseTilesetLook(looks, key, taken)!);
    // 열두 게임이 숲 구성도, 주 수종도 한 쌍 겹치지 않는다(선택지 스물하나 · 주 수종 열 넘게)
    expect(new Set(taken.map((look) => look.stand ?? "")).size).toBe(12);
    const dominants = taken.map((look) => table.stands[look.stand ?? ""]?.dominant ?? "orig");
    expect(new Set(dominants).size).toBe(12);
    // 같은 열쇠·같은 목록이면 같은 겉모습, 빈 목록·다른 타일셋의 겉모습은 없는 것과 같다
    expect(chooseTilesetLook(looks, keys[5]!, taken.slice(0, 5))).toEqual(taken[5]);
    const alone = chooseTilesetLook(looks, keys[3]!)!;
    expect(chooseTilesetLook(looks, keys[3]!, [])).toEqual(alone);
    expect(chooseTilesetLook(looks, keys[3]!, [undefined, { textureKey: "tex_other_looks", stand: alone.stand, surface: alone.surface }])).toEqual(alone);
    // 선택지를 다 쓰고 나면 다시 처음부터 고르게 돈다(스물한 게임이 스물한 가지)
    const many: TilesetLook[] = [];
    for (let n = 0; n < tilesetLookOptions(looks, "stand").length; n += 1) many.push(chooseTilesetLook(looks, JSON.stringify(["project", `many-${n}`]), many)!);
    expect(new Set(many.map((look) => look.stand ?? "")).size).toBe(tilesetLookOptions(looks, "stand").length);
  });

  it("숲 도로: 숲 구성을 고른 게임은 숲 바닥이 깔리고 숲 수관 위에 나무 머리가 서며, 맵 끝은 열리지 않는다. 열쇠 없는 도로는 그대로다", () => {
    const route = (key?: string): { project: Project; map: GameMap } => {
      const ctx = { project: createBlankProject() as Project, assistantRun: true, ...(key ? { lookKey: key } : {}) } as ToolContext & { currentMapId?: string };
      ctx.currentMapId = ctx.project.startMapId;
      expect(runTool(ctx, "create_map", { id: "map_route", name: "숲 도로", width: 40, height: 30, tilesetId: TS }, { dryRun: false }).ok).toBe(true);
      expect(runTool(ctx, "author_wild_route", { mapId: "map_route", exits: [{ x: 0, y: 22 }, { x: 39, y: 6 }], seed: 242 }, { dryRun: false }).ok).toBe(true);
      return { project: ctx.project, map: ctx.project.maps.map_route! };
    };
    const key = ((): string => { for (let n = 0; ; n += 1) { const k = JSON.stringify(["project", `route-${n}`]); if (chooseTilesetLook(looks, k)?.stand) return k; } })();
    const plain = route(), looked = route(key);
    expect((plain.project.tilesets[TS]!.tileGrafts ?? []).some((graft) => graft.sourceChipset === table.texture)).toBe(false);
    const tileset = looked.project.tilesets[TS]!, map = looked.map;
    expect(tileset.look?.stand).toBe(chooseTilesetLook(looks, key)!.stand);
    const own = new Set((tileset.tileGrafts ?? []).filter((graft) => graft.sourceChipset === table.texture).map((graft) => graft.targetTile));
    let floor = 0, crowns = 0;
    for (let i = 0; i < map.width * map.height; i += 1) {
      if (own.has(layerTileAt(map, 2, i))) floor += 1;
      if (own.has(layerTileAt(map, 4, i))) { crowns += 1; expect(isPassable(looked.project, map, i % map.width, Math.floor(i / map.width)), `나무 머리 칸 ${i}`).toBe(false); }
    }
    // 숲 도로의 풀은 «숲 장면 잔디» 칸이다 — 그 칸을 풀로 읽지 못하면 숲 바닥이 한 칸도 깔리지 않는다(2026-11-13 에 그랬다)
    expect(floor).toBeGreaterThan(200);
    expect(crowns).toBeGreaterThan(100);
    // 맵 끝의 걷는 칸은 열쇠 없는 도로와 같다(출구뿐) — 숲 끝을 들쭉날쭉하게 덜어 내도 맵 끝 두 칸은 건드리지 않는다
    const edgeWalk = (project: Project, m: GameMap): string => {
      let out = "";
      for (let x = 0; x < m.width; x += 1) out += (isPassable(project, m, x, 0) ? "1" : "0") + (isPassable(project, m, x, m.height - 1) ? "1" : "0");
      for (let y = 0; y < m.height; y += 1) out += (isPassable(project, m, 0, y) ? "1" : "0") + (isPassable(project, m, m.width - 1, y) ? "1" : "0");
      return out;
    };
    expect(edgeWalk(looked.project, map)).toBe(edgeWalk(plain.project, plain.map));
    // 열쇠 없는 도로에서 걷던 칸은 여전히 걷는다(숲 끝을 덜어 낸 자리만 늘어난다 — 덤불이 선 칸은 뺀다)
    let closed = 0;
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isPassable(plain.project, plain.map, x, y) && !isPassable(looked.project, map, x, y)) closed += 1;
    expect(closed).toBe(0);
  }, 240_000);

  it("깊은 숲(던전 주제 forest): 숲 구성을 고른 게임은 수관 위에 나무 머리가 서고 빈터에 숲 바닥이 깔리며, 걷는 칸·이벤트 자리는 열쇠 없는 숲과 같다", () => {
    const wood = (key?: string): { project: Project; map: GameMap } => {
      const project = createBlankProject() as Project;
      const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(key ? { lookKey: key } : {}) } as ToolContext;
      const spec = { type: "dungeon", theme: "forest", size: "small", name: "깊은 숲", salt: 250118 } as unknown as PlaceSpec;
      const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
      expect(res.ok, res.summary).toBe(true);
      return { project: ctx.project, map: ctx.project.maps[res.mapIds[0]!]! };
    };
    const key = ((): string => { for (let n = 0; ; n += 1) { const k = JSON.stringify(["project", `wood-${n}`]); if (chooseTilesetLook(looks, k)?.stand) return k; } })();
    const plain = wood(), looked = wood(key);
    expect(standCells(plain.project, plain.map)).toEqual([]);
    const tileset = looked.project.tilesets[TS]!, map = looked.map;
    const own = new Set((tileset.tileGrafts ?? []).filter((graft) => graft.sourceChipset === table.texture).map((graft) => graft.targetTile));
    let floor = 0, crowns = 0;
    for (let i = 0; i < map.width * map.height; i += 1) {
      const x = i % map.width, y = Math.floor(i / map.width);
      if (own.has(layerTileAt(map, 2, i))) floor += 1;
      if (own.has(layerTileAt(map, 4, i))) { crowns += 1; expect(isPassable(looked.project, map, x, y), `나무 머리 칸 ${i}`).toBe(false); }
    }
    // 숲 던전의 바닥은 공용 잔디가 아니라 잔잔한 3×3 잔디다 — 그 칸을 풀밭으로 넘기지 않으면 빈터에 숲 바닥이 한 칸도 깔리지 않는다
    expect(floor).toBeGreaterThan(100);
    expect(crowns).toBeGreaterThan(60);
    expect(walkGrid(looked.project, map)).toBe(walkGrid(plain.project, plain.map));
    const spots = (m: GameMap): string => m.events.map((event) => `${event.x},${event.y}`).sort().join(" ");
    expect(spots(map)).toBe(spots(plain.map));
  }, 240_000);

  it("겉모습이 없는 게임·숲 구성 없는 옛 겉모습 게임에는 숲 그림판 칸이 하나도 없다", () => {
    for (const look of [undefined, { surface: "steppe", trees: "birch", woods: "wall" }]) {
      const { project, map } = village(look, look ? JSON.stringify(["project", "old-look"]) : undefined);
      expect(standCells(project, map)).toEqual([]);
      expect((project.tilesets[TS]!.tileGrafts ?? []).some((graft) => graft.sourceChipset === table.texture)).toBe(false);
      expect(activeTileGrafts(project.tilesets[TS]!).some((graft) => graft.sourceChipset === table.texture)).toBe(false);
    }
  }, 240_000);
});
