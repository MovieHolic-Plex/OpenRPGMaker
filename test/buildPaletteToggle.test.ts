import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  getSelectedHousePresetId,
  isBuildPaletteEnabled,
  renderBuildPalettePopup,
  setBuildPaletteEnabled,
  setSelectedHousePresetId,
} from "@/editor/panels/buildPalette";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

// 회귀: 건축 모드를 켜면 영역 선택 툴로 전환해야 사용자가 바로 드래그로 영역을 지정할 수 있다.
// (이 전환이 없으면 건축을 눌러도 그리기 툴이라 "반응 없음"으로 보인다.)
describe("build palette toggle → tool switch", () => {
  beforeEach(() => {
    restoreDom = installFakeDom();
    installFakeLocalStorage();
    store.replace(createBlankProject());
    editorState.set({ tool: "paint" });
    setBuildPaletteEnabled(false);
    editorState.set({ tool: "paint" });
  });
  afterEach(() => {
    setBuildPaletteEnabled(false);
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("켜면 select 툴로, 끄면 paint 툴로 전환한다", () => {
    expect(isBuildPaletteEnabled()).toBe(false);

    setBuildPaletteEnabled(true);
    expect(isBuildPaletteEnabled()).toBe(true);
    expect(editorState.get().tool).toBe("select");

    setBuildPaletteEnabled(false);
    expect(isBuildPaletteEnabled()).toBe(false);
    expect(editorState.get().tool).toBe("paint");
  });

  it("집 프리셋 선택을 localStorage에 저장하고 팝오버 재렌더에서 복원한다", () => {
    setSelectedHousePresetId("house-2f");
    expect(getSelectedHousePresetId()).toBe("house-2f");

    setBuildPaletteEnabled(true);
    editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 8, height: 8 } });
    const popup = renderBuildPalettePopup();
    expect(popup).toBeTruthy();
    const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
    const active = fakePopup ? findByTestId(fakePopup, "build-house-preset-house-2f") : null;
    expect(active?.classList.contains("active")).toBe(true);

    if (fakePopup) findByTestId(fakePopup, "build-house-preset-l-house-1f")?.click();
    expect(getSelectedHousePresetId()).toBe("l-house-1f");
  });
});
