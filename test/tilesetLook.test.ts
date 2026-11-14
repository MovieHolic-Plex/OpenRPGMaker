// 게임마다 한 가지 겉모습(project/tilesetLook.ts · assets/tilesetLooks.ts): 바닥·길·광장 재질, 나무 수종, 숲 생김새.
// 겉모습은 타일셋의 look 한 줄이고 그림은 그릴 때만 겹친다 — 맵의 칸 번호·통행은 그대로여야 한다.
import { describe, expect, it } from "vitest";
import looks from "@/assets/beodeulLooks.json";
import sheet from "@/assets/beodeulCitySheet.json";
import { activeTileGrafts, tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { tilesetLookGround, tilesetLookGrafts, tilesetLookOptions, tilesetLookTableFor, TILESET_LOOK_PARTS } from "@/assets/tilesetLooks";
import { bundledChipsetFrameCount, BUNDLED_REFERENCE_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { createBlankProject } from "@/project/defaults";
import { chooseTilesetLook, projectTilesetLook, settleProjectLook } from "@/project/tilesetLook";
import { compileReliefStyle, reliefRampArt, reliefStyleForGround } from "@/project/relief/styles";
import { isPassable } from "@/project/collision";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { deserialize, serialize } from "@/project/io";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import type { ToolContext } from "@/editor/tools/types";
import type { Project, TilesetLook } from "@/project/types";

const TS = "beodeul_city";
const table = tilesetLookTableFor(TS)!;
const GAMES = Array.from({ length: 400 }, (_, n) => JSON.stringify(["project", `game-${n}`]));
// 갈래가 여덟(바닥·나무·숲·집 벌·광장·숲 구성·풀밭 얼룩·풀 결 — 풀 결은 늘 하나 고른다)이라 «한 갈래만 고른 게임» 은 드물다 — 찾을 때는 넉넉히 훑는다(해시뿐이라 싸다)
const keyWhere = (test: (look: TilesetLook | undefined) => boolean): string => {
  for (let n = 0; n < 600_000; n += 1) { const key = JSON.stringify(["project", `game-${n}`]); if (test(chooseTilesetLook(table, key))) return key; }
  throw new Error("그런 겉모습을 고르는 게임 열쇠가 없다");
};

function village(key: string | undefined, salt = 4242): { project: Project; mapId: string } {
  const project = createBlankProject() as Project;
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
    const plain = village(undefined), looked = village(key);
    expect(plain.project.tilesets[TS]!.look).toBeUndefined();
    const look = looked.project.tilesets[TS]!.look!;
    expect(look).toEqual(chooseTilesetLook(table, key));
    // 직렬화·모양 검사를 지나도 남는다
    expect(deserialize(serialize(looked.project)).tilesets[TS]!.look).toEqual(look);
    const a = plain.project.maps[plain.mapId]!, b = looked.project.maps[looked.mapId]!;
    expect(Array.from(b.lowerTiles)).toEqual(Array.from(a.lowerTiles));
    // (위층은 같지 않다 — 1차의 기물 변형이 같은 열쇠로 게임마다 다른 킷을 찍는다. 통행은 아래에서 칸마다 본다)
    for (let y = 0; y < a.height; y += 1) for (let x = 0; x < a.width; x += 1) expect(isPassable(looked.project, b, x, y)).toBe(isPassable(plain.project, a, x, y));
    // 절벽 둑은 그 바닥 색 변형 양식을 쓴다(벽·계단은 같다)
    if (b.relief) expect(b.relief.style).toBe(reliefStyleForGround(a.relief!.style!, tilesetLookGround(TS, look)));
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
});
