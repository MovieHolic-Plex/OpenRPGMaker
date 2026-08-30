import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  getBuildPaletteHouseOptions,
  getSelectedHouseKitId,
  getSelectedHouseShapeId,
  isBuildPaletteEnabled,
  renderBuildPalettePopup,
  setBuildPaletteHouseOption,
  setBuildPaletteEnabled,
  setSelectedHouseKitId,
  setSelectedHouseShapeId,
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

  it("집 형태와 키트 선택을 localStorage에 저장하고 팝오버 재렌더에서 복원한다", () => {
    setSelectedHouseShapeId("l");
    setSelectedHouseKitId("bright-plaster");
    expect(getSelectedHouseShapeId()).toBe("l");
    expect(getSelectedHouseKitId()).toBe("bright-plaster");

    setBuildPaletteEnabled(true);
    editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });
    const popup = renderBuildPalettePopup();
    expect(popup).toBeTruthy();
    const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
    expect(fakePopup ? findByTestId(fakePopup, "build-shape-l")?.classList.contains("active") : false).toBe(true);
    expect(fakePopup ? findByTestId(fakePopup, "build-kit-bright-plaster")?.classList.contains("active") : false).toBe(true);

    if (fakePopup) {
      findByTestId(fakePopup, "build-shape-u")?.click();
      findByTestId(fakePopup, "build-kit-blue-stone")?.click();
    }
    expect(getSelectedHouseShapeId()).toBe("u");
    expect(getSelectedHouseKitId()).toBe("blue-stone");
  });

  it("집 문 이벤트·내부·창문 옵션 토글을 저장한다", () => {
    expect(getBuildPaletteHouseOptions()).toEqual({ doorEvent: true, interior: true, windows: true });
    setBuildPaletteHouseOption("windows", false);
    expect(getBuildPaletteHouseOptions().windows).toBe(false);

    setBuildPaletteEnabled(true);
    editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });
    const popup = renderBuildPalettePopup();
    const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
    const windows = fakePopup ? findByTestId(fakePopup, "build-option-windows") : null;
    expect(windows?.classList.contains("active")).toBe(false);

    windows?.click();
    expect(getBuildPaletteHouseOptions().windows).toBe(true);
  });

  it("기존 건축 팝오버의 AI 채우기 버튼을 유지한다", () => {
    // Break: bottom-bar cleanup removes an unrelated build-palette action.
    setBuildPaletteEnabled(true);
    editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });

    const popup = renderBuildPalettePopup();
    const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;

    expect(fakePopup ? findByTestId(fakePopup, "build-palette-ai") : null).not.toBeNull();
  });

  it.each([
    ["house", "야외 집 한 채"],
    ["village", "마을"],
  ] as const)("%s 버튼은 결정론적 시공 대신 조수 턴을 스코프째로 즉시 실행한다", (primitive, instruction) => {
    const requestAssistant = vi.fn();
    setBuildPaletteEnabled(true);
    const selection = { mapId: "map_blank_start", x: 2, y: 3, width: 40, height: 38 };
    editorState.set({ currentMapId: "map_blank_start", selection });

    const popup = renderBuildPalettePopup(requestAssistant);
    const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
    findByTestId(fakePopup!, `build-palette-${primitive}`)?.click();

    // 실행체는 조수 세션 하나다 — 팝오버를 여는 대신 브리지 이벤트 1건으로 지시문까지 실어 보낸다.
    expect(requestAssistant).toHaveBeenCalledWith(selection, expect.objectContaining({
      autoRun: true,
      focus: true,
      instruction: expect.stringContaining(instruction),
    }));
  });
});
