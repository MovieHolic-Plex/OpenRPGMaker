// 일본 도시 거리 장면 구성기(조수가 짓는 거리, 게임 열쇠가 있는 호출): 같은 건물 그림이 한 지도에 두 번 서지 않고, 게임마다 다른 거리이고,
// 지은 지도의 모든 건물 문이 큰길에서 걸어서 닿는다. 열쇠 없는 호출은 옛 구성기 그대로다(대표작이 그 배치에 기댄다).
import { describe, expect, it } from "vitest";
import { JP_CITY_BUILDER } from "@/ai/v2/place/builders/jpCity";
import type { BuildRun, PlaceSpec } from "@/ai/v2/shared/types";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { planJpCityScene } from "@/project/jpCitySceneComposer";
import { sceneCrosswalkTile } from "@/project/jpCitySceneRun";
import { pickSceneKind, SCENE_BUILDINGS, SCENE_KINDS, SCENE_SIZES, SCENE_TONES, sceneKindById, sceneList } from "@/project/jpCitySceneKinds";
import { planJpCityStreet } from "@/project/jpCityStreetComposer";
import { inMainWalkComponent, mainWalkComponent } from "@/project/walkComponent";

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
