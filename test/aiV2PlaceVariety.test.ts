// 조수가 짓는 게임이 매번 비슷하다(2026-11-16 감독·오너 «집·소품이 매번 같은 것, 방이 통째로 같은 것 … 둘 다 문제야») — 구성기의 기본값에서 다양함이 나오게.
// 잰 것(모델 없음, 같은 인자에 씨앗만 바꿔 여섯 판 — ~/z-project/assistant-fable-runs/av2-variety):
//   · 실내 칸 배치는 받은 그대로 깔아 같은 뼈대는 화소까지 같은 방이었다(대성당 여섯 판 같은 해시) → 게임마다의 천 색을 목록 카드로 모델에게 건네고
//     (짓기는 모델의 id 를 그대로 깐다 — 감독 2026-11-16), 모델이 쓰지 않는 천장만 짓기가 게임마다 고른다.
//   · 마을 카드의 종류 예 첫째(fishing-cove)를 r6·r7a·r7 세 판 모두 그대로 보냈다 → 예 넷을 게임마다(요청에 가까운 것이 앞, 나머지는 열쇠로 섞은 차례).
//   · 실내 목록 카드의 «이 요청에 맞는 기물» 이 늘 같은 차례였다(r7 대성당이 앞 스물셋 가운데 열하나를 옮겼다) → 차례를 게임 열쇠로.
//   · 방 구성 그림은 용도마다 늘 같은 두셋이었다 → 갈래 안에서 열쇠로.
//   · 포구 마을의 일터는 여섯 판 모두 회벽 화물 창고, 작은 집은 늘 같은 두 채였다 → 씨앗이 고른 킷을 먼저 가까운 자리에서 본다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { HAND_INTERIOR_SPECS } from "@/editor/handInterior/builder";
import { gameColour, interiorCeiling, paletteColours, paletteFamilies } from "@/ai/v2/place/interiorPalette";
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

describe("실내의 게임 색 — 모델이 적는다, 짓기는 받은 그대로", () => {
  it("색 낱말과 색 한 벌은 칩셋 표에서 온다(손 목록 없음) — 같은 칸 모양·놓는 법에 끝 낱말만 색이 다른 것", () => {
    expect(paletteColours(S)).toEqual(expect.arrayContaining(["red", "blue", "green"]));
    const fam = paletteFamilies(S);
    expect([...fam.get("line:rug")!.values()]).toContain("rug red");
    expect([...fam.get("object:banner")!.keys()].sort()).toEqual(["blue", "green", "red"]);
    // 칸 모양이 다른 «column marble · column stone» 은 색 한 벌이 아니다(끝 낱말이 색 낱말이 아니다)
    expect([...fam.keys()].some((k) => k.startsWith("object:column"))).toBe(false);
    for (const members of fam.values()) for (const id of members.values()) { const o = S.objects[id]; if (o) expect(o.kind).not.toBe("door"); }
  });

  it("열쇠가 없으면 색·천장을 고르지 않고, 같은 열쇠면 늘 같다", () => {
    expect(gameColour(S, undefined)).toBeUndefined();
    expect(gameColour(S, "")).toBeUndefined();
    expect(interiorCeiling(S, "")).toBeUndefined();
    expect(gameColour(S, "k1")).toEqual(gameColour(S, "k1"));
    expect(interiorCeiling(S, "k1")).toBe(interiorCeiling(S, "k1"));
    // 한 게임의 색 식구는 모두 그 색이다(깔개 줄이 맨 앞)
    for (const key of KEYS) { const g = gameColour(S, key)!; expect(g.ids[0]).toBe(`rug ${g.colour}`); for (const id of g.ids) expect(id.endsWith(` ${g.colour}`)).toBe(true); }
  });

  it("같은 요청 · 다른 게임 → 평면 줄의 천 색과 목록 앞머리의 색이 다르다", () => {
    const ts = createBlankProject().tilesets.atlas_biome_interior!;
    const card = (key: string) => chipsetCatalog(ts, "바닷가 마을 하나와, 그 마을 성당 안을 지어 줘", key)!.split("\n");
    const colours = KEYS.map((key) => /This game's cloth colour: ([a-z]+)/u.exec(card(key).find((l) => l.startsWith("plan for this game"))!)![1]!);
    expect(new Set(colours).size).toBeGreaterThanOrEqual(3);
    KEYS.forEach((key, i) => {
      const lines = card(key);
      // 깔개 줄 목록은 이 게임 색이 맨 앞
      expect(/^carpets[^:]*: ([^,]+)/u.exec(lines.find((l) => l.startsWith("carpets"))!)![1]).toBe(`rug ${colours[i]}`);
      // «이 요청에 맞는 기물» 에 한 벌의 식구가 있으면 이 게임 색의 식구가 다른 색보다 앞
      const sug = lines.find((l) => l.startsWith("suggested for this request"))!.slice(lines.find((l) => l.startsWith("suggested"))!.indexOf("): ") + 3).split(", ").map((e) => e.replace(/ \d+x\d+ .*$/u, ""));
      for (const members of paletteFamilies(S).values()) {
        const at = [...members].map(([c, id]) => [c, sug.indexOf(id)] as const).filter(([, n]) => n >= 0);
        const mine = at.find(([c]) => c === colours[i]);
        if (at.length && mine) for (const [, n] of at) expect(mine[1]).toBeLessThanOrEqual(n);
      }
    });
    // 열쇠가 없으면 차례도 줄도 예전 그대로
    expect(card("").find((l) => l.startsWith("plan for this game"))).toBeUndefined();
    expect(card("").find((l) => l.startsWith("carpets"))).toMatch(/: rug red, rug royal/u);
  });

  it("모델이 적은 rug red 는 어느 게임이든 rug red 로 깔린다 — 짓기는 id 를 바꾸지 않고 천장만 고른다", () => {
    const plain = layChapel(CHAPEL);
    const rugCells = (p: Project, id: string) => JSON.stringify((p.maps[id]!.lowerOverlayTiles ?? []).slice(7 + 6 * 24, 10 + 6 * 24));
    const walk = (p: Project, id: string) => { const m = p.maps[id]!; let out = ""; for (let y = 0; y < m.height; y += 1) for (let x = 0; x < m.width; x += 1) out += isPassable(p, m, x, y) ? "1" : "0"; return out; };
    const laid = KEYS.map((key) => layChapel({ ...CHAPEL, variety: `${key}|대성당` }, key));
    for (const l of laid) {
      expect(rugCells(l.project, l.mapId)).toBe(rugCells(plain.project, plain.mapId));
      expect(JSON.stringify(l.project.maps[l.mapId]!.lowerOverlayTiles)).toBe(JSON.stringify(plain.project.maps[plain.mapId]!.lowerOverlayTiles));
      expect(walk(l.project, l.mapId)).toBe(walk(plain.project, plain.mapId));
      expect(l.warnings.join(" ")).not.toMatch(/recoloured/u);
    }
    // 천장(모델이 쓰지 않는 칸)만 게임마다 — 여섯 열쇠면 둘 이상
    expect(new Set(laid.map((l) => tilesOf(l.project, l.mapId))).size).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it("다시 깔면(review_layout · edit_place) 처음 고른 천장 그대로다 — 다른 열쇠로 다시 깔아도", () => {
    const first = layChapel({ ...CHAPEL, variety: `${KEYS[1]}|대성당` }, KEYS[1]);
    const ctx = { project: first.project, currentMapId: first.project.startMapId, assistantRun: true, lookKey: KEYS[4] };
    const again = builderFor(CHAPEL)!.build(createBuildRun(ctx as never), { ...CHAPEL, salt: 999, mapId: first.mapId, hints: { layoutRepairsLeft: 0 } } as PlaceSpec) as unknown as { ok: boolean; mapIds: string[] };
    expect(again.ok).toBe(true);
    expect(tilesOf((ctx as { project: Project }).project, again.mapIds[0]!)).toBe(tilesOf(first.project, first.mapId));
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
    const sorted = (l: string) => l.slice(l.indexOf("): ") + 3).split(", ").sort().join(",");
    const lines = KEYS.map(line);
    expect(new Set(lines).size).toBeGreaterThanOrEqual(4);
    for (const l of lines) expect(sorted(l)).toBe(sorted(lines[0]!));
  });

  it("목록 카드의 «이 게임의 평면»: 열쇠마다 랜드마크 쪽·곁방 쓰임·입구 자리가 갈린다 — 표에서 온 낱말뿐, 열쇠가 없으면 없다", () => {
    const ts = createBlankProject().tilesets.atlas_biome_interior!;
    const plan = (key: string, text = "바닷가 마을 하나와, 그 마을 성당 안을 지어 줘") => chipsetCatalog(ts, text, key)!.split("\n").find((l) => l.startsWith("plan for this game"));
    expect(plan("")).toBeUndefined();
    expect(chipsetCatalog(ts, "방탈출 게임 만들어 줘.", KEYS[0]!)!).not.toContain("plan for this game");
    const lines = KEYS.map((key) => plan(key)!);
    expect(new Set(lines).size).toBeGreaterThanOrEqual(4);
    expect(plan(KEYS[0]!)).toBe(lines[0]);
    // 동·서 끝은 그 예제 방에 그쪽을 보는 기물이 둘 이상일 때만(예배당: 회중석·제단) — 여관 방에는 없다
    expect(lines.some((l) => l.includes("east end (pieces that face it: pew E2, altar E)"))).toBe(true);
    for (const key of KEYS) expect(plan(key, "여관 1층 하나 지어 줘")!).toContain("landmark at the north wall");
    // 곁방 쓰임은 같은 예제 건물(예배당)의 다른 방이다
    for (const l of lines) for (const room of (/side rooms: ([^;]*), on the/u.exec(l)?.[1] ?? "").split(", ").filter(Boolean)) expect(["bell tower", "vestry"]).toContain(room);
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
