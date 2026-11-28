// 한 게임 안에서 건물 가족은 하나다: 새 건물(jp-bldg-f-*)이 구워져 있으면 옛 손 도트 건물(jp-bldg-*)은 정의에 남되 조수에게 권하는 목록·참고문서에서 빠진다.
// 옛 키트는 id 로 부르면 그대로 찍힌다(옛 저장본 · 열쇠 없는 옛 구성기).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { JP_CITY_BUILDER } from "@/ai/v2/place/builders/jpCity";
import type { BuildRun, PlaceSpec } from "@/ai/v2/shared/types";
import { planJpCityScene } from "@/project/jpCitySceneComposer";
import { sceneKindById, sceneKitForWord, sceneKitNear } from "@/project/jpCitySceneKinds";
import { sceneCrosswalkTile } from "@/project/jpCitySceneRun";
import { isPassable } from "@/project/collision";
import { roadEntranceStart } from "@/ai/v2/place/startSpot";
import { isRoadGround } from "@/ai/v2/place/surface";
import { largestWalkArea } from "@/editor/tools/startOnBuiltMap";

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

/** 새 건물 가족(Fable jp-bldg-f-* · Carbon Medium jp-bldg-c-*) */
const isNewFamilyBuilding = (id: string) => id.startsWith("jp-bldg-f-") || id.startsWith("jp-bldg-c-");

describe("jp_city building family", () => {
  it("keeps the old hand-drawn buildings in the definition but marks the ones the new family replaces", () => {
    const kits = createJpCityTileset().structureKits ?? [];
    const old = kits.filter((k) => k.id.startsWith("jp-bldg-") && !isNewFamilyBuilding(k.id));
    expect(old.length).toBe(77);
    expect(kits.filter((k) => k.id.startsWith("jp-bldg-f-")).length).toBeGreaterThanOrEqual(67);
    expect(kits.filter((k) => k.id.startsWith("jp-bldg-c-")).length).toBeGreaterThanOrEqual(7);
    expect(old.filter((k) => !k.ai?.supersededBy).map((k) => k.id).sort()).toEqual([...HAND_ONLY].sort());
    expect(kits.filter((k) => isNewFamilyBuilding(k.id)).every((k) => !k.ai?.supersededBy)).toBe(true);
  });

  it("offers the assistant only the new family in the kit lists", () => {
    const ctx = setup();
    for (const [tool, args] of [["list_structure_kits", { mapId: "hub" }], ["list_spatial_designs", { kind: "object", query: "jp-bldg" }], ["list_spatial_designs", { kind: "object", query: "라멘" }]] as const) {
      const res = runTool(ctx, tool, args, { dryRun: true });
      const ids = [...new Set(JSON.stringify((res as { data?: unknown }).data ?? null).match(/(?:kit:jp_city\/|"kitId":")(jp-bldg-[a-z0-9-]+)/g) ?? [])].map((s) => s.replace(/^.*(jp-bldg-)/, "$1"));
      for (const id of ids.filter((s) => !isNewFamilyBuilding(s))) expect(HAND_ONLY, `${tool} lists ${id}`).toContain(id);
    }
    const all = JSON.stringify((runTool(ctx, "list_structure_kits", { mapId: "hub" }, { dryRun: true }) as { data?: unknown }).data);
    expect(all).toContain("jp-bldg-f-ramen");
    expect(all).not.toContain('"kitId":"jp-bldg-shop-ramen"');
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
    }, 180_000);

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
    }, 180_000);

    // 2026-11-16 r6 브라우저 플레이 P1: 게임이 선로 위 (3,2) 에서 시작했고 열차 안·역 건물 벽·역 지붕으로 걸어 들어갔다.
    it("never lets the player walk on rails, trains or roofs, and starts on a walked street cell (r6 P1)", () => {
      const ts = createJpCityTileset();
      const blocked = (tile: number) => { const p = ts.passability[tile]; return !p || (!p.up && !p.down && !p.left && !p.right); };
      for (const id of ["jp:rail-track", "jp:prop:train"]) {
        const tiles = (ts.tileGroups ?? []).find((g) => g.id === id)?.tileIds ?? [];
        expect(tiles.length, id).toBeGreaterThan(0);
        expect(tiles.filter((t) => !blocked(t)), id).toEqual([]);
      }
      // 실제 호출 길(새 거리): 새 건물의 지붕 칸은 모두 막힌 칸이고, 시작 칸은 큰 걷는 덩이의 길 칸이다
      const { ctx, map, plan } = build("game-a", { type: "street", name: "역 앞 상점가", style: "jp-modern", size: "small", salt: 7191,
        features: ["상점가", "konbini", "ramen", "서점", "police box", "vending", "bench", "lamp", "post box"], hints: { length: "short", shops: "conbini,ramen,books" } });
      const roofs: string[] = [];
      for (const p of plan.placed) {
        if (!p.kit?.id.startsWith("jp-bldg-f-")) continue;
        const rows = ts.structureKits!.find((k) => k.id === p.kit!.id)!.rows;
        // 그림이 없는 칸(박공 꼭대기 양옆 · ㄱ자 집의 빈 모서리)은 건물이 아니다
        const drawn = (dx: number, dy: number) => (rows[dy]?.upperTiles?.[dx] ?? -1) >= 0 || (rows[dy]?.tiles?.[dx] ?? -1) >= 0;
        for (let y = p.y; y < p.foot - 1; y++) for (let x = p.x; x < p.x + p.w; x++) if (drawn(x - p.x, y - p.y) && isPassable(ctx.project, map, x, y)) roofs.push(`${p.kit.id}@${x},${y}`);
      }
      expect(roofs).toEqual([]);
      const area = new Set(largestWalkArea(ctx.project, map));
      const start = roadEntranceStart(ctx.project, map) ?? ctx.project.startPos;
      expect(area.has(start.y * map.width + start.x)).toBe(true);
      expect(isRoadGround(ctx.project, map, start.x, start.y)).toBe(true);
      expect(plan.placed.some((p) => start.x >= p.x && start.x < p.x + p.w && start.y >= p.y && start.y <= p.foot)).toBe(false);

      // 옛 지역 문법(열쇠 없는 호출)의 역전: 고가 선로 띠와 역 건물 줄 뒤는 걸어서 닿지 않는다
      const old = { project: createBlankProject(), currentMapId: "map_blank_start" };
      expect(runTool(old, "create_map", { name: "역전", width: 40, height: 30, tilesetId: JP_CITY_ID, id: "eki" }, { dryRun: false }).ok).toBe(true);
      for (const seed of [7191, 1, 2]) {
        const r = runTool(old, "compose_jp_region", { mapId: "eki", region: "station_plaza", seed, replace: true }, { dryRun: false });
        expect(r.ok, r.summary).toBe(true);
        const m = old.project.maps.eki!;
        const main = largestWalkArea(old.project, m);
        const foot = Math.round(0.33 * (m.height - 1));
        expect(Math.min(...main.map((i) => Math.floor(i / m.width))), `seed ${seed}`).toBeGreaterThan(foot - 2);
        const at = roadEntranceStart(old.project, m) ?? old.project.startPos;
        expect(at.y, `seed ${seed}`).toBeGreaterThan(foot);
      }
    }, 180_000);

    it("reads a requested shop from the kit's own id, kind, name and label words — no alias table", () => {
      for (const [word, id] of [["ramen", "ramen"], ["라멘집", "ramen"], ["jp-bldg-f-ramen", "ramen"], ["police box", "koban"], ["파출소", "koban"], ["konbini", "konbini"], ["convenience store", "konbini"], ["헌책방", "furuhon"], ["bookstore", "furuhon"], ["pharmacy", "kusuri"]] as const) {
        expect(sceneKitForWord(word)?.id, word).toBe(`jp-bldg-f-${id}`);
      }
      for (const word of ["bench", "lamp", "vending", "상점가", "shrine", "역사 정면", "station", "post box", "shop"]) expect(sceneKitForWord(word), word).toBeUndefined();
    });

    // 오너 2026-11-16 «에셋들을 되게 자유롭게 쓰는 방향»: 벽을 기본값으로 — 실제로 있으면 세우고, 없으면 가장 가까운 것으로 세우고 알리고, 거절은 게임이 깨질 때만.
    it("stands a building asked by kit id whatever its family, and the nearest kit for a name no kit has", () => {
      expect(sceneKitNear("jp-bldg-shop-ramen")).toMatchObject({ how: "exact", kit: { id: "jp-bldg-shop-ramen" } });
      expect(sceneKitNear("kit:jp_city/jp-bldg-f-jinja")).toMatchObject({ how: "exact", kit: { id: "jp-bldg-f-jinja" } });
      for (const [word, id] of [["conbini", "konbini"], ["books", "furuhon"], ["bookshop", "furuhon"], ["ramen bar", "ramen"], ["coffee", "kissa"], ["liquor store", "sake"]] as const) {
        expect(sceneKitNear(word), word).toMatchObject({ how: "nearest", kit: { id: `jp-bldg-f-${id}` } });
      }
      expect(sceneKitNear("zzz")).toBeUndefined();

      const { res, composed, kits } = build("game-a", { type: "street", name: "역 앞 상점가", style: "jp-modern", size: "medium", salt: 7191,
        features: ["상점가", "ramen", "hospital", "jp-bldg-shop-fish", "bookshop", "noodle bar"], hints: { shops: "conbini" } });
      expect(res.ok, res.summary).toBe(true);
      expect(composed.args.shops).toEqual(["jp-bldg-f-ramen", "jp-bldg-f-byoin", "jp-bldg-shop-fish", "jp-bldg-f-furuhon", "jp-bldg-f-konbini"]);
      for (const id of composed.args.shops as string[]) expect(kits, id).toContain(id);
      // 구성기가 스스로 고른 건물은 여전히 새 가족뿐이다 — 옛 건물은 id 로 청한 그 한 채
      expect(kits.filter((k) => !k.startsWith("jp-bldg-f-"))).toEqual(["jp-bldg-shop-fish"]);
      expect(res.warnings.join("\n")).toMatch(/'conbini' .*jp-bldg-f-konbini/);
      expect(res.missingArt.join("\n")).not.toMatch(/종합병원/);
      expect(res.missingArt.join("\n")).toMatch(/noodle bar/);
      expect(res.summary).toMatch(/jp-bldg-f-<이름>/);
    }, 180_000);

    it("builds instead of refusing: a small map is grown, an unknown style falls back, an unknown shop is reported", () => {
      const ctx = { project: createBlankProject(), assistantRun: true, lookKey: "game-a", currentMapId: "map_blank_start" };
      expect(runTool(ctx, "create_map", { name: "작은 거리", width: 30, height: 20, tilesetId: JP_CITY_ID, id: "st" }, { dryRun: false }).ok).toBe(true);
      const r = runTool(ctx, "compose_jp_city_street", { mapId: "st", style: "jp-modern", seed: 2, shops: ["jp-bldg-shop-ramen", "bookshop", "zzz", "cafe"] }, { dryRun: false });
      expect(r.ok, r.summary).toBe(true);
      const map = ctx.project.maps.st!;
      expect([map.width, map.height]).toEqual([40, 28]);
      const notes = ((r as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).join("\n");
      expect(notes).toMatch(/30×20.*40×28/);
      expect(notes).toMatch(/style 'jp-modern'/);
      expect(notes).toMatch(/'bookshop' .*jp-bldg-f-furuhon/);
      expect(notes).toMatch(/'zzz' 에 가까운 건물 키트가 없어/);
      const names = (map.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building")).map((l) => l.name);
      expect(names).toContain("ラーメン屋 건물");
      expect(names).toContain("헌책방 건물");
      expect(((r.data as { freeKits?: string[] }).freeKits ?? []).length).toBeGreaterThan(20);
      expect(r.summary).toMatch(/jp-bldg-f-<이름>/);
    }, 180_000);
  });
});
