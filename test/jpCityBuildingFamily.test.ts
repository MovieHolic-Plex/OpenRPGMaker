// 한 게임 안에서 건물 가족은 하나다: 새 건물(jp-bldg-f-*)이 구워져 있으면 옛 손 도트 건물(jp-bldg-*)은 정의에 남되 조수에게 권하는 목록·참고문서에서 빠진다.
// 옛 키트는 id 로 부르면 그대로 찍힌다(옛 저장본 · 열쇠 없는 옛 구성기).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { JP_CITY_BUILDER } from "@/ai/v2/place/builders/jpCity";
import type { BuildRun, PlaceSpec } from "@/ai/v2/shared/types";
import { planJpCityScene } from "@/project/jpCitySceneComposer";
import { sceneKindById, sceneKitForWord } from "@/project/jpCitySceneKinds";
import { sceneCrosswalkTile } from "@/project/jpCitySceneRun";

const OLD = /jp-bldg-(?!f-)[a-z0-9-]+/g;
/** 새 가족에 같은 구실이 없어 남겨 둔 옛 건물 */
const HAND_ONLY = ["school", "school-gym", "kindergarten", "gas-office", "market-hall", "factory", "warehouse", "machikoba-home"].map((s) => `jp-bldg-${s}`);

function setup() {
  const project = createBlankProject();
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const hub = createStarterMap();
  Object.assign(hub, { id: "hub", name: "거리", tilesetId: JP_CITY_ID, width: 40, height: 30 });
  hub.lowerTiles = new Array(40 * 30).fill(blankFillTileFor(JP_CITY_ID));
  hub.upperTiles = new Array(40 * 30).fill(-1);
  project.maps.hub = hub;
  return { project, assistantRun: true, lookKey: "game-a" };
}

describe("jp_city building family", () => {
  it("keeps the old hand-drawn buildings in the definition but marks the ones the new family replaces", () => {
    const kits = createJpCityTileset().structureKits ?? [];
    const old = kits.filter((k) => k.id.startsWith("jp-bldg-") && !k.id.startsWith("jp-bldg-f-"));
    expect(old.length).toBe(77);
    expect(kits.filter((k) => k.id.startsWith("jp-bldg-f-")).length).toBeGreaterThanOrEqual(67);
    expect(old.filter((k) => !k.ai?.supersededBy).map((k) => k.id).sort()).toEqual([...HAND_ONLY].sort());
    expect(kits.filter((k) => k.id.startsWith("jp-bldg-f-")).every((k) => !k.ai?.supersededBy)).toBe(true);
  });

  it("offers the assistant only the new family in the kit lists", () => {
    const ctx = setup();
    for (const [tool, args] of [["list_structure_kits", { mapId: "hub" }], ["list_spatial_designs", { kind: "object", query: "jp-bldg" }], ["list_spatial_designs", { kind: "object", query: "라멘" }]] as const) {
      const res = runTool(ctx, tool, args, { dryRun: true });
      const ids = [...new Set(JSON.stringify((res as { data?: unknown }).data ?? null).match(/(?:kit:jp_city\/|"kitId":")(jp-bldg-[a-z0-9-]+)/g) ?? [])].map((s) => s.replace(/^.*(jp-bldg-)/, "$1"));
      for (const id of ids.filter((s) => !s.startsWith("jp-bldg-f-"))) expect(HAND_ONLY, `${tool} lists ${id}`).toContain(id);
    }
    const all = JSON.stringify((runTool(ctx, "list_structure_kits", { mapId: "hub" }, { dryRun: true }) as { data?: unknown }).data);
    expect(all).toContain("jp-bldg-f-ramen");
    expect(all).not.toContain('"kitId":"jp-bldg-shop-ramen"');
  });

  it("drops the old buildings purpose from the bundled reference documents and points the reading order at the new one", () => {
    const cats = createJpCityTileset().referenceDocuments ?? [];
    expect(cats.some((c) => c.id === "jp-buildings-f")).toBe(true);
    expect(cats.some((c) => c.id === "jp-buildings-hand")).toBe(false);
    const order = cats.find((c) => c.id === "jp-start")!.documents.find((d) => d.id === "jp-order")!.markdown;
    expect(order).toContain("jp-bldg-f-rules");
    expect(order).not.toContain("jp-bldg-hand-rules");
    // 남은 문서가 옛 건물 키트를 사전으로 싣지 않는다(예제 배치에 남은 이름은 학교·전차 예제의 것)
    const dict = cats.flatMap((c) => c.documents).filter((d) => /"kit":"jp-bldg-(?!f-)/.test(d.markdown));
    expect(dict.map((d) => d.id)).toEqual([]);
    expect(JSON.stringify(cats).match(OLD)?.length ?? 0).toBeLessThan(40);
  });

  it("still stamps an old kit when it is named by id (old saves, keyless composer)", () => {
    const ctx = setup();
    const res = runTool(ctx, "stamp_object", { objectId: "kit:jp_city/jp-bldg-shop-ramen", mapId: "hub", x: 5, y: 5 }, { dryRun: false });
    expect(res.ok, res.summary).toBe(true);
    expect(ctx.project.maps.hub!.upperTiles!.some((t) => t >= 0)).toBe(true);
  });

  // 2026-11-16 r6 실모델: make_place{type:"street", style:"jp-modern", name:"역 앞 상점가"} 이 지역 문법(station_plaza — 옛 손 도트 건물)으로 가서 새 건물이 하나도 안 섰다.
  describe("real call path (make_place street, jp-modern)", () => {
    function build(key: string, spec: Record<string, unknown>) {
      const ctx = { project: createBlankProject(), assistantRun: true, lookKey: key, currentMapId: "map_blank_start" };
      const seen: { tool: string; args: Record<string, unknown>; data: unknown }[] = [];
      const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => { const r = runTool(ctx, tool, args, { dryRun: false }); seen.push({ tool, args, data: r.data }); return r; } } as unknown as BuildRun;
      const res = JP_CITY_BUILDER.build(run, spec as unknown as PlaceSpec);
      const composed = seen.find((c) => c.tool.startsWith("compose_jp"))!;
      const map = ctx.project.maps[res.mapIds[0]!]!;
      const named = sceneKindById(String(composed.args.style));
      const plan = planJpCityScene({ mapId: map.id, width: map.width, height: map.height, seed: Number(composed.args.seed), style: (named ? named.styles[0] : composed.args.style) as never, shops: (composed.args.shops as string[] | undefined) ?? [], key,
        crosswalkTile: sceneCrosswalkTile(ctx.project.tilesets[JP_CITY_ID]), ...(named ? { kind: named.id } : {}) });
      return { ctx, res, composed, map, kits: plan.placed.map((p) => p.kit?.id ?? "(assembled)"), plan };
    }

    it("builds the r6 request with new-family buildings only and stands the requested shops itself", () => {
      // 모델이 실제로 보낸 인자 그대로(r6b-jpcity calls.json #6)
      const { ctx, res, composed, map, kits, plan } = build("game-a", { type: "street", name: "역 앞 상점가", style: "jp-modern", size: "small", salt: 7191,
        features: ["상점가", "konbini", "ramen", "서점", "police box", "vending", "bench", "lamp", "post box"], hints: { length: "short", shops: "conbini,ramen,books" } });
      expect(res.ok, res.summary).toBe(true);
      expect(composed.tool).toBe("compose_jp_city_street");
      expect((composed.data as { streetKind?: string }).streetKind).toBe("ekimae");
      expect(composed.args.shops).toEqual(["jp-bldg-f-konbini", "jp-bldg-f-ramen", "jp-bldg-f-furuhon", "jp-bldg-f-koban"]);
      expect(kits.length).toBeGreaterThanOrEqual(10);
      expect(kits.filter((k) => !k.startsWith("jp-bldg-f-"))).toEqual([]);
      for (const id of composed.args.shops as string[]) expect(kits, id).toContain(id);
      expect(res.missingArt.filter((m) => /못 세움|모르는 낱말/.test(m))).toEqual([]);
      // 구성기가 세운 라멘집 문이 실내로 이어진다
      const ramen = plan.placed.find((p) => p.kit?.id === "jp-bldg-f-ramen")!;
      const inner = JP_CITY_BUILDER.build({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args, { dryRun: false }) } as unknown as BuildRun, { type: "house", name: "라멘집", style: "jp-modern", zones: [{ kind: "ramen" }], salt: 3 } as unknown as PlaceSpec);
      expect(inner.ok, inner.summary).toBe(true);
      const link = runTool(ctx, "link_jp_city_interior", { mapId: map.id, door: { x: ramen.x + ramen.doors[0]!, y: ramen.foot }, interiorMapId: inner.mapIds[0] }, { dryRun: false });
      expect(link.ok, link.summary).toBe(true);
    });

    it("builds town districts and the village form with the new family too", () => {
      for (const [key, spec, kind] of [
        ["game-e", { type: "street", name: "역전 거리", style: "jp-modern", size: "large", salt: 5, features: ["station", "bakery", "izakaya", "bank"] }, "ekimae"],
        ["game-f", { type: "village", name: "신사 앞 마을", style: "jp-modern", size: "large", salt: 6, features: ["shrine", "sushi", "greengrocer", "koban"] }, "tera-machi"],
        ["game-b", { type: "street", name: "오피스 거리", style: "jp-modern", size: "medium", salt: 7, features: ["office district", "cafe"] }, "zakkyo"],
      ] as const) {
        const { res, composed, kits } = build(key, spec);
        expect(res.ok, res.summary).toBe(true);
        expect(composed.tool, spec.name).toBe("compose_jp_city_street");
        expect((composed.data as { streetKind?: string }).streetKind, spec.name).toBe(kind);
        expect(kits.filter((k) => !k.startsWith("jp-bldg-f-")), spec.name).toEqual([]);
        for (const id of (composed.args.shops as string[]).filter((s) => s.startsWith("jp-bldg-f-"))) expect(kits, `${spec.name} ${id}`).toContain(id);
      }
      // 도구를 바로 불러도(게임 열쇠가 켜진 조수 실행) 같은 길이다
      const ctx = { project: createBlankProject(), assistantRun: true, lookKey: "game-c", currentMapId: "map_blank_start" };
      expect(runTool(ctx, "create_map", { name: "역전", width: 48, height: 36, tilesetId: JP_CITY_ID, id: "eki" }, { dryRun: false }).ok).toBe(true);
      const direct = runTool(ctx, "compose_jp_region", { mapId: "eki", region: "station_plaza", seed: 3 }, { dryRun: false });
      expect(direct.ok, direct.summary).toBe(true);
      expect((direct.data as { streetKind?: string }).streetKind).toBe("ekimae");
    });

    it("reads a requested shop from the kit's own id, kind, name and label words — no alias table", () => {
      for (const [word, id] of [["ramen", "ramen"], ["라멘집", "ramen"], ["jp-bldg-f-ramen", "ramen"], ["police box", "koban"], ["파출소", "koban"], ["konbini", "konbini"], ["convenience store", "konbini"], ["헌책방", "furuhon"], ["bookstore", "furuhon"], ["pharmacy", "kusuri"]] as const) {
        expect(sceneKitForWord(word)?.id, word).toBe(`jp-bldg-f-${id}`);
      }
      for (const word of ["bench", "lamp", "vending", "상점가", "shrine", "역사 정면", "station", "post box", "shop"]) expect(sceneKitForWord(word), word).toBeUndefined();
    });
  });
});
