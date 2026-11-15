// 게임마다 한 가지 겉모습(project/tilesetLook.ts · assets/tilesetLooks.ts): 바닥·길·광장 재질, 나무 수종, 숲 생김새.
// 겉모습은 타일셋의 look 한 줄이고 그림은 그릴 때만 겹친다 — 맵의 칸 번호·통행은 그대로여야 한다.
import { describe, expect, it } from "vitest";
import looks from "@/assets/beodeulLooks.json";
import sheet from "@/assets/beodeulCitySheet.json";
import { activeTileGrafts, tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { tilesetLookCliff, tilesetLookGround, tilesetLookGrafts, tilesetLookOptions, tilesetLookReliefStyle, tilesetLookTableFor, TILESET_LOOK_PARTS } from "@/assets/tilesetLooks";
import { bundledChipsetFrameCount, BUNDLED_REFERENCE_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { createBlankProject } from "@/project/defaults";
import { chooseTilesetLook, projectTilesetLook, settleProjectLook } from "@/project/tilesetLook";
import { compileReliefStyle, reliefRampArt, reliefStyleForGround } from "@/project/relief/styles";
import { isPassable } from "@/project/collision";
import { layerTileAt } from "@/project/mapLayers";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { deserialize, serialize } from "@/project/io";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import type { ToolContext } from "@/editor/tools/types";
import type { Project, TilesetLook } from "@/project/types";

const TS = "beodeul_city";
const table = tilesetLookTableFor(TS)!;
const GAMES = Array.from({ length: 400 }, (_, n) => JSON.stringify(["project", `game-${n}`]));
// 갈래가 일곱(바닥·나무·숲·집 벌·광장·숲 구성·풀밭 얼룩)이라 «한 갈래만 고른 게임» 은 드물다 — 찾을 때는 넉넉히 훑는다(해시뿐이라 싸다)
const keyWhere = (test: (look: TilesetLook | undefined) => boolean): string => {
  for (let n = 0; n < 600_000; n += 1) { const key = JSON.stringify(["project", `game-${n}`]); if (test(chooseTilesetLook(table, key))) return key; }
  throw new Error("그런 겉모습을 고르는 게임 열쇠가 없다");
};

function village(key: string | undefined, salt = 4242, look?: TilesetLook): { project: Project; mapId: string } {
  const project = createBlankProject() as Project;
  if (look) project.tilesets[TS]!.look = look; // 겉모습을 미리 적어 고정한다(같은 게임의 «원래 모습» 판을 지을 때)
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(key ? { lookKey: key } : {}) } as ToolContext;
  const spec = { type: "village", name: "버들 마을", salt } as PlaceSpec;
  const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
  expect(res.ok).toBe(true);
  return { project: ctx.project, mapId: res.mapIds[0]! };
}

describe("tileset look — 게임마다 한 가지 겉모습", () => {
  it("표: 그림판 칸은 그림판 안, 덮는 칸은 버들항 시트 안, 겉모습 블록끼리 겹치지 않는다", () => {
    expect(table.tilesetId).toBe(TS);
    expect(BUNDLED_REFERENCE_CHIPSET_ASSETS.some((asset) => asset.textureKey === table.texture)).toBe(true);
    expect(bundledChipsetFrameCount(table.texture)).toBe(looks.count);
    expect(bundledChipsetTilesPerRow(table.texture)).toBe(table.tilesPerRow);
    const used = new Set<number>();
    const take = (tile: number) => { expect(tile).toBeGreaterThan(0); expect(tile).toBeLessThan(table.count); expect(used.has(tile)).toBe(false); used.add(tile); };
    const pairs = (rows: readonly number[] | undefined, limit?: number) => { for (let i = 0; i + 1 < (rows ?? []).length; i += 2) { if (limit) expect(rows![i]!).toBeLessThan(limit); take(rows![i + 1]!); } };
    for (const target of [...table.targets.ground, ...table.targets.paved]) expect(target).toBeLessThan(sheet.count);
    expect(new Set([...table.targets.ground, ...table.targets.paved]).size).toBe(table.targets.ground.length + table.targets.paved.length);
    for (const ground of Object.values(table.grounds)) {
      for (let i = 0; i < table.targets.ground.length; i += 1) take(ground.base + i);
      for (const rows of Object.values(ground.sources ?? {})) pairs(rows);
    }
    for (const option of Object.values(table.parts.surface.options)) {
      if (option.ground) expect(table.grounds[option.ground]).toBeDefined();
      for (let i = 0; i < table.targets.paved.length; i += 1) take(option.base! + i);
    }
    for (const option of Object.values(table.parts.trees.options)) { pairs(option.pairs, sheet.count); for (const rows of Object.values(option.sources ?? {})) pairs(rows); }
    expect(Object.keys(table.parts.surface.options).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(table.parts.trees.options).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(table.parts.woods.options).length).toBeGreaterThanOrEqual(3);
  });

  it("고르기: 같은 게임은 늘 같은 겉모습, 게임이 다르면 갈리고, 갈래마다 모든 선택지(원래 모습 포함)가 나온다", () => {
    const picks = GAMES.map((key) => chooseTilesetLook(table, key));
    expect(GAMES.map((key) => chooseTilesetLook(table, key))).toEqual(picks);
    for (const part of TILESET_LOOK_PARTS) {
      const seen = new Set(picks.map((look) => look?.[part] ?? ""));
      expect([...seen].sort()).toEqual([...tilesetLookOptions(table, part)].sort());
    }
    // 갈래는 서로 따로 갈린다 — 바닥 겉모습이 같아도 나무 수종은 여러 가지
    const steppeTrees = new Set(picks.filter((look) => look?.surface === picks.find((p) => p?.surface)!.surface).map((look) => look?.trees ?? ""));
    expect(steppeTrees.size).toBeGreaterThan(2);
    for (const look of picks) if (look) expect(look.textureKey).toBe(table.texture);
  });

  it("그리는 이식 목록: look 이 없으면 저장된 이식 그대로, 있으면 그 겉모습 그림이 겹치고 캐시 열쇠가 달라진다", () => {
    const project = createBlankProject() as Project;
    const tileset = project.tilesets[TS]!;
    const plain = activeTileGrafts(tileset);
    expect(plain.some((graft) => graft.sourceChipset === table.texture)).toBe(false);
    const surface = Object.keys(table.parts.surface.options).find((id) => table.parts.surface.options[id]!.ground)!;
    const trees = Object.keys(table.parts.trees.options)[0]!;
    const withLook = { ...tileset, look: { textureKey: table.texture, surface, trees } };
    const drawn = activeTileGrafts(withLook);
    const fromLook = drawn.filter((graft) => graft.sourceChipset === table.texture);
    expect(fromLook.length).toBeGreaterThan(table.targets.ground.length + table.targets.paved.length);
    expect(drawn.length).toBe(plain.length + fromLook.filter((graft) => graft.targetTile < sheet.count).length);
    // 풀밭 칸(737)과 길 포석 몸통(3221)은 겉모습 그림으로, 저장된 이식 칸 수는 그대로
    expect(fromLook.some((graft) => graft.targetTile === 737)).toBe(true);
    expect(fromLook.some((graft) => graft.targetTile === 3221)).toBe(true);
    expect(tileGraftsTextureSuffix(withLook)).not.toBe(tileGraftsTextureSuffix(tileset));
    expect(tileGraftsTextureSuffix({ ...withLook, look: { textureKey: table.texture, surface, trees: Object.keys(table.parts.trees.options)[1]! } })).not.toBe(tileGraftsTextureSuffix(withLook));
    // 사용자가 직접 덮어쓴 시트 칸은 건드리지 않는다
    const overridden = { ...withLook, tileGrafts: [...(tileset.tileGrafts ?? []), { targetTile: 737, sourceChipset: "tex_beodeul_nature", sourceTile: 0 }] };
    expect(activeTileGrafts(overridden).find((graft) => graft.targetTile === 737)!.sourceChipset).toBe("tex_beodeul_nature");
    // 다른 그림(올린 그림·다른 시트)의 타일셋에는 걸리지 않는다
    expect(tilesetLookGrafts({ ...withLook, image: { type: "bundled", id: "tex_other" } })).toEqual([]);
    // 원래 모습만 고른 look(그림 갈래 없음)은 아무것도 겹치지 않는다
    expect(tilesetLookGrafts({ ...tileset, look: { textureKey: table.texture, woods: "wall" } })).toEqual([]);
    expect(tilesetLookGrafts({ ...tileset, look: { textureKey: table.texture, woods: "wall", meadow: "flowers" } })).toEqual([]);
    expect(tileGraftsTextureSuffix({ ...tileset, look: { textureKey: table.texture, woods: "wall" } })).toBe(tileGraftsTextureSuffix(tileset));
  });

  it("마을 짓기: 조수 실행이 첫 버들항 맵을 지으면 겉모습이 타일셋에 적히고, 바닥 재질만 고른 게임은 바닥 칸 번호·통행이 열쇠 없는 판과 같다", () => {
    // 풀밭 얼룩(meadow)은 고른 게임으로 — 얼룩은 2층 덧그림이라 1층 칸 번호·통행이 그대로여야 한다(숲 구성 stand 는 나무 자리를 바꾸니 뺀다).
    const key = keyWhere((look) => !!look?.surface && !look.trees && !look.woods && !look.houses && !look.plaza && !look.stand && !!look.meadow && !!tilesetLookGround(TS, look));
    const looked = village(key);
    expect(village(undefined).project.tilesets[TS]!.look).toBeUndefined();
    const look = looked.project.tilesets[TS]!.look!;
    // 견줄 «열쇠 없는 판» 은 같은 절벽 모습만 적어 둔 판이다 — 절벽 모습(cliff)은 단 높이와 절벽 줄 굽이를 정해 땅 자체를 바꾼다(2026-11-14).
    const plain = village(undefined, 4242, { textureKey: table.texture, cliff: look.cliff! });
    expect(look).toEqual(chooseTilesetLook(table, key));
    // 직렬화·모양 검사를 지나도 남는다
    expect(deserialize(serialize(looked.project)).tilesets[TS]!.look).toEqual(look);
    const a = plain.project.maps[plain.mapId]!, b = looked.project.maps[looked.mapId]!;
    // 1층은 열쇠 없는 판과 같다. 하나만 다르다(2026-11-14 물): 한 칸 폭 나루의 널판 칸이 게임 열쇠가 있으면 «물 + 3층 징검돌» 이다(editor/tools/beodeulWater.ts
    // stoneBeodeulFords — 징검돌은 새 종류 기물이라 열쇠 없는 짓기에는 놓이지 않는다). 그 칸은 물 칸이고 3층이 차 있으며 몇 칸뿐이다.
    const water = new Set(looked.project.tilesets[TS]!.autotileGroups!.find((g) => g.id === "beodeul_canal_lake_47")!.memberTileIds);
    const stones = Array.from(b.lowerTiles.keys()).filter((c) => b.lowerTiles[c] !== a.lowerTiles[c]);
    expect(stones.length).toBeLessThanOrEqual(6);
    for (const c of stones) { expect(water.has(b.lowerTiles[c]!)).toBe(true); expect(layerTileAt(b, 3, c)).toBeGreaterThanOrEqual(0); expect(water.has(a.lowerTiles[c]!)).toBe(false); }
    // (위층은 같지 않다 — 1차의 기물 변형이 같은 열쇠로 게임마다 다른 킷을 찍는다. 통행은 아래에서 칸마다 본다)
    // 통행을 견줄 판은 같은 게임(같은 열쇠)의 원래 모습 마을이다. 열쇠 없는 판과는 통행을 견주지 않는다 —
    // 열쇠가 있으면 그 게임의 새 종류 기물이 놓여(editor/tools/beodeulObjectSets.ts) 막힌 칸과 그 뒤 나무 자리가 다르다. 1층 칸 번호는 징검돌 나루 칸 말고는 열쇠 없는 판과도 같다(위).
    const sameGame = village(key, 4242, { textureKey: table.texture, cliff: look.cliff! });
    const c = sameGame.project.maps[sameGame.mapId]!;
    expect(Array.from(b.lowerTiles)).toEqual(Array.from(c.lowerTiles));
    for (let y = 0; y < c.height; y += 1) for (let x = 0; x < c.width; x += 1) expect(isPassable(looked.project, b, x, y)).toBe(isPassable(sameGame.project, c, x, y));
    // 절벽 둑은 그 바닥 색 변형 양식을 쓴다(벽·계단은 같다)
    // 절벽은 게임의 절벽 모습 양식에 그 바닥 색을 입힌 것이다(면·계단은 절벽 모습 그대로)
    if (b.relief) {
      expect(b.relief.style).toBe(tilesetLookReliefStyle(TS, look, "grass-steps"));
      expect(b.relief.style).toBe(reliefStyleForGround(tilesetLookCliff(TS, look)!.style, tilesetLookGround(TS, look)));
      expect(a.relief!.style).toBe(tilesetLookCliff(TS, look)!.style);
      // 단 높이는 같다. 절벽 줄의 칸은 같지 않을 수 있다 — 굽이는 다 지은 뒤 빈 땅에만 넣으므로(소품·나무 자리를 본다) 기물이 다른 판과 굽이 자리가 다르다
      // (2026-11-15 CI: 굽이를 땅 만들 때 넣던 판의 «levels 가 같다» 는 두 칸이 달라 깨졌다).
      const tiers = (levels: ArrayLike<number>) => [...new Set(Array.from(levels))].sort((x, y) => x - y);
      expect(tiers(b.relief.levels)).toEqual(tiers(a.relief!.levels));
    }
    // 같은 게임의 둘째 맵도 같은 겉모습(타일셋에 적힌 값을 읽는다) — 다른 열쇠가 와도 바뀌지 않는다
    expect(projectTilesetLook(looked.project, TS, GAMES[0])).toEqual(look);
  }, 240_000);

  it("이미 그 칩셋으로 지은 맵이 있는 프로젝트(옛 게임)는 겉모습을 고르지 않는다", () => {
    const before = village(undefined).project;
    const key = keyWhere((look) => !!look?.surface);
    expect(projectTilesetLook(before, TS, key)).toBeUndefined();
    const draft = structuredClone(before);
    settleProjectLook(before, draft, key);
    expect(draft.tilesets[TS]!.look).toBeUndefined();
    // 빈 프로젝트에서 맵을 짓지 않은 호출(읽기·DB 편집)은 타일셋을 건드리지 않는다
    const blank = createBlankProject() as Project, blankDraft = structuredClone(blank);
    expect(projectTilesetLook(blank, TS, key)).toEqual(chooseTilesetLook(table, key));
    settleProjectLook(blank, blankDraft, key);
    expect(blankDraft.tilesets[TS]!.look).toBeUndefined();
    settleProjectLook(blank, blankDraft, undefined);
    expect(blankDraft.tilesets[TS]!.look).toBeUndefined();
  }, 240_000);

  it("바닥 재질마다 풀 둑 변형 양식이 있고 계단 도트는 원래 양식 것을 쓴다", () => {
    for (const ground of Object.keys(table.grounds)) {
      const style = reliefStyleForGround("grass-steps", ground);
      expect(style).toBe(`grass-steps@${ground}`);
      expect(compileReliefStyle(style)).not.toBeNull();
      expect(reliefRampArt(style)).toBe(reliefRampArt("grass-steps"));
    }
    expect(reliefStyleForGround("grass-steps", undefined)).toBe("grass-steps");
    expect(reliefStyleForGround("snow-steps", Object.keys(table.grounds)[0])).toBe("snow-steps");
  });

  it("절벽 모습: 새 게임은 모두 하나를 받고, 덧붙인 갈래가 앞 갈래들의 고르기를 바꾸지 않는다", () => {
    const names = Object.keys(table.parts.cliff!.options);
    expect(names.length).toBeGreaterThanOrEqual(6);
    expect(tilesetLookOptions(table, "cliff")).toEqual(names);   // «원래 모습» 선택지가 없다
    for (const name of names) {
      const cliff = tilesetLookCliff(TS, { textureKey: table.texture, cliff: name })!;
      expect(compileReliefStyle(cliff.style)!.natural).not.toBeNull();
      expect(reliefRampArt(cliff.style)).toBe(reliefRampArt("grass-steps"));
      for (const tall of [cliff.step, cliff.lone ?? cliff.step]) { expect(tall).toBeGreaterThanOrEqual(1); expect(tall).toBeLessThanOrEqual(3); }
      expect(cliff.straight).toBeGreaterThanOrEqual(3);
    }
    // 두 칸·세 칸 절벽이 표에 있다. 한 칸 절벽은 생성기·시공기가 짓지만(beodeulTerrainCliffHabit.test) 아직 어느 모습에도 주지 않았다 —
    // 2026-11-15 프로브 30마을에서 한 칸 절벽 마을 5곳의 못 닿는 윗단 칸이 늘었다(두 칸·외딴 세 칸은 0곳).
    const tall = new Set(names.flatMap((name) => { const c = tilesetLookCliff(TS, { textureKey: table.texture, cliff: name })!; return [c.step, c.lone ?? c.step]; }));
    expect([...tall].sort()).toEqual([2, 3]);
    // 절벽 갈래를 뺀 표로 고른 것 = 지금 고른 것에서 cliff 만 뺀 것
    const { cliff: _cliff, ...rest } = table.parts;
    const before = { ...table, parts: rest } as unknown as typeof table;
    for (const key of GAMES.slice(0, 60)) {
      const now = chooseTilesetLook(table, key)!, { cliff, ...others } = now;
      expect(names).toContain(cliff);
      expect(chooseTilesetLook(before, key)).toEqual(others);
    }
    // 눈·모래·이탄·동굴 둑은 그 바이옴 양식 그대로, 겉모습이 없으면 받은 양식 그대로
    const look = chooseTilesetLook(table, GAMES[0]!)!;
    for (const style of ["snow-steps", "sand-steps", "peat-steps", "cave-steps"]) expect(tilesetLookReliefStyle(TS, look, style)).toBe(style);
    expect(tilesetLookReliefStyle(TS, undefined, "grass-steps")).toBe("grass-steps");
    expect(tilesetLookReliefStyle(TS, { textureKey: table.texture, surface: "coast" }, "grass-steps")).toBe("grass-steps@ground-sand");
  });
});
