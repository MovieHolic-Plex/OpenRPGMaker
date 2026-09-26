import { describe, expect, it } from "vitest";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { checkTownMap } from "@/editor/tools/packTownTools";
import { runTool } from "@/editor/tools/toolRunner";
import { inspectPiLayoutQuality, piLayoutRepairPrompt } from "@/ai/piAgent/layoutQuality";

// 작은 합성 팩 타일셋: 0 보도 · 1 외벽 · 2 옥상 · 3 차도 · 4 뒷골목 아스팔트. 위층 10·11 문, 20~25 차양(3×2), 30~32 가로등(1×3).
const W = 20, H = 10;
const OPEN = { up: true, down: true, left: true, right: true };
const SOLID = { up: false, down: false, left: false, right: false };

function tileset(): TilesetDef {
  const tileMeta: unknown[] = [];
  const passability: unknown[] = [];
  const set = (id: number, meta: object, pass = OPEN) => { tileMeta[id] = { description: "", ...meta }; passability[id] = pass; };
  set(0, { label: "회색 콘크리트 보도", tags: ["ground"] });
  set(1, { label: "붉은 벽돌 외벽", role: "wall", tags: ["wall"] }, SOLID);
  set(2, { label: "짙은 옥상", role: "roof", tags: ["roof"] }, SOLID);
  set(3, { label: "아스팔트 차도", tags: ["road"] });
  set(4, { label: "짙은 아스팔트", tags: ["road"] });
  for (const id of [10, 11, 20, 21, 22, 23, 24, 25, 30, 31]) passability[id] = OPEN;
  passability[32] = SOLID;
  const kit = (id: string, tag: string, rows: number[][]) => ({
    id, name: id, kind: "section", width: rows[0]!.length, height: rows.length, learnedFrom: "pack-preset",
    ai: { tags: [tag, "rasak-modern-city"] }, rows: rows.map((upperTiles) => ({ tiles: upperTiles.map(() => -1), upperTiles })),
  });
  return {
    id: "rk", name: "Rasak", tileMeta, passability, mvPack: { presetId: "rasak-modern-city" },
    structureKits: [kit("glass_door_bright", "door", [[10], [11]]), kit("awning_red", "overhead", [[20, 21, 22], [23, 24, 25]]),
      kit("street_lamp_left", "tall", [[30], [31], [32]])],
  } as unknown as TilesetDef;
}

/** 건물 x2~7(옥상 y1~2, 외벽 y3~5) · 보도 y6~7 · 차도 y8~9. 문 x3, 차양 x5~7 — 문법에 맞는 가게 한 채. */
function town(): { project: Project; map: GameMap } {
  const lower = new Array(W * H).fill(0);
  const upper = new Array(W * H).fill(-1);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    if (y >= 8) lower[i] = 3;
    else if (x >= 2 && x <= 7 && y >= 1 && y <= 2) lower[i] = 2;
    else if (x >= 2 && x <= 7 && y >= 3 && y <= 5) lower[i] = 1;
  }
  upper[4 * W + 3] = 10; upper[5 * W + 3] = 11;
  [20, 21, 22].forEach((t, dx) => { upper[4 * W + 5 + dx] = t; });
  [23, 24, 25].forEach((t, dx) => { upper[5 * W + 5 + dx] = t; });
  const map = { id: "town", name: "town", width: W, height: H, tilesetId: "rk", tileSize: 48, lowerTiles: lower, upperTiles: upper, events: [] } as unknown as GameMap;
  const project = { tilesets: { rk: tileset() }, maps: { town: map } } as unknown as Project;
  return { project, map };
}

const codes = (project: Project, map: GameMap) => checkTownMap(project, map).violations.map((v) => `${v.code}@${v.x},${v.y}`);

describe("check_town_map 도시 문법", () => {
  it("1층 문·1층 차양·보도 앞 가게는 위반이 없다", () => {
    const { project, map } = town();
    expect(codes(project, map)).toEqual([]);
  });

  it("윗층 문·윗층 차양·옥상과 차도의 가로등을 좌표로 잡는다", () => {
    const { project, map } = town();
    map.upperTiles[4 * W + 3] = -1; map.upperTiles[5 * W + 3] = -1;
    map.upperTiles[3 * W + 3] = 10; map.upperTiles[4 * W + 3] = 11;          // 문이 2층에
    for (let dx = 0; dx < 3; dx += 1) { map.upperTiles[4 * W + 5 + dx] = 23 + dx; map.upperTiles[3 * W + 5 + dx] = 20 + dx; map.upperTiles[5 * W + 5 + dx] = -1; }
    [30, 31, 32].forEach((t, dy) => { map.upperTiles[dy * W + 6] = t; });      // 옥상 (6,2) 에 가로등
    [30, 31, 32].forEach((t, dy) => { map.upperTiles[(7 + dy) * W + 12] = t; }); // 차도 (12,9) 에 가로등
    expect(codes(project, map).sort()).toEqual([
      "awning-off-ground@5,4", "building-no-door@2,5", "door-off-ground@3,4", "prop-on-road@12,9", "prop-on-roof@6,2",
    ]);
  });

  it("가게 앞 넓은 아스팔트는 주차장으로, 뒷골목 빈 아스팔트는 빈 바닥으로 센다", () => {
    const { project, map } = town();
    for (let x = 2; x <= 7; x += 1) for (const y of [6, 7]) map.lowerTiles[y * W + x] = 4;
    expect(codes(project, map)).toEqual(["parking-in-front@2,6"]);
    for (let x = 10; x < 20; x += 1) for (let y = 0; y < 8; y += 1) map.lowerTiles[y * W + x] = 4;
    const alley = checkTownMap(project, map).plainAreas.find((a) => a.material === "짙은 아스팔트" && a.box.x === 10);
    expect(alley?.cells).toEqual(80);
  });

  it("도구는 위반을 경고가 아니라 실패로 돌려주고, 수리 프롬프트에 좌표가 실린다", () => {
    const { project, map } = town();
    map.upperTiles[4 * W + 3] = -1; map.upperTiles[5 * W + 3] = -1;
    const result = runTool({ project }, "check_town_map", { mapId: "town" });
    expect([result.ok, result.issues?.[0]?.code, result.issues?.[0]?.x, result.issues?.[0]?.y]).toEqual([false, "town-grammar", 2, 5]);
    const baseline = { ...project, maps: {} } as unknown as Project;
    const issues = inspectPiLayoutQuality(project, baseline, undefined);
    expect(issues.map((i) => i.mapId)).toEqual(["town"]);
    expect(piLayoutRepairPrompt(issues).includes("[거부] 건물 (2,1 6×5) 1층 맨 아랫줄(y 5)에 문이 없다")).toEqual(true);
  });
});
