// 조수가 짓는 게임이 매번 비슷하다(2026-11-16 감독·오너 «집·소품이 매번 같은 것, 방이 통째로 같은 것 … 둘 다 문제야») — 구성기의 기본값에서 다양함이 나오게.
// 잰 것(모델 없음, 같은 인자에 씨앗만 바꿔 여섯 판 — ~/z-project/assistant-fable-runs/av2-variety):
//   · 실내 칸 배치는 받은 그대로 깔아 같은 뼈대는 화소까지 같은 방이었다(대성당 여섯 판 같은 해시) → 게임 색(깔개·깃발·침대 색 한 벌 · 천장)을 게임마다.
//   · 마을 카드의 종류 예 첫째(fishing-cove)를 r6·r7a·r7 세 판 모두 그대로 보냈다 → 예 넷을 게임마다(요청에 가까운 것이 앞, 나머지는 열쇠로 섞은 차례).
//   · 실내 목록 카드의 «이 요청에 맞는 기물» 이 늘 같은 차례였다(r7 대성당이 앞 스물셋 가운데 열하나를 옮겼다) → 차례를 게임 열쇠로.
//   · 방 구성 그림은 용도마다 늘 같은 두셋이었다 → 갈래 안에서 열쇠로.
//   · 포구 마을의 일터는 여섯 판 모두 회벽 화물 창고, 작은 집은 늘 같은 두 채였다 → 씨앗이 고른 킷을 먼저 가까운 자리에서 본다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { HAND_INTERIOR_SPECS } from "@/editor/handInterior/builder";
import { applyInteriorPalette, colourNamedIds, interiorPalette, paletteColours, paletteFamilies } from "@/ai/v2/place/interiorPalette";
import { BEODEUL_VILLAGE_KINDS, VILLAGE_KIND_EXAMPLES, villageKindById, villageKindExamples, villageKindMenu } from "@/editor/tools/beodeulVillageKinds";
import { VILLAGE_CARD, villageCard } from "@/ai/v2/place/builders/village";
import { roomIdeasFor } from "@/ai/v2/place/roomIdeas";
import { chipsetCatalog } from "@/ai/v2/place/interiorCatalog";
import { builderFor } from "@/ai/v2/place/builders";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import type { PlaceSpec } from "@/ai/v2/shared/types";

const S = HAND_INTERIOR_SPECS.atlas_biome_interior!;
const KEYS = Array.from({ length: 6 }, (_, n) => JSON.stringify(["project", `variety-game-${n}`]));

/** r7 «대성당» 의 칸 배치(실모델 make_place 인자 그대로 — 융단 rug red · 랜드마크 altar). */
const CHAPEL: PlaceSpec = { type: "interior", name: "대성당", salt: 4242, variety: "", layout: {
  map: { w: 24, h: 22 }, landmark: { id: "altar", x: 8, y: 3, purpose: "예배당 정면의 제단" },
  outer_wall: { material: "marblewall", path: [[0, 0], [23, 0], [23, 21], [0, 21], [0, 0]] },
  walls: [{ id: "w_east", material: "marblewall", thickness: 1, path: [[17, 0], [17, 21]] }, { id: "w_crypt", material: "stone", thickness: 1, path: [[17, 11], [23, 11]] }],
  doors: [{ wall: "w_east", x: 17, y: 18 }, { wall: "w_crypt", x: 20, y: 11 }], entrance: { x: 8, y: 21 },
  rooms: [{ id: "nave", at: [8, 12], floor: "marble", purpose: "넓은 예배당", role: "main" }, { id: "vestry", at: [20, 17], floor: "parquet", purpose: "제의실", role: "side" }, { id: "cryptstair", at: [20, 8], floor: "flag", purpose: "지하 묘지로 내려가는 길목", role: "stairs" }],
  daises: [{ id: "dais marble", x: 5, y: 3, w: 7, h: 3 }], carpets: [{ id: "rug red", x: 7, y: 6, w: 3, h: 15 }],
  wall_items: [{ id: "tall stained window", wall: "outer", x: 2, y: 1 }, { id: "tall stained window", wall: "outer", x: 11, y: 1 }, { id: "pipe organ", wall: "outer", x: 1, y: 3 }],
  objects: [{ id: "pew", x: 3, y: 8, repeat: { count: 5, dy: 2, dx: 0 } }, { id: "pew", x: 12, y: 8, repeat: { count: 5, dy: 2, dx: 0 } }, { id: "candelabra", x: 6, y: 4 }, { id: "candelabra", x: 11, y: 4 }],
  required: [{ ask: "넓은 예배당", ids: ["pew", "altar"] }],
} } as unknown as PlaceSpec;

function layChapel(spec: PlaceSpec, lookKey?: string): { project: Project; mapId: string; warnings: string[] } {
  const project = createBlankProject() as Project;
  const ctx = { project, currentMapId: project.startMapId, assistantRun: lookKey !== undefined, ...(lookKey ? { lookKey } : {}) };
  const res = builderFor(spec)!.build(createBuildRun(ctx as never), { ...spec, hints: { layoutRepairsLeft: 0 } }) as unknown as { ok: boolean; summary: string; mapIds: string[]; warnings: string[] };
  expect(res.ok, res.summary).toBe(true);
  return { project: (ctx as { project: Project }).project, mapId: res.mapIds[0]!, warnings: res.warnings };
}
/** 그려지는 칸 전부(바닥 · 깔개 덧칸 · 윗층 · 윗 덧칸) — 깔개는 바닥 덧칸(lowerOverlayTiles)에 깔린다. */
const tilesOf = (p: Project, mapId: string) => { const m = p.maps[mapId]!; return JSON.stringify([m.lowerTiles, m.lowerOverlayTiles ?? [], m.upperTiles, m.upperOverlayTiles ?? []]); };

describe("실내 칸 배치의 게임 색", () => {
  it("색 낱말과 색 한 벌은 칩셋 표에서 온다(손 목록 없음) — 같은 칸 모양·놓는 법에 끝 낱말만 색이 다른 것", () => {
    expect(paletteColours(S)).toEqual(expect.arrayContaining(["red", "blue", "green"]));
    const fam = paletteFamilies(S);
    expect([...fam.get("line:rug")!.values()]).toContain("rug red");
    expect([...fam.get("object:banner")!.keys()].sort()).toEqual(["blue", "green", "red"]);
    // 칸 모양이 다른 «column marble · column stone» 은 색 한 벌이 아니다(끝 낱말이 색 낱말이 아니다)
    expect([...fam.keys()].some((k) => k.startsWith("object:column"))).toBe(false);
    for (const members of fam.values()) for (const id of members.values()) { const o = S.objects[id]; if (o) expect(o.kind).not.toBe("door"); }
  });

  it("열쇠가 없으면(사람 편집·옛 호출) 아무것도 바꾸지 않고, 같은 열쇠면 늘 같은 색이다", () => {
    expect(interiorPalette(S, undefined).swap.size).toBe(0);
    expect(interiorPalette(S, "").ceiling).toBeUndefined();
    const a = interiorPalette(S, "k1"), b = interiorPalette(S, "k1");
    expect([...a.swap]).toEqual([...b.swap]);
    expect(a.ceiling).toBe(b.ceiling);
  });

  it("같은 뼈대 여섯 판이 같은 방이 아니다 — 융단 색·천장이 게임마다 다르고, 칸 배치(벽·문·기물 자리)는 그대로다", () => {
    const laid = KEYS.map((key) => layChapel({ ...CHAPEL, variety: `${key}|대성당` }, key));
    const looks = new Set(laid.map((l) => tilesOf(l.project, l.mapId)));
    expect(looks.size).toBeGreaterThanOrEqual(5);
    // 열쇠 없는 실행은 예전 그대로(색을 입히지 않는다)
    const plain = layChapel(CHAPEL);
    expect(plain.warnings.join(" ")).not.toMatch(/this game's colours/u);
    // 걷는 칸은 같다 — 색만 바뀌었다
    const walk = (p: Project, id: string) => { const m = p.maps[id]!; let out = ""; for (let y = 0; y < m.height; y += 1) for (let x = 0; x < m.width; x += 1) out += isPassable(p, m, x, y) ? "1" : "0"; return out; };
    for (const l of laid) expect(walk(l.project, l.mapId)).toBe(walk(plain.project, plain.mapId));
    // 바뀐 것은 보고에 적힌다
    expect(laid.some((l) => /this game's colours/u.test(l.warnings.join(" ")))).toBe(true);
  }, 120_000);

  it("요청·required·purpose 가 말한 색과 랜드마크는 그대로다", () => {
    expect([...colourNamedIds(S, "붉은 양탄자가 깔린 예배당")]).toContain("rug red");
    expect([...colourNamedIds(S, "파란 침대 두 개")]).toContain("bed blue");
    expect(colourNamedIds(S, "대성당 안은 넓은 예배당.").size).toBe(0);
    const palette = interiorPalette(S, "keep-test");
    const input = { objects: [{ id: "bed red", x: 1, y: 1 }, { id: "banner red", x: 2, y: 1 }], lines: [{ id: "rug red" }] };
    const kept = applyInteriorPalette(input, palette, new Set(["bed red", "rug red"]));
    expect(kept.input.objects![0]!.id).toBe("bed red");
    expect(kept.input.lines![0]!.id).toBe("rug red");
    // 요청 글이 «붉은 융단» 을 말한 판은 여섯 열쇠 모두 붉은 융단 그대로다
    for (const key of KEYS.slice(0, 3)) {
      const red = layChapel({ ...CHAPEL, variety: `${key}|붉은 융단이 깔린 대성당` }, key);
      const plain = layChapel(CHAPEL);
      const rugCells = (p: Project, id: string) => JSON.stringify((p.maps[id]!.lowerOverlayTiles ?? []).slice(7 + 6 * 24, 10 + 6 * 24));
      expect(rugCells(red.project, red.mapId)).toBe(rugCells(plain.project, plain.mapId));
    }
  }, 120_000);

  it("다시 깔면(review_layout · edit_place) 처음 고른 색 그대로다 — 이 기능 전에 깐 방은 색을 입히지 않는다", () => {
    const key = KEYS[1]!;
    const first = layChapel({ ...CHAPEL, variety: `${key}|대성당` }, key);
    const ctx = { project: first.project, currentMapId: first.project.startMapId, assistantRun: true, lookKey: KEYS[4] };
    // 다른 열쇠·다른 소금으로 다시 깔아도 선언에 적힌 색 열쇠를 쓴다
    const again = builderFor(CHAPEL)!.build(createBuildRun(ctx as never), { ...CHAPEL, salt: 999, variety: `${KEYS[4]}|x`, mapId: first.mapId, hints: { layoutRepairsLeft: 0 } } as PlaceSpec) as unknown as { ok: boolean; mapIds: string[] };
    expect(again.ok).toBe(true);
    const before = tilesOf(first.project, first.mapId);
    expect(tilesOf((ctx as { project: Project }).project, again.mapIds[0]!)).toBe(before);
  }, 120_000);
});

describe("마을 카드의 종류 예", () => {
  it("열쇠가 없으면 고정 예 넷, 열쇠마다 다른 예가 다른 차례로 — 글자 수는 고정 카드를 넘지 않는다", () => {
    expect(villageKindExamples()).toEqual([...VILLAGE_KIND_EXAMPLES]);
    expect(villageCard()).toBe(VILLAGE_CARD);
    const sets = KEYS.map((key) => villageKindExamples(key));
    for (const s of sets) { expect(s).toHaveLength(4); for (const id of s) expect(villageKindById(id)).toBeDefined(); }
    expect(new Set(sets.map((s) => s[0])).size).toBeGreaterThanOrEqual(3);
    for (const key of KEYS) expect(villageCard(key).length).toBeLessThanOrEqual(VILLAGE_CARD.length);
    expect(villageKindExamples(KEYS[0]!)).toEqual(villageKindExamples(KEYS[0]!));
  });

  it("요청에 가까운 종류가 맨 앞이다(표의 id·뜻·이름으로 잰다)", () => {
    for (const key of KEYS) expect(villageKindExamples(key, "포구 마을, 고기잡이로 먹고사는 어부들")[0]).toBe("fishing-cove");
    for (const key of KEYS) expect(villageKindExamples(key, "a quarry village")[0]).toBe("quarry");
  });

  it("땅 그림 답의 종류 목록: 그 물에 맞는 무리가 앞이고 그 안은 열쇠로 섞인다 — 서른여덟 다 실린다", () => {
    const heads = new Set(KEYS.map((key) => /for this water: ([a-z-]+)/u.exec(villageKindMenu({ water: "sea", key }))![1]));
    expect(heads.size).toBeGreaterThanOrEqual(2);
    for (const key of KEYS) { const menu = villageKindMenu({ water: "sea", key }); for (const k of BEODEUL_VILLAGE_KINDS) expect(menu).toContain(`${k.id} (`); }
    expect(villageKindMenu({ water: "sea" })).toBe(villageKindMenu({ water: "sea", key: "" }));
  });
});

describe("실내 설계 예", () => {
  it("방 구성 그림: 열쇠가 없으면 표의 차례, 열쇠마다 같은 갈래 안에서 다른 그림", () => {
    expect(roomIdeasFor("library", 2).map((r) => r.id)).toEqual(roomIdeasFor("library", 2, "").map((r) => r.id));
    const firsts = new Set(KEYS.map((key) => roomIdeasFor("library", 1, key)[0]!.id));
    expect(firsts.size).toBeGreaterThanOrEqual(2);
    for (const key of KEYS) expect(roomIdeasFor("library", 3, key).every((r) => r.kind === "study")).toBe(true);
  });

  it("목록 카드의 «이 요청에 맞는 기물»: 무리는 같고 차례가 게임마다 다르다", () => {
    const ts = createBlankProject().tilesets.atlas_biome_interior!;
    const line = (key: string) => chipsetCatalog(ts, "대성당 안은 넓은 예배당", key)!.split("\n").find((l) => l.startsWith("suggested for this request"))!;
    const sorted = (l: string) => l.slice(l.indexOf(":") + 1).split(", ").sort().join(",");
    const lines = KEYS.map(line);
    expect(new Set(lines).size).toBeGreaterThanOrEqual(4);
    for (const l of lines) expect(sorted(l)).toBe(sorted(lines[0]!));
  });
});

describe("포구 마을의 일터·작은 집", () => {
  /** r7 «갈매나루» 인자(땅 씨앗 · 자리 · kind fishing-cove) — 소금만 바꾼다. */
  const R7: PlaceSpec = { type: "village", name: "갈매나루", theme: "coast", features: ["plaza"], hints: { kind: "fishing-cove", terrainSeed: 75187, buildings: ["cathedral"],
    layout: { gather: { x: 18, y: 18, plaza: true }, work: { x: 34, y: 13 }, houses: [{ x: 12, y: 31, kind: "small" }, { x: 7, y: 16, kind: "medium" }, { x: 26, y: 14, kind: "small" }, { x: 22, y: 34, kind: "medium" }, { x: 32, y: 35, kind: "small" }, { x: 7, y: 25, kind: "large" }],
      forests: [{ x: 10, y: 4 }, { x: 25, y: 5 }], fields: [{ x: 41, y: 32 }], props: [{ x: 24, y: 22 }, { x: 30, y: 19 }, { x: 14, y: 23 }], exits: ["west"] } } } as unknown as PlaceSpec;
  it("종류의 일터 건물 둘이 씨앗에 따라 갈린다(전에는 여섯 판 모두 회벽 화물 창고)", () => {
    const works = new Set<string>();
    for (const salt of [101, 202, 303, 404, 505, 606]) {
      const project = createBlankProject() as Project;
      const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: JSON.stringify(["project", "work-kits"]) };
      const res = builderFor(R7)!.build(createBuildRun(ctx as never), { ...R7, salt }) as unknown as { ok: boolean; summary: string; mapIds: string[] };
      expect(res.ok, res.summary).toBe(true);
      for (const p of (ctx as { project: Project }).project.maps[res.mapIds[0]!]!.structurePlacements ?? []) if (p.kitId === "bd-house-ware0" || p.kitId === "bd-house-rv-r2-06") works.add(p.kitId);
    }
    expect([...works].sort()).toEqual(["bd-house-rv-r2-06", "bd-house-ware0"]);
  }, 240_000);
});
