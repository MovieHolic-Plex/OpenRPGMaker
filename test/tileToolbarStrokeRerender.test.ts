/** @vitest-environment happy-dom */
/**
 * 칠하기 드래그 중 도구막대(= 좌측 타일 팔레트 전체) 재구축 빈도.
 *
 * 회귀 배경(2026-09-23 실측, 기본 100×100 마을): 도구막대의 store 구독이 선행 잠금 스로틀
 * (`if (timer) return`)이라 드래그 동안 120ms 마다 팔레트를 통째로 다시 지었다(한 번에
 * 100~200ms). 스트로크 중에는 팔레트에 바뀔 것이 없다 — 배지만 끝난 뒤 맞으면 된다.
 * 그래서 구독은 후행 디바운스여야 하고, 이 시험은 «스트로크가 끝난 뒤 한 번» 을 잠근다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { makeTileToolbar } from "@/editor/panels/tileToolbar";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { resetPointerStrokeGateForTests } from "@/editor/pointerStrokeGate";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const rerender = vi.fn();

function mountToolbar(): void {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId]!;
  makeTileToolbar({ map, rerender, state: editorState.get(), tileset: project.tilesets[map.tilesetId]! });
}

function paintCell(x: number): void {
  const mapId = store.getCurrent().startMapId;
  store.updateMap(mapId, (map) => { map.lowerTiles[x] = 1; }, { cells: [{ x, y: 0 }] });
}

beforeEach(() => {
  vi.useFakeTimers();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, layer: "lower", tool: "paint", paintShape: "pen" });
  mountToolbar();
  vi.runOnlyPendingTimers();
  rerender.mockClear();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  resetTileToolbarMenusForTests();
  resetPointerStrokeGateForTests();
});

describe("칠하기 스트로크 중 도구막대 재구축", () => {
  it("연속 칸 편집 동안에는 다시 짓지 않고, 멈춘 뒤 한 번만 짓는다", () => {
    for (let x = 0; x < 20; x += 1) {
      paintCell(x);
      vi.advanceTimersByTime(50);
    }
    expect(rerender).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(rerender).toHaveBeenCalledTimes(1);
  });

  // 천천히 끄는 드래그는 칸 사이가 디바운스 창(120ms)보다 길다. 시간 창만으로는 묶이지 않아
  // 칠하는 도중 팔레트가 다시 지어졌다 — 누르고 있는 동안은 미루고 뗄 때 한 번 짓는다.
  it("누른 채 천천히 끄는 동안에도 다시 짓지 않고, 손을 떼면 한 번 짓는다", () => {
    window.dispatchEvent(new Event("pointerdown"));
    // 스트로크 첫 칸의 기록 이벤트(되돌리기 단추 갱신)도 뗄 때까지 미룬다.
    window.dispatchEvent(new Event(MAP_EDIT_HISTORY_EVENT));
    for (let x = 0; x < 8; x += 1) {
      paintCell(x);
      vi.advanceTimersByTime(300);
    }
    expect(rerender).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("pointerup"));
    vi.advanceTimersByTime(200);
    expect(rerender).toHaveBeenCalledTimes(1);
  });

  it("누르지 않았을 때의 되돌리기는 기다리지 않고 바로 다시 짓는다", () => {
    window.dispatchEvent(new Event(MAP_EDIT_HISTORY_EVENT));
    expect(rerender).toHaveBeenCalledTimes(1);
  });
});
