// 공방 2단계: 고른 기물을 손 도트 실내 칩셋에 굽기 · 번들이 자랄 때 번호 이주 · 조수 도구가 공방 물체를 쓴다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ATLAS_BIOME_INTERIOR_COUNT, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { attachWorkshopTiles, bakeWorkshopObject, detachWorkshopTiles, workshopHandObjects, workshopObjectId, type WorkshopObjectInput } from "@/project/workshopTiles";
import { runTool } from "@/editor/tools";
import type { Project } from "@/project/types";

const ID = "atlas_biome_interior";
const PLAN = ["#########", "#.......#", "#.......#", "#.......#", "#.......#", "#.......#", "####.####"];

function shelf(overrides: Partial<WorkshopObjectInput> = {}): WorkshopObjectInput {
  return {
    objectId: workshopObjectId("new:약초 선반"), title: "약초 선반", description: "말린 약초", kind: "floor",
    columns: 2, rows: 2, footRows: 1, risePx: 16, use: ["search"], gridHash: "h1",
    asset: { id: "workshop_test", dataUrl: "data:image/png;base64,AA", width: 480, height: 16 },
    cells: [{ sourceTile: 0, dx: 0, dy: 0 }, { sourceTile: 1, dx: 1, dy: 0 }, { sourceTile: 2, dx: 0, dy: 1 }, { sourceTile: 3, dx: 1, dy: 1 }],
    ...overrides,
  };
}

describe("공방 기물을 칩셋에 굽기", () => {
  it("번들 칸 뒤(행 맞춤)에 덧붙이고, 발밑 줄만 막고, 같은 그림은 다시 늘리지 않는다", () => {
    const p = createBlankProject();
    const kit = bakeWorkshopObject(p, ID, shelf());
    const t = p.tilesets[ID]!;
    const base = Math.ceil(ATLAS_BIOME_INTERIOR_COUNT / t.tilesPerRow) * t.tilesPerRow;
    expect(kit.id).toBe("workshop:약초-선반");
    expect(kit.rows.map((r) => r.upperTiles)).toEqual([[base, base + 1], [base + 2, base + 3]]);
    expect(t.count).toBe(base + 4);
    expect(t.passability[base]!.up).toBe(true);
    expect(t.passability[base + 2]!.up).toBe(false);
    expect(t.priority[base + 2]).toBe("upper");
    expect(p.assets.uploaded.workshop_test?.kind).toBe("tileset");
    expect(p.assets.uploaded.workshop_test?.generatedBy).toBe("workshop"); // 스토어에 올릴 때 「AI 생성」을 끌 수 없다
    expect(t.tileGrafts!.filter((g) => g.sourceChipset === "workshop_test").map((g) => g.targetTile)).toEqual([base, base + 1, base + 2, base + 3]);
    bakeWorkshopObject(p, ID, shelf());
    expect(t.count).toBe(base + 4);
    // 다른 그림(격자 해시)이면 새 칸을 붙이고 킷만 바꾼다 — 옛 칸은 이미 놓인 맵을 위해 남는다
    const again = bakeWorkshopObject(p, ID, shelf({ gridHash: "h2" }));
    expect(t.count).toBe(base + 8);
    expect(again.rows[0]!.upperTiles![0]).toBe(base + 4);
    expect(t.structureKits!.filter((k) => k.id === kit.id)).toHaveLength(1);
  });

  it("평소 불러오기는 아무것도 바꾸지 않고, 번들이 자라면 공방 칸을 새 끝 뒤로 옮기며 맵 칸도 고친다", () => {
    const p = createBlankProject();
    const kit = bakeWorkshopObject(p, ID, shelf());
    const foot = kit.rows[1]!.upperTiles![0]!;
    p.maps.room = { ...Object.values(p.maps)[0]!, id: "room", tilesetId: ID, width: 2, height: 1, lowerTiles: [5, 5], upperTiles: [foot, -1], lowerOverlayTiles: [-1, -1], upperOverlayTiles: [-1, -1] } as Project["maps"][string];
    expect(ensureAtlasBiomeInteriorCurrent(p, ID)).toBe(false);
    expect(p.maps.room!.upperTiles[0]).toBe(foot);

    // 옛 번들(60칸 짧은 정의) 위에 구운 저장본을 흉내 낸다
    const t = p.tilesets[ID]!;
    const parked = detachWorkshopTiles(t)!;
    t.count -= 60; t.passability.length -= 60; t.priority.length -= 60; t.terrain.length -= 60; t.tileMeta!.length -= 60;
    attachWorkshopTiles(p, ID, parked);
    const old = p.maps.room!.upperTiles[0]!;
    expect(old).toBeLessThan(foot);

    expect(ensureAtlasBiomeInteriorCurrent(p, ID)).toBe(true);
    const moved = p.tilesets[ID]!.structureKits!.find((k) => k.id === kit.id)!;
    expect(moved.rows[1]!.upperTiles![0]).toBe(foot);
    expect(p.maps.room!.upperTiles[0]).toBe(foot);
    expect(p.tilesets[ID]!.count).toBe(foot + 2);
  });

  it("손 도트 사양 꼴: 발밑 첫 줄이 dy 0, 솟은 줄은 음수", () => {
    const p = createBlankProject();
    bakeWorkshopObject(p, ID, shelf());
    const o = workshopHandObjects(p.tilesets[ID])["workshop:약초-선반"]!;
    expect([o.kind, o.w, o.h, o.up, o.category]).toEqual(["floor", 2, 1, 16, "workshop"]);
    expect(o.cells.map(([dx, dy]) => [dx, dy])).toEqual([[0, -1], [1, -1], [0, 0], [1, 0]]);
    expect(o.use).toEqual(["search"]);
  });
});

describe("조수 도구가 공방 물체를 쓴다", () => {
  it("list_hand_interior_parts·build_hand_interior_room·list_tileset_objects·stamp_tileset_object", () => {
    const ctx = { project: createBlankProject() };
    bakeWorkshopObject(ctx.project, ID, shelf());
    const parts = runTool(ctx, "list_hand_interior_parts", { query: "약초 선반" });
    expect(JSON.stringify(parts.data)).toContain("workshop:약초-선반");
    const built = runTool(ctx, "build_hand_interior_room", { mapId: "herb", name: "약방", plan: PLAN, floor: "plank", wall: "plaster", objects: [{ id: "workshop:약초-선반", x: 2, y: 4 }] });
    expect(built.ok, built.summary).toBe(true);
    const kit = ctx.project.tilesets[ID]!.structureKits!.find((k) => k.id === "workshop:약초-선반")!;
    expect(ctx.project.maps.herb!.upperTiles.concat(ctx.project.maps.herb!.upperOverlayTiles ?? [])).toContain(kit.rows[1]!.upperTiles![0]);
    const listed = runTool(ctx, "list_tileset_objects", { mapId: "herb", query: "약초" });
    expect((listed.data as { objects: { id: string }[] }).objects.map((o) => o.id)).toEqual(["workshop:약초-선반"]);
    const stamped = runTool(ctx, "stamp_tileset_object", { mapId: "herb", objectId: "workshop:약초-선반", base: { x: 5, y: 4 } });
    expect(stamped.ok, stamped.summary).toBe(true);
  });
});

describe("맵 기물: 실내가 아닌 칩셋에 굽기", () => {
  /** 빈 프로젝트의 첫 맵과 그 칩셋(16px, 손 도트 실내 아님) */
  function outdoor(): { p: Project; tilesetId: string; mapId: string } {
    const p = createBlankProject();
    const [mapId, map] = Object.entries(p.maps).find(([, m]) => m.tilesetId !== ID && p.tilesets[m.tilesetId]?.tileSize === 16)!;
    return { p, tilesetId: map.tilesetId, mapId };
  }

  it("그 맵 칩셋 끝에 붙이고, 번들 정의를 다시 맞춰도(불러오기) 칸·맵이 그대로다", () => {
    const { p, tilesetId, mapId } = outdoor();
    const before = p.tilesets[tilesetId]!.count;
    const kit = bakeWorkshopObject(p, tilesetId, shelf({ objectId: workshopObjectId("new:돌 이정표"), title: "돌 이정표" }));
    const foot = kit.rows[1]!.upperTiles![0]!;
    expect(foot).toBeGreaterThanOrEqual(before);
    p.maps[mapId]!.upperTiles[0] = foot;
    ensureBundledTilesets(p);
    expect(p.tilesets[tilesetId]!.structureKits!.find((k) => k.id === kit.id)!.rows[1]!.upperTiles![0]).toBe(foot);
    expect(p.maps[mapId]!.upperTiles[0]).toBe(foot);
    expect(p.tilesets[tilesetId]!.tileGrafts!.filter((g) => g.sourceChipset === "workshop_test")).toHaveLength(4);
  });

  it("조수가 list_tileset_objects·stamp_tileset_object 로 놓는다", () => {
    const { p, tilesetId, mapId } = outdoor();
    bakeWorkshopObject(p, tilesetId, shelf({ objectId: workshopObjectId("new:돌 이정표"), title: "돌 이정표" }));
    const ctx = { project: p };
    const listed = runTool(ctx, "list_tileset_objects", { mapId, query: "이정표" });
    expect((listed.data as { objects: { id: string }[] }).objects.map((o) => o.id)).toContain("workshop:돌-이정표");
    const stamped = runTool(ctx, "stamp_tileset_object", { mapId, objectId: "workshop:돌-이정표", base: { x: 3, y: 3 } });
    expect(stamped.ok, stamped.summary).toBe(true);
  });
});
