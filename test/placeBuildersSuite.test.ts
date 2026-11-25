import { describe, expect, it } from "vitest";
import { JP_CITY_BUILDER, JP_CITY_CARD } from "@/ai/v2/place/builders/jpCity";
import type { BuildRun, PlaceSpec } from "@/ai/v2/shared/types";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { planJpCityScene } from "@/project/jpCitySceneComposer";
import { sceneCrosswalkTile } from "@/project/jpCitySceneRun";
import { pickSceneKind, SCENE_BUILDINGS, SCENE_KINDS, SCENE_SIZES, SCENE_TONES, sceneKindById, sceneList } from "@/project/jpCitySceneKinds";
import { planJpCityStreet } from "@/project/jpCityStreetComposer";
import { inMainWalkComponent, mainWalkComponent } from "@/project/walkComponent";
import { DECKS, type PlaceCandidate } from "@/ai/variation/decks";
import { deckFor, hash32, pickVariation } from "@/ai/variation/pick";
import { VARIATION_CARD_MAX, VARIATION_MARK, buildPath, variationCard } from "@/ai/variation/card";
import { WORLDS } from "@/ai/v2/place/world";
import { INTERIOR_CARD } from "@/ai/v2/place/builders/interior";
import { MODERN_KR_CARD } from "@/ai/v2/place/builders/modernCity";
import { VILLAGE_CARD, fixUnknownVillageKind, namedVillageSpec, unknownVillageKind, villageArgs, villageKindsLine } from "@/ai/v2/place/builders/village";
import { FACILITY_CATALOG } from "@/editor/handInterior/facilityVenues";
import { KR_DISTRICT_KINDS } from "@/project/modernCityDistrictKinds";
import { DUNGEON_TYPES } from "@/editor/dungeonKit/types";
import { BEODEUL_VILLAGE_KINDS, VILLAGE_KIND_EXAMPLES, chooseVillageKind, villageKindById, villageKindFits, villageKindsNearestFirst, type VillageFacts } from "@/editor/tools/beodeulVillageKinds";
import { brokenVillageScenes, sceneSlot, type PlacedScene } from "@/editor/tools/beodeulVillageScenes";
import { beodeulRouteGuard } from "@/editor/tools/beodeulObjectSets";
import { clearVillageKindPlan, recordVillageKind, villageKindOfMap, villageSceneByWord, villageScenesOfMap } from "@/project/villageKindPlan";
import { resolveWhere } from "@/ai/v2/place/where";
import { makeVerbContext } from "@/ai/v2/tools/context";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import "@/editor/tools/toolRegistry";
import { isolateTimers } from "./mergedTeardown";

// 일본 도시 거리 장면 구성기(조수가 짓는 거리, 게임 열쇠가 있는 호출): 같은 건물 그림이 한 지도에 두 번 서지 않고, 게임마다 다른 거리이고,
// 지은 지도의 모든 건물 문이 큰길에서 걸어서 닿는다. 열쇠 없는 호출은 옛 구성기 그대로다(대표작이 그 배치에 기댄다).
describe("jpCitySceneComposer", () => {
  isolateTimers();
  const STYLES = ["shopping", "residential", "shitamachi", "shotengai"] as const;
  function compose(style: string, seed: number, key: string | undefined, w = 60, h = 48) {
    const project = createBlankProject();
    project.tilesets[JP_CITY_ID] = createJpCityTileset();
    const hub = createStarterMap();
    Object.assign(hub, { id: "hub", name: "거리", tilesetId: JP_CITY_ID, width: w, height: h });
    hub.lowerTiles = new Array(w * h).fill(blankFillTileFor(JP_CITY_ID));
    hub.upperTiles = new Array(w * h).fill(-1);
    project.maps.hub = hub;
    const ctx = { project, assistantRun: key !== undefined, ...(key !== undefined ? { lookKey: key } : {}) };
    const res = runTool(ctx, "compose_jp_city_street", { mapId: "hub", style, seed, replace: true }, { dryRun: false });
    return { res, ctx };
  }
  describe("jp_city street scene composer", () => {
    it("is deterministic and never stands the same building picture twice on a 60×48 map", () => {
      for (const style of STYLES) for (let seed = 1; seed <= 6; seed++) {
        const plan = planJpCityScene({ mapId: "m", width: 60, height: 48, seed, style, key: "game-a" });
        expect(planJpCityScene({ mapId: "m", width: 60, height: 48, seed, style, key: "game-a" }).steps).toEqual(plan.steps);
        const looks = plan.placed.filter((p) => p.kit).map((p) => p.kit!.look ?? p.kit!.id);
        expect(new Set(looks).size, `${style} seed ${seed}: ${looks.join(" ")}`).toBe(looks.length);
        expect(plan.placed.length, `${style} seed ${seed}`).toBeGreaterThanOrEqual(8);
        for (const p of plan.placed) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x + p.w).toBeLessThanOrEqual(60); expect(p.y).toBeGreaterThanOrEqual(0); expect(p.foot).toBeLessThan(48); }
      }
    });

    it("gives each game its own street: kind, tone and building order follow the game key", () => {
      const plans = ["game-a", "game-b", "game-c", "game-d", "game-e", "game-f"].map((key) => planJpCityScene({ mapId: "m", width: 60, height: 48, seed: 1, style: "shopping", key }));
      expect(new Set(plans.map((p) => `${p.kind.id}|${p.tone.ko}|${p.placed.slice(0, 4).map((b) => b.kit?.id).join(",")}`)).size).toBeGreaterThanOrEqual(5);
      expect(new Set(plans.map((p) => p.kind.id)).size).toBeGreaterThanOrEqual(2);
      for (const p of plans) expect(p.kind.styles).toContain("shopping");
    });

    it("picks a kind that fits the request and lets the caller name one", () => {
      for (const style of STYLES) for (let seed = 0; seed < 8; seed++) expect(pickSceneKind({ style, key: "k", seed }).styles).toContain(style);
      expect(pickSceneKind({ style: "shopping", key: "k", seed: 0, kind: "monzen" }).id).toBe("monzen");
      // 가게를 많이 달라는 주택가 요청은 가게 자리가 넉넉한 종류만
      expect(pickSceneKind({ style: "residential", key: "k", seed: 0, shops: ["cafe", "ramen", "konbini", "shop"] }).maxShops).toBeGreaterThanOrEqual(4);
      const plan = planJpCityScene({ mapId: "m", width: 60, height: 48, seed: 2, style: "shopping", key: "game-a", shops: ["ramen", "konbini", "bento"] });
      expect(plan.placed.map((p) => p.role)).toEqual(expect.arrayContaining(["ramen", "konbini", "bento"]));
    });

    it("kinds data names only tones, building classes and kits that exist", () => {
      const cats = new Set(SCENE_BUILDINGS.map((b) => b.cat));
      for (const k of SCENE_KINDS) {
        for (const t of k.tones) expect(SCENE_TONES[t], `${k.id} tone ${t}`).toBeTruthy();
        for (const cat of Object.keys(k.mix)) if (cat !== "civic") expect(cats.has(cat), `${k.id} mix ${cat}`).toBe(true);
      }
      expect(sceneList("spill", "low").length).toBeGreaterThan(3);
      expect(SCENE_SIZES["jp-overpass-deck-red"]).toEqual([2, 6]);
    });

    it("builds a keyed street whose every door is reachable, and leaves keyless calls on the old composer", () => {
      for (const [style, seed] of [["shopping", 1], ["residential", 2], ["shotengai", 2]] as const) {
        const { res, ctx } = compose(style, seed, "game-a");
        expect(res.ok, res.summary).toBe(true);
        const map = ctx.project.maps.hub!;
        const walk = mainWalkComponent(ctx.project, map);
        const doors = (map.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building")).map((l) => /문 앞 접근칸 \((\d+),(\d+)\)/u.exec(l.note ?? "")).filter((m): m is RegExpExecArray => !!m);
        expect(doors.length, `${style} seed ${seed}`).toBeGreaterThanOrEqual(6);
        for (const m of doors) expect(inMainWalkComponent(walk, map, { x: Number(m[1]), y: Number(m[2]) }), `${style} seed ${seed} door front (${m[1]},${m[2]})`).toBe(true);
      }
      const keyless = compose("shotengai", 11, undefined, 40, 28);
      expect(keyless.res.ok, keyless.res.summary).toBe(true);
      expect(keyless.res.summary).toContain(planJpCityStreet({ mapId: "hub", width: 40, height: 28, seed: 11, style: "shotengai" }).summary.slice(0, 40));
    });

    it("names the street kind and its scene sets in English in the result, and takes a kind id through style", () => {
      const keyed = compose("shopping", 1, "game-a");
      expect(keyed.res.summary).toMatch(/^Street kind «[a-z -]+» \([a-z-]+\) 60×48, ground «[a-z -]+»: \d building rows along .+; block uses .+; scene sets .+; \d+ buildings/);
      const data = keyed.res.data as { streetKind?: string; streetKindName?: string; scenes?: string[] };
      expect(sceneKindById(data.streetKind)?.en).toBe(data.streetKindName);
      expect(data.scenes!.length).toBeGreaterThanOrEqual(3);
      for (const name of data.scenes!) expect(name).toMatch(/^[a-z -]+$/);
      // 열쇠 없는 호출이어도 종류를 이름으로 주면 그 종류로 짓는다
      const named = compose("monzen", 3, undefined, 48, 36);
      expect(named.res.ok, named.res.summary).toBe(true);
      expect((named.res.data as { streetKind?: string; style?: string })).toMatchObject({ streetKind: "monzen", style: "shitamachi" });
    });

    it("uses each game's paving shade across the street and one asphalt sheet across the road", () => {
      for (const [key, shadeCells] of [["game-b", [1, 7]], ["game-f", [3]]] as const) {
        const { res, ctx } = compose("ekimae", 2, key, 48, 36);
        expect(res.ok, res.summary).toBe(true);
        const map = ctx.project.maps.hub!;
        const tiles = (id: string) => ctx.project.tilesets[JP_CITY_ID]!.structureKits!.find((kit) => kit.id === id)!.rows.flatMap((row) => row.tiles);
        const paving = tiles("jp-st-gnd-pave");
        const asphalt = tiles("jp-st-gnd-tarmac");
        const asphalt2 = tiles("jp-st-gnd-tarmac-2");
        const paved = map.lowerTiles.filter((tile) => paving.includes(tile));
        expect(paved.length).toBeGreaterThan(20);
        expect(new Set(paved)).toEqual(new Set(shadeCells.map((cell) => paving[cell])));
        const onRoad = (sheet: number[]) => map.lowerTiles.filter((tile) => sheet.includes(tile)).length;
        expect(onRoad(asphalt) + onRoad(asphalt2)).toBeGreaterThan(20);
        expect(Math.min(onRoad(asphalt), onRoad(asphalt2))).toBe(0);
      }
    });

    it("gives the strip behind shop rows a use (back lane, bounded lots) and lets quiet lanes have a narrow crosswalk", () => {
      for (let seed = 1; seed <= 3; seed++) {
        const plan = planJpCityScene({ mapId: "m", width: 60, height: 48, seed, style: "shopping", key: "game-a" });
        expect(plan.scenes, `seed ${seed}`).toContain("backalley");
        // 가게 줄 뒤: 새 거리 조각이 구워져 있으면 바닥은 가족 단위 단계(ground_cells)로 깔린다 — 뒷길 포장(lane)과 뒤 필지(흙·잔디)의 사각형이 셋 넘게 있어야 한다(옛 거리는 재료 이름의 fill_region).
        const yards = plan.fable
          ? plan.steps.filter((s) => s.tool === "ground_cells" && ["lane", "earth", "lawn"].includes(String((s.args as { family?: string }).family))).flatMap((s) => (s.args as { rects: unknown[] }).rects)
          : plan.steps.filter((s) => s.tool === "fill_region" && ["산길 흙", "校庭 흙 바닥", "자갈 참배길", "온천가 돌길(이시다타미)"].includes(String((s.args as { material?: string }).material)));
        expect(yards.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      }
      const zebra = Array.from({ length: 32 }, (_, seed) => planJpCityScene({ mapId: "m", width: 48, height: 36, seed, style: "residential", key: "game-b", crosswalkTile: 7 }))
        // 조용한 길의 좁은 횡단보도: 새 거리에서는 줄무늬 조각(jp-st-mark-zebra-*), 옛 거리에서는 줄무늬 칸 칠하기
        .filter((p) => p.steps.some((s) => (s.tool === "paint_tiles" && (s.args as { tile?: number }).tile === 7) || String((s.args as { objectId?: string }).objectId ?? "").includes("jp-st-mark-zebra")));
      expect(zebra.length).toBeGreaterThanOrEqual(4);   // 씨앗 32개 가운데 넷 이상(넷에 하나꼴로 선다)
    });

    it("v2 builder previews the plan the tool will really build (game key) and reports the kind", () => {
      const ctx = { project: createBlankProject(), assistantRun: true, lookKey: "game-a" };
      const seen: { tool: string; args: Record<string, unknown>; data: unknown }[] = [];
      const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => { const r = runTool(ctx, tool, args, { dryRun: false }); seen.push({ tool, args, data: r.data }); return r; } } as unknown as BuildRun;
      const res = JP_CITY_BUILDER.build(run, { type: "street", style: "jp-modern", name: "강변 상점가", features: ["shops", "river", "bridge", "vending"], size: "large" } as unknown as PlaceSpec);
      expect(res.ok, res.summary).toBe(true);
      expect(res.missingArt).toEqual([]);
      // 강을 청하면 강가 장면이 든 가게 거리가 선다. 어느 종류인지는 «요청 소품이 다 드는 첫 씨앗»이 정하므로(건물 사전이 바뀌면 달라진다) 이름을 못박지 않고,
      // 요약이 알린 종류 = 도구가 세운 종류임을 본다.
      const told = /street kind «[^»]+» \(([a-z-]+)\); scenes: .*riverside walk/.exec(res.summary);
      expect(told, res.summary).not.toBeNull();
      // 미리 본 계획 = 도구가 세운 계획: 도구가 받은 씨앗·꼴로 다시 세운 계획에 다리와 자판기가 있고, 도구가 알린 종류가 같다.
      const composed = seen.find((c) => c.tool === "compose_jp_city_street")!;
      expect((composed.data as { streetKind?: string }).streetKind).toBe(told![1]);
      const map = ctx.project.maps[res.mapIds[0]!]!;
      const plan = planJpCityScene({ mapId: map.id, width: map.width, height: map.height, seed: Number(composed.args.seed), style: "shopping", key: "game-a", crosswalkTile: sceneCrosswalkTile(ctx.project.tilesets[JP_CITY_ID]) });
      const ids = plan.steps.map((s) => String((s.args as { objectId?: string }).objectId ?? ""));
      expect(ids.some((id) => id.includes("bridge"))).toBe(true);
      expect(ids.some((id) => id.includes("vending") || id.includes("jp-st-vend-"))).toBe(true);   // 새 거리의 자판기 조각은 jp-st-vend-*
    });
  });
});

// 장르 변주 데크·뽑기·카드 — 짓는 길이 실제 코드의 표에 있는지, 같은 씨앗은 같은 결과인지, 사용자 말이 이기는지, 카드가 600자 안인지.
// 지시문 글(문장)은 못박지 않는다 — 기계가 읽는 값(길 낱말·개수·순서·길이)만 본다.
describe("variationDecks", () => {
  isolateTimers();
  const ALL_WORLDS = WORLDS.map((w) => w.id);
  const keyOf = (i: number) => JSON.stringify(["project", `variation-${i}`]);
  const deck = (id: string) => DECKS.find((d) => d.id === id)!;
  describe("variation decks — every place has a build path that exists in code", () => {
    const places = DECKS.flatMap((d) => d.places.map((p) => [`${d.id}/${p.id}`, p] as const));

    it.each(places)("%s", (_label, place: PlaceCandidate) => {
      const b = place.build;
      switch (b.via) {
        case "world": {
          const world = WORLDS.find((w) => w.id === b.world);
          expect(world, `world ${b.world}`).toBeDefined();
          const kind = world!.kinds.find((k) => k.id === b.kind);
          expect(kind, `kind ${b.world}/${b.kind}`).toBeDefined();
          expect(!!place.indoor).toBe(!!kind!.indoor);
          break;
        }
        case "interior": expect(new RegExp(`\\b${b.room}\\b`, "u").test(INTERIOR_CARD), `interior room ${b.room}`).toBe(true); break;
        case "house": expect(MODERN_KR_CARD.includes(b.word) || FACILITY_CATALOG.some((f) => f.ko === b.word || f.aliases?.includes(b.word)), `house ${b.word}`).toBe(true); break;
        case "street":
          if (b.style === "kr-modern") expect(KR_DISTRICT_KINDS.map((k) => k.id), `district ${b.hint}`).toContain(b.hint);
          else expect(JP_CITY_CARD.includes(b.hint), `jp district ${b.hint}`).toBe(true);
          break;
        case "village": expect(VILLAGE_CARD.includes(b.theme), `village theme ${b.theme}`).toBe(true); break;
        case "dungeon": expect(DUNGEON_TYPES as readonly string[], `dungeon theme ${b.theme}`).toContain(b.theme); break;
      }
    });

    it("deck sizes follow the plan: places ≥12 (recall ≥16), events 10-15, moods 8-12, structures 5-8, unique ids", () => {
      for (const d of DECKS) {
        expect(d.places.length, `${d.id} places`).toBeGreaterThanOrEqual(d.id === "recall" ? 16 : 12);
        expect(d.events.length, `${d.id} events`).toBeGreaterThanOrEqual(10);
        expect(d.events.length, `${d.id} events`).toBeLessThanOrEqual(15);
        expect(d.moods.length, `${d.id} moods`).toBeGreaterThanOrEqual(8);
        expect(d.moods.length, `${d.id} moods`).toBeLessThanOrEqual(12);
        expect(d.structures.length, `${d.id} structures`).toBeGreaterThanOrEqual(5);
        expect(d.structures.length, `${d.id} structures`).toBeLessThanOrEqual(8);
        expect(new Set(d.places.map((p) => p.id)).size).toBe(d.places.length);
      }
      expect(DECKS.map((d) => d.id).sort()).toEqual(["adventure", "horror", "mystery", "recall", "romance", "warm"]);
    });

    it("a world used by a deck has at least 3 distinct kinds, one of them outdoors (a game is one world: the first place must be outdoors)", () => {
      for (const d of DECKS) {
        const byWorld = new Map<string, PlaceCandidate[]>();
        for (const p of d.places) if (p.build.via === "world") byWorld.set(p.build.world, [...(byWorld.get(p.build.world) ?? []), p]);
        for (const [world, list] of byWorld) {
          expect(new Set(list.map((p) => p.kind)).size, `${d.id}/${world} kinds`).toBeGreaterThanOrEqual(3);
          expect(list.some((p) => !p.indoor), `${d.id}/${world} outdoor`).toBe(true);
        }
      }
    });
  });
  describe("pickVariation", () => {
    const recall = "회상 형 게임 만들어 줘";

    it("same seed → same result; another key or regeneration → another result", () => {
      const a = pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS });
      expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS })).toEqual(a);
      const others = Array.from({ length: 20 }, (_, i) => pickVariation({ text: recall, key: keyOf(i + 2), allowedWorlds: ALL_WORLDS })!.places.map((p) => p.id).join("|"));
      expect(new Set(others).size).toBeGreaterThan(10);
      const regen = Array.from({ length: 10 }, (_, i) => pickVariation({ text: recall, key: keyOf(1), regen: i, allowedWorlds: ALL_WORLDS })!.places.map((p) => p.id).join("|"));
      expect(new Set(regen).size).toBeGreaterThan(5);
    });

    it("an empty key draws nothing; a request without a genre deck draws nothing", () => {
      expect(pickVariation({ text: recall, key: "  " })).toBeUndefined();
      expect(pickVariation({ text: "카페 경영 게임 만들어 줘", key: keyOf(1) })).toBeUndefined();
      expect(deckFor("카페 경영 게임 만들어 줘", true)?.id).toBe("adventure");
      expect(deckFor("회상 추리 게임", true)?.id).toBe("recall");
      // 장르 이름이 다른 덱의 낱말(단서)보다 먼저다 — 공포 요청이 추리 카드를 받던 것(2026-11-24 assistant-measure).
      expect(deckFor("밤의 미술관에 갇힌 아이가 단서를 모아 빠져나가는 공포 게임을 만들어 줘.")?.id).toBe("horror");
      expect(deckFor("가족의 비밀을 파헤치는 추리 게임")?.id).toBe("mystery");
    });

    it("the three places have distinct kinds, the first is never an indoor kind of a world, and a world first place pulls the others from the same world", () => {
      for (const d of DECKS) {
        for (let i = 0; i < 60; i++) {
          const v = pickVariation({ text: d.id === "adventure" ? "판타지 모험 게임" : d.match.source.split("|")[0]!, key: keyOf(i), allowedWorlds: ALL_WORLDS, adventureOk: true });
          if (!v) continue;
          expect(v.places.length).toBeGreaterThanOrEqual(1);
          expect(new Set(v.places.map((p) => p.kind)).size).toBe(v.places.length);
          expect(v.places[0]!.indoor).toBeUndefined();
          const worlds = new Set(v.places.map((p) => (p.build.via === "world" ? p.build.world : "")));
          expect(worlds.size).toBe(1);
          if (v.world) expect(worlds.has(v.world)).toBe(true);
        }
      }
    });

    it("no allowed world → no world-bound place; a fixed world or a stated place theme → no place axis", () => {
      for (let i = 0; i < 40; i++) {
        const v = pickVariation({ text: recall, key: keyOf(i) })!;
        expect(v.world).toBeUndefined();
        expect(v.places.every((p) => p.build.via !== "world")).toBe(true);
      }
      expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS, worldFixed: true })!.places).toEqual([]);
      expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS, placeStated: true })!.places).toEqual([]);
      expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS, worldFixed: true })!.skipped).toContain("places");
    });

    it("the user's words win: a named place stays first, a stated season/event/structure is not drawn", () => {
      for (let i = 0; i < 30; i++) {
        const v = pickVariation({ text: "마을이 나오는 회상 게임 만들어 줘", key: keyOf(i), allowedWorlds: ALL_WORLDS })!;
        expect(v.places[0]!.kind).toBe("village");
        expect(v.pinned.length).toBeGreaterThan(0);
      }
      const season = pickVariation({ text: "비 오는 날의 회상 게임", key: keyOf(3), allowedWorlds: ALL_WORLDS })!;
      expect(season.mood).toBeUndefined();
      expect(season.skipped).toContain("mood");
      const event = pickVariation({ text: "유품 속 편지를 따라가는 회상 게임", key: keyOf(3), allowedWorlds: ALL_WORLDS })!;
      expect(event.event).toBeUndefined();
      const structure = pickVariation({ text: "갈림길 회상 게임", key: keyOf(3), allowedWorlds: ALL_WORLDS })!;
      expect(structure.structure).toBeUndefined();
    });

    it("a recall story spreads over many places (plan acceptance, keys 0..99)", () => {
      const firsts = new Map<string, number>();
      const combos = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const v = pickVariation({ text: "회상 스토리", key: keyOf(i), allowedWorlds: ALL_WORLDS })!;
        firsts.set(v.places[0]!.kind, (firsts.get(v.places[0]!.kind) ?? 0) + 1);
        combos.add(v.places.map((p) => p.kind).sort().join("|"));
      }
      expect(firsts.size).toBeGreaterThanOrEqual(8);
      expect(Math.max(...firsts.values())).toBeLessThanOrEqual(25);
      expect(firsts.get("village") ?? 0).toBeLessThanOrEqual(30);
      expect(combos.size).toBeGreaterThanOrEqual(60);
    });

    it("hash32 is stable", () => {
      expect(hash32("a")).toBe(hash32("a"));
      expect(hash32("a")).not.toBe(hash32("b"));
      expect(deck("recall").places.length).toBeGreaterThan(0);
    });
  });
  describe("variationCard", () => {
    it(`stays within ${VARIATION_CARD_MAX} characters for every deck and key, in both languages`, () => {
      let longest = 0;
      for (const d of DECKS) {
        for (let i = 0; i < 100; i++) {
          const v = pickVariation({ text: d.id === "adventure" ? "판타지 모험 게임" : d.match.source.split("|")[0]!, key: keyOf(i), allowedWorlds: ALL_WORLDS, adventureOk: true });
          if (!v) continue;
          for (const lang of ["en", "ko"] as const) {
            const card = variationCard(v, { lang });
            if (!card) continue;
            expect(card.startsWith(VARIATION_MARK)).toBe(true);
            longest = Math.max(longest, card.length);
            expect(card.length, `${d.id} ${i} ${lang}`).toBeLessThanOrEqual(VARIATION_CARD_MAX);
            for (const p of v.places) expect(card).toContain(buildPath(p.build));
          }
        }
      }
      expect(longest).toBeGreaterThan(200);
    });

    it("has no card when the user's words settled every axis", () => {
      const v = pickVariation({ text: "비 오는 날 유품 편지를 따라 갈림길 선택으로 가는 회상 게임", key: keyOf(1), allowedWorlds: ALL_WORLDS, worldFixed: true })!;
      expect([...v.skipped].sort()).toEqual(["event", "mood", "places", "structure"]);
      expect(variationCard(v, { lang: "en" })).toBeUndefined();
    });
  });
});

// 버들항 마을 종류(editor/tools/beodeulVillageKinds.ts · beodeulVillageScenes.ts): 미리 지어 둔 종류 표, 터에 맞는 종류 고르기(게임 열쇠·씨앗),
// 장면은 통째로 놓이거나 안 놓인다, 조수가 종류를 이름으로 부를 수 있고 장면 이름이 자리 낱말이 된다. 열쇠도 이름도 없으면 전과 같다.
describe("beodeulVillageKinds", () => {
  isolateTimers();
  const KEYS = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"].map((name) => JSON.stringify(["project", `variety-${name}`]));
  const TEMPLATE = JSON.stringify(createBlankProject());
  const fresh = () => JSON.parse(TEMPLATE) as Project;
  const facts = (over: Partial<VillageFacts> = {}): VillageFacts => ({ water: "river", tiers: false, deepWoods: false, rank: "village", walls: false, harbour: false, plaza: false, ...over });
  describe("버들항 마을 종류 — 표", () => {
    it("서른 종류가 넘고, 급 셋에 걸치며, 종류마다 장면이 셋 이상이다", () => {
      expect(BEODEUL_VILLAGE_KINDS.length).toBeGreaterThanOrEqual(30);
      expect(new Set(BEODEUL_VILLAGE_KINDS.map((k) => k.id)).size).toBe(BEODEUL_VILLAGE_KINDS.length);
      for (const rank of ["hamlet", "village", "town"] as const) expect(BEODEUL_VILLAGE_KINDS.filter((k) => k.rank === rank).length).toBeGreaterThanOrEqual(5);
      for (const kind of BEODEUL_VILLAGE_KINDS) {
        expect(kind.scenes.length, kind.id).toBeGreaterThanOrEqual(3);
        expect(kind.home.length, kind.id).toBeGreaterThan(0);
        for (const scene of kind.scenes) {
          // 장면은 서너 ~ 여덟 가지의 무더기다: 꼭 있어야 하는 뭍 조각이 셋에서 여덟
          const required = scene.pieces.filter((p) => !p.optional && !p.water).length;
          expect(required, `${kind.id}/${scene.id}`).toBeGreaterThanOrEqual(3);
          expect(required, `${kind.id}/${scene.id}`).toBeLessThanOrEqual(8);
          expect(scene.min, `${kind.id}/${scene.id}`).toBeGreaterThanOrEqual(3);
        }
      }
      // 강자갈 마당은 어느 종류에도 없다
      expect(JSON.stringify(BEODEUL_VILLAGE_KINDS)).not.toMatch(/yard-cobble/);
    });

    it("판석 광장 위에 서는 장면은 장터·읍 종류에만 있다", () => {
      for (const kind of BEODEUL_VILLAGE_KINDS) if (kind.scenes.some((s) => s.at === "plaza")) expect(kind.fit.square, kind.id).toBe(true);
    });
  });
  describe("버들항 마을 종류 — 고르기", () => {
    it("터에 맞는 종류만 고른다 — 바다 마을은 나무꾼 터가 아니고, 성벽 없는 마을은 성읍이 아니다", () => {
      const lumber = villageKindById("lumber-camp")!, cove = villageKindById("fishing-cove")!, garrison = villageKindById("garrison-town")!, harbour = villageKindById("harbour-town")!;
      // 나무꾼 터·어촌은 외딴 마을 급이다 — 급이 같은 터에서만 맞는다
      expect(villageKindFits(lumber, facts({ water: "sea", deepWoods: true, rank: "hamlet" }))).toBe(false);
      expect(villageKindFits(lumber, facts({ water: "none", deepWoods: true, rank: "hamlet" }))).toBe(true);
      expect(villageKindFits(lumber, facts({ water: "none", rank: "hamlet" }))).toBe(false); // 깊은 숲이 아니다
      expect(villageKindFits(cove, facts({ water: "sea", rank: "hamlet" }))).toBe(true);
      expect(villageKindFits(cove, facts({ water: "sea" }))).toBe(false); // 흙길 마을 급의 바닷가에는 서지 않는다
      expect(villageKindFits(cove, facts({ water: "river", rank: "hamlet" }))).toBe(false);
      expect(villageKindFits(garrison, facts({ rank: "town" }))).toBe(false);
      expect(villageKindFits(garrison, facts({ rank: "town", walls: true, water: "none" }))).toBe(true);
      expect(villageKindFits(harbour, facts({ water: "sea" }))).toBe(false);
      expect(villageKindFits(harbour, facts({ water: "sea", harbour: true }))).toBe(true);
      // 급은 바닥의 급과 같아야 한다 — 흙 마당 마을에 읍의 종류가 서지 않는다
      expect(villageKindFits(villageKindById("smithy-village")!, facts({ rank: "hamlet" }))).toBe(false);
      expect(villageKindFits(villageKindById("guild-town")!, facts())).toBe(false);
      expect(villageKindFits(villageKindById("guild-town")!, facts({ rank: "town", plaza: true }))).toBe(true);
      for (const key of KEYS) for (const seed of [1, 7, 42]) {
        const sea = chooseVillageKind(facts({ water: "sea" }), key, seed)!;
        expect(sea.fit.water).toContain("sea");
        expect(sea.fit.woods).toBeUndefined();
      }
    });

    it("같은 요청이 게임마다 갈리고, 한 게임의 마을 셋은 세 종류다 — 열쇠가 없으면 고르지 않는다", () => {
      const f = facts();
      const picks = KEYS.map((key) => chooseVillageKind(f, key, 4242)!.id);
      expect(new Set(picks).size).toBeGreaterThanOrEqual(4);
      expect(KEYS.map((key) => chooseVillageKind(f, key, 4242)!.id)).toEqual(picks); // 같은 열쇠·씨앗은 늘 같다
      const taken = new Set<string>();
      for (const seed of [3, 4, 5]) { const kind = chooseVillageKind(f, KEYS[0], seed, undefined, taken)!; expect(taken.has(kind.id)).toBe(false); taken.add(kind.id); }
      expect(taken.size).toBe(3);
      expect(chooseVillageKind(f, undefined, 7)).toBeUndefined();
      // 이름으로 정하면 열쇠 없이도 그 종류다. 표에 없는 이름은 종류가 아니다.
      expect(chooseVillageKind(f, undefined, 7, "smithy-village")?.id).toBe("smithy-village");
      expect(chooseVillageKind(f, KEYS[0], 7, "no-such-kind")).toBeUndefined();
      // 그 급의 종류가 터에 없으면 급을 풀어 고른다: 광장을 청한 포구(바다의 읍 종류는 항구뿐)도 바다 종류 하나를 받는다
      for (const key of KEYS) expect(chooseVillageKind(facts({ water: "sea", plaza: true, rank: "town" }), key, 9)!.fit.water).toContain("sea");
      // 광장을 청한 마을은 읍이다 — 읍 종류가 골라진다
      for (const key of KEYS) expect(chooseVillageKind(facts({ plaza: true, rank: "town" }), key, 9)!.rank).toBe("town");
    });
  });
  describe("버들항 마을 종류 — 장면은 통째로", () => {
    const scene = (required: number, min: number): PlacedScene => ({ id: "s", ko: "장면", en: "scene", at: "work", x: 0, y: 0, w: 3, h: 2, stand: { x: 1, y: 2 }, required, min, pieces: 4 });
    it("필수 조각이 하나라도 빠지거나 남은 조각이 모자라면 깨진 장면이다", () => {
      const scenes = [scene(3, 3), scene(2, 3)];
      const whole = [sceneSlot(0, true), sceneSlot(0, true), sceneSlot(0, true), sceneSlot(0, false), sceneSlot(1, true), sceneSlot(1, true), sceneSlot(1, false)];
      expect(brokenVillageScenes(scenes, whole)).toEqual([]);
      expect(brokenVillageScenes(scenes, whole.slice(1))).toEqual([0]); // 필수 하나 빠짐
      expect(brokenVillageScenes(scenes, whole.slice(0, 6))).toEqual([1]); // 곁들이가 빠져 셋이 안 된다
      expect(brokenVillageScenes(scenes, ["home", "wild"])).toEqual([0, 1]);
      scenes[0]!.lifted = true;
      expect(brokenVillageScenes(scenes, ["home"])).toEqual([1]); // 이미 걷은 장면은 다시 세지 않는다
    });

    it("들를 곳 사이의 길을 두 칸 넘게 돌리는 자리는 받지 않는다", () => {
      // 7×3 복도: 들머리 (0,1) → 문 앞 (6,1). 가운데 줄을 막으면 돌아가야 한다.
      const guard = beodeulRouteGuard(7, 3, { entrance: { x: 0, y: 1 }, gather: null, stops: [{ x: 6, y: 1 }], walkable: () => true, canStep: () => true });
      expect(guard.ok([1 * 7 + 3])).toBe(true); // 한 칸: 위아래로 두 걸음 돌아간다
      expect(guard.ok([0 * 7 + 3, 1 * 7 + 3, 2 * 7 + 3])).toBe(false); // 세 줄을 다 막으면 끊긴다
      guard.take([0 * 7 + 3, 1 * 7 + 3]); // 위 두 줄을 막았다 — 아랫줄로 돌아간다
      expect(guard.added()).toBe(2);
      expect(guard.ok([0 * 7 + 5])).toBe(true); // 길이 더 늘지 않는 칸은 된다
      expect(guard.ok([1 * 7 + 5, 2 * 7 + 5])).toBe(false); // 한 번 더 돌리면 처음보다 두 칸 넘게 멀어진다 — 조금씩 쌓이는 것도 막는다
      // 걷는 땅 한쪽을 가두는 자리도 받지 않는다: 3×3 의 구석 (2,2) 를 두 칸으로 에워싸면 그 칸이 갇힌다
      const pocket = beodeulRouteGuard(3, 3, { entrance: { x: 0, y: 0 }, gather: null, stops: [{ x: 2, y: 0 }], walkable: () => true, canStep: () => true });
      expect(pocket.ok([2 * 3 + 1])).toBe(true);
      expect(pocket.ok([2 * 3 + 1, 1 * 3 + 2])).toBe(false);
      // 들를 곳이 없으면 아무것도 막지 않는다
      expect(beodeulRouteGuard(7, 3, undefined).ok([10])).toBe(true);
    });
  });
  function build(kind: string | undefined, key: string | undefined, args: Record<string, unknown> = {}) {
    const ctx = { project: fresh(), ...(key ? { assistantRun: true, lookKey: key } : {}) };
    const result = runTool(ctx, "author_beodeul_town", { theme: "river", water: "river", seed: 11, width: 56, height: 48, id: "v_kind", ...(kind ? { kind } : {}), ...args } as never);
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { mapId: string; villageKind?: { id: string }; scenes?: { id: string; ko: string; x: number; y: number; w: number; h: number; stand: { x: number; y: number }; pieces: number }[];
      sceneCount?: { asked: number; placed: number }; doors: { reached: boolean }[]; stampFailed: number; work?: { name: string } | null };
    return { data, summary: result.summary, project: ctx.project, map: ctx.project.maps[data.mapId]! as GameMap };
  }
  describe("버들항 마을 종류 — 짓기", () => {
    it("이름으로 부른 종류로 짓는다 — 장면이 서고, 맵과 결과에 종류와 장면이 적힌다", () => {
      const built = build("smithy-village", undefined);
      expect(built.data.villageKind?.id).toBe("smithy-village");
      expect(villageKindOfMap(built.map)).toBe("smithy-village");
      expect(built.data.scenes!.length).toBeGreaterThanOrEqual(2);
      expect(built.data.scenes!.map((s) => s.ko)).toContain("대장간 마당");
      expect(built.summary).toMatch(/Kind smithy-village \(Smithy village\); scenes: smithy yard \(\d+,\d+\)/);
      expect(villageScenesOfMap(built.map).map((r) => r.label)).toEqual(built.data.scenes!.map((s) => s.ko));
      // 장면마다 조각이 셋 이상 서 있고(그 네모 안에 3층 그림이 있다), 문 앞 도달은 그대로다
      for (const s of built.data.scenes!) {
        expect(s.pieces, s.ko).toBeGreaterThanOrEqual(3);
        let drawn = 0;
        for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) if ((built.map.upperTiles[(s.y + j) * built.map.width + s.x + i] ?? -1) >= 0) drawn += 1;
        expect(drawn, s.ko).toBeGreaterThanOrEqual(3);
      }
      expect(built.data.doors.filter((d) => !d.reached).length).toBe(0);
      expect(built.data.stampFailed).toBe(0);
    }, 240_000);

    it("열쇠도 이름도 없으면 종류 없이 전과 같다 — 열쇠가 있으면 터에 맞는 종류 하나가 골라진다", () => {
      const plain = build(undefined, undefined);
      expect(plain.data.villageKind).toBeUndefined();
      expect(villageKindOfMap(plain.map)).toBeUndefined();
      expect(plain.map.layoutPlan).toBeUndefined();
      expect(plain.summary).not.toMatch(/Kind /);
      const a = build(undefined, KEYS[0]), again = build(undefined, KEYS[0]);
      expect(a.data.villageKind?.id).toBeTruthy();
      expect(again.data.villageKind?.id).toBe(a.data.villageKind?.id);
      expect(again.data.scenes).toEqual(a.data.scenes);
      expect(villageKindFits(villageKindById(a.data.villageKind!.id)!, facts({ tiers: true }))).toBe(true);
      // 표에 없는 이름은 거절하지 않고 알린 뒤 그 게임의 종류로 짓는다
      const odd = build("no-such-kind", KEYS[0]);
      expect(odd.data.villageKind?.id).toBe(a.data.villageKind?.id);
    }, 240_000);

    it("장면 이름은 자리 낱말이다 — «대장간 마당» 에 세운 사람은 그 무더기 곁 걷는 칸에 선다", () => {
      const built = build("smithy-village", undefined);
      const yard = built.data.scenes!.find((s) => s.ko === "대장간 마당")!;
      for (const word of ["대장간 마당", "smithy yard", "대장간 마당 근처"]) {
        const hit = resolveWhere(built.project, built.map, word);
        expect(hit.fallback, word).toBeUndefined();
        expect(hit.how, word).toMatch(/대장간 마당/);
        const gap = Math.max(hit.cell.x < yard.x ? yard.x - hit.cell.x : hit.cell.x - (yard.x + yard.w - 1), hit.cell.y < yard.y ? yard.y - hit.cell.y : hit.cell.y - (yard.y + yard.h - 1));
        expect(gap, word).toBeLessThanOrEqual(3);
        expect(isPassable(built.project, built.map, hit.cell.x, hit.cell.y), word).toBe(true);
      }
      // 장면이 아닌 낱말은 전처럼 푼다
      expect(villageSceneByWord(built.map, "광장")).toBeUndefined();
    }, 240_000);
  });
  describe("버들항 마을 종류 — 기록과 조수 글", () => {
    it("종류 기록은 다시 지을 때 걷히고, 남의 설계 기록은 건드리지 않는다", () => {
      const map = { layoutPlan: { version: 1, kind: "houses", regions: [{ id: "house_1", role: "house", label: "집", x: 1, y: 1, w: 3, h: 3 }] } } as unknown as GameMap;
      recordVillageKind(map, { id: "mill-hamlet", ko: "물방앗간 마을", en: "Mill hamlet", rank: "hamlet" }, 7, [{ id: "mill-yard", ko: "방앗간 마당", en: "mill yard", at: "work", x: 5, y: 5, w: 4, h: 3, stand: { x: 6, y: 8 } }]);
      expect(villageKindOfMap(map)).toBe("mill-hamlet");
      expect(map.layoutPlan!.regions.map((r) => r.role)).toEqual(["house", "scene"]);
      expect(villageSceneByWord(map, "방앗간 마당 옆")?.id).toBe("scene_mill-yard");
      expect(villageSceneByWord(map, "the mill yard")?.id).toBe("scene_mill-yard");
      clearVillageKindPlan(map);
      expect(villageKindOfMap(map)).toBeUndefined();
      expect(map.layoutPlan!.regions.map((r) => r.id)).toEqual(["house_1"]);
      const bare = {} as GameMap; clearVillageKindPlan(bare); expect(bare.layoutPlan).toBeUndefined();
    });

    it("늘 실리는 마을 카드는 종류의 예 넷과 한 문장만 싣고(+200자 안), 전체 목록은 땅 그림 답과 모르는 kind 의 거절 글에 실린다", () => {
      // 2026-11-16 감독: 서른여덟 종류를 카드에 다 실어(+1,170자) 방탈출 지시문이 상한 66,700 을 넘었다. 종류는 코드가 고르는 것이 기본이라 늘 실리는 글은 한 문장이다.
      const sentence = VILLAGE_CARD.slice(VILLAGE_CARD.indexOf("hints.kind"));
      expect(sentence.length + 1).toBeLessThanOrEqual(200);
      expect(VILLAGE_KIND_EXAMPLES).toHaveLength(4);
      for (const id of VILLAGE_KIND_EXAMPLES) { expect(villageKindById(id), id).toBeDefined(); expect(sentence).toContain(id); }
      expect(BEODEUL_VILLAGE_KINDS.filter((kind) => VILLAGE_CARD.includes(kind.id)).map((kind) => kind.id).sort()).toEqual([...VILLAGE_KIND_EXAMPLES].sort());
      expect(sentence).toMatch(/Omitted, the game picks one/);
      expect(sentence).toMatch(/unknown id/);
      // 땅 그림 답의 한 줄: 강가·포구 마을에만, 서른여덟 id 가 다 있고 그 물에 맞는 종류가 앞에 선다
      const coast = villageKindsLine("coast")!, river = villageKindsLine("river", "river")!;
      for (const kind of BEODEUL_VILLAGE_KINDS) { expect(coast).toContain(`${kind.id} (`); expect(river).toContain(`${kind.id} (`); }
      expect(coast.indexOf("fishing-cove")).toBeLessThan(coast.indexOf("For other water"));
      expect(coast.indexOf("mill-hamlet")).toBeGreaterThan(coast.indexOf("For other water"));
      expect(river.indexOf("mill-hamlet")).toBeLessThan(river.indexOf("For other water"));
      expect(river.indexOf("fishing-cove")).toBeGreaterThan(river.indexOf("For other water"));
      expect(villageKindsLine("desert")).toBeUndefined();
      // 모르는 kind 의 거절 글: 서른여덟 id 가 다 있고 가까운 이름이 맨 앞이다(한글 이름 · 영어 낱말 · 오타)
      const first = (word: string) => villageKindsNearestFirst(word)[0]!.id;
      expect(first("대장간")).toBe("smithy-village");
      expect(first("fishing village")).toBe("fishing-cove");
      expect(first("smithy-vilage")).toBe("smithy-village");
      expect(first("등대")).toBe("lighthouse-cape");
      // 아무 데도 안 걸리는 낱말이면 표의 차례 그대로다(짧은 id 가 «가까운 것» 으로 앞서지 않는다)
      expect(villageKindsNearestFirst("zzz").map((kind) => kind.id)).toEqual(BEODEUL_VILLAGE_KINDS.map((kind) => kind.id));
      const spec = (hints: Record<string, unknown>) => ({ type: "village", name: "버들 마을", hints } as PlaceSpec);
      expect(villageArgs(spec({ kind: "smithy-village" })).args.kind).toBe("smithy-village");
      // 모르는 kind 는 거절하지 않는다(오너 2026-11-16 «거절은 게임이 깨질 때만») — 가장 가까운 종류로 고쳐 짓고, 알림 글에 서른여덟 id 를 가까운 이름부터 싣는다.
      // 이 단언이 지키는 것: 모델이 적은 낱말이 가리키는 종류로 짓는다는 것, 그리고 무엇으로 고쳤는지와 전체 목록이 모델에게 돌아간다는 것.
      const fixed = fixUnknownVillageKind(spec({ kind: "대장간" }))!;
      expect((fixed.spec.hints as { kind?: string }).kind).toBe("smithy-village");
      expect(fixed.note).toMatch(/^hints\.kind "대장간" is not a village kind — the nearest one, smithy-village \(/);
      for (const kind of BEODEUL_VILLAGE_KINDS) expect(fixed.note).toContain(`${kind.id} (`);
      expect(fixed.note.indexOf("smithy-village", fixed.note.indexOf("nearest first"))).toBeLessThan(fixed.note.indexOf("fishing-cove", fixed.note.indexOf("nearest first")));
      // 가까운 종류가 없는 낱말: kind 를 빼고(게임이 터에 맞는 종류를 고른다) 알린다
      const none = fixUnknownVillageKind(spec({ kind: "zzz", walls: true }))!;
      expect(none.spec.hints).toEqual({ walls: true });
      expect(none.note).toMatch(/the game picks one that fits the land/);
      expect(fixUnknownVillageKind(spec({ kind: "smithy-village" }))).toBeUndefined();
      const odd = villageArgs(spec({ kind: "대장간" }));
      expect(odd.args.kind).toBe("smithy-village");
      expect(odd.warnings.join(" ")).toMatch(/not a village kind id — the nearest one, smithy-village, is used/);
      expect(odd.warnings.join(" ")).toMatch(/nearest first: smithy-village \(/);
      expect(villageArgs(spec({ kind: "zzz" })).args.kind).toBeUndefined();
      expect(unknownVillageKind(spec({ kind: "대장간" }))).toBe("대장간");
      expect(unknownVillageKind(spec({ kind: "smithy-village" }))).toBeUndefined();
      expect(unknownVillageKind(spec({ kind: "" }))).toBeUndefined();
      expect(unknownVillageKind(spec({}))).toBeUndefined();
      expect(villageArgs(spec({})).args.kind).toBeUndefined();
    });

    it("make_place: 강가·포구 마을의 땅 그림 답이 종류를 모두 싣고, 모르는 kind 는 거절하지 않고 가장 가까운 종류로 고쳐 알린다", async () => {
      // 모델이 마을을 짓기 전에 목록을 한 번은 본다 — 첫 make_place 는 짓지 않고 땅 그림을 돌려주는데, 그 답에 목록이 같이 온다.
      const makePlace = (task: string) => {
        const p = createBlankProject() as Project;
        const env = { ctx: { project: p, currentMapId: p.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project: p, projectKey: "golden-key" },
          emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as never;
        const tool = createV2Tools(env, new V2Session()).find((t) => t.name === "make_place")!;
        const mapsBefore = Object.keys(p.maps).length;
        return async (spec: Record<string, unknown>) => {
          const res = await tool.execute("t", { spec }) as { content: { type: string; text?: string }[] };
          const body = res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
          return { body, json: JSON.parse(body) as { ok?: boolean; notFailure?: boolean; summary?: string; villageKinds?: string; buildings?: string; fixed?: string; mapIds?: string[] }, maps: Object.keys((env as { ctx: { project: Project } }).ctx.project.maps).length - mapsBefore };
        };
      };
      const ids = BEODEUL_VILLAGE_KINDS.map((kind) => kind.id);
      const river = await makePlace("강가 마을 하나 만들어 줘")({ type: "village", name: "버들 마을", theme: "river" });
      expect(river.json.ok).toBe(false);
      expect(river.json.notFailure).toBe(true);
      for (const id of ids) expect(river.json.villageKinds, id).toContain(`${id} (`);
      expect(river.json.villageKinds!.indexOf("mill-hamlet")).toBeLessThan(river.json.villageKinds!.indexOf("fishing-cove"));
      const coast = await makePlace("바닷가 어촌 마을 하나 만들어 줘")({ type: "village", name: "갯마을", theme: "coast" });
      for (const id of ids) expect(coast.json.villageKinds, id).toContain(`${id} (`);
      expect(coast.json.villageKinds!.indexOf("fishing-cove")).toBeLessThan(coast.json.villageKinds!.indexOf("mill-hamlet"));
      // 종류가 없는 테마(사막)의 답에는 목록이 없다
      const desert = await makePlace("사막 오아시스 마을 하나 만들어 줘")({ type: "village", name: "모래 마을", theme: "desert" });
      expect(desert.json.villageKinds).toBeUndefined();
      // 모르는 kind: 거절하지 않는다 — 가장 가까운 종류로 고치고, 첫 답(땅 그림)에 무엇으로 고쳤는지와 가까운 이름이 앞선 전체 목록을 싣는다.
      // 이 단언이 지키는 것: 모르는 낱말 때문에 호출이 한 번 버려지지 않는다는 것(전에는 «Rejected (nothing was built)» 로 한 번 돌려보냈다), 고친 사실이 모델에게 보인다는 것.
      const call = makePlace("강가 마을 하나 만들어 줘");
      const odd = { type: "village", name: "쇠불 마을", theme: "river", hints: { kind: "대장간" } };
      const first = await call(odd);
      expect(first.json.summary).not.toMatch(/^Rejected/);
      expect(first.json.notFailure).toBe(true);
      expect(first.json.fixed).toMatch(/^hints\.kind "대장간" is not a village kind — the nearest one, smithy-village \(/);
      for (const id of ids) expect(first.json.fixed, id).toContain(`${id} (`);
      expect(first.json.villageKinds).toContain("smithy-village (");
      // 건물을 청하는 법도 같은 답에 한 줄로 온다(늘 실리는 카드에는 한 문장뿐이다)
      expect(first.json.buildings).toMatch(/hints\.buildings/);
      expect(river.json.buildings).toBe(first.json.buildings);
      expect(desert.json.buildings).toBe(first.json.buildings); // 건물은 어느 테마의 마을에서나 청할 수 있다
    }, 120_000);

    it("uses a registered village name on the public make_place path before choosing the land", async () => {
      const p = fresh();
      const key = '["project","jrpg-village-1"]';
      const ctx = { project: p, currentMapId: p.startMapId, assistantRun: true, lookKey: key };
      const env = { ctx, request: { task: "JRPG 시작점에 Lighthouse Cape 마을을 지어 줘.", provider: "local-cli:claude", mapIds: [], project: p, projectKey: key },
        emit() {}, record() {}, sideChat: async () => "{}", checkpoint: async () => {} } as never;
      const session = new V2Session();
      const make = createV2Tools(env, session).find((tool) => tool.name === "make_place")!;
      const call = async (id: string) => {
        const response = await make.execute(id, { type: "village", name: "Lighthouse Cape", hints: { kind: "" } });
        return JSON.parse(response.content.find((part) => part.type === "text")!.text) as { ok: boolean; notFailure?: boolean; terrain?: string; mapIds?: string[]; summary: string };
      };
      const preview = await call("preview");
      expect(preview.notFailure, preview.summary).toBe(true);
      expect(preview.terrain).toContain("바다");
      const built = await call("build");
      expect(built.ok, built.summary).toBe(true);
      const mapId = built.mapIds![0]!;
      expect(ctx.project.maps[mapId]!.tilesetId).toBe("beodeul_city");
      expect(villageKindOfMap(ctx.project.maps[mapId])).toBe("lighthouse-cape");
      expect(session.placeOf(mapId)?.spec.hints?.kind).toBe("lighthouse-cape");
    }, 120_000);

    it("leaves a Korean city style outside the Beodeul name rules", () => {
      const project = fresh();
      const ctx = { project, currentMapId: project.startMapId, assistantRun: true };
      const env = { ctx, request: { task: "현대 한국의 Lighthouse Cape 마을을 지어 줘.", provider: "local-cli:claude", mapIds: [], project },
        emit() {}, record() {}, sideChat: async () => "{}", checkpoint: async () => {} } as never;
      const { localizeNewPlace } = makeVerbContext(env, new V2Session());
      expect(localizeNewPlace({ type: "village", name: "Lighthouse Cape", style: "kr-modern" }).hints?.kind).toBeUndefined();
    });

    it("keeps an explicit kind and site, with a varied default for a general coastal name", () => {
      const coastal = { type: "village", name: "별빛 바닷가 마을", theme: "coast" } as const;
      expect(namedVillageSpec(coastal)).toBeUndefined();
      const pinned = { ...coastal, name: "등대 곶", hints: { kind: "shipwrights", water: "none" } } as const;
      expect(namedVillageSpec(pinned)).toBe(pinned);
      const named = namedVillageSpec({ ...coastal, name: "등대 곶" });
      expect(named?.hints?.kind).toBe("lighthouse-cape");
    });
  });
});
