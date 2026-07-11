// 투명 배경 칩 상위 전용 계약(2026-07-05): 벤치(357)·사선 지붕(385)처럼 투명 픽셀을
// 가진 칩이 하위 레이어에 깔리면 투명 부분 아래가 검게 보인다 — 분류(신규 프로젝트),
// 치유(저장된 프로젝트 로드), 페인트 라우팅(AI paint_tiles/시연 캔버스)을 고정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { openDemoTeachModal } from "@/editor/panels/demoTeachCanvas";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { isTransparentChipsetTile, isUpperChipsetTile } from "@/project/defaults/chipsetMapping";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { COMBINED_TOWN_TRANSPARENT_TILES } from "@/project/defaults/generatedChipsetTransparency";
import { applyCombinedTownHarness, isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const BENCH = 357;
const SLOPED_ROOF = 385;
const CONIFER_CANOPY = 260; // 투명 수관 — 상위
const CONIFER_TRUNK = 290; // 투명 밑동 — 숲 스택을 위해 하위 유지
const STRAIGHT_ROOF = 404; // 불투명 직선 지붕면 — 하위 유지.
const WATER = TILE.WATER; // 120 — 불투명 오토타일, 하위 유지.

describe("투명 칩 데이터/분류", () => {
  it("생성된 투명 타일 목록이 스프라이트형 칩을 포함하고 지면 칩은 제외한다", () => {
    const set = new Set(COMBINED_TOWN_TRANSPARENT_TILES);
    for (const tile of [BENCH, SLOPED_ROOF, CONIFER_CANOPY, CONIFER_TRUNK]) expect(set.has(tile), `타일 ${tile}`).toBe(true);
    for (const tile of [TILE.GRASS, WATER, STRAIGHT_ROOF]) expect(set.has(tile), `타일 ${tile}`).toBe(false);
    expect(isTransparentChipsetTile(SLOPED_ROOF)).toBe(true);
    expect(isUpperChipsetTile(SLOPED_ROOF)).toBe(true);
  });

  it("새 타일셋에서 투명 칩은 priority=upper, 홈 레이어=upper, 하위 팔레트에서 숨김", () => {
    const tileset = defaultTileset();
    for (const tile of [BENCH, SLOPED_ROOF, CONIFER_CANOPY]) {
      expect(tileset.priority[tile], `priority[${tile}]`).toBe("upper");
      expect(tileLayerHome(tileset, tile), `home[${tile}]`).toBe("upper");
      expect(tileVisibleOnLayer(tileset, tile, "lower"), `팔레트 하위[${tile}]`).toBe(false);
      expect(tileVisibleOnLayer(tileset, tile, "upper"), `팔레트 상위[${tile}]`).toBe(true);
    }
    // 나무 밑동은 투명해도 하위(수관과 같은 칸 스택)
    expect(tileLayerHome(tileset, CONIFER_TRUNK)).toBe("lower");
    expect(tileVisibleOnLayer(tileset, CONIFER_TRUNK, "lower")).toBe(true);
    // 불투명 직선 지붕면은 여전히 하위가 홈이다.
    expect(tileLayerHome(tileset, STRAIGHT_ROOF)).toBe("lower");
  });

  it("텐트(448)는 상위 오버레이 — 상위 팔레트에 보이고 칠하면 잔디(lower)를 지우지 않는다", () => {
    const TENT = 448;
    const tileset = defaultTileset();
    expect(isUpperChipsetTile(TENT)).toBe(true);
    expect(tileLayerHome(tileset, TENT)).toBe("upper");
    expect(tileVisibleOnLayer(tileset, TENT, "upper")).toBe(true);
    expect(tileVisibleOnLayer(tileset, TENT, "lower")).toBe(false);
  });

  it("저장된 프로젝트 치유: 예전 분류로 lower로 남은 priority를 로드 시 upper로 승격한다", () => {
    const tileset = defaultTileset();
    tileset.priority[BENCH] = "lower";
    tileset.priority[SLOPED_ROOF] = "lower";
    expect(applyCombinedTownHarness(tileset)).toBe(true);
    expect(tileset.priority[BENCH]).toBe("upper");
    expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
  });

  it("사용자가 명시적으로 하위로 확정한 칩은 승격하지 않는다", () => {
    const tileset = defaultTileset();
    tileset.tileMeta![SLOPED_ROOF] = {
      label: "특수 지붕",
      description: "사용자 확정",
      source: "user",
      userLocked: true,
      defaultLayer: "lower",
    };
    tileset.priority[SLOPED_ROOF] = "lower";
    applyCombinedTownHarness(tileset);
    expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
    expect(isUpperOnlyOverlayTile(tileset, SLOPED_ROOF)).toBe(false);
  });
});

describe("paint_tiles 레이어 라우팅", () => {
  function ctxWithMap(): { context: ToolContext; mapId: string } {
    const context: ToolContext = { project: createBlankProject() };
    const created = runTool(context, "create_map", { name: "라우팅 테스트", width: 10, height: 10, id: "map_route" });
    expect(created.ok, created.summary).toBe(true);
    return { context, mapId: "map_route" };
  }

  it("투명 칩을 lower로 요청해도 upper에 배치하고 라우팅을 알린다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "paint_tiles", {
      mapId,
      layer: "lower",
      mode: "cells",
      tile: SLOPED_ROOF,
      cells: [{ x: 3, y: 3 }],
    });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    expect(map.upperTiles[3 * 10 + 3]).toBe(SLOPED_ROOF);
    expect(map.lowerTiles[3 * 10 + 3]).not.toBe(SLOPED_ROOF); // 지면은 보존.
    expect(result.summary).toContain("자동 라우팅");
  });

  it("지우기(-1)와 불투명 지면 칩은 요청한 레이어를 그대로 따른다", () => {
    const { context, mapId } = ctxWithMap();
    expect(runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: WATER, cells: [{ x: 2, y: 2 }] }).ok).toBe(true);
    const map = context.project.maps[mapId];
    expect(map.lowerTiles[2 * 10 + 2]).toBe(WATER);
    expect(runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: -1, cells: [{ x: 2, y: 2 }] }).ok).toBe(true);
    expect(context.project.maps[mapId].lowerTiles[2 * 10 + 2]).toBe(TILE.EMPTY);
  });

  it("fill 모드에 상위 전용 칩을 주면 명확한 오류를 낸다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "fill", tile: SLOPED_ROOF, from: { x: 1, y: 1 } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("상위");
  });
});

describe("시연 캔버스 라우팅", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    const project = createBlankProject();
    // 시드 영역에 벤치를 심어 팔레트에 demo-teach-pick-357이 뜨게 한다.
    const map = project.maps[project.startMapId];
    map.upperTiles[0] = BENCH;
    store.replace(project);
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("투명 칩 붓은 하위 레이어를 선택해도 상위에 칠한다", () => {
    const onSend = vi.fn();
    const project = store.getCurrent();
    const modal = openDemoTeachModal({
      seed: { mapId: project.startMapId, x: 0, y: 0, w: 4, h: 4 },
      onSend,
    }) as unknown as FakeElement;

    (findByTestId(modal, `demo-teach-pick-${BENCH}`) as unknown as HTMLElement).click();
    // 하위 버튼을 눌러도 투명 칩은 하위 붓이 될 수 없다(잔디로 대체) — 다시 벤치를 고르고 칠한다.
    (findByTestId(modal, `demo-teach-pick-${BENCH}`) as unknown as HTMLElement).click();
    (findByTestId(modal, "demo-teach-cell-2-2") as unknown as HTMLElement).click();
    (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();

    const payload = onSend.mock.calls[0][0] as DemonstrationPayload;
    expect(payload.strokes[0]).toEqual({ layer: "upper", x: 2, y: 2, tile: BENCH });
    expect(payload.upper[2][2]).toBe(BENCH);
    expect(payload.lower[2][2]).not.toBe(BENCH);
  });
});
