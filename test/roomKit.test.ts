// 방 짓기 역할표 만들기(src/project/roomKit.ts) — 사용자가 고른 바닥·벽면·천장 칸으로 변형 칸과 사양을 만들고,
// 그 칩셋으로 ㄱ자 방이 지어지는가. 위키: openwiki/atlas-biome-interior.md 「역할표」.
import { describe, expect, it } from "vitest";
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { buildHandInteriorLayers, roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { compileRoomKit, installRoomKit, roomKitAssetId, roomKitPicksProblem, savedRoomKitPicks, type RoomKitPicks } from "@/project/roomKit";
import type { TilesetDef } from "@/project/types";

const T = 16, COLS = 8, ROWS = 4;
/** 칸마다 다른 단색 시트(칸 번호 = 빨강 값). */
function sheet() {
  const data = new Uint8ClampedArray(COLS * T * ROWS * T * 4);
  for (let y = 0; y < ROWS * T; y++) for (let x = 0; x < COLS * T; x++) {
    const i = (y * COLS * T + x) * 4, id = Math.floor(y / T) * COLS + Math.floor(x / T);
    data[i] = id * 7; data[i + 1] = 120; data[i + 2] = 80; data[i + 3] = 255;
  }
  return { width: COLS * T, height: ROWS * T, data };
}
const picks: RoomKitPicks = { floor: [[0, 1], [8, 9]], wall: [[2, 3, 4], [10, 11, 12]], ceiling: 5 };
const tileset = (): TilesetDef => ({
  id: "my_upload", name: "올린 칩셋", image: { type: "uploaded", id: "up_1" }, tileSize: T, tilesPerRow: COLS, count: COLS * ROWS,
  passability: Array.from({ length: COLS * ROWS }, () => ({ up: true, down: true, left: true, right: true })),
  priority: Array.from({ length: COLS * ROWS }, () => "lower" as const), terrain: Array.from({ length: COLS * ROWS }, () => 0),
} as unknown as TilesetDef);

describe("roomKit 역할표 만들기", () => {
  it("고른 칸 모양을 검사한다", () => {
    expect(roomKitPicksProblem(picks, 32)).toBeNull();
    expect(roomKitPicksProblem({ ...picks, wall: [[2, 3], [10]] }, 32)).toMatch(/같은 길이/);
    expect(roomKitPicksProblem({ ...picks, ceiling: 99 }, 32)).toMatch(/없는 칸/);
  });

  it("변형 칸 = 바닥 칸×그림자 4 + 벽면 칸×서쪽 2 + 천장 32 + 바깥 1", () => {
    const c = compileRoomKit(sheet(), T, picks);
    expect(c.roles.length).toBe(4 * 4 + 6 * 2 + 32 + 1);
    expect(c.sheet.width).toBe(16 * T);
    // 그림자 없는 바닥 칸은 고른 칸 그대로, 벽 밑 그늘 칸은 윗줄이 더 어둡다.
    expect(c.sheet.data[0]).toBe(0);
    const shaded = c.sheet.data.subarray(T * 4, T * 4 + 4); // 둘째 칸(그림자 1) 왼쪽 위 픽셀
    expect(shaded[1]).toBeLessThan(120);
  });

  it("설치하면 칩셋 끝 뒤 새 줄에 이식하고 사양이 그 칸을 가리킨다 — ㄱ자 방이 지어진다", () => {
    const c = compileRoomKit(sheet(), T, picks);
    const project = { tilesets: { my_upload: tileset() }, assets: { uploaded: {} as Record<string, unknown> } };
    const id = roomKitAssetId(T, "data:image/png;base64,AAAA");
    installRoomKit(project, "my_upload", c, { id, dataUrl: "data:image/png;base64,AAAA" }, picks);
    const ts = project.tilesets.my_upload;
    expect(project.assets.uploaded[id]).toBeTruthy();
    expect((project.assets.uploaded[id] as { generatedBy?: string }).generatedBy).toBeUndefined();
    expect(ts.tileGrafts![0]!.targetTile).toBe(32);
    expect(ts.count).toBe(32 + c.roles.length);
    expect(savedRoomKitPicks(ts)).toEqual(picks);
    const spec = roomSpecOf(ts) as HandInteriorSpec;
    const plan = ["##########", "#....#####", "#....#####", "#........#", "#........#", "####..####"];
    const layers = buildHandInteriorLayers({ plan, floor: "floor", wall: "wall" }, ts, spec);
    expect(layers.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(layers.lowerTiles.every((t) => t >= 32 && t < ts.count)).toBe(true);
    expect(layers.unreachedFloor).toEqual([]);
  });

  it("변형 시트 id 로 칸 크기·줄 칸 수를 안다(스토어 사본 id 포함)", () => {
    expect(bundledChipsetTileSize("roomkit_32_abcd1234_x")).toBe(32);
    expect(bundledChipsetTilesPerRow("roomkit_32_abcd1234_x")).toBe(16);
    expect(bundledChipsetTileSize("store_my_pack__roomkit_48_abcd1234_x")).toBe(48);
  });
});
