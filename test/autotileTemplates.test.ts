import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAnimatedWaterStrip,
  buildTemplateGroup,
  previewTemplateTiles,
} from "@/editor/panels/tilesetAutotileTemplates";
import { addAutotileGroupFromTemplate } from "@/editor/tilesetActions";
import { createBlankProject } from "@/project/defaults";
import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import { DEFAULT_AUTOTILE_GROUPS, DEFAULT_COBBLE_AUTOTILE_GROUP, autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { COBBLE_TILE } from "@/project/defaults/chipsetMapping";
import { DEFAULT_TILESET_ID, DEFAULT_TILE_COUNT, DEFAULT_TILES_PER_ROW } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";

// 오토타일 템플릿 위저드 회귀 테스트 — 순수 계산(buildTemplateGroup)과
// 커밋 액션(addAutotileGroupFromTemplate)의 내장 폴백 승계/애니 스트립 추가를 고정한다.

const R = DEFAULT_TILES_PER_ROW; // 30
const COUNT = DEFAULT_TILE_COUNT; // 480
const { N, E, S, W } = AUTOTILE_DIR;

function mustBuild(kind: "rm2k-3x4" | "grid-3x3" | "grid-3x2", anchor: number) {
  const built = buildTemplateGroup(kind, anchor, R, COUNT);
  if ("error" in built) throw new Error(`템플릿 생성 실패: ${built.error}`);
  return built;
}

describe("buildTemplateGroup", () => {
  it("(a) rm2k-3x4 앵커 129 → 내장 포석(COBBLE_TILE) 정본과 완전 일치", () => {
    const built = mustBuild("rm2k-3x4", 129);
    expect(built.neighborhood).toBe(8);
    // 내장 포석 그룹과 memberTileIds·variantMap 완전 일치(순서 포함).
    expect(built.memberTileIds).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.memberTileIds);
    expect(built.connectTileIds).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.connectTileIds);
    expect(built.variantMap).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.variantMap);
    // COBBLE_TILE 상수 기준의 역할 배치도 직접 고정한다(내장 그룹 변경에 대한 이중 잠금).
    expect(built.memberTileIds).toEqual([
      COBBLE_TILE.BODY,
      COBBLE_TILE.EDGE_NORTH,
      COBBLE_TILE.EDGE_SOUTH,
      COBBLE_TILE.EDGE_WEST,
      COBBLE_TILE.EDGE_EAST,
      COBBLE_TILE.CORNER_NORTH_WEST,
      COBBLE_TILE.CORNER_NORTH_EAST,
      COBBLE_TILE.CORNER_SOUTH_WEST,
      COBBLE_TILE.CORNER_SOUTH_EAST,
      COBBLE_TILE.ISOLATED,
      COBBLE_TILE.INNER_CORNER,
    ]);
    expect(Object.keys(built.variantMap)).toHaveLength(256);
    expect(built.variantMap[String(0)]).toBe(COBBLE_TILE.ISOLATED);
    expect(built.variantMap[String(255)]).toBe(COBBLE_TILE.BODY);
    expect(built.variantMap[String(N | E | S | W)]).toBe(COBBLE_TILE.INNER_CORNER);
  });

  it("(b) grid-3x3: 앵커부터 row-major 9타일이 모서리/변/몸통으로 매핑된다", () => {
    const T = 33;
    const built = mustBuild("grid-3x3", T);
    expect(built.neighborhood).toBe(4);
    expect(built.memberTileIds).toEqual([T, T + 1, T + 2, T + R, T + R + 1, T + R + 2, T + 2 * R, T + 2 * R + 1, T + 2 * R + 2]);
    expect(built.connectTileIds).toEqual(built.memberTileIds);
    expect(Object.keys(built.variantMap)).toHaveLength(16);
    expect(built.variantMap[String(N | E | S | W)]).toBe(T + R + 1); // 몸통
    expect(built.variantMap[String(E | S | W)]).toBe(T + 1); // 북 변
    expect(built.variantMap[String(N | E | W)]).toBe(T + 2 * R + 1); // 남 변
    expect(built.variantMap[String(N | E | S)]).toBe(T + R); // 서 변
    expect(built.variantMap[String(N | S | W)]).toBe(T + R + 2); // 동 변
    expect(built.variantMap[String(E | S)]).toBe(T); // 북서 모서리
    expect(built.variantMap[String(S | W)]).toBe(T + 2); // 북동 모서리
    expect(built.variantMap[String(N | E)]).toBe(T + 2 * R); // 남서 모서리
    expect(built.variantMap[String(N | W)]).toBe(T + 2 * R + 2); // 남동 모서리
    expect(built.variantMap[String(0)]).toBe(T); // 이웃 전무 → 북서 모서리(엔진 판정 순서)
  });

  it("(c) grid-3x2: 없는 역할이 최근접(edgeW←cornerNW, edgeE←cornerNE, body←edgeN)으로 접힌다", () => {
    const T = 40;
    const built = mustBuild("grid-3x2", T);
    expect(built.neighborhood).toBe(4);
    expect(built.memberTileIds).toEqual([T, T + 1, T + 2, T + R, T + R + 1, T + R + 2]);
    expect(Object.keys(built.variantMap)).toHaveLength(16);
    expect(built.variantMap[String(N | E | S | W)]).toBe(T + 1); // body ← edgeN
    expect(built.variantMap[String(N | E | S)]).toBe(T); // edgeW ← cornerNW
    expect(built.variantMap[String(N | S | W)]).toBe(T + 2); // edgeE ← cornerNE
    expect(built.variantMap[String(E | S | W)]).toBe(T + 1); // edgeN (원본)
    expect(built.variantMap[String(N | E | W)]).toBe(T + R + 1); // edgeS (하단 행)
    expect(built.variantMap[String(E | S)]).toBe(T); // cornerNW
    expect(built.variantMap[String(N | W)]).toBe(T + R + 2); // cornerSE
  });

  it("(d) 시트 범위/행 넘침/음수 앵커는 한국어 오류를 반환한다", () => {
    // 마지막 타일(450+3R+2=542)이 count(480)를 초과.
    const overflow = buildTemplateGroup("rm2k-3x4", 450, R, COUNT);
    expect("error" in overflow && overflow.error).toMatch(/시트 범위/);
    // 앵커 열 28 → 열+2 가 행(30)을 넘침.
    const rowOverflow = buildTemplateGroup("grid-3x3", 28, R, COUNT);
    expect("error" in rowOverflow && rowOverflow.error).toMatch(/넘칩니다/);
    const negative = buildTemplateGroup("grid-3x2", -1, R, COUNT);
    expect("error" in negative && negative.error).toMatch(/0 이상의 정수/);
    // 미리보기도 같은 검증을 공유한다.
    const preview = previewTemplateTiles("animated-water", 478, R, COUNT);
    expect("error" in preview).toBe(true);
  });
});

describe("addAutotileGroupFromTemplate", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("(e) 첫 커스텀 그룹 추가 시 내장 그룹(흙길/모래/포석/경작지)이 승계되어 살아남는다", () => {
    const outcome = addAutotileGroupFromTemplate(DEFAULT_TILESET_ID, "grid-3x3", 33);
    expect(outcome.ok).toBe(true);
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    const ids = (tileset.autotileGroups ?? []).map((group) => group.id);
    expect(ids).toContain("builtin_dirt_road");
    expect(ids).toContain("builtin_sand");
    expect(ids).toContain("builtin_cobble");
    expect(ids).toContain("builtin_farmland");
    expect(outcome.ok && outcome.groupId !== undefined && ids.includes(outcome.groupId)).toBe(true);
    // 유효 그룹 뷰에서도 내장 흙길이 죽지 않는다(폴백 승계 규약 — rmTypeExpander.ts 선례).
    const effective = autotileGroupsForTileset(tileset);
    expect(effective.some((group) => group.id === "builtin_dirt_road")).toBe(true);
    // 커스텀 1개 + 승계된 내장 전체 (내장 그룹 수가 늘어도 깨지지 않게 파생값으로 대조).
    expect(effective).toHaveLength(1 + DEFAULT_AUTOTILE_GROUPS.length);
  });

  it("(e-2) 검증 실패 시 프로젝트를 변경하지 않는다", () => {
    const outcome = addAutotileGroupFromTemplate(DEFAULT_TILESET_ID, "rm2k-3x4", 450);
    expect(outcome.ok).toBe(false);
    expect(store.getCurrent().tilesets[DEFAULT_TILESET_ID].autotileGroups).toBeUndefined();
  });

  it("(f) animated-water 는 그룹 대신 animationStrips 를 추가하고 직렬화 왕복이 보존된다", () => {
    const outcome = addAutotileGroupFromTemplate(DEFAULT_TILESET_ID, "animated-water", 120);
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.groupId).toBeUndefined();
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    expect(tileset.animationStrips).toEqual([{ baseTile: 120, frames: 3, fps: 3 }]);
    expect(tileset.autotileGroups).toBeUndefined();

    const restored = deserialize(serialize(store.getCurrent()));
    expect(restored.tilesets[DEFAULT_TILESET_ID].animationStrips).toEqual([{ baseTile: 120, frames: 3, fps: 3 }]);

    // 순수 함수 계약: 행 넘침 검증 공유.
    const invalid = buildAnimatedWaterStrip(29, R, COUNT);
    expect("error" in invalid).toBe(true);
  });
});
