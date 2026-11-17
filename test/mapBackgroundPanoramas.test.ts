// OPRN 자체 파노라마 견본·움직임 프리셋·비칠 칸 판정 (2026-10-21 파노라마 사용성 감사).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { mapBackgroundFromPanoramaSet, OPRN_PANORAMA_ASSETS, OPRN_PANORAMA_SETS } from "@/assets/oprnPanoramas";
import { createBlankProject } from "@/project/defaults";
import {
  applyMapBackgroundMotion,
  detectMapBackgroundMotion,
  mapBackgroundCoverCentre,
  mapBackgroundCoverScale,
  MAP_BACKGROUND_MOTIONS,
  normalizeMapBackground,
} from "@/project/mapBackground";
import { mapBackgroundVisibility, startPosAfterBackgroundClear } from "@/project/mapBackgroundVisibility";
import { collectWebExportAssets } from "@/project/webExportAssets";

describe("OPRN 파노라마 견본", () => {
  it("다섯 세트(하늘·노을·밤하늘·바다·구름)가 있고 그림 파일이 저장소에 있다", () => {
    // + oprn-sky-day-city (rooftop street view, #3375); + cloud sea / far mountains / far forest (sheer terrain backdrops, #4757).
    expect(OPRN_PANORAMA_SETS.map((set) => set.id)).toEqual(["oprn-sky-day", "oprn-sky-day-city", "oprn-sunset", "oprn-night-stars", "oprn-sea", "oprn-clouds", "oprn-cloud-sea", "oprn-far-mountains", "oprn-far-forest"]);
    for (const asset of OPRN_PANORAMA_ASSETS) expect(existsSync(resolve("public", asset.path)), asset.path).toBe(true);
  });

  it("그림 id 가 런타임 URL 로 풀리고 내보내기에 실린다", () => {
    const project = createBlankProject();
    const map = Object.values(project.maps)[0]!;
    map.background = mapBackgroundFromPanoramaSet("oprn-sunset");
    expect(resolveAssetResourceUrl("oprn-pano-sunset", { project })).toBe("/assets/panoramas/oprn-pano-sunset.png");
    const paths = collectWebExportAssets(project).map((asset) => asset.zipPath);
    expect(paths).toContain("assets/panoramas/oprn-pano-sunset.png");
    expect(paths).toContain("assets/panoramas/oprn-pano-sunset-skyline.png");
  });

  it("세트를 펴면 빈 칸에도 보이고 정규화를 그대로 통과한다", () => {
    for (const set of OPRN_PANORAMA_SETS) {
      const background = mapBackgroundFromPanoramaSet(set.id)!;
      expect(background.showInEmptyCells).toBe(true);
      expect(normalizeMapBackground(background)).toEqual(background);
    }
  });

  it("지평선 세트는 320×240 화면에 배율 1 로 깔린다(도트가 뭉개지지 않는다)", () => {
    const sky = OPRN_PANORAMA_SETS.find((set) => set.view === "horizon")!.layers[0]!;
    expect(mapBackgroundCoverScale(sky.fit, { width: 320, height: 240 }, sky)).toBe(1);
  });

  it("sheer-terrain backdrops are 640x240 horizon layers that wrap without a seam", async () => {
    const { PNG } = await import("pngjs");
    const { readFileSync } = await import("node:fs");
    for (const id of ["oprn-cloud-sea", "oprn-far-mountains", "oprn-far-forest"]) {
      const set = OPRN_PANORAMA_SETS.find((entry) => entry.id === id)!;
      expect(set.view).toBe("horizon");
      for (const layer of set.layers) {
        const png = PNG.sync.read(readFileSync(resolve("public", layer.path)));
        expect([png.width, png.height, layer.fit, layer.loopY], layer.id).toEqual([640, 240, "cover", false]);
        // seam: the last column and the first column differ no more than neighbouring columns do on average
        const px = (x: number, y: number) => png.data.readUInt32BE((y * png.width + x) * 4);
        const diff = (a: number, b: number) => { let n = 0; for (let y = 0; y < png.height; y++) if (px(a, y) !== px(b, y)) n++; return n; };
        let mean = 0;
        for (let x = 0; x + 1 < png.width; x++) mean += diff(x, x + 1);
        mean /= png.width - 1;
        expect(diff(png.width - 1, 0), layer.id).toBeLessThanOrEqual(Math.max(4, mean * 3));
      }
    }
  });
});

describe("화면에 맞춤 가운데 맞춤", () => {
  it("16:9 그림을 4:3 화면에 깔면 넘치는 가로를 반씩 자른다(왼쪽 위 고정 아님)", () => {
    expect(mapBackgroundCoverCentre("cover", { width: 320, height: 240 }, { width: 1920, height: 1080 })).toEqual({ x: 53, y: 0 });
    expect(mapBackgroundCoverCentre("cover", { width: 320, height: 240 }, { width: 640, height: 240 })).toEqual({ x: 160, y: 0 });
    expect(mapBackgroundCoverCentre("native", { width: 320, height: 240 }, { width: 1920, height: 1080 })).toEqual({ x: 0, y: 0 });
  });
});

describe("움직임 프리셋", () => {
  const base = mapBackgroundFromPanoramaSet("oprn-sky-day")!;

  it("프리셋을 걸면 같은 프리셋으로 다시 알아본다", () => {
    for (const motion of MAP_BACKGROUND_MOTIONS) {
      expect(detectMapBackgroundMotion(applyMapBackgroundMotion(base, motion))).toBe(motion);
    }
  });

  it("고정은 모든 층의 흐름·깊이를 지우고, 타일과 같이는 깊이 1", () => {
    const fixed = applyMapBackgroundMotion(base, "fixed");
    for (const layer of [fixed, ...(fixed.layers ?? [])]) {
      expect(layer.scrollX ?? 0).toBe(0);
      expect(layer.cameraFollow ?? 0).toBe(0);
    }
    const follow = applyMapBackgroundMotion(base, "followCamera");
    for (const layer of [follow, ...(follow.layers ?? [])]) expect(layer.cameraFollow).toBe(1);
  });

  it("세로 흐름은 세로 반복을 켠다(지평선 그림의 loopY:false 를 지운다)", () => {
    const flowY = applyMapBackgroundMotion(base, "flowY");
    expect(base.loopY).toBe(false);
    expect(flowY.loopY).toBeUndefined();
    expect(flowY.scrollY).toBeGreaterThan(0);
  });
});

describe("비칠 칸 판정", () => {
  it("빈 칸에도 보이기가 꺼져 있으면 0칸, 켜면 빈 칸 수", () => {
    const map = { lowerTiles: [0, -1, -1, 5], upperTiles: [-1, -1, -1, -1], background: { imageId: "oprn-pano-sky-day" } };
    expect(mapBackgroundVisibility(map, { image: { type: "bundled", id: "beodeul_city" } } as never)).toEqual({ visible: 0, empty: 2, total: 4 });
    expect(mapBackgroundVisibility({ ...map, background: { imageId: "x", showInEmptyCells: true } }).visible).toBe(2);
  });

  it("합본 마을이 아닌 칩셋에서는 #233 을 창 타일로 세지 않는다", () => {
    const map = { lowerTiles: [233], upperTiles: [-1], background: { imageId: "x" } };
    expect(mapBackgroundVisibility(map, { image: { type: "bundled", id: "beodeul_city" } } as never).visible).toBe(0);
  });
});

describe("배경 자리 비우기와 시작 위치", () => {
  const map = { id: "m", width: 4, height: 4, lowerTiles: Array.from({ length: 16 }, () => 1), upperTiles: Array.from({ length: 16 }, () => -1), events: [] } as never;
  const topTwoRows = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
  const standOnTiles = (m: { width: number; lowerTiles: number[] }, x: number, y: number): boolean => (m.lowerTiles[y * m.width + x] ?? -1) >= 0;

  it("시작 칸이 비울 자리면 설 수 있는 가장 가까운 칸으로 옮긴다", () => {
    expect(startPosAfterBackgroundClear(map, { x: 1, y: 0 }, topTwoRows, standOnTiles as never)).toEqual({ kind: "moved", x: 1, y: 2, reason: "cleared" });
  });

  it("타일이 남아도 설 수 없는 칸(벽 줄)은 건너뛴다", () => {
    const wallRow = (m: { width: number; lowerTiles: number[] }, x: number, y: number): boolean => y !== 2 && standOnTiles(m, x, y);
    expect(startPosAfterBackgroundClear(map, { x: 1, y: 0 }, topTwoRows, wallRow as never)).toEqual({ kind: "moved", x: 1, y: 3, reason: "cleared" });
  });

  it("시작 칸이 비울 자리 밖이면 그대로, 설 칸이 하나도 안 남으면 stuck", () => {
    expect(startPosAfterBackgroundClear(map, { x: 1, y: 3 }, topTwoRows, standOnTiles as never)).toEqual({ kind: "unaffected" });
    const all = new Set(Array.from({ length: 16 }, (_, index) => index));
    expect(startPosAfterBackgroundClear(map, { x: 1, y: 3 }, all, standOnTiles as never)).toEqual({ kind: "stuck" });
  });
});
