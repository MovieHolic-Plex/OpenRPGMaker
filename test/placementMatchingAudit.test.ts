// 2026-09-27 배치 매칭 전수 조사의 회귀 못. 이름·재료와 다른 그림을 조용히 고르던 경로를 하나씩 막는다.
import { describe, expect, it } from "vitest";
import { pickNpcGraphic } from "@/assets/charsetQuery";
import { bundledTileSemantics, searchResources } from "@/assets/resourceSearch";
import { runTool, type ToolContext } from "@/editor/tools";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { createBlankProject } from "@/project/defaults";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsDungeon";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";

const slot = (graphic: ReturnType<typeof resolveGraphic>) => ({
  sheet: graphic.sprite?.id,
  index: decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex,
});

describe("charset 검색은 낱말 하나만 맞는 칸을 고르지 않는다", () => {
  it("「고양이 석상」은 살아 있는 고양이가 아니다", () => {
    expect(pickNpcGraphic("고양이 석상")).toBeNull();
  });
  it("한 글자 질의는 다른 낱말 속 글자에 걸리지 않는다", () => {
    expect(pickNpcGraphic("용")?.label).not.toBe("청년 용사");
    expect(pickNpcGraphic("돌")?.label).not.toBe("동양풍 떠돌이 검객");
  });
  it("사물 이벤트 「큰 나무」는 나무 문 그림을 받지 않는다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const res = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_big_tree", name: "큰 나무", x: 2, y: 2, trigger: { kind: "action" }, commands: [{ kind: "text", body: "오래된 나무다." }] } });
    expect(res.ok, res.summary).toBe(true);
    const page = ctx.project.maps[ctx.project.startMapId]!.events.find((entry) => entry.id === "ev_big_tree")!.pages![0]!;
    expect(page.graphic.sprite?.id).not.toBe("tex_easyrpg_charset_object1");
  });
  it("「강철 문」은 나무 문이 아니다", () => {
    expect(pickNpcGraphic("강철 문")?.label ?? "").not.toMatch(/나무/u);
  });
  it("맵에 왕이 이미 있어도 「왕」은 여왕으로 바뀌지 않는다", () => {
    const king = pickNpcGraphic("왕")!;
    const again = pickNpcGraphic("왕", { avoidKeys: new Set([`${king.textureKey}#${king.characterIndex}`]) });
    expect(again?.label).toBe("왕");
  });
  it("textureKey 자리의 라벨은 칸까지 찾는다(보물상자 ≠ 나무 문)", () => {
    expect(slot(resolveGraphic({ textureKey: "보물 상자" }))).toEqual({ sheet: "tex_easyrpg_charset_object1", index: 6 });
  });
});

describe("못 찾은 그림은 거절한다", () => {
  it("place_trap graphic.query 미매칭은 주민 그림이 아니라 오류", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const res = runTool(ctx, "place_trap", { mapId: ctx.project.startMapId, at: { x: 3, y: 3 }, trigger: "touch", graphic: { query: "가시덫" } });
    expect(res.ok).toBe(false);
    expect(res.issues?.[0]?.code).toBe("graphic-not-found");
  });
  it("이름이 「철제 금고」인 보관 상자는 금고 그림이다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const res = runTool(ctx, "place_storage_chest", { mapId: ctx.project.startMapId, x: 4, y: 4, name: "철제 금고" });
    expect(res.ok, res.summary).toBe(true);
    const event = ctx.project.maps[ctx.project.startMapId]!.events.find((entry) => entry.name === "철제 금고" || entry.pages?.[0]?.name === "철제 금고");
    expect(slot(event!.pages![0]!.graphic)).toEqual({ sheet: "tex_easyrpg_charset_object2", index: 2 });
  });
});

describe("재료 이름은 수식어를 버리고 풀리지 않는다", () => {
  const town = defaultTilesets()["easyrpg_chipset_combined_town"]!;
  it("「황금 나무 상자」는 나무 상자로 자동 시공되지 않는다", () => {
    const hit = resolveMaterialByLabel(town, "황금 나무 상자", { preferGroup: true, preferRoles: ["prop", "terrain"] });
    expect(hit.status === "approved" && "tileId" in hit ? hit.tileId : undefined).not.toBe(237);
  });
  it("「우편함 없는 제단」은 우편함이 아니다", () => {
    const hit = resolveMaterialByLabel(town, "우편함 없는 제단", { preferGroup: true });
    expect(hit.status).toBe("missing");
  });
});

describe("타일 라벨은 그 시트의 그림을 말한다", () => {
  const tilesets = defaultTilesets();
  it("표 없는 번들 시트는 합본 마을 라벨을 통째로 물려받지 않는다", () => {
    const castle = tilesets["opengameart_castle"]!;
    const labels = new Map(bundledTileSemantics(castle).map((entry) => [entry.index, entry.label]));
    expect(labels.get(266)).toBeUndefined();
  });
  it("숲마을은 합본 마을과 픽셀이 같은 칸만 그 라벨을 쓴다", () => {
    const forest = tilesets["forest_harmony"]!;
    const own = bundledTileSemantics(forest);
    expect(own.length).toBeGreaterThan(100);
    expect(own.length).toBeLessThan(244);
  });
  it("tileMeta 에 설명 없는 칸이 있어도 타일 검색이 죽지 않는다", () => {
    for (const id of ["forest_harmony", "forest_harmony_snow", "atlas_biome_jungle"]) {
      expect(() => searchResources("tile", "나무", { tileset: tilesets[id] })).not.toThrow();
    }
  });
  it("던전 시트: 441~443 은 마법진, 444·445·474·475 는 계단, 446 은 석주, 447 은 왕좌, 118 은 수정", () => {
    const label = (index: number) => DUNGEON_TILE_SEMANTICS.find((entry) => entry.index === index)?.label ?? "";
    expect(label(441)).toMatch(/마법진/u);
    expect(label(27)).toMatch(/마법진/u);
    for (const stairs of [444, 445, 474, 475]) expect(label(stairs)).toMatch(/계단/u);
    expect(label(446)).toMatch(/기둥/u);
    expect(label(447)).toMatch(/왕좌/u);
    expect(label(118)).toMatch(/수정/u);
    expect(label(117)).toMatch(/레일/u);
  });
  it("사용자 확정(2026-09-28): 배·레트로 시트의 계단·선체·성벽 라벨", () => {
    const tilesets = defaultTilesets();
    const at = (id: string, tile: number) => bundledTileSemantics(tilesets[id]).find((entry) => entry.index === tile)?.label ?? "";
    expect(at("easyrpg_chipset_ship", 474)).toMatch(/내려가는 계단/u);
    expect(at("easyrpg_chipset_ship", 475)).toMatch(/내려가는 계단/u);
    for (const hull of [262, 289, 293, 319, 322, 323, 349, 410]) expect(at("easyrpg_chipset_ship", hull)).toMatch(/배|선체|선수/u);
    expect(at("easyrpg_chipset_retro_exterior", 268)).toMatch(/올라가는 계단/u);
    expect(at("easyrpg_chipset_retro_exterior", 350)).toBe("빨간 우체통");
    expect(at("easyrpg_chipset_retro_exterior", 359)).toBe("동굴 입구 하단 바닥");
    expect(at("easyrpg_chipset_retro_exterior", 382)).toMatch(/우물/u);
    for (const wall of [434, 435, 464]) expect(at("easyrpg_chipset_retro_house", wall)).toMatch(/성벽/u);
    expect(at("easyrpg_chipset_retro_world", 444)).toMatch(/올라가는 계단/u);
    expect(at("easyrpg_chipset_retro_world", 475)).toMatch(/내려가는 계단/u);
    expect(at("easyrpg_chipset_world", 282)).toMatch(/바위/u);
    expect(at("easyrpg_chipset_interior", 357)).toMatch(/피아노 좌/u);
  });
});

describe("list_resources(kind:tile) 은 그 맵의 타일셋에서 찾는다", () => {
  it("숲마을 시작 맵이면 숲마을 타일셋을 본다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const res = runTool(ctx, "list_resources", { kind: "tile", query: "나무", mapId: ctx.project.startMapId });
    expect(res.ok, res.summary).toBe(true);
  });
});

