// 영역 지시 레시피(build_region_place) — 「여기 상점 만들어 줘」 한 번이 외관·실내·왕복 문·주인·상점까지 짓고,
// 바깥 맵은 영역 안만 바뀌며, 실패하면 아무것도 남지 않는다.
import { describe, expect, it } from "vitest";
import { createCapabilityFixtureProject } from "../src/harnesses/assistant-capability/node/capabilityFixture";
import { runTool } from "@/editor/tools/toolRunner";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { REGION_PLACE_KINDS, regionPlaceKindFromText } from "@/editor/tools/regionPlaceTools";
import type { Command, GameMap, Project } from "@/project/types";

const REGION = { x: 14, y: 8, width: 13, height: 12 };

function setup(): { ctx: { project: Project; currentMapId: string; assistantRun: boolean }; mapId: string } {
  const ctx = { project: createCapabilityFixtureProject(), currentMapId: "", assistantRun: true };
  const made = runTool(ctx, "create_map", { name: "시험 마을", width: 40, height: 30, tilesetId: "beodeul_city" });
  const mapId = (made.data as { mapId: string }).mapId;
  ctx.currentMapId = mapId;
  return { ctx, mapId };
}

function commandsOf(map: GameMap): Command[] {
  return map.events.flatMap((event) => (event.pages ?? []).flatMap((page) => page.commands ?? []));
}

function transfersTo(map: GameMap, target: string): number {
  return commandsOf(map).filter((command) => command.kind === "transfer" && command.mapId === target).length;
}

function outsideChanges(before: GameMap, after: GameMap): number {
  let changed = 0;
  for (let y = 0; y < after.height; y += 1) {
    for (let x = 0; x < after.width; x += 1) {
      const inRegion = x >= REGION.x && y >= REGION.y && x < REGION.x + REGION.width && y < REGION.y + REGION.height;
      const i = y * after.width + x;
      if (!inRegion && (before.lowerTiles[i] !== after.lowerTiles[i] || before.upperTiles[i] !== after.upperTiles[i])) changed += 1;
    }
  }
  return changed;
}

describe("build_region_place", () => {
  it("상점: 외관·새 실내 맵·양방향 문·이 게임 품목의 상점 주인을 한 번에 짓고 영역 밖은 그대로다", () => {
    const { ctx, mapId } = setup();
    const base = structuredClone(ctx.project);
    const before = structuredClone(ctx.project.maps[mapId]!);
    const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind: "shop" });
    expect(out.ok, out.summary).toBe(true);
    const data = out.data as { interiorMapId: string; createdMapIds: string[]; parts: Record<string, boolean> };
    expect(data.parts).toEqual({ exterior: true, interior: true, link: true, keeper: true, service: true });
    const outside = ctx.project.maps[mapId]!;
    const inside = ctx.project.maps[data.interiorMapId]!;
    expect(inside).toBeDefined();
    expect(data.createdMapIds).toEqual([data.interiorMapId]);
    expect(outsideChanges(before, outside)).toBe(0);
    expect(transfersTo(outside, data.interiorMapId)).toBeGreaterThan(0);
    expect(transfersTo(inside, mapId)).toBeGreaterThan(0);
    // 영역 턴의 맵 묶음 병합이 새 실내 맵을 「범위 밖」으로 버리지 않는다 — 바깥 맵 아래 트리에 매단다.
    const merged = mergeMapBundles(base, [{ mapIds: [mapId], project: ctx.project }]);
    expect(merged.project.maps[data.interiorMapId]).toBeDefined();
    expect(merged.spills).toEqual([]);
    const shop = commandsOf(inside).find((command) => command.kind === "shop");
    expect(shop && shop.kind === "shop" ? shop.itemIds.length : 0).toBeGreaterThan(0);
    const known = new Set(ctx.project.database.items.map((item) => item.id));
    if (shop?.kind === "shop") for (const id of shop.itemIds) expect(known.has(id), id).toBe(true);
  });

  it("조수 턴 적용과 같은 프로젝트 스냅샷 한 칸이라 되돌리기 한 번에 실내 맵까지 사라진다", () => {
    const { ctx, mapId } = setup();
    store.replace(structuredClone(ctx.project));
    resetMapEditHistory();
    const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind: "inn" });
    expect(out.ok, out.summary).toBe(true);
    const interiorMapId = (out.data as { interiorMapId: string }).interiorMapId;
    recordProjectSnapshot("영역 지시", mapId);
    store.replace(ctx.project);
    expect(store.getCurrent().maps[interiorMapId]).toBeDefined();
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[interiorMapId]).toBeUndefined();
    expect(transfersTo(store.getCurrent().maps[mapId]!, interiorMapId)).toBe(0);
  });

  it("여관은 숙박 명령, 던전 입구는 새 던전 맵과 영역 안 입구를 만든다", () => {
    const inn = setup();
    const innOut = runTool(inn.ctx, "build_region_place", { mapId: inn.mapId, region: REGION, kind: "inn" });
    expect(innOut.ok, innOut.summary).toBe(true);
    const innMap = inn.ctx.project.maps[(innOut.data as { interiorMapId: string }).interiorMapId]!;
    expect(commandsOf(innMap).some((command) => command.kind === "inn")).toBe(true);

    const dungeon = setup();
    const base = structuredClone(dungeon.ctx.project);
    const before = structuredClone(dungeon.ctx.project.maps[dungeon.mapId]!);
    const out = runTool(dungeon.ctx, "build_region_place", { mapId: dungeon.mapId, region: REGION, kind: "dungeon_entrance" });
    expect(out.ok, out.summary).toBe(true);
    const created = (out.data as { createdMapIds: string[] }).createdMapIds;
    expect(created).toHaveLength(1);
    expect(transfersTo(dungeon.ctx.project.maps[dungeon.mapId]!, created[0]!)).toBeGreaterThan(0);
    expect(outsideChanges(before, dungeon.ctx.project.maps[dungeon.mapId]!)).toBe(0);
    // 던전 맵과 세계 그래프 간선까지 영역 턴의 맵 묶음 병합을 그대로 넘는다.
    expect(mergeMapBundles(base, [{ mapIds: [dungeon.mapId], project: dungeon.ctx.project }]).spills).toEqual([]);
  });

  it.each([
    ["warehouse", "bd-house-ware0"], ["stable", "bd-house-cstable"], ["school", "bd-house-h122_0"],
    ["guard_post", "bd-pick-mountain-pass-guard-post"], ["windmill", "bd-house-mill1"], ["lighthouse", "bd-pick-fishing-port-lighthouse"],
  ])("%s 는 그 모양의 버들항 키트(%s) 외관으로 서고 실내·왕복 문·주인까지 짓는다", (kind, kitId) => {
    {
      const { ctx, mapId } = setup();
      const base = structuredClone(ctx.project);
      const before = structuredClone(ctx.project.maps[mapId]!);
      const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind });
      expect(out.ok, `${kind}: ${out.summary}`).toBe(true);
      const data = out.data as { interiorMapId: string; exterior: { source: string }; parts: Record<string, boolean> };
      expect(data.exterior.source, kind).toBe(kitId);
      expect(data.parts, kind).toEqual({ exterior: true, interior: true, link: true, keeper: true, service: true });
      expect(outsideChanges(before, ctx.project.maps[mapId]!), kind).toBe(0);
      expect(transfersTo(ctx.project.maps[mapId]!, data.interiorMapId), kind).toBeGreaterThan(0);
      expect(transfersTo(ctx.project.maps[data.interiorMapId]!, mapId), kind).toBeGreaterThan(0);
      expect(mergeMapBundles(base, [{ mapIds: [mapId], project: ctx.project }]).spills, kind).toEqual([]);
    }
  });

  it("등대·풍차는 키트가 들어가지 않으면 살림집으로 대신하지 않고 거부한다", () => {
    const { ctx, mapId } = setup();
    const out = runTool(ctx, "build_region_place", { mapId, region: { x: 14, y: 8, width: 9, height: 6 }, kind: "lighthouse" });
    expect(out.ok).toBe(false);
    expect(out.summary).toMatch(/등대/);
  });

  it("건물이 들어가지 않는 좁은 영역은 거부하고 프로젝트를 건드리지 않는다", () => {
    const { ctx, mapId } = setup();
    const mapsBefore = Object.keys(ctx.project.maps).sort();
    const tilesBefore = [...ctx.project.maps[mapId]!.lowerTiles];
    const out = runTool(ctx, "build_region_place", { mapId, region: { x: 2, y: 2, width: 3, height: 3 }, kind: "shop" });
    expect(out.ok).toBe(false);
    expect(Object.keys(ctx.project.maps).sort()).toEqual(mapsBefore);
    expect(ctx.project.maps[mapId]!.lowerTiles).toEqual(tilesBefore);
  });

  it("사람 말을 레시피 종류로 읽는다", () => {
    expect(regionPlaceKindFromText("여기 상점 만들어 줘")).toBe("shop");
    expect(regionPlaceKindFromText("대장간 지어줘")).toBe("smithy");
    expect(regionPlaceKindFromText("여관 하나")).toBe("inn");
    expect(regionPlaceKindFromText("동굴 입구 만들어")).toBe("cave_entrance");
    expect(regionPlaceKindFromText("나무 심어 줘")).toBeNull();
    expect(regionPlaceKindFromText("창고 지어 줘")).toBe("warehouse");
    expect(regionPlaceKindFromText("마구간 하나")).toBe("stable");
    expect(regionPlaceKindFromText("학교 세워 줘")).toBe("school");
    expect(regionPlaceKindFromText("경비 초소 세워 줘")).toBe("guard_post");
    expect(regionPlaceKindFromText("풍차 세워 줘")).toBe("windmill");
    expect(regionPlaceKindFromText("등대 세워 줘")).toBe("lighthouse");
    expect(new Set(REGION_PLACE_KINDS).size).toBe(REGION_PLACE_KINDS.length);
  });
});
