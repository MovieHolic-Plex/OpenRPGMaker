import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { runGameCheck } from "@/qa/gameCheck";
import { buildReportHtml, renderMapPng, renderToolRegionPngBase64 } from "../scripts/qa-game/render.mts";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";

const COLORS = [[220, 20, 20], [20, 200, 20], [20, 20, 220], [250, 250, 250]] as const;

/** 업로드 타일셋 하나(16px 칸 4개: 빨·초·파·흰)만 쓰는 1줄 맵. 그림은 project.assets 의 dataUrl 에만 있다. */
function uploadedTilesetProject(width: number): { project: Project; map: GameMap } {
  const png = new PNG({ width: 64, height: 16 });
  for (let i = 0; i < 64 * 16; i += 1) {
    const color = COLORS[Math.floor((i % 64) / 16)]!;
    png.data.set([...color, 255], i * 4);
  }
  const project = createBlankProject();
  const pass = { up: true, down: true, left: true, right: true };
  project.tilesets.plain = {
    id: "plain", name: "plain", kind: "custom", image: { type: "uploaded", id: "plain_img" }, tileSize: 16, tilesPerRow: 4, count: 4,
    passability: Array.from({ length: 4 }, () => ({ ...pass })), priority: Array.from({ length: 4 }, () => "lower" as const),
    terrain: [0, 0, 0, 0],
  } as unknown as TilesetDef;
  project.assets.uploaded.plain_img = { id: "plain_img", name: "plain", kind: "tileset", dataUrl: `data:image/png;base64,${PNG.sync.write(png).toString("base64")}` } as Project["assets"]["uploaded"][string];
  const map: GameMap = { ...project.maps[project.startMapId]!, id: "plain_map", width, height: 1, tilesetId: "plain", events: [],
    lowerTiles: Array.from({ length: width }, () => 0), upperTiles: Array.from({ length: width }, () => -1) };
  project.maps[map.id] = map;
  return { project, map };
}

const rgbAt = (png: Buffer, x: number, y: number): number[] => {
  const raster = PNG.sync.read(png);
  const i = (y * raster.width + x) * 4;
  return [raster.data[i]!, raster.data[i + 1]!, raster.data[i + 2]!];
};

describe("qa-game render — 헤드리스 맵 PNG + 자체완결 report.html", () => {
  it("모든 맵을 타일 크기대로 그리고, 시트는 외부 참조 없이 data URI 만 쓴다", () => {
    const project = buildQaFixture("orphanMaps");
    const maps = Object.values(project.maps).map((map) => ({ map, ...renderMapPng(project, map) }));
    for (const { map, png, note } of maps) {
      expect(note).toBeUndefined();
      const decoded = PNG.sync.read(png);
      const size = project.tilesets[map.tilesetId]!.tileSize;
      expect([decoded.width, decoded.height]).toEqual([map.width * size, map.height * size]);
    }
    // 타일이 실제로 칠해졌는지 — 바둑판 바탕색(42/51) 말고 다른 색이 충분히 있어야 한다.
    const start = PNG.sync.read(maps.find(({ map }) => map.id === project.startMapId)!.png);
    let painted = 0;
    for (let i = 0; i < start.data.length; i += 4) if (![42, 51].includes(start.data[i]!)) painted += 1;
    expect(painted / (start.data.length / 4)).toBeGreaterThan(0.5);

    const report = runGameCheck(project, { skipAutoPlay: true });
    const html = buildReportHtml({ project, report, maps });
    expect(html.match(/<img src="data:image\/png;base64,/gu)?.length).toBe(maps.length);
    expect(html).not.toMatch(/(?:src|href)="(?:https?:|\/)/u);
    expect(html).toContain("orphan-empty-map");
    expect(html).toContain("빈 껍데기");
  });

  // 2026-09-25: 전역 store 에 없는 업로드 그림판(Rasak 48px)이 기본 칩셋 조각으로 그려졌다 — 그리는 프로젝트의 자산에서 찾는다.
  it("업로드 타일셋은 그리는 프로젝트의 자산 그림으로, 1 → 2 → 그림자 → 3 → 4 순서로 그린다", () => {
    const { project, map } = uploadedTilesetProject(4);
    map.lowerOverlayTiles = [1, -1, -1, -1];
    map.shadowBits = [0, 0b0001, 0b1111, 0];
    map.upperTiles = [-1, -1, 2, 2];
    map.upperOverlayTiles = [-1, -1, -1, 3];
    const { png, note } = renderMapPng(project, map);
    expect(note).toBeUndefined();
    expect(rgbAt(png, 12, 12)).toEqual([...COLORS[1]]);
    expect(rgbAt(png, 16 + 12, 12)).toEqual([...COLORS[0]]);
    expect(rgbAt(png, 16 + 4, 4)).toEqual(COLORS[0].map((c) => Math.round(c * 0.5)));
    expect(rgbAt(png, 32 + 4, 4)).toEqual([...COLORS[2]]);
    expect(rgbAt(png, 48 + 12, 12)).toEqual([...COLORS[3]]);

    const region = runTool({ project }, "show_map_region", { mapId: map.id, x: 2, y: 0, w: 2, h: 1 });
    const cropped = Buffer.from(renderToolRegionPngBase64(project, region.data), "base64");
    expect([PNG.sync.read(cropped).width, PNG.sync.read(cropped).height]).toEqual([32, 16]);
    expect(rgbAt(cropped, 20, 8)).toEqual([...COLORS[3]]);
  });

  it("업로드 그림을 못 찾으면 기본 칩셋으로 대신 그리지 않고 도구 이미지는 실패한다", () => {
    const { project, map } = uploadedTilesetProject(2);
    delete project.assets.uploaded.plain_img;
    expect(renderMapPng(project, map).note).toContain("plain");
    expect(() => renderToolRegionPngBase64(project, { mapId: map.id, x: 0, y: 0, w: 2, h: 1 })).toThrow("map-rendering-unavailable");
  });
});
