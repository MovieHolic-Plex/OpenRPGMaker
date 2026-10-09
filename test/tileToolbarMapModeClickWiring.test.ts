/** @vitest-environment happy-dom */
/**
 * 렌더된 표준 도구막대의 맵 모드 버튼 → `selectMapModeTool` 배선 계약.
 *
 * 회귀 배경(2026-08-27 좌측 사이드바 적대적 리뷰 B4): 맵 모드 상태 계약은
 * `test/tileToolbarMapModeParity.test.ts` 가 헬퍼(`selectMapModeTool`)를 직접 불러서만
 * 재고 있었다. 그래서 도구막대의 옛 클릭 핸들러
 * (`if (item.id === "eyedropper") selectEyedropperTool(); else editorState.set({ tool: item.id })`)
 * 를 되살려도 여섯 스위트 21/21 이 전부 초록이었다 — 버튼과 헬퍼 사이의 배선만 무검증이었다.
 * 이 파일은 실제 표준 좌패널을 렌더해서 testid 로 버튼을 찾아 클릭하고, 그 결과 상태를 잰다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { layerSwitcherKey, makeLeftLayerSwitcher } from "@/editor/panels/leftLayerSwitcher";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetTileToolbarMenusForTests } from '@/editor/panels/tileToolbarMenus';

const STAMP = {
  cells: [{ dx: 0, dy: 0, layer: "lower", tile: 7 }],
  height: 1,
  source: { endTile: 7, startTile: 7 },
  width: 1,
} as const;
const SELECTION = { height: 2, mapId: "map-1", width: 2, x: 1, y: 1 } as const;

describe("렌더된 표준 도구막대의 맵 모드 클릭 배선", () => {
  let restore: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    resetTileToolbarMenusForTests();
    store.replace(createBlankProject());
    container = document.createElement("div");
    container.dataset.testid = 'left-palette-root';
    document.body.append(container);
    restore = editorState.subscribe(() => renderTilePalette(container));
  });

  afterEach(() => {
    restore();
    container.remove();
    resetTileToolbarMenusForTests();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function clickTool(testid: string): void {
    renderTilePalette(container);
    // 레이어 줄(높이·바닥·상위·이벤트)은 머리줄(menu.ts)이 소유한다 — 같은 부품을 붙여 누른다.
    if (testid.startsWith("layer-")) container.append(makeLeftLayerSwitcher(layerSwitcherKey(editorState.get())));
    const button = container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
    if (!button) throw new Error(`도구막대에 testid 없음: ${testid}`);
    button.click();
  }

  it("장면 놓기 버튼 클릭은 tool 과 layer 를 함께 이벤트로 바꾼다", () => {
    editorState.set({
      activePaletteStamp: null,
      currentMapId: store.getCurrent().startMapId,
      layer: "lower",
      paintShape: "pen",
      selection: null,
      tool: "paint",
    });

    clickTool("layer-event");

    expect(editorState.get().tool).toBe("event");
    expect(editorState.get().layer).toBe("event");
  });

  it("「높이」 버튼 클릭은 이벤트 레이어에서 바닥으로 탈출시킨다", () => {
    editorState.set({
      activePaletteStamp: null,
      currentMapId: store.getCurrent().startMapId,
      layer: "event",
      paintShape: "pen",
      selection: null,
      tool: "event",
    });

    clickTool("layer-relief");

    expect(editorState.get().tool).toBe("relief");
    expect(editorState.get().layer).toBe("lower");
  });

  it("버튼 클릭이 무장된 팔레트 스탬프와 선택 영역까지 정리한다", () => {
    editorState.set({
      activePaletteStamp: STAMP,
      currentMapId: store.getCurrent().startMapId,
      layer: "lower",
      paintShape: "pen",
      selection: SELECTION,
      tool: "paint",
    });

    clickTool("layer-relief");

    expect(editorState.get().tool).toBe("relief");
    expect(editorState.get().activePaletteStamp).toBeNull();
    expect(editorState.get().selection).toBeNull();
  });
});
