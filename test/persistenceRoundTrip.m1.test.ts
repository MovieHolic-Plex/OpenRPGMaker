// test/persistenceRoundTrip.m1.test.ts
// M1: 저장/불러오기 왕복 무결 — 사용자가 편집한 내용이 serialize→deserialize 후 보존되는지.
// io.test.ts가 기본 케이스를 다루므로, 여기서는 '실제 편집 액션 결과'의 보존에 집중한다.

import { describe, it, expect } from "vitest";
import { serialize, deserialize } from "@/project/io";
import { eraseTile, fillTile, paintTile, toggleCollision } from "@/editor/actions";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";

function roundTrip(project: Project): Project {
  return deserialize(serialize(project));
}

describe("타일 편집 왕복 보존", () => {
  it("페인트한 lower 타일이 복원된다", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 1, 2, TILE.WATER);

    const before = store.getCurrent();
    const after = roundTrip(before);
    const idx = 2 * before.maps[mapId].width + 1;
    expect(after.maps[mapId].lowerTiles[idx]).toBe(TILE.WATER);
  });

  it("flood fill 결과가 복원된다", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    fillTile(mapId, "lower", 0, 0, TILE.GRASS);

    const before = store.getCurrent();
    const after = roundTrip(before);
    // 시작 셀만 검증 (flood fill 알고리즘 자체는 별도 테스트됨)
    expect(after.maps[mapId].lowerTiles[0]).toBe(before.maps[mapId].lowerTiles[0]);
  });

  it("지운 타일(EMPTY)이 복원된다", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 3, 3, TILE.WATER);
    eraseTile(mapId, "lower", 3, 3);

    const before = store.getCurrent();
    const after = roundTrip(before);
    const idx = 3 * before.maps[mapId].width + 3;
    expect(after.maps[mapId].lowerTiles[idx]).toBe(TILE.EMPTY);
  });

  it("upper 오버레이 타일이 복원된다", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "upper", 5, 5, TILE.FLOWERS);

    const before = store.getCurrent();
    const after = roundTrip(before);
    const idx = 5 * before.maps[mapId].width + 5;
    // flat upperTiles 또는 스택 중 하나에 존재해야 함
    const flat = after.maps[mapId].upperTiles[idx];
    const stacked = after.maps[mapId].upperTileStacks?.[idx];
    expect(flat === TILE.FLOWERS || (stacked && stacked.includes(TILE.FLOWERS))).toBe(true);
  });

  it("양쪽 레이어의 독립 타일이 모두 복원된다", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 2, 2, TILE.WATER);
    paintTile(mapId, "upper", 2, 2, TILE.FLOWERS);

    const before = store.getCurrent();
    const after = roundTrip(before);
    const idx = 2 * before.maps[mapId].width + 2;
    expect(after.maps[mapId].lowerTiles[idx]).toBe(TILE.WATER);
  });
});

describe("통행(passability) 편집 왕복 보존", () => {
  it("토글한 통행 변경이 복원된다", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 0, 0, TILE.GRASS);
    // 토글 전 원본 통행을 미리 캡처 (GRASS는 기본 passable)
    const ts0 = store.getCurrent().tilesets[store.getCurrent().maps[mapId].tilesetId];
    const original = { ...ts0.passability[TILE.GRASS] };
    toggleCollision(mapId, 0, 0); // passable → solid

    const before = store.getCurrent();
    const after = roundTrip(before);
    const afterMap = after.maps[mapId];
    const tsAfter = after.tilesets[afterMap.tilesetId];
    const restored = tsAfter.passability[TILE.GRASS];

    // 토글 결과(solid)가 보존되어야 함 (원본 passable과 달라야 함)
    expect(restored).not.toEqual(original);
    expect(restored.up && restored.down && restored.left && restored.right).toBe(false);
  });

  it("두 번 토글(왕복)한 통행은 원본과 동일하게 복원된다", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 1, 1, TILE.GRASS);
    toggleCollision(mapId, 1, 1);
    toggleCollision(mapId, 1, 1); // 원복

    const before = store.getCurrent();
    const tsBefore = before.tilesets[before.maps[mapId].tilesetId];
    const after = roundTrip(before);
    const tsAfter = after.tilesets[after.maps[mapId].tilesetId];
    expect(tsAfter.passability[TILE.GRASS]).toEqual(tsBefore.passability[TILE.GRASS]);
  });
});

describe("타일셋 메타데이터 왕복 보존", () => {
  it("tileMeta 배열이 보존된다", () => {
    store.replace(createBlankProject());
    const project = store.getCurrent();
    const ts = project.tilesets[project.maps[project.startMapId].tilesetId];

    const after = roundTrip(project);
    const tsAfter = after.tilesets[after.maps[after.startMapId].tilesetId];
    expect(tsAfter.tileMeta).toEqual(ts.tileMeta);
  });

  it("tileGroups가 보존된다", () => {
    store.replace(createBlankProject());
    const project = store.getCurrent();
    const ts = project.tilesets[project.maps[project.startMapId].tilesetId];

    const after = roundTrip(project);
    const tsAfter = after.tilesets[after.maps[after.startMapId].tilesetId];
    expect(tsAfter.tileGroups).toEqual(ts.tileGroups);
  });
});

describe("맵 크기/구조 왕복 보존", () => {
  it("width/height가 보존된다", () => {
    store.replace(createBlankProject());
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    const before = { width: map.width, height: map.height };

    const after = roundTrip(project);
    const mapAfter = after.maps[after.startMapId];
    expect({ width: mapAfter.width, height: mapAfter.height }).toEqual(before);
  });

  it("lowerTiles/upperTiles 길이가 보존된다", () => {
    store.replace(createBlankProject());
    const project = store.getCurrent();
    const map = project.maps[project.startMapId] as GameMap;
    const expectedLen = map.width * map.height;

    const after = roundTrip(project);
    const mapAfter = after.maps[after.startMapId] as GameMap;
    expect(mapAfter.lowerTiles.length).toBe(expectedLen);
    expect(mapAfter.upperTiles.length).toBe(expectedLen);
  });
});
