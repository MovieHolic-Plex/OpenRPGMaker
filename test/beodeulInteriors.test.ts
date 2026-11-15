// 버들항 집 안(beodeul_city 실내 토막 fable_interior) — 사양·견본·바깥 양식 배선.
import { describe, expect, it } from "vitest";
import { BEODEUL_INTERIOR_SPEC, BEODEUL_INTERIOR_TILESET_ID, HAND_INTERIOR_SPECS, buildHandInteriorLayers, roomSpecOf } from "@/editor/handInterior/builder";
import { roomTemplates } from "@/editor/handInterior/templates";
import { BEODEUL_INTERIOR_KIT_PREFIX, createBeodeulCityTileset, ensureBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createBlankProject } from "@/project/defaults";
import { exteriorLook, exteriorWall } from "@/ai/v2/place/builders/interiorExterior";
import { interiorTilesetOf, resolveKind } from "@/ai/v2/place/builders/interiorKind";
import { pickTemplate } from "@/ai/v2/place/builders/interiorFill";
import { personalPlan } from "@/editor/handInterior/personal";
import { furnishRooms } from "@/editor/handInterior/furnish";
import { withComposedRooms } from "@/editor/handInterior/rooms";
import catalog from "../tiledata/beodeul-interiors/catalog.json";

const S = BEODEUL_INTERIOR_SPEC;
const BASE = 48512, END = 52608;

describe("버들항 실내 사양", () => {
  const ts = createBeodeulCityTileset();
  it("고정 예약 토막 48,512~52,607 안에만 굽고 시트는 그 끝까지다", () => {
    expect(catalog.base).toBe(BASE); expect(catalog.reserved).toBe(END - BASE);
    const pins = Object.values(catalog.pins as Record<string, number>);
    expect(Math.min(...pins)).toBe(BASE); expect(Math.max(...pins)).toBeLessThan(END);
    expect(new Set(pins).size).toBe(pins.length);
    expect(ts.count).toBeGreaterThanOrEqual(END); expect(ts.count % ts.tilesPerRow).toBe(0);
    expect(ts.tileMeta?.[BASE - 1]?.label ?? "").not.toContain("버들항 실내");
  });
  it("칩셋이 방 짓기 역할표를 들고 태어나고 옛 사본도 받는다", () => {
    expect(ts.roomKit).toEqual({ builtin: BEODEUL_INTERIOR_TILESET_ID });
    expect(roomSpecOf(ts)).toBe(S); expect(HAND_INTERIOR_SPECS[BEODEUL_INTERIOR_TILESET_ID]).toBe(S);
    const old = createBeodeulCityTileset(); delete old.roomKit;
    old.structureKits = old.structureKits!.filter((k) => !k.id.startsWith(BEODEUL_INTERIOR_KIT_PREFIX));
    expect(ensureBeodeulCityTileset(old)).toBe(true);
    expect(old.roomKit).toEqual({ builtin: BEODEUL_INTERIOR_TILESET_ID });
    expect(old.structureKits!.some((k) => k.id === `${BEODEUL_INTERIOR_KIT_PREFIX}bar counter`)).toBe(true);
  });
  it("구조 칸 수: 벽면 2줄×3열×서쪽 그림자, 바닥 주기×4, 테두리 32 + 모서리", () => {
    for (const w of Object.values(S.walls)) { expect(w.cols).toBe(3); expect(w.tiles).toHaveLength(12); }
    for (const f of Object.values(S.floors)) expect(f.tiles).toHaveLength(f.cols * f.rows * 4);
    for (const [id, c] of Object.entries(S.ceilings)) { expect(c).toHaveLength(32); expect(Object.keys(S.ceilingCorners![id]!).length).toBeGreaterThan(40); }
    expect(Object.keys(S.ceilings)).toContain("default");
  });
  it("통행: 벽면·테두리·가구 발밑은 막히고 바닥·깔개·빛 무늬는 걷고 솟은 칸은 사람 위에 그린다", () => {
    const shut = (t: number) => !Object.values(ts.passability[t]!).some(Boolean);
    expect(shut(S.walls.plaster!.tiles[0]!)).toBe(true); expect(shut(S.ceilings.default![1]!)).toBe(true); expect(shut(S.void)).toBe(true);
    expect(shut(S.floors.dplank!.tiles[0]!)).toBe(false);
    const bar = S.objects["bar counter"]!;
    for (const [, dy, t] of bar.cells) { expect(shut(t!)).toBe(dy! >= 0); if (dy! < 0) expect(ts.priority[t!]).toBe("upper"); }
    for (const id of ["hearth glow", "window light", "rush mat"]) for (const [, , t] of S.objects[id]!.cells) expect(shut(t!)).toBe(false);
  });
  it("바깥 기물은 새로 굽지 않고 그 칸 번호를 가구로 등록한다", () => {
    const barrel = S.objects.barrel!;
    expect(barrel.cells.every((c) => c[2]! < BASE)).toBe(true); expect(barrel.kind).toBe("floor"); expect(barrel.h).toBe(1);
    expect(catalog.reused).toBeGreaterThan(60);
  });
  it("벽면이 테두리를 정한다 — 돌벽 방에 나무 벽 윗면이 서지 않는다", () => {
    const build = (wall: string) => buildHandInteriorLayers({ plan: ["#####", "#...#", "#...#", "#...#", "##.##"], floor: "flag", wall }, undefined, S);
    expect(build("plaster").lowerTiles[0]).toBe(S.ceilings.default![0] ?? -1);
    const stone = build("rubble");
    expect(S.ceilings.rock).toContain(stone.lowerTiles[1]); expect(S.ceilings.default).not.toContain(stone.lowerTiles[1]);
  });
});

describe("버들항 방 견본", () => {
  const tpls = roomTemplates(BEODEUL_INTERIOR_TILESET_ID);
  it("견본마다 조립기 오류 없이 지어진다", () => {
    expect(tpls.length).toBeGreaterThanOrEqual(60);
    expect(new Set(tpls.map((t) => t.kind)).size).toBeGreaterThanOrEqual(31);
    for (const t of tpls) {
      const door = Math.floor((t.w - 1) / 2) + 1, W = t.w + 2;
      const plan = ["#".repeat(W), ...Array.from({ length: t.h }, () => `#${".".repeat(t.w)}#`), "#".repeat(door) + "." + "#".repeat(W - door - 1)];
      const L = buildHandInteriorLayers({ plan, floor: t.floor, wall: t.wall, objects: t.items.filter((i) => i.t === "o").map((i) => ({ id: i.id, x: i.x + 1, y: i.y + 1 })), goods: t.items.filter((i) => i.t === "g").map((i) => ({ id: i.id, x: i.x + 1, y: i.y + 1 })) }, undefined, S);
      expect(L.issues.filter((i) => i.severity === "error").map((i) => `${t.id}: ${i.message}`)).toEqual([]);
    }
  });
  it("방 종류마다 그 방의 일(불·판매대·침대…)이 있고, 불 없는 방에는 등이 있다", () => {
    const light = (id: string) => !!S.objects[id]?.use?.includes("light") || id === "window";
    for (const t of tpls) expect(t.items.some((i) => light(i.id)), t.id).toBe(true);
    expect(S.rooms!.examples.length).toBe(tpls.length);
    for (const k of new Set(tpls.map((t) => t.kind))) expect(S.rooms!.kinds[k], k).toBeTruthy();
  });
  it("같은 종류의 두 벌은 게임 열쇠로 갈린다(작게 지어도)", () => {
    for (const kind of ["tavern", "living", "general_store", "forge", "study", "kitchen", "bakery_shop"]) {
      const picked = new Set(Array.from({ length: 24 }, (_, i) => pickTemplate(BEODEUL_INTERIOR_TILESET_ID, kind, "small", { key: `게임 ${i}|${kind}`, single: true, text: kind })!.id));
      expect(picked.size, kind).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("집 안은 바깥을 따른다", () => {
  const project = createBlankProject();
  const ts = createBeodeulCityTileset();
  project.tilesets[ts.id] = ts;
  project.maps[project.startMapId]!.tilesetId = ts.id;
  const kitOf = (style: string) => ts.structureKits!.find((k) => k.ai?.tags?.includes(`style:${style}`))!.id;
  it("바깥 맵이 버들항이면 버들항 칩셋으로 짓고, 화풍 낱말이 다른 칩셋을 부르면 그쪽이다", () => {
    expect(interiorTilesetOf(project, { type: "interior", name: "여관" }, project.startMapId).tilesetId).toBe(ts.id);
    expect(interiorTilesetOf(project, { type: "interior", name: "여관", exterior: { tileset: ts.id } }).tilesetId).toBe(ts.id);
    expect(interiorTilesetOf(project, { type: "interior", name: "여관", style: "modern" }, project.startMapId).tilesetId).not.toBe(ts.id);
    expect(interiorTilesetOf(createBlankProject(), { type: "interior", name: "여관" }).tilesetId).toBe("atlas_biome_interior");
  });
  it("문이 달린 집 킷의 양식이 벽면을 고른다 — 불 방의 돌과 표에 없는 벽은 그대로", () => {
    const look = (style: string) => exteriorLook(project, { exterior: { tileset: ts.id, kit: kitOf(style) } })!;
    expect(look("log").style).toBe("log");
    expect(exteriorWall(S, look("log"), "plaster")).toBe("log");
    expect(exteriorWall(S, look("log"), "rubble")).toBe("rubble");
    expect(exteriorWall(S, look("harbourstone"), "plaster")).toBe("stone");
    expect(exteriorWall(S, look("violetslate"), "rubble")).toBe("grey");
    expect(exteriorWall(S, look("halftimber"), "plaster")).toBe("plaster");
    expect(exteriorWall(S, look("log"), "slumw")).toBe("slumw");
    // 양식 태그가 없는 원본 버들항 집 = 목골 그대로
    expect(exteriorWall(S, exteriorLook(project, { exterior: { tileset: ts.id, kit: "bd-house-smithy" } }), "plaster")).toBe("plaster");
  });
  it("방 이름은 칩셋 방 표의 별칭으로 읽는다(촌장 집 → 살림집 방)", () => {
    const notes: string[] = [];
    expect(resolveKind(ts.id, { kind: "촌장 집", purpose: "촌장 집" }, notes, "촌장 집", true)).toBe("living");
    expect(resolveKind(ts.id, { kind: "여관", purpose: "여관" }, notes, "여관", true)).toBe("tavern");
    expect(resolveKind(ts.id, { kind: "방앗간", purpose: "방앗간" }, notes, "방앗간", true)).toBe("mill");
    expect(resolveKind(ts.id, { kind: "대장간", purpose: "대장간" }, notes, "대장간", true)).toBe("forge");
    // 그 칩셋만 가진 종류는 두루 낱말(오두막 → 살림집)보다 먼저, 여럿이 맞으면 가장 긴 별칭
    expect(resolveKind(ts.id, { kind: "어부 오두막", purpose: "어부 오두막" }, notes, "어부 오두막", true)).toBe("fisher");
    expect(resolveKind(ts.id, { kind: "등대", purpose: "등대" }, notes, "등대", true)).toBe("lighthouse");
    expect(resolveKind(ts.id, { kind: "구둣방", purpose: "구둣방" }, notes, "구둣방", true)).toBe("cobbler");
    expect(resolveKind(ts.id, { kind: "사냥꾼의 집", purpose: "사냥꾼의 집" }, notes, "사냥꾼의 집", true)).toBe("living");
  });
});

describe("사는 사람의 물건", () => {
  const P = S.personal!;
  it("표의 조각은 모두 사양에 있고, 직업 묶음만 별칭을 가진다", () => {
    for (const [id, set] of Object.entries(P.sets)) for (const piece of set.pieces) expect(!!S.objects[piece] || S.goods[piece] !== undefined, `${id}: ${piece}`).toBe(true);
    for (const id of P.surfaces) expect(S.objects[id]?.surface, id).toBeTruthy();
    expect(Object.values(P.sets).filter((v) => v.alias?.length).length).toBeGreaterThanOrEqual(8);
    expect(Object.values(P.sets).filter((v) => !v.alias?.length).length).toBeGreaterThanOrEqual(8);
  });
  it("집 이름의 직업이 묶음을 부르고, 이름이 말하지 않은 집은 열쇠가 살림 묶음을 고른다 — 같은 열쇠면 같은 답", () => {
    const hunter = personalPlan(S, "living", { key: "게임|사냥꾼의 집", text: "사냥꾼의 집" })!;
    expect(hunter.sets[0]).toBe("hunter"); expect(hunter.pieces[0]).toMatch(/boar trophy|bow and quiver|fox pelt|bow rack|boots/u);
    const plain = Array.from({ length: 30 }, (_, i) => personalPlan(S, "living", { key: `게임|${i}번 집`, text: `${i}번 집` })!);
    for (const p of plain) { expect(p.sets.every((id) => !P.sets[id]!.alias?.length)).toBe(true); expect(p.count).toBeGreaterThanOrEqual(P.count[0]); expect(p.count).toBeLessThanOrEqual(P.count[1]); }
    expect(new Set(plain.map((p) => p.sets.join("+"))).size).toBeGreaterThanOrEqual(8);
    expect(personalPlan(S, "living", { key: "k", text: "집" })).toEqual(personalPlan(S, "living", { key: "k", text: "집" }));
    expect(personalPlan(S, "forge", { key: "k", text: "대장간" })).toBeUndefined();
  });
  it("같은 견본으로 지은 두 집이 같은 방이 아니고, 넣은 물건이 길을 막지 않는다", () => {
    const tset = createBeodeulCityTileset();
    const built = (key: string, text: string) => {
      const room = { id: "living", kind: "living", x0: 1, y0: 1, x1: 10, y1: 8, floor: "dplank", wall: "plaster", template: "authored-bd-living-a" };
      const c = withComposedRooms({ floor: "dplank", wall: "plaster", rooms: [room] } as never, S);
      const composed = c.composed!, base = c.input as Parameters<typeof furnishRooms>[0];
      const f = furnishRooms(base, [room], composed, BEODEUL_INTERIOR_TILESET_ID, tset, S, "A", { living: { key, text } });
      const L = buildHandInteriorLayers(f.input, tset, S);
      expect(L.issues.filter((i) => i.severity === "error")).toEqual([]); expect(L.unreachedFloor).toEqual([]);
      return f.perRoom.living!;
    };
    const a = built("게임|어부의 집", "어부의 집"), b = built("게임|사냥꾼의 집", "사냥꾼의 집"), none = built("게임|한스의 집", "한스의 집");
    expect(a.dropped).toBe(0); expect(a.personal!.length).toBeGreaterThanOrEqual(2); expect(b.personal!.length).toBeGreaterThanOrEqual(2);
    expect(a.personal).not.toEqual(b.personal); expect(none.personal!.length).toBeGreaterThanOrEqual(1);
    expect(a.personal!.some((id) => P.sets.fisher!.pieces.includes(id))).toBe(true);
  });
});
