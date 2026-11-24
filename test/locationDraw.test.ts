// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { editorState } from "@/editor/editorState";
import { LOCATION_DRAW_CTA_LABEL, renderLocationDrawCta, startDrawingLocations } from "@/editor/locationDrawCta";
import { locationLayerState, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";
import { renderInsideLocationCondition } from "@/editor/panels/eventEditor/conditionForm";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { addMapLocation, isLocationDrawClick } from "@/project/mapNamedLocations";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import { installLocationDrawModeGuard, dismissLocationDrawModeForLayer, dismissLocationDrawModeForTool, isLocationDrawMode } from "@/editor/locationDrawMode";
import { selectMapModeTool, selectTileTool } from "@/editor/panels/tileToolbarActions";
import { isolateTimers } from "./mergedTeardown";

// test/locationDrawCta.test.ts
//
// 「이 맵에는 아직 구역이 없습니다」 빈 상태의 **행동** 계약.
//
// 왜 회귀가 필요한가(어포던스 감사 2026-09-11 실측): 쓰는 지점(조건 폼·트리거·인카운터)이
// 문장 하나로 끝나 막다른 길이었고, 인카운터는 0개 맵에서 필드를 통째로 숨겨 기능의 존재 자체를
// 배울 수 없었다. 이 파일은 «없으면 행동을 낸다» 와 «있으면 소음이 되지 않는다» 를 고정한다.
describe("locationDrawCta", () => {
  isolateTimers();
  const MAP_ID = "cta_map";
  function seedMap(): GameMap {
    const project = createBlankProject();
    const map: GameMap = {
      id: MAP_ID,
      name: "빈 상태 맵",
      width: 20,
      height: 20,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(400).fill(TILE.GRASS),
      upperTiles: new Array(400).fill(TILE.EMPTY),
      events: [],
    };
    project.maps[MAP_ID] = map;
    project.startMapId = MAP_ID;
    store.replace(project);
    editorState.set({ currentMapId: MAP_ID });
    return map;
  }
  function testId(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }
  beforeEach(() => {
    setLocationLayerEnabled(false);
    document.body.innerHTML = "";
    seedMap();
  });
  describe("location draw CTA — 빈 상태의 행동", () => {
    it("구역이 없으면 버튼을 내고, 누르면 로케이션 레이어가 켜진다", () => {
      const cta = renderLocationDrawCta({ testId: "cta-probe" });
      expect(cta).not.toBeNull();
      expect(cta?.textContent).toBe(LOCATION_DRAW_CTA_LABEL);

      document.body.append(cta!);
      cta!.click();

      expect(locationLayerState().enabled).toBe(true);
      // 켠 결과가 지금 자리에 보이지 않을 수 있으므로(소비 표면은 모달) 토스트가 그 자리를 잇는다.
      expect(testId("toast")?.textContent).toContain("로케이션 레이어를 켰습니다");
    });

    it("구역이 하나라도 있으면 버튼을 내지 않는다", () => {
      const result = addMapLocation(store.getCurrent().maps[MAP_ID]!, { name: "정문 광장", x: 1, y: 1, w: 3, h: 3 });
      expect(result.ok).toBe(true);
      expect(renderLocationDrawCta({ testId: "cta-probe" })).toBeNull();
    });

    it("맵을 못 고른 상태(맵 없음)에서는 버튼을 내지 않는다", () => {
      const project = store.getCurrent();
      delete project.maps[MAP_ID];
      editorState.set({ currentMapId: "없는_맵" });
      expect(renderLocationDrawCta({ testId: "cta-probe" })).toBeNull();
    });

    it("조건 폼은 구역이 없을 때만 그리기 버튼을 붙인다", () => {
      const open = renderInsideLocationCondition({ kind: "insideLocation", locationId: "", inside: true }, () => {});
      expect(open.querySelector("[data-testid='event-condition-inside-location-draw']")).not.toBeNull();

      addMapLocation(store.getCurrent().maps[MAP_ID]!, { name: "부두", x: 12, y: 12, w: 4, h: 4 });
      const filled = renderInsideLocationCondition({ kind: "insideLocation", locationId: "", inside: true }, () => {});
      expect(filled.querySelector("[data-testid='event-condition-inside-location-draw']")).toBeNull();
    });

    it("startDrawingLocations 는 이미 켜져 있어도 상태를 켜진 채로 유지한다", () => {
      setLocationLayerEnabled(true);
      startDrawingLocations();
      expect(locationLayerState().enabled).toBe(true);
    });
  });
});

describe("locationDrawGuard", () => {
  isolateTimers();
  let dispose: (() => void) | null = null;
  describe("location draw mode guard", () => {
    afterEach(() => {
      dispose?.();
      dispose = null;
      setLocationLayerEnabled(false);
      editorState.set({ tool: "paint", layer: "lower" });
      delete document.body.dataset.locationDraw;
    });

    it("끄는 순간의 도구와 다른 도구로 넘어가면 그리기를 끝낸다", () => {
      editorState.set({ tool: "paint" });
      setLocationLayerEnabled(true);
      dispose = installLocationDrawModeGuard();
      expect(locationLayerState().enabled).toBe(true);

      // 같은 도구를 다시 고르는 것(팔레트 칸 클릭)도 도구 전이의 한 형태다.
      editorState.set({ tool: "fill" });
      expect(locationLayerState().enabled).toBe(false);
    });

    it("팬은 그리기를 빼앗지 않는다", () => {
      editorState.set({ tool: "paint" });
      setLocationLayerEnabled(true);
      dispose = installLocationDrawModeGuard();

      editorState.set({ tool: "pan" });
      expect(locationLayerState().enabled).toBe(true);
      editorState.set({ tool: "pan" });
      expect(locationLayerState().enabled).toBe(true);
    });

    it("바닥↔덧그림 전환은 그리기를 유지한다", () => {
      editorState.set({ tool: "paint", layer: "lower" });
      setLocationLayerEnabled(true);
      dispose = installLocationDrawModeGuard();

      editorState.set({ layer: "upper" });
      expect(locationLayerState().enabled).toBe(true);
      editorState.set({ layer: "lower" });
      expect(locationLayerState().enabled).toBe(true);
    });

    it("타일 팔레트에서 칸을 고르면 그리기가 끝난다", async () => {
      editorState.set({ tool: "paint", layer: "lower" });
      setLocationLayerEnabled(true);
      const { selectPaletteTile } = await import("@/editor/panels/tilePalette");
      selectPaletteTile(42);
      expect(locationLayerState().enabled).toBe(false);
      expect(editorState.get().selectedTile).toBe(42);
    });

    it("설치 시점에 이미 켜져 있으면 첫 전이에 곧바로 꺼지지 않는다", () => {
      editorState.set({ tool: "select" });
      setLocationLayerEnabled(true);
      dispose = installLocationDrawModeGuard();
      // 상태 변화 없음 — 여전히 켜져 있다.
      expect(locationLayerState().enabled).toBe(true);
      editorState.set({ tool: "event", layer: "event" });
      expect(locationLayerState().enabled).toBe(false);
    });
  });
});

describe("locationDrawMode", () => {
  isolateTimers();
  describe("location draw mode", () => {
    afterEach(() => {
      setLocationLayerEnabled(false);
      editorState.set({ tool: "paint", layer: "lower" });
      delete document.body.dataset.locationDraw;
    });

    it("isLocationDrawClick is only true on the same tile", () => {
      expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
      expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 4, y: 4 })).toBe(false);
    });

    it("keeps pan and dismisses paint/event tools", () => {
      setLocationLayerEnabled(true);
      expect(isLocationDrawMode()).toBe(true);
      dismissLocationDrawModeForTool("pan");
      expect(locationLayerState().enabled).toBe(true);
      dismissLocationDrawModeForTool("paint");
      expect(locationLayerState().enabled).toBe(false);
    });

    it("event layer dismisses draw mode", () => {
      setLocationLayerEnabled(true);
      dismissLocationDrawModeForLayer("lower");
      expect(locationLayerState().enabled).toBe(true);
      dismissLocationDrawModeForLayer("event");
      expect(locationLayerState().enabled).toBe(false);
    });

    it("selecting a tile tool turns the location layer off even if paint was already selected", () => {
      editorState.set({ tool: "paint", layer: "lower" });
      setLocationLayerEnabled(true);
      expect(document.body.dataset.locationDraw).toBe("1");
      selectTileTool("pen");
      expect(locationLayerState().enabled).toBe(false);
      expect(document.body.dataset.locationDraw).toBeUndefined();
    });

    it("selecting the event tool turns the location layer off", () => {
      setLocationLayerEnabled(true);
      selectMapModeTool("event");
      expect(locationLayerState().enabled).toBe(false);
      expect(editorState.get().tool).toBe("event");
    });
  });
});
