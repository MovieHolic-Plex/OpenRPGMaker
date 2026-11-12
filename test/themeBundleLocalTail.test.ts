// 테마 번들(시트 한 장이 끝에 덧붙으며 자라는 칩셋 14개)의 사본에 프로젝트 이식 칸(stamp_tileset_object 가 다른 칩셋 그림을 끝에 붙인 칸)이 있을 때:
// 번들이 그 자리까지 자라면 꼬리를 새 번들 끝 뒤로 밀고(맵 번호도) 번들 구간만 새 굽기로 채운다 — 전에는 «칸이 번들보다 많은 사본» 이라 건너뛰어
// 그 프로젝트가 새 킷을 못 받고, 번들 킷이 그 사본에서는 이식 그림을 가리켰다(2026-11-12 check-bundle-save-compat: snow_north 976 · steampunk_city 851).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project } from "@/project/types";

const THEME_BUNDLES = ["desert_east", "gothic_manor", "jp_city", "modern_campus", "modern_city", "pirate_isles", "prehistoric", "sengoku_edo", "sf_station", "sky_island", "snow_north", "steampunk_city", "wasteland_ruins", "wizarding_world"] as const;
const CUT = 7; // 번들이 «자라기 전» 을 흉내 내려고 사본 끝에서 떼는 칸 수

describe("테마 번들 사본의 프로젝트 이식 꼬리", () => {
  it.each(THEME_BUNDLES)("%s — 번들이 이식 칸 자리까지 자라면 꼬리를 밀고 번들 구간을 채운다", (id) => {
    const made = { project: createBlankProject() as Project, currentMapId: "" };
    expect(runTool(made, "create_map", { id: "old", name: "옛 맵", width: 20, height: 15, tilesetId: id }).ok).toBe(true);
    const project = made.project; // 도구는 프로젝트 객체를 새로 갈아 끼운다
    ensureBundledTilesets(project); // 불러온 프로젝트의 모습(뒤 단계가 일부 칸을 upper 로 올린다 — pirate_isles·sf_station)에서 시작한다
    const ts = project.tilesets[id]!;
    const bundle = structuredClone(ts);
    const first = bundle.count - CUT;
    // 옛 사본: 번들 칸 표는 first 까지, 그 바로 뒤에 다른 칩셋 그림 한 칸(이식). 잘린 칸을 쓰는 번들 킷·묶음·띠는 그때 없었다.
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (ts as unknown as Record<string, unknown[]>)[key] = (ts as unknown as Record<string, unknown[]>)[key]!.slice(0, first);
    ts.structureKits = (ts.structureKits ?? []).filter((kit) => !kit.rows.some((row) => [...(row.tiles ?? []), ...(row.upperTiles ?? [])].some((tile) => tile >= first)));
    ts.tileGroups = (ts.tileGroups ?? []).filter((group) => !group.tileIds.some((tile) => tile >= first));
    ts.animationStrips = (ts.animationStrips ?? []).filter((strip) => strip.baseTile < first);
    ts.passability.push({ up: false, down: false, left: false, right: false }); ts.priority.push("upper"); ts.terrain.push(0);
    ts.tileMeta!.push({ label: "빌린 기물", description: "" });
    ts.tileGrafts = [{ targetTile: first, sourceChipset: "tex_beodeul_city", sourceTile: 10 }];
    ts.count = first + 1;
    const map = project.maps.old!;
    const cell = 5 * map.width + 6;
    map.upperTiles[cell] = first;

    expect(ensureBundledTilesets(project)).toBe(true);
    const now = project.tilesets[id]!;
    const start = now.tileGrafts![0]!.targetTile;
    expect(start).toBeGreaterThanOrEqual(bundle.count);
    expect((start - first) % now.tilesPerRow).toBe(0); // 한 줄 폭 배수만큼
    expect(project.maps.old!.upperTiles[cell]).toBe(start);
    expect(now.tileMeta![start]!.label).toBe("빌린 기물");
    expect(isPassable(project, project.maps.old!, 6, 5)).toBe(false);
    expect(now.passability.slice(0, bundle.count)).toEqual(bundle.passability);
    expect(now.priority.slice(0, bundle.count)).toEqual(bundle.priority);
    expect(now.tileMeta!.slice(0, bundle.count)).toEqual(bundle.tileMeta);
    expect((now.structureKits ?? []).map((kit) => kit.id)).toEqual((bundle.structureKits ?? []).map((kit) => kit.id));
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) expect((now as unknown as Record<string, unknown[]>)[key]).toHaveLength(now.count);
    const settled = JSON.stringify([project.tilesets[id], project.maps.old!.upperTiles]);
    ensureBundledTilesets(project);
    expect(JSON.stringify([project.tilesets[id], project.maps.old!.upperTiles])).toBe(settled);
  });
});
