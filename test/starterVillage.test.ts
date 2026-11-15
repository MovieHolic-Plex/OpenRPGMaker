import { describe, expect, it } from "vitest";
import { isPassable } from "@/project/collision";
import { createBlankProject, createStarterMap, TILE } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";

// createStarterMap() 은 2026-09-30 기본 칩셋이 버들항(beodeul_city)으로 바뀐 뒤로 «집 세 채와 흙길이 있는 합본 마을» 이 아니라
// 빈 30×30 맵이다 — 시작 마을은 editor/content/beodeulStarterMap.ts 가 조수와 같은 도구로 짓고(시험: beodeulStarterMap.test.ts),
// 이 함수는 그 마을을 못 지을 때 물러나는 빈 맵과 새 프로젝트의 시작 맵으로만 쓰인다(blankProject · projectStartSeed · firstRunGuide).
// 전에 이 파일은 합본 마을 칸 번호(집 무늬 374… · 흙길 360)로 옛 마을을 찾았고, 공개 기준선(0d4f13e7c)부터 두 경우가 떨어졌다.
// 지금 지키는 것: 이름·크기·기본 칩셋, 바닥은 그 칩셋의 맨 풀 한 가지, 위층과 이벤트는 비어 있고, 가장자리까지 걸을 수 있다(벽 테두리 없음).
describe("starter map", () => {
  it("is the blank 30x30 마을 on the default tileset: plain ground only, nothing on top, no events", () => {
    const m = createStarterMap();
    expect(m.name).toBe("마을");
    expect([m.width, m.height]).toEqual([30, 30]);
    expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(m.lowerTiles.length).toBe(30 * 30);
    expect(m.upperTiles.length).toBe(30 * 30);
    expect(new Set(m.lowerTiles)).toEqual(new Set([blankFillTileFor(DEFAULT_TILESET_ID)]));
    expect(new Set(m.upperTiles)).toEqual(new Set([TILE.EMPTY]));
    expect(m.events).toEqual([]);
  });

  it("keeps the boundary open walkable ground (no wall frame)", () => {
    const project = createBlankProject();
    const m = createStarterMap();
    project.maps[m.id] = m;
    const fill = blankFillTileFor(DEFAULT_TILESET_ID);
    const boundary: { x: number; y: number }[] = [];
    for (let x = 0; x < m.width; x += 1) boundary.push({ x, y: 0 }, { x, y: m.height - 1 });
    for (let y = 0; y < m.height; y += 1) boundary.push({ x: 0, y }, { x: m.width - 1, y });
    for (const { x, y } of boundary) {
      expect(m.lowerTiles[y * m.width + x]).toBe(fill);
      expect(isPassable(project, m, x, y), `(${x},${y})`).toBe(true);
    }
  });
});
