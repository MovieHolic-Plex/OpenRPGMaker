/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { installLocationDrawModeGuard } from "@/editor/locationDrawMode";
import { locationLayerState, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";

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
